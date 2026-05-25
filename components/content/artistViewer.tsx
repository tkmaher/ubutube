"use client";
import { useState, useEffect } from "react";
import { Artist, FilmSimpler } from "@/types/objects"
import Link from "next/link";
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

export default function ArtistViewer({slug, initialData}: {slug: string, initialData: Artist | null}) {
    const decodedSlug = decodeURIComponent(slug);
    
    const [artistData, setArtistData] = useState<Artist>(
        initialData ?? 
        {
            name: "",
            description: "",
            years: "",
            ubuLink: "",
            bySameArtist: [],
        }
    );
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
                <div className="content-left content-left-artists">
                    <div>{artistData.name} {artistData.years}</div>

                    <ReactLenis
                        className="content-left content-left-artists"
                        data-lenis-prevent  
                        options={{
                            lerp: 0.1,      
                            syncTouch: true,
                        }}
                    >
                        {artistData.description && 
                            <div>{artistData.description}</div>
                        }
                        <br/>
                        <a href={`https://ubu.com/film/${artistData.ubuLink}`} target="_blank" className="linkout ubu-linkout">
                            View on ubu.com
                        </a>
                    </ReactLenis>
                </div>
                {artistData.bySameArtist.length > 0 && 
                    <div className="content-right content-recommended-artists">
                        <div>
                            Films by {artistData.name}: 
                        </div>
                        <ReactLenis className="recommended-list"
                            data-lenis-prevent  
                            options={{
                                lerp: 0.1,      
                                syncTouch: true,
                            }} 
                        >
                            {artistData.bySameArtist.map((rec, i) => (
                                <RecommendedFilm key={i} src={rec}/>
                            ))}
                        </ReactLenis>
                    </div>
                }
            </div>
        </div>
    );
}
