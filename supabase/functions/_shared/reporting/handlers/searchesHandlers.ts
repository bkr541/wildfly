// ─────────────────────────────────────────────────────────────────────────────
// Handlers and column definitions for the Flight Searches report category.
//
// Timezone contract: the RPC functions accept YYYY-MM-DD date strings plus a
// timezone name. They compute the correct UTC boundaries internally using
// AT TIME ZONE. Handlers must NOT append T00:00:00 or 23:59:59 strings, and
// must NOT compute UTC offsets in JavaScript.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AdminReportExecutionResult,
  ReportColumn,
  ReportHandler,
  ReportSummaryMetric,
} from "../reportTypes.ts";

// ── Shared RPC parameter builder ──────────────────────────────────────────────

function sharedSearchParams(p: Record<string, unknown>) {
  return {
    p_timezone:                typeof p.timezone === "string" ? p.timezone : "America/New_York",
    p_include_system_activity: p.include_system_activity === true,
    p_origin_iata:             typeof p.origin_iata === "string" && p.origin_iata ? p.origin_iata : null,
    p_destination_iata:        typeof p.destination_iata === "string" && p.destination_iata
      ? p.destination_iata
      : null,
    p_result_source:           typeof p.result_source === "string" && p.result_source ? p.result_source : null,
    p_triggered_by:            typeof p.triggered_by === "string" && p.triggered_by ? p.triggered_by : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 1 — searches.volume-over-time
// ─────────────────────────────────────────────────────────────────────────────

export const SEARCHES_VOLUME_COLUMNS: ReportColumn[] = [
  { key: "period_start",           label: "Period",               type: "datetime" },
  { key: "search_count",           label: "Searches",             type: "number" },
  { key: "unique_users",           label: "Unique Users",         type: "number" },
  { key: "gowild_hit_count",       label: "GoWild Hits",          type: "number" },
  { key: "gowild_hit_rate",        label: "GoWild Hit Rate",      type: "percent" },
  { key: "total_flight_results",   label: "Total Results",        type: "number" },
  { key: "average_flight_results", label: "Avg Results",          type: "number" },
  { key: "cache_hit_count",        label: "Cache Hits",           type: "number" },
  { key: "live_search_count",      label: "Live Searches",        type: "number" },
];

export const searchesVolumeHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_searches_volume_over_time",
    {
      p_start_date:  p.start_date as string,
      p_end_date:    p.end_date as string,
      p_granularity: typeof p.granularity === "string" ? p.granularity : "day",
      ...sharedSearchParams(p),
    },
  );

  if (error) throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const totalSearches  = rows.reduce((s, r) => s + (Number(r.search_count)     || 0), 0);
  const totalGowild    = rows.reduce((s, r) => s + (Number(r.gowild_hit_count) || 0), 0);
  const totalCacheHits = rows.reduce((s, r) => s + (Number(r.cache_hit_count)  || 0), 0);

  const overallGowildRate = totalSearches > 0
    ? Math.round(100 * 100 * totalGowild    / totalSearches) / 100
    : null;
  const cacheHitRate = totalSearches > 0
    ? Math.round(100 * 100 * totalCacheHits / totalSearches) / 100
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "total_searches",       label: "Total Searches",      value: totalSearches,    type: "number" },
    { key: "periods",              label: "Periods",             value: rows.length,      type: "number" },
    { key: "overall_gowild_rate",  label: "Overall GoWild Rate", value: overallGowildRate, type: "percent" },
    { key: "cache_hit_rate",       label: "Cache Hit Rate",      value: cacheHitRate,      type: "percent" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "searches.volume-over-time", name: "Search Volume Over Time", category: "Flight Searches", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      SEARCHES_VOLUME_COLUMNS,
    rows,
    chart: {
      type:   "line",
      xKey:   "period_start",
      series: [
        { key: "search_count",     label: "Searches" },
        { key: "gowild_hit_count", label: "GoWild Hits" },
        { key: "unique_users",     label: "Users" },
      ],
    },
    pagination: { page: ctx.page, page_size: ctx.pageSize, total_rows: rows.length, truncated: false },
    duration_ms: 0,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 2 — searches.top-routes
// ─────────────────────────────────────────────────────────────────────────────

export const TOP_ROUTES_COLUMNS: ReportColumn[] = [
  { key: "origin_iata",          label: "Origin",          type: "text" },
  { key: "destination_iata",     label: "Destination",     type: "text" },
  { key: "route",                label: "Route",           type: "text" },
  { key: "search_count",         label: "Searches",        type: "number" },
  { key: "unique_users",         label: "Unique Users",    type: "number" },
  { key: "gowild_hit_count",     label: "GoWild Hits",     type: "number" },
  { key: "gowild_hit_rate",      label: "GoWild Hit Rate", type: "percent" },
  { key: "zero_result_count",    label: "Zero Results",    type: "number" },
  { key: "average_result_count", label: "Avg Results",     type: "number" },
  { key: "last_searched_at",     label: "Last Searched",   type: "datetime" },
];

export const topRoutesHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_searches_top_routes",
    {
      p_start_date:               p.start_date as string,
      p_end_date:                 p.end_date as string,
      p_limit:                    typeof p.limit === "number" ? p.limit : 25,
      p_include_all_destinations: p.include_all_destinations === true,
      ...sharedSearchParams(p),
    },
  );

  if (error) throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const totalSearches = rows.reduce((s, r) => s + (Number(r.search_count)      || 0), 0);
  const totalGowild   = rows.reduce((s, r) => s + (Number(r.gowild_hit_count)  || 0), 0);

  const overallGowildRate = totalSearches > 0
    ? Math.round(100 * 100 * totalGowild / totalSearches) / 100
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "routes_shown",        label: "Routes Shown",       value: rows.length,      type: "number" },
    { key: "total_searches",      label: "Total Searches",     value: totalSearches,    type: "number" },
    { key: "overall_gowild_rate", label: "Overall GoWild Rate", value: overallGowildRate, type: "percent" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "searches.top-routes", name: "Top Search Routes", category: "Flight Searches", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      TOP_ROUTES_COLUMNS,
    rows,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "search_count", label: "Searches" }],
    },
    pagination: { page: ctx.page, page_size: ctx.pageSize, total_rows: rows.length, truncated: false },
    duration_ms: 0,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 3 — searches.zero-results
// ─────────────────────────────────────────────────────────────────────────────

export const ZERO_RESULTS_COLUMNS: ReportColumn[] = [
  { key: "origin_iata",               label: "Origin",              type: "text" },
  { key: "destination_iata",          label: "Destination",         type: "text" },
  { key: "route",                     label: "Route",               type: "text" },
  { key: "total_searches",            label: "Total Searches",      type: "number" },
  { key: "zero_result_searches",      label: "Zero Results",        type: "number" },
  { key: "zero_result_rate",          label: "Zero Result Rate",    type: "percent" },
  { key: "unique_users_affected",     label: "Users Affected",      type: "number" },
  { key: "last_zero_result_at",       label: "Last Zero Result",    type: "datetime" },
  { key: "last_successful_result_at", label: "Last Success",        type: "datetime" },
];

export const zeroResultsHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_searches_zero_results",
    {
      p_start_date:               p.start_date as string,
      p_end_date:                 p.end_date as string,
      p_minimum_searches:         typeof p.minimum_searches === "number" ? p.minimum_searches : 1,
      p_limit:                    typeof p.limit === "number" ? p.limit : 100,
      p_include_all_destinations: p.include_all_destinations === true,
      ...sharedSearchParams(p),
    },
  );

  if (error) throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const totalRoutes      = rows.length;
  const totalZeroSearches = rows.reduce((s, r) => s + (Number(r.zero_result_searches) || 0), 0);
  const totalSearches    = rows.reduce((s, r) => s + (Number(r.total_searches)        || 0), 0);
  const overallZeroRate  = totalSearches > 0
    ? Math.round(100 * 100 * totalZeroSearches / totalSearches) / 100
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "routes_with_zero_results", label: "Routes With Zero Results", value: totalRoutes,      type: "number" },
    { key: "total_zero_searches",      label: "Total Zero-Result Searches", value: totalZeroSearches, type: "number" },
    { key: "overall_zero_rate",        label: "Overall Zero-Result Rate",  value: overallZeroRate,  type: "percent" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "searches.zero-results", name: "Zero-Result Searches", category: "Flight Searches", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      ZERO_RESULTS_COLUMNS,
    rows,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "zero_result_searches", label: "Zero Results" }],
    },
    pagination: { page: ctx.page, page_size: ctx.pageSize, total_rows: rows.length, truncated: false },
    duration_ms: 0,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 4 — searches.source-cache-mix
//
// result_source values: 'live_api', 'scheduled_bulk_search', 'admin_bulk_search',
//                       'cache_hit', 'unknown' (normalized from NULL)
// ─────────────────────────────────────────────────────────────────────────────

export const SOURCE_CACHE_MIX_COLUMNS: ReportColumn[] = [
  { key: "result_source",          label: "Source",           type: "text" },
  { key: "triggered_by",           label: "Triggered By",     type: "text" },
  { key: "search_count",           label: "Searches",         type: "number" },
  { key: "percentage_of_searches", label: "Share",            type: "percent" },
  { key: "gowild_hit_count",       label: "GoWild Hits",      type: "number" },
  { key: "gowild_hit_rate",        label: "GoWild Hit Rate",  type: "percent" },
  { key: "average_result_count",   label: "Avg Results",      type: "number" },
  { key: "latest_search_at",       label: "Latest Search",    type: "datetime" },
];

export const sourceCacheMixHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_searches_source_cache_mix",
    {
      p_start_date: p.start_date as string,
      p_end_date:   p.end_date as string,
      ...sharedSearchParams(p),
    },
  );

  if (error) throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  // Summary cards computed from the returned rows — no second DB round-trip needed.
  const totalSearches = rows.reduce((s, r) => s + (Number(r.search_count)     || 0), 0);
  const totalGowild   = rows.reduce((s, r) => s + (Number(r.gowild_hit_count) || 0), 0);

  const countForSource = (src: string) =>
    rows
      .filter((r) => r.result_source === src)
      .reduce((s, r) => s + (Number(r.search_count) || 0), 0);

  const liveCount   = countForSource("live_api");
  const cacheCount  = countForSource("cache_hit");
  const sysCount    = countForSource("scheduled_bulk_search") + countForSource("admin_bulk_search");

  const pct = (n: number) =>
    totalSearches > 0 ? Math.round(100 * 100 * n / totalSearches) / 100 : null;

  const overallGowildRate = totalSearches > 0
    ? Math.round(100 * 100 * totalGowild / totalSearches) / 100
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "total_searches",           label: "Total Searches",         value: totalSearches,       type: "number" },
    { key: "live_api_pct",             label: "Live API",               value: pct(liveCount),      type: "percent" },
    { key: "cache_hit_pct",            label: "Cache Hit",              value: pct(cacheCount),     type: "percent" },
    { key: "system_pct",               label: "Scheduled / Admin",      value: pct(sysCount),       type: "percent" },
    { key: "overall_gowild_rate",      label: "Overall GoWild Rate",    value: overallGowildRate,   type: "percent" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "searches.source-cache-mix", name: "Search Source & Cache Mix", category: "Flight Searches", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      SOURCE_CACHE_MIX_COLUMNS,
    rows,
    chart: {
      type:   "donut",
      xKey:   "result_source",
      series: [{ key: "search_count", label: "Searches" }],
    },
    pagination: { page: ctx.page, page_size: ctx.pageSize, total_rows: rows.length, truncated: false },
    duration_ms: 0,
  };

  return result;
};
