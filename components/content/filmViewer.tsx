"use client";
import { useState, useEffect } from "react";
import { Film } from "@/app/types/objects"

function RecommendedFilm({src}: {src: FilmSimpler}) {

    return (
        <div>
            {src.name} • {src.year}
        </div>
    );
}

export default function FilmViewer({slug}: {slug: string}) {
    const decodedSlug = decodeURIComponent(slug);

    const [filmData, setFilmData] = useState(null);
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
                film: SearchResult[];
                success: boolean;
            }) => {
                if (data.success) setRawResults(data.film);
                else {
                    console.error("Search API error:", data);
                    setError(true);
                }
            }
        )
        .catch(err => console.error("Search fetch error:", err))
        .finally(() => setLoading(false));
    }, [searchQuery]);

    if (error) return (
        <div>
            Error displaying content: {decodedSlug} not found!
        </div>
    );
    
    return (
        <>
            {loading && <div>Loading...</div>}
            <div style={{opacity: loading ? 0 : 1}}>
                <div className="content-left>
                    {filmData.src ? <iframe src={filmData.src}/> : "Error: no SRC found!"}
                    <div className="viewer-artists">
                        <div>{filmData.year}</div>
                        <div>•</div>
                        {filmData.artists.map((artist, i) => {
                            <Link href=`/artists/${artist}`>{artist}</Link>
                        })}
                    </div>
                    {filmData.description && 
                        <div>{filmData.description}</div>
                    }
                    <a href=`https://ubu.com/film/${filmData.ubuLink}` target="_blank">
                        Watch on ubu.com
                    </a>
                </div>
                {filmData.artists.length > 0 && <div className="content-right>
                    <div>
                        More by {filmData.artists.length > 1 ? "these artists:" : "this artist:")
                    </div>
                     {filmData.bySameArtist.map((rec, i) => {
                        <RecommendedFilm src={rec}/>
                    })}
                </div>}
            </div>
        </>
    );
}
