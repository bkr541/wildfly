/**
 * Boarding-pass style divider: a dashed horizontal line flanked by two
 * semi-circle notches that punch into the card's left/right edges.
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
      {/* dashed line */}
      <div
        className="absolute inset-x-3 top-0 border-t border-dashed"
        style={{ borderColor: "#CBD5D5" }}
      />
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
