"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { SearchResult, SearchTreeArtist, SearchTreeYear } from "@/types/search";
import { SubGroupItem } from "@/components/layout/subgroupitem";
import Link from "next/link";

type ArtistModeProps = {
    mode: "artist";
    name: string;
    yearGroups: SearchTreeYear[];
};

type YearModeProps = {
    mode: "year";
    year: string;
    artistGroups: SearchTreeArtist[];
};

type Props = ArtistModeProps | YearModeProps;

export function GroupItem(props: Props) {
    const [collapsed, setCollapsed] = useState(true);

    const label = props.mode === "artist" ? props.name : props.year;

    const subItems =
        props.mode === "artist"
            ? props.yearGroups.map((yg, j) => (
                  <SubGroupItem
                      key={j}
                      label={yg.year}
                      films={yg.children as SearchResult[]}
                      mode={props.mode}
                  />
              ))
            : props.artistGroups.map((ag, j) => (
                  <SubGroupItem
                      key={j}
                      label={ag.name}
                      films={ag.children as SearchResult[]}
                      mode={props.mode}
                  />
              ));

    return (
        <div className="tabcontainer">
            <div className="tab0 tabs" onClick={() => setCollapsed(c => !c)}>
                {props.mode == "artist" ?
                    <Link 
                        className="linkout" href={`/artist/${label}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {label}
                    </Link>
                    :
                    <a>{label}</a>
                }
                <div
                    className="collapse-trigger"
                >
                    {collapsed ? "+" : "-"}
                </div>
            </div>
            <motion.div
                animate={{ height: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                initial={false}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
            >
                {subItems}
            </motion.div>
        </div>
    );
}