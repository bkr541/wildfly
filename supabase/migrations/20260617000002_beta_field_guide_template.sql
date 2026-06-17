-- ============================================================
-- Seed: Beta Application Accepted email template
-- Slug: beta-applicant-selected
-- Triggered by: admin-approve-beta-application edge function
-- ============================================================

INSERT INTO public.messaging_templates (
  slug,
  name,
  description,
  category,
  is_transactional,
  is_active,
  supported_channels,
  available_variables,
  required_variables,
  email_subject,
  email_preheader,
  default_reply_to,
  email_html
)
VALUES (
  'beta-applicant-selected',
  'Beta Application Accepted',
  'Sent when a beta applicant is approved and an account is created. Contains the account activation link and a testing field guide.',
  'transactional',
  true,
  true,
  ARRAY['email'],
  ARRAY['first_name', 'home_airport', 'action_link', 'app_url', 'support_email', 'current_year'],
  ARRAY['first_name', 'action_link'],
  'Welcome, Wildfly Beta Tester — your field guide is inside',
  'Activate your account, test the core workflow, and send feedback from any screen.',
  'wildflyapp@gmail.com',
  $html$<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to the Wildfly Beta</title>
<style>
  html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  table, td { border-collapse: collapse !important; }
  img { border: 0; outline: none; text-decoration: none; display: block; }
  a { text-decoration: none; }
  .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden; mso-hide: all; }
  @media only screen and (max-width: 640px) {
    .email-shell { width: 100% !important; }
    .mobile-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .mobile-stack { display: block !important; width: 100% !important; }
    .mobile-center { text-align: center !important; }
    .mobile-full { width: 100% !important; }
    .mobile-hide { display: none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F4F7F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1A2E2E;">
  <div class="preheader">You are part of the Wildfly beta crew. Here is your activation link and testing field guide.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#F4F7F6;">
    <tr><td align="center" style="padding:34px 12px;">
      <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E1E9E7;box-shadow:0 8px 26px rgba(26,46,46,0.08);">
        <tr>
          <td class="mobile-pad" style="padding:28px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><img src="{{app_url}}/assets/logo/logo_horizontal.png" width="145" alt="Wildfly" style="width:145px;max-width:100%;height:auto;"></td>
                <td align="right"><span style="display:inline-block;color:#059669;font-size:11px;line-height:14px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">Private Beta</span></td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:30px 40px 28px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E9FBF3;border-radius:18px;">
              <tr><td style="padding:28px;">
                <p style="margin:0 0 10px 0;color:#047857;font-size:12px;line-height:16px;font-weight:900;letter-spacing:0.10em;text-transform:uppercase;">Your application was selected</p>
                <h1 style="margin:0 0 14px 0;color:#123A34;font-size:31px;line-height:38px;font-weight:900;letter-spacing:-0.6px;">Welcome to Wildfly&#8217;s beta crew, {{first_name}}.</h1>
                <p style="margin:0;color:#3E625B;font-size:15px;line-height:24px;">You now have Gold beta access. We are inviting you in early because useful products are shaped by real travelers asking real questions, not by a committee polishing buttons in a vacuum.</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 26px 40px;">
            <h2 style="margin:0 0 8px 0;color:#1A2E2E;font-size:21px;line-height:27px;font-weight:900;">Start here</h2>
            <p style="margin:0 0 18px 0;color:#5E7373;font-size:14px;line-height:22px;">Activate your account, set a password, and complete the short onboarding flow.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="mobile-full">
              <tr><td align="center" bgcolor="#059669" style="background-color:#059669;border-radius:999px;">
                <a href="{{action_link}}" style="display:inline-block;padding:15px 29px;color:#FFFFFF;font-size:15px;line-height:18px;font-weight:900;">
                  <span style="color:#FFFFFF;">Create my password and enter Wildfly</span></a>
              </td></tr>
            </table>
            <p style="margin:11px 0 0 0;color:#8B9999;font-size:12px;line-height:18px;">Your application lists <strong style="color:#607474;">{{home_airport}}</strong> as your home airport. You can review your profile during setup.</p>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 28px 40px;">
            <h2 style="margin:0 0 14px 0;color:#1A2E2E;font-size:21px;line-height:27px;font-weight:900;">Your beta field guide</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 11px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E3EAE8;border-radius:13px;">
                    <tr>
                      <td width="52" align="center" valign="top" style="padding:18px 0 18px 16px;"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background-color:#173B3A;color:#FFFFFF;font-size:14px;font-weight:900;">1</span></td>
                      <td style="padding:17px 18px 17px 12px;"><p style="margin:0 0 4px 0;color:#1A2E2E;font-size:15px;line-height:21px;font-weight:900;">Search like you normally would</p><p style="margin:0;color:#617676;font-size:13px;line-height:20px;">In Explore Flights, select One Way, Round Trip, Day Trip, or Multi Day, then add airports and travel dates.</p></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 11px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E3EAE8;border-radius:13px;">
                    <tr>
                      <td width="52" align="center" valign="top" style="padding:18px 0 18px 16px;"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background-color:#173B3A;color:#FFFFFF;font-size:14px;font-weight:900;">2</span></td>
                      <td style="padding:17px 18px 17px 12px;"><p style="margin:0 0 4px 0;color:#1A2E2E;font-size:15px;line-height:21px;font-weight:900;">Challenge the result screen</p><p style="margin:0;color:#617676;font-size:13px;line-height:20px;">Check times, connections, fare options, GoWild availability, and seat counts. Compare them with what you expected to see.</p></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 11px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E3EAE8;border-radius:13px;">
                    <tr>
                      <td width="52" align="center" valign="top" style="padding:18px 0 18px 16px;"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background-color:#173B3A;color:#FFFFFF;font-size:14px;font-weight:900;">3</span></td>
                      <td style="padding:17px 18px 17px 12px;"><p style="margin:0 0 4px 0;color:#1A2E2E;font-size:15px;line-height:21px;font-weight:900;">Explore the intelligence layer</p><p style="margin:0;color:#617676;font-size:13px;line-height:20px;">Open GoWild Insights to study historical airport rankings, route patterns, timing behavior, and seat availability.</p></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E3EAE8;border-radius:13px;">
                    <tr>
                      <td width="52" align="center" valign="top" style="padding:18px 0 18px 16px;"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background-color:#173B3A;color:#FFFFFF;font-size:14px;font-weight:900;">4</span></td>
                      <td style="padding:17px 18px 17px 12px;"><p style="margin:0 0 4px 0;color:#1A2E2E;font-size:15px;line-height:21px;font-weight:900;">Save and share what matters</p><p style="margin:0;color:#617676;font-size:13px;line-height:20px;">Revisit recent searches, organize useful flight results, and share a clean result snapshot when planning with someone else.</p></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 30px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#173B3A;border-radius:16px;">
              <tr><td style="padding:24px;">
                <p style="margin:0 0 6px 0;color:#86E6BC;font-size:12px;line-height:16px;font-weight:900;letter-spacing:0.09em;text-transform:uppercase;">What great feedback looks like</p>
                <h2 style="margin:0 0 10px 0;color:#FFFFFF;font-size:20px;line-height:26px;font-weight:900;">Specific beats perfect.</h2>
                <p style="margin:0 0 11px 0;color:#C8DDDA;font-size:14px;line-height:22px;">Tap the floating green feedback button in the bottom-right corner of any signed-in screen. Choose Bug, Feature Request, Performance, UI/UX, Crash, or Other, then set the severity.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#214A48;border-radius:11px;">
                  <tr><td style="padding:15px 17px;color:#E8F5F2;font-size:13px;line-height:21px;">
                    <strong style="color:#A3E635;">Include:</strong><br>
                    1. The action you took<br>
                    2. The result you expected<br>
                    3. The result you actually saw
                  </td></tr>
                </table>
                <p style="margin:12px 0 0 0;color:#BCD2CE;font-size:12px;line-height:19px;">The form automatically includes your current screen, device, operating system, and browser. Send images or recordings by replying to this email or contacting <a href="mailto:{{support_email}}" style="color:#A3E635;font-weight:900;">{{support_email}}</a>.</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 31px 40px;">
            <p style="margin:0;color:#4F6666;font-size:14px;line-height:23px;">Expect a few rough edges. That is the point of this phase. Report anything that feels incorrect, confusing, slow, missing, or surprisingly useful.</p>
            <p style="margin:18px 0 0 0;color:#1A2E2E;font-size:14px;line-height:22px;font-weight:800;">Thank you for helping shape Wildfly before launch.</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#F8FAF9;border-top:1px solid #E3EAE8;padding:22px 40px;text-align:center;">
            <p style="margin:0;color:#899999;font-size:11px;line-height:17px;">This is a transactional invitation sent because you applied for and were selected to participate in Wildfly beta testing.<br>&#169; {{current_year}} Wildfly</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$
)
ON CONFLICT (slug) DO UPDATE SET
  name                = EXCLUDED.name,
  description         = EXCLUDED.description,
  category            = EXCLUDED.category,
  is_transactional    = EXCLUDED.is_transactional,
  is_active           = EXCLUDED.is_active,
  supported_channels  = EXCLUDED.supported_channels,
  available_variables = EXCLUDED.available_variables,
  required_variables  = EXCLUDED.required_variables,
  email_subject       = EXCLUDED.email_subject,
  email_preheader     = EXCLUDED.email_preheader,
  default_reply_to    = EXCLUDED.default_reply_to,
  email_html          = EXCLUDED.email_html,
  updated_at          = now(),
  version             = messaging_templates.version + 1;
