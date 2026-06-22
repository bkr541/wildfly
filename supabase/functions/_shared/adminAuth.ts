import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface AdminContext {
  userId: string;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}

export async function requireDeveloper(req: Request): Promise<AdminContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonError("Missing authorization", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: dev } = await serviceClient
    .from("developer_allowlist")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!dev) {
    return jsonError("Forbidden", 403);
  }

  return { userId: user.id, userClient, serviceClient };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting-specific access guard.
//
// Phase 1: delegates to requireDeveloper (developer_allowlist table).
// Phase 2 (future): replace this body with a `reports.run` capability check
// against a user_permissions table without rewriting any handler.
// All four reporting Edge Functions import this function, not requireDeveloper
// directly, so the future upgrade is a one-line change here.
// ─────────────────────────────────────────────────────────────────────────────

export async function requireReportingAccess(req: Request): Promise<AdminContext | Response> {
  // Future: check `reports.run` permission instead of developer_allowlist.
  return requireDeveloper(req);
}

export function jsonError(message: string, status: number, code?: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code: code ?? `HTTP_${status}`, message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function jsonOk(data: unknown): Response {
  return new Response(
    JSON.stringify({ success: true, data }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}
