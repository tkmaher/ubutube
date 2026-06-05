"use client";
import { useState, useEffect, useCallback } from "react";
import { User, UserRaw, Comment } from "@/types/objects";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { deleteUser, editUser, logout, modifyBookmark } from "@/lib/auth-client";
import { revalidateUserCache } from "@/lib/actions";
import { formatToMMDDYYYY } from "@/lib/utility";
import { useRouter } from "next/navigation";
import ReactLenis from "lenis/react";

const lenisOptions = { lerp: 0.1, syncTouch: true };

function UserEditor({ submitCallback }: { submitCallback: (newLink: string) => void }) {
    const { user, setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [username, setUsername] = useState(user?.username);
    const [link, setLink] = useState(user?.link ?? "");
    const [submitText, setSubmitText] = useState<string | null>(null);
    const [deleteText, setDeleteText] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!user || !username) return;
        if (link && !link.includes("https://")) {
            setSubmitText("Link must begin with https://.");
            return;
        }
        setLoading(true);
        await revalidateUserCache(user.username);
        try {
            await editUser(link ?? "", username);
            setSubmitText("Profile updated!");
            setUser({ ...user, username, link: link ?? "" });
            submitCallback(link ?? "");
            if (username !== user.username)
                router.push(`/users/${encodeURIComponent(encodeURIComponent(username))}`);
        } catch (err) {
            setSubmitText(err instanceof Error ? err.message : "Update failed");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!user || password === "") return;
        setLoading(true);
        await revalidateUserCache(user.username);
        try {
            await deleteUser(password);
            setDeleteText("Account deleted!");
            await logout();
            router.push("/");
            setUser(null);
            submitCallback(link ?? "");
        } catch (err) {
            setDeleteText(err instanceof Error ? err.message : "Deletion failed");
        } finally {
            setLoading(false);
        }
    };

    if (!user) return (
        <>
            <div>Error: you are not logged in.</div>
            <button onClick={() => router.push("/login")} className="ubu-linkout">Log in</button>
        </>
    );

    return (
        <>
            <form onSubmit={handleSubmit} className="auth-form">
                <label>
                    <div>Username</div>
                    <input type="username" value={username} required autoComplete="username"
                        onChange={e => setUsername(e.target.value)} id="username"
                    />
                </label>
                <label>
                    <div>Link</div>
                    <input type="link" value={link} autoComplete="link"
                        onChange={e => setLink(e.target.value)} id="link"
                    />
                </label>
                {submitText && <div>{submitText}</div>}
                <button type="submit" className="ubu-linkout" disabled={loading}>
                    {loading ? "Working…" : "Submit"}
                </button>
            </form>

            <form className="auth-form" onSubmit={handleDelete}>
                <button className="ubu-linkout" onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    setDeleting(old => !old);
                }}>
                    Delete account
                </button>
                {deleting && 
                    <>
                        <label>
                            <div>Password</div>
                            <input type="password" value={password} autoComplete="password" required
                                onChange={e => setPassword(e.target.value)} id="confirm-delete"
                            />
                        </label>
                        {deleteText && <div>{deleteText}</div>}
                        <button 
                            className="ubu-linkout" type="submit"
                            disabled={loading}
                            style={{ color: "tomato" }}
                        >
                            Delete account forever
                        </button>
                    </>
                }
            </form>
        </>
    );
}

function BookmarkDisplay({ currentBookmarks, setCurrentBookmarks, userData }: {
    currentBookmarks: string[];
    setCurrentBookmarks: (bookmarks: string[]) => void;
    userData: User | null;
}) {
    const { user, bookmarks, setBookmarks } = useAuth();
    const [deleting, setDeleting] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const bookmarkCallback = async (bookmarkSlug: string) => {
        if (!user || !bookmarks) return;
        const newBookmarks = currentBookmarks.includes(bookmarkSlug)
            ? currentBookmarks.filter(n => n !== bookmarkSlug)
            : [...currentBookmarks, bookmarkSlug];
        setBookmarks(newBookmarks);
        setCurrentBookmarks(newBookmarks);
        setDeleting(true);
        await modifyBookmark(newBookmarks.join(","));
        setDeleting(false);
    };

    return (
        <div className="tabcontainer">
            <div className="tab0 tabs" onClick={() => setCollapsed(c => !c)}>
                <a>Bookmarks</a>
                <div className="collapse-trigger">{collapsed ? "+" : "×"}</div>
            </div>
            <motion.div
                animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                initial={false}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
            >
                {currentBookmarks.length > 0 && userData && (
                    <div className="bookmarks-viewer">
                        {currentBookmarks.map((bookmark, i) => {
                            const [filmId, filmName] = bookmark.split("@");
                            return (
                                <div key={i} className="bookmark tabs">
                                    <Link href={`/film/${filmId}`} className="linkout ubu-linkout tab1">
                                        {filmName}
                                    </Link>
                                    {user?.username === userData.username && (
                                        <div className="linkout button"
                                            onClick={() => { if (!deleting) bookmarkCallback(bookmark); }}>
                                            Remove bookmark
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </div>
    );
}

function CommentDisplay({ userData, setUserData }: {
    userData: User;
    setUserData: (user: User) => void;
}) {
    const { user } = useAuth();
    const [deleting, setDeleting] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const commentCallback = async (comment: Comment) => {
        if (!confirm("Delete this comment?")) return;
        setDeleting(true);
        try {
            const res = await fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/auth/comments`, {
                method: "DELETE",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ film_id: comment.film_id, date: comment.date }),
            });
            if (res.ok) {
                setUserData({ ...userData, comments: userData.comments.filter(c => c !== comment) });
            } else {
                const data: { error?: string } = await res.json();
                console.error("Delete failed:", data.error);
            }
        } catch (err) {
            console.error("Error deleting comment:", err);
        }
        setDeleting(false);
    };

    return (
        <div className="tabcontainer">
            <div className="tab0 tabs" onClick={() => setCollapsed(c => !c)}>
                <a>Comments</a>
                <div className="collapse-trigger">{collapsed ? "+" : "×"}</div>
            </div>
            <motion.div
                animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                initial={false}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
            >
                {userData.comments.length > 0 && (
                    <div>
                        {userData.comments.map((commentIn, i) => {
                            const { film_name, film_id, comment, date } = commentIn;
                            return (
                                <div key={i} className="comment tabs">
                                    <div className="tab1">
                                        {"On "}
                                        <Link href={`/film/${film_id}`} className="linkout ubu-linkout">
                                            {film_name}
                                        </Link>
                                        {" — "}{formatToMMDDYYYY(date)}
                                    </div>
                                    <div className="tab1">
                                        {comment}
                                        {user?.username === userData.username && (
                                            <div className="linkout button"
                                                onClick={() => { if (!deleting) commentCallback(commentIn); }}>
                                                Delete comment
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </div>
    );
}

export default function UserViewer({ slug, initialData }: { slug: string; initialData: User | null }) {
    const { user } = useAuth();
    const decodedSlug = decodeURIComponent(slug);

    const [userData, setUserData] = useState<User | null>(initialData);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(false);
    const [editing, setEditing] = useState(false);
    const [currentBookmarks, setCurrentBookmarks] = useState<string[]>(initialData?.bookmarks || []);

    useEffect(() => {
        if (initialData) return;
        setLoading(true);
        fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/users/${slug}`)
            .then(res => res.json())
            .then((data: { cached: boolean; user: UserRaw; success: boolean }) => {
                if (data.success && data.user) {
                    const bookmarks = data.user.bookmarks ? data.user.bookmarks.split(",") : [];
                    setUserData({ ...data.user, bookmarks, comments: data.user.comments ?? [] });
                    setCurrentBookmarks(bookmarks);
                } else {
                    setError(true);
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [slug]);

    const setBookmarksCallback = useCallback(async (newBookmarks: string[]) => {
        setCurrentBookmarks(newBookmarks);
        await revalidateUserCache(userData!.username);
    }, [userData]);

    const setUserDataCallback = useCallback(async (u: User) => {
        setUserData(u);
        await revalidateUserCache(userData!.username);
    }, [userData]);

    const submitCallback = useCallback((newLink: string) => {
        if (!userData) return;
        setUserData({ ...userData, link: newLink });
        setEditing(false);
    }, [userData]);

    if (error) return <div className="about">User {decodedSlug} not found!</div>;

    const hasRightContent = currentBookmarks.length > 0 || (userData?.comments.length ?? 0) > 0;

    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div className="viewer-title">
                {userData?.username} — User since {userData && formatToMMDDYYYY(userData.created_at)}
                {userData?.username === user?.username && (
                    <button className="ubu-linkout" onClick={() => setEditing(old => !old)}>
                        {editing ? "Go back" : "Edit profile"}
                    </button>
                )}
            </div>
            <div style={{ opacity: loading ? 0 : 1 }} className="content-columns">
                <div className="content-left">
                    {editing ? (
                        <UserEditor submitCallback={submitCallback} />
                    ) : (
                        <a className="linkout ubu-linkout" href={userData?.link} target="_blank">
                            {userData?.link}
                        </a>
                    )}
                </div>
                {hasRightContent && (
                    <ReactLenis data-lenis-prevent options={lenisOptions} className="content-right content-right-user">
                        {currentBookmarks.length > 0 && (
                            <BookmarkDisplay
                                currentBookmarks={currentBookmarks}
                                setCurrentBookmarks={setBookmarksCallback}
                                userData={userData}
                            />
                        )}
                        {userData?.comments.length ? (
                            <CommentDisplay userData={userData} setUserData={setUserDataCallback} />
                        ) : null}
                    </ReactLenis>
                )}
            </div>
        </div>
    );
}