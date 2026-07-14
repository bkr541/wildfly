# Flight result sharing

Wildfly stores immutable public flight-result snapshots in the existing
`public.shared_flight_results` table and serves both display-model versions from
`/share/flights/:token`.

## Display-model versions

### Version 1: single destination

Version 1 is the established `FlightShareModel` used by
`FlightDestResults`. It contains the route summary, local hero images, totals,
and grouped flight options required by the existing PNG and public-page views.
Its route, token format, authentication behavior, public renderer, and image
layout remain unchanged.

### Version 2: multiple destinations

Version 2 is `MultiDestShareModelV2`. It stores the exact destination summaries
currently shown by `FlightMultiDestResults`, in the exact `sortedCards` order.
Each destination contains only display-safe aggregate fields such as airport
identity, flight count, fare range, nonstop/GoWild indicators, duration
summary, and departure window.

Version 2 intentionally does not store individual flights, legs, fares, API
responses, page references, credentials, or React values in `displayModel`.
This keeps public data bounded, makes rendering deterministic, and prevents a
public snapshot from becoming a second copy of the search API response. The raw
search response may be sent only as `rawSearchPayload`; the create Edge Function
applies the UTF-8 body limit and recursively removes credentials and headers
before persistence.

## Snapshot semantics

`FlightMultiDestResults` parses its search response once, enriches destination
cards with airport metadata, applies filters, and sorts the result. `sortedCards`
is the authoritative visible destination collection. The version-2 builder uses
that collection for destinations and derives every total from it.

Changing sort order, filters, airport-enriched results, or the underlying search
response changes the snapshot fingerprint and clears any previously generated
URL. A completed request is accepted only if its fingerprint still matches.
Public rendering reads only the stored display model and never reruns a live
flight search.

For version 2, persisted metadata is derived from the display model:

- `all_destinations = true`
- `arrival_airport = null`
- `flight_count = displayModel.totals.flightCount`
- departure airport, dates, and trip type come from the captured model

## Shared route, table, and token boundary

Both versions use:

- Table: `public.shared_flight_results`
- Public route: `/share/flights/:token`
- Authenticated create function: `create-shared-flight-result`
- Anonymous read function: `get-public-shared-flight-result`
- Raw token: 32 random bytes encoded as exactly 64 lowercase hexadecimal
  characters
- Stored token: SHA-256 hash only

The public-read SQL RPC atomically increments `view_count` and projects only the
display model, display-model version, creation timestamp, and expiration
timestamp. Owner identity, token hash, raw search payload, and row ID are not
returned. The browser also rejects malformed tokens before invoking the public
Edge Function. Public pages install `noindex,nofollow` and responses use
`Cache-Control: no-store`.

## Payload limits

The client and create Edge Function both use a 3 MiB limit measured from the
UTF-8 bytes of the serialized JSON request, not JavaScript character count.
The client rejects oversized requests before network invocation. Keep the two
exported constants aligned and retain the parity test when changing this limit.

## PNG export architecture

Both result pages render a fixed-position off-screen template that remains
measurable. Do not use `display: none` or `visibility: hidden` for an export
root. The exporter waits for fonts, local images, image decode, and two animation
frames before capture. Missing images time out or fail open rather than aborting
the full export.

The multi-destination image uses a fixed-width two-column layout to control
height. Pixel ratio is reduced for long templates and bounded by conservative
canvas dimension and pixel budgets. Capture overrides animation, transition,
and transform styles so parallax or entrance states are not serialized.
Filenames are sanitized, length-bounded, and deterministic from route and date.

## Edge Function deployment

Set `PUBLIC_APP_URL` to the canonical public web origin. Do not include secrets
in source or documentation.

```bash
supabase secrets set PUBLIC_APP_URL=https://your-production-origin.example
supabase functions deploy create-shared-flight-result
supabase functions deploy get-public-shared-flight-result --no-verify-jwt
```

`supabase/config.toml` must continue to require JWT verification for the create
function and disable it only for the public-read function. The functions also
validate required Supabase environment variables at runtime.

No new migration is required for version 2. It reuses the existing versioned
columns, immutable-row trigger, RLS policies, and public-read RPC. Apply the
existing flight-search share migration only in environments where that shared
infrastructure has not yet been deployed.

## Adding a future display-model version

1. Define a compact, immutable display-only model and builder.
2. Add strict client and Edge Function schemas with bounded arrays and strings.
3. Extend the discriminated create request without changing existing versions.
4. Derive table metadata from the display model, not live search data.
5. Add a public renderer and branch by `display_model_version`.
6. Extend normalization, forbidden-key, payload, public-boundary, and regression
   tests.
7. Preserve the shared table, token system, route, and version-1 behavior unless
   a separately reviewed migration proves a change is necessary.

Unsupported versions must fail closed with the dedicated public error state.

## Validation

Run from the repository root:

```bash
npm test
npm run build
npm run lint
git diff --check
```

For Edge Functions, also verify Deno-compatible imports and configuration:

```bash
supabase functions serve create-shared-flight-result
supabase functions serve get-public-shared-flight-result --no-verify-jwt
```

Use the repository's configured Supabase project and local environment. Never
commit service-role keys, JWTs, authorization headers, or production secrets.

## Rollback

The client integration, renderers, and Edge Functions can be rolled back without
a data migration because version-1 records are unchanged and version-2 records
remain isolated by `display_model_version`. During rollback, keep the public-read
function capable of returning a clear unsupported-version response for existing
version-2 links. Do not delete the shared table or token RPC as part of a
feature rollback because they are also required by version 1.
