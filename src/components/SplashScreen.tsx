import { useEffect, useState, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const WILDFLY = "WILDFLY";

const TILE_SIZE = 44;
const GAP = 3;

function calcGrid(viewW: number, viewH: number) {
  const cellSize = TILE_SIZE + GAP;
  const visibleCols = Math.ceil(viewW / cellSize) + 4;
  const cols = Math.max(visibleCols, WILDFLY.length + 4);
  const rows = Math.ceil(viewH / cellSize) + 4;
  return { cols, rows };
}

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [show, setShow] = useState(true);
  const [showTagline, setShowTagline] = useState(false);
  const [spotlightActive, setSpotlightActive] = useState(false);
  const [dims, setDims] = useState(() => calcGrid(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const onResize = () => setDims(calcGrid(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { cols, rows } = dims;
  const TOTAL = cols * rows;
  const CENTER_ROW = Math.floor(rows / 2);
  const wildflyColStart = Math.floor((cols - WILDFLY.length) / 2);
  const WILDFLY_INDICES = WILDFLY.split("").map((_, i) => CENTER_ROW * cols + wildflyColStart + i);

  const [tiles, setTiles] = useState<{ char: string; isWildfly: boolean; revealed: boolean; dimmed: boolean }[]>(
    () => Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
      dimmed: false,
    }))
  );

  useEffect(() => {
    setTiles(Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
      dimmed: false,
    })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TOTAL, cols, rows]);

  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Total animation: 8 seconds
    // WILDFLY reveal: 2000ms + i*200ms (last letter at ~3200ms)
    // Spotlight: 3500ms
    // Tagline: 3700ms
    // Stop flicker: 3900ms
    // Fade out: 7400ms → complete at 8000ms

    const flickerInterval = setInterval(() => {
      setTiles(prev => prev.map(tile =>
        tile.revealed ? tile : { ...tile, char: randomChar() }
      ));
    }, 80);
    intervalsRef.current.push(flickerInterval);

    WILDFLY.split("").forEach((letter, i) => {
      const tileIdx = WILDFLY_INDICES[i];
      const t = setTimeout(() => {
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
      }, 2000 + i * 200);
      timeoutsRef.current.push(t);
    });

    // Spotlight: dim all non-WILDFLY tiles after reveal
    const spotlightTimer = setTimeout(() => {
      setSpotlightActive(true);
      setTiles(prev => prev.map(tile =>
        tile.revealed ? tile : { ...tile, dimmed: true }
      ));
    }, 3500);
    timeoutsRef.current.push(spotlightTimer);

    const showTaglineTimer = setTimeout(() => setShowTagline(true), 3700);
    timeoutsRef.current.push(showTaglineTimer);

    const stopFlicker = setTimeout(() => clearInterval(flickerInterval), 3900);
    timeoutsRef.current.push(stopFlicker);

    const fadeOut = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 700);
    }, 7400);
    timeoutsRef.current.push(fadeOut);

    return () => {
      intervalsRef.current.forEach(clearInterval);
      timeoutsRef.current.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete, cols, rows]);

  const cellSize = TILE_SIZE + GAP;
  const gridPxW = cols * cellSize - GAP;
  const gridPxH = rows * cellSize - GAP;
  const offsetX = (window.innerWidth - gridPxW) / 2;
  const offsetY = (window.innerHeight - gridPxH) / 2;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden ${show ? "opacity-100" : "opacity-0"}`}
      style={{ background: "#e8eaed", transition: "opacity 0.7s ease" }}
    >
      {/* Spotlight radial overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: `radial-gradient(ellipse 340px 120px at 50% 50%, transparent 0%, rgba(0,0,0,0.38) 100%)`,
          opacity: spotlightActive ? 1 : 0,
          transition: "opacity 0.9s ease",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: offsetY,
          left: offsetX,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`,
          gridTemplateRows: `repeat(${rows}, ${TILE_SIZE}px)`,
          gap: `${GAP}px`,
        }}
      >
        {tiles.map((tile, i) => (
          <div
            key={i}
            className="relative flex flex-col items-center justify-center rounded-lg overflow-hidden shadow-md"
            style={{
              background: tile.revealed
                ? "linear-gradient(135deg,#10B981 0%,#059669 50%,#065F46 100%)"
                : tile.dimmed
                  ? "#c8cdd6"
                  : "#e8eaed",
              border: tile.revealed
                ? "1px solid #064E3B"
                : tile.dimmed
                  ? "1px solid #b0b5c0"
                  : "1px solid #d1d5db",
              transition: tile.revealed
                ? "background 0.3s ease, border 0.3s ease"
                : tile.dimmed
                  ? "background 0.8s ease, border 0.8s ease"
                  : undefined,
              boxShadow: tile.revealed && spotlightActive
                ? "0 0 18px 4px rgba(16,185,129,0.45), 0 2px 8px rgba(0,0,0,0.18)"
                : undefined,
            }}
          >
            <div
              className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
              style={{ background: tile.revealed ? "#064E3Baa" : "#b0b5bdaa" }}
            />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
              style={{
                background: tile.revealed ? "#10B981" : "#e8eaed",
                borderColor: tile.revealed ? "#064E3B" : "#d1d5db",
              }}
            />
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
                color: tile.revealed ? "#fff" : tile.dimmed ? "#b0b5bd" : "#9ca3af",
                letterSpacing: "0.04em",
                transition: tile.dimmed ? "color 0.8s ease" : undefined,
              }}
            >
              {tile.char}
            </span>
          </div>
        ))}
      </div>

      {/* Tagline centred below WILDFLY row */}
      <div
        className="absolute inset-x-0 flex flex-col items-center justify-center pointer-events-none z-20"
        style={{
          top: offsetY + (CENTER_ROW + 1) * cellSize + 10,
          opacity: showTagline ? 1 : 0,
          transition: "opacity 1s ease",
        }}
      >
        <p
          style={{
            fontSize: "clamp(15px, 4.5vw, 20px)",
            letterSpacing: "0.22em",
            color: "#1a2a2a",
            fontWeight: 700,
            textTransform: "uppercase",
            textShadow: "0 1px 12px rgba(255,255,255,0.9), 0 0px 4px rgba(255,255,255,0.7)",
            background: "rgba(232,234,237,0.72)",
            padding: "6px 18px",
            borderRadius: "8px",
            backdropFilter: "blur(2px)",
          }}
        >
          Plan Smarter. Fly Wilder.
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
