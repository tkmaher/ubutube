"use client";
import { useState, useEffect, useCallback } from "react";
import { Film, FilmSimpler } from "@/types/objects";
import Link from "next/link";
import VideoStream from "./streamer";
import { useRouter } from "next/navigation";
import ReactLenis from "lenis/react";
import Tooltip from "./tooltip";
import { useAuth } from "@/context/AuthContext";
import { modifyBookmark } from "@/lib/auth-client";
import Comments from "./comments";
import { revalidateUserCache } from "@/lib/actions";

const lenisOptions = { lerp: 0.2, syncTouch: true };

function RecommendedFilm({ src }: { src: FilmSimpler }) {
    return (
        <div className="content-rect tabs">
            <div>
                <Link href={`/film/${src.id}`} className="linkout">
                    {src.name}
                </Link>
                <div>{src.year}</div>
            </div>
        </div>
    );
}

function VideoButton({
    buttonText,
    text1,
    text2,
    callback,
}: {
    buttonText: string;
    text1: string;
    text2: string;
    callback?: () => void;
}) {
    const [useText1, setUseText1] = useState(true);

    return (
        <button
            className="tooltip-parent"
            onClick={() => {
                setUseText1(false);
                if (callback) callback();
            }}
            onMouseOut={() => setUseText1(true)}
        >
            {buttonText}
            <Tooltip text={useText1 ? text1 : text2} />
        </button>
    );
}

export default function FilmViewer({
    slug,
    initialData,
}: {
    slug: string;
    initialData: Film | null;
}) {
    const decodedSlug = decodeURIComponent(slug);
    const router = useRouter();
    const { bookmarks, setBookmarks, user } = useAuth();

    const [isBookmarked, setIsBookmarked] = useState(false);
    const [filmData, setFilmData] = useState<Film>(
        initialData ?? {
            name: "", artists: [""], description: "",
            year: "", ubuLink: "", src: "", bySameArtist: [], id: "",
        }
    );
    const [views, setViews] = useState<number>(0);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(false);
    const [vidIndexInQueue, setVidIndexInQueue] = useState(() => {
        if (!initialData) return 0;
        const i = initialData.bySameArtist.findIndex(f => f.id === initialData.id);
        return i !== -1 ? i : 0;
    });

    const [commenting, setCommenting] = useState(false);

    const bookmarkSlug = `${filmData.id}@${filmData.name}`;

    useEffect(() => {
        if (bookmarks) setIsBookmarked(bookmarks.includes(bookmarkSlug));
    }, [bookmarks, bookmarkSlug]);

    useEffect(() => {
        fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/films/${slug}/views`)
            .then(res => res.json())
            .then((data: { views: number; success: boolean }) => {
                if (data.success) setViews(data.views);
            })
            .catch(err => console.error("Film API error:", err));
    }, [slug]);

    useEffect(() => {
        if (initialData) return;
        setLoading(true);
        fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/films/${slug}`)
            .then(res => res.json())
            .then((data: { cached: boolean; film: Film; success: boolean }) => {
                if (data.success) {
                    setFilmData(data.film);
                    const i = data.film.bySameArtist.findIndex(f => f.id === data.film.id);
                    if (i !== -1) setVidIndexInQueue(i);
                } else {
                    setError(true);
                }
            })
            .catch(err => console.error("Film fetch error:", err))
            .finally(() => setLoading(false));
    }, [slug]);

    const nav = (dir: "back" | "forward") => {
        const queue = filmData.bySameArtist;
        if (queue.length < 2) return;
        let newIndex = vidIndexInQueue + (dir === "back" ? -1 : 1);
        if (newIndex < 0) newIndex = queue.length - 1;
        else if (newIndex >= queue.length) newIndex = 0;
        router.push(`/film/${queue[newIndex].id}`);
    };

    const bookmarkCallback = useCallback(async () => {
        if (!user || !bookmarks) {
            router.push("/login");
            return;
        }
        const newBookmarks = bookmarks.includes(bookmarkSlug)
            ? bookmarks.filter(n => n !== bookmarkSlug)
            : [...bookmarks, bookmarkSlug];
        setBookmarks(newBookmarks);
        setIsBookmarked(old => !old);
        await modifyBookmark(newBookmarks.join(","));
        await revalidateUserCache(user.username);
    }, [bookmarks, bookmarkSlug, setBookmarks, router, user]);

    const shareCallback = async () => {
        await navigator.clipboard.writeText(`https://ubutube.org/film/${slug}`);
    };

    if (error) return <div className="about">Film {decodedSlug} not found!</div>;

    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div style={{ opacity: loading ? 0 : 1 }} className="content-columns">
                <div className="content-left">
                    {filmData.src ? <VideoStream src={filmData.src} /> : "Error: no SRC found!"}

                    <div className="viewer-title">
                        <div>{filmData.name}</div>
                        <div className="stats">
                            <div>{views} {views !== 1 ? "views" : "view"}</div>
                            <VideoButton
                                buttonText={isBookmarked ? "Remove from bookmarks" : "Bookmark"}
                                text1={isBookmarked ? "Remove from bookmarks" : "Bookmark this video"}
                                text2={isBookmarked ? "Removed from bookmarks!" : "Added to bookmarks!"}
                                callback={bookmarkCallback}
                            />
                            <VideoButton
                                buttonText="Share"
                                text1="Copy link"
                                text2="Link copied to clipboard!"
                                callback={shareCallback}
                            />
                        </div>
                    </div>

                    <div className="viewer-artists">
                        <div className="viewer-desc-comments">
                            <div>{filmData.year}</div>
                            <div>{"—"}</div>
                            {filmData.artists.map((artist, i) => (
                                <div className="tabs" key={artist}>
                                    <Link href={`/artist/${encodeURIComponent(artist)}`} className="linkout">
                                        {artist}{i !== filmData.artists.length - 1 && ", "}
                                    </Link>
                                </div>
                            ))}
                        </div>
                        <div className="viewer-desc-comments comment-header">
                            Comments
                            <button onClick={() => setCommenting(old => !old)}>
                                {commenting ? "Back" : "Add comment..."}
                            </button>
                        </div>
                    </div>

                    <div className="viewer-desc-comments">
                        {filmData.description &&
                            <ReactLenis className="content-desc" data-lenis-prevent options={lenisOptions}>
                                <div
                                    className="viewer-description"
                                    dangerouslySetInnerHTML={{ __html: filmData.description }}
                                />
                            </ReactLenis>
                        }
                        <Comments 
                            filmId={filmData.id} 
                            filmName={filmData.name} 
                            addMode={commenting}
                            flipMode={() => setCommenting(old => !old)}
                        />
                    </div>

                    <a
                        href={`https://ubu.com/film/${filmData.ubuLink}`}
                        target="_blank"
                        className="linkout ubu-linkout"
                    >
                        Watch on ubu.com
                    </a>

                    {filmData.bySameArtist.length > 1 && (
                        <div className="nav-bar">
                            <a onClick={() => nav("back")} className="linkout">Previous</a>
                            <a onClick={() => nav("forward")} className="linkout">Next</a>
                        </div>
                    )}
                </div>

                {filmData.bySameArtist.length > 1 && (
                    <div className="content-right">
                        <div>More by {filmData.artists.length > 1 ? "these artists:" : "this artist:"}</div>
                        <ReactLenis
                            className="recommended-list"
                            data-lenis-prevent
                            options={lenisOptions}
                        >
                            {filmData.bySameArtist.map((rec, i) =>
                                i !== vidIndexInQueue ? <RecommendedFilm key={i} src={rec} /> : null
                            )}
                        </ReactLenis>
                    </div>
                )}
            </div>
        </div>
    );
}