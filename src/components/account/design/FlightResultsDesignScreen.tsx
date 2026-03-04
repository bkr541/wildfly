import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

interface FlightResultsDesignScreenProps {
  onBack: () => void;
}

const MOCK_FLIGHTS = [
  { dest: "LAS", city: "Las Vegas", price: "$0", type: "GoWild", nonstop: true, earliest: "6:00 AM", duration: "4h 30m" },
  { dest: "DEN", city: "Denver", price: "$89", type: "Paid", nonstop: true, earliest: "7:15 AM", duration: "3h 10m" },
  { dest: "LAX", city: "Los Angeles", price: "$0", type: "GoWild", nonstop: false, earliest: "8:45 AM", duration: "5h 20m" },
  { dest: "MIA", city: "Miami", price: "$129", type: "Paid", nonstop: true, earliest: "9:30 AM", duration: "2h 45m" },
];

const FlightResultsDesignScreen = ({ onBack }: FlightResultsDesignScreenProps) => {
  return (
    <div className="flex flex-col h-full animate-fade-in bg-[#F4F8F8]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-[#E3E6E6]">
        <button type="button" onClick={onBack} className="h-8 w-8 rounded-full bg-[#F2F3F3] flex items-center justify-center hover:bg-[#E3E6E6] transition-colors">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} color="#345C5A" strokeWidth={1.5} />
        </button>
        <div>
          <p className="text-sm font-bold text-[#2E4A4A]">Playground</p>
          <p className="text-xs text-[#6B7B7B]">Design Hub — live component preview</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Result Cards */}
        <div className="bg-white rounded-2xl border border-[#E3E6E6] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0F1F1]">
            <p className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider">Result Cards</p>
          </div>
          <div className="p-3 space-y-2">
            {MOCK_FLIGHTS.map((f) => (
              <div key={f.dest} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F4F8F8] border border-[#E8EBEB]">
                <div className="h-10 w-10 rounded-xl bg-[#345C5A] flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{f.dest}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#2E4A4A] truncate">{f.city}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${f.type === "GoWild" ? "bg-[#E6F2EF] text-[#345C5A]" : "bg-[#EEF0FF] text-[#4B5DAA]"}`}>
                      {f.type}
                    </span>
                    <span className="text-[10px] text-[#6B7B7B]">{f.nonstop ? "Nonstop" : "1 Stop"}</span>
                    <span className="text-[10px] text-[#6B7B7B]">· {f.duration}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${f.price === "$0" ? "text-[#345C5A]" : "text-[#2E4A4A]"}`}>{f.price}</p>
                  <p className="text-[10px] text-[#6B7B7B]">{f.earliest}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Pill Group */}
        <div className="bg-white rounded-2xl border border-[#E3E6E6] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0F1F1]">
            <p className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider">Info Pill Group</p>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "EARLIEST", value: "6:00 AM" },
                { label: "NONSTOP", value: "3 flights" },
                { label: "LOWEST", value: "$0" },
                { label: "GOWILD", value: "2 avail" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center rounded-xl border border-[#E8EBEB] bg-[#F4F8F8] px-1.5 py-1.5 gap-0.5">
                  <p className="text-[9px] font-bold text-[#6B7B7B] uppercase tracking-wide leading-none">{item.label}</p>
                  <p className="text-xs font-bold text-[#2E4A4A] leading-tight text-center">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Header Bar */}
        <div className="bg-white rounded-2xl border border-[#E3E6E6] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0F1F1]">
            <p className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider">Page Header</p>
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#345C5A]">
              <div>
                <p className="text-xs font-bold text-white">ATL → All Destinations</p>
                <p className="text-[10px] text-[#A8C5C3]">Mar 15 · 4 Flights</p>
              </div>
              <div className="flex gap-1.5">
                <span className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">↑↓</span>
                </span>
                <span className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">☰</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Color Tokens */}
        <div className="bg-white rounded-2xl border border-[#E3E6E6] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F0F1F1]">
            <p className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider">Color Tokens</p>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2">
            {[
              { label: "Primary", bg: "#345C5A" },
              { label: "GoWild", bg: "#E6F2EF", text: "#345C5A" },
              { label: "Surface", bg: "#F4F8F8", text: "#2E4A4A" },
              { label: "Border", bg: "#E3E6E6", text: "#6B7B7B" },
              { label: "Muted", bg: "#6B7B7B" },
              { label: "Accent", bg: "#2E4A4A" },
            ].map((tok) => (
              <div key={tok.label} className="flex flex-col items-center gap-1">
                <div className="h-8 w-full rounded-lg border border-[#E3E6E6]" style={{ backgroundColor: tok.bg }} />
                <p className="text-[9px] font-semibold text-[#6B7B7B] text-center">{tok.label}</p>
                <p className="text-[8px] text-[#C4CACA] font-mono">{tok.bg}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default FlightResultsDesignScreen;
