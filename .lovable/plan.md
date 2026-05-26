## Goal

Rebuild the GoWild Snapshot card so all metrics use **complete itineraries** as the denominator, add a percentage trend graph, and base the trend comparison on prior-period data.

## Files to change

- `src/components/insights/itineraryHelpers.ts` — add new helper `computeGoWildSnapshotMetrics(itineraries, period)` returning the full metrics + bucket trend data + prior-period delta. Keep `computeItinerarySnapshotMetrics` (used elsewhere? — will verify; if unused, remove).
- `src/components/insights/GoWildSnapshotCard.tsx` — consume the new helper, update labels, render Recharts area chart.
- `src/pages/GoWildInsights.tsx` — extend the data load to cover the prior comparison window (24h→48h, 7d→14d, 30d→60d; All Time unchanged), and pass `period` down to the card.
- `src/test/itineraryHelpers.test.ts` — add deterministic tests for cases A–D from the spec.

No other cards or files touched.

## Helper output shape

```ts
type GoWildSnapshotMetrics = {
  totalItineraries: number;                // current period
  goWildAvailableItineraries: number;      // current period
  goWildAvailabilityRate: number;          // 0–100, 0 when total=0
  totalGoWildAvailableSeats: number;       // sum across all current itineraries (0 contrib for non-GW)
  avgGoWildSeatsPerItinerary: number;      // total / totalItineraries; 0 when total=0
  trendPercentagePoints: number | null;    // current% − prior%; null if no prior data
  trendDirection: "up" | "down" | "flat" | "unavailable";
  trendData: Array<{
    bucketKey: string;                     // ISO-ish key for sort/uniqueness
    bucketLabel: string;                   // human label for axis/tooltip
    totalItineraries: number;
    goWildAvailableItineraries: number;
    goWildAvailabilityRate: number | null; // null when bucket empty → omitted from plot
  }>;
};
```

## Bucketing & comparison rules

Buckets use **itinerary `snapshotAt`** (documented in code).

| Period | Current window | Prior window | Bucket size | Axis ticks |
|---|---|---|---|---|
| 24h | last 24h | preceding 24h | hourly (24 buckets) | every 4h |
| 7d | last 7d | preceding 7d | daily (7 buckets) | each day |
| 30d | last 30d | preceding 30d | daily (30 buckets) | every ~5 days |
| All | from earliest to now | n/a | weekly | auto-thinned |

Empty buckets → omitted from `trendData` (gap in line / not plotted).

For **All Time**, `trendPercentagePoints = null`, `trendDirection = "unavailable"`, label "Not enough prior data".

## Page-level change (`GoWildInsights.tsx`)

- Add `priorHours` derived from the selected period (`24h→48`, `7d→168×2=336`, `30d→720×2=1440`, `all→null`).
- Use `priorHours` instead of the current `hours` to compute `sinceIso` for pagination. This pulls in the prior window in the same paginated load.
- Pass `period` (the `PeriodKey`) into `<GoWildSnapshotCard itineraries={...} period={period} />`. Other cards continue to use the full loaded set (acceptable — they don't show period-scoped totals on the spec).
  - **Note:** Other cards (`AirportGoWildInsightsSection`, `GoWildRouteAnalyticsSection`, etc.) currently filter by `dateRange` only if passed (`getFilteredSnapshots`); they're invoked without a range. To preserve their existing behavior they will keep using the full extended set, which means they now include the prior window. That changes their totals.
  - **To avoid scope creep** (the spec says "No unrelated dashboard cards are redesigned or changed"): pass a `dateRange` prop to the other sections that restricts them to the current period (using the original `sinceIso`). This is the minimal change to keep their numbers identical to today.

## Card UI changes (`GoWildSnapshotCard.tsx`)

- Keep two donuts; relabel right donut "Avg GoWild Seats" / "per Itinerary". Normalize denominator for the visual fill but keep numeric display = `avgGoWildSeatsPerItinerary.toFixed(1)`.
- Supporting line below donuts: `{goWildAvailableItineraries} GoWild / {totalItineraries} total itineraries`.
- Insert a Recharts `<ResponsiveContainer height={140}>` with `<AreaChart>`:
  - One `<Area type="monotone" dataKey="goWildAvailabilityRate" stroke="#1e3a8a" fill="url(#gwTrendFill)" strokeWidth={2} />`
  - Gradient fill `from #1e3a8a/30 to transparent`
  - `<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />`
  - `<XAxis dataKey="bucketLabel" tick={{ fontSize: 10, fill: "#9CA3AF" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />`
  - `<YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={32} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />`
  - `<Tooltip />` with a custom content renderer showing `bucketLabel`, `GoWild Availability: x.x%`, `n GoWild / m total itineraries`.
  - `connectNulls={false}` so empty buckets create gaps.
- Trend pill below chart: `+X.X pts` / `-X.X pts` / `No change` vs prior {period label}. Use existing green/red/gray styling. When `trendDirection === "unavailable"` show neutral "Not enough prior data".
- Keep the existing collapsible header and the footnote.

## Validation (deterministic tests in `itineraryHelpers.test.ts`)

Add a `describe("computeGoWildSnapshotMetrics")` block with cases A–D from the spec:
- A: 4 itineraries (2 GW with 4 & 2 seats, 2 not GW) → rate 50.0, avgSeats 1.5.
- B: connecting AUS→DEN→LAS (5 & 2 seats, both GW) + ATL→LAS (not GW) → 1/2 GW, avgSeats 1.0, bottleneck seats 2.
- C: current 10/40 = 25%, prior 6/40 = 15% → `trendPercentagePoints = +10.0`, direction `"up"`.
- D: current has data, prior empty → `trendPercentagePoints = null`, direction `"unavailable"`.

## Out of scope

- Other Insights cards' visuals/logic.
- Schema, RLS, or data-writer changes.
- The 5,000-row cap (already removed in prior change).
