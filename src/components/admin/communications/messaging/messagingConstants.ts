import type { AudienceFilterDefinition, ComposeFormState } from "./messagingTypes";

export const REPLY_TO_DEFAULT = "wildflyapp@gmail.com";

export const MESSAGE_CATEGORIES = [
  "product",
  "marketing",
  "beta",
  "transactional",
  "system",
] as const;

export const NOTIFICATION_TYPES = [
  "messaging_broadcast",
  "product_update",
  "beta_update",
  "system_alert",
  "account",
] as const;

export const DEFAULT_AUDIENCE_FILTER: AudienceFilterDefinition = {
  sources: [{ type: "active_users" }],
  logic: "union",
};

export const EMPTY_COMPOSE: ComposeFormState = {
  internal_name: "",
  internal_description: "",
  category: "product",
  classification: "non_transactional",
  template_id: "",
  channels: ["email"],
  email_subject: "",
  email_preheader: "",
  email_html: "",
  email_text: "",
  email_cta_label: "",
  email_cta_url: "",
  reply_to: REPLY_TO_DEFAULT,
  notification_type: "messaging_broadcast",
  notification_title: "",
  notification_body: "",
  notification_detail_text: "",
  notification_cta_label: "",
  notification_cta_url: "",
  audience_id: "",
  audience_definition: DEFAULT_AUDIENCE_FILTER,
  scheduled_at: "",
};

export const ALLOWED_TEMPLATE_VARIABLES = [
  "recipient_name",
  "recipient_email",
  "full_name",
  "email",
  "first_name",
  "last_name",
  "user_id",
  "beta_application_id",
  "app_name",
  "app_url",
  "action_link",
  "support_email",
  "unsubscribe_url",
  "current_year",
  "home_airport",
  "account_cta_url",
  "account_cta_label",
  "physical_address",
  // home-airport-gowild-forecast template
  "gowild_availability_rate",
  "gowild_avg_seats_per_itinerary",
  "gowild_available_itineraries",
  "gowild_total_itineraries",
  "gowild_snapshot_period",
  "gowild_snapshot_updated_at",
  "gowild_trend_summary",
  // home-airport-gowild-forecast: chart HTML fragments populated by the data-loading workflow
  "gowild_availability_bar_html",
  "gowild_top_origins_chart_html",
  "gowild_top_destinations_chart_html",
  "gowild_heatmap_html",
  "gowild_top_routes_chart_html",
  "gowild_worst_routes_chart_html",
  "gowild_timing_chart_html",
  "gowild_seat_availability_chart_html",
] as const;

export const MESSAGE_STATUS_COLORS: Record<string, string> = {
  draft: "text-stone-400 bg-stone-400/10",
  scheduled: "text-blue-400 bg-blue-400/10",
  queued: "text-yellow-400 bg-yellow-400/10",
  processing: "text-orange-400 bg-orange-400/10",
  partially_completed: "text-amber-400 bg-amber-400/10",
  completed: "text-green-400 bg-green-400/10",
  cancelled: "text-stone-500 bg-stone-500/10",
  failed: "text-red-400 bg-red-400/10",
};

export const PREVIEW_SAMPLE_VARS: Record<string, string> = {
  recipient_name: "Jane Doe",
  recipient_email: "jane@example.com",
  full_name: "Jane Doe",
  email: "jane@example.com",
  first_name: "Jane",
  last_name: "Doe",
  user_id: "user_abc123",
  beta_application_id: "app_xyz",
  app_name: "Wildfly",
  app_url: "https://wildfly.app",
  support_email: "support@wildfly.app",
  unsubscribe_url: "https://wildfly.app/unsubscribe?token=…",
  current_year: String(new Date().getFullYear()),
  home_airport: "TPA",
  action_link: "https://wildfly.app/activate?token=…",
  account_cta_url: "https://wildfly.app/activate?token=…",
  account_cta_label: "Activate your account",
  physical_address: "123 Main St, Seattle, WA 98101",
  // home-airport-gowild-forecast template
  gowild_availability_rate: "42.7%",
  gowild_avg_seats_per_itinerary: "3.4",
  gowild_available_itineraries: "187",
  gowild_total_itineraries: "438",
  gowild_snapshot_period: "All time",
  gowild_snapshot_updated_at: "Jun 24, 2026 8:00 PM ET",
  gowild_trend_summary: "Availability up 3.1% vs. prior period",
  // Chart HTML fragments — sample markup mirroring the GoWild Insights cards.
  // Real values are produced server-side by the data-loading workflow.
  gowild_availability_bar_html: (() => {
    // Snapshot card that mirrors the GoWild Insights "GOWILD SNAPSHOT" card:
    // two semicircular gauges (availability %, avg seats), a delta pill, and a sparkline.
    const pct = 36.9;
    const avgSeats = 4.9;
    const seatsMax = 9;
    const delta = -10.1;
    const deltaColor = delta >= 0 ? '#0f6b4f' : '#c0392b';
    const deltaBg = delta >= 0 ? '#e6f4ee' : '#fdecec';
    const deltaSign = delta >= 0 ? '+' : '';
    // Semicircle gauge: radius 60, circumference of half = pi*60 ≈ 188.5
    const gauge = (value: number, max: number, label: string, display: string) => {
      const r = 60;
      const C = Math.PI * r;
      const frac = Math.max(0, Math.min(1, value / max));
      const dash = (frac * C).toFixed(1);
      const gap = (C - frac * C).toFixed(1);
      return `<td align="center" valign="top" width="50%" style="padding:4px 6px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="170" height="110" viewBox="0 0 170 110" style="display:block;margin:0 auto;">
          <path d="M 25 95 A 60 60 0 0 1 145 95" fill="none" stroke="#e8efeb" stroke-width="14" stroke-linecap="round"/>
          <path d="M 25 95 A 60 60 0 0 1 145 95" fill="none" stroke="#10b981" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash} ${gap}"/>
          <text x="85" y="78" text-anchor="middle" font-family="Quicksand,Arial,sans-serif" font-size="26" font-weight="700" fill="#17352b">${display}</text>
        </svg>
        <div style="margin-top:4px;font-size:12px;color:#4e6d62;line-height:1.3;">${label}</div>
      </td>`;
    };
    // Sparkline: 7-day availability trend, matching the line chart on the Insights page
    const points = [42, 44, 47, 45, 48, 46, 37];
    const w = 560, h = 110, padL = 30, padR = 10, padT = 14, padB = 22;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const xs = points.map((_, i) => padL + (i * innerW) / (points.length - 1));
    const ys = points.map((v) => padT + innerH - (v / 100) * innerH);
    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
    const labels = ['Jun 18', 'Jun 19', 'Jun 20', 'Jun 21', 'Jun 22', 'Jun 23', 'Jun 24'];
    const xLabels = labels
      .map((l, i) => `<text x="${xs[i].toFixed(1)}" y="${h - 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#6b8178">${l}</text>`)
      .join('');
    const yGrid = [0, 50, 100]
      .map((v) => {
        const y = padT + innerH - (v / 100) * innerH;
        return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#eef3f0" stroke-width="1"/><text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="#9aa9a1">${v}%</text>`;
      })
      .join('');
    return `<div style="margin:0 0 14px;padding:18px;border:1px solid #d9e9e1;border-radius:14px;background-color:#ffffff;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        ${gauge(pct, 100, 'GoWild Availability', `${pct}%`)}
        ${gauge(avgSeats, seatsMax, 'Avg GoWild Seats per Itinerary', `${avgSeats}`)}
      </tr></table>
      <div style="text-align:center;margin:6px 0 10px;">
        <span style="display:inline-block;padding:5px 12px;border-radius:9999px;background-color:${deltaBg};color:${deltaColor};font-size:12px;font-weight:700;font-family:Arial,sans-serif;">${deltaSign}${delta} pts vs prior 7 days</span>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="display:block;">
        ${yGrid}
        <path d="${path}" fill="none" stroke="#1f3a6b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${xLabels}
      </svg>
    </div>`;
  })(),

  gowild_top_origins_chart_html: [
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">',
    ['TPA', 92, 92], ['ATL', 71, 77], ['MCO', 55, 60], ['BNA', 41, 45], ['BWI', 28, 30],
  ].map((row) => {
    if (typeof row === 'string') return row;
    const [code, pct, count] = row as [string, number, number];
    return `<tr><td style="padding:4px 0;width:42px;font-size:12px;font-weight:700;color:#17352b;">${code}</td><td style="padding:4px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8f1ec;border-radius:9999px;overflow:hidden;height:10px;"><tr><td style="background-color:#10b981;width:${pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td><td style="width:${100 - pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td align="right" style="padding:4px 0;width:48px;font-size:12px;color:#4e6d62;">${count}</td></tr>`;
  }).join('') + '</table>',
  gowild_top_destinations_chart_html: [
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">',
    ['LAS', 88, 88], ['JFK', 74, 81], ['LAX', 62, 70], ['DEN', 48, 52], ['SFO', 33, 36],
  ].map((row) => {
    if (typeof row === 'string') return row;
    const [code, pct, count] = row as [string, number, number];
    return `<tr><td style="padding:4px 0;width:42px;font-size:12px;font-weight:700;color:#17352b;">${code}</td><td style="padding:4px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8f1ec;border-radius:9999px;overflow:hidden;height:10px;"><tr><td style="background-color:#10b981;width:${pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td><td style="width:${100 - pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td align="right" style="padding:4px 0;width:48px;font-size:12px;color:#4e6d62;">${count}</td></tr>`;
  }).join('') + '</table>',
  gowild_heatmap_html: (() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = [0.2, 0.4, 0.55, 0.3, 0.65, 0.85, 0.5];
    const cells = days.map((d, i) => {
      const v = values[i];
      const alpha = Math.max(0.08, v).toFixed(2);
      return `<td align="center" style="padding:6px 4px;font-size:11px;font-weight:700;color:${v > 0.5 ? '#ffffff' : '#17352b'};background-color:rgba(16,185,129,${alpha});border:2px solid #ffffff;border-radius:6px;">${d}<br><span style="font-weight:400;font-size:10px;opacity:0.9;">${Math.round(v * 100)}%</span></td>`;
    }).join('');
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;"><tr>${cells}</tr></table>`;
  })(),
  gowild_top_routes_chart_html: [
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">',
    ['TPA → LAS', 95, '95%'], ['TPA → JFK', 82, '82%'], ['TPA → LAX', 71, '71%'], ['TPA → DEN', 64, '64%'], ['TPA → SFO', 58, '58%'],
  ].map((row) => {
    if (typeof row === 'string') return row;
    const [route, pct, label] = row as [string, number, string];
    return `<tr><td style="padding:4px 8px 4px 0;font-size:12px;color:#17352b;white-space:nowrap;">${route}</td><td style="padding:4px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8f1ec;border-radius:9999px;overflow:hidden;height:10px;"><tr><td style="background-color:#10b981;width:${pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td><td style="width:${100 - pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td align="right" style="padding:4px 0;width:44px;font-size:12px;color:#4e6d62;">${label}</td></tr>`;
  }).join('') + '</table>',
  gowild_worst_routes_chart_html: [
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">',
    ['TPA → ORD', 14, '14%'], ['TPA → BOS', 18, '18%'], ['TPA → SEA', 22, '22%'], ['TPA → DCA', 26, '26%'], ['TPA → PHX', 31, '31%'],
  ].map((row) => {
    if (typeof row === 'string') return row;
    const [route, pct, label] = row as [string, number, string];
    return `<tr><td style="padding:4px 8px 4px 0;font-size:12px;color:#17352b;white-space:nowrap;">${route}</td><td style="padding:4px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fdecec;border-radius:9999px;overflow:hidden;height:10px;"><tr><td style="background-color:#e94560;width:${pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td><td style="width:${100 - pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td align="right" style="padding:4px 0;width:44px;font-size:12px;color:#4e6d62;">${label}</td></tr>`;
  }).join('') + '</table>',
  gowild_timing_chart_html: (() => {
    const buckets = [['0–7d', 12], ['8–14d', 28], ['15–30d', 46], ['31–60d', 64], ['61–90d', 38], ['90d+', 20]];
    const max = Math.max(...buckets.map((b) => b[1] as number));
    const cols = buckets.map(([label, val]) => {
      const h = Math.round(((val as number) / max) * 100);
      return `<td align="center" valign="bottom" style="padding:0 4px;width:16%;"><div style="height:90px;display:inline-block;width:100%;background-color:#f1f7f4;border-radius:6px;position:relative;"><div style="position:absolute;left:0;right:0;bottom:0;height:${h}%;background-color:#10b981;border-radius:6px;"></div></div><div style="margin-top:6px;font-size:11px;color:#4e6d62;">${label}</div><div style="font-size:11px;font-weight:700;color:#17352b;">${val}%</div></td>`;
    }).join('');
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${cols}</tr></table>`;
  })(),
  gowild_seat_availability_chart_html: (() => {
    const buckets = [['1 seat', 22], ['2 seats', 35], ['3 seats', 21], ['4 seats', 12], ['5+ seats', 10]];
    const max = Math.max(...buckets.map((b) => b[1] as number));
    const rows = buckets.map(([label, val]) => {
      const pct = Math.round(((val as number) / max) * 100);
      return `<tr><td style="padding:4px 8px 4px 0;width:80px;font-size:12px;color:#17352b;">${label}</td><td style="padding:4px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8f1ec;border-radius:9999px;overflow:hidden;height:10px;"><tr><td style="background-color:#0f6b4f;width:${pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td><td style="width:${100 - pct}%;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td align="right" style="padding:4px 0;width:44px;font-size:12px;color:#4e6d62;">${val}%</td></tr>`;
    }).join('');
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">${rows}</table>`;
  })(),
};


export const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: "text-stone-400 bg-stone-400/10",
  queued: "text-yellow-400 bg-yellow-400/10",
  processing: "text-orange-400 bg-orange-400/10",
  sent: "text-blue-400 bg-blue-400/10",
  delivered: "text-teal-400 bg-teal-400/10",
  opened: "text-green-400 bg-green-400/10",
  clicked: "text-emerald-400 bg-emerald-400/10",
  failed: "text-red-400 bg-red-400/10",
  bounced: "text-red-500 bg-red-500/10",
  complained: "text-red-600 bg-red-600/10",
  suppressed: "text-stone-500 bg-stone-500/10",
  unsubscribed: "text-stone-500 bg-stone-500/10",
  cancelled: "text-stone-500 bg-stone-500/10",
};
