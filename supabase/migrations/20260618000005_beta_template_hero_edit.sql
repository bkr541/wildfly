-- beta-application-accepted template edits:
--   • h1 color → #17352b (dark body green); font style otherwise unchanged
--   • h1 font → Quicksand (app primary font), tracking-widest (0.1em), leading-none — matching MESSAGING header
--   • Beta Tester badge added between logo and h1
--   • Subtitle paragraph removed from hero
--   • Logo row top padding restored to 28px 32px 0 (matches left)
--   • Hero bottom padding: 60px → 36px (header 24px shorter overall)
--   • background-position: left -20px (raises image 20px, crops top of image)

UPDATE public.messaging_templates
SET
  email_html = $html$<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to the Wildfly Beta</title>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#17352b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dce8e2;">

          <tr>
            <td background="{{app_url}}/assets/messaging/template_beta.png" style="padding:0;background-color:#0f6b4f;background-image:linear-gradient(to bottom,rgba(4,32,22,0.28) 0%,rgba(8,52,36,0.14) 60%,rgba(10,58,40,0.06) 100%),url('{{app_url}}/assets/messaging/template_beta.png');background-size:100% auto;background-position:left -20px;background-repeat:no-repeat;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:28px 32px 0;vertical-align:top;">
                    <img src="{{app_url}}/assets/logo/logo_horizontal.png" width="130" alt="Wildfly" style="display:block;width:130px;max-width:100%;height:auto;">
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 32px 0;">
                    <span style="display:inline-block;padding:6px 14px 6px 10px;background-color:#10B981;border:2px solid #059669;border-radius:9999px;font-family:'Quicksand',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#17352b;line-height:1;">&#9733; Beta Tester</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 32px 36px;">
                    <h1 style="margin:0;font-family:'Quicksand',Arial,sans-serif;font-size:28px;line-height:1;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#17352b;text-shadow:0 1px 5px rgba(0,0,0,0.28);">
                      Your application<br>was accepted
                    </h1>
                  </td>
                </tr>
              </table>
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
  updated_at = now(),
  version    = version + 1
WHERE slug = 'beta-application-accepted';
