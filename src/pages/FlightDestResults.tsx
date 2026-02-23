import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

type DestSummary = { destination: string; count: number };

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pretty(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

/**
 * Walk any object/array and collect nodes that look like:
 * { anchor: { destination }, flights: [...] }
 */
function collectAnchorFlightNodes(root: any): Array<{ destination: string; flightsCount: number }> {
  const out: Array<{ destination: string; flightsCount: number }> = [];
  const seen = new Set<any>();

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    const destination = node?.anchor?.destination;
    const flights = node?.flights;

    if (typeof destination === "string" && destination.trim() && Array.isArray(flights)) {
      out.push({ destination: destination.trim(), flightsCount: flights.length });
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    for (const key of Object.keys(node)) {
      visit((node as any)[key]);
    }
  };

  visit(root);
  return out;
}

function buildDestinationSummaries(responsePayload: any): DestSummary[] {
  const nodes = collectAnchorFlightNodes(responsePayload);
  const counts = new Map<string, number>();

  for (const n of nodes) {
    counts.set(n.destination, (counts.get(n.destination) ?? 0) + n.flightsCount);
  }

  return Array.from(counts.entries())
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination));
}

/**
 * Try to extract:
 * - request body
 * - response payload
 * from whatever shape responseData is in.
 *
 * This supports common patterns like:
 * { requestBody: {...}, responsePayload: {...} }
 * { request: {...}, response: {...} }
 * { body: {...}, data: {...} }
 * or just a raw response payload (fallback).
 */
function extractRequestAndPayload(parsed: any): {
  requestBodyText: string;
  responsePayloadText: string;
  responsePayloadObj: any;
} {
  if (!parsed || typeof parsed !== "object") {
    return {
      requestBodyText: "",
      responsePayloadText: "",
      responsePayloadObj: null,
    };
  }

  const requestBody =
    parsed.requestBody ?? parsed.request_body ?? parsed.request ?? parsed.body ?? parsed.requestPayload ?? null;

  const responsePayload =
    parsed.responsePayload ??
    parsed.response_payload ??
    parsed.response ??
    parsed.data ??
    parsed.payload ??
    parsed.result ??
    parsed.results ??
    parsed;

  return {
    requestBodyText: requestBody ? pretty(requestBody) : "",
    responsePayloadText: responsePayload ? pretty(responsePayload) : "",
    responsePayloadObj: responsePayload,
  };
}

const FlightDestResults = ({ onBack, responseData }: { onBack: () => void; responseData: string }) => {
  const { requestBodyText, responsePayloadText, responsePayloadObj } = useMemo(() => {
    const parsed = safeJsonParse(responseData);
    if (!parsed) {
      // If it isn't JSON, we can’t extract request/response; show it as “payload”
      return {
        requestBodyText: "",
        responsePayloadText: responseData,
        responsePayloadObj: null,
      };
    }
    return extractRequestAndPayload(parsed);
  }, [responseData]);

  const destinationSummaries = useMemo(() => {
    if (!responsePayloadObj) {
      // If we can't parse an object payload, try parsing payload text again as a last resort.
      const maybe = safeJsonParse(responsePayloadText);
      if (maybe) return buildDestinationSummaries(maybe);
      return [];
    }
    return buildDestinationSummaries(responsePayloadObj);
  }, [responsePayloadObj, responsePayloadText]);

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
      <div className="flex-1 flex flex-col px-6 pt-2 pb-6 relative z-10">
        {/* Destination cards (anchor.destination + # flights) */}
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

        {/* Request Body */}
        {requestBodyText.trim().length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-semibold text-[#2E4A4A]">Request Body</div>
            <textarea
              readOnly
              value={requestBodyText}
              className="w-full min-h-[140px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-xs font-mono text-[#2E4A4A] resize-none focus:outline-none"
            />
          </div>
        )}

        {/* Response Payload */}
        <div className="flex-1 flex flex-col">
          <div className="mb-2 text-sm font-semibold text-[#2E4A4A]">Response Payload</div>
          <textarea
            readOnly
            value={responsePayloadText}
            className="w-full flex-1 min-h-[300px] rounded-2xl border border-[#345C5A]/20 bg-white p-4 text-sm font-mono text-[#2E4A4A] resize-none focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};

export default FlightDestResults;
