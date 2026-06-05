"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Search from "./search";
import Tools from "./tools";

const COLLAPSED = "2em";
const EXPANDED = "calc(100% - 4em)";

export default function Columns({ children }: { children: React.ReactNode }) {
    const [expanded, setExpanded] = useState<"left" | "right" | "main">("main");

    const expand = useCallback((side: "left" | "right" | "main") => {
        setExpanded(side);
    }, []);

    const pathname = usePathname();

    useEffect(() => {
        setExpanded("main");
    }, [pathname]);

    const width = (side: "left" | "right" | "main") =>
        expanded === side ? EXPANDED : COLLAPSED;

    const panelProps = (side: "left" | "right" | "main") => {
        const isExpanded = expanded === side;

        return {
            style: {
                flexBasis: width(side),
            },
            onClick: (e: React.MouseEvent<HTMLDivElement>) => {
                if (isExpanded) return;

                const target = e.target as HTMLElement;

                // Ignore clicks coming from interactive elements
                if (
                    target.closest(
                        'a, button, input, textarea, select, label, [role="button"]'
                    )
                ) {
                    return;
                }

                expand(side);
            },
        };
    };

    return (
        <div className="appcontainer">
            <div
                className={`left-bar column-panel${expanded === "left" ? " panel-active" : ""}`}
                {...panelProps("left")}
            >
                <Tools />
            </div>

            <div
                className={`main column-panel${expanded === "main" ? " panel-active" : ""}`}
                {...panelProps("main")}
            >
                {children}
            </div>

            <div
                className={`right-bar column-panel${expanded === "right" ? " panel-active" : ""}`}
                {...panelProps("right")}
            >
                <Search />
            </div>
        </div>
    );
}