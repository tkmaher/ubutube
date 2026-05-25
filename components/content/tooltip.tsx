"use client";

import { useEffect, useState } from "react";

export default function Tooltip({
    text,
}: Readonly<{
    text: string;
}>) {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    const style = {top: mousePos.y + 10, left: mousePos.x + 10};
    return (
        <div className="tooltip" style={style}>
            {text}
        </div>
    );
}