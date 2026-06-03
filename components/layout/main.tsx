"use client";
import { useCallback, useState } from "react";
import Search from "./search";
import Tools from "./tools";

const COLLAPSED = "1em";
const EXPANDED = "calc(100% - 2em)"; // full width minus both collapsed siblings

export default function Columns({ children }: { children: React.ReactNode }) {
    const [expanded, setExpanded] = useState<"left" | "right" | "main">("left");

    const expand = useCallback((side: "left" | "right" | "main") => {
        setExpanded(side);
    }, []);

    const width = (side: "left" | "right" | "main") =>
        expanded === side ? EXPANDED : COLLAPSED;

    return (
        <div className="appcontainer">
            <div
                className={`left-bar column-panel${expanded === "left" ? " panel-active" : ""}`}
                style={{ flexBasis: width("left") }}
                onClick={() => expand("left")}
            >
                <Tools />
            </div>

            <div
                className={`main column-panel${expanded === "main" ? " panel-active" : ""}`}
                style={{ flexBasis: width("main") }}
                onClick={expanded !== "main" ? () => expand("main") : undefined}
            >
                {children}
            </div>

            <div
                className={`right-bar column-panel${expanded === "right" ? " panel-active" : ""}`}
                style={{ flexBasis: width("right") }}
                onClick={() => expand("right")}
            >
                <Search />
            </div>
        </div>
    );
}