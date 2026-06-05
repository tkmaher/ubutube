"use client";

import { UserList } from "@/types/objects";
import ReactLenis from "lenis/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import "@/styles/content.scss";
import "@/styles/search.scss";


const lenisOptions = { lerp: 0.1, syncTouch: true };

export default function UserListViewer({ initialData, page, order }: { 
    initialData: UserList | null, 
    page: number,
    order: string
}) {
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(false);
    const [userList, setUserList] = useState<UserList | null>(initialData);

    useEffect(() => {
        if (initialData) return;
        setLoading(true);
        fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/userList?page=${page ?? 1}&order=${order}`)
            .then(res => res.json())
            .then((data: { cached: boolean; userList: UserList; success: boolean }) => {
                console.log(`Fetched user list for page ${page} and order ${order}. Got:`, data);
                if (data.success && data.userList) {
                    setUserList(data.userList);
                } else {
                    setError(true);
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [page, order]);

    if (error) return <div className="about">Userlist not found!</div>;

    return (
        <div className="content-container">
            <div className="viewer-title">
                <div>
                    User list ({userList?.totalUsers ?? "?"} user{userList?.totalUsers === 1 ? "" : "s"})
                </div>
                <button>
                    <Link href={`/userlist?page=1&order=${order === "asc" ? "desc" : "asc"}`} className="linkout ubu-linkout">
                        {order === "asc" ? "Newest first" : "Oldest first"}
                    </Link>
                </button>
            </div>
            {loading && <div className="loader">Loading...</div>}
            <div style={{ opacity: loading ? 0 : 1 }} className="content-columns">
                {userList && <ReactLenis data-lenis-prevent options={lenisOptions} className="content-right content-right-userlist">
                    {userList.users.map((user) => (
                        <Link key={user.username} href={`/users/${encodeURIComponent(encodeURIComponent(user.username))}`} className="tabs linkout">
                            {user.username}
                        </Link>
                    ))}
                </ReactLenis>}
            </div>
            <div className="content-footer">
                <div className="search-row">
                    {page <= 1 ? <div></div> :
                        <Link href={`/userlist?page=1&order=${order}`} className="linkout ubu-linkout">
                            ←
                        </Link>
                    }
                        <span>
                            Page {page} of{" "}{userList?.totalPages ?? "?"}
                        </span>
                    {(userList && page >= userList?.totalPages) ? <div></div> :
                        <Link href={`/userlist?page=${page + 1}&order=${order}`} className="linkout ubu-linkout"
                            style={{pointerEvents: page >= Math.ceil((userList?.totalUsers ?? 0) / 50) - 1 ? "none" : undefined}}
                        >
                            →
                        </Link>
                    }
                </div>
            </div>
        </div>
    );
}