import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin DB Push — paste raw SQL (DDL / RPC create / inserts) and execute it
 * against the project database via the `admin-run-sql` edge function.
 *
 * Gated by AdminGate (developer_allowlist). The edge function re-checks
 * the allowlist server-side before calling the `admin_exec_ddl` SQL function.
 */
export default function AdminDbPush() {
  const [sql, setSql] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleRun = async () => {
    setRunning(true);
    setResult("");
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-run-sql", {
        body: { sql },
      });
      if (fnError) {
        setError(fnError.message || "Function invocation failed");
      } else if (data?.success === false) {
        setError(data?.error?.message || "Execution failed");
      } else {
        setResult(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7F7] p-6">
      <div className="mx-auto max-w-[960px] space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2B2B]">DB Push</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Paste SQL (DDL, RPC creates, grants, policies, inserts) and execute it directly
            against the project database. Runs inside a single <code>EXECUTE</code> call.
          </p>
        </div>

        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="-- Paste SQL here&#10;CREATE TABLE public.example (id uuid primary key);"
          spellCheck={false}
          className="w-full h-[420px] rounded-xl border border-[#E5E7EB] bg-white p-4 font-mono text-[13px] leading-relaxed text-[#1C2B2B] focus:outline-none focus:border-[#345C5A]"
          style={{ fontSize: "16px" }}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={running || !sql.trim()}
            className="rounded-xl bg-[#345C5A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {running ? "Running…" : "Run SQL"}
          </button>
          <button
            type="button"
            onClick={() => { setSql(""); setResult(""); setError(""); }}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151]"
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap font-mono">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 text-sm text-[#1C2B2B] whitespace-pre-wrap font-mono">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
