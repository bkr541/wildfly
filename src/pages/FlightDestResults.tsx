import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

type DestSummary = { destination: string; count: number };

function extractJsonNode(item: any): any {
  // Common Firecrawl/Lovable shapes we’ve seen:
  // 1) { success, data: { json: { anchor, flights } } }
  // 2) { data: { json: { anchor, flights } } }  (axios-ish)
  // 3) { json: { anchor, flights } }
  // 4) { anchor, flights }
  return item?.data?.json ?? item?.data?.data?.json ?? item?.json ?? item?.data ?? item;
}

function buildDestinationSummaries(parsed: any): DestSummary[] {
  const items = Array.isArray(parsed) ? parsed : [parsed];

  const counts = new Map<string, number>();

  for (const item of items) {
    const json = extractJsonNode(item);
    const dest = json?.anchor?.destination;

    if (typeof dest !== "string" || dest.trim().length === 0) continue;

    const flightsCount = Array.isArray(json?.flights) ? json.flights.length : 0;
    counts.set(dest, (counts.get(dest) ?? 0) + flightsCount);
  }

  return Array.from(counts.entries())
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination));
}

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  const destinationSummaries = useMemo(() => {
    try {
      const parsed = JSON.parse(responseData);
      return buildDestinationSummaries(parsed);
    } catch {
      return [];
    }
  }, [responseData]);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#F2F3F3] overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute bottom-20 left-8 w-16 h-16 rounded-full bg-[#345C5A]/10 animate-float" />
      <div className="absolute top-20 right-8 w-10 h-10 rounded-full bg-[#345C5A]/10 animate-float-delay" />

      {/* Header */}
      <header className="relative z-10 grid grid-cols-[40px_1fr_40px] items-center px-6 pt-10 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="h-12 w-10 flex items-center justify-start text-[#2E4A4A] hover:opacity-80 transition-opacity"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="block w-6 h-6" />
        </button>

        {/* Match the button height so optical centering lines up */}
        <h1 className="h-12 flex items-center justify-center text-xl font-bold text-[#2E4A4A] tracking-tight leading-none whitespace-nowrap">
          Flight Results
        </h1>

        {/* Right spacer to keep title truly centered */}
        <div className="h-12 w-10" />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 pt-2 pb-6 relative z-10">
        {/* Destination cards (from anchor.destination) */}
        {destinationSummaries.length > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {destinationSummaries.map((d) => (
                <div
                  key={d.destination}
                  className="rounded-2xl border border-[#345C5A]/20 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="text-lg font-bold tracking-tight text-[#2E4A4A]">{d.destination}</div>
                  <div className="text-sm text-[#2E4A4A]/70">
                    {d.count} flight{d.count === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <textarea
          readOnly
          value={responseData}
          className="w-full flex-1 min-h-[300px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
        />
      </div>
    </div>
  );
};

export default FlightDestResults;
