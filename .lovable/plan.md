
## Root Cause Analysis

### Issue 1: Earliest Departure = `—`

The card-building `useMemo` (lines 282–302) reads departure times from:
```
f.legs[0]?.departure_time  OR  f.departureTime  OR  f.depart_time
```

From the JSON data, `f.legs[0].departure_time` is `""` (empty string) — the real ISO times live in `f.rawPayload.departure_time` and `f.rawPayload.segments[0].departure_time`. The code never checks `rawPayload` in this section, so `depTimeMins` stays empty, and `earliestDeparture` stays `null`.

### Issue 2: Fare Range has no max (or wrong max)

The `allFares` array (lines 248–258) builds from:
- `nFares.go_wild`, `nFares.discount_den`, `nFares.standard`, `nFares.economy`, `nFares.premium`, `f.price`

From the JSON: all top-level `f.fares.*` are `null`. Only `f.price` is non-null. So for each flight, `allFares = [f.price]` → `flightMin === flightMax === f.price`.

The max across all flights becomes the highest `f.price` in the group. The real highest fare is `rawPayload.fares.standard.total` (e.g. $434.58), but that's never read during card-building. So the range is actually `min(all prices)` to `max(all prices)` — it's "working" but using only `f.price` not the actual highest fare tier.

## Fix — Both issues are in the card-building `useMemo` only

### Change 1: Enrich departure time lookup (for Earliest)

In the `depTimeMins` loop, add fallback to `rawPayload`:
```
f.rawPayload?.segments?.[0]?.departure_time
OR f.rawPayload?.departure_time
```
after checking `f.legs[0]?.departure_time`.

### Change 2: Enrich fare lookup (for Fare Range max)

In the fare loop, also read from `rawPayload.fares`:
```
rawPayload.fares.discount_den.total
rawPayload.fares.standard.total
rawPayload.fares.go_wild.total
```
These are already used in `handleViewDest` for enrichment — apply the same pattern here in the card aggregation loop.

## Single file change: `src/pages/FlightMultiDestResults.tsx`

### Patch A — Fare aggregation loop (~line 234)

Add rawPayload fare reading alongside `nFares`:
```typescript
const rp = f.rawPayload ?? {};
const rpFares = rp.fares ?? {};

// Also read rawPayload fares when top-level fares are null
const goWildFare =
  cleanFare(nFares.go_wild) ??
  cleanFare(f.rawPayload?.fares?.go_wild?.total);
const discountDenFare =
  cleanFare(nFares.discount_den) ??
  cleanFare(rpFares.discount_den?.total);
const standardFare =
  cleanFare(nFares.standard) ??
  cleanFare(rpFares.standard?.total);

const nonGoWildFares = [
  discountDenFare,
  standardFare,
  cleanFare(nFares.economy),
  cleanFare(nFares.premium),
  cleanFare(f.price),
];
```

### Patch B — Departure time loop (~line 282)

Add rawPayload fallback after the existing checks:
```typescript
const depStr: string =
  (Array.isArray(f.legs) && f.legs.length > 0 && f.legs[0]?.departure_time
    ? f.legs[0].departure_time
    : null) ??
  (Array.isArray(f.rawPayload?.segments) && f.rawPayload.segments.length > 0
    ? f.rawPayload.segments[0]?.departure_time
    : null) ??
  f.rawPayload?.departure_time ??
  f.departureTime ??
  f.depart_time ??
  "";
```

This ensures:
- Earliest Departure reads the real `"2026-03-15T18:44:00"` ISO time from `rawPayload`
- Fare Range max correctly uses the highest `standard.total` across all flights (e.g. $434.58)
- No other files need changes
