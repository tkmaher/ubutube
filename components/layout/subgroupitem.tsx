"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { SearchResult } from "@/types/search";

interface Props {
    label: string;
    films: SearchResult[];
}

function FilmItem({ film }: {film: SearchResult}) {
    return (
        <div className="tab2 tabs">
            <div>{film.name}</div>
        </div>
    );
}

export function SubGroupItem({ label, films }: Props) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <>
            <div className="tab1 tabs">
                
                <button
                    className="collapse-trigger"
                    onClick={() => setCollapsed(c => !c)}
                >
                    {collapsed ? "+" : "-"}
                </button>
                <div>{label}</div>
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