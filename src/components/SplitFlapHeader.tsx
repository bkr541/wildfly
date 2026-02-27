import { useState, useEffect, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

function SplitFlapTile({ char, green, blank }: { char: string; green?: boolean; blank?: boolean }) {
  const displayChar = char === "_" || char === " " ? "" : char;
  if (blank) {
    return (
      <div
        className="relative flex flex-col items-center justify-center rounded-lg border overflow-hidden flex-1 min-w-0"
        style={{ height: 34, background: "#e8eaed", borderColor: "#d1d5db", opacity: 0.3 }}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px" style={{ background: "#b0b5bdaa" }} />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border" style={{ background: "#e8eaed", borderColor: "#d1d5db" }} />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border" style={{ background: "#e8eaed", borderColor: "#d1d5db" }} />
      </div>
    );
  }
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-lg shadow-md border overflow-hidden flex-1 min-w-0"
      style={{
        height: 34,
        background: green ? "linear-gradient(160deg,#059669 0%,#065F46 100%)" : "#e8eaed",
        borderColor: green ? "#064E3B" : "#d1d5db",
      }}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
        style={{ background: green ? "#064E3Baa" : "#b0b5bdaa" }} />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: green ? "#10B981" : "#e8eaed", borderColor: green ? "#064E3B" : "#d1d5db" }} />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
        style={{ background: green ? "#10B981" : "#e8eaed", borderColor: green ? "#064E3B" : "#d1d5db" }} />
      {displayChar && (
        <span className="font-black text-lg leading-none select-none"
          style={{ color: green ? "#fff" : "#1f2937", letterSpacing: "0.04em" }}>
          {displayChar}
        </span>
      )}
    </div>
  );
}

/**
 * Renders a split-flap departure board style heading.
 * `word` should be the label (e.g. "FLIGHTS"). It is padded to 9 tiles total —
 * the word characters are green, the trailing blanks are faded.
 */
export function SplitFlapHeader({ word, gap = "gap-0.5" }: { word: string; gap?: string }) {
  const TILES = 9;
  const upper = word.toUpperCase().slice(0, TILES);
  const padded = upper.padEnd(TILES, "_");
  const [displayChars, setDisplayChars] = useState<string[]>(Array(TILES).fill(" "));
  const ran = useRef(false);

  useEffect(() => {
    ran.current = false;
  }, [word]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];
    padded.split("").forEach((finalChar, idx) => {
      const to = setTimeout(() => {
        const steps = 5;
        let step = 0;
        const iv = setInterval(() => {
          step++;
          if (step >= steps) {
            clearInterval(iv);
            setDisplayChars(prev => { const n = [...prev]; n[idx] = finalChar; return n; });
          } else {
            const r = CHARS[Math.floor(Math.random() * CHARS.length)];
            setDisplayChars(prev => { const n = [...prev]; n[idx] = r; return n; });
          }
        }, 40);
        intervals.push(iv);
      }, idx * 55);
      timeouts.push(to);
    });
    return () => { timeouts.forEach(clearTimeout); intervals.forEach(clearInterval); };
  }, [padded]);

  return (
    <div className={`flex items-center ${gap} w-full`}>
      {displayChars.map((char, i) => {
        const isBlank = padded[i] === "_";
        return (
          <SplitFlapTile
            key={i}
            char={char}
            green={!isBlank}
            blank={isBlank}
          />
        );
      })}
    </div>
  );
}
