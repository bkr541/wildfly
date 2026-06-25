UPDATE public.messaging_templates
SET email_html = regexp_replace(
  email_html,
  '<h2[^>]*>Top Origin Airports</h2>\s*<div[^>]*>\{\{gowild_top_origins_chart_html\}\}</div>\s*',
  '',
  'g'
),
version = COALESCE(version, 1) + 1,
updated_at = now()
WHERE slug = 'home-airport-gowild-forecast';