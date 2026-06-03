interface FlightRouteMiniPreviewProps {
  isAllDestinations: boolean;
  isGoWild: boolean;
  bestDestination?: string | null;
}

export function FlightRouteMiniPreview({ isAllDestinations, isGoWild, bestDestination }: FlightRouteMiniPreviewProps) {
  const primary = isGoWild ? "#059669" : "#9CA3AF";
  const accent = isGoWild ? "#10b981" : "#D1D5DB";

  if (isAllDestinations) {
    // Hub dot with spokes radiating to 5 destination points
    const spokes: [number, number][] = [[50, 6], [52, 26], [36, 30], [8, 26], [8, 10]];
    return (
      <svg width="60" height="36" viewBox="0 0 60 36" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
        {spokes.map(([tx, ty], i) => {
          const isHighlight = i === 0 && !!bestDestination;
          return (
            <line
              key={i}
              x1="16" y1="18"
              x2={tx} y2={ty}
              stroke={isHighlight ? accent : "#D1D5DB"}
              strokeWidth={isHighlight ? 1.5 : 1}
              strokeDasharray={isHighlight ? undefined : "3 2"}
              opacity={isHighlight ? 0.9 : 0.5}
            />
          );
        })}
        {/* Hub origin dot */}
        <circle cx="16" cy="18" r="4.5" fill={primary} opacity={0.9} />
        <circle cx="16" cy="18" r="2" fill="white" />
        {/* Highlighted best destination dot */}
        {bestDestination && <circle cx="50" cy="6" r="3" fill={accent} opacity={0.9} />}
        {/* Faint dots for other spokes */}
        {spokes.slice(1).map(([tx, ty], i) => (
          <circle key={i} cx={tx} cy={ty} r="1.5" fill="#D1D5DB" opacity={0.6} />
        ))}
      </svg>
    );
  }

  // Single-route curved arc
  return (
    <svg width="60" height="36" viewBox="0 0 60 36" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      {/* Curved arc from origin to destination */}
      <path
        d="M 8 26 Q 30 4 52 26"
        stroke={primary}
        strokeWidth={1.5}
        fill="none"
        opacity={0.75}
        strokeLinecap="round"
      />
      {/* Midpoint direction dot */}
      <circle cx="30" cy="12" r="1.5" fill={primary} opacity={0.45} />
      {/* Origin dot */}
      <circle cx="8" cy="26" r="3.5" fill={primary} />
      <circle cx="8" cy="26" r="1.5" fill="white" />
      {/* Destination dot */}
      <circle cx="52" cy="26" r="3.5" fill={accent} />
    </svg>
  );
}
