import { useMemo, useState } from "react";

type Category = "domestic" | "territory" | "international";

interface Extras {
  seat: boolean;
  carryOn: boolean;
  checkedBag: boolean;
  bundle: boolean;
}

interface Props {
  id?: string;
}

/**
 * "Why this price?" interactive helper. Always frames results as estimates.
 */
export function FareDecoder({ id }: Props) {
  const [total, setTotal] = useState<string>("");
  const [segments, setSegments] = useState<number>(1);
  const [category, setCategory] = useState<Category>("domestic");
  const [insideWindow, setInsideWindow] = useState<boolean>(true);
  const [extras, setExtras] = useState<Extras>({
    seat: false,
    carryOn: false,
    checkedBag: false,
    bundle: false,
  });

  const explanations = useMemo(() => {
    const out: string[] = [];
    const totalNum = parseFloat(total);
    if (!isNaN(totalNum) && totalNum > 0) {
      if (totalNum >= 50) {
        out.push("A total at or above ~$50 commonly suggests an early-booking charge, peak-date promotion, multiple segments, international taxes, or optional add-ons.");
      } else if (totalNum >= 25) {
        out.push("A total around $25–$45 often points to connecting itineraries, multiple segment taxes, or territory routing.");
      } else {
        out.push("A total under ~$20 typically reflects a domestic nonstop inside the standard window — mostly required taxes and airport charges on top of the $0.01 airfare.");
      }
    }
    if (segments > 1) out.push(`Multi-segment itinerary (${segments} segments): each Frontier-operated segment can add its own taxes and airport charges.`);
    if (category === "territory") out.push("Puerto Rico / U.S. Virgin Islands itineraries can carry higher territory-related taxes than continental domestic flights.");
    if (category === "international") out.push("International itineraries usually include significantly higher government taxes, immigration charges, and arrival/departure fees.");
    if (!insideWindow) out.push("Outside the standard booking window, a GoWild Early Booking charge may have been added by Frontier.");
    const extraLabels: string[] = [];
    if (extras.seat) extraLabels.push("advance seat selection");
    if (extras.carryOn) extraLabels.push("carry-on bag");
    if (extras.checkedBag) extraLabels.push("checked bag");
    if (extras.bundle) extraLabels.push("bundle");
    if (extraLabels.length) {
      out.push(`Optional add-ons included: ${extraLabels.join(", ")}. These are priced separately from the airfare.`);
    }
    if (!out.length) {
      out.push("Enter your displayed total and itinerary details for likely explanations.");
    }
    return out;
  }, [total, segments, category, insideWindow, extras]);

  const toggleExtra = (k: keyof Extras) =>
    setExtras((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className="space-y-3" id={id}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="fd-total" className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5">
            Displayed GoWild total
          </label>
          <div className="app-input-container" style={{ minHeight: 48 }}>
            <span className="app-input-icon-btn font-bold">$</span>
            <input
              id="fd-total"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              className="app-input"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="e.g. 14.96"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
        <div>
          <label htmlFor="fd-seg" className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5">
            Flight segments
          </label>
          <div className="app-input-container" style={{ minHeight: 48 }}>
            <input
              id="fd-seg"
              type="number"
              inputMode="numeric"
              min={1}
              max={6}
              className="app-input"
              value={segments}
              onChange={(e) => setSegments(Math.max(1, parseInt(e.target.value || "1", 10)))}
              style={{ fontSize: 16 }}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5">
          Travel category
        </label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Travel category">
          {([
            ["domestic", "Continental"],
            ["territory", "PR / USVI"],
            ["international", "International"],
          ] as const).map(([val, label]) => {
            const sel = category === val;
            return (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setCategory(val)}
                className={[
                  "min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                  sel
                    ? "bg-[#F0FDF4] border-[#059669] text-[#059669]"
                    : "bg-white border-[#E8EBEB] text-[#374151] hover:border-[#6EE7B7]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5">
          Booking window
        </label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Booking window">
          {([
            [true, "Inside standard window"],
            [false, "Outside (early booking)"],
          ] as const).map(([val, label]) => {
            const sel = insideWindow === val;
            return (
              <button
                key={String(val)}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setInsideWindow(val)}
                className={[
                  "min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                  sel
                    ? "bg-[#F0FDF4] border-[#059669] text-[#059669]"
                    : "bg-white border-[#E8EBEB] text-[#374151] hover:border-[#6EE7B7]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7B7B] mb-1.5">
          Optional add-ons selected
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["seat", "Seat"],
            ["carryOn", "Carry-on"],
            ["checkedBag", "Checked bag"],
            ["bundle", "Bundle"],
          ] as const).map(([k, label]) => {
            const on = extras[k];
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleExtra(k)}
                className={[
                  "min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                  on
                    ? "bg-[#F0FDF4] border-[#059669] text-[#059669]"
                    : "bg-white border-[#E8EBEB] text-[#374151] hover:border-[#6EE7B7]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        aria-live="polite"
        className="rounded-xl border border-[#E8EBEB] bg-white p-4 space-y-2"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[#059669]">Possible explanations</p>
        <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
          {explanations.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <p className="text-xs text-[#6B7B7B] mt-2">
          <strong>This is an estimate.</strong> Open Frontier's "Taxes and Carrier Imposed Fees"
          section at checkout to confirm the exact charges. Wildfly does not have access to
          Frontier's internal fare breakdown.
        </p>
      </div>
    </div>
  );
}

export default FareDecoder;
