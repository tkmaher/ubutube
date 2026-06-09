"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Comment } from "@/types/objects";
import { useAuth } from "@/context/AuthContext";
import { formatToMMDDYYYY } from "@/lib/utility"
import { useRouter } from "next/navigation";

function CommentItem({
    comment,
    isOwn,
    onDelete,
}: {
    comment: Comment;
    isOwn: boolean;
    onDelete: (date: string) => void;
}) {
    const [deleting, setDeleting] = useState(false);
 
    const handleDelete = async () => {
        if (!confirm("Delete this comment?")) return;
        setDeleting(true);
        await onDelete(comment.date);
        setDeleting(false);
    };
 
    return (
        <div className="comment-item">
            <div className="comment-meta">
                <a className="linkout" href={`/users/${comment.user_username}`}>
                    {comment.user_username}
                </a>
                {" — "}
                {formatToMMDDYYYY(comment.date)}
                
            </div>
            <div className="tab1">
                {comment.comment}
                {isOwn && (
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        aria-label="Delete comment"
                    >
                        Delete comment
                    </button>
                )}
            </div>
        </div>
    );
}

export default function Comments({filmId, filmName}: {filmId: string, filmName: string}) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [currComment, setCurrComment] = useState("");
    useEffect(() => {
        async function fetchComments() {
            try {
                const res = await fetch(
                    `https://ubu-worker.tomaszkkmaher.workers.dev/api/films/${filmId}/comments`
                );
                const data: { cached: boolean; comments: Comment[]; success: boolean } = await res.json();
                if (data.success) setComments(data.comments);
                else console.error("Comments API error:", data);
            } catch (error) {
                console.error("Error fetching comments:", error);
            }
            setLoaded(true);
        }

        fetchComments();
    }, [filmId]);

    const style = { opacity: loaded ? 1 : 0, transition: "opacity 0.1s" };

    const { user } = useAuth();

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!user) {
            router.push("/login");
            return;
        }
        setError(null);

        const wordCount = currComment.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount < 15) {
            setError(`Please write at least 15 words.`);
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/auth/comments`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    film_id: filmId,
                    film_name: filmName,
                    comment: currComment.trim(),
                }),
            });

            const data: { success?: boolean; error?: string; date?: string } =
                await res.json();

            if (!res.ok || !data.success) {
                setError(data.error ?? "Failed to post comment.");
            } else {
                // Optimistically prepend the new comment
                const newComment: Comment = {
                    user_username: user?.username!,
                    film_id: filmId,
                    film_name: filmName,
                    comment: currComment.trim(),
                    date: data.date!,
                };
                setComments((prev) => [newComment, ...prev]);
                setCurrComment("");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = useCallback(
        async (date: string) => {
            try {
                const res = await fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/auth/comments`, {
                    method: "DELETE",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ film_id: filmId, date }),
                });
 
                if (res.ok) {
                    setComments((prev) =>
                        prev.filter((c) => c.date !== date)
                    );
                } else {
                    const data: { error?: string } = await res.json();
                    console.error("Delete failed:", data.error);
                }
            } catch (err) {
                console.error("Error deleting comment:", err);
            }
        },
        [filmId]
    );


    return (
        <>
            {comments.length} Comment{comments.length !== 1 && "s"}
            <div className="content-desc">
                <form onSubmit={handleSubmit}>
                    <textarea 
                        placeholder="Please help maintain the quality of our site. Comments must be a minimum of 15 words long." 
                        className="comment-input" 
                        value={currComment}
                        onChange={e => setCurrComment(e.target.value)}
                        id="comment"
                    />
                    <button 
                        type="submit" 
                        className="comment-submit" 
                        disabled={submitting} 
                        aria-label="Submit comment"
                    >
                        Submit
                    </button>
                    <div>{error}</div>
                </form>
            </div>
            
            <div className="viewer-comments content-desc" style={style}>
                {comments.length === 0 ? (
                    <div>No comments yet.</div>
                ) : (
                    comments.map((comment, index) => (
                        <CommentItem
                            key={`${comment.user_username}-${comment.date}-${index}`}
                            comment={comment}
                            isOwn={user?.username === comment.user_username}
                            onDelete={handleDelete}
                        />
                    ))
                )}
            </div>
            
        </>
        
    )
}