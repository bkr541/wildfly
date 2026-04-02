

## Plan: Fix off-by-one date display in FlightDestResults

### Root cause

`departureDate` is a plain date string like `"2025-04-17"`. When passed to `new Date("2025-04-17")`, JavaScript parses it as **UTC midnight**. In any US timezone, that's the **previous evening** (April 16th), so `toLocaleDateString` shows "Thu, Apr 16" instead of "Fri, Apr 17".

This is the classic JS date-string timezone pitfall.

### Fix

**File: `src/pages/FlightDestResults.tsx`**

Every place that does `new Date(departureDate)` or `new Date(arrivalDate)` for display needs to either:
- Append `T12:00:00` to force a noon local parse, or
- Pass `{ timeZone: "UTC" }` to `toLocaleDateString`

The simplest and safest fix: add `timeZone: "UTC"` to the `toLocaleDateString` options wherever these date-only strings are displayed. There are at least two spots:

1. **Line ~781** (hero pill): `new Date(departureDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })` — add `timeZone: "UTC"`
2. **Line ~932** (Info tab): `{departureDate}` raw string display — this one shows the raw `yyyy-MM-dd` string so it's correct, but if it were also formatted, same fix applies
3. Any other `new Date(departureDate)` or `new Date(arrivalDate)` used for display

### Scope
Single file, single-line fix per occurrence. No logic changes.

