#!/usr/bin/env node
/**
 * Reads src/data/market_offerings.json and regenerates src/data/routes.json.
 *
 * Usage:
 *   node scripts/sync-routes-from-market-offerings.mjs          # write file
 *   node scripts/sync-routes-from-market-offerings.mjs --check  # compare only, exit 1 if drift
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CHECK_MODE = process.argv.includes("--check");

// ── Read source ──────────────────────────────────────────────────────────────

const sourcePath = resolve(ROOT, "src/data/market_offerings.json");
let raw;
try {
  raw = readFileSync(sourcePath, "utf-8");
} catch (e) {
  console.error(`[sync-routes] ERROR: Cannot read ${sourcePath}`);
  console.error(`               ${e.message}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error(`[sync-routes] ERROR: Failed to parse market_offerings.json`);
  console.error(`               ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(parsed?.markets)) {
  console.error(
    '[sync-routes] ERROR: market_offerings.json must have a top-level "markets" array',
  );
  process.exit(1);
}

// ── Build route map ──────────────────────────────────────────────────────────

const intermediate = {};
let skipped = 0;

for (const market of parsed.markets) {
  if (
    !market ||
    typeof market.fromStation !== "string" ||
    !Array.isArray(market.toStations)
  ) {
    console.warn(
      `[sync-routes] WARN: Skipping malformed entry: ${JSON.stringify(market)}`,
    );
    skipped++;
    continue;
  }

  const origin = market.fromStation.trim().toUpperCase();
  if (!origin) {
    console.warn(`[sync-routes] WARN: Skipping entry with empty fromStation`);
    skipped++;
    continue;
  }

  if (!intermediate[origin]) intermediate[origin] = new Set();
  for (const dest of market.toStations) {
    if (typeof dest === "string" && dest.trim()) {
      intermediate[origin].add(dest.trim().toUpperCase());
    } else {
      console.warn(
        `[sync-routes] WARN: Skipping non-string destination in ${origin}: ${JSON.stringify(dest)}`,
      );
    }
  }
}

// Sort origins and destinations alphabetically
const routeMap = {};
for (const key of Object.keys(intermediate).sort()) {
  routeMap[key] = [...intermediate[key]].sort();
}

const output = JSON.stringify(routeMap, null, 2) + "\n";
const outputPath = resolve(ROOT, "src/data/routes.json");

const origins = Object.keys(routeMap).length;
const pairs = Object.values(routeMap).reduce((sum, dests) => sum + dests.length, 0);

// ── Write or check ───────────────────────────────────────────────────────────

if (CHECK_MODE) {
  let current;
  try {
    current = readFileSync(outputPath, "utf-8");
  } catch (e) {
    console.error(`[sync-routes] ERROR: Cannot read ${outputPath} for comparison`);
    console.error(`               ${e.message}`);
    process.exit(1);
  }

  if (output === current) {
    console.log(
      `[sync-routes] OK  routes.json is up to date (${origins} origins, ${pairs} pairs)`,
    );
    process.exit(0);
  } else {
    console.error(`[sync-routes] FAIL routes.json is out of sync with market_offerings.json`);
    console.error(`[sync-routes]      Run: npm run sync:routes`);
    process.exit(1);
  }
} else {
  writeFileSync(outputPath, output, "utf-8");
  console.log(`[sync-routes] Written: ${outputPath}`);
  console.log(`[sync-routes]   Origins:     ${origins}`);
  console.log(`[sync-routes]   Route pairs: ${pairs}`);
  if (skipped > 0) {
    console.log(`[sync-routes]   Skipped (malformed): ${skipped}`);
  }
}
