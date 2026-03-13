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
  const [dims, setDims] = useState(() => calcGrid(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const onResize = () => setDims(calcGrid(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { cols, rows } = dims;
  const TOTAL = cols * rows;
  const CENTER_ROW = Math.floor(rows / 2);
  // Center WILDFLY horizontally in the grid
  const wildflyColStart = Math.floor((cols - WILDFLY.length) / 2);
  const WILDFLY_INDICES = WILDFLY.split("").map((_, i) => CENTER_ROW * cols + wildflyColStart + i);

  const [tiles, setTiles] = useState<{ char: string; isWildfly: boolean; revealed: boolean }[]>(
    () => Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
    }))
  );

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
      }, 1200 + i * 140);
      timeoutsRef.current.push(t);
    });

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
  const gridPxW = cols * cellSize - GAP;
  const gridPxH = rows * cellSize - GAP;
  const offsetX = (window.innerWidth - gridPxW) / 2;
  const offsetY = (window.innerHeight - gridPxH) / 2;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden ${show ? "opacity-100" : "opacity-0"}`}
      style={{ background: "#e8eaed", transition: "opacity 0.6s ease" }}
    >
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
                color: tile.revealed ? "#fff" : "#9ca3af",
                letterSpacing: "0.04em",
              }}
            >
              {tile.char}
            </span>
          </div>
        ))}
      </div>

      {/* Tagline centred below WILDFLY row */}
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
