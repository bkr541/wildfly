import { useEffect, useState, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const WILDFLY = "WILDFLY";

// Grid dimensions
const COLS = 7;
const ROWS = 10;
const TOTAL = COLS * ROWS;

// Find the center row/col to place WILDFLY (7 chars)
const CENTER_ROW = Math.floor(ROWS / 2);
const CENTER_COL_START = Math.floor((COLS - WILDFLY.length) / 2);
// Indices of the WILDFLY tiles
const WILDFLY_INDICES = WILDFLY.split("").map((_, i) => CENTER_ROW * COLS + CENTER_COL_START + i);

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [show, setShow] = useState(true);
  const [showTagline, setShowTagline] = useState(false);
  const [tiles, setTiles] = useState<{ char: string; isWildfly: boolean; revealed: boolean }[]>(
    () => Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
    }))
  );

  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Phase 1: All tiles randomly flicker
    const flickerInterval = setInterval(() => {
      setTiles(prev => prev.map(tile =>
        tile.revealed ? tile : { ...tile, char: randomChar() }
      ));
    }, 80);
    intervalsRef.current.push(flickerInterval);

    // Phase 2: Reveal WILDFLY letters one by one
    WILDFLY.split("").forEach((letter, i) => {
      const t = setTimeout(() => {
        const tileIdx = WILDFLY_INDICES[i];
        let step = 0;
        const flapInterval = setInterval(() => {
          step++;
          if (step >= 6) {
            clearInterval(flapInterval);
            setTiles(prev => prev.map((tile, idx) =>
              idx === tileIdx ? { ...tile, char: letter, revealed: true } : tile
            ));
          } else {
            setTiles(prev => prev.map((tile, idx) =>
              idx === tileIdx ? { ...tile, char: randomChar() } : tile
            ));
          }
        }, 55);
        intervalsRef.current.push(flapInterval);
      }, 1200 + i * 140);
      timeoutsRef.current.push(t);
    });

    // Phase 3: Show tagline, stop flicker, fade out
    const showTaglineTimer = setTimeout(() => {
      setShowTagline(true);
    }, 2600);
    timeoutsRef.current.push(showTaglineTimer);

    const stopFlicker = setTimeout(() => {
      clearInterval(flickerInterval);
    }, 2600);
    timeoutsRef.current.push(stopFlicker);

    const fadeOut = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 600);
    }, 3400);
    timeoutsRef.current.push(fadeOut);

    return () => {
      intervalsRef.current.forEach(clearInterval);
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#e8eaed] flex flex-col ${show ? "opacity-100" : "opacity-0"}`}
      style={{ transition: "opacity 0.6s ease" }}
    >
      {/* Full-screen split-flap grid — fills all space */}
      <div
        className="flex-1 grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: "3px",
          padding: "3px",
        }}
      >
        {tiles.map((tile, i) => (
          <div
            key={i}
            className="relative flex flex-col items-center justify-center rounded-lg overflow-hidden shadow-md"
            style={{
              background: tile.revealed
                ? "linear-gradient(135deg,#10B981 0%,#059669 50%,#065F46 100%)"
                : "#e8eaed",
              border: tile.revealed ? "1px solid #064E3B" : "1px solid #d1d5db",
              transition: tile.revealed ? "background 0.3s ease, border 0.3s ease" : undefined,
            }}
          >
            {/* Center divider line */}
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
              style={{ background: tile.revealed ? "#064E3Baa" : "#b0b5bdaa" }}
            />
            {/* Left peg */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
              style={{
                background: tile.revealed ? "#10B981" : "#e8eaed",
                borderColor: tile.revealed ? "#064E3B" : "#d1d5db",
              }}
            />
            {/* Right peg */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
              style={{
                background: tile.revealed ? "#10B981" : "#e8eaed",
                borderColor: tile.revealed ? "#064E3B" : "#d1d5db",
              }}
            />
            <span
              className="font-black text-lg leading-none select-none z-10"
              style={{
                color: tile.revealed ? "#fff" : "#9ca3af",
                letterSpacing: "0.04em",
              }}
            >
              {tile.char}
            </span>
          </div>
        ))}
      </div>

      {/* Tagline — sits below the grid, fades in after WILDFLY is revealed */}
      <div
        className="flex items-center justify-center py-6"
        style={{
          opacity: showTagline ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      >
        <p
          style={{
            fontSize: "clamp(11px, 2.8vw, 14px)",
            letterSpacing: "0.14em",
            color: "#6b7280",
            fontWeight: 500,
          }}
        >
          Plan Smarter. Fly Wilder.
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
