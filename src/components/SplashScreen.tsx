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

interface TileState {
  char: string;
  isWildfly: boolean;
  revealed: boolean;
  dimmed: boolean;
  faded: boolean;
  flipping: boolean;
}

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [show, setShow] = useState(true);
  const [showTagline, setShowTagline] = useState(false);
  const [showWilder, setShowWilder] = useState(false);

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

  const [tiles, setTiles] = useState<TileState[]>(
    () => Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
      dimmed: false,
      faded: false,
      flipping: false,
    }))
  );

  useEffect(() => {
    setTiles(Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
      dimmed: false,
      faded: false,
      flipping: false,
    })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TOTAL, cols, rows]);

  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Timeline:
    // 0ms        – background tiles flicker
    // 1400ms     – all 7 WILDFLY tiles start flipping together
    // 2200ms     – reveal letters one by one (staggered 180ms each, last ~3460ms)
    // 3700ms     – dim background tiles
    // 3900ms     – tagline "Plan Smarter. Travel" appears
    // 4300ms     – cursive "Wilder" writes in
    // 4100ms     – stop background flicker
    // 4800ms     – non-WILDFLY tiles fade out entirely
    // 7400ms     – screen fade out
    // 8100ms     – onComplete

    // Background flicker
    const flickerInterval = setInterval(() => {
      setTiles(prev => prev.map(tile =>
        tile.revealed || tile.flipping ? tile : { ...tile, char: randomChar() }
      ));
    }, 80);
    intervalsRef.current.push(flickerInterval);

    // Phase 1: All WILDFLY tiles start flipping simultaneously at 1400ms
    const startFlipping = setTimeout(() => {
      setTiles(prev => prev.map((tile, idx) =>
        WILDFLY_INDICES.includes(idx) ? { ...tile, flipping: true } : tile
      ));

      WILDFLY_INDICES.forEach((tileIdx) => {
        const flapInterval = setInterval(() => {
          setTiles(prev => prev.map((tile, idx) =>
            idx === tileIdx && !tile.revealed ? { ...tile, char: randomChar() } : tile
          ));
        }, 55);
        intervalsRef.current.push(flapInterval);
      });
    }, 1400);
    timeoutsRef.current.push(startFlipping);

    // Phase 2: Reveal each WILDFLY letter one by one starting at 2200ms
    WILDFLY.split("").forEach((letter, i) => {
      const tileIdx = WILDFLY_INDICES[i];
      const t = setTimeout(() => {
        let step = 0;
        const landInterval = setInterval(() => {
          step++;
          if (step >= 5) {
            clearInterval(landInterval);
            setTiles(prev => prev.map((tile, idx) =>
              idx === tileIdx ? { ...tile, char: letter, revealed: true, flipping: false } : tile
            ));
          } else {
            setTiles(prev => prev.map((tile, idx) =>
              idx === tileIdx ? { ...tile, char: randomChar() } : tile
            ));
          }
        }, 55);
        intervalsRef.current.push(landInterval);
      }, 2200 + i * 180);
      timeoutsRef.current.push(t);
    });

    // Dim all non-WILDFLY tiles at 3700ms
    const spotlightTimer = setTimeout(() => {
      setTiles(prev => prev.map(tile =>
        tile.revealed ? tile : { ...tile, dimmed: true }
      ));
    }, 3700);
    timeoutsRef.current.push(spotlightTimer);

    // Show static tagline
    const showTaglineTimer = setTimeout(() => setShowTagline(true), 3900);
    timeoutsRef.current.push(showTaglineTimer);

    // Animate in "Wilder" cursive word 400ms after static text
    const showWilderTimer = setTimeout(() => setShowWilder(true), 4300);
    timeoutsRef.current.push(showWilderTimer);

    const stopFlicker = setTimeout(() => clearInterval(flickerInterval), 4100);
    timeoutsRef.current.push(stopFlicker);

    // Phase 3: Fade out non-WILDFLY tiles entirely
    const fadeOutTiles = setTimeout(() => {
      setTiles(prev => prev.map(tile =>
        tile.revealed ? tile : { ...tile, faded: true }
      ));
    }, 4800);
    timeoutsRef.current.push(fadeOutTiles);

    // Final fade out
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
                : tile.faded
                  ? "transparent"
                  : tile.dimmed
                    ? "#c8cdd6"
                    : "#e8eaed",
              border: tile.revealed
                ? "1px solid #064E3B"
                : tile.faded
                  ? "1px solid transparent"
                  : tile.dimmed
                    ? "1px solid #b0b5c0"
                    : "1px solid #d1d5db",
              opacity: tile.faded ? 0 : 1,
              transition: tile.revealed
                ? "background 0.3s ease, border 0.3s ease"
                : tile.faded
                  ? "opacity 1.4s ease, background 1.4s ease, border 1.4s ease"
                  : tile.dimmed
                    ? "background 0.8s ease, border 0.8s ease"
                    : undefined,
              boxShadow: tile.revealed
                ? "0 2px 8px rgba(0,0,0,0.18)"
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
                color: tile.revealed ? "#fff" : tile.faded ? "transparent" : tile.dimmed ? "#b0b5bd" : "#9ca3af",
                letterSpacing: "0.04em",
                transition: tile.faded
                  ? "color 1.4s ease"
                  : tile.dimmed
                    ? "color 0.8s ease"
                    : undefined,
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
          transition: "opacity 0.8s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "clamp(11px, 3.2vw, 14px)",
              letterSpacing: "0.2em",
              color: "#1a2a2a",
              fontWeight: 700,
              textTransform: "uppercase",
              textShadow: "0 1px 8px rgba(255,255,255,0.95)",
            }}
          >
            Plan Smarter. Travel
          </span>
          <span
            style={{
              fontFamily: "'Dancing Script', cursive",
              fontSize: "clamp(30px, 8vw, 42px)",
              color: "#10B981",
              fontWeight: 900,
              letterSpacing: "0.01em",
              lineHeight: 1,
              display: "inline-block",
              textShadow: "0 2px 12px rgba(16,185,129,0.25)",
              clipPath: showWilder ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
              transition: showWilder ? "clip-path 1s cubic-bezier(0.4,0,0.2,1)" : "none",
            }}
          >
            Wilder
          </span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
