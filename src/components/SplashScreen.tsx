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
  // Each tile: { char, isWildfly, revealed }
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
    // Phase 1: All tiles randomly flicker for ~1.5s
    const flickerInterval = setInterval(() => {
      setTiles(prev => prev.map(tile =>
        tile.revealed ? tile : { ...tile, char: randomChar() }
      ));
    }, 80);
    intervalsRef.current.push(flickerInterval);

    // Phase 2: After 1.8s, start revealing WILDFLY letters one by one
    WILDFLY.split("").forEach((letter, i) => {
      const t = setTimeout(() => {
        const tileIdx = WILDFLY_INDICES[i];
        // Quick flap animation before settling
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

    // Phase 3: After WILDFLY is fully revealed (~1.8 + 7*280 = ~3.76s), hold then fade out
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
      className={`fixed inset-0 z-50 bg-[#e8eaed] transition-opacity duration-600 ${show ? "opacity-100" : "opacity-0"}`}
      style={{ transition: "opacity 0.6s ease" }}
    >
      {/* Full-screen split-flap grid */}
      <div
        className="w-full h-full grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: "3px",
          padding: "3px",
        }}
      >
        {tiles.map((tile, i) => {
          const isWildflyTile = WILDFLY_INDICES.includes(i);
          const wildflyIdx = WILDFLY_INDICES.indexOf(i);
          const letter = wildflyIdx >= 0 ? WILDFLY[wildflyIdx] : null;

          return (
            <div
              key={i}
              className="relative flex flex-col items-center justify-center rounded overflow-hidden"
              style={{
                background: tile.revealed
                  ? "linear-gradient(135deg,#10B981 0%,#059669 50%,#065F46 100%)"
                  : "#d1d5db",
                border: tile.revealed ? "1px solid #064E3B" : "1px solid #b0b5bd",
                transition: tile.revealed ? "background 0.3s ease, border 0.3s ease" : undefined,
              }}
            >
              {/* Center divider line */}
              <div
                className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
                style={{ background: tile.revealed ? "#064E3Baa" : "#9ca3afaa" }}
              />
              {/* Left peg */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full z-20"
                style={{
                  background: tile.revealed ? "#10B981" : "#d1d5db",
                  border: tile.revealed ? "1px solid #064E3B" : "1px solid #b0b5bd",
                }}
              />
              {/* Right peg */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full z-20"
                style={{
                  background: tile.revealed ? "#10B981" : "#d1d5db",
                  border: tile.revealed ? "1px solid #064E3B" : "1px solid #b0b5bd",
                }}
              />
              <span
                className="font-black leading-none select-none z-10"
                style={{
                  fontSize: "clamp(10px, 2.5vw, 18px)",
                  color: tile.revealed ? "#fff" : "#6b7280",
                  letterSpacing: "0.04em",
                }}
              >
                {tile.char}
              </span>
            </div>
          );
        })}
      </div>
      {/* Tagline fade-in */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ paddingTop: `calc(${(CENTER_ROW + 2) / ROWS * 100}% + 8px)` }}
      >
        <p
          style={{
            opacity: showTagline ? 1 : 0,
            transition: "opacity 0.8s ease",
            fontSize: "clamp(11px, 2.8vw, 15px)",
            letterSpacing: "0.12em",
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
