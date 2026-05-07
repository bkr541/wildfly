import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  UserIcon,
  AirplaneTakeOff01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Search01Icon,
  Cancel01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "dashboard" | "users" | "flights";

interface UserRow {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  signup_type: string;
  last_login: string | null;
  home_airport: string | null;
  home_city: string | null;
  onboarding_complete: string;
  is_discoverable: boolean;
  bio: string | null;
  dob: string | null;
  mobile_number: string | null;
  locations: { name: string; city: string | null; state: string | null; country: string | null } | null;
}

interface FlightRow {
  id: string;
  user_id: string;
  departure_airport: string;
  arrival_airport: string | null;
  departure_date: string;
  return_date: string | null;
  trip_type: string;
  all_destinations: string;
  gowild_found: boolean | null;
  flight_results_count: number | null;
  credits_cost: number | null;
  arrival_airports_count: number | null;
  search_timestamp: string;
  triggered_by: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

const NAV_ITEMS: { id: View; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: Home01Icon },
  { id: "users",     label: "Users",     icon: UserIcon },
  { id: "flights",   label: "Flights",   icon: AirplaneTakeOff01Icon },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(row: UserRow): string {
  const f = row.first_name?.[0] ?? "";
  const l = row.last_name?.[0] ?? "";
  return (f + l).toUpperCase() || row.email[0].toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy h:mm a"); } catch { return iso; }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ row }: { row: UserRow }) {
  const [imgErr, setImgErr] = useState(false);
  if (row.avatar_url && !imgErr) {
    return (
      <img
        src={row.avatar_url}
        alt={initials(row)}
        onError={() => setImgErr(true)}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
      style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
    >
      {initials(row)}
    </div>
  );
}

// ── Users Table ───────────────────────────────────────────────────────────────

function UsersView() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setUsers([]); return; }
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/admin-list-users`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );
        const json = await res.json();
        if (json?.users) setUsers(json.users as UserRow[]);
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) =>
      [u.email, u.first_name, u.last_name, u.username, u.display_name]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageRows   = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={CARD_STYLE}>
        <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9 flex-1 max-w-xs">
          <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search users…"
            className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#6B7B7B]">
              <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
        <span className="text-xs text-[#9CA3AF] ml-auto">{filtered.length} users</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-[#F0F1F1] bg-[#F8F9F9]">
          {["User", "Home Location", "Home Airport", "Signup", "Status", "Last Login"].map((h) => (
            <span key={h} className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Loading users…</div>
        ) : pageRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No users found.</div>
        ) : (
          <div className="divide-y divide-[#F0F1F1]">
            {pageRows.map((u) => (
              <div key={u.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 items-center hover:bg-[#FAFAFA] transition-colors">
                {/* User */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar row={u} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A2E2E] truncate">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.display_name || "—"}
                    </p>
                    <p className="text-xs text-[#9CA3AF] truncate">{u.email}</p>
                    {u.username && <p className="text-[11px] text-[#10B981] truncate">@{u.username}</p>}
                  </div>
                </div>
                {/* Home Location */}
                <div className="min-w-0">
                  <p className="text-sm text-[#2E4A4A] truncate">{u.locations?.name ?? u.home_city ?? "—"}</p>
                  {u.locations?.country && (
                    <p className="text-xs text-[#9CA3AF] truncate">{u.locations.country}</p>
                  )}
                </div>
                {/* Home Airport */}
                <span className="text-sm font-mono font-semibold text-[#345C5A]">{u.home_airport ?? "—"}</span>
                {/* Signup */}
                <span className="text-xs text-[#6B7B7B] capitalize">{u.signup_type}</span>
                {/* Status */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: u.status === "active" ? "#059669" : "#9CA3AF" }}
                  />
                  <span className="text-xs font-medium capitalize" style={{ color: u.status === "active" ? "#059669" : "#9CA3AF" }}>
                    {u.status}
                  </span>
                </div>
                {/* Last Login */}
                <span className="text-xs text-[#9CA3AF]">{fmtDate(u.last_login)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
        )}
      </div>
    </div>
  );
}

// ── Flights Table ─────────────────────────────────────────────────────────────

function FlightsView() {
  const [flights, setFlights]   = useState<FlightRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState("");

  const fetchPage = async (p: number) => {
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, count } = await (supabase.from("flight_searches") as any)
      .select("*", { count: "exact" })
      .order("search_timestamp", { ascending: false })
      .range(from, to);

    setFlights((data ?? []) as FlightRow[]);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchPage(page); }, [page]);

  const filtered = useMemo(() => {
    if (!search.trim()) return flights;
    const q = search.toLowerCase();
    return flights.filter((f) =>
      [f.departure_airport, f.arrival_airport, f.user_id, f.trip_type]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [flights, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={CARD_STYLE}>
        <div className="flex items-center gap-2 bg-[#F2F3F3] rounded-xl px-3 h-9 flex-1 max-w-xs">
          <HugeiconsIcon icon={Search01Icon} size={14} color="#9CA3AF" strokeWidth={2} className="shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter this page…"
            className="flex-1 bg-transparent text-sm text-[#2E4A4A] placeholder:text-[#9CA3AF] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#6B7B7B]">
              <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
        <span className="text-xs text-[#9CA3AF] ml-auto">{total.toLocaleString()} total records</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-2.5 border-b border-[#F0F1F1] bg-[#F8F9F9]">
          {["Route", "Date", "Trip Type", "All Dest", "GoWild", "Results", "Timestamp"].map((h) => (
            <span key={h} className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Loading flights…</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No records found.</div>
        ) : (
          <div className="divide-y divide-[#F0F1F1]">
            {filtered.map((f) => {
              const isAdmin = f.triggered_by === "admin_bulk_search";
              return (
                <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 items-center hover:bg-[#FAFAFA] transition-colors">
                  {/* Route */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div>
                      <p className="text-sm font-bold text-[#1A2E2E] font-mono">
                        {f.departure_airport} → {f.arrival_airport ?? "ALL"}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] truncate max-w-[160px]" title={f.user_id}>
                        {isAdmin
                          ? <span className="text-[#d97706] font-semibold">admin bulk</span>
                          : f.user_id.slice(0, 8) + "…"
                        }
                      </p>
                    </div>
                  </div>
                  {/* Date */}
                  <span className="text-xs text-[#2E4A4A]">{fmtDate(f.departure_date)}</span>
                  {/* Trip Type */}
                  <span className="text-xs text-[#6B7B7B] capitalize">{f.trip_type.replace(/_/g, " ")}</span>
                  {/* All Dest */}
                  <span className="text-xs font-semibold" style={{ color: f.all_destinations === "Yes" ? "#059669" : "#9CA3AF" }}>
                    {f.all_destinations === "Yes" ? "Yes" : "No"}
                  </span>
                  {/* GoWild */}
                  <span className="text-xs font-semibold" style={{ color: f.gowild_found ? "#059669" : "#9CA3AF" }}>
                    {f.gowild_found ? "Yes" : "—"}
                  </span>
                  {/* Results */}
                  <span className="text-xs text-[#6B7B7B]">{f.flight_results_count ?? "—"}</span>
                  {/* Timestamp */}
                  <span className="text-xs text-[#9CA3AF]">{fmtTs(f.search_timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPage={(p) => { setPage(p); }} />
        )}
      </div>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const getPages = () => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 2) pages.push("…");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 3) pages.push("…");
      pages.push(totalPages - 1);
    }
    return pages;
  };

  const btnBase = "h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-colors";

  return (
    <div className="flex items-center justify-center gap-1.5 px-5 py-3 border-t border-[#F0F1F1]">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className={`${btnBase} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        Previous
      </button>
      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="text-xs text-[#9CA3AF] px-1">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            className={`${btnBase} ${
              p === page
                ? "text-white"
                : "border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3]"
            }`}
            style={p === page ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
          >
            {(p as number) + 1}
          </button>
        )
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages - 1}
        className={`${btnBase} border border-[#E8EEEE] text-[#6B7B7B] hover:bg-[#F2F3F3] disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        Next
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard",  subtitle: "Overview of app activity and health." },
  users:     { title: "Users",      subtitle: "All registered users and their profile information." },
  flights:   { title: "Flights",    subtitle: "All flight searches across the platform." },
};

export default function AdminConsole() {
  const [view, setView]               = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { title, subtitle } = VIEW_TITLES[view];

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "linear-gradient(160deg, #F2F3F3 0%, #E8EEEE 100%)" }}
    >
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 border-r border-[#E8EEEE] transition-all duration-300 overflow-hidden"
        style={{
          width: sidebarOpen ? 220 : 68,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        {/* Logo / toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#F0F1F1]">
          {sidebarOpen && (
            <span className="text-2xl font-black tracking-widest uppercase text-[#10B981] select-none flex-1 text-center">
              Console
            </span>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:bg-[#F2F3F3] transition-colors flex-shrink-0 ${!sidebarOpen ? "mx-auto" : ""}`}
          >
            <HugeiconsIcon
              icon={sidebarOpen ? ArrowLeft01Icon : ArrowRight01Icon}
              size={15}
              color="currentColor"
              strokeWidth={2.5}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 pt-3">
          {NAV_ITEMS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-left ${
                  active ? "text-white" : "text-[#6B7280] hover:bg-[#F2F3F3] hover:text-[#2E4A4A]"
                }`}
                style={active ? { background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" } : undefined}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  size={17}
                  color={active ? "white" : "currentColor"}
                  strokeWidth={2}
                  className="flex-shrink-0"
                />
                {sidebarOpen && (
                  <span className="text-sm font-semibold truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 p-6 gap-5">
        {/* Page header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={view + "-header"}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h1 className="text-2xl font-black text-[#1A2E2E] tracking-tight">{title}</h1>
            <p className="text-sm text-[#6B7B7B] mt-0.5">{subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {/* View content */}
        <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex flex-col gap-4 flex-1"
        >
        {view === "dashboard" && (
          <div
            className="rounded-2xl flex-1 flex items-center justify-center"
            style={{ ...CARD_STYLE, minHeight: 300 }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-1">
                <HugeiconsIcon icon={Home01Icon} size={22} color="#059669" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-[#2E4A4A]">Dashboard coming soon</p>
              <p className="text-sm text-[#9CA3AF]">App metrics and activity will appear here.</p>
            </div>
          </div>
        )}

        {view === "users"   && <UsersView />}
        {view === "flights" && <FlightsView />}
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
