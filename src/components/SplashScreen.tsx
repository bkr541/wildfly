import { useEffect, useState, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const WILDFLY = "WILDFLY";

// Tile size to match SplitFlapHeader
const TILE_SIZE = 44;
const GAP = 3;

// WILDFLY_COL_START is computed dynamically per grid width (see below)

// Viewport-filling grid: compute cols/rows to cover full screen + 2 extra on each side
function calcGrid(viewW: number, viewH: number) {
  const cellSize = TILE_SIZE + GAP;
  // Enough cols to fill screen plus 2 extra columns off-screen on each side
  const visibleCols = Math.ceil(viewW / cellSize) + 4;
  // Make sure we have at least WILDFLY_COL_START + 7 columns
  const cols = Math.max(visibleCols, WILDFLY_COL_START + WILDFLY.length + PAD_COLS + 2);
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
  const [dims, setDims] = useState(() => calcGrid(window.innerWidth, window.innerHeight));

  // Recompute grid on resize
  useEffect(() => {
    const onResize = () => setDims(calcGrid(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { cols, rows } = dims;
  const TOTAL = cols * rows;
  const CENTER_ROW = Math.floor(rows / 2);
  const WILDFLY_INDICES = WILDFLY.split("").map((_, i) => CENTER_ROW * cols + WILDFLY_COL_START + i);

  const [tiles, setTiles] = useState<{ char: string; isWildfly: boolean; revealed: boolean }[]>(
    () => Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: false,
      revealed: false,
    }))
  );

  // Reinitialise tiles when dims change (resize)
  useEffect(() => {
    setTiles(Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
    })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TOTAL, cols, rows]);

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
      }, 1200 + i * 140);
      timeoutsRef.current.push(t);
    });

    // Phase 3: Show tagline, stop flicker, fade out
    const showTaglineTimer = setTimeout(() => setShowTagline(true), 2600);
    timeoutsRef.current.push(showTaglineTimer);

    const stopFlicker = setTimeout(() => clearInterval(flickerInterval), 2600);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete, cols, rows]);

  const cellSize = TILE_SIZE + GAP;
  // Offset so the grid is centred on the viewport
  const gridPxW = cols * cellSize - GAP;
  const gridPxH = rows * cellSize - GAP;
  const offsetX = (window.innerWidth - gridPxW) / 2;
  const offsetY = (window.innerHeight - gridPxH) / 2;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden ${show ? "opacity-100" : "opacity-0"}`}
      style={{ background: "#e8eaed", transition: "opacity 0.6s ease" }}
    >
      {/* Full-screen tile grid, centred */}
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

      {/* Tagline — centred over the grid, just below WILDFLY row */}
      <div
        className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
        style={{
          top: offsetY + (CENTER_ROW + 1) * cellSize + 4,
          opacity: showTagline ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      >
        <p
          style={{
            fontSize: "clamp(11px, 2.8vw, 13px)",
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
