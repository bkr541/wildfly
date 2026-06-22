// ─────────────────────────────────────────────────────────────────────────────
// TanStack Query hooks for Admin Reporting.
//
// Design decisions:
//
// useReportDefinitions — useQuery, stale after 5m, no focus refetch.
//
// useRunReport — useMutation for explicit user-triggered execution.
//   - "Run Report" button calls run(params); no auto-execution.
//   - Stores the last successful result in a ref so that callers receive the
//     previous result while a re-run is in progress (isRefetching=true).
//   - Race-condition guard: a sequence counter in a ref ensures that if
//     multiple runs are dispatched concurrently, only the result from the
//     most recently-dispatched run is kept. Earlier responses are silently
//     discarded.
//   - onSuccess invalidates report run history so the history list reflects
//     the new completed run without a manual refresh.
//
// useReportRuns — useQuery, stale after 30s, no focus refetch, paginated.
//
// useLogReportExport — useMutation; invalidates run history on success so
//   the export audit event appears in the history list.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import * as adminReporting from "@/services/adminReporting";
import type {
  ExportFormat,
  ListReportsResult,
  ListRunsParams,
  ListRunsResult,
  ReportExportRecord,
  ReportResult,
  ReportRunParams,
} from "@/components/admin/reporting/reportingTypes";
import { AdminReportingError } from "@/components/admin/reporting/reportingTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Query key factory
// ─────────────────────────────────────────────────────────────────────────────

export const reportingKeys = {
  all:         ["adminReporting"] as const,
  definitions: () => [...reportingKeys.all, "definitions"] as const,
  runs:        (filters?: ListRunsParams) =>
    [...reportingKeys.all, "runs", filters ?? {}] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook 1: useReportDefinitions
//
// Fetches the list of active, callable report definitions.
// Cached for 5 minutes. Suitable for populating a report picker menu.
// ─────────────────────────────────────────────────────────────────────────────

export function useReportDefinitions(): UseQueryResult<ListReportsResult, Error> {
  return useQuery({
    queryKey:          reportingKeys.definitions(),
    queryFn:           adminReporting.listReports,
    staleTime:         5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 2: useRunReport
//
// Manual, user-triggered report execution. Provides:
//   run(params)   — dispatch a new report execution
//   retry()       — rerun with the same parameters (after an error)
//   data          — the most recently successful result (preserved during
//                   re-runs so the UI is not blanked while loading)
//   isRunning     — true while a run is in-flight
//   isRefetching  — alias for isRunning when previous data exists
//   error         — the most recent error (cleared on next successful run)
//   lastRunId     — run_id from the most recent completed result
//
// Race-condition guard:
//   A monotonically-increasing sequence counter ensures that if the user
//   triggers two runs before the first completes, only the second run's
//   result is applied. The first response is discarded when it arrives after
//   the counter has advanced.
// ─────────────────────────────────────────────────────────────────────────────

export interface RunReportState {
  run:          (params: ReportRunParams) => void;
  retry:        () => void;
  data:         ReportResult | null;
  isRunning:    boolean;
  isRefetching: boolean;
  error:        Error | null;
  isSuccess:    boolean;
  lastRunId:    string | null;
}

export function useRunReport(
  slug: string,
  opts?: {
    page?:      number;
    page_size?: number;
  },
): RunReportState {
  const queryClient    = useQueryClient();
  const sequenceRef    = useRef(0);
  const lastParamsRef  = useRef<ReportRunParams | null>(null);
  const [lastResult, setLastResult]   = useState<ReportResult | null>(null);
  const [lastRunId, setLastRunId]     = useState<string | null>(null);

  const mutation = useMutation<ReportResult, Error, ReportRunParams>({
    mutationFn: async (params: ReportRunParams) => {
      // Advance the sequence counter for this invocation.
      const mySeq = ++sequenceRef.current;

      const result = await adminReporting.runReport(slug, params, {
        page:      opts?.page,
        page_size: opts?.page_size,
      });

      // Discard if a newer run was dispatched while this one was in-flight.
      if (mySeq !== sequenceRef.current) {
        throw new AdminReportingError(
          "SERVER_ERROR",
          "SUPERSEDED",
        );
      }

      return result;
    },

    onSuccess: (result) => {
      setLastResult(result);
      setLastRunId(result.run_id ?? null);
      // Refresh run history so the completed row appears immediately.
      queryClient.invalidateQueries({ queryKey: reportingKeys.runs() });
    },

    onError: (err) => {
      // Silently drop superseded results — they are not real errors.
      if (err instanceof AdminReportingError && err.message === "SUPERSEDED") {
        return;
      }
    },
  });

  const run = useCallback(
    (params: ReportRunParams) => {
      lastParamsRef.current = params;
      mutation.mutate(params);
    },
    [mutation],
  );

  const retry = useCallback(() => {
    if (lastParamsRef.current !== null) {
      mutation.mutate(lastParamsRef.current);
    }
  }, [mutation]);

  const isSupersededError =
    mutation.error instanceof AdminReportingError &&
    mutation.error.message === "SUPERSEDED";

  // Expose data: keep the previous successful result visible while re-running.
  const data = mutation.isPending
    ? lastResult
    : (mutation.data ?? lastResult);

  return {
    run,
    retry,
    data,
    isRunning:    mutation.isPending,
    isRefetching: mutation.isPending && lastResult !== null,
    error:        isSupersededError ? null : (mutation.error ?? null),
    isSuccess:    mutation.isSuccess || lastResult !== null,
    lastRunId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 3: useReportRuns
//
// Paginated report run history. Stale after 30 seconds.
// Invalidated after a report completes or an export is audited.
// ─────────────────────────────────────────────────────────────────────────────

export function useReportRuns(
  filters?: ListRunsParams,
): UseQueryResult<ListRunsResult, Error> {
  return useQuery({
    queryKey:             reportingKeys.runs(filters),
    queryFn:              () => adminReporting.listReportRuns(filters),
    staleTime:            30_000,
    refetchOnWindowFocus: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 4: useLogReportExport
//
// Records an export event for a completed report run.
// Invalidates run history on success so the audit event appears immediately.
// ─────────────────────────────────────────────────────────────────────────────

export function useLogReportExport() {
  const queryClient = useQueryClient();
  return useMutation<
    ReportExportRecord,
    Error,
    { run_id: string; format: ExportFormat; row_count: number }
  >({
    mutationFn: adminReporting.logReportExport,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: reportingKeys.runs() });
    },
  });
}
