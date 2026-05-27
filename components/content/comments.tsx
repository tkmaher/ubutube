"use client";
import { useEffect } from "react";
import { Comment } from "@/types/objects";

export default function Comments({filmId}: {filmId: string}) {
    useEffect(() => {
        async function fetchComments() {
            try {
                const res = await fetch(
                    `https://ubu-worker.tomaszkkmaher.workers.dev/api/films/${filmId}/comments`
                );
                const data: { cached: boolean; comments: Comment[]; success: boolean } = await res.json();
                console.log("Comments API response:", data);
            } catch (error) {
                console.error("Error fetching comments:", error);
            }
        }

        fetchComments();
    }, [filmId]);

    return (
        <div className="viewer-comments">
        </div>
    )
}