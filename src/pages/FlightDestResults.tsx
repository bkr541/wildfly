import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

type FlightLike = {
  origin?: string;
  destination?: string;
  depart_time?: string;
};

function ordinalSuffix(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatDepartureLabel(d: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(d);
  const day = d.getDate();
  const year = d.getFullYear();
  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}, ${year}`;
}

function safeUrl(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  // URL() requires a protocol. Many of these URLs are saved without one.
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;

  try {
    return new URL(withProto);
  } catch {
    return null;
  }
}

function getFlightsFromUnknownShape(obj: any): FlightLike[] {
  // Common Firecrawl nesting patterns seen in responses
  const candidates = [
    obj?.response?.data?.json?.flights,
    obj?.response?.data?.json?.body?.data?.json?.flights,
    obj?.response?.data?.json?.body?.data?.flights,
    obj?.response?.body?.data?.json?.flights,
    obj?.response?.body?.data?.flights,
    obj?.data?.json?.flights,
    obj?.data?.flights,
    obj?.flights,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c as FlightLike[];
  }
  return [];
}

function parseDepartureDateFromRequest(firecrawlReq: any, flights: FlightLike[]) {
  const urlStr: string | undefined = firecrawlReq?.url || firecrawlReq?.targetUrl;
  const u = urlStr ? safeUrl(urlStr) : null;

  // Try dd1 from request URL (Frontier format)
  const dd1 = u?.searchParams.get("dd1");
  if (dd1) {
    const decoded = decodeURIComponent(dd1);
    // ex: "2026-02-24 00:00:00" -> take date part
    const datePart = decoded.split(" ")[0];
    const d = new Date(`${datePart}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Fallback: try first flight depart_time if present
  const first = flights?.[0]?.depart_time;
  if (first) {
    const d = new Date(first);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  const { requestBodyText, responseText, summary } = useMemo(() => {
    let parsed: any = null;

    try {
      parsed = JSON.parse(responseData);
    } catch {
      // ignore
    }

    const firecrawlRequestBody = parsed?.firecrawlRequestBody ?? null;
    const flights = parsed ? getFlightsFromUnknownShape(parsed) : [];

    // Origin: prefer URL o1, then first flight origin
    const u = firecrawlRequestBody?.url ? safeUrl(firecrawlRequestBody.url) : null;
    const origin =
      u?.searchParams.get("o1")?.toUpperCase() ||
      flights?.[0]?.origin?.toUpperCase() ||
      u?.searchParams.get("origin")?.toUpperCase() ||
      "";

    // Destinations: unique list from flights, else URL d1
    const destSet = new Set<string>();
    for (const f of flights) {
      if (f?.destination) destSet.add(String(f.destination).toUpperCase());
    }
    if (destSet.size === 0) {
      const d1 = u?.searchParams.get("d1")?.toUpperCase();
      if (d1) destSet.add(d1);
      const dest = u?.searchParams.get("destination")?.toUpperCase();
      if (dest) destSet.add(dest);
    }
    const destinations = Array.from(destSet);

    const departureDate = parseDepartureDateFromRequest(firecrawlRequestBody, flights);
    const departureLabel = departureDate ? formatDepartureLabel(departureDate) : "";

    let daysAway: number | null = null;
    if (departureDate) {
      const diffMs = startOfDay(departureDate).getTime() - startOfDay(new Date()).getTime();
      daysAway = Math.round(diffMs / 86400000);
    }

    const totalResults = Array.isArray(flights) ? flights.length : 0;

    const requestBodyTextComputed =
      parsed && typeof parsed === "object" && "firecrawlRequestBody" in parsed
        ? JSON.stringify(parsed.firecrawlRequestBody, null, 2)
        : "(not available)";

    const responseTextComputed =
      parsed && typeof parsed === "object" && "response" in parsed
        ? JSON.stringify(parsed.response, null, 2)
        : responseData;

    return {
      requestBodyText: requestBodyTextComputed,
      responseText: responseTextComputed,
      summary: {
        totalResults,
        origin,
        destinations,
        departureLabel,
        daysAway,
      },
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
        {/* Summary (matches uploaded image text) */}
        <div className="rounded-2xl border border-[#345C5A]/15 bg-white p-4 shadow-sm">
          <div className="flex items-end gap-3">
            <span className="text-5xl font-semibold leading-none text-[#0B5C63]">{summary.totalResults}</span>
            <span className="text-5xl font-semibold leading-none text-[#1F2937]">Flight Results</span>
          </div>

          <div className="mt-3 space-y-1 text-lg text-[#111827]">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-semibold">From:</span>
              <span className="tracking-wide">{summary.origin || "—"}</span>
              <span className="mx-1 font-semibold text-[#0B5C63]">→</span>
              <span className="font-semibold">To:</span>
              <span className="tracking-wide">
                {summary.destinations.length ? summary.destinations.join(", ") : "—"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2">
              <span className="font-semibold">Departure:</span>
              <span>{summary.departureLabel || "—"}</span>
              {typeof summary.daysAway === "number" && (
                <span className="font-medium text-[#16A34A]">
                  {summary.daysAway >= 0
                    ? `+ ${summary.daysAway} ${summary.daysAway === 1 ? "day" : "days"} away`
                    : `${Math.abs(summary.daysAway)} ${Math.abs(summary.daysAway) === 1 ? "day" : "days"} ago`}
                </span>
              )}
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
