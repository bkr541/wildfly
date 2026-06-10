import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  AirplaneTakeOff01Icon,
  ArrowReloadHorizontalIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";
import { DeveloperToolsAdminShell, AdminCard } from "./DeveloperToolsAdminShell";

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
  lastStatus: "ok" | "error" | "unknown";
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
  try {
    return format(parseISO(iso), "MMM d, yyyy h:mm a");
  } catch {
    return iso;
  }
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({ job, stats, loading }: { job: ScheduledJob; stats: JobStats | null; loading: boolean }) {
  const isScheduled = job.type === "scheduled";

  return (
    <AdminCard>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isScheduled ? "rgba(5,150,105,0.1)" : "rgba(107,123,123,0.1)" }}
        >
          <HugeiconsIcon
            icon={job.icon}
            size={20}
            color={isScheduled ? "#059669" : "#6B7B7B"}
            strokeWidth={1.5}
          />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[#1A2E2E]">{job.name}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isScheduled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {isScheduled ? "Scheduled" : "Manual"}
            </span>
          </div>

          <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{job.description}</p>

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

            <div>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Last Status</p>
              {loading ? (
                <div className="mt-0.5 h-3.5 w-16 rounded bg-[#F0F1F1] animate-pulse" />
              ) : stats?.lastStatus === "ok" ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} color="#059669" strokeWidth={2} />
                  <span className="text-xs text-[#059669] font-semibold">Success</span>
                </div>
              ) : stats?.lastStatus === "error" ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <HugeiconsIcon icon={Cancel01Icon} size={13} color="#EF4444" strokeWidth={2} />
                  <span className="text-xs text-[#EF4444] font-semibold">Error</span>
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF] mt-0.5">—</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function ScheduledJobsAdminView() {
  const [statsMap, setStatsMap] = useState<Record<string, JobStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results: Record<string, JobStats> = {};

      await Promise.all(
        JOBS.map(async (job) => {
          const [latestRes, countRes] = await Promise.all([
            (supabase as any)
              .from("flight_searches")
              .select("search_timestamp, triggered_by")
              .eq("triggered_by", job.triggeredBy)
              .order("search_timestamp", { ascending: false })
              .limit(1)
              .maybeSingle(),
            (supabase as any)
              .from("flight_searches")
              .select("id", { count: "exact", head: true })
              .eq("triggered_by", job.triggeredBy),
          ]);

          results[job.id] = {
            lastRunAt: latestRes.data?.search_timestamp ?? null,
            totalRuns: countRes.count ?? 0,
            lastStatus: latestRes.data ? "ok" : "unknown",
          };
        }),
      );

      setStatsMap(results);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load job stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <DeveloperToolsAdminShell
      title="Scheduled Jobs"
      description="All background and scheduled jobs configured within the app."
      actions={
        <button
          onClick={loadStats}
          disabled={loading}
          aria-label="Refresh"
          className="w-8 h-8 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-[#F2F3F3] hover:text-[#2E4A4A] transition-colors disabled:opacity-40"
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} color="currentColor" strokeWidth={2} />
        </button>
      }
      error={error}
    >
      {/* Section label */}
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
            loading={loading}
          />
        ))}
      </div>
    </DeveloperToolsAdminShell>
  );
}
