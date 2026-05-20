"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { SearchResult } from "@/types/search";
import Link from "next/link";

interface Props {
    mode: "year" | "artist";
    label: string;
    films: SearchResult[];
}

function FilmItem({ film }: {film: SearchResult}) {
    const link = `/film/${film.name}`;
    return (
        <div className="tab2 tabs">
            <Link className="linkout" href={link}>{film.name}</Link>
        </div>
    );
}

export function SubGroupItem({ label, films, mode }: Props) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <>
            <div className="tab1 tabs" onClick={() => setCollapsed(c => !c)}>
                <a className={mode === "year" ? "linkout" : ""}>{label}</a>
                <div
                    className="collapse-trigger"
                >
                    {collapsed ? "+" : "-"}
                </div>
            </div>
            <motion.div
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