import { useEffect, useState, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const WILDFLY = "WILDFLY";

// Grid dimensions - fewer cols/rows for larger tiles
const COLS = 8;
const ROWS = 10;
const TOTAL = COLS * ROWS;

const CENTER_ROW = Math.floor(ROWS / 2);
const CENTER_COL_START = Math.floor((COLS - WILDFLY.length) / 2);
const WILDFLY_INDICES = WILDFLY.split("").map((_, i) => CENTER_ROW * COLS + CENTER_COL_START + i);

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [show, setShow] = useState(true);
  const [tiles, setTiles] = useState<{ char: string; isWildfly: boolean; revealed: boolean }[]>(
    () => Array(TOTAL).fill(null).map((_, i) => ({
      char: randomChar(),
      isWildfly: WILDFLY_INDICES.includes(i),
      revealed: false,
    }))
  );

  // Conveyor offsets per row (pixels, animated via JS)
  const [offsets, setOffsets] = useState<number[]>(() => Array(ROWS).fill(0));

  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const conveyorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Conveyor belt animation - each row scrolls in alternating directions
    const SPEED = 0.6; // px per frame
    conveyorRef.current = setInterval(() => {
      setOffsets(prev => prev.map((offset, rowIdx) => {
        const dir = rowIdx % 2 === 0 ? 1 : -1;
        return offset + SPEED * dir;
      }));
    }, 16);

    // Phase 1: All tiles randomly flicker
    const flickerInterval = setInterval(() => {
      setTiles(prev => prev.map(tile =>
        tile.revealed ? tile : { ...tile, char: randomChar() }
      ));
    }, 80);
    intervalsRef.current.push(flickerInterval);

    // Phase 2: Reveal WILDFLY letters one by one after 1.8s
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
      }, 1800 + i * 280);
      timeoutsRef.current.push(t);
    });

    // Stop flicker after WILDFLY is revealed
    const stopFlicker = setTimeout(() => {
      clearInterval(flickerInterval);
      if (conveyorRef.current) clearInterval(conveyorRef.current);
    }, 3900);
    timeoutsRef.current.push(stopFlicker);

    const fadeOut = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 600);
    }, 4600);
    timeoutsRef.current.push(fadeOut);

    return () => {
      intervalsRef.current.forEach(clearInterval);
      timeoutsRef.current.forEach(clearTimeout);
      if (conveyorRef.current) clearInterval(conveyorRef.current);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#e8eaed] overflow-hidden`}
      style={{ opacity: show ? 1 : 0, transition: "opacity 0.6s ease" }}
    >
      <div className="w-full h-full flex flex-col" style={{ gap: "4px", padding: "4px" }}>
        {Array.from({ length: ROWS }).map((_, rowIdx) => {
          const offset = offsets[rowIdx];
          const goingRight = rowIdx % 2 === 0;
          // Render extra tiles on each side so conveyor looks infinite
          const EXTRA = 3;
          const totalTiles = COLS + EXTRA * 2;

          return (
            <div
              key={rowIdx}
              className="flex-1 relative overflow-hidden"
            >
              <div
                className="absolute inset-y-0 flex"
                style={{
                  gap: "4px",
                  // Shift the row by offset, and wrap using modulo feel
                  transform: `translateX(${(offset % (100 / COLS)) - (100 / COLS)}%)`,
                  width: `${(totalTiles / COLS) * 100}%`,
                  left: `-${(EXTRA / COLS) * 100}%`,
                }}
              >
                {Array.from({ length: totalTiles }).map((_, colOffset) => {
                  // Map visual column back to data tile
                  const col = ((colOffset - EXTRA) % COLS + COLS) % COLS;
                  const tileIdx = rowIdx * COLS + col;
                  const tile = tiles[tileIdx];
                  if (!tile) return null;

                  return (
                    <div
                      key={colOffset}
                      className="relative flex flex-col items-center justify-center rounded overflow-hidden"
                      style={{
                        flex: `0 0 calc(${100 / totalTiles}%)`,
                        background: tile.revealed
                          ? "linear-gradient(135deg,#10B981 0%,#059669 50%,#065F46 100%)"
                          : "#d1d5db",
                        border: tile.revealed ? "1.5px solid #064E3B" : "1.5px solid #b0b5bd",
                        transition: tile.revealed ? "background 0.3s ease" : undefined,
                      }}
                    >
                      {/* Center divider */}
                      <div
                        className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
                        style={{ background: tile.revealed ? "#064E3Baa" : "#9ca3afaa" }}
                      />
                      {/* Left peg */}
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full z-20"
                        style={{
                          background: tile.revealed ? "#10B981" : "#d1d5db",
                          border: tile.revealed ? "1.5px solid #064E3B" : "1.5px solid #b0b5bd",
                        }}
                      />
                      {/* Right peg */}
                      <div
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full z-20"
                        style={{
                          background: tile.revealed ? "#10B981" : "#d1d5db",
                          border: tile.revealed ? "1.5px solid #064E3B" : "1.5px solid #b0b5bd",
                        }}
                      />
                      <span
                        className="font-black leading-none select-none z-10"
                        style={{
                          fontSize: "clamp(18px, 4vw, 36px)",
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SplashScreen;
