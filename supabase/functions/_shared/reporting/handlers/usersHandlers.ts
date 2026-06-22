// ─────────────────────────────────────────────────────────────────────────────
// Handlers and column definitions for the Users report category.
//
// Each handler calls a single SECURITY DEFINER RPC function.
// The RPC does all aggregation; this layer maps the returned rows to the
// standard AdminReportExecutionResult shape.
//
// Column definitions are co-located with their handlers so the registry
// entries and result shapes stay in sync from one place.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AdminReportExecutionResult,
  ReportColumn,
  ReportHandler,
  ReportSummaryMetric,
} from "../reportTypes.ts";
import { exclusiveEndTimestamp } from "../reportValidation.ts";

// ── Shared helper ─────────────────────────────────────────────────────────────

/**
 * Converts a YYYY-MM-DD date string to an ISO timestamp usable as a
 * timestamptz parameter. Postgres casts 'YYYY-MM-DD' to midnight UTC.
 */
function toTimestamptz(date: string): string {
  return `${date}T00:00:00.000Z`;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 1 — users.top-search-active
// ─────────────────────────────────────────────────────────────────────────────

export const TOP_SEARCH_ACTIVE_COLUMNS: ReportColumn[] = [
  { key: "user_id",              label: "User ID",           type: "text",     pii: true,  hiddenByDefault: true },
  { key: "display_name",         label: "Display Name",      type: "text" },
  { key: "email",                label: "Email",             type: "text",     pii: true },
  { key: "status",               label: "Status",            type: "text" },
  { key: "signup_type",          label: "Signup Type",       type: "text" },
  { key: "home_airport",         label: "Home Airport",      type: "text" },
  { key: "search_count",         label: "Searches",          type: "number" },
  { key: "gowild_search_count",  label: "GoWild Searches",   type: "number" },
  { key: "saved_flight_count",   label: "Saved Flights",     type: "number" },
  { key: "feedback_count",       label: "Feedback",          type: "number" },
  { key: "route_favorite_count", label: "Route Favorites",   type: "number" },
  { key: "last_search_at",       label: "Last Search",       type: "datetime" },
  { key: "last_login",           label: "Last Login",        type: "datetime" },
];

export const topSearchActiveHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_users_top_search_active",
    {
      p_date_from:               toTimestamptz(p.start_date as string),
      p_date_to:                 exclusiveEndTimestamp(p.end_date as string),
      p_limit:                   typeof p.limit === "number" ? p.limit : 50,
      p_include_system_activity: p.include_system_activity === true,
      p_user_status:             typeof p.user_status === "string" ? p.user_status : "all",
      p_include_pii:             ctx.includePii,
    },
  );

  if (error) {
    throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);
  }

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const totalSearches = rows.reduce(
    (acc, r) => acc + (Number(r.search_count) || 0),
    0,
  );
  const topCount = rows.length > 0 ? Number(rows[0].search_count) || 0 : 0;

  const summary: ReportSummaryMetric[] = [
    { key: "users_shown",       label: "Users Shown",       value: rows.length,     type: "number" },
    { key: "total_searches",    label: "Total Searches",    value: totalSearches,   type: "number" },
    { key: "top_user_searches", label: "Top User Searches", value: topCount,        type: "number" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "users.top-search-active", name: "Top Search-Active Users", category: "Users", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      TOP_SEARCH_ACTIVE_COLUMNS,
    rows,
    chart: {
      type:   "bar",
      xKey:   "display_name",
      series: [{ key: "search_count", label: "Searches" }],
    },
    pagination: {
      page:       ctx.page,
      page_size:  ctx.pageSize,
      total_rows: rows.length,
      truncated:  false,
    },
    duration_ms: 0,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 2 — users.dormant
//
// NOTE: user_info has no reliable created_at column. This report measures
// last recorded activity, not account age or time-since-signup.
// ─────────────────────────────────────────────────────────────────────────────

export const DORMANT_COLUMNS: ReportColumn[] = [
  { key: "user_id",              label: "User ID",                type: "text",     pii: true,  hiddenByDefault: true },
  { key: "display_name",         label: "Display Name",           type: "text" },
  { key: "email",                label: "Email",                  type: "text",     pii: true },
  { key: "status",               label: "Status",                 type: "text" },
  { key: "signup_type",          label: "Signup Type",            type: "text" },
  { key: "home_airport",         label: "Home Airport",           type: "text" },
  { key: "last_login",           label: "Last Login",             type: "datetime" },
  { key: "last_search_at",       label: "Last Search",            type: "datetime" },
  { key: "last_saved_flight_at", label: "Last Saved Flight",      type: "datetime" },
  { key: "last_feedback_at",     label: "Last Feedback",          type: "datetime" },
  { key: "last_activity_at",     label: "Last Any Activity",      type: "datetime" },
  { key: "inactive_days",        label: "Days Since Activity",    type: "number" },
  { key: "never_active",         label: "Never Active",           type: "boolean" },
];

export const dormantHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_users_dormant",
    {
      p_inactive_days: typeof p.inactive_days === "number" ? p.inactive_days : 30,
      p_user_status:   typeof p.user_status === "string" ? p.user_status : "current",
      p_limit:         typeof p.limit === "number" ? p.limit : 100,
      p_include_pii:   ctx.includePii,
    },
  );

  if (error) {
    throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);
  }

  const rows: Record<string, unknown>[] = (data ?? []) as Record<string, unknown>[];

  const neverActiveCount = rows.filter((r) => r.never_active === true).length;
  const maxInactiveDays  = rows.reduce(
    (acc, r) => Math.max(acc, typeof r.inactive_days === "number" ? r.inactive_days : 0),
    0,
  );

  const summary: ReportSummaryMetric[] = [
    { key: "dormant_users",      label: "Dormant Users",     value: rows.length,      type: "number" },
    { key: "never_active_users", label: "Never Active",      value: neverActiveCount, type: "number" },
    { key: "max_inactive_days",  label: "Longest Dormant",   value: maxInactiveDays,  type: "number" },
  ];

  const result: AdminReportExecutionResult = {
    report:       { slug: "users.dormant", name: "Dormant Users", category: "Users", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      DORMANT_COLUMNS,
    rows,
    chart: { type: "none" },
    pagination: {
      page:       ctx.page,
      page_size:  ctx.pageSize,
      total_rows: rows.length,
      truncated:  false,
    },
    duration_ms: 0,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORT 3 — users.engagement-summary
//
// Returns a single aggregate row. containsPii = false on this report —
// all values are distinct-user counts, never user-level records.
// ─────────────────────────────────────────────────────────────────────────────

export const ENGAGEMENT_SUMMARY_COLUMNS: ReportColumn[] = [
  { key: "eligible_users",                  label: "Eligible Users",          type: "number" },
  { key: "users_with_searches",             label: "Users: Searched",         type: "number" },
  { key: "users_with_gowild_hits",          label: "Users: GoWild Hit",       type: "number" },
  { key: "users_with_saved_flights",        label: "Users: Saved Flights",    type: "number" },
  { key: "users_with_route_favorites",      label: "Users: Route Favorites",  type: "number" },
  { key: "users_with_feedback",             label: "Users: Feedback",         type: "number" },
  { key: "users_with_credit_activity",      label: "Users: Credit Activity",  type: "number" },
  { key: "users_with_no_recorded_activity", label: "Users: No Activity",      type: "number" },
  { key: "search_engagement_rate",          label: "Search Engagement",       type: "percent" },
  { key: "save_engagement_rate",            label: "Save Engagement",         type: "percent" },
  { key: "feedback_engagement_rate",        label: "Feedback Engagement",     type: "percent" },
];

export const engagementSummaryHandler: ReportHandler = async (ctx) => {
  const p = ctx.parameters;

  const { data, error } = await ctx.serviceClient.rpc(
    "report_users_engagement_summary",
    {
      p_date_from:               toTimestamptz(p.start_date as string),
      p_date_to:                 exclusiveEndTimestamp(p.end_date as string),
      p_user_status:             typeof p.user_status === "string" ? p.user_status : "all",
      p_include_system_activity: p.include_system_activity === true,
    },
  );

  if (error) {
    throw new Error(`REPORT_EXECUTION_FAILED: ${error.message}`);
  }

  // RPC returns exactly one row.
  const rawRow = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
  const row = rawRow as Record<string, unknown>;

  const eligible     = Number(row.eligible_users)      || 0;
  const withSearches = Number(row.users_with_searches) || 0;
  const noActivity   = Number(row.users_with_no_recorded_activity) || 0;
  const searchRate   = row.search_engagement_rate != null
    ? Number(row.search_engagement_rate)
    : null;

  const summary: ReportSummaryMetric[] = [
    { key: "eligible_users",         label: "Eligible Users",         value: eligible,     type: "number" },
    { key: "users_with_searches",    label: "Users Searched",         value: withSearches, type: "number" },
    { key: "search_engagement_rate", label: "Search Engagement Rate", value: searchRate,   type: "percent" },
    { key: "no_activity",            label: "No Recorded Activity",   value: noActivity,   type: "number" },
  ];

  const rows: Record<string, unknown>[] = eligible > 0 ? [row] : [];

  const result: AdminReportExecutionResult = {
    report:       { slug: "users.engagement-summary", name: "User Engagement Summary", category: "Users", version: 1 },
    run_id:       "",
    generated_at: new Date().toISOString(),
    parameters:   p,
    summary,
    columns:      ENGAGEMENT_SUMMARY_COLUMNS,
    rows,
    chart: {
      type:   "bar",
      xKey:   "metric",
      series: [{ key: "value", label: "Users" }],
    },
    pagination: {
      page:       ctx.page,
      page_size:  ctx.pageSize,
      total_rows: rows.length,
      truncated:  false,
    },
    duration_ms: 0,
  };

  return result;
};
