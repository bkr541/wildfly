
## What's Being Removed

Four things to delete/clean up:

**Files to delete:**
- `src/components/account/design/FlightResultsV2Screen.tsx`
- `src/components/account/design/FlightResultsV3Screen.tsx`
- `src/components/account/design/FlightResultsV4Screen.tsx`

**`DeveloperToolsScreen.tsx` changes (single file):**
1. Remove 3 imports: `FlightResultsV2Screen`, `FlightResultsV3Screen`, `FlightResultsV4Screen`
2. Remove the 3 `if (activeDesignScreen === "flight-results-v2/v3/v4")` render guards (lines 127–135)
3. Remove `"flight-results-v2"`, `"flight-results-v3"`, `"flight-results-v4"` from the `FULLSCREEN_SCREENS` array (line 75)
4. Remove those 3 entries from the Design Hub items array (lines 239–253), leaving only `{ key: "flight-results", label: "Playground" }`
5. Remove the entire **ATL Snapshot** trigger block inside the "Manual Triggers" accordion (lines 357–384) — keep the accordion wrapper/button but remove its inner content, or remove the whole accordion if it only contained ATL Snapshot

**`ApiClientScreen.tsx` changes:**
- Remove the ATL Snapshot entry (`id: "5"`) from the `API_ENDPOINTS` array (lines 113–119)
- Remove its corresponding entry from `DEFAULT_BODIES` if one exists

No other files reference these components. The `scheduledATLSnapshot` edge function does not exist in the repo (not in `supabase/functions/`), so no function file needs deleting.

## Summary of touch points
```text
Files deleted (3):
  src/components/account/design/FlightResultsV2Screen.tsx
  src/components/account/design/FlightResultsV3Screen.tsx
  src/components/account/design/FlightResultsV4Screen.tsx

Files edited (2):
  src/components/account/DeveloperToolsScreen.tsx
    - Remove V2/V3/V4 imports, render guards, FULLSCREEN_SCREENS entries,
      Design Hub menu items, and ATL Snapshot trigger block
  src/components/account/ApiClientScreen.tsx
    - Remove ATL Snapshot from API_ENDPOINTS array
```
