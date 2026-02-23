import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  const { requestBodyText, responseText, summary } = useMemo(() => {
    const safeSummary = {
      count: 0,
      origin: "—",
      destinationsText: "—",
      departureText: "—",
      daysAwayText: "",
    };

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const ordinal = (n: number) => {
      const mod100 = n % 100;
      if (mod100 >= 11 && mod100 <= 13) return "th";
      const mod10 = n % 10;
      if (mod10 === 1) return "st";
      if (mod10 === 2) return "nd";
      if (mod10 === 3) return "rd";
      return "th";
    };

    const formatDeparture = (d: Date) => {
      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
      const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(d);
      const day = d.getDate();
      const year = d.getFullYear();
      return `${weekday}, ${month} ${day}${ordinal(day)}, ${year}`;
    };

    const tryMakeUrl = (raw: string) => {
      const s = (raw || "").trim();
      if (!s) return null;
      try {
        return new URL(s);
      } catch {
        try {
          // Handles URLs without protocol like "booking.flyfrontier.com/Flight/..."
          return new URL(s, "https://example.com");
        } catch {
          return null;
        }
      }
    };

    const getFlightsArray = (parsed: any): any[] => {
      const candidates = [
        parsed?.response?.data?.json?.flights,
        parsed?.response?.data?.json?.body?.data?.json?.flights,
        parsed?.response?.data?.json?.body?.data?.flights,
        parsed?.response?.body?.data?.json?.flights,
        parsed?.response?.body?.data?.flights,
        parsed?.data?.json?.flights,
        parsed?.data?.flights,
        parsed?.flights,
      ];
      for (const c of candidates) {
        if (Array.isArray(c)) return c;
      }
      return [];
    };

    try {
      const parsed = JSON.parse(responseData);

      const firecrawlRequestBody = parsed?.firecrawlRequestBody ?? {};
      const reqUrlStr = firecrawlRequestBody?.url || firecrawlRequestBody?.targetUrl || "";
      const urlObj = tryMakeUrl(reqUrlStr);

      const flights = getFlightsArray(parsed);

      // Count
      safeSummary.count = Array.isArray(flights) ? flights.length : 0;

      // Origin
      const originFromUrl = urlObj?.searchParams?.get("o1") || urlObj?.searchParams?.get("origin");
      const originFromFlights = flights?.[0]?.origin;
      safeSummary.origin = (originFromUrl || originFromFlights || "—").toString().toUpperCase();

      // Destinations: prefer d1, otherwise unique destinations from flights
      const d1 = urlObj?.searchParams?.get("d1") || urlObj?.searchParams?.get("destination");
      if (d1) {
        safeSummary.destinationsText = d1.toString().toUpperCase();
      } else {
        const set = new Set<string>();
        for (const f of flights) {
          if (f?.destination) set.add(String(f.destination).toUpperCase());
        }
        safeSummary.destinationsText = set.size ? Array.from(set).join(", ") : "—";
      }

      // Departure date: dd1 (Frontier) or date (your stream endpoint)
      const dd1Raw = urlObj?.searchParams?.get("dd1");
      const dateRaw = urlObj?.searchParams?.get("date");
      let departureDate: Date | null = null;

      if (dd1Raw) {
        const decoded = decodeURIComponent(dd1Raw);
        const datePart = decoded.split(" ")[0]; // "YYYY-MM-DD"
        const d = new Date(`${datePart}T00:00:00`);
        if (!Number.isNaN(d.getTime())) departureDate = d;
      } else if (dateRaw) {
        const d = new Date(`${decodeURIComponent(dateRaw)}T00:00:00`);
        if (!Number.isNaN(d.getTime())) departureDate = d;
      }

      if (departureDate) {
        safeSummary.departureText = formatDeparture(departureDate);

        const diffMs = startOfDay(departureDate).getTime() - startOfDay(new Date()).getTime();
        const daysAway = Math.round(diffMs / 86400000);

        if (daysAway >= 0) {
          safeSummary.daysAwayText = `+ ${daysAway} ${daysAway === 1 ? "day" : "days"} away`;
        } else {
          const n = Math.abs(daysAway);
          safeSummary.daysAwayText = `${n} ${n === 1 ? "day" : "days"} ago`;
        }
      }

      // Keep your existing textareas exactly the same idea
      if (parsed && typeof parsed === "object" && "firecrawlRequestBody" in parsed && "response" in parsed) {
        return {
          requestBodyText: JSON.stringify(parsed.firecrawlRequestBody, null, 2),
          responseText: JSON.stringify(parsed.response, null, 2),
          summary: safeSummary,
        };
      }
    } catch {
      // fall through
    }

    return {
      requestBodyText: "(not available)",
      responseText: responseData,
      summary: safeSummary,
    };
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

        <h1 className="h-12 flex items-center justify-center text-xl font-bold text-[#2E4A4A] tracking-tight leading-none whitespace-nowrap">
          Flight Results
        </h1>

        <div className="h-12 w-10" />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col px-6 pt-2 pb-6 gap-4 relative z-10">
        {/* Added summary text (like your uploaded image) */}
        <div className="bg-white rounded-2xl border border-[#345C5A]/20 p-4">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-semibold text-[#0B5C63] leading-none">{summary.count}</span>
            <span className="text-5xl font-semibold text-[#1F2937] leading-none">Flight Results</span>
          </div>

          <div className="mt-3 text-lg text-[#111827] space-y-1">
            <div>
              <span className="font-semibold">From:</span> <span>{summary.origin}</span>{" "}
              <span className="text-[#0B5C63] font-semibold mx-1">→</span> <span className="font-semibold">To:</span>{" "}
              <span>{summary.destinationsText}</span>
            </div>

            <div>
              <span className="font-semibold">Departure:</span> <span>{summary.departureText}</span>{" "}
              {summary.daysAwayText ? <span className="text-[#16A34A] font-medium">{summary.daysAwayText}</span> : null}
            </div>
          </div>
        </div>

        {/* Request body */}
        <div>
          <h2 className="text-sm font-semibold text-[#2E4A4A] mb-1">Request Body</h2>
          <textarea
            readOnly
            value={requestBodyText}
            className="w-full min-h-[120px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
          />
        </div>

        {/* Response payload */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-sm font-semibold text-[#2E4A4A] mb-1">Response Payload</h2>
          <textarea
            readOnly
            value={responseText}
            className="w-full flex-1 min-h-[300px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};

export default FlightDestResults;
