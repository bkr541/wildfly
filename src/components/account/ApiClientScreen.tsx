import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlayIcon,
  Copy01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  PlusSignIcon,
  Cancel01Icon,
  Delete01Icon,
  Time01Icon,
  ArrowRight01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface ApiClientScreenProps {
  onBack: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
type AuthType = "none" | "bearer" | "basic" | "apikey";
type BodyType = "none" | "json" | "form-data" | "urlencoded" | "raw";
type ApiKeyIn = "header" | "query";

interface KVRow {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  group?: string;
}

interface ResponseData {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
  bodyType: "json" | "text";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#22C55E",
  POST: "#3B82F6",
  PUT: "#F59E0B",
  PATCH: "#8B5CF6",
  DELETE: "#EF4444",
  HEAD: "#6B7280",
  OPTIONS: "#06B6D4",
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const PRESET_HEADERS: Array<{ label: string; key: string; value: string }> = [
  { label: "Content-Type: JSON", key: "Content-Type", value: "application/json" },
  { label: "Content-Type: Form", key: "Content-Type", value: "application/x-www-form-urlencoded" },
  { label: "Accept: JSON", key: "Accept", value: "application/json" },
  { label: "Authorization: Bearer", key: "Authorization", value: "Bearer <token>" },
  { label: "Cache-Control: no-cache", key: "Cache-Control", value: "no-cache" },
];

// Pre-populated saved requests from existing edge functions
const DEFAULT_SAVED: SavedRequest[] = [
  {
    id: "1",
    name: "Get Single Route",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/getSingleRoute`,
    group: "Lovable Cloud",
  },
  {
    id: "2",
    name: "Get All Directs",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/getAllDirects`,
    group: "Lovable Cloud",
  },
  {
    id: "3",
    name: "Get All Destinations",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/getAllDestinations`,
    group: "Lovable Cloud",
  },
  {
    id: "4",
    name: "Get Round Trip Route",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/getRoundTripRoute`,
    group: "Lovable Cloud",
  },
  {
    id: "5",
    name: "ATL Snapshot",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/scheduledATLSnapshot`,
    group: "Lovable Cloud",
  },
  { id: "6", name: "Routes", method: "POST", url: `${SUPABASE_URL}/functions/v1/airlabsRoutes`, group: "AirLabs" },
  {
    id: "7",
    name: "Schedules",
    method: "POST",
    url: `${SUPABASE_URL}/functions/v1/airlabsSchedules`,
    group: "AirLabs",
  },
];

const DEFAULT_BODIES: Record<string, string> = {
  "1": JSON.stringify(
    {
      targetUrl: `https://gowilder.net/flights/ATL/MIA/${new Date().toISOString().slice(0, 10)}`,
      origin: "ATL",
      destination: "MIA",
    },
    null,
    2,
  ),
  "2": JSON.stringify(
    {
      targetUrl: `https://www.flight.info/ATL/departures/${new Date().toISOString().slice(0, 10)}`,
      origin: "ATL",
      destination: "MIA",
    },
    null,
    2,
  ),
  "3": JSON.stringify({ departureAirport: "ATL", departureDate: new Date().toISOString().slice(0, 10) }, null, 2),
  "4": JSON.stringify(
    { targetUrl: `https://gowilder.net/flights/ATL/MIA/${new Date().toISOString().slice(0, 10)}` },
    null,
    2,
  ),
  "5": JSON.stringify({}, null, 2),
  "6": JSON.stringify({ dep_iata: "ATL", arr_iata: "MIA" }, null, 2),
  "7": JSON.stringify({ dep_iata: "ATL" }, null, 2),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);
const emptyRow = (): KVRow => ({ id: uid(), enabled: true, key: "", value: "", description: "" });

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
function minifyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const KVTable = ({
  rows,
  onChange,
  placeholder = "key",
  valuePlaceholder = "value",
  presets,
}: {
  rows: KVRow[];
  onChange: (rows: KVRow[]) => void;
  placeholder?: string;
  valuePlaceholder?: string;
  presets?: typeof PRESET_HEADERS;
}) => {
  const update = (id: string, field: keyof KVRow, val: string | boolean) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const addRow = () => onChange([...rows, emptyRow()]);
  const addPreset = (p: (typeof PRESET_HEADERS)[0]) => {
    onChange([...rows, { id: uid(), enabled: true, key: p.key, value: p.value, description: "" }]);
  };

  return (
    <div className="space-y-1.5">
      {/* Preset chips */}
      {presets && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => addPreset(p)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-[#C4CACA] text-[#6B7B7B] hover:border-[#345C5A] hover:text-[#345C5A] transition-colors"
            >
              + {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Header row */}
      <div className="grid grid-cols-[16px_1fr_1fr_20px] gap-1.5 px-1 text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider">
        <span />
        <span>{placeholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>

      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[16px_1fr_1fr_20px] gap-1.5 items-center">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => update(row.id, "enabled", e.target.checked)}
            className="accent-[#345C5A] w-3.5 h-3.5 rounded"
          />
          <input
            value={row.key}
            onChange={(e) => update(row.id, "key", e.target.value)}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 rounded-lg border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none focus:border-[#345C5A] bg-[#F8F9F9]"
          />
          <input
            value={row.value}
            onChange={(e) => update(row.id, "value", e.target.value)}
            placeholder={valuePlaceholder}
            className="w-full px-2 py-1.5 rounded-lg border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none focus:border-[#345C5A] bg-[#F8F9F9]"
          />
          <button
            type="button"
            onClick={() => remove(row.id)}
            className="text-[#C4CACA] hover:text-red-400 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={1.5} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-[#345C5A] hover:opacity-70 transition-opacity mt-1"
      >
        <HugeiconsIcon icon={PlusSignIcon} size={11} color="currentColor" strokeWidth={2} />
        Add row
      </button>
    </div>
  );
};

const TabBar = ({ tabs, active, onSelect }: { tabs: string[]; active: string; onSelect: (t: string) => void }) => (
  <div className="flex gap-0 border-b border-[#E3E6E6]">
    {tabs.map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => onSelect(t)}
        className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
          active === t ? "border-[#345C5A] text-[#345C5A]" : "border-transparent text-[#6B7B7B] hover:text-[#2E4A4A]"
        }`}
      >
        {t}
      </button>
    ))}
  </div>
);

// ─── JSON Tree Viewer ─────────────────────────────────────────────────────────

const JsonNode = ({ data, depth = 0 }: { data: unknown; depth?: number }) => {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null) return <span className="text-[#9CA3AF]">null</span>;
  if (typeof data === "boolean") return <span className="text-[#F59E0B]">{String(data)}</span>;
  if (typeof data === "number") return <span className="text-[#3B82F6]">{data}</span>;
  if (typeof data === "string") return <span className="text-[#22C55E]">"{data}"</span>;

  const isArr = Array.isArray(data);
  const entries = isArr
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as Record<string, unknown>);
  const open = isArr ? "[" : "{";
  const close = isArr ? "]" : "}";
  const indent = "  ".repeat(depth);

  if (entries.length === 0)
    return (
      <span className="text-[#6B7B7B]">
        {open}
        {close}
      </span>
    );

  return (
    <span>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="inline text-[#6B7B7B] hover:text-[#345C5A] mr-0.5 font-mono"
      >
        {collapsed ? "▶" : "▼"}
      </button>
      <span className="text-[#6B7B7B]">{open}</span>
      {collapsed ? (
        <span className="text-[#6B7B7B]">
          {" "}
          …{entries.length} {isArr ? "items" : "keys"}{" "}
        </span>
      ) : (
        <>
          {"\n"}
          {entries.map(([k, v], i) => (
            <span key={k}>
              {indent}
              {"  "}
              {!isArr && <span className="text-[#C084FC]">"{k}"</span>}
              {!isArr && <span className="text-[#6B7B7B]">: </span>}
              <JsonNode data={v} depth={depth + 1} />
              {i < entries.length - 1 && <span className="text-[#6B7B7B]">,</span>}
              {"\n"}
            </span>
          ))}
          {indent}
        </>
      )}
      <span className="text-[#6B7B7B]">{close}</span>
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ApiClientScreen = ({ onBack }: ApiClientScreenProps) => {
  // ── Saved requests sidebar
  const [saved, setSaved] = useState<SavedRequest[]>(DEFAULT_SAVED);
  const [activeId, setActiveId] = useState<string | null>("1");
  const [searchQ, setSearchQ] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Request state
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [url, setUrl] = useState(`${SUPABASE_URL}/functions/v1/getSingleRoute`);
  const [queryParams, setQueryParams] = useState<KVRow[]>([emptyRow()]);
  const [headers, setHeaders] = useState<KVRow[]>([
    { id: uid(), enabled: true, key: "Authorization", value: `Bearer ${ANON_KEY}`, description: "" },
    { id: uid(), enabled: true, key: "Content-Type", value: "application/json", description: "" },
    emptyRow(),
  ]);
  const [bodyType, setBodyType] = useState<BodyType>("json");
  const [bodyJson, setBodyJson] = useState(DEFAULT_BODIES["1"] ?? "{}");
  const [bodyRaw, setBodyRaw] = useState("");
  const [bodyFormData, setBodyFormData] = useState<KVRow[]>([emptyRow()]);
  const [bodyUrlEncoded, setBodyUrlEncoded] = useState<KVRow[]>([emptyRow()]);
  const [fileInput, setFileInput] = useState<File | null>(null);

  // ── Auth
  const [authType, setAuthType] = useState<AuthType>("bearer");
  const [bearerToken, setBearerToken] = useState(ANON_KEY);
  const [basicUser, setBasicUser] = useState("");
  const [basicPass, setBasicPass] = useState("");
  const [apiKeyName, setApiKeyName] = useState("X-API-Key");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyIn, setApiKeyIn] = useState<ApiKeyIn>("header");

  // ── Settings
  const [timeout, setTimeout_] = useState(30000);
  const [followRedirects, setFollowRedirects] = useState(true);

  // ── Request panel tab
  const [reqTab, setReqTab] = useState("Params");

  // ── Response
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [resTab, setResTab] = useState("Body");
  const [bodyView, setBodyView] = useState<"pretty" | "raw" | "tree">("pretty");

  // ── Active top-level tab: Request or Response
  const [mainTab, setMainTab] = useState<"Request" | "Response">("Request");

  const abortRef = useRef<AbortController | null>(null);

  // ── Load saved request
  const loadRequest = (req: SavedRequest) => {
    setActiveId(req.id);
    setMethod(req.method);
    setUrl(req.url);
    setBodyJson(DEFAULT_BODIES[req.id] ?? "{}");
    setResponse(null);
  };

  const deleteRequest = (id: string) => {
    setSaved((s) => s.filter((r) => r.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const saveCurrentRequest = () => {
    const name = url.split("/").pop() || "New Request";
    const id = uid();
    const newReq: SavedRequest = { id, name, method, url };
    setSaved((s) => [...s, newReq]);
    setActiveId(id);
    toast.success("Request saved");
  };

  // ── Build final headers for the request
  const buildHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};

    // Auth headers
    if (authType === "bearer" && bearerToken.trim()) {
      h["Authorization"] = `Bearer ${bearerToken.trim()}`;
    } else if (authType === "basic" && basicUser) {
      h["Authorization"] = `Basic ${btoa(`${basicUser}:${basicPass}`)}`;
    } else if (authType === "apikey" && apiKeyIn === "header" && apiKeyName) {
      h[apiKeyName] = apiKeyValue;
    }

    // KV headers (override auth if key conflicts)
    headers
      .filter((r) => r.enabled && r.key.trim())
      .forEach((r) => {
        h[r.key.trim()] = r.value;
      });

    return h;
  }, [authType, bearerToken, basicUser, basicPass, apiKeyName, apiKeyValue, apiKeyIn, headers]);

  // ── Build URL with query params
  const buildUrl = useCallback((): string => {
    const activeParams = queryParams.filter((r) => r.enabled && r.key.trim());

    // Also add apikey-in-query
    const extraParams: KVRow[] = [];
    if (authType === "apikey" && apiKeyIn === "query" && apiKeyName) {
      extraParams.push({ id: "auth-key", enabled: true, key: apiKeyName, value: apiKeyValue, description: "" });
    }

    const all = [...activeParams, ...extraParams];
    if (!all.length) return url;

    const base = url.split("?")[0];
    const qs = all.map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`).join("&");
    return `${base}?${qs}`;
  }, [url, queryParams, authType, apiKeyIn, apiKeyName, apiKeyValue]);

  // ── Build body
  const buildBody = (): { body: BodyInit | null; contentType: string | null } => {
    if (method === "GET" || method === "HEAD" || bodyType === "none") return { body: null, contentType: null };
    if (bodyType === "json") return { body: bodyJson, contentType: "application/json" };
    if (bodyType === "raw") return { body: bodyRaw, contentType: "text/plain" };
    if (bodyType === "urlencoded") {
      const rows = bodyUrlEncoded.filter((r) => r.enabled && r.key.trim());
      const qs = rows.map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`).join("&");
      return { body: qs, contentType: "application/x-www-form-urlencoded" };
    }
    if (bodyType === "form-data") {
      const fd = new FormData();
      bodyFormData.filter((r) => r.enabled && r.key.trim()).forEach((r) => fd.append(r.key, r.value));
      if (fileInput) fd.append("file", fileInput);
      return { body: fd, contentType: null }; // browser sets multipart boundary
    }
    return { body: null, contentType: null };
  };

  // ── Send
  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    setMainTab("Response");

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeout);

    const start = Date.now();
    try {
      const finalUrl = buildUrl();
      const finalHeaders = buildHeaders();
      const { body, contentType } = buildBody();

      // Only set Content-Type from body if not already overridden by headers
      if (contentType && !finalHeaders["Content-Type"] && !finalHeaders["content-type"]) {
        finalHeaders["Content-Type"] = contentType;
      }

      const fetchOptions: RequestInit = {
        method,
        headers: finalHeaders,
        signal: controller.signal,
        redirect: followRedirects ? "follow" : "manual",
      };
      if (body !== null) fetchOptions.body = body;

      const res = await fetch(finalUrl, fetchOptions);
      const timeMs = Date.now() - start;

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      const text = await res.text();
      const sizeBytes = new TextEncoder().encode(text).length;

      let bodyType: "json" | "text" = "text";
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        try {
          JSON.parse(text);
          bodyType = "json";
        } catch {
          /* keep text */
        }
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        timeMs,
        sizeBytes,
        headers: resHeaders,
        body: text,
        bodyType,
      });
      setResTab("Body");
    } catch (err: any) {
      const timeMs = Date.now() - start;
      if (err?.name === "AbortError") {
        setResponse({
          status: 0,
          statusText: "Aborted",
          timeMs,
          sizeBytes: 0,
          headers: {},
          body: "Request was aborted or timed out.",
          bodyType: "text",
        });
      } else {
        setResponse({
          status: 0,
          statusText: "Network Error",
          timeMs,
          sizeBytes: 0,
          headers: {},
          body: err?.message ?? "Unknown error",
          bodyType: "text",
        });
      }
    } finally {
      globalThis.clearTimeout(timeoutId);
      abortRef.current = null;
      setLoading(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    toast.info("Request cancelled");
  };

  // ── Status badge color
  const statusColor = (s: number) => {
    if (s === 0) return "text-[#6B7B7B]";
    if (s < 300) return "text-emerald-600";
    if (s < 400) return "text-amber-500";
    return "text-red-500";
  };

  const filteredSaved = saved.filter(
    (r) => r.name.toLowerCase().includes(searchQ.toLowerCase()) || r.url.toLowerCase().includes(searchQ.toLowerCase()),
  );

  // ── Body display
  const displayBody = (() => {
    if (!response) return "";
    if (response.bodyType === "json" && bodyView === "pretty") return prettyJson(response.body);
    return response.body;
  })();

  let parsedJson: unknown = null;
  if (response?.bodyType === "json") {
    try {
      parsedJson = JSON.parse(response.body);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in bg-[#F2F3F3] overflow-hidden">
      {/* ── URL bar ── */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white rounded-2xl border border-[#E3E6E6] px-2 py-1.5 shadow-sm">
          {/* Method selector */}
          <div className="relative shrink-0">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="appearance-none pl-2 pr-5 py-1.5 rounded-xl bg-[#F2F3F3] text-xs font-black focus:outline-none cursor-pointer border-none"
              style={{ color: METHOD_COLORS[method] }}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>
                  {m}
                </option>
              ))}
            </select>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={9}
              color="#6B7B7B"
              strokeWidth={2}
              className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-[#E3E6E6] shrink-0" />

          {/* URL input */}
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none bg-transparent"
          />

          {/* Send / Cancel */}
          {loading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-1"
              aria-label="Stop request"
              title="Stop request"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={11} color="currentColor" strokeWidth={2} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-[#345C5A] text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center"
              aria-label="Send request"
              title="Send request"
            >
              <HugeiconsIcon icon={PlayIcon} size={12} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ── White group: Request/Response + content (down through "Add row") ── */}
      <div className="px-4 pb-3 flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex flex-col bg-white rounded-2xl border border-[#E3E6E6] shadow-sm overflow-hidden">
          {/* ── Main tab bar: Request | Response + status + SAVE (right-justified) ── */}
          <div className="flex-shrink-0 px-4">
            <div className="flex items-center border-b border-[#E3E6E6]">
              {(["Request", "Response"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMainTab(t)}
                  className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                    mainTab === t
                      ? "border-[#345C5A] text-[#345C5A]"
                      : "border-transparent text-[#6B7B7B] hover:text-[#2E4A4A]"
                  }`}
                >
                  {t}
                </button>
              ))}

              {/* Right side actions */}
              <div className="ml-auto flex items-center gap-3 pr-1">
                {/* Save icon (moved here) */}
                <button
                  type="button"
                  onClick={saveCurrentRequest}
                  className="p-1.5 rounded-lg text-[#6B7B7B] hover:text-[#345C5A] hover:bg-[#F2F3F3] transition-colors"
                  aria-label="Save request"
                  title="Save request"
                >
                  <HugeiconsIcon icon={Time01Icon} size={14} color="currentColor" strokeWidth={1.5} />
                </button>

                {/* Status pill — always visible when response exists */}
                {response && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[#6B7B7B]">Status:</span>
                    <span className={`font-black ${statusColor(response.status)}`}>
                      {response.status === 0 ? response.statusText : response.status}
                    </span>
                    <span className="text-[#6B7B7B]">|</span>
                    <span className="text-[#6B7B7B]">Time:</span>
                    <span className="font-semibold text-[#345C5A]">{response.timeMs} ms</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Content area ── */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* REQUEST tab */}
            {mainTab === "Request" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Sub-tab bar */}
                <div className="px-4 flex-shrink-0 pt-1">
                  <TabBar
                    tabs={["Parameters", "Header", "Body", "Auth", "Settings"]}
                    active={reqTab === "Params" ? "Parameters" : reqTab === "Headers" ? "Header" : reqTab}
                    onSelect={(t) => {
                      if (t === "Parameters") setReqTab("Params");
                      else if (t === "Header") setReqTab("Headers");
                      else setReqTab(t);
                    }}
                  />
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 text-xs">
                  {/* Params */}
                  {reqTab === "Params" && (
                    <KVTable rows={queryParams} onChange={setQueryParams} placeholder="Key" valuePlaceholder="Value" />
                  )}

                  {/* Headers */}
                  {reqTab === "Headers" && (
                    <KVTable
                      rows={headers}
                      onChange={setHeaders}
                      placeholder="Key"
                      valuePlaceholder="Value"
                      presets={PRESET_HEADERS}
                    />
                  )}

                  {/* Body */}
                  {reqTab === "Body" && (
                    <div className="space-y-3">
                      <div className="flex gap-3 flex-wrap">
                        {(["none", "json", "form-data", "urlencoded", "raw"] as BodyType[]).map((bt) => (
                          <label key={bt} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="bodyType"
                              value={bt}
                              checked={bodyType === bt}
                              onChange={() => setBodyType(bt)}
                              className="accent-[#345C5A] w-3 h-3"
                            />
                            <span className="text-xs font-semibold text-[#6B7B7B] capitalize">{bt}</span>
                          </label>
                        ))}
                      </div>

                      {bodyType === "json" && (
                        <div className="relative">
                          <div className="flex gap-1.5 absolute top-2 right-2 z-10">
                            <button
                              type="button"
                              onClick={() => setBodyJson(prettyJson(bodyJson))}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[#E3E6E6] text-[#6B7B7B] hover:bg-[#D6D9D9] transition-colors"
                            >
                              Pretty
                            </button>
                            <button
                              type="button"
                              onClick={() => setBodyJson(minifyJson(bodyJson))}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[#E3E6E6] text-[#6B7B7B] hover:bg-[#D6D9D9] transition-colors"
                            >
                              Minify
                            </button>
                          </div>
                          <textarea
                            value={bodyJson}
                            onChange={(e) => setBodyJson(e.target.value)}
                            rows={10}
                            className="w-full px-3 pt-3 pb-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A] resize-none leading-relaxed"
                          />
                        </div>
                      )}

                      {bodyType === "raw" && (
                        <textarea
                          value={bodyRaw}
                          onChange={(e) => setBodyRaw(e.target.value)}
                          rows={10}
                          placeholder="Raw body content…"
                          className="w-full px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A] resize-none leading-relaxed"
                        />
                      )}

                      {bodyType === "form-data" && (
                        <div className="space-y-3">
                          <KVTable
                            rows={bodyFormData}
                            onChange={setBodyFormData}
                            placeholder="field"
                            valuePlaceholder="value"
                          />
                          <div>
                            <p className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider mb-1">
                              File upload
                            </p>
                            <input
                              type="file"
                              onChange={(e) => setFileInput(e.target.files?.[0] ?? null)}
                              className="text-xs text-[#6B7B7B] file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:bg-[#E3E6E6] file:text-[#2E4A4A] file:font-semibold hover:file:bg-[#D6D9D9] cursor-pointer"
                            />
                            {fileInput && (
                              <p className="text-[10px] text-[#345C5A] mt-1">
                                Selected: {fileInput.name} ({formatBytes(fileInput.size)})
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {bodyType === "urlencoded" && (
                        <KVTable
                          rows={bodyUrlEncoded}
                          onChange={setBodyUrlEncoded}
                          placeholder="key"
                          valuePlaceholder="value"
                        />
                      )}

                      {bodyType === "none" && <p className="text-xs text-[#6B7B7B] py-2">This request has no body.</p>}
                    </div>
                  )}

                  {/* Auth */}
                  {reqTab === "Auth" && (
                    <div className="space-y-3">
                      <div className="flex gap-3 flex-wrap">
                        {(["none", "bearer", "basic", "apikey"] as AuthType[]).map((at) => (
                          <label key={at} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="authType"
                              value={at}
                              checked={authType === at}
                              onChange={() => setAuthType(at)}
                              className="accent-[#345C5A] w-3 h-3"
                            />
                            <span className="text-xs font-semibold text-[#6B7B7B] capitalize">
                              {at === "apikey" ? "API Key" : at}
                            </span>
                          </label>
                        ))}
                      </div>

                      {authType === "bearer" && (
                        <div>
                          <label className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider block mb-1">
                            Bearer Token
                          </label>
                          <input
                            value={bearerToken}
                            onChange={(e) => setBearerToken(e.target.value)}
                            placeholder="Token…"
                            className="w-full px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A]"
                          />
                          <p className="text-[10px] text-[#6B7B7B] mt-1 flex items-center gap-1">
                            <HugeiconsIcon
                              icon={InformationCircleIcon}
                              size={10}
                              color="currentColor"
                              strokeWidth={1.5}
                            />
                            Pre-filled with the project anon key
                          </p>
                        </div>
                      )}

                      {authType === "basic" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider block mb-1">
                              Username
                            </label>
                            <input
                              value={basicUser}
                              onChange={(e) => setBasicUser(e.target.value)}
                              placeholder="username"
                              className="w-full px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider block mb-1">
                              Password
                            </label>
                            <input
                              type="password"
                              value={basicPass}
                              onChange={(e) => setBasicPass(e.target.value)}
                              placeholder="••••••"
                              className="w-full px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A]"
                            />
                          </div>
                        </div>
                      )}

                      {authType === "apikey" && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name="apiKeyIn"
                                value="header"
                                checked={apiKeyIn === "header"}
                                onChange={() => setApiKeyIn("header")}
                                className="accent-[#345C5A] w-3 h-3"
                              />
                              <span className="text-xs font-semibold text-[#6B7B7B]">Header</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name="apiKeyIn"
                                value="query"
                                checked={apiKeyIn === "query"}
                                onChange={() => setApiKeyIn("query")}
                                className="accent-[#345C5A] w-3 h-3"
                              />
                              <span className="text-xs font-semibold text-[#6B7B7B]">Query param</span>
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider block mb-1">
                                Key name
                              </label>
                              <input
                                value={apiKeyName}
                                onChange={(e) => setApiKeyName(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A]"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider block mb-1">
                                Value
                              </label>
                              <input
                                value={apiKeyValue}
                                onChange={(e) => setApiKeyValue(e.target.value)}
                                placeholder="your-api-key"
                                className="w-full px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A]"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {authType === "none" && (
                        <p className="text-xs text-[#6B7B7B] py-2">No authentication will be added to this request.</p>
                      )}
                    </div>
                  )}

                  {/* Settings */}
                  {reqTab === "Settings" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-[#6B7B7B] uppercase tracking-wider block mb-1">
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          value={timeout}
                          onChange={(e) => setTimeout_(Number(e.target.value))}
                          min={1000}
                          max={300000}
                          step={1000}
                          className="w-36 px-3 py-2 rounded-xl border border-[#E3E6E6] text-xs font-mono text-[#2E4A4A] bg-[#F8F9F9] focus:outline-none focus:border-[#345C5A]"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`h-5 w-9 rounded-full relative transition-colors ${followRedirects ? "bg-[#345C5A]" : "bg-[#D1D5D5]"}`}
                          onClick={() => setFollowRedirects((v) => !v)}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${followRedirects ? "translate-x-4" : "translate-x-0.5"}`}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#2E4A4A]">Follow redirects</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RESPONSE tab */}
            {mainTab === "Response" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {loading ? (
                  <div className="flex-1 flex items-center justify-center gap-2 text-[#6B7B7B]">
                    <span className="h-4 w-4 rounded-full border-2 border-[#345C5A] border-t-transparent animate-spin" />
                    <span className="text-sm">Sending…</span>
                  </div>
                ) : !response ? (
                  <div className="flex-1 flex items-center justify-center text-[#C4CACA] text-sm">
                    Hit Send to see the response
                  </div>
                ) : (
                  <>
                    {/* Response meta row */}
                    <div className="px-4 pt-2 pb-0 flex items-center justify-between flex-shrink-0">
                      <span className="text-xs font-bold text-[#2E4A4A]">Response</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6B7B7B]">
                          Time: <span className="font-semibold text-[#345C5A]">{response.timeMs} ms</span>
                        </span>
                        <span className="text-xs text-[#6B7B7B]">{formatBytes(response.sizeBytes)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(response.body);
                            toast.success("Copied");
                          }}
                          className="p-1 rounded hover:bg-[#E3E6E6] transition-colors"
                        >
                          <HugeiconsIcon icon={Copy01Icon} size={12} color="#6B7B7B" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>

                    <div className="px-4 flex-shrink-0 pt-1">
                      <TabBar tabs={["Body", "Headers"]} active={resTab} onSelect={setResTab} />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {resTab === "Headers" && (
                        <div className="px-4 py-3">
                          {Object.entries(response.headers).map(([k, v]) => (
                            <div key={k} className="flex gap-3 py-2 border-b border-[#F0F1F1] last:border-none">
                              <span className="text-xs font-bold text-[#2E4A4A] w-36 shrink-0">{k}</span>
                              <span className="text-xs font-mono text-[#6B7B7B] break-all">{v}</span>
                            </div>
                          ))}
                          {Object.keys(response.headers).length === 0 && (
                            <p className="text-xs text-[#C4CACA] py-4 text-center">No response headers</p>
                          )}
                        </div>
                      )}

                      {resTab === "Body" && (
                        <div className="flex flex-col h-full">
                          {response.bodyType === "json" && (
                            <div className="flex gap-1.5 px-4 pt-3 pb-2 flex-shrink-0">
                              {(["pretty", "raw", "tree"] as const).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setBodyView(v)}
                                  className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors capitalize ${
                                    bodyView === v
                                      ? "bg-[#345C5A] text-white"
                                      : "bg-[#F2F3F3] text-[#6B7B7B] hover:bg-[#E3E6E6]"
                                  }`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex-1 overflow-y-auto px-4 py-2">
                            {bodyView === "tree" && parsedJson !== null ? (
                              <pre className="text-[11px] font-mono text-[#1a3a3a] whitespace-pre leading-relaxed">
                                <JsonNode data={parsedJson} />
                              </pre>
                            ) : (
                              <pre className="text-[11px] font-mono text-[#1a3a3a] whitespace-pre-wrap break-all leading-relaxed">
                                {displayBody}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Collections / History drawer ── */}
      <div className="flex-shrink-0 border-t border-[#E3E6E6] bg-white">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-bold text-[#6B7B7B] hover:bg-[#F8F9F9] transition-colors"
        >
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Time01Icon} size={13} color="currentColor" strokeWidth={1.5} />
            <span>Collections</span>
          </div>
          <HugeiconsIcon
            icon={sidebarOpen ? ArrowDown01Icon : ArrowUp01Icon}
            size={11}
            color="#C4CACA"
            strokeWidth={2}
          />
        </button>

        {sidebarOpen && (
          <div className="border-t border-[#F0F1F1] animate-fade-in">
            {/* Search */}
            <div className="px-4 pt-2 pb-1">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search requests…"
                className="w-full px-3 py-1.5 rounded-lg border border-[#E3E6E6] text-xs text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none bg-[#F8F9F9]"
              />
            </div>

            {/* Grouped request list */}
            <div className="max-h-52 overflow-y-auto pb-2 bg-white">
              {(() => {
                const groups = Array.from(new Set(filteredSaved.map((r) => r.group ?? "Other")));
                return groups.map((groupName) => {
                  const groupRequests = filteredSaved.filter((r) => (r.group ?? "Other") === groupName);
                  return (
                    <div key={groupName} className="bg-white">
                      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#6B7B7B] uppercase tracking-widest">
                          {groupName}
                        </span>
                        <span className="flex-1 h-px bg-[#F0F1F1]" />
                        <span className="text-[10px] text-[#C4CACA]">{groupRequests.length}</span>
                      </div>
                      {groupRequests.map((req) => (
                        <div
                          key={req.id}
                          className={`group flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-[#F2F3F3] transition-colors ${
                            activeId === req.id ? "bg-[#EEF4F4]" : ""
                          }`}
                          onClick={() => {
                            loadRequest(req);
                            setSidebarOpen(false);
                          }}
                        >
                          <span
                            className="text-[10px] font-black w-12 shrink-0"
                            style={{ color: METHOD_COLORS[req.method] }}
                          >
                            {req.method}
                          </span>
                          <span className="text-xs text-[#2E4A4A] truncate flex-1 font-medium">{req.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRequest(req.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-[#C4CACA] hover:text-red-400 transition-all shrink-0"
                          >
                            <HugeiconsIcon icon={Delete01Icon} size={11} color="currentColor" strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiClientScreen;
