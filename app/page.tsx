"use client";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="main-home">
      <Image 
        src="/square.jpg" 
        height={600} 
        width={600} 
        alt="UbuTube"
        priority={true}
        onLoad={() => setLoaded(true)}
        style={{opacity: loaded ? 1 : 0}}
      />
    </div>
  );
}
