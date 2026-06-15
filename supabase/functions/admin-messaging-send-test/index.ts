import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/messagingProvider.ts";
import { renderTemplate } from "../_shared/messagingRenderer.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { userId, serviceClient } = ctx;

  try {
    const {
      message_id,
      test_addresses,
      sample_vars = {},
    } = await req.json() as {
      message_id: string;
      test_addresses: string[];
      sample_vars?: Record<string, string>;
    };

    if (!message_id) return jsonError("message_id required", 400);
    if (!test_addresses?.length) return jsonError("test_addresses required", 400);

    const { data: msg } = await serviceClient
      .from("messaging_messages")
      .select("email_subject, email_html, email_text, reply_to, internal_name")
      .eq("id", message_id)
      .maybeSingle();

    if (!msg) return jsonError("Message not found", 404);

    const fromName = Deno.env.get("MESSAGING_FROM_NAME") || "Wildfly";
    const fromEmail = Deno.env.get("MESSAGING_FROM_EMAIL") || "";
    const replyTo = (msg.reply_to as string) || "wildflyapp@gmail.com";

    const results: Array<{ address: string; success: boolean; error?: string }> = [];

    for (const address of test_addresses.slice(0, 5)) {
      const testVars = {
        ...sample_vars,
        first_name: sample_vars.first_name || "Test User",
        email: address,
        app_url: Deno.env.get("MESSAGING_APP_URL") || "https://wildflyapp.com",
        support_email: Deno.env.get("MESSAGING_SUPPORT_EMAIL") || "wildflyapp@gmail.com",
        unsubscribe_url: "#unsubscribe",
      };

      const subject = `[TEST] ${renderTemplate(msg.email_subject as string || "Test Email", testVars)}`;
      const html = msg.email_html ? renderTemplate(msg.email_html as string, testVars) : "<p>Test email</p>";
      const text = msg.email_text ? renderTemplate(msg.email_text as string, testVars) : undefined;

      const result = await sendEmail({ fromName, fromEmail, replyTo, to: address, subject, html, text });
      results.push({ address, success: result.success, error: result.error });
    }

    await serviceClient.from("messaging_audit_log").insert({
      actor_id: userId, action: "test_sent",
      entity_type: "messaging_message", entity_id: message_id,
      metadata: { test_addresses: test_addresses.slice(0, 5), results: results.map((r) => ({ address: r.address, success: r.success })) },
    });

    return jsonOk({ results });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
