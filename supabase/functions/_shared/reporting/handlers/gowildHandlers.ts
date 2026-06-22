// ─────────────────────────────────────────────────────────────────────────────
// Handlers and column definitions for the GoWild Availability report category.
//
// All aggregation is performed in Postgres via SECURITY DEFINER RPCs that
// query the canonical observation views (admin_reporting_gowild_observations,
// admin_reporting_route_observations). No JS-side aggregation of raw rows.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AdminReportExecutionResult,
  ReportColumn,
  ReportHandler,
  ReportSummaryMetric,
} from "../reportTypes.ts";

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 1 — gowild.route-reliability
//
// Metric definitions (mirrored from the RPC comments):
//   raw_hit_rate              — 100 × successful_observations / search_observations
//   confidence_adjusted_score — Wilson lower confidence bound, 95% CI, 0–100
//
// Interpretation helper text is included in the column definitions so that
// the UI can surface it in tooltips or column headers.
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_RELIABILITY_COLUMNS: ReportColumn[] = [
  { key: "origin_iata",               label: "Origin",          type: "text" },
  { key: "destination_iata",          label: "Destination",     type: "text" },
  { key: "route",                     label: "Route",           type: "text" },
  { key: "search_observations",       label: "Observations",    type: "number" },
  { key: "successful_observations",   label: "Successes",       type: "number" },
  { key: "unsuccessful_observations", label: "Failures",        type: "number" },
  {
    key:   "raw_hit_rate",
    label: "Raw Hit Rate",
    type:  "percent",
    // Raw percentage: useful for context but can mislead with small samples.
  },
  {
    key:   "confidence_adjusted_score",
    label: "Confidence Score",
    type:  "percent",
    // Wilson lower bound at 95% CI. Prefer this for ranking: it penalises
    // routes with few observations, preventing them from outranking
    // well-observed routes with slightly lower raw rates.
  },
  { key: "unique_travel_dates",  label: "Unique Dates",    type: "number" },
  { key: "latest_observed_at",   label: "Last Observed",   type: "datetime" },
];

export const routeReliabilityHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_gowild_route_reliability",
    {
      p_date_from:              p.start_date as string,
      p_date_to:                p.end_date as string,
      p_origin_iata:            typeof p.origin_iata === "string" && p.origin_iata
        ? p.origin_iata : null,
      p_destination_iata:       typeof p.destination_iata === "string" && p.destination_iata
        ? p.destination_iata : null,
      p_minimum_observations:   typeof p.minimum_observations === "number"
        ? p.minimum_observations : 10,
      p_limit:                  typeof p.limit === "number" ? p.limit : 25,
      p_include_admin_bulk:     p.include_admin_bulk !== false,
      p_include_scheduled_bulk: p.include_scheduled_bulk !== false,
      p_include_user_searches:  p.include_user_searches !== false,
    },
  );

  if (error) throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const totalObs     = rows.reduce((s, r) => s + (Number(r.search_observations)     || 0), 0);
  const totalSuccess = rows.reduce((s, r) => s + (Number(r.successful_observations) || 0), 0);
  const bestScore    = rows.length > 0
    ? Math.max(...rows.map((r) => Number(r.confidence_adjusted_score) || 0))
    : null;
  const overallRate  = totalObs > 0
    ? Math.round(100 * 100 * totalSuccess / totalObs) / 100
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "routes_analyzed",          label: "Routes Analyzed",       value: rows.length,   type: "number" },
    { key: "total_observations",       label: "Total Observations",    value: totalObs,      type: "number" },
    { key: "best_confidence_score",    label: "Best Confidence Score", value: bestScore,     type: "percent" },
    { key: "overall_raw_success_rate", label: "Overall Raw Success",   value: overallRate,   type: "percent" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "gowild.route-reliability", name: "Most Reliable GoWild Routes", category: "GoWild Availability", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      ROUTE_RELIABILITY_COLUMNS,
    rows,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "confidence_adjusted_score", label: "Confidence Score" }],
    },
    pagination: { page: ctx.page, page_size: ctx.pageSize, total_rows: rows.length, truncated: false },
    duration_ms: 0,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 2 — gowild.disappeared-itineraries
// ─────────────────────────────────────────────────────────────────────────────

export const DISAPPEARED_ITINERARIES_COLUMNS: ReportColumn[] = [
  // stable_itinerary_key is hidden by default — available for export/debug.
  { key: "stable_itinerary_key",      label: "Itinerary Key",        type: "text",     hiddenByDefault: true },
  { key: "route",                     label: "Route",                type: "text" },
  { key: "airline",                   label: "Airline",              type: "text" },
  { key: "flight_number",             label: "Flight",               type: "text" },
  { key: "departure_at",              label: "Departure",            type: "datetime" },
  { key: "arrival_at",               label: "Arrival",              type: "datetime" },
  { key: "last_available_at",         label: "Last Available",       type: "datetime" },
  { key: "disappeared_at",           label: "Disappeared At",       type: "datetime" },
  { key: "prior_available_seats",    label: "Prior Seats",          type: "number" },
  { key: "prior_gowild_fare",        label: "Prior GoWild Fare",    type: "currency" },
  { key: "prior_standard_fare",      label: "Prior Standard Fare",  type: "currency" },
  { key: "prior_savings",            label: "Prior Savings",        type: "currency" },
  { key: "disappearance_event_count", label: "Events",              type: "number" },
  { key: "result_source",            label: "Source",               type: "text" },
];

export const disappearedItinerariesHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_gowild_disappeared_itineraries",
    {
      p_date_from:         p.start_date as string,
      p_date_to:           p.end_date as string,
      p_origin_iata:       typeof p.origin_iata === "string" && p.origin_iata
        ? p.origin_iata : null,
      p_destination_iata:  typeof p.destination_iata === "string" && p.destination_iata
        ? p.destination_iata : null,
      p_limit:             typeof p.limit === "number" ? p.limit : 100,
      p_latest_event_only: p.latest_event_only !== false,
    },
  );

  if (error) throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const totalEvents     = rows.reduce((s, r) => s + (Number(r.disappearance_event_count) || 0), 0);
  const routesAffected  = new Set(rows.map((r) => r.route as string)).size;
  const mostRecent      = rows.length > 0
    ? rows.reduce((latest, r) => {
        const t = String(r.disappeared_at ?? "");
        return t > latest ? t : latest;
      }, "")
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "unique_itineraries",   label: "Unique Disappeared", value: rows.length,  type: "number" },
    { key: "total_events",         label: "Total Events",       value: totalEvents,  type: "number" },
    { key: "routes_affected",      label: "Routes Affected",    value: routesAffected, type: "number" },
    { key: "most_recent_event",    label: "Most Recent",        value: mostRecent,   type: "datetime" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "gowild.disappeared-itineraries", name: "Disappeared Itineraries", category: "GoWild Availability", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      DISAPPEARED_ITINERARIES_COLUMNS,
    rows,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "disappearance_event_count", label: "Events" }],
    },
    pagination: { page: ctx.page, page_size: ctx.pageSize, total_rows: rows.length, truncated: false },
    duration_ms: 0,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 3 — gowild.fare-savings-by-route
// ─────────────────────────────────────────────────────────────────────────────

export const FARE_SAVINGS_COLUMNS: ReportColumn[] = [
  { key: "origin_iata",              label: "Origin",              type: "text" },
  { key: "destination_iata",         label: "Destination",         type: "text" },
  { key: "route",                    label: "Route",               type: "text" },
  { key: "sample_count",             label: "Samples",             type: "number" },
  { key: "average_gowild_fare",      label: "Avg GoWild Fare",     type: "currency" },
  { key: "average_standard_fare",    label: "Avg Standard Fare",   type: "currency" },
  { key: "average_savings",          label: "Avg Savings",         type: "currency" },
  { key: "median_savings",           label: "Median Savings",      type: "currency" },
  { key: "maximum_savings",          label: "Max Savings",         type: "currency" },
  { key: "average_savings_percent",  label: "Avg Savings %",       type: "percent" },
  { key: "latest_observed_at",       label: "Last Observed",       type: "datetime" },
];

export const fareSavingsHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_gowild_fare_savings_by_route",
    {
      p_date_from:        p.start_date as string,
      p_date_to:          p.end_date as string,
      p_origin_iata:      typeof p.origin_iata === "string" && p.origin_iata
        ? p.origin_iata : null,
      p_destination_iata: typeof p.destination_iata === "string" && p.destination_iata
        ? p.destination_iata : null,
      p_minimum_samples:  typeof p.minimum_samples === "number" ? p.minimum_samples : 5,
      p_limit:            typeof p.limit === "number" ? p.limit : 25,
    },
  );

  if (error) throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const totalSamples   = rows.reduce((s, r) => s + (Number(r.sample_count)   || 0), 0);
  const maxSavings     = rows.length > 0
    ? Math.max(...rows.map((r) => Number(r.maximum_savings) || 0))
    : null;

  // Weighted average savings: sum(avg_savings * samples) / total_samples
  const weightedAvgSavings = totalSamples > 0
    ? rows.reduce((s, r) => s + (Number(r.average_savings) || 0) * (Number(r.sample_count) || 0), 0)
      / totalSamples
    : null;

  // Weighted median: best approximation from row-level medians is weighted avg.
  // True cross-route median would require all raw values — not available here.
  const weightedMedianApprox = totalSamples > 0
    ? rows.reduce((s, r) => s + (Number(r.median_savings) || 0) * (Number(r.sample_count) || 0), 0)
      / totalSamples
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "total_samples",    label: "Valid Fare Samples",   value: totalSamples,               type: "number" },
    { key: "avg_savings",      label: "Avg Savings",          value: weightedAvgSavings !== null
      ? Math.round(100 * weightedAvgSavings) / 100 : null,                                       type: "currency" },
    { key: "median_savings",   label: "Approx Median Savings", value: weightedMedianApprox !== null
      ? Math.round(100 * weightedMedianApprox) / 100 : null,                                     type: "currency" },
    { key: "highest_savings",  label: "Highest Savings",      value: maxSavings,                 type: "currency" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "gowild.fare-savings-by-route", name: "GoWild Fare Savings by Route", category: "GoWild Availability", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      FARE_SAVINGS_COLUMNS,
    rows,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "average_savings", label: "Avg Savings" }],
    },
    pagination: { page: ctx.page, page_size: ctx.pageSize, total_rows: rows.length, truncated: false },
    duration_ms: 0,
  };

  return result;
};
