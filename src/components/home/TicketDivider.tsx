/**
 * Boarding-pass style divider: side notches that punch into the card's
 * left/right edges without drawing the route-style dashed line.
 *
 * Renders inside a relatively-positioned parent card. The notch circles
 * use a solid color tuned to blend with the page background behind the
 * frosted-glass cards.
 */
export function TicketDivider() {
  const NOTCH = 14;
  const NOTCH_BG = "#EDF1F1"; // approximates page bg behind frosted cards
  return (
    <div className="relative my-3 h-0">
      {/* left notch */}
      <div
        className="absolute rounded-full"
        style={{
          width: NOTCH,
          height: NOTCH,
          left: -NOTCH / 2,
          top: -NOTCH / 2,
          background: NOTCH_BG,
        }}
      />
      {/* right notch */}
      <div
        className="absolute rounded-full"
        style={{
          width: NOTCH,
          height: NOTCH,
          right: -NOTCH / 2,
          top: -NOTCH / 2,
          background: NOTCH_BG,
        }}
      />
    </div>
  );
}
