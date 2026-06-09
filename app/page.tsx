"use client";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="main-home">
      <Image 
        src="https://upload.wikimedia.org/wikipedia/commons/d/dc/Kazimir_Malevich%2C_1915%2C_Black_Suprematic_Square%2C_oil_on_linen_canvas%2C_79.5_x_79.5_cm%2C_Tretyakov_Gallery%2C_Moscow.jpg" 
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
