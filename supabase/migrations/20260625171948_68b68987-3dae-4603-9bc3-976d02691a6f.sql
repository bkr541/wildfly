UPDATE public.messaging_templates
SET email_html = regexp_replace(
  email_html,
  '<div style="margin:0 0 14px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">\s*<table[^>]*>\s*<tr>\s*<td[^>]*>GoWild Availability</td>\s*<td[^>]*>\{\{gowild_availability_rate\}\}</td>\s*</tr>\s*</table>\s*\{\{gowild_availability_bar_html\}\}\s*<div[^>]*>\{\{gowild_trend_summary\}\}</div>\s*</div>',
  '{{gowild_availability_bar_html}}',
  'g'
),
version = COALESCE(version, 1) + 1,
updated_at = now()
WHERE slug = 'home-airport-gowild-forecast';