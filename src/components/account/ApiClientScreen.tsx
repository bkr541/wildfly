import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlayIcon,
  Copy01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface ApiClientScreenProps {
  onBack: () => void;
}

interface ParamDef {
  key: string;
  label: string;
  placeholder: string;
  description: string;
}

interface EndpointDef {
  id: string;
  name: string;
  function: string;
  description: string;
  params: ParamDef[];
  defaultValues: Record<string, string>;
  badge: string;
  badgeColor: string;
}

const today = new Date().toISOString().split("T")[0];

const ENDPOINTS: EndpointDef[] = [
  {
    id: "getSingleRoute",
    name: "Get Single Route",
    function: "getSingleRoute",
    description: "Scrape a specific O→D route from GoWilder via Firecrawl. Returns structured flight data with fares and legs.",
    badge: "POST",
    badgeColor: "#2563EB",
    params: [
      { key: "targetUrl", label: "Target URL", placeholder: "https://gowilder.net/flights/ATL/MIA/2026-03-10", description: "Full GoWilder flight results URL" },
      { key: "origin", label: "Origin IATA", placeholder: "ATL", description: "3-letter departure airport code" },
      { key: "destination", label: "Destination IATA", placeholder: "MIA", description: "3-letter arrival airport code" },
    ],
    defaultValues: {
      targetUrl: "https://gowilder.net/flights/ATL/MIA/" + today,
      origin: "ATL",
      destination: "MIA",
    },
  },
  {
    id: "getAllDirects",
    name: "Get All Directs",
    function: "getAllDirects",
    description: "Scrape the ATL departure board to get all direct-flight destinations for a given date.",
    badge: "POST",
    badgeColor: "#2563EB",
    params: [
      { key: "targetUrl", label: "Target URL", placeholder: "https://www.flight.info/ATL/departures/...", description: "ATL departures board URL" },
      { key: "origin", label: "Origin IATA", placeholder: "ATL", description: "3-letter departure airport code" },
      { key: "destination", label: "Destination IATA", placeholder: "MIA", description: "Used for validation — set to any valid IATA" },
    ],
    defaultValues: {
      targetUrl: "https://www.flight.info/ATL/departures/" + today,
      origin: "ATL",
      destination: "MIA",
    },
  },
  {
    id: "getAllDestinations",
    name: "Get All Destinations",
    function: "getAllDestinations",
    description: "Fetch all Frontier destinations from GoWilder for a given departure airport and date.",
    badge: "POST",
    badgeColor: "#2563EB",
    params: [
      { key: "departureAirport", label: "Departure Airport", placeholder: "ATL", description: "3-letter IATA departure airport" },
      { key: "departureDate", label: "Departure Date", placeholder: today, description: "Date in YYYY-MM-DD format" },
    ],
    defaultValues: {
      departureAirport: "ATL",
      departureDate: today,
    },
  },
  {
    id: "getRoundTripRoute",
    name: "Get Round Trip Route",
    function: "getRoundTripRoute",
    description: "Scrape a round-trip GoWilder route URL. Returns outbound + return flight options.",
    badge: "POST",
    badgeColor: "#2563EB",
    params: [
      { key: "targetUrl", label: "Target URL", placeholder: "https://gowilder.net/flights/ATL/MIA/2026-03-10", description: "GoWilder round-trip results URL" },
    ],
    defaultValues: {
      targetUrl: "https://gowilder.net/flights/ATL/MIA/" + today,
    },
  },
  {
    id: "scheduledATLSnapshot",
    name: "ATL Snapshot",
    function: "scheduledATLSnapshot",
    description: "Run the scheduled ATL GoWild snapshot manually. Fetches today's ATL flights and writes rows to gowild_snapshots.",
    badge: "CRON",
    badgeColor: "#7C3AED",
    params: [],
    defaultValues: {},
  },
];

const JsonViewer = ({ data }: { data: unknown }) => {
  const json = JSON.stringify(data, null, 2);
  return (
    <pre className="text-[11px] font-mono text-[#1a3a3a] whitespace-pre-wrap break-all leading-relaxed">
      {json}
    </pre>
  );
};

const EndpointCard = ({ endpoint }: { endpoint: EndpointDef }) => {
  const [values, setValues] = useState<Record<string, string>>(endpoint.defaultValues);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(true);

  const handleRun = async () => {
    setRunning(true);
    setResponse(null);
    try {
      const body: Record<string, string> = {};
      endpoint.params.forEach((p) => {
        if (values[p.key]?.trim()) body[p.key] = values[p.key].trim();
      });

      const { data, error } = await supabase.functions.invoke(endpoint.function, { body });

      if (error) {
        setResponse({ status: 500, data: { error: error.message } });
        toast.error(`${endpoint.name} — error`);
      } else {
        setResponse({ status: 200, data });
        toast.success(`${endpoint.name} — success`);
      }
      setResponseExpanded(true);
    } catch (err: any) {
      setResponse({ status: 500, data: { error: err?.message ?? "Unknown error" } });
      toast.error(`${endpoint.name} — failed`);
    } finally {
      setRunning(false);
    }
  };

  const copyResponse = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
    toast.success("Copied to clipboard");
  };

  const statusColor = response
    ? response.status < 300
      ? "text-emerald-600"
      : "text-red-500"
    : "text-[#6B7B7B]";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center w-full px-4 py-3 gap-3 hover:bg-[#F8F9F9] transition-colors text-left"
      >
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded-md text-white shrink-0"
          style={{ backgroundColor: endpoint.badgeColor }}
        >
          {endpoint.badge}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#2E4A4A] truncate">{endpoint.name}</p>
          <p className="text-xs text-[#6B7B7B] font-mono truncate">{endpoint.function}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {response && (
            <span className={`text-xs font-bold ${statusColor}`}>
              {response.status === 200 ? "✓ 200" : `✗ ${response.status}`}
            </span>
          )}
          <HugeiconsIcon
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
            size={14}
            color="#6B7B7B"
            strokeWidth={1.5}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#F0F1F1] px-4 pb-4 pt-3 space-y-3 animate-fade-in">
          <p className="text-xs text-[#6B7B7B] leading-relaxed">{endpoint.description}</p>

          {/* Params */}
          {endpoint.params.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider">Parameters</p>
              {endpoint.params.map((param) => (
                <div key={param.key}>
                  <label className="text-xs font-semibold text-[#2E4A4A] flex items-center gap-1.5 mb-1">
                    {param.label}
                    <span className="text-[10px] text-[#6B7B7B] font-normal">{param.description}</span>
                  </label>
                  <input
                    type="text"
                    value={values[param.key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
                    placeholder={param.placeholder}
                    className="w-full px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none focus:border-[#345C5A] bg-[#F8F9F9] transition-colors"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Run button */}
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#345C5A] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {running ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Running…
              </>
            ) : (
              <>
                <HugeiconsIcon icon={PlayIcon} size={13} color="currentColor" strokeWidth={2} />
                Send Request
              </>
            )}
          </button>

          {/* Response */}
          {response && (
            <div className="rounded-xl border border-[#E3E6E6] overflow-hidden">
              <button
                type="button"
                onClick={() => setResponseExpanded((v) => !v)}
                className="flex items-center w-full px-3 py-2 bg-[#F2F3F3] gap-2 hover:bg-[#EAECEC] transition-colors"
              >
                <span className={`text-xs font-bold ${statusColor}`}>
                  Response {response.status === 200 ? "200 OK" : `${response.status}`}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); copyResponse(); }}
                  className="p-1 rounded-md hover:bg-[#D6D9D9] transition-colors"
                  title="Copy response"
                >
                  <HugeiconsIcon icon={Copy01Icon} size={11} color="#6B7B7B" strokeWidth={1.5} />
                </button>
                <HugeiconsIcon
                  icon={responseExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                  size={12}
                  color="#6B7B7B"
                  strokeWidth={1.5}
                />
              </button>
              {responseExpanded && (
                <div className="p-3 max-h-64 overflow-y-auto bg-[#F8F9F9]">
                  <JsonViewer data={response.data} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ApiClientScreen = ({ onBack }: ApiClientScreenProps) => {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-6 space-y-3 overflow-y-auto">
        <p className="text-xs text-[#6B7B7B] leading-relaxed pt-1 pb-1">
          Manually invoke edge functions with pre-populated parameters. Expand an endpoint, edit params if needed, and send.
        </p>
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={ep.id} endpoint={ep} />
        ))}
      </div>
    </div>
  );
};

export default ApiClientScreen;
