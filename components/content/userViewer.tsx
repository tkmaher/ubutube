"use client";
import { useState, useEffect, useCallback } from "react";
import { User, UserRaw, Comment } from "@/types/objects"
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { editUser, modifyBookmark } from "@/lib/auth-client";
import { revalidateUserCache } from "@/lib/actions";
import { formatToMMDDYYYY } from "@/lib/utility"
import { useRouter } from "next/navigation";

function UserEditor({ submitCallback }: { submitCallback: (newLink: string) => void}) {
    const { user, setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState(user?.username);
    const [link, setLink] = useState(user?.link);
    const [submitText, setSubmitText] = useState<string | null>(null);

    const router = useRouter();

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!user || !username) return;
        if (link != "" && link != null && !link?.includes("https://")) {
            setSubmitText("Link must begin with https://.");
            return;
        }
        setLoading(true);
        await revalidateUserCache(user.username);
        try {
            await editUser(link ?? "", username);
        } catch (err) {
            setSubmitText(err instanceof Error ? err.message : "Registration failed");
        } finally {
            setSubmitText("Profile updated!");
            router.push(`/users/${username}`);
            setUser({...user, username: username, link: link ?? ""});
            setLoading(false);
            submitCallback(link ?? "");
        }
    };

    if (!user) return (
        <>
            <div>Error: you are not logged in.</div>
            <button onClick={() => router.push("/login")} className="ubu-linkout">Log in</button>
        </>
    );
    return (
        <form onSubmit={handleSubmit} className="auth-form">

          <label>
            <div>Username</div>
            <input
              type="username" value={username} required autoComplete="username"
              onChange={e => setUsername(e.target.value)}
            />
          </label>

          <label>
            <div>Link</div>
            <input
              type="link" value={link} autoComplete="link"
              onChange={e => setLink(e.target.value)}
            />
          </label>
            {submitText && 
                <div>
                    {submitText}
                </div>
            }
          <button type="submit" className="ubu-linkout" disabled={loading}>
            {loading ? "Working…" : "Submit"}
          </button>
        </form>
    )
}

function BookmarkDisplay({ currentBookmarks, setCurrentBookmarks, userData }: { 
    currentBookmarks: string[], 
    setCurrentBookmarks: (bookmarks: string[]) => {},
    userData: User | null,
}) {
    const { user, bookmarks, setBookmarks } = useAuth();
    const [deleting, setDeleting] = useState(false);
    const [bCollapsed, setBCollapsed] = useState(false);

    const bookmarkCallback = async (bookmarkSlug: string) => {
        if (!user || !bookmarks) return;
        const newBookmarks = currentBookmarks.includes(bookmarkSlug)
            ? currentBookmarks.filter(n => n !== bookmarkSlug) 
            : [...currentBookmarks, bookmarkSlug];
        setBookmarks(newBookmarks);
        setCurrentBookmarks(newBookmarks);
        setDeleting(true);
        await modifyBookmark(newBookmarks.join(','));
        setDeleting(false);
    };

    return (
        <div className="tabcontainer">
            <div className="tab0 tabs" onClick={() => setBCollapsed(c => !c)}>
                <a>Bookmarks</a>
                <div
                    className="collapse-trigger"
                >
                    {bCollapsed ? "+" : "-"}
                </div>
            </div>
            <motion.div
                animate={{ height: bCollapsed ? 0 : "auto", opacity: bCollapsed ? 0 : 1 }}
                initial={false}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
            >
                {(currentBookmarks.length && userData) && 
                    <div className="bookmarks-viewer">
                        {currentBookmarks.map((bookmark, index) => {
                            const [filmId, filmName] = bookmark.split('@');
                            return (
                                <div key={index} className="bookmark">
                                    <Link href={`/film/${filmId}`} className="linkout ubu-linkout tab1">
                                        {filmName}
                                    </Link>
                                    {user?.username === userData.username && 
                                        <button 
                                            onClick={() => bookmarkCallback(bookmark)}
                                            disabled={deleting}
                                        >
                                            Remove bookmark
                                        </button>
                                    }
                                </div>
                            );
                        })}
                    </div>
                }
            </motion.div>
        </div>
    )
}

function CommentDisplay({ userData, setUserData }: { userData: User, setUserData: (user: User) => {} }) {
    const { user } = useAuth();
    const [deleting, setDeleting] = useState(false);
    const [cCollapsed, setCCollapsed] = useState(false);

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
                if (!userData) return;
                const newData = {
                    ...userData,
                    comments: userData?.comments.filter(com => com != comment)
                }
                setUserData(newData);
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
            <div className="tab0 tabs" onClick={() => setCCollapsed(c => !c)}>
                <a>Comments</a>
                <div
                    className="collapse-trigger"
                >
                    {cCollapsed ? "+" : "-"}
                </div>
            </div>
            <motion.div
                animate={{ height: cCollapsed ? 0 : "auto", opacity: cCollapsed ? 0 : 1 }}
                initial={false}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
            >
                {(userData?.comments.length) && 
                    <div>
                        {userData.comments.map((commentIn, index) => {
                            const { film_name, film_id, comment, date } = commentIn;
                            return (
                                <div key={index} className="comment">
                                    <div className="tab1">
                                        {`On `}
                                        <Link href={`/film/${film_id}`} className="linkout ubu-linkout">
                                            {film_name}
                                        </Link>
                                        {` — `}{formatToMMDDYYYY(date)}
                                    </div>
                                    <div className="tab1">
                                        {comment}
                                        {user?.username === userData.username && 
                                            <button 
                                                onClick={() => commentCallback(commentIn)}
                                                disabled={deleting}
                                            >
                                                Delete comment
                                            </button>
                                        }
                                    </div>
                                    
                                </div>
                            );
                        })}
                    </div>
                }
            </motion.div>
        </div>
    )
}

export default function UserViewer({slug, initialData}: {slug: string, initialData: User | null}) {
    const { user } = useAuth();

    const decodedSlug = decodeURIComponent(slug);
    
    const [userData, setUserData] = useState<User | null>(initialData);
    const [loading, setLoading] = useState(!initialData); // only loading if no SSR data
    const [error, setError] = useState(false);
    const [editing, setEditing] = useState(false);

    const [currentBookmarks, setCurrentBookmarks] = useState<string[]>(initialData?.bookmarks || []);

    useEffect(() => {
        console.log("User API response:", initialData);

        if (initialData) return;

        setLoading(true);
        fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/users/${slug}`)
            .then(res => res.json())
            .then((data: { cached: boolean; user: UserRaw; success: boolean }) => {
                if (data.success && data.user) {
                    setUserData({
                        ...data.user,
                        bookmarks: data.user.bookmarks ? data.user.bookmarks.split(',') : [],
                        comments: data.user.comments ?? [],
                    });
                    setCurrentBookmarks(data.user.bookmarks ? data.user.bookmarks.split(',') : []);
                } else {
                    console.error("User API error:", data);
                    setError(true);
                }
            })
            .catch(err => {
                console.error("User fetch error:", err);
                setError(true);
            })
            .finally(() => setLoading(false));
    }, [slug]);

    

    const setBookmarksCallback = useCallback(async (newBookmarks: string[]) => {
        setCurrentBookmarks(newBookmarks);
        await revalidateUserCache(userData!.username);
    }, [setCurrentBookmarks]);

    const setUserDataCallback = useCallback(async (user: User) => {
        setUserData(user);
        await revalidateUserCache(userData!.username);
    }, [setCurrentBookmarks]);

    const submitCallback = useCallback((newLink: string) => {
        if (!userData) return;
        const newData = {
            ...userData,
            link: newLink
        }
        setUserData(newData);
        setEditing(false);
    }, [setUserData]);

    if (error) return (
        <div className="about">
            User {decodedSlug} not found!
        </div>
    );
    
    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div style={{opacity: loading ? 0 : 1}} className="content-columns">
                <div className="content-left content-left-artists">
                    {editing ? <UserEditor submitCallback={submitCallback}/> : <>
                        <div>{userData?.username} — User since {userData && formatToMMDDYYYY(userData.created_at)}</div>
                        <a className="linkout ubu-linkout" href={userData?.link} target="_blank">
                            {userData?.link}
                        </a>
                        {currentBookmarks.length ? 
                            <BookmarkDisplay 
                                currentBookmarks={currentBookmarks}
                                setCurrentBookmarks={setBookmarksCallback}
                                userData={userData}
                            /> :
                            <div/>
                        }

                        {userData?.comments.length ? 
                            <CommentDisplay 
                                userData={userData}
                                setUserData={setUserDataCallback}
                            /> :
                            <div/>
                        }
                        </>
                    }
                    {userData?.username === user?.username && 
                        <button className="ubu-linkout" onClick={() => setEditing(old => !old)}>
                            {editing ? "Go back" : "Edit profile"}
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}