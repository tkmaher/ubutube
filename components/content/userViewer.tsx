"use client";
import { useState, useEffect } from "react";
import { User, UserRaw } from "@/types/objects"
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { modifyBookmark } from "@/lib/auth-client";
import { revalidateUserCache } from "@/lib/actions";


function formatToMMDDYYYY(dateString: string) {
    const date = new Date(dateString.replace(' ', 'T')); // Standardize to ISO 8601
    if (isNaN(date.getTime())) return null; // Invalid date check
    
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    
    return `${mm}/${dd}/${yyyy}`;
}

export default function UserViewer({slug, initialData}: {slug: string, initialData: User | null}) {
    const decodedSlug = decodeURIComponent(slug);
    
    const [userData, setUserData] = useState<User | null>(initialData);
    const [loading, setLoading] = useState(!initialData); // only loading if no SSR data
    const [error, setError] = useState(false);
    const [collapsed, setCollapsed] = useState(true);

    const { user, bookmarks, setBookmarks } = useAuth();
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

    if (error) return (
        <div className="about">
            User {decodedSlug} not found!
        </div>
    );

    const bookmarkCallback = async (bookmarkSlug: string) => {
        if (!user || !bookmarks) return;
        const newBookmarks = currentBookmarks.includes(bookmarkSlug)
            ? currentBookmarks.filter(n => n !== bookmarkSlug) 
            : [...currentBookmarks, bookmarkSlug];
        setBookmarks(newBookmarks);
        setCurrentBookmarks(newBookmarks);
        await modifyBookmark(newBookmarks.join(','));
        await revalidateUserCache(userData!.username);
    };
    
    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div style={{opacity: loading ? 0 : 1}} className="content-columns">
                <div className="content-left content-left-artists">
                    <div>{userData?.username} - User since {userData && formatToMMDDYYYY(userData.created_at)}</div>

                    {currentBookmarks.length ? 
                        <div className="tabcontainer">
                            <div className="tab0 tabs" onClick={() => setCollapsed(c => !c)}>
                                <a>Bookmarks</a>
                                <div
                                    className="collapse-trigger"
                                >
                                    {collapsed ? "+" : "-"}
                                </div>
                            </div>
                            <motion.div
                                animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                                initial={false}
                                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                                style={{ overflow: "hidden" }}
                            >
                                {(currentBookmarks.length && userData) && 
                                    <div>
                                        {currentBookmarks.map((bookmark, index) => {
                                            const [filmId, filmName] = bookmark.split('@');
                                            return (
                                                <div key={index} className=" bookmark">
                                                    <Link href={`/film/${filmId}`} className="linkout ubu-linkout tab1">
                                                        {filmName}
                                                    </Link>
                                                    {user?.username === userData.username && 
                                                        <button onClick={() => bookmarkCallback(bookmark)}>
                                                            Remove bookmark
                                                        </button>
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                }
                            </motion.div>
                        </div> :
                        <div/>
                    }
                </div>
            </div>
        </div>
    );
}