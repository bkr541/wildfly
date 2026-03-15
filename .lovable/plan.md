
## Root Cause

The flight data from `getmydata.fly.dev` has this structure per flight:
- `legs[]` → each leg has **empty** `departure_time` and `arrival_time` (`""`)  
- Real ISO times live in `rawPayload.segments[].departure_time/arrival_time`
- Real fares live in `rawPayload.fares.discount_den.total`, `rawPayload.fares.standard.total`, etc.

When `handleViewDest` in `FlightMultiDestResults` builds the drill-down payload using `card.flights`, it passes these flights as-is with empty leg times. `FlightDestResults` then:
1. Groups flights by departure hour using `flight.legs[0]?.departure_time` → all empty → all fall to hour 0 → all appear under `12:00AM`
2. Displays times using `formatTime(flight.legs[0]?.departure_time)` → empty strings → shows `→` with no times
3. Reports `fares.basic = null` for all flights (since the normalizer didn't pick up `rawPayload.fares`)

## Fix

In `handleViewDest` (inside `FlightMultiDestResults.tsx`), enrich each flight before building the single-dest payload:

**Step 1 — Enrich legs with real ISO times from rawPayload.segments:**
```
For each flight f:
  if f.rawPayload.segments exists and has entries:
    rebuild legs[] using rawPayload.segments[]:
      origin = seg.departure_airport
      destination = seg.arrival_airport
      departure_time = seg.departure_time  (already ISO: "2026-03-15T18:44:00")
      arrival_time = seg.arrival_time
  else if rawPayload.departure_time / rawPayload.arrival_time exist:
    use those for single-leg flights
```

**Step 2 — Enrich fares from rawPayload.fares:**
```
discount_den = rawPayload.fares.discount_den.total
standard = rawPayload.fares.standard.total
basic = lowest non-null of the above (no go_wild in this dataset)
economy = discount_den
premium = standard
```

**Step 3 — Enrich total_duration:**
```
Use rawPayload.total_trip_time if total_duration is not already a clean label
(convert "02:03:00" → "2 hrs 3 min" using existing hhmmssToLabel)
```

**Step 4 — Enrich is_plus_one_day:**
```
Compare first leg departure_time date vs last leg arrival_time date
```

## Implementation

Single file change: `src/pages/FlightMultiDestResults.tsx`

Modify `handleViewDest` to run an enrichment pass on `card.flights` before stringifying:

```typescript
const handleViewDest = (card: DestCard) => {
  const enriched = card.flights.map((f: any) => {
    const rp = f.rawPayload ?? {};
    const segments: any[] = Array.isArray(rp.segments) ? rp.segments : [];

    // Rebuild legs with real ISO times
    const enrichedLegs = segments.length > 0
      ? segments.map((seg: any) => ({
          origin: seg.departure_airport ?? "",
          destination: seg.arrival_airport ?? "",
          departure_time: seg.departure_time ?? "",
          arrival_time: seg.arrival_time ?? "",
        }))
      : (f.legs ?? []).map((leg: any) => ({
          ...leg,
          departure_time: leg.departure_time || rp.departure_time || "",
          arrival_time: leg.arrival_time || rp.arrival_time || "",
        }));

    // Enrich fares
    const rpFares = rp.fares ?? {};
    const discountDen = rpFares.discount_den?.total ?? null;
    const standard = rpFares.standard?.total ?? null;
    const basic = [discountDen, standard].filter(v => v != null).length
      ? Math.min(...[discountDen, standard].filter((v): v is number => v != null))
      : (f.price ?? null);

    // Enrich duration
    const durRaw = rp.total_trip_time ?? f.total_duration ?? f.duration ?? "";

    // is_plus_one_day
    const firstDep = enrichedLegs[0]?.departure_time ?? "";
    const lastArr = enrichedLegs[enrichedLegs.length - 1]?.arrival_time ?? "";
    const plusOne = firstDep && lastArr
      ? new Date(firstDep).toDateString() !== new Date(lastArr).toDateString() &&
        new Date(lastArr) > new Date(firstDep)
      : false;

    return {
      ...f,
      legs: enrichedLegs,
      fares: {
        basic,
        economy: discountDen,
        premium: standard,
        business: null,
        go_wild: null,
        discount_den: discountDen,
        standard: standard,
      },
      total_duration: durRaw,
      is_plus_one_day: plusOne,
    };
  });

  const singlePayload = JSON.stringify({
    response: { flights: enriched },
    departureDate,
    arrivalDate,
    tripType,
    departureAirport,
    arrivalAirport: card.destination,
    fromCache: false,
  });
  onViewDest(singlePayload);
};
```

## What this fixes

- Flight cards will show correct departure → arrival times (e.g. `6:44 PM → 7:47 PM`)
- Timeline will group flights by correct hour bucket (not all under 12:00AM)
- Fare prices will display correctly on the Book button
- `+1 Day` label will appear when overnight connections occur
- `FlightLegTimeline` expanded view will show real segment airports and times
- The second screenshot showing empty flight cards with only duration will be resolved

No other files need changes.
