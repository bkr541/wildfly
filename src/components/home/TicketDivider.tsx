interface TicketDividerProps {
  className?: string;
  notchSize?: number;
  notchBg?: string;
  lineColor?: string;
  marginY?: number;
  /** Must match the card's horizontal padding in px so notches align at card edges */
  cardPx?: number;
}

/**
 * Boarding-pass style divider with a dashed horizontal line and semicircle
 * notches punched into the left/right card edges.
 *
 * Uses negative horizontal margins equal to cardPx so the notch circles are
 * centered at the card's inner padding edge. With overflow:hidden on the
 * parent card the outer half of each circle is clipped, leaving a visible
 * semicircle that looks like a notch cut into the ticket.
 */
export function TicketDivider({
  className,
  notchSize = 28,
  notchBg = "#CDDADA",
  lineColor = "#C2CFCF",
  marginY = 10,
  cardPx = 12,
}: TicketDividerProps) {
  return (
    <div
      className={`relative h-0${className ? ` ${className}` : ""}`}
      style={{
        marginTop: marginY,
        marginBottom: marginY,
        marginLeft: -cardPx,
        marginRight: -cardPx,
      }}
    >
      {/* dashed line — inset back to card's content area */}
      <div
        className="absolute top-0 border-t border-dashed"
        style={{ borderColor: lineColor, left: cardPx, right: cardPx }}
      />
      {/* left notch — center sits at card's padding-box edge, right half visible */}
      <div
        className="absolute rounded-full"
        style={{
          width: notchSize,
          height: notchSize,
          left: -notchSize / 2,
          top: -notchSize / 2,
          background: notchBg,
        }}
      />
      {/* right notch */}
      <div
        className="absolute rounded-full"
        style={{
          width: notchSize,
          height: notchSize,
          right: -notchSize / 2,
          top: -notchSize / 2,
          background: notchBg,
        }}
      />
    </div>
  );
}
