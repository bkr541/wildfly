import { useState, useRef } from "react";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";

const TABLE_ORDER = [
  "locations",
  "airports",
  "users",
  "user_flights",
] as const;

const EXPECTED_COUNTS: Record<string, number> = {
  locations: 154,
  airports: 72,
  users: 9,
  user_flights: 2,
};

type TableResult = {
  table: string;
  sourceCount: number;
  inserted: number;
  skipped: number;
  errors: string[];
  status: "pending" | "running" | "done" | "error";
};

const BATCH_SIZE = 200;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Map SQLite boolean integers to actual booleans for PG
function mapRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const mapped = { ...row };

  // Convert JSON string fields to parsed objects for jsonb columns
  if (table === "user_events" || table === "user_flights") {
    if (typeof mapped.snapshot_json === "string") {
      try {
        mapped.snapshot_json = JSON.parse(mapped.snapshot_json as string);
      } catch {
        // keep as-is
      }
    }
  }

  // Boolean fields in user_flights
  if (table === "user_flights") {
    if (mapped.gowild_eligible !== null && mapped.gowild_eligible !== undefined) {
      mapped.gowild_eligible = Boolean(mapped.gowild_eligible);
    }
    if (mapped.nonstop !== null && mapped.nonstop !== undefined) {
      mapped.nonstop = Boolean(mapped.nonstop);
    }
  }

  return mapped;
}

function getColumnNames(db: SqlJsDatabase, table: string): string[] {
  const info = db.exec(`PRAGMA table_info(${table})`);
  if (!info.length) return [];
  return info[0].values.map((row) => row[1] as string);
}

function readTable(db: SqlJsDatabase, table: string): Record<string, unknown>[] {
  const cols = getColumnNames(db, table);
  const result = db.exec(`SELECT * FROM ${table}`);
  if (!result.length) return [];
  return result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    return mapRow(table, obj);
  });
}

export default function AdminImport() {
  const [results, setResults] = useState<TableResult[]>([]);
  const [running, setRunning] = useState(false);
  const [verification, setVerification] = useState<{ table: string; expected: number; actual: number; match: boolean }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const runImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return alert("Please select a site.db file");

    setRunning(true);
    setVerification([]);

    // Initialize sql.js
    const SQL = await initSqlJs({
      locateFile: (f: string) => `https://sql.js.org/dist/${f}`,
    });

    const buf = await file.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buf));

    const tableResults: TableResult[] = TABLE_ORDER.map((t) => ({
      table: t,
      sourceCount: 0,
      inserted: 0,
      skipped: 0,
      errors: [],
      status: "pending" as const,
    }));
    setResults([...tableResults]);

    for (let i = 0; i < TABLE_ORDER.length; i++) {
      const table = TABLE_ORDER[i];
      tableResults[i].status = "running";
      setResults([...tableResults]);

      try {
        const rows = readTable(db, table);
        tableResults[i].sourceCount = rows.length;

        if (rows.length === 0) {
          tableResults[i].status = "done";
          setResults([...tableResults]);
          continue;
        }

        // Delete existing data first for idempotent import
        // Use raw fetch to avoid TypeScript issues with dynamic table names
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        // Delete all rows from table
        await fetch(`${supabaseUrl}/rest/v1/${table}?id=gte.0`, {
          method: "DELETE",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
        });


        // Insert in batches using fetch
        const batches = chunkArray(rows, BATCH_SIZE);
        for (const batch of batches) {
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(batch),
          });

          if (!res.ok) {
            const errText = await res.text();
            tableResults[i].errors.push(errText);
          } else {
            tableResults[i].inserted += batch.length;
          }
        }

        tableResults[i].status = tableResults[i].errors.length ? "error" : "done";
      } catch (err: any) {
        tableResults[i].errors.push(err.message || String(err));
        tableResults[i].status = "error";
      }

      setResults([...tableResults]);
    }

    // Verification: count rows in each table
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const verResults: typeof verification = [];
    for (const table of TABLE_ORDER) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
        method: "HEAD",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "count=exact",
        },
      });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] ?? "0", 10);
      verResults.push({
        table,
        expected: EXPECTED_COUNTS[table],
        actual: count ?? 0,
        match: count === EXPECTED_COUNTS[table],
      });
    }
    setVerification(verResults);

    db.close();
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin – SQLite Import</h1>

      <div className="mb-6 space-y-4">
        <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Select site.db file
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".db,.sqlite,.sqlite3"
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground hover:file:bg-muted"
        />
        <button
          onClick={runImport}
          disabled={running}
          className="px-6 py-3 rounded-lg bg-foreground text-background font-bold text-sm tracking-widest uppercase disabled:opacity-50"
        >
          {running ? "Importing…" : "Run Import"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2 mb-8">
          <h2 className="text-lg font-semibold mb-3">Import Progress</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left p-3">Table</th>
                  <th className="text-right p-3">Source</th>
                  <th className="text-right p-3">Inserted</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.table} className="border-t border-border">
                    <td className="p-3 font-mono">{r.table}</td>
                    <td className="p-3 text-right">{r.sourceCount}</td>
                    <td className="p-3 text-right">{r.inserted}</td>
                    <td className="p-3">
                      {r.status === "pending" && <span className="text-muted-foreground">—</span>}
                      {r.status === "running" && <span className="text-accent-yellow">⏳ Running</span>}
                      {r.status === "done" && <span className="text-accent-blue">✅ Done</span>}
                      {r.status === "error" && (
                        <span className="text-destructive" title={r.errors.join("; ")}>
                          ❌ {r.errors[0]?.slice(0, 60)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {verification.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold mb-3">Verification</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left p-3">Table</th>
                  <th className="text-right p-3">Expected</th>
                  <th className="text-right p-3">Actual</th>
                  <th className="text-left p-3">Match</th>
                </tr>
              </thead>
              <tbody>
                {verification.map((v) => (
                  <tr key={v.table} className="border-t border-border">
                    <td className="p-3 font-mono">{v.table}</td>
                    <td className="p-3 text-right">{v.expected}</td>
                    <td className="p-3 text-right">{v.actual}</td>
                    <td className="p-3">{v.match ? "✅" : "❌"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-10 p-4 bg-secondary rounded-lg text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground mb-2">How to re-run import in Test vs Live</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Test:</strong> Navigate to <code>/admin/import</code> in the preview, upload site.db, click "Run Import".</li>
          <li><strong>Live:</strong> First publish the app, then visit the published URL at <code>/admin/import</code> and run the same flow.</li>
          <li>The import is idempotent — it deletes existing rows before inserting, so re-running is safe.</li>
        </ul>
      </div>
    </div>
  );
}
