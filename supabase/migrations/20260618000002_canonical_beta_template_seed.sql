-- ============================================================
-- Phase 2: Guarantee the canonical beta-application-accepted
-- template exists in every environment (fresh or migrated).
--
-- Strategy: ON CONFLICT (slug) DO UPDATE so the migration is
-- idempotent and safe to re-run. The GREATEST() guard on
-- version prevents rolling back an admin-edited version to an
-- older migration value.
--
-- Phase 3 companion: sets archived_at on the legacy template
-- (the prior migration only set is_active = false).
-- ============================================================

-- 1. Upsert the canonical template with complete content.
--    ON CONFLICT targets the existing UNIQUE constraint on slug.
INSERT INTO public.messaging_templates (
  slug,
  name,
  description,
  category,
  is_active,
  is_transactional,
  supported_channels,
  email_subject,
  email_preheader,
  email_html,
  email_text,
  email_cta_label,
  email_cta_url,
  default_reply_to,
  available_variables,
  required_variables,
  version
)
VALUES (
  'beta-application-accepted',
  'Beta Application Accepted',
  'Sent when a beta applicant is approved and an account is created. Contains the account activation link.',
  'transactional',
  true,
  true,
  ARRAY['email'],
  'Welcome to the Wildfly Beta — your account is ready',
  'Create your password and start exploring smarter flight search.',
  $html$<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to the Wildfly Beta</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#17352b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dce8e2;">

          <tr>
            <td background="{{app_url}}/assets/messaging/template_beta.png" style="padding:32px;background-color:#0f6b4f;background-image:linear-gradient(to bottom,rgba(4,32,22,0.28) 0%,rgba(8,52,36,0.14) 60%,rgba(10,58,40,0.06) 100%),url('{{app_url}}/assets/messaging/template_beta.png');background-size:100% auto;background-position:left top;background-repeat:no-repeat;color:#ffffff;">
              <img src="{{app_url}}/assets/logo/logo_horizontal.png" width="130" alt="Wildfly" style="display:block;width:130px;max-width:100%;height:auto;margin-bottom:22px;">
              <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.15;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#10B981;text-shadow:0 1px 5px rgba(0,0,0,0.28);">
                Your application was accepted
              </h1>
              <p style="margin:0;font-size:16px;line-height:1.6;font-weight:500;color:rgba(255,255,255,0.82);text-shadow:0 1px 3px rgba(0,0,0,0.2);">
                You have been selected to help test Wildfly before its wider release.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 18px;font-size:17px;line-height:1.7;">
                Hi {{first_name}},
              </p>

              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#365d50;">
                Welcome aboard! Your application to join the Wildfly beta program has been accepted.
              </p>

              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#365d50;">
                Wildfly is designed to make Frontier and GoWild flight discovery faster, clearer, and less dependent on repeatedly searching the same routes by hand.
              </p>

              <div style="margin:0 0 26px;padding:22px;background-color:#f1f7f4;border-radius:14px;border:1px solid #d9e9e1;">
                <div style="margin:0 0 12px;font-size:15px;font-weight:700;color:#17352b;">
                  During the beta, you can:
                </div>

                <ul style="margin:0;padding-left:22px;color:#365d50;font-size:15px;line-height:1.8;">
                  <li>Search one-way, round-trip, day-trip, and multi-day flights</li>
                  <li>Search multiple airports or explore available destinations</li>
                  <li>Identify flights with GoWild fares and available GoWild seats</li>
                  <li>Compare routes, departure times, fares, and connections</li>
                  <li>Explore GoWild availability and route insights</li>
                  <li>Save, organize, and share flight-search results</li>
                </ul>
              </div>

              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#365d50;">
                Your beta account includes Gold access, giving you access to Wildfly's available search and insight features while you help us test the app.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
                <tr>
                  <td align="center" bgcolor="#0f6b4f" style="border-radius:10px;">
                    <a
                      href="{{account_cta_url}}"
                      style="display:inline-block;padding:15px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;"
                    >
                      {{account_cta_label}}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;text-align:center;font-size:13px;line-height:1.6;color:#6b8178;">
                Button not working? Copy and paste this link into your browser:<br>
                <a href="{{account_cta_url}}" style="color:#0f6b4f;word-break:break-all;">
                  {{account_cta_url}}
                </a>
              </p>

              <div style="margin:0 0 24px;padding:22px;border-left:4px solid #0f6b4f;background-color:#f8faf9;">
                <div style="margin:0 0 8px;font-size:15px;font-weight:700;">
                  What feedback helps most?
                </div>

                <p style="margin:0;font-size:15px;line-height:1.7;color:#4e6d62;">
                  Tell us about incorrect flight data, unexpected search results, confusing controls, useful features, and improvements that would make Wildfly more helpful.
                </p>
              </div>

              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#365d50;">
                Wildfly is still in active development, so you may encounter a few rough edges. That is exactly what the beta is designed to uncover.
              </p>

              <p style="margin:0;font-size:16px;line-height:1.7;color:#365d50;">
                Questions or feedback can be sent to
                <a href="mailto:{{support_email}}" style="color:#0f6b4f;">
                  {{support_email}}
                </a>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;background-color:#f1f7f4;border-top:1px solid #dce8e2;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b8178;">
                You received this message because you applied to participate in the Wildfly beta program.
              </p>
              <p style="margin:0;font-size:13px;color:#6b8178;">
                Wildfly · {{physical_address}}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  $txt$Welcome to the Wildfly Beta — {{first_name}}

Your application to join the Wildfly beta program has been accepted. Your beta account includes Gold access.

To create your password and get started, visit:
{{account_cta_url}}

During the beta, you can:
- Search one-way, round-trip, day-trip, and multi-day flights
- Search multiple airports or explore available destinations
- Identify flights with GoWild fares and available GoWild seats
- Compare routes, departure times, fares, and connections
- Explore GoWild availability and route insights
- Save, organize, and share flight-search results

What feedback helps most? Tell us about incorrect flight data, unexpected search results, confusing controls, and features that would make Wildfly more useful.

Questions or feedback: {{support_email}}

You received this message because you applied to the Wildfly beta program.
Wildfly · {{physical_address}}$txt$,
  '{{account_cta_label}}',
  '{{account_cta_url}}',
  'wildflyapp@gmail.com',
  ARRAY[
    'first_name', 'last_name', 'full_name', 'email',
    'recipient_name', 'recipient_email',
    'home_airport', 'app_name', 'app_url',
    'account_cta_label', 'account_cta_url', 'action_link',
    'support_email', 'physical_address', 'current_year'
  ],
  ARRAY['first_name', 'account_cta_label', 'account_cta_url', 'support_email'],
  1
)
ON CONFLICT (slug) DO UPDATE SET
  name                = EXCLUDED.name,
  description         = EXCLUDED.description,
  is_active           = true,
  is_transactional    = EXCLUDED.is_transactional,
  supported_channels  = EXCLUDED.supported_channels,
  email_subject       = EXCLUDED.email_subject,
  email_preheader     = EXCLUDED.email_preheader,
  email_html          = EXCLUDED.email_html,
  email_text          = EXCLUDED.email_text,
  email_cta_label     = EXCLUDED.email_cta_label,
  email_cta_url       = EXCLUDED.email_cta_url,
  default_reply_to    = EXCLUDED.default_reply_to,
  available_variables = EXCLUDED.available_variables,
  required_variables  = EXCLUDED.required_variables,
  version             = GREATEST(public.messaging_templates.version, EXCLUDED.version),
  updated_at          = NOW();

-- 2. Fully archive the legacy template: set archived_at so the
--    normal template list (which filters archived_at IS NULL)
--    hides it automatically.
UPDATE public.messaging_templates
SET
  archived_at = COALESCE(archived_at, NOW()),
  is_active   = false,
  updated_at  = NOW()
WHERE slug = 'beta-applicant-selected';
