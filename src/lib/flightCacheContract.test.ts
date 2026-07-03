import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_PROVIDER_RESPONSE_BYTES,
  buildFlightCacheIdentity,
  normalizeFlightCacheRequest,
  readFlightCache,
  sha256Hex,
  stableJson,
  validateProviderResponse,
  validateProviderResponseForRequest,
  writeFlightCache,
} from "../../supabase/functions/_shared/flightCache";

const repoRoot = resolve(process.cwd());

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

function createMemoryAdmin() {
  const rows = new Map<string, any>();
  const invalidations: any[] = [];

  const from = (table: string) => {
    expect(table).toBe("flight_search_cache");
    let filters: Record<string, unknown> = {};
    let gtFilter: { column: string; value: string } | null = null;
    let updateValue: Record<string, unknown> | null = null;

    const chain: any = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      },
      gt: (column: string, value: string) => {
        gtFilter = { column, value };
        return chain;
      },
      maybeSingle: async () => {
        const key = `${filters.cache_key}|${filters.reset_bucket}`;
        const row = rows.get(key) ?? null;
        if (!row) return { data: null, error: null };
        if (filters.status && row.status !== filters.status) return { data: null, error: null };
        if (gtFilter && !(String(row[gtFilter.column]) > gtFilter.value)) return { data: null, error: null };
        return { data: row, error: null };
      },
      upsert: async (value: any) => {
        const key = `${value.cache_key}|${value.reset_bucket}`;
        await Promise.resolve();
        rows.set(key, {
          ...value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return { error: null };
      },
      update: (value: Record<string, unknown>) => {
        updateValue = value;
        return chain;
      },
      then: (resolveThen: (value: unknown) => void) => {
        if (updateValue) invalidations.push({ filters, value: updateValue });
        resolveThen({ error: null });
      },
    };
    return chain;
  };

  return { admin: { from }, rows, invalidations };
}

const canonical = normalizeFlightCacheRequest({
  path: "/search",
  method: "POST",
  payload: { origin: "den", destination: "atl", departureDate: "2026-07-04" },
});

describe("flight cache trust boundary", () => {
  it("revokes authenticated and anonymous table access", () => {
    const sql = readFileSync(
      join(repoRoot, "supabase/migrations/20260703010000_lock_down_flight_search_cache.sql"),
      "utf8",
    );
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE public.flight_search_cache FROM anon");
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE public.flight_search_cache FROM authenticated");
    expect(sql).toContain("GRANT ALL PRIVILEGES ON TABLE public.flight_search_cache TO service_role");
  });

  it("contains no direct browser cache read or write", () => {
    const sourceFiles = walkFiles(join(repoRoot, "src"))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => !file.endsWith("flightCacheContract.test.ts"))
      .filter((file) => !file.endsWith("integrations/supabase/types.ts"));
    const offenders = sourceFiles.filter((file) =>
      /from\(["']flight_search_cache["']\)/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("normalizes requests and creates deterministic server-side identities", async () => {
    expect(canonical).toEqual({
      version: 1,
      path: "/search",
      method: "POST",
      origin: "DEN",
      destination: "ATL",
      departureDate: "2026-07-04",
    });
    const first = await buildFlightCacheIdentity(canonical);
    const second = await buildFlightCacheIdentity({ ...canonical });
    expect(first).toEqual(second);
    expect(first.cacheKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("allows trusted server writes and validated reads", async () => {
    const { admin } = createMemoryAdmin();
    const response = { flights: [{ origin: "DEN", destination: "ATL" }] };
    await writeFlightCache(admin, canonical, response, new Date("2026-07-03T12:00:00Z"));
    const hit = await readFlightCache(admin, canonical, new Date("2026-07-03T12:01:00Z"));
    expect(hit?.response).toEqual(response);
    expect(hit?.expiresAt).toBe("2026-07-03T18:00:00.000Z");
  });

  it("rejects malformed, wrong-shape, and oversized provider payloads", () => {
    expect(() => validateProviderResponse(null)).toThrow("MALFORMED_PROVIDER_RESPONSE");
    expect(() => validateProviderResponse("not-json-object")).toThrow("MALFORMED_PROVIDER_RESPONSE");
    expect(() => validateProviderResponseForRequest(canonical, { status: "ok" }))
      .toThrow("MALFORMED_PROVIDER_RESPONSE");
    const oversized = { flights: ["x".repeat(MAX_PROVIDER_RESPONSE_BYTES)] };
    expect(() => validateProviderResponse(oversized)).toThrow("PROVIDER_RESPONSE_TOO_LARGE");
  });

  it("rejects a malformed cached envelope instead of returning it", async () => {
    const { admin, rows, invalidations } = createMemoryAdmin();
    await writeFlightCache(admin, canonical, { flights: [] }, new Date("2026-07-03T12:00:00Z"));
    const identity = await buildFlightCacheIdentity(canonical);
    const key = `${identity.cacheKey}|${identity.resetBucket}`;
    const row = rows.get(key);
    row.payload = { version: 1, response: { status: "poisoned" } };
    const serialized = stableJson(row.payload);
    row.payload_size_bytes = new TextEncoder().encode(serialized).byteLength;
    row.payload_sha256 = await sha256Hex(serialized);

    const hit = await readFlightCache(admin, canonical, new Date("2026-07-03T12:01:00Z"));
    expect(hit).toBeNull();
    expect(invalidations).toHaveLength(1);
  });

  it("does not treat expired records as valid", async () => {
    const { admin } = createMemoryAdmin();
    await writeFlightCache(admin, canonical, { flights: [] }, new Date("2026-07-03T00:00:00Z"));
    const hit = await readFlightCache(admin, canonical, new Date("2026-07-03T07:00:00Z"));
    expect(hit).toBeNull();
  });

  it("uses one unique identity during concurrent writes", async () => {
    const { admin, rows } = createMemoryAdmin();
    await Promise.all([
      writeFlightCache(admin, canonical, { flights: [{ id: "first" }] }),
      writeFlightCache(admin, canonical, { flights: [{ id: "second" }] }),
    ]);
    expect(rows.size).toBe(1);
    const [row] = [...rows.values()];
    expect(row.payload.version).toBe(1);
    expect(row.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.payload_size_bytes).toBe(new TextEncoder().encode(stableJson(row.payload)).byteLength);
  });

  it("does not expose arbitrary cache-key selection through the read endpoint", () => {
    const source = readFileSync(join(repoRoot, "supabase/functions/flight-cache/index.ts"), "utf8");
    expect(source).toContain('.eq("auth_user_id", user.id)');
    expect(source).toContain('body?.purpose === "home_day_trips"');
    expect(source).not.toContain('body?.purpose === "preview"');
    expect(source).not.toMatch(/body\??\.cacheKey|body\??\["cache_key"\]/);
  });

  it("authorizes deliberate searches before cache lookup so hits keep search-count behavior", () => {
    const source = readFileSync(join(repoRoot, "supabase/functions/flight-proxy/index.ts"), "utf8");
    const authorizationIndex = source.indexOf('"authorize_user_search"');
    const cacheReadIndex = source.indexOf("readFlightCache(adminClient, canonical)");
    expect(authorizationIndex).toBeGreaterThan(-1);
    expect(cacheReadIndex).toBeGreaterThan(authorizationIndex);
    expect(source).toContain("billing: billingResult");
  });
});
