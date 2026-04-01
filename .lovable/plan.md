

## Plan: Fix round-trip parsing + build error

### What's broken
1. **`FlightDestResults.tsx`** only reads `parsed.response.flights` — round-trip payloads have `outboundFlights` and `returnFlights` instead, so round-trip results show empty.
2. **Departing/Return tabs** are static (no click handler, no state) — they need to toggle which flight array is displayed.
3. **Build error** in `flight-proxy/index.ts` line 115: `err` is typed `unknown` — needs `(err as Error).message`.

### Changes

**File 1: `supabase/functions/flight-proxy/index.ts`**
- Line 115: cast `err` to `Error` → `(err as Error).message`

**File 2: `src/pages/FlightDestResults.tsx`**

1. **Add state** for the leg tab:
   ```ts
   const [legTab, setLegTab] = useState<"Departing" | "Return">("Departing");
   ```

2. **Update the `useMemo` at ~line 426** to also extract `outboundFlights` and `returnFlights`:
   ```ts
   const outboundFlights = (parsed.response?.outboundFlights ?? []) as ParsedFlight[];
   const returnFlights = (parsed.response?.returnFlights ?? []) as ParsedFlight[];
   const flights = (parsed.response?.flights ?? []) as ParsedFlight[];
   ```

3. **Derive `isRoundTrip`** from tripType or presence of outbound/return arrays.

4. **Derive `activeFlights`**:
   ```ts
   const activeFlights = isRoundTrip
     ? (legTab === "Departing" ? outboundFlights : returnFlights)
     : flights;
   ```

5. **Make the Departing/Return tab row functional**: add `onClick` handlers that call `setLegTab`, apply active styling, and **only show this row for round-trip**.

6. **Replace all downstream usages of `flights`** with `activeFlights` in:
   - `groups` memo (line ~507)
   - `destinationCodes` memo (line ~451)
   - Info tab stats (line ~882)
   - Header counts
   - Any other reference to the `flights` array

7. **Date handling**: when `legTab === "Return"`, use `arrivalDate` as the contextual date for `buildFullDateTime` and display purposes.

### Scope
Only two files touched. No new dependencies.

