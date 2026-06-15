import { handleCors, requireDeveloper, jsonOk, jsonError } from "../_shared/adminAuth.ts";
import { resolveAudience, AudienceFilter } from "../_shared/messagingAudience.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const ctx = await requireDeveloper(req);
  if (ctx instanceof Response) return ctx;
  const { serviceClient } = ctx;

  try {
    const {
      filter_definition,
      classification = "non_transactional",
      channels = ["email"],
      sample_size = 10,
    } = await req.json() as {
      filter_definition: AudienceFilter;
      classification?: string;
      channels?: string[];
      sample_size?: number;
    };

    if (!filter_definition) return jsonError("filter_definition required", 400);

    const { recipients, eligible_count, suppressed_count, invalid_count } =
      await resolveAudience(
        serviceClient,
        filter_definition,
        classification as "transactional" | "non_transactional",
        channels
      );

    // Return a sample without personalization data in preview
    const sample = recipients.slice(0, sample_size).map((r) => ({
      email: r.email,
      recipient_name: r.recipient_name,
      user_id: r.user_id,
      beta_application_id: r.beta_application_id,
    }));

    // Update last_estimated_count if audience_id provided
    const { audience_id } = await req.json().catch(() => ({})) as { audience_id?: string };
    if (audience_id) {
      await serviceClient
        .from("messaging_audiences")
        .update({ last_estimated_count: eligible_count, last_estimated_at: new Date().toISOString() })
        .eq("id", audience_id);
    }

    return jsonOk({
      total_count: recipients.length + suppressed_count + invalid_count,
      eligible_count,
      suppressed_count,
      invalid_count,
      sample,
    });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
});
