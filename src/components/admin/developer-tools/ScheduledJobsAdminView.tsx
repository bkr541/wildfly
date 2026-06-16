import { useState, useEffect, useCallback } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  AirplaneTakeOff01Icon,
  ArrowReloadHorizontalIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Alert01Icon,
  ArrowDown01Icon,
  Analytics01Icon,
  Notification01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { DeveloperToolsAdminShell, AdminCard } from "./DeveloperToolsAdminShell";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  triggeredBy: string;
  type: "scheduled" | "manual";
  icon: any;
}

interface JobStats {
  lastRunAt: string | null;
  totalRuns: number;
  lastStatus: "ok" | "error" | "running" | "unknown";
}

interface BulkSearchJobLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  triggered_by: string;
  airports_total: number;
  airports_succeeded: number;
  airports_failed: number;
  gowild_found_count: number;
  duration_ms: number | null;
  error_message: string | null;
  target_date: string;
  timezone_group: string;
}

interface JobNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  notification_group: string;
}

// ── Static job registry ───────────────────────────────────────────────────────

const JOBS: ScheduledJob[] = [
  {
    id: "scheduled_bulk_search",
    name: "Scheduled Flight Bulk Search",
    description:
      "Automatically runs an all-destinations flight search for every active airport. Populates the flight search cache and writes GoWild snapshots.",
    triggeredBy: "scheduled_bulk_search",
    type: "scheduled",
    icon: AirplaneTakeOff01Icon,
  },
  {
    id: "admin_bulk_search",
    name: "Admin Bulk Search",
    description:
      "Manually triggered all-destinations bulk search run from the Admin Console. Supports date selection, domestic-only, and timezone-optimized scoping.",
    triggeredBy: "admin_bulk_search",
    type: "manual",
    icon: AirplaneTakeOff01Icon,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTs(iso: string | null): string {
  if (!iso) return "Never";
  try { return format(parseISO(iso), "MMM d, yyyy h:mm a"); } catch { return iso; }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function fmtAgo(iso: string): string {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); } catch { return ""; }
}

type NormStatus = "running" | "ok" | "error" | "unknown";

function normalizeStatus(raw: string | null | undefined): NormStatus {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (s === "running" || s === "in_progress") return "running";
  if (s === "completed" || s === "success" || s === "ok") return "ok";
  if (s === "failed" || s === "error") return "error";
  return "unknown";
}

function isStuckRunning(log: BulkSearchJobLog): boolean {
  if (normalizeStatus(log.status) !== "running") return false;
  try {
    const ageMs = Date.now() - parseISO(log.started_at).getTime();
    return ageMs > 30 * 60 * 1000; // > 30 min
  } catch { return false; }
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, size = "md" }: { status: NormStatus; size?: "sm" | "md" }) {
  const sm = size === "sm";
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full font-semibold border",
    sm ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
  );

  if (status === "running") {
    return (
      <span className={cn(base, "bg-amber-50 text-amber-700 border-amber-200")}>
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        Running
      </span>
    );
  }

  if (status === "ok") {
    return (
      <span className={cn(base, "bg-emerald-50 text-emerald-700 border-emerald-200")}>
        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={sm ? 11 : 13} color="currentColor" strokeWidth={2} />
        Completed
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={cn(base, "bg-red-50 text-red-600 border-red-200")}>
        <HugeiconsIcon icon={Cancel01Icon} size={sm ? 11 : 13} color="currentColor" strokeWidth={2} />
        Failed
      </span>
    );
  }

  return null;
}

// ── Notifications panel ───────────────────────────────────────────────────────

function NotificationsPanel({ notifications }: { notifications: JobNotification[] }) {
  const [open, setOpen] = useState(false);

  if (notifications.length === 0) return null;

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="mt-3 pt-3 border-t border-[#F0F1F1]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7B7B] hover:text-[#2E4A4A] transition-colors w-full text-left"
      >
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={13}
          color="currentColor"
          strokeWidth={2.5}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
        <HugeiconsIcon icon={Notification01Icon} size={13} color="currentColor" strokeWidth={2} />
        System Alerts
        {unread > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold border border-amber-200">
            {unread} unread
          </span>
        )}
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#F0F1F1] text-[#9CA3AF] text-[9px] font-bold">
          {notifications.length}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 mt-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                "rounded-xl px-3 py-2.5 border flex items-start gap-2.5",
                notif.is_read
                  ? "bg-[#F8F9F9] border-[#F0F1F1]"
                  : "bg-amber-50 border-amber-200",
              )}
            >
              <HugeiconsIcon
                icon={Alert01Icon}
                size={14}
                color={notif.is_read ? "#9CA3AF" : "#D97706"}
                strokeWidth={2}
                className="flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className={cn("text-xs font-semibold", notif.is_read ? "text-[#6B7B7B]" : "text-amber-800")}>
                    {notif.title}
                  </p>
                  <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{fmtAgo(notif.created_at)}</span>
                </div>
                {notif.body && (
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">{notif.body}</p>
                )}
              </div>
              {!notif.is_read && (
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Job run history ───────────────────────────────────────────────────────────

function JobRunHistory({ logs, loading }: { logs: BulkSearchJobLog[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-[#F0F1F1]">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-[#F2F3F3] animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="pt-4 mt-3 border-t border-[#F0F1F1] text-xs text-[#9CA3AF] text-center pb-1">
        No runs recorded yet.
      </div>
    );
  }

  return (
    <div className="pt-3 mt-3 border-t border-[#F0F1F1] flex flex-col gap-2">
      {logs.map((log) => {
        const norm = normalizeStatus(log.status);
        const stuck = isStuckRunning(log);
        const hasFailed = log.airports_failed > 0;

        return (
          <div
            key={log.id}
            className={cn(
              "rounded-xl px-4 py-3 border",
              stuck
                ? "bg-red-50/60 border-red-300"
                : norm === "running"
                ? "bg-amber-50/60 border-amber-200"
                : norm === "error"
                ? "bg-red-50/60 border-red-200"
                : "bg-[#F8F9F9] border-[#F0F1F1]",
            )}
          >
            {/* Top row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={norm} size="sm" />
                {stuck && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                    <HugeiconsIcon icon={Alert01Icon} size={10} color="currentColor" strokeWidth={2} />
                    Stuck
                  </span>
                )}
                <span className="text-xs font-semibold text-[#2E4A4A]">{fmtTs(log.started_at)}</span>
                {log.timezone_group && (
                  <span className="text-[10px] text-[#9CA3AF] font-mono bg-[#F0F1F1] px-1.5 py-0.5 rounded">
                    {log.timezone_group}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {log.duration_ms != null && (
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon icon={Clock01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
                    <span className="text-[11px] text-[#9CA3AF]">{fmtDuration(log.duration_ms)}</span>
                  </div>
                )}
                {log.target_date && (
                  <span className="text-[11px] text-[#9CA3AF]">→ {fmtDate(log.target_date)}</span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
                <span className={cn("text-[11px] font-semibold", hasFailed ? "text-red-600" : "text-[#059669]")}>
                  {log.airports_succeeded}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">/ {log.airports_total} airports</span>
                {hasFailed && (
                  <span className="text-[11px] font-semibold text-red-500">
                    ({log.airports_failed} failed)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Analytics01Icon} size={11} color="#9CA3AF" strokeWidth={2} />
                <span className="text-[11px] font-semibold text-[#2E4A4A]">
                  {log.gowild_found_count.toLocaleString()}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">GoWild found</span>
              </div>
            </div>

            {/* Error message */}
            {log.error_message && (
              <div className="mt-2 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <HugeiconsIcon icon={Alert01Icon} size={12} color="#EF4444" strokeWidth={2} className="flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-600 font-medium break-all leading-relaxed">
                  {log.error_message}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  stats,
  logs,
  notifications,
  loading,
  logsLoading,
}: {
  job: ScheduledJob;
  stats: JobStats | null;
  logs: BulkSearchJobLog[];
  notifications: JobNotification[];
  loading: boolean;
  logsLoading: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const isScheduled = job.type === "scheduled";

  const lastStatusNorm = stats?.lastStatus ?? "unknown";
  const isRunning = lastStatusNorm === "running";
  const isError = lastStatusNorm === "error";
  const hasData = (stats?.totalRuns ?? 0) > 0;

  const stuckLog = logs.find(isStuckRunning);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AdminCard
      style={
        stuckLog
          ? { borderColor: "rgba(239,68,68,0.4)", background: "rgba(255,241,242,0.92)" }
          : isRunning
          ? { borderColor: "rgba(245,158,11,0.4)", background: "rgba(255,251,235,0.92)" }
          : isError && hasData
          ? { borderColor: "rgba(239,68,68,0.25)", background: "rgba(255,241,242,0.88)" }
          : undefined
      }
    >
      <div className="flex items-start gap-4">
        {/* Icon with optional live pulse ring */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
          style={{ background: isScheduled ? "rgba(5,150,105,0.1)" : "rgba(107,123,123,0.1)" }}
        >
          <HugeiconsIcon
            icon={job.icon}
            size={20}
            color={isScheduled ? "#059669" : "#6B7B7B"}
            strokeWidth={1.5}
          />
          {isRunning && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white" />
            </span>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[#1A2E2E]">{job.name}</h3>
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              isScheduled
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200",
            )}>
              {isScheduled ? "Scheduled" : "Manual"}
            </span>
            {/* Live status badge — only when there's actual data */}
            {!loading && hasData && <StatusBadge status={lastStatusNorm} size="sm" />}
            {/* Notification bell with unread count */}
            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <HugeiconsIcon icon={Notification01Icon} size={11} color="currentColor" strokeWidth={2} />
                {unreadCount}
              </span>
            )}
          </div>

          <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{job.description}</p>

          {/* Stuck banner */}
          {stuckLog && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <p className="text-xs font-semibold text-red-700">
                Job has been running for over 30 minutes — may be stuck.
                Started {fmtAgo(stuckLog.started_at)}.
              </p>
            </div>
          )}

          {/* Metadata row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <div>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Trigger Key</p>
              <p className="text-xs font-mono text-[#2E4A4A] mt-0.5">{job.triggeredBy}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Last Run</p>
              {loading ? (
                <div className="mt-0.5 h-3.5 w-28 rounded bg-[#F0F1F1] animate-pulse" />
              ) : (
                <p className="text-xs text-[#2E4A4A] mt-0.5">{fmtTs(stats?.lastRunAt ?? null)}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Total Runs</p>
              {loading ? (
                <div className="mt-0.5 h-3.5 w-10 rounded bg-[#F0F1F1] animate-pulse" />
              ) : (
                <p className="text-xs text-[#2E4A4A] mt-0.5">
                  {stats?.totalRuns != null ? stats.totalRuns.toLocaleString() : "—"}
                </p>
              )}
            </div>
          </div>

          {/* Notifications */}
          <NotificationsPanel notifications={notifications} />

          {/* Recent runs toggle — always shown */}
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#6B7B7B] hover:text-[#2E4A4A] transition-colors"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={13}
              color="currentColor"
              strokeWidth={2.5}
              style={{
                transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
            {historyOpen ? "Hide" : "Show"} recent runs
            {!logsLoading && logs.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#F0F1F1] text-[#9CA3AF] text-[9px] font-bold">
                {logs.length}
              </span>
            )}
          </button>

          {historyOpen && <JobRunHistory logs={logs} loading={logsLoading} />}
        </div>
      </div>
    </AdminCard>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function ScheduledJobsAdminView() {
  const [statsMap, setStatsMap]         = useState<Record<string, JobStats>>({});
  const [logsMap, setLogsMap]           = useState<Record<string, BulkSearchJobLog[]>>({});
  const [notifsMap, setNotifsMap]       = useState<Record<string, JobNotification[]>>({});
  const [loading, setLoading]           = useState(true);
  const [logsLoading, setLogsLoading]   = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLogsLoading(true);
    setError(null);

    try {
      const results: Record<string, JobStats>              = {};
      const logResults: Record<string, BulkSearchJobLog[]> = {};
      const notifResults: Record<string, JobNotification[]> = {};

      // ── Load job logs (fetch all, partition by triggered_by in JS) ───────────
      const { data: allLogs } = await (supabase as any)
        .from("bulk_search_job_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);

      const allLogRows: BulkSearchJobLog[] = allLogs ?? [];

      for (const job of JOBS) {
        // Match by triggered_by exact value OR by contains (edge-function defaults may differ)
        const jobLogs = allLogRows
          .filter((l) =>
            l.triggered_by === job.triggeredBy ||
            (l.triggered_by ?? "").toLowerCase().includes(job.triggeredBy.replace(/_/g, "").slice(0, 8))
          )
          .slice(0, 10);

        logResults[job.id] = jobLogs;

        const latest = jobLogs[0] ?? null;
        const norm = normalizeStatus(latest?.status ?? null);

        results[job.id] = {
          lastRunAt: latest?.started_at ?? null,
          totalRuns: jobLogs.length,
          lastStatus: norm,
        };
      }

      // If no job matched any log via triggered_by, fall back: assign all to scheduled job
      const totalMatched = Object.values(logResults).reduce((s, l) => s + l.length, 0);
      if (totalMatched === 0 && allLogRows.length > 0) {
        const scheduledJob = JOBS.find((j) => j.type === "scheduled")!;
        logResults[scheduledJob.id] = allLogRows.slice(0, 10);
        const latest = allLogRows[0];
        results[scheduledJob.id] = {
          lastRunAt: latest.started_at,
          totalRuns: allLogRows.length,
          lastStatus: normalizeStatus(latest.status),
        };
      }

      setStatsMap(results);
      setLogsMap(logResults);
      setLoading(false);
      setLogsLoading(false);

      // ── Trigger notification for any stuck running job ─────────────────────
      const hasRunning = Object.values(logResults)
        .flat()
        .some((l) => normalizeStatus(l.status) === "running");

      if (hasRunning) {
        await (supabase as any).rpc("notify_bulk_search_issues");
      }

      // ── Load notifications ─────────────────────────────────────────────────
      const { data: allNotifs } = await (supabase as any)
        .from("notifications")
        .select("id, type, title, body, data, is_read, created_at, notification_group")
        .order("created_at", { ascending: false })
        .limit(50);

      const notifRows: JobNotification[] = allNotifs ?? [];

      // Partition notifications to each job by matching data.triggered_by or type keywords
      for (const job of JOBS) {
        notifResults[job.id] = notifRows.filter((n) => {
          const d = n.data as Record<string, unknown> | null;
          if (d?.triggered_by === job.triggeredBy) return true;
          if (d?.job_id && typeof d.job_id === "string") {
            const jobLogIds = (logResults[job.id] ?? []).map((l) => l.id);
            if (jobLogIds.includes(d.job_id)) return true;
          }
          const searchKey = job.triggeredBy.replace(/_/g, " ");
          const combined = `${n.type ?? ""} ${n.title ?? ""} ${n.body ?? ""}`.toLowerCase();
          return combined.includes("bulk_search") || combined.includes(searchKey);
        });
      }

      setNotifsMap(notifResults);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load job stats");
      setLoading(false);
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <DeveloperToolsAdminShell
      title="Scheduled Jobs"
      description="All background and scheduled jobs configured within the app."
      actions={
        <button
          onClick={loadAll}
          disabled={loading}
          aria-label="Refresh"
          className="w-8 h-8 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors disabled:opacity-40"
        >
          <HugeiconsIcon
            icon={ArrowReloadHorizontalIcon}
            size={16}
            color="currentColor"
            strokeWidth={2}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      }
      error={error}
    >
      <div className="flex items-center gap-2.5 mb-1">
        <HugeiconsIcon icon={Clock01Icon} size={14} color="#9CA3AF" strokeWidth={2} />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
          {JOBS.length} job{JOBS.length !== 1 ? "s" : ""} configured
        </span>
        <div className="flex-1 h-px bg-[#EEF0F0]" />
      </div>

      <div className="flex flex-col gap-3">
        {JOBS.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            stats={statsMap[job.id] ?? null}
            logs={logsMap[job.id] ?? []}
            notifications={notifsMap[job.id] ?? []}
            loading={loading}
            logsLoading={logsLoading}
          />
        ))}
      </div>
    </DeveloperToolsAdminShell>
  );
}
