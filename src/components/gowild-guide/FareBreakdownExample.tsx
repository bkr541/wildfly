/**
 * Visual fare breakdown — schematic, not a clone of Frontier's checkout.
 */
export function FareBreakdownExample() {
  const rows: { label: string; value: string; muted?: boolean }[] = [
    { label: "GoWild airfare per segment", value: "$0.01" },
    { label: "Government taxes", value: "+ varies" },
    { label: "Passenger & airport charges", value: "+ varies" },
    { label: "Additional segments", value: "+ each" },
    { label: "GoWild Early Booking charge (if applicable)", value: "+ optional" },
    { label: "Optional bags, seats, bundles", value: "+ optional" },
  ];
  return (
    <div className="rounded-xl border border-[#E8EBEB] bg-white p-4 space-y-2">
      <ul className="divide-y divide-[#F0F1F1]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm text-[#2E4A4A]">{r.label}</span>
            <span className="text-sm font-semibold text-[#1A2E2E] whitespace-nowrap">{r.value}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E8EBEB]">
        <span className="text-sm font-bold uppercase tracking-wider text-[#059669]">
          = Displayed GoWild total
        </span>
        <span className="text-sm font-bold text-[#059669]">at checkout</span>
      </div>
      <p className="text-[11px] text-[#6B7B7B] leading-snug pt-1">
        ~$15 is a commonly observed domestic nonstop example, not a guaranteed fixed price.
        Totals vary by route, segments, taxes, charges, and any optional add-ons.
      </p>
    </div>
  );
}

export default FareBreakdownExample;
