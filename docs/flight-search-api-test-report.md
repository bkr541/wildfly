# Flight Search API — Test Report
**Generated:** 2026-03-11  
**Methodology:** Static code analysis of `src/pages/Flights.tsx` + endpoint contracts.  
> Note: Browser-based execution testing was blocked by authentication (login required). All call paths were traced through code.

---

## Summary Table

| # | Trip Type | Origin | Destination | Search All | Expected Endpoint | Expected HTTP Method | Status |
|---|-----------|--------|-------------|------------|-------------------|----------------------|--------|
| 1 | One Way | Single IATA (e.g. ATL) | Single IATA (e.g. MCO) | OFF | `getmydata.fly.dev/api/flights/search` | POST | ✅ Correct path |
| 2 | One Way | Single IATA (e.g. ATL) | None (empty) | ON | `supabase.functions.invoke("getAllDestinations")` | POST (edge fn) | ⚠️ **BUG: Edge fn was deleted** |
| 3 | One Way | CITY prefix (e.g. CITY:CHICAGO) | Single IATA | OFF | `getmydata.fly.dev/api/flights/search` | POST | ✅ Correct path |
| 4 | One Way | CITY prefix | None | ON | `supabase.functions.invoke("getAllDestinations")` | POST (edge fn) | ⚠️ **BUG: Edge fn was deleted** |
| 5 | Round Trip | Single IATA | Single IATA | OFF | `getmydata.fly.dev/api/flights/search` | POST | ⚠️ **BUG: Wrong endpoint used** |
| 6 | Round Trip | CITY prefix | Single IATA | OFF | `getmydata.fly.dev/api/flights/search` | POST | ⚠️ **BUG: Wrong endpoint used** |
| 7 | Day Trip | Single IATA | None (not applicable) | OFF | `getmydata.fly.dev/api/flights/search` | POST | ⚠️ **BUG: Wrong endpoint used** |
| 8 | Multi Day | Single IATA | Single IATA | OFF | `getmydata.fly.dev/api/flights/search` | POST | ✅ Acceptable (no dedicated endpoint) |

---

## Detailed Call Path Analysis

### TEST 1 — One Way · Single Origin → Single Destination
**Inputs:** `tripType=one-way`, `departures=[ATL]`, `arrivals=[MCO]`, `searchAll=false`, `departureDate=2026-04-01`

**Code path (Flights.tsx ~L898-L924):**
```
originCode = "ATL"
destinationCode = "MCO"
searchAll = false

→ fetch("https://getmydata.fly.dev/api/flights/search", {
    method: "POST",
    body: { origin: "ATL", destination: "MCO", departureDate: "2026-04-01" }
  })

→ normalizeGetMyDataResponse(data, "2026-04-01")
→ onNavigate("flight-results", payload)
```
**Result:** ✅ **PASS** — Correct endpoint, correct parameters.

---

### TEST 2 — One Way · Single Origin → Search All Destinations
**Inputs:** `tripType=one-way`, `departures=[ATL]`, `arrivals=[]`, `searchAll=true`, `departureDate=2026-04-01`

**Code path (Flights.tsx ~L893-L897):**
```
searchAll = true

→ supabase.functions.invoke("getAllDestinations", {
    body: { departureAirport: "ATL", departureDate: "2026-04-01" }
  })
```
**Result:** ❌ **FAIL** — `getAllDestinations` edge function was deleted. This will throw a 404/error. The call should instead go to `https://getmydata.fly.dev/api/flights/search` (POST) with `{ origin: "ATL", departureDate: "2026-04-01" }` and **no** `destination` field (which is how the external API handles "all destinations").

---

### TEST 3 — One Way · Multi-Airport City Origin → Single Destination
**Inputs:** `tripType=one-way`, `departures=[ORD, MDW]` (both Chicago), `arrivals=[MCO]`, `searchAll=false`, `departureDate=2026-04-01`

**Code path:**
```
allSameDepCity = true (both airports share city "Chicago")
originCode = "CITY:Chicago"
destinationCode = "MCO"

→ fetch("https://getmydata.fly.dev/api/flights/search", {
    method: "POST",
    body: { origin: "CITY:Chicago", destination: "MCO", departureDate: "2026-04-01" }
  })
```
**Result:** ✅ **PASS** — Correct CITY: convention, correct endpoint.

---

### TEST 4 — One Way · Multi-Airport City Origin → Search All
**Inputs:** `tripType=one-way`, `departures=[ORD, MDW]`, `arrivals=[]`, `searchAll=true`, `departureDate=2026-04-01`

**Code path:**
```
searchAll = true
originCode = "CITY:Chicago"

→ supabase.functions.invoke("getAllDestinations", {
    body: { departureAirport: "CITY:Chicago", departureDate: "2026-04-01" }
  })
```
**Result:** ❌ **FAIL** — Same as Test 2. `getAllDestinations` edge function no longer exists.

---

### TEST 5 — Round Trip · Single Origin → Single Destination
**Inputs:** `tripType=round-trip`, `departures=[ATL]`, `arrivals=[MCO]`, `searchAll=false`, `departureDate=2026-04-01`, `arrivalDate=2026-04-05`

**Code path (Flights.tsx ~L900-L923):**
```
tripType = "round-trip"
body = { origin: "ATL", destination: "MCO", departureDate: "2026-04-01", returnDate: "2026-04-05" }

→ fetch("https://getmydata.fly.dev/api/flights/search", { method: "POST", body })

→ normalizeGetMyDataResponse(data, "2026-04-01")
```
**Result:** ⚠️ **WRONG ENDPOINT** — The `roundDate` is appended to a `/search` call. The specification states Round Trip should use `POST /api/flights/roundTrip` which does `Promise.all` for outbound + return legs simultaneously. The current code sends `returnDate` to `/search`, which may not return both directions.

---

### TEST 6 — Day Trip · Single Origin
**Inputs:** `tripType=day-trip`, `departures=[ATL]`, `arrivals=[]`, `searchAll=false`, `departureDate=2026-04-01`

**Code path:**
```
searchAll = false
destinationCode = "__ALL__"
body = { origin: "ATL", departureDate: "2026-04-01" }
(destination is not added because destinationCode === "__ALL__")

→ fetch("https://getmydata.fly.dev/api/flights/search", { method: "POST", body })

→ normalizeGetMyDataResponse(data, "2026-04-01")
```
**Result:** ⚠️ **WRONG ENDPOINT** — Day Trip should call `GET /api/flights/dayTrips?origin=ATL&date=2026-04-01&nonstop=true&layovertime=6`. The current code hits `/search` (POST) and passes no destination, which is the "Search All" path — not the pairing algorithm that creates valid same-day turnarounds.

---

### TEST 7 — Multi Day · Single Origin → Single Destination
**Inputs:** `tripType=multi-day`, `departures=[ATL]`, `arrivals=[MCO]`, `searchAll=false`, `departureDate=2026-04-01`, `arrivalDate=2026-04-07`

**Code path:**
```
body = { origin: "ATL", destination: "MCO", departureDate: "2026-04-01" }
(returnDate is NOT added because the if-check is `tripType === "round-trip"` only)

→ fetch("https://getmydata.fly.dev/api/flights/search", { method: "POST", body })
```
**Result:** ⚠️ **returnDate not sent** — The multi-day return date is collected in the UI but never passed to the API (L907: `if (tripType === "round-trip" && arrivalDate)`). Acceptable if multi-day only shows outbound, but may be an oversight depending on intent.

---

### TEST 8 — One Way · Single Origin → Multi-Airport City Destination
**Inputs:** `tripType=one-way`, `departures=[ATL]`, `arrivals=[ORD, MDW]` (both Chicago), `searchAll=false`, `departureDate=2026-04-01`

**Code path:**
```
arrCity = "Chicago"
allSameArrCity = true
destinationCode = "CITY:Chicago"

→ fetch("https://getmydata.fly.dev/api/flights/search", {
    method: "POST",
    body: { origin: "ATL", destination: "CITY:Chicago", departureDate: "2026-04-01" }
  })
```
**Result:** ✅ **PASS** — Correct CITY: convention for destination.

---

### TEST 9 — One Way · Single Origin → Inbound (Global → Specific Destination)
**Inputs:** `departures=[]` (empty), `arrivals=[MCO]`, `searchAll=false`

**Code path:**
```
departures.length === 0 → search button check `if (departures.length === 0 || !departureDate) return;`
```
**Result:** ❌ **BLOCKED** — The UI prevents submission if no departure is selected. The `/api/flights/inbound` endpoint (for `🌐 → MCO` scenarios) is **never called** anywhere in the current codebase. The inbound endpoint is documented but unimplemented in the UI.

---

## Issues Found

| Severity | Issue | File | Line(s) |
|----------|-------|------|---------|
| 🔴 Critical | `searchAll=true` still calls deleted `getAllDestinations` edge function | `Flights.tsx` | 893–897 |
| 🔴 Critical | Round Trip uses `/search` instead of `/roundTrip` endpoint | `Flights.tsx` | 907–909 |
| 🔴 Critical | Day Trip uses `/search` instead of `/dayTrips` endpoint | `Flights.tsx` | 893–924 |
| 🟡 Medium | Multi Day does not pass `returnDate` to the API | `Flights.tsx` | 907 |
| 🟡 Medium | `/api/flights/inbound` endpoint is fully unimplemented in the UI | — | — |
| 🟠 Info | `normalizeAllDestinationsResponse` in `normalizeFlights.ts` expects `raw.data.json.flights` (old edge fn shape) — the external API returns `raw.flights` directly | `normalizeFlights.ts` | 203–204 |

---

## Recommended Fixes

### Fix 1 — Search All: Replace edge function call with external API
```typescript
// Flights.tsx ~L893
if (searchAll) {
  // OLD (broken):
  // supabase.functions.invoke("getAllDestinations", { body: ... })
  
  // NEW:
  const res = await fetch("https://getmydata.fly.dev/api/flights/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin: originCode, departureDate: depFormatted }),
  });
  const json = await res.json();
  data = json;
  error = res.ok ? null : new Error(`HTTP ${res.status}`);
}
```

### Fix 2 — Round Trip: Use `/roundTrip` endpoint
```typescript
if (tripType === "round-trip" && arrivalDate) {
  const retFormatted = format(arrivalDate, "yyyy-MM-dd");
  const res = await fetch("https://getmydata.fly.dev/api/flights/roundTrip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: originCode,
      destination: destinationCode,
      departureDate: depFormatted,
      returnDate: retFormatted,
    }),
  });
  const json = await res.json();
  data = json;
  error = res.ok ? null : new Error(`HTTP ${res.status}`);
}
```

### Fix 3 — Day Trip: Use `/dayTrips` GET endpoint
```typescript
if (tripType === "day-trip") {
  const params = new URLSearchParams({
    origin: originCode,
    date: depFormatted,
    nonstop: "true",
    layovertime: "6",
  });
  const res = await fetch(`https://getmydata.fly.dev/api/flights/dayTrips?${params}`);
  const json = await res.json();
  data = json;
  error = res.ok ? null : new Error(`HTTP ${res.status}`);
}
```

---

## Cache Logic — Verified Correct
- Cache key: SHA-256 of `origin|dest|date` ✅
- Cache TTL: 6 hours (`gte("updated_at", sixHoursAgo)`) ✅
- Cache invalidation bucket: 12:01 AM UTC on departure date ✅
- On cache hit: 2-second artificial delay, then navigate ✅
- On cache miss: write normalized response back to cache ✅

## Credit Check — Verified Correct
- Called before every search via `supabase.rpc("consume_search_credits")` ✅
- Parameters: `p_trip_type`, `p_arrival_airports_count`, `p_all_destinations` ✅
- Blocked if `cr.allowed === false` and shows credit error UI ✅

## Search History Logging — Verified Correct
- Logged to `flight_searches` on both cache-hit and cache-miss paths ✅
- `arrival_airport` set to `null` for "Search All" queries ✅
- `trip_type` mapped: `one-way→one_way`, `round-trip→round_trip`, `day-trip→day_trip`, `multi-day→trip_planner` ✅
