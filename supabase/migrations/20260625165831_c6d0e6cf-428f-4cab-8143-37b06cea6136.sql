
INSERT INTO public.messaging_templates (
  slug, name, description, category, is_active, is_transactional,
  supported_channels, email_subject, email_preheader, email_html, email_text,
  default_reply_to, available_variables, required_variables, version
)
VALUES (
  'home-airport-gowild-forecast',
  'Your Home Airport GoWild Forecast',
  'Recurring email summarising the recipient''s home-airport GoWild availability snapshot, with charts and graphs mirroring the GoWild Insights page.',
  'product',
  true,
  false,
  ARRAY['email'],
  'Your {{home_airport}} GoWild Forecast',
  'Your all-time {{home_airport}} GoWild availability snapshot and forecast.',
  $html$<!doctype html>
<html lang="en" style="color-scheme:light only;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>Your {{home_airport}} GoWild Forecast</title>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light only; }
    @media only screen and (max-width:600px) {
      .wf-outer { padding:0 !important; }
      .wf-card  { border-radius:0 !important; }
      .wf-hero  { background-size:cover !important; background-position:center -20px !important; padding-left:20px !important; padding-right:20px !important; padding-bottom:24px !important; }
      .wf-h1    { font-size:20px !important; letter-spacing:0.06em !important; }
      .wf-badge { padding:10px 20px 0 !important; }
      .wf-body  { padding:24px 20px !important; }
      .wf-foot  { padding:20px !important; }
      .wf-metric-label { font-size:12px !important; }
      .wf-metric-value { font-size:15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#17352b;color-scheme:light only;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7f5;">
    <tr>
      <td align="center" class="wf-outer" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="wf-card" style="max-width:640px;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dce8e2;">
          <tr>
            <td class="wf-hero" background="{{app_url}}/assets/messaging/template_beta.png" style="padding:0;background-color:#0f6b4f;background-image:linear-gradient(to bottom,rgba(4,32,22,0.28) 0%,rgba(8,52,36,0.14) 60%,rgba(10,58,40,0.06) 100%),url('{{app_url}}/assets/messaging/template_beta.png');background-size:100% auto;background-position:left -20px;background-repeat:no-repeat;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="padding:28px 32px 0;vertical-align:top;"><img src="{{app_url}}/assets/logo/logo_horizontal.png" width="130" alt="Wildfly" style="display:block;width:130px;max-width:100%;height:auto;"></td></tr>
                <tr><td class="wf-badge" style="padding:14px 32px 0;"><span style="display:inline-block;padding:4px 10px 4px 8px;background-color:#FFD700;border:1.5px solid #c9aa00;border-radius:9999px;font-family:'Quicksand',Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#17352b;line-height:1;">&#9733; GoWild Forecast</span></td></tr>
                <tr><td style="padding:8px 32px 28px;"><h1 class="wf-h1" style="margin:0;font-family:'Quicksand',Arial,sans-serif;font-size:30px;line-height:1.05;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#17352b;text-shadow:0 1px 5px rgba(0,0,0,0.28);">Your {{home_airport}}<br>GoWild Forecast</h1></td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="wf-body" style="padding:32px;background-color:#ffffff;">
              <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#17352b;">Hi {{first_name}},</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#365d50;">Here is your latest GoWild availability snapshot for {{home_airport}}, with the same charts and graphs you see on the GoWild Insights page.</p>

              <h2 style="margin:0 0 14px;font-family:'Quicksand',Arial,sans-serif;font-size:18px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">{{home_airport}} GoWild Snapshot</h2>

              <div style="margin:0 0 14px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;">
                  <tr>
                    <td style="font-size:13px;color:#4e6d62;">GoWild Availability</td>
                    <td align="right" style="font-size:13px;font-weight:700;color:#17352b;">{{gowild_availability_rate}}</td>
                  </tr>
                </table>
                {{gowild_availability_bar_html}}
                <div style="margin-top:10px;font-size:12px;color:#6b8178;">{{gowild_trend_summary}}</div>
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border:1px solid #d9e9e1;border-radius:14px;background-color:#f1f7f4;border-collapse:separate;">
                <tr><td class="wf-metric-label" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:13px;color:#4e6d62;">Average GoWild Seats per Itinerary</td><td class="wf-metric-value" align="right" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:16px;font-weight:700;color:#17352b;">{{gowild_avg_seats_per_itinerary}}</td></tr>
                <tr><td class="wf-metric-label" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:13px;color:#4e6d62;">GoWild-Available Itineraries</td><td class="wf-metric-value" align="right" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:16px;font-weight:700;color:#17352b;">{{gowild_available_itineraries}}</td></tr>
                <tr><td class="wf-metric-label" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:13px;color:#4e6d62;">Total Complete Itineraries</td><td class="wf-metric-value" align="right" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:16px;font-weight:700;color:#17352b;">{{gowild_total_itineraries}}</td></tr>
                <tr><td class="wf-metric-label" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:13px;color:#4e6d62;">Period</td><td class="wf-metric-value" align="right" style="padding:14px 18px;border-bottom:1px solid #e2ece7;font-size:15px;font-weight:700;color:#17352b;">{{gowild_snapshot_period}}</td></tr>
                <tr><td class="wf-metric-label" style="padding:14px 18px;font-size:13px;color:#4e6d62;">Data updated</td><td class="wf-metric-value" align="right" style="padding:14px 18px;font-size:15px;font-weight:700;color:#17352b;">{{gowild_snapshot_updated_at}}</td></tr>
              </table>

              <h2 style="margin:0 0 10px;font-family:'Quicksand',Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">Top Origin Airports</h2>
              <div style="margin:0 0 22px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">{{gowild_top_origins_chart_html}}</div>

              <h2 style="margin:0 0 10px;font-family:'Quicksand',Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">Top Destination Airports</h2>
              <div style="margin:0 0 22px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">{{gowild_top_destinations_chart_html}}</div>

              <h2 style="margin:0 0 10px;font-family:'Quicksand',Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">Daily Availability Heatmap</h2>
              <div style="margin:0 0 22px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">{{gowild_heatmap_html}}</div>

              <h2 style="margin:0 0 10px;font-family:'Quicksand',Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">Top Routes</h2>
              <div style="margin:0 0 22px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">{{gowild_top_routes_chart_html}}</div>

              <h2 style="margin:0 0 10px;font-family:'Quicksand',Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">Worst Routes</h2>
              <div style="margin:0 0 22px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">{{gowild_worst_routes_chart_html}}</div>

              <h2 style="margin:0 0 10px;font-family:'Quicksand',Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">Booking Timing</h2>
              <div style="margin:0 0 22px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">{{gowild_timing_chart_html}}</div>

              <h2 style="margin:0 0 10px;font-family:'Quicksand',Arial,sans-serif;font-size:16px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#17352b;">Seat Availability</h2>
              <div style="margin:0 0 22px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">{{gowild_seat_availability_chart_html}}</div>

              <div style="margin:0 0 8px;padding:18px;border-left:4px solid #0f6b4f;background-color:#f8faf9;">
                <div style="margin:0 0 8px;font-size:14px;font-weight:700;color:#17352b;">How these numbers are calculated</div>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#4e6d62;">Each complete connecting itinerary is counted once. An itinerary is GoWild-available only when every leg in that itinerary is available, and the average seats figure uses the itinerary''s bottleneck seat count (the smallest seat count across its legs). Itineraries that are not fully GoWild-available contribute zero to the average.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td class="wf-foot" style="padding:24px 32px;background-color:#f1f7f4;border-top:1px solid #dce8e2;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b8178;">You are receiving this because Wildfly''s home-airport GoWild updates are enabled for your account. <a href="{{unsubscribe_url}}" style="color:#0f6b4f;">Unsubscribe</a>.</p>
              <p style="margin:0;font-size:13px;color:#6b8178;">Wildfly · {{physical_address}}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  $text$Hi {{first_name}},

Your {{home_airport}} GoWild Forecast
--------------------------------------

{{home_airport}} GoWild Snapshot
- GoWild Availability: {{gowild_availability_rate}}
- Average GoWild Seats per Itinerary: {{gowild_avg_seats_per_itinerary}}
- GoWild-Available Itineraries: {{gowild_available_itineraries}}
- Total Complete Itineraries: {{gowild_total_itineraries}}
- Period: {{gowild_snapshot_period}}
- Data updated: {{gowild_snapshot_updated_at}}
- Trend: {{gowild_trend_summary}}

Charts and graphs (Top Origin Airports, Top Destination Airports, Daily Availability Heatmap, Top Routes, Worst Routes, Booking Timing, and Seat Availability) are included in the HTML version of this email. View the GoWild Insights page in Wildfly for the interactive versions: {{app_url}}

--
Wildfly · {{physical_address}}
Unsubscribe: {{unsubscribe_url}}
$text$,
  'wildflyapp@gmail.com',
  ARRAY[
    'first_name','home_airport','app_url','physical_address','unsubscribe_url',
    'gowild_availability_rate','gowild_avg_seats_per_itinerary','gowild_available_itineraries',
    'gowild_total_itineraries','gowild_snapshot_period','gowild_snapshot_updated_at','gowild_trend_summary',
    'gowild_availability_bar_html','gowild_top_origins_chart_html','gowild_top_destinations_chart_html',
    'gowild_heatmap_html','gowild_top_routes_chart_html','gowild_worst_routes_chart_html',
    'gowild_timing_chart_html','gowild_seat_availability_chart_html'
  ],
  ARRAY['first_name','home_airport','unsubscribe_url'],
  2
)
ON CONFLICT (slug) DO UPDATE
SET
  name                = EXCLUDED.name,
  description         = EXCLUDED.description,
  category            = EXCLUDED.category,
  is_active           = EXCLUDED.is_active,
  is_transactional    = EXCLUDED.is_transactional,
  supported_channels  = EXCLUDED.supported_channels,
  email_subject       = EXCLUDED.email_subject,
  email_preheader     = EXCLUDED.email_preheader,
  email_html          = EXCLUDED.email_html,
  email_text          = EXCLUDED.email_text,
  default_reply_to    = EXCLUDED.default_reply_to,
  available_variables = EXCLUDED.available_variables,
  required_variables  = EXCLUDED.required_variables,
  version             = GREATEST(public.messaging_templates.version, EXCLUDED.version),
  updated_at          = now();
