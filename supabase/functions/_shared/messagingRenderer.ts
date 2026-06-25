// Pure, deterministic template renderer.
// No eval, no dynamic code execution.
// Only processes {{variable_name}} placeholders from a known whitelist.

export const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

export const ALLOWED_VARIABLES = new Set([
  "recipient_name",
  "recipient_email",
  "first_name",
  "last_name",
  "full_name",
  "email",
  "home_airport",
  "plan_name",
  "app_name",
  "app_url",
  "action_link",
  "support_email",
  "account_cta_label",
  "account_cta_url",
  "physical_address",
  "unsubscribe_url",
  "current_year",
  "feature_name",
  "maintenance_date",
  // home-airport-gowild-forecast template
  "gowild_availability_rate",
  "gowild_avg_seats_per_itinerary",
  "gowild_available_itineraries",
  "gowild_total_itineraries",
  "gowild_snapshot_period",
  "gowild_snapshot_updated_at",
  "gowild_trend_summary",
  // home-airport-gowild-forecast: chart HTML fragments
  "gowild_availability_bar_html",
  "gowild_top_origins_chart_html",
  "gowild_top_destinations_chart_html",
  "gowild_heatmap_html",
  "gowild_top_routes_chart_html",
  "gowild_worst_routes_chart_html",
  "gowild_timing_chart_html",
  "gowild_seat_availability_chart_html",
]);


export type TemplateVars = Record<string, string>;

export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_PATTERN.source, "g");
  while ((match = re.exec(template)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

export function findUnknownVariables(template: string, allowed: Set<string> = ALLOWED_VARIABLES): string[] {
  return extractVariables(template).filter((v) => !allowed.has(v));
}

export function findMissingRequired(template: string, required: string[], vars: TemplateVars): string[] {
  return required.filter((v) => {
    return template.includes(`{{${v}}}`) && !vars[v];
  });
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, key) => {
    const val = vars[key];
    if (val === undefined || val === null) return "";
    return String(val);
  });
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
