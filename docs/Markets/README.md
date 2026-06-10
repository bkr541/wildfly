# Markets

## Overview

This directory documents the Frontier market-offerings data pipeline used to keep the app's
route data current.

---

## Files

### `src/data/market_offerings.json`

The **source of truth** for Frontier's station and route data.

This file is currently a static snapshot exported from Frontier's public market-offerings
API. It has two top-level keys:

| Key | Description |
|---|---|
| `marketDetails[]` | Station metadata: `stationCode`, `stationName`, `cityAndCode`, `state`, `stateCode`, `countryCode`, `imageURL`, etc. |
| `markets[]` | Route pairs: `fromStation` (origin IATA) and `toStations[]` (array of destination IATA codes). |

> **This file should be replaced** by the output of the scraping program once it is built.
> After replacing it, run `npm run sync:routes` to regenerate `routes.json`.

---

### `src/data/routes.json`

**Generated file. Do not edit by hand.**

Produced by `scripts/sync-routes-from-market-offerings.mjs` from `market_offerings.json`.

Schema consumed by the app (`useRouteStats`):

```json
{
  "ATL": ["AUS", "BOS", "DEN", "MCO"],
  "DEN": ["ATL", "LAS", "MCO"]
}
```

- Keys are origin IATA codes, sorted alphabetically.
- Values are destination IATA code arrays, sorted alphabetically, deduplicated.

---

## Scripts

| Command | Description |
|---|---|
| `npm run sync:routes` | Regenerate `src/data/routes.json` from `market_offerings.json`. |
| `npm run sync:routes:check` | Check if `routes.json` is in sync; exits nonzero if drift is detected. |

---

## Automation

A GitHub Actions workflow (`.github/workflows/sync-routes.yml`) runs daily at 06:00 UTC and on
manual dispatch. If `routes.json` is out of sync with `market_offerings.json`, it regenerates
the file and commits the change automatically.

To trigger it manually: **Actions → Sync Routes from Market Offerings → Run workflow**.

---

## Future state

Once the Frontier scraper is operational, the update cycle will be:

1. Scraper fetches Frontier's market-offerings endpoint.
2. Scraper writes a new `src/data/market_offerings.json`.
3. `npm run sync:routes` (or the GitHub Action) regenerates `routes.json`.
4. The migration layer (`supabase/migrations/20260609120000_frontier_market_layer.sql`)
   imports the snapshot into `frontier_market_snapshots` and upserts `frontier_routes`.
