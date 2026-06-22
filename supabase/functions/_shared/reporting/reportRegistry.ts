// ─────────────────────────────────────────────────────────────────────────────
// Static report registry.
//
// This is the ONLY security allowlist for the reporting system.
// The browser can only request reports whose slug exists here.
// No arbitrary SQL, table names, function names, or handler names
// are ever accepted from clients.
//
// Each entry is a placeholder until the concrete query is implemented.
// Calling an unimplemented handler throws REPORT_NOT_IMPLEMENTED.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "https://esm.sh/zod@3";
import type { ReportRegistryEntry, ReportHandler } from "./reportTypes.ts";
import {
  rangeWithLimitAndGranularity,
  rangeWithLimit,
  rangeOnly,
  makeValidator,
  dateSchema,
  limitSchema,
  granularitySchema,
  timezoneSchema,
  includePiiSchema,
  includeSystemActivitySchema,
  optionalIataSchema,
} from "./reportValidation.ts";
import {
  topSearchActiveHandler,
  TOP_SEARCH_ACTIVE_COLUMNS,
  dormantHandler,
  DORMANT_COLUMNS,
  engagementSummaryHandler,
  ENGAGEMENT_SUMMARY_COLUMNS,
} from "./handlers/usersHandlers.ts";
import {
  searchesVolumeHandler,
  SEARCHES_VOLUME_COLUMNS,
  topRoutesHandler,
  TOP_ROUTES_COLUMNS,
  zeroResultsHandler,
  ZERO_RESULTS_COLUMNS,
  sourceCacheMixHandler,
  SOURCE_CACHE_MIX_COLUMNS,
} from "./handlers/searchesHandlers.ts";
import {
  routeReliabilityHandler,
  ROUTE_RELIABILITY_COLUMNS,
  disappearedItinerariesHandler,
  DISAPPEARED_ITINERARIES_COLUMNS,
  fareSavingsHandler,
  FARE_SAVINGS_COLUMNS,
} from "./handlers/gowildHandlers.ts";
import {
  resultSourceFilterSchema,
  triggeredByFilterSchema,
  includeAllDestinationsSchema,
} from "./reportValidation.ts";

// ── Placeholder handler ───────────────────────────────────────────────────────

const notImplemented: ReportHandler = async () => {
  throw new Error("REPORT_NOT_IMPLEMENTED");
};

// ── Parameter schemas for reports that don't fit the shared composites ────────

// users.top-search-active: rangeWithLimit + user_status, limit capped at 100.
const topSearchActiveSchema = z.object({
  start_date:               dateSchema,
  end_date:                 dateSchema,
  limit:                    z.number().int().min(1).max(100).optional().default(10),
  include_pii:              includePiiSchema,
  include_system_activity:  includeSystemActivitySchema,
  user_status:              z.enum(["all", "current", "pending"]).optional().default("all"),
  timezone:                 timezoneSchema.optional(),
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

// users.dormant: no date range — activity is measured all-time against a day threshold.
const dormantSchema = z.object({
  inactive_days: z.number().int().min(1).max(730).optional().default(30),
  user_status:   z.enum(["all", "current", "pending"]).optional().default("current"),
  limit:         z.number().int().min(1).max(500).optional().default(100),
  include_pii:   includePiiSchema,
});

// users.engagement-summary: returns one aggregate row, no PII, no limit.
const engagementSummarySchema = z.object({
  start_date:               dateSchema,
  end_date:                 dateSchema,
  user_status:              z.enum(["all", "current", "pending"]).optional().default("all"),
  include_system_activity:  includeSystemActivitySchema,
  timezone:                 timezoneSchema.optional(),
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

const fareByRouteSchema = z.object({
  start_date: dateSchema,
  end_date: dateSchema,
  origin: optionalIataSchema,
  limit: limitSchema,
  timezone: timezoneSchema.optional(),
  include_pii: includePiiSchema,
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

const feedbackSummarySchema = z.object({
  start_date: dateSchema,
  end_date: dateSchema,
  status: z.enum(["all", "new", "in_review", "resolved"]).optional().default("all"),
  granularity: granularitySchema,
  timezone: timezoneSchema.optional(),
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

const bulkJobHealthSchema = z.object({
  start_date: dateSchema,
  end_date: dateSchema,
  granularity: z.enum(["hour", "day", "week"]).optional().default("day"),
  timezone: timezoneSchema.optional(),
  include_system_activity: includeSystemActivitySchema,
}).refine(
  (v) => new Date(v.end_date) >= new Date(v.start_date),
  { message: "end_date must not be before start_date", path: ["end_date"] },
);

// ── Search report schemas ─────────────────────────────────────────────────────

const sharedSearchFilters = {
  start_date:               dateSchema,
  end_date:                 dateSchema,
  timezone:                 timezoneSchema.optional(),
  include_system_activity:  includeSystemActivitySchema,
  origin_iata:              optionalIataSchema,
  destination_iata:         optionalIataSchema,
  result_source:            resultSourceFilterSchema,
  triggered_by:             triggeredByFilterSchema,
};

const searchDateRangeRefine = (v: { start_date: string; end_date: string }) =>
  new Date(v.end_date) >= new Date(v.start_date);
const searchDateMsg = { message: "end_date must not be before start_date", path: ["end_date"] };

const searchesVolumeSchema = z.object({
  ...sharedSearchFilters,
  granularity: granularitySchema,
}).refine(searchDateRangeRefine, searchDateMsg);

const topRoutesSchema = z.object({
  ...sharedSearchFilters,
  limit:                    z.number().int().min(1).max(100).optional().default(25),
  include_all_destinations: includeAllDestinationsSchema,
}).refine(searchDateRangeRefine, searchDateMsg);

const zeroResultsSchema = z.object({
  ...sharedSearchFilters,
  minimum_searches:         z.number().int().min(1).optional().default(1),
  limit:                    z.number().int().min(1).max(500).optional().default(100),
  include_all_destinations: includeAllDestinationsSchema,
}).refine(searchDateRangeRefine, searchDateMsg);

const sourceCacheMixSchema = z.object({
  ...sharedSearchFilters,
}).refine(searchDateRangeRefine, searchDateMsg);

// ── GoWild report schemas ─────────────────────────────────────────────────────

const goWildDateRefine = (v: { date_from: string; date_to: string }) =>
  new Date(v.date_to) >= new Date(v.date_from);
const goWildDateMsg = { message: "date_to must not be before date_from", path: ["date_to"] };

const routeReliabilitySchema = z.object({
  date_from:              dateSchema,
  date_to:                dateSchema,
  origin_iata:            optionalIataSchema,
  destination_iata:       optionalIataSchema,
  minimum_observations:   z.number().int().min(1).optional().default(10),
  limit:                  z.number().int().min(1).max(100).optional().default(25),
  include_admin_bulk:     z.boolean().optional().default(true),
  include_scheduled_bulk: z.boolean().optional().default(true),
  include_user_searches:  z.boolean().optional().default(true),
}).refine(goWildDateRefine, goWildDateMsg);

const disappearedItinerariesSchema = z.object({
  date_from:          dateSchema,
  date_to:            dateSchema,
  origin_iata:        optionalIataSchema,
  destination_iata:   optionalIataSchema,
  limit:              z.number().int().min(1).max(500).optional().default(100),
  latest_event_only:  z.boolean().optional().default(true),
}).refine(goWildDateRefine, goWildDateMsg);

const fareSavingsByRouteSchema = z.object({
  date_from:          dateSchema,
  date_to:            dateSchema,
  origin_iata:        optionalIataSchema,
  destination_iata:   optionalIataSchema,
  minimum_samples:    z.number().int().min(1).optional().default(5),
  limit:              z.number().int().min(1).max(100).optional().default(25),
}).refine(goWildDateRefine, goWildDateMsg);

// ── Registry entries (one per seeded report slug) ─────────────────────────────

const entries: ReportRegistryEntry[] = [

  // ── Users ──────────────────────────────────────────────────────────────────

  {
    slug:        "users.top-search-active",
    handlerKey:  "users.top-search-active",
    version:     1,
    containsPii: true,
    parameterSchema: {
      fields: [
        { key: "start_date",              label: "Start Date",          type: "date",   required: true },
        { key: "end_date",                label: "End Date",            type: "date",   required: true },
        { key: "limit",                   label: "Max Results",         type: "number", minimum: 1, maximum: 100 },
        {
          key: "user_status", label: "User Status", type: "select",
          options: [
            { label: "All",     value: "all" },
            { label: "Current", value: "current" },
            { label: "Pending", value: "pending" },
          ],
        },
        { key: "include_system_activity", label: "Include System Activity", type: "boolean" },
        { key: "include_pii",             label: "Include Full Email",  type: "boolean" },
      ],
    },
    validateParameters: makeValidator(topSearchActiveSchema),
    columns:     TOP_SEARCH_ACTIVE_COLUMNS,
    chart: {
      type:   "bar",
      xKey:   "display_name",
      series: [{ key: "search_count", label: "Searches" }],
    },
    handler: topSearchActiveHandler,
  },

  {
    slug:        "users.dormant",
    handlerKey:  "users.dormant",
    version:     1,
    containsPii: true,
    parameterSchema: {
      fields: [
        {
          key:        "inactive_days",
          label:      "Days Since Last Activity",
          type:       "number",
          required:   true,
          minimum:    1,
          maximum:    730,
          helperText: "Return users with no recorded activity in this many days. Note: account age is not measured — user_info has no reliable created_at column.",
        },
        {
          key: "user_status", label: "User Status", type: "select",
          options: [
            { label: "Current", value: "current" },
            { label: "All",     value: "all" },
            { label: "Pending", value: "pending" },
          ],
        },
        { key: "limit",       label: "Max Results",        type: "number", minimum: 1, maximum: 500 },
        { key: "include_pii", label: "Include Full Email", type: "boolean" },
      ],
    },
    validateParameters: makeValidator(dormantSchema),
    columns:     DORMANT_COLUMNS,
    chart: { type: "none" },
    handler: dormantHandler,
  },

  {
    slug:        "users.engagement-summary",
    handlerKey:  "users.engagement-summary",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "start_date", label: "Start Date", type: "date", required: true },
        { key: "end_date",   label: "End Date",   type: "date", required: true },
        {
          key: "user_status", label: "User Status", type: "select",
          options: [
            { label: "All",     value: "all" },
            { label: "Current", value: "current" },
            { label: "Pending", value: "pending" },
          ],
        },
        { key: "include_system_activity", label: "Include System Activity", type: "boolean" },
      ],
    },
    validateParameters: makeValidator(engagementSummarySchema),
    columns:     ENGAGEMENT_SUMMARY_COLUMNS,
    chart: {
      type:   "bar",
      xKey:   "metric",
      series: [{ key: "value", label: "Users" }],
    },
    handler: engagementSummaryHandler,
  },

  // ── Flight Searches ────────────────────────────────────────────────────────

  {
    slug:        "searches.volume-over-time",
    handlerKey:  "searches.volume-over-time",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "start_date",  label: "Start Date",  type: "date",   required: true },
        { key: "end_date",    label: "End Date",    type: "date",   required: true },
        {
          key: "granularity", label: "Granularity", type: "select",
          options: [
            { label: "Daily",   value: "day" },
            { label: "Weekly",  value: "week" },
            { label: "Monthly", value: "month" },
          ],
        },
        {
          key: "timezone", label: "Timezone", type: "select",
          options: [
            { label: "Eastern (ET)",  value: "America/New_York" },
            { label: "Central (CT)",  value: "America/Chicago" },
            { label: "Mountain (MT)", value: "America/Denver" },
            { label: "Pacific (PT)",  value: "America/Los_Angeles" },
            { label: "UTC",           value: "UTC" },
          ],
        },
        { key: "origin_iata",             label: "Origin Airport",      type: "airport" },
        { key: "destination_iata",        label: "Destination Airport", type: "airport" },
        {
          key: "result_source", label: "Result Source", type: "select",
          options: [
            { label: "Live API",             value: "live_api" },
            { label: "Cache Hit",            value: "cache_hit" },
            { label: "Scheduled Bulk",       value: "scheduled_bulk_search" },
            { label: "Admin Bulk",           value: "admin_bulk_search" },
            { label: "Unknown / Not Recorded", value: "unknown" },
          ],
        },
        {
          key: "triggered_by", label: "Triggered By", type: "select",
          options: [
            { label: "User",           value: "user" },
            { label: "Scheduled Bulk", value: "scheduled_bulk_search" },
            { label: "Admin Bulk",     value: "admin_bulk_search" },
          ],
        },
        { key: "include_system_activity", label: "Include System Activity", type: "boolean" },
      ],
    },
    validateParameters: makeValidator(searchesVolumeSchema),
    columns:      SEARCHES_VOLUME_COLUMNS,
    chart: {
      type:   "line",
      xKey:   "period_start",
      series: [
        { key: "search_count",     label: "Searches" },
        { key: "gowild_hit_count", label: "GoWild Hits" },
        { key: "unique_users",     label: "Users" },
      ],
    },
    handler: searchesVolumeHandler,
  },

  {
    slug:        "searches.top-routes",
    handlerKey:  "searches.top-routes",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "start_date",  label: "Start Date",  type: "date",   required: true },
        { key: "end_date",    label: "End Date",    type: "date",   required: true },
        { key: "limit",       label: "Max Results", type: "number", minimum: 1, maximum: 100 },
        {
          key: "timezone", label: "Timezone", type: "select",
          options: [
            { label: "Eastern (ET)",  value: "America/New_York" },
            { label: "Central (CT)",  value: "America/Chicago" },
            { label: "Mountain (MT)", value: "America/Denver" },
            { label: "Pacific (PT)",  value: "America/Los_Angeles" },
            { label: "UTC",           value: "UTC" },
          ],
        },
        { key: "origin_iata",             label: "Origin Airport",              type: "airport" },
        { key: "destination_iata",        label: "Destination Airport",         type: "airport" },
        { key: "include_all_destinations", label: "Include All-Destination Searches", type: "boolean" },
        {
          key: "result_source", label: "Result Source", type: "select",
          options: [
            { label: "Live API",               value: "live_api" },
            { label: "Cache Hit",              value: "cache_hit" },
            { label: "Scheduled Bulk",         value: "scheduled_bulk_search" },
            { label: "Admin Bulk",             value: "admin_bulk_search" },
            { label: "Unknown / Not Recorded", value: "unknown" },
          ],
        },
        {
          key: "triggered_by", label: "Triggered By", type: "select",
          options: [
            { label: "User",           value: "user" },
            { label: "Scheduled Bulk", value: "scheduled_bulk_search" },
            { label: "Admin Bulk",     value: "admin_bulk_search" },
          ],
        },
        { key: "include_system_activity", label: "Include System Activity", type: "boolean" },
      ],
    },
    validateParameters: makeValidator(topRoutesSchema),
    columns:      TOP_ROUTES_COLUMNS,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "search_count", label: "Searches" }],
    },
    handler: topRoutesHandler,
  },

  {
    slug:        "searches.zero-results",
    handlerKey:  "searches.zero-results",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "start_date",       label: "Start Date",   type: "date",   required: true },
        { key: "end_date",         label: "End Date",     type: "date",   required: true },
        { key: "minimum_searches", label: "Min. Searches per Route", type: "number", minimum: 1,
          helperText: "Exclude routes with fewer total searches than this threshold" },
        { key: "limit",            label: "Max Results",  type: "number", minimum: 1, maximum: 500 },
        {
          key: "timezone", label: "Timezone", type: "select",
          options: [
            { label: "Eastern (ET)",  value: "America/New_York" },
            { label: "Central (CT)",  value: "America/Chicago" },
            { label: "Mountain (MT)", value: "America/Denver" },
            { label: "Pacific (PT)",  value: "America/Los_Angeles" },
            { label: "UTC",           value: "UTC" },
          ],
        },
        { key: "origin_iata",             label: "Origin Airport",              type: "airport" },
        { key: "destination_iata",        label: "Destination Airport",         type: "airport" },
        { key: "include_all_destinations", label: "Include All-Destination Searches", type: "boolean" },
        {
          key: "result_source", label: "Result Source", type: "select",
          options: [
            { label: "Live API",               value: "live_api" },
            { label: "Cache Hit",              value: "cache_hit" },
            { label: "Scheduled Bulk",         value: "scheduled_bulk_search" },
            { label: "Admin Bulk",             value: "admin_bulk_search" },
            { label: "Unknown / Not Recorded", value: "unknown" },
          ],
        },
        {
          key: "triggered_by", label: "Triggered By", type: "select",
          options: [
            { label: "User",           value: "user" },
            { label: "Scheduled Bulk", value: "scheduled_bulk_search" },
            { label: "Admin Bulk",     value: "admin_bulk_search" },
          ],
        },
        { key: "include_system_activity", label: "Include System Activity", type: "boolean" },
      ],
    },
    validateParameters: makeValidator(zeroResultsSchema),
    columns:      ZERO_RESULTS_COLUMNS,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "zero_result_searches", label: "Zero Results" }],
    },
    handler: zeroResultsHandler,
  },

  {
    slug:        "searches.source-cache-mix",
    handlerKey:  "searches.source-cache-mix",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "start_date", label: "Start Date", type: "date", required: true },
        { key: "end_date",   label: "End Date",   type: "date", required: true },
        {
          key: "timezone", label: "Timezone", type: "select",
          options: [
            { label: "Eastern (ET)",  value: "America/New_York" },
            { label: "Central (CT)",  value: "America/Chicago" },
            { label: "Mountain (MT)", value: "America/Denver" },
            { label: "Pacific (PT)",  value: "America/Los_Angeles" },
            { label: "UTC",           value: "UTC" },
          ],
        },
        { key: "origin_iata",             label: "Origin Airport",      type: "airport" },
        { key: "destination_iata",        label: "Destination Airport", type: "airport" },
        {
          key: "triggered_by", label: "Triggered By", type: "select",
          options: [
            { label: "User",           value: "user" },
            { label: "Scheduled Bulk", value: "scheduled_bulk_search" },
            { label: "Admin Bulk",     value: "admin_bulk_search" },
          ],
        },
        { key: "include_system_activity", label: "Include System Activity", type: "boolean" },
      ],
    },
    validateParameters: makeValidator(sourceCacheMixSchema),
    columns:      SOURCE_CACHE_MIX_COLUMNS,
    chart: {
      type:   "donut",
      xKey:   "result_source",
      series: [{ key: "search_count", label: "Searches" }],
    },
    handler: sourceCacheMixHandler,
  },

  // ── GoWild Availability ────────────────────────────────────────────────────

  {
    slug:        "gowild.route-reliability",
    handlerKey:  "gowild.route-reliability",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "date_from",            label: "From Date",               type: "date",   required: true },
        { key: "date_to",              label: "To Date",                 type: "date",   required: true },
        { key: "origin_iata",          label: "Origin Airport",          type: "airport" },
        { key: "destination_iata",     label: "Destination Airport",     type: "airport" },
        {
          key: "minimum_observations", label: "Min. Observations",       type: "number", minimum: 1,
          helperText: "Exclude routes with fewer search observations than this threshold",
        },
        { key: "limit",                label: "Max Results",             type: "number", minimum: 1, maximum: 100 },
        { key: "include_user_searches",   label: "Include User Searches",   type: "boolean" },
        { key: "include_scheduled_bulk",  label: "Include Scheduled Bulk",  type: "boolean" },
        { key: "include_admin_bulk",      label: "Include Admin Bulk",      type: "boolean" },
      ],
    },
    validateParameters: makeValidator(routeReliabilitySchema),
    columns:      ROUTE_RELIABILITY_COLUMNS,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "confidence_adjusted_score", label: "Confidence Score" }],
    },
    handler: routeReliabilityHandler,
  },

  {
    slug:        "gowild.disappeared-itineraries",
    handlerKey:  "gowild.disappeared-itineraries",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "date_from",          label: "From Date",           type: "date",   required: true },
        { key: "date_to",            label: "To Date",             type: "date",   required: true },
        { key: "origin_iata",        label: "Origin Airport",      type: "airport" },
        { key: "destination_iata",   label: "Destination Airport", type: "airport" },
        { key: "limit",              label: "Max Results",         type: "number", minimum: 1, maximum: 500 },
        {
          key: "latest_event_only",  label: "Latest Event Only",   type: "boolean",
          // helperText not in the field spec but included for clarity:
        },
      ],
    },
    validateParameters: makeValidator(disappearedItinerariesSchema),
    columns:      DISAPPEARED_ITINERARIES_COLUMNS,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "disappearance_event_count", label: "Events" }],
    },
    handler: disappearedItinerariesHandler,
  },

  {
    slug:        "gowild.fare-savings-by-route",
    handlerKey:  "gowild.fare-savings-by-route",
    version:     1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "date_from",         label: "From Date",           type: "date",   required: true },
        { key: "date_to",           label: "To Date",             type: "date",   required: true },
        { key: "origin_iata",       label: "Origin Airport",      type: "airport" },
        { key: "destination_iata",  label: "Destination Airport", type: "airport" },
        {
          key: "minimum_samples",   label: "Min. Samples",        type: "number", minimum: 1,
          helperText: "Exclude routes with fewer valid fare comparison samples",
        },
        { key: "limit",             label: "Max Results",         type: "number", minimum: 1, maximum: 100 },
      ],
    },
    validateParameters: makeValidator(fareSavingsByRouteSchema),
    columns:      FARE_SAVINGS_COLUMNS,
    chart: {
      type:   "bar",
      xKey:   "route",
      series: [{ key: "average_savings", label: "Avg Savings" }],
    },
    handler: fareSavingsHandler,
  },

  // ── Beta Program ───────────────────────────────────────────────────────────

  {
    slug: "beta.feedback-summary",
    handlerKey: "beta.feedback-summary",
    version: 1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "start_date",   label: "Start Date",     type: "date",   required: true },
        { key: "end_date",     label: "End Date",       type: "date",   required: true },
        {
          key: "status", label: "Status Filter", type: "select",
          options: [
            { label: "All",       value: "all" },
            { label: "New",       value: "new" },
            { label: "In Review", value: "in_review" },
            { label: "Resolved",  value: "resolved" },
          ],
        },
        {
          key: "granularity", label: "Granularity", type: "select",
          options: [
            { label: "Daily",   value: "day" },
            { label: "Weekly",  value: "week" },
            { label: "Monthly", value: "month" },
          ],
        },
      ],
    },
    validateParameters: makeValidator(feedbackSummarySchema),
    columns: [
      { key: "period",           label: "Period",       type: "date" },
      { key: "submission_count", label: "Submissions",  type: "number" },
      { key: "open_count",       label: "Open",         type: "number" },
      { key: "resolved_count",   label: "Resolved",     type: "number" },
    ],
    chart: {
      type: "line",
      xKey: "period",
      series: [{ key: "submission_count", label: "Submissions" }],
    },
    handler: notImplemented,
  },

  // ── Operations ─────────────────────────────────────────────────────────────

  {
    slug: "operations.bulk-search-job-health",
    handlerKey: "operations.bulk-search-job-health",
    version: 1,
    containsPii: false,
    parameterSchema: {
      fields: [
        { key: "start_date",  label: "Start Date",  type: "date",   required: true },
        { key: "end_date",    label: "End Date",    type: "date",   required: true },
        {
          key: "granularity", label: "Granularity", type: "select",
          options: [
            { label: "Hourly",  value: "hour" },
            { label: "Daily",   value: "day" },
            { label: "Weekly",  value: "week" },
          ],
        },
      ],
    },
    validateParameters: makeValidator(bulkJobHealthSchema),
    columns: [
      { key: "period",          label: "Period",           type: "date" },
      { key: "jobs_queued",     label: "Queued",           type: "number" },
      { key: "jobs_completed",  label: "Completed",        type: "number" },
      { key: "jobs_failed",     label: "Failed",           type: "number" },
      { key: "completion_rate", label: "Completion Rate",  type: "percent" },
      { key: "avg_duration_ms", label: "Avg Duration",     type: "duration" },
    ],
    chart: {
      type: "bar",
      xKey: "period",
      series: [
        { key: "jobs_completed", label: "Completed" },
        { key: "jobs_failed",    label: "Failed" },
      ],
    },
    handler: notImplemented,
  },
];

// ── Startup consistency validation ────────────────────────────────────────────

function validateRegistry(all: ReportRegistryEntry[]): void {
  const slugsSeen = new Set<string>();
  const handlerKeysSeen = new Set<string>();
  const errors: string[] = [];

  for (const entry of all) {
    if (entry.version < 1) {
      errors.push(`${entry.slug}: version must be >= 1 (got ${entry.version})`);
    }
    if (typeof entry.validateParameters !== "function") {
      errors.push(`${entry.slug}: missing validateParameters function`);
    }
    if (!entry.columns || entry.columns.length === 0) {
      errors.push(`${entry.slug}: columns array must not be empty`);
    }
    if (slugsSeen.has(entry.slug)) {
      errors.push(`Duplicate slug detected: "${entry.slug}"`);
    } else {
      slugsSeen.add(entry.slug);
    }
    if (handlerKeysSeen.has(entry.handlerKey)) {
      errors.push(`Duplicate handlerKey detected: "${entry.handlerKey}"`);
    } else {
      handlerKeysSeen.add(entry.handlerKey);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Report registry failed startup validation:\n${errors.map((e) => `  • ${e}`).join("\n")}`,
    );
  }
}

// Fail fast at module import time if the registry is internally inconsistent.
validateRegistry(entries);

// ── Public API ────────────────────────────────────────────────────────────────

/** O(1) lookup by slug. The ONLY authorised way to resolve a report. */
export const REPORT_REGISTRY: ReadonlyMap<string, ReportRegistryEntry> = new Map(
  entries.map((e) => [e.slug, e]),
);

/** Ordered list for enumeration (e.g. listing all reports). */
export const REPORT_REGISTRY_LIST: readonly ReportRegistryEntry[] = entries;

/** The set of all registered slugs (for fast membership checks). */
export const REGISTERED_SLUGS: ReadonlySet<string> = new Set(entries.map((e) => e.slug));

export { validateRegistry };
