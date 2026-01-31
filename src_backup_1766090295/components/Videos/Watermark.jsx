\/\/ src/components/Videos/Watermark.jsx
import React, { useEffect, useState } from "react";

/**
 * Watermark: subtle low-opacity watermark that moves slowly.
 * Props:
 *  - text: string to display (username or app brand)
 *  - opacity: number 0..1
 */
export default function Watermark({ text = "Arvdoul", opacity = 0.06 }) {
  const [x, setX] = useState(10);
  const [y, setY] = useState(70);
  useEffect(() => {
    \/\/ gentle motion
    const iv = setInterval(() => {
      setX((p) => (p + (Math.random() - 0.5) * 4));
      setY((p) => (p + (Math.random() - 0.5) * 4));
    }, 3500);
    return () => clearInterval(iv);
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute z-[3] inset-0 flex items-start justify-start">
      <div style={{ transform: `translate(${x}px, ${y}px) rotate(-16deg)` }} className="select-none whitespace-nowrap text-xs font-bold tracking-widest" >
        <span style={{ opacity, filter: "blur(0.2px)", color: "white", textShadow: "0 0 6px rgba(0,0,0,0.35)" }}>{text}</span>
      </div>
    </div>
  );
}