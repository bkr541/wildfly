# Flight cache trust boundary

`public.flight_search_cache` is a globally shared provider-response cache. It is not user data and must never be queried or mutated from browser code. Database privileges and RLS deny `anon` and `authenticated`; only service-role server code may access the table.

The canonical owner is `supabase/functions/_shared/flightCache.ts`:

- `flight-proxy` authenticates deliberate searches, calls `authorize_user_search` once, derives a normalized request and cache key server-side, validates a cache hit, or calls the provider and writes a validated response.
- A deliberate cache hit follows the same current Free/Paid search-count rule as a live provider result. The cache decision does not authorize, refund, or charge separately.
- `flight-cache` exposes only the purpose-scoped, read-only home Day Trips view. It derives the home airport from the authenticated user's server-side profile and accepts only a narrow near-current date window, never a cache key.
- Historical Preview reads the authenticated user's own saved `flight_searches.json_body` under RLS instead of using the global cache.
- Scheduled jobs use the same shared cache module with service-role credentials and remain non-metered according to their existing product behavior.
- The developer-only `clear-flight-cache` function may delete cache rows with service-role credentials after verifying the caller against the server-side developer allowlist; it does not expose row contents.

Cache payloads are versioned provider-response envelopes with a six-hour expiry, a maximum serialized size, and a SHA-256 integrity value. Existing rows were cleared when this boundary was introduced because authenticated clients previously could write them.
