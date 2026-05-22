"use client";
import { useState, useEffect } from "react";
import { Artist, FilmSimpler } from "@/types/objects"
import Link from "next/link";

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

export default function ArtistViewer({slug}: {slug: string}) {
    const decodedSlug = decodeURIComponent(slug);
    
    const [artistData, setArtistData] = useState<Artist>({
        name: "",
        description: "",
        years: "",
        ubuLink: "",
        bySameArtist: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch(
            `https://ubu-worker.tomaszkkmaher.workers.dev/api/artists/${slug}`
        )
        .then(res => res.json())
        .then(
            (data: {
                cached: boolean;
                artist: Artist;
                success: boolean;
            }) => {
                if (data.success) setArtistData(data.artist);
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
                    <div>{artistData.name}</div>
                    <div>{artistData.years}</div>
                    {artistData.description && 
                        <div>{artistData.description}</div>
                    }
                    <a href={`https://ubu.com/film/${artistData.ubuLink}`} target="_blank" className="linkout ubu-linkout">
                        View on ubu.com
                    </a>
                </div>
                {artistData.bySameArtist.length > 0 && <div>
                    <div>
                        Films by {artistData.name}: 
                    </div>
                    <div className="recommended-list">
                        {artistData.bySameArtist.map((rec, i) => (
                            <RecommendedFilm key={i} src={rec}/>
                        ))}
                    </div>
                </div>}
            </div>
        </div>
    );
}
