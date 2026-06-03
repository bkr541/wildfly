import { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function SplitFlapWord({ word, green, delay = 0 }: { word: string; green?: boolean; delay?: number }) {
  const [display, setDisplay] = useState<string[]>(Array(word.length).fill(" "));
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const allTimeouts: ReturnType<typeof setTimeout>[] = [];
    const allIntervals: ReturnType<typeof setInterval>[] = [];

    const runCycle = (cycleDelay: number) => {
      word.split("").forEach((finalChar, idx) => {
        const to = setTimeout(
          () => {
            if (!activeRef.current) return;
            let step = 0;
            const steps = 6;
            const iv = setInterval(() => {
              if (!activeRef.current) {
                clearInterval(iv);
                return;
              }
              step++;
              if (step >= steps) {
                clearInterval(iv);
                setDisplay((prev) => {
                  const n = [...prev];
                  n[idx] = finalChar;
                  return n;
                });
              } else {
                const r = CHARS[Math.floor(Math.random() * CHARS.length)];
                setDisplay((prev) => {
                  const n = [...prev];
                  n[idx] = r;
                  return n;
                });
              }
            }, 40);
            allIntervals.push(iv);
          },
          cycleDelay + delay + idx * 55,
        );
        allTimeouts.push(to);
      });
    };

    const cycleLength = word.length * 55 + 600;
    let cycle = 0;
    const schedule = () => {
      if (!activeRef.current) return;
      runCycle(cycle * cycleLength);
      const loopTo = setTimeout(schedule, cycleLength);
      allTimeouts.push(loopTo);
      cycle++;
    };
    schedule();

    return () => {
      activeRef.current = false;
      allTimeouts.forEach(clearTimeout);
      allIntervals.forEach(clearInterval);
    };
  }, [word, delay]);

  return (
    <div className="flex gap-1">
      {display.map((char, i) => (
        <div
          key={i}
          className="relative flex flex-col items-center justify-center rounded-lg shadow-md border overflow-hidden"
          style={{
            width: 28,
            height: 36,
            background: green ? "linear-gradient(160deg,#6ee7b7 0%,#10B981 100%)" : "#e8eaed",
            borderColor: green ? "#059669" : "#d1d5db",
          }}
        >
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-px h-px z-10"
            style={{ background: green ? "#059669aa" : "#b0b5bdaa" }}
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border z-20"
            style={{ background: green ? "#d1fae5" : "#e8eaed", borderColor: green ? "#059669" : "#d1d5db" }}
          />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full border z-20"
            style={{ background: green ? "#d1fae5" : "#e8eaed", borderColor: green ? "#059669" : "#d1d5db" }}
          />
          <span
            className="font-black text-base leading-none select-none"
            style={{ color: green ? "#fff" : "#1f2937", letterSpacing: "0.04em" }}
          >
            {char === " " ? "" : char}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SplitFlapOverlay({
  topWord,
  bottomWord,
  subtitle = "This may take a moment…",
}: {
  topWord: string;
  bottomWord: string;
  subtitle?: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F2F3F3] gap-5">
      <SplitFlapWord word={topWord} delay={0} />
      <SplitFlapWord word={bottomWord} green delay={100} />
      <p className="text-sm text-[#6B7B7B] mt-2">{subtitle}</p>
    </div>
  );
}
