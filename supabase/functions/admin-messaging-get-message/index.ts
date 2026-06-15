import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const { message_id } = await req.json() as { message_id: string };
    if (!message_id) return jsonError("message_id required", 400);

    const { data: message, error } = await serviceClient
      .from("messaging_messages")
      .select("*")
      .eq("id", message_id)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!message) return jsonError("Message not found", 404);

    // Delivery summary
    const { data: deliverySummary } = await serviceClient
      .from("messaging_recipients")
      .select("status, channel")
      .eq("message_id", message_id);

    const summary: Record<string, Record<string, number>> = {};
    for (const r of deliverySummary ?? []) {
      const ch = r.channel as string;
      const st = r.status as string;
      if (!summary[ch]) summary[ch] = {};
      summary[ch][st] = (summary[ch][st] ?? 0) + 1;
    }

    return jsonOk({ message, delivery_summary: summary });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
