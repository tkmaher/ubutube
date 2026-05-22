"use client";
import { useState, useEffect } from "react";
import { Film, FilmSimpler } from "@/types/objects"
import Link from "next/link";
import VideoStream from "./streamer";
import { useRouter } from "next/navigation";
import ReactLenis from "lenis/react";

function RecommendedFilm({src}: {src: FilmSimpler}) {

    return (
        <div className="content-rect tabs">
            <div>
                <Link 
                    href={`/film/${src.id}`}
                    className="linkout"
                >
                    {src.name}
                </Link> 
                <div>{src.year}</div>
            </div>
        </div>
    );
}

export default function FilmViewer({slug}: {slug: string}) {
    const decodedSlug = decodeURIComponent(slug);
    

    const [filmData, setFilmData] = useState<Film>({
        name: "",
        artists: [""],
        description: "",
        year: "",
        ubuLink: "",
        src: "",
        bySameArtist: [],
        id: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [vidIndexInQueue, setVidIndexInQueue] = useState(0);

    useEffect(() => {
        setLoading(true);
        fetch(
            `https://ubu-worker.tomaszkkmaher.workers.dev/api/films/${slug}`
        )
        .then(res => res.json())
        .then(
            (data: {
                cached: boolean;
                film: Film;
                success: boolean;
            }) => {
                console.log("Film API response:", data);
                if (data.success) {
                    setFilmData(data.film);
                    const i = data.film.bySameArtist.findIndex(f => f.id === data.film.id);
                    if (i !== -1) setVidIndexInQueue(i);
                }
                else {
                    console.error("Search API error:", data);
                    setError(true);
                }
            }
        )
        .catch(err => console.error("Search fetch error:", err))
        .finally(() => setLoading(false));
    }, [slug]);

    if (error) return (
        <div>
            Error displaying content: {decodedSlug} not found!
        </div>
    );

    const router = useRouter()

    const nav = (dir: "back" | "forward") => {

        const queue = filmData.bySameArtist;
        if (queue.length < 2) return;

        let newIndex = vidIndexInQueue + (dir === "back" ? -1 : 1);
        if (newIndex < 0) newIndex = queue.length - 1;
        else if (newIndex >= queue.length) newIndex = 0;

        const newFilm = queue[newIndex];
        router.push(`/film/${newFilm.id}`);
    }
    
    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div style={{opacity: loading ? 0 : 1}} className="content-columns">
                <div className="content-left">
                    {filmData.src ? <VideoStream src={filmData.src}/>: "Error: no SRC found!"}
                    <ReactLenis
                        className="content-desc"
                        style={{ opacity: loading ? 0 : 1 }}
                        data-lenis-prevent  
                        options={{
                            lerp: 0.2,      
                            syncTouch: true,
                        }}
                    >
                        <div>{filmData.name}</div>
                        <div className="viewer-artists">
                            <div>{filmData.year}</div>
                            <div>{" - "}</div>
                            {filmData.artists.map((artist, i) => (
                                <div className="tabs" key={artist}>
                                    <Link href={`/artist/${artist}`} className="linkout">
                                        {artist}{i != filmData.artists.length - 1 && ', '}
                                    </Link>
                                </div>
                            ))}
                        </div>
                        {filmData.description && 
                            <div>{filmData.description}</div>
                        }
                        <a href={`https://ubu.com/film/${filmData.ubuLink}`} target="_blank" className="linkout ubu-linkout">
                            Watch on ubu.com
                        </a>
                    </ReactLenis>
                    {filmData.bySameArtist.length > 1 && <div className="nav-bar">
                        <a onClick={() => nav("back")} className="linkout">Previous</a>
                        <a onClick={() => nav("forward")} className="linkout">Next</a>
                    </div>}
                </div>
                {filmData.bySameArtist.length > 0 && <div className="content-right">
                    <div>
                        More by {filmData.artists.length > 1 ? "these artists:" : "this artist:"}
                    </div>
                    <ReactLenis
                        className="recommended-list"
                        style={{ opacity: loading ? 0 : 1 }}
                        data-lenis-prevent  
                        options={{
                            lerp: 0.1,      
                            syncTouch: true,
                        }}
                    >
                        {filmData.bySameArtist.map((rec, i) => (
                            <div key={i}>
                                {i != vidIndexInQueue && <RecommendedFilm key={i} src={rec}/>}
                            </div>
                        ))}
                    </ReactLenis>
                </div>}
            </div>
        </div>
    );
}
