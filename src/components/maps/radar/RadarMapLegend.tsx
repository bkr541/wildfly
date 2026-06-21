import { COLOR_GREEN, COLOR_AMBER, COLOR_ROSE, COLOR_GRAY } from "./radarMapStyles";

const LEGEND_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 10,
};

const ITEMS: { color: string; label: string }[] = [
  { color: COLOR_GREEN, label: "50%+" },
  { color: COLOR_AMBER, label: "25–49%" },
  { color: COLOR_ROSE, label: "<25%" },
  { color: COLOR_GRAY, label: "No data" },
];

/**
 * Compact GoWild availability legend, placed bottom-left by default.
 * `position` lets callers move it (e.g. bottom-right) so it doesn't block controls.
 */
export default function RadarMapLegend({
  position = "bottom-left",
}: {
  position?: "bottom-left" | "bottom-right";
}) {
  const posClass = position === "bottom-right" ? "bottom-3 right-3" : "bottom-3 left-3";
  return (
    <div className={`absolute ${posClass} z-[1000]`} style={LEGEND_STYLE}>
      <div className="font-bold uppercase tracking-wider text-[#9CA3AF] mb-1" style={{ fontSize: 9 }}>
        GoWild Availability
      </div>
      <div className="flex flex-col gap-0.5">
        {ITEMS.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="rounded-full" style={{ width: 8, height: 8, background: color }} />
            <span className="font-semibold text-[#6B7B7B]">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 mt-0.5">
          <svg width="16" height="4">
            <line x1="0" y1="2" x2="16" y2="2" stroke={COLOR_GRAY} strokeWidth="2" strokeDasharray="3 3" />
          </svg>
          <span className="font-semibold text-[#9CA3AF]">Dashed = stale</span>
        </div>
      </div>
    </div>
  );
}
