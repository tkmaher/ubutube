"use client";
import { useState, useEffect } from "react";
import { Film, FilmSimpler } from "@/types/objects"
import Link from "next/link";
import VideoStream from "./streamer";

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
                if (data.success) setFilmData(data.film);
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
    
    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div style={{opacity: loading ? 0 : 1}} className="content-columns">
                <div className="content-left">
                    {filmData.src ? <VideoStream src={filmData.src}/>: "Error: no SRC found!"}
                    <div>{filmData.name}</div>
                    <div className="viewer-artists">
                        <div>{filmData.year}</div>
                        <div>{" - "}</div>
                        {filmData.artists.map((artist, i) => (
                            <div className="tabs" key={artist}>
                                <Link href={`/artists/${artist}`} className="linkout">
                                    {artist}{i != filmData.artists.length - 1 && ', '}
                                </Link>
                            </div>
                        ))}
                    </div>
                    {filmData.description && 
                        <div>{filmData.description}</div>
                    }
                    <a href={`https://ubu.com/film/${filmData.ubuLink}`} target="_blank">
                        Watch on ubu.com
                    </a>
                </div>
                {filmData.bySameArtist.length > 0 && <div className="content-right">
                    <div>
                        More by {filmData.artists.length > 1 ? "these artists:" : "this artist:"}
                    </div>
                    <div className="recommended-list">
                        {filmData.bySameArtist.map((rec, i) => (
                            <RecommendedFilm key={i} src={rec}/>
                        ))}
                    </div>
                </div>}
            </div>
        </div>
    );
}
