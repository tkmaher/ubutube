"use client";
import { useEffect, useState } from "react";
import { Comment } from "@/types/objects";
import ReactLenis from "lenis/react";

const lenisOptions = { lerp: 0.2, syncTouch: true };

function CommentItem({ comment }: { comment: Comment }) {
    return (
        <div className="comment-item">
            <div><a className="linkout" href={`/users/${comment.user_username}`}>{comment.user_username}</a> - {comment.date}</div>
            <div className="tab1">{comment.comment}</div>
        </div>
    );
}

export default function Comments({filmId}: {filmId: string}) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        async function fetchComments() {
            try {
                const res = await fetch(
                    `https://ubu-worker.tomaszkkmaher.workers.dev/api/films/${filmId}/comments`
                );
                const data: { cached: boolean; comments: Comment[]; success: boolean } = await res.json();
                console.log("Comments API response:", data);
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

    return (

        <div className="content-desc">
            <ReactLenis data-lenis-prevent options={lenisOptions} className="viewer-comments" style={style}>
                {comments.length === 0 ? (
                    <div>No comments yet.</div>
                ) : (
                    comments.map((comment, index) => (
                        <CommentItem key={index} comment={comment} />
                    ))
                )}
            </ReactLenis>
            <button>
                New comment
            </button>
        </div>
        
    )
}