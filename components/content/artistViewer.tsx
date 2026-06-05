"use client";
import { useState, useEffect } from "react";
import { Artist, FilmSimpler } from "@/types/objects";
import Link from "next/link";
import ReactLenis from "lenis/react";
import { motion } from "framer-motion";

const lenisOptions = { lerp: 0.1, syncTouch: true };

function RecommendedFilm({ src }: { src: FilmSimpler }) {
    return (
        <div className="content-rect tabs tab1">
            <div>
                <Link href={`/film/${src.id}`} className="linkout">
                    {src.name}
                </Link>
                <div>{src.year}</div>
            </div>
        </div>
    );
}

function RecommendedFilms({ films }: { films: FilmSimpler[] }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="tabcontainer">
            <div className="tab0 tabs" onClick={() => setCollapsed(c => !c)}>
                <a>Films</a>
                <div className="collapse-trigger">{collapsed ? "+" : "×"}</div>
            </div>
            <motion.div
                animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                initial={false}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
            >
                <div className="bookmarks-viewer">
                    {films.map((film, i) => <RecommendedFilm key={i} src={film} />)}
                </div>
            </motion.div>
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
        initialData ?? { name: "", description: "", years: "", ubuLink: "", bySameArtist: [] }
    );
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (initialData) return;
        setLoading(true);
        fetch(`https://ubu-worker.tomaszkkmaher.workers.dev/api/artists/${slug}`)
            .then(res => res.json())
            .then((data: { cached: boolean; artist: Artist; success: boolean }) => {
                if (data.success) setArtistData(data.artist);
                else setError(true);
            })
            .catch(err => console.error("Artist fetch error:", err))
            .finally(() => setLoading(false));
    }, [slug]);

    if (error) return <div className="about">Artist {decodedSlug} not found!</div>;

    return (
        <div className="content-container">
            {loading && <div className="loader">Loading...</div>}
            <div className="viewer-title">
                {artistData.name} {artistData.years}
            </div>
            <div style={{ opacity: loading ? 0 : 1 }} className="content-columns">
                <ReactLenis data-lenis-prevent options={lenisOptions} className="content-left">
                    {artistData.description && (
                        <div dangerouslySetInnerHTML={{ __html: artistData.description }} />
                    )}
                </ReactLenis>
                {artistData.bySameArtist.length > 0 && (
                    <ReactLenis className="recommended-list" data-lenis-prevent options={lenisOptions}>
                        <RecommendedFilms films={artistData.bySameArtist} />
                    </ReactLenis>
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