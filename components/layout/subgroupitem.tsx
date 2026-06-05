"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SearchResult } from "@/types/search";
import Link from "next/link";

interface Props {
    mode: "year" | "artist";
    label: string;
    films: SearchResult[];
    query: string;
}

function FilmItem({ film }: { film: SearchResult }) {
    return (
        <div className="tab2 tabs">
            <Link className="linkout" href={`/film/${film.id}`}>{film.name}</Link>
        </div>
    );
}

export function SubGroupItem({ label, films, mode, query }: Props) {
    const [collapsed, setCollapsed] = useState(false);
    const [resetKey, setResetKey] = useState(0);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setCollapsed(false);
        setResetKey(k => k + 1);
    }, [query]);

    return (
        <>
            <div className="tab1 tabs" onClick={() => setCollapsed(c => !c)}>
                {mode !== "artist" ? (
                    <Link
                        className="linkout"
                        href={`/artist/${encodeURIComponent(encodeURIComponent(label))}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {label}
                    </Link>
                ) : (
                    <a>{label}</a>
                )}
                <div className="collapse-trigger">{collapsed ? "+" : "×"}</div>
            </div>
            <motion.div
                key={resetKey}
                animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                initial={false}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
            >
                {films.map((film, k) => (
                    <FilmItem key={k} film={film} />
                ))}
            </motion.div>
        </>
    );
}