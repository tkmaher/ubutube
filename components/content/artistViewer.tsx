"use client";
import { useState, useEffect } from "react";
import { Artist, FilmSimpler } from "@/types/objects";
import Link from "next/link";
import ReactLenis from "lenis/react";

const lenisOptions = { lerp: 0.1, syncTouch: true };

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

export default function ArtistViewer({
    slug,
    initialData,
}: {
    slug: string;
    initialData: Artist | null;
}) {
    const decodedSlug = decodeURIComponent(slug);

    const [artistData, setArtistData] = useState<Artist>(
        initialData ?? {
            name: "",
            description: "",
            years: "",
            ubuLink: "",
            bySameArtist: [],
        }
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 800px)");
        setIsMobile(mq.matches);
        mq.addEventListener("change", (e) => setIsMobile(e.matches));
        return () => mq.removeEventListener("change", () => {});
    }, []);

    useEffect(() => {
        if (initialData) return;
        setLoading(true);
        fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/artists/${slug}`)
            .then((res) => res.json())
            .then(
                (data: { cached: boolean; artist: Artist; success: boolean }) => {
                    if (data.success) setArtistData(data.artist);
                    else {
                        console.error("Artist API error:", data);
                        setError(true);
                    }
                }
            )
            .catch((err) => console.error("Artist fetch error:", err))
            .finally(() => setLoading(false));
    }, [slug]);

    if (error) return <div className="about">Artist {decodedSlug} not found!</div>;

    const leftContent = (
        <>

            {artistData.description && <div dangerouslySetInnerHTML={{ __html: artistData.description}}/>}
            
        </>
    );

    const rightContent = artistData.bySameArtist.length > 0 && (
        <>
            <div className="about">Films by {artistData.name}:</div>
            {artistData.bySameArtist.map((rec, i) => (
                <RecommendedFilm key={i} src={rec} />
            ))}
        </>
    );

    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div className="viewer-title">
                {artistData.name} {artistData.years}
            </div>
            <div style={{ opacity: loading ? 0 : 1 }} className="content-columns">
                {isMobile ? (
                    <div className="content-left content-left-artists">
                        {leftContent}
                        {rightContent && (
                            <div className="content-right content-recommended-artists">
                                {rightContent}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <ReactLenis
                            data-lenis-prevent
                            options={lenisOptions}
                            className="content-left content-left-artists"
                        >
                            {leftContent}
                        </ReactLenis>
                        {artistData.bySameArtist.length > 0 && (
                            <div className="content-right content-recommended-artists">
                                <div className="about">Films by {artistData.name}:</div>
                                <ReactLenis
                                    className="recommended-list"
                                    data-lenis-prevent
                                    options={lenisOptions}
                                >
                                    {artistData.bySameArtist.map((rec, i) => (
                                        <RecommendedFilm key={i} src={rec} />
                                    ))}
                                </ReactLenis>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className="content-footer">
                <a
                    href={`https://ubu.com/film/${artistData.ubuLink}`}
                    target="_blank"
                    className="linkout ubu-linkout"
                >
                    View on ubu.com
                </a>
            </div>
        </div>
    );
}