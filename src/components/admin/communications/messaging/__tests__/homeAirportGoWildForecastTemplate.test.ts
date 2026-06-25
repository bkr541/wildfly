import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_TEMPLATE_VARIABLES,
  PREVIEW_SAMPLE_VARS,
} from "../messagingConstants";
import { extractVariables, renderPreview } from "../messagingHelpers";

const TEMPLATE_SLUG = "home-airport-gowild-forecast";

const loadTemplateMigration = (): string => {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  for (const f of files) {
    const body = readFileSync(join(dir, f), "utf8");
    if (body.includes(`'${TEMPLATE_SLUG}'`) && /INSERT INTO public\.messaging_templates/i.test(body)) {
      return body;
    }
  }
  throw new Error(`Migration inserting messaging template '${TEMPLATE_SLUG}' not found`);
};


const extractDollarBlock = (sql: string, tag: string): string => {
  const open = `$${tag}$`;
  const start = sql.indexOf(open);
  if (start === -1) throw new Error(`Block $${tag}$ not found`);
  const end = sql.indexOf(open, start + open.length);
  if (end === -1) throw new Error(`Closing $${tag}$ not found`);
  return sql.slice(start + open.length, end);
};

describe(`messaging template: ${TEMPLATE_SLUG}`, () => {
  const sql = loadTemplateMigration();
  const html = extractDollarBlock(sql, "html");
  const text = extractDollarBlock(sql, "text");
  const subject = "Your {{home_airport}} GoWild Forecast";
  const preheader = "Your all-time {{home_airport}} GoWild availability snapshot and forecast.";
  const allVars = Array.from(
    new Set([
      ...extractVariables(html),
      ...extractVariables(text),
      ...extractVariables(subject),
      ...extractVariables(preheader),
    ]),
  );

  it("targets the correct slug and category in the migration", () => {
    expect(sql).toContain(`'${TEMPLATE_SLUG}'`);
    expect(sql).toContain("'Your Home Airport GoWild Forecast'");
    expect(sql).toMatch(/category[\s\S]{0,80}'product'/);
    expect(sql).toContain("ON CONFLICT (slug) DO UPDATE");
    expect(sql).toContain("GREATEST(public.messaging_templates.version, EXCLUDED.version)");
  });

  it("registers every template variable in both frontend and shared renderer registries", async () => {
    const renderer = await import("../../../../../../supabase/functions/_shared/messagingRenderer");
    for (const v of allVars) {
      expect(ALLOWED_TEMPLATE_VARIABLES, `frontend registry missing ${v}`).toContain(v);
      expect(renderer.ALLOWED_VARIABLES.has(v), `shared renderer missing ${v}`).toBe(true);
    }
  });

  it("provides a preview value for every template variable, using TPA for home_airport", () => {
    expect(PREVIEW_SAMPLE_VARS.home_airport).toBe("TPA");
    for (const v of allVars) {
      expect(PREVIEW_SAMPLE_VARS[v], `missing preview value for ${v}`).toBeTruthy();
    }
  });

  it("leaves no unresolved {{placeholders}} when rendered with the preview vars", () => {
    const rendered = [
      renderPreview(subject, PREVIEW_SAMPLE_VARS),
      renderPreview(preheader, PREVIEW_SAMPLE_VARS),
      renderPreview(html, PREVIEW_SAMPLE_VARS),
      renderPreview(text, PREVIEW_SAMPLE_VARS),
    ].join("\n");
    expect(rendered).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it("renders the GoWild Forecast section with no generated forecast content", () => {
    const rendered = renderPreview(html, PREVIEW_SAMPLE_VARS);
    const headingIdx = rendered.indexOf("GoWild Forecast</h2>");
    expect(headingIdx).toBeGreaterThan(-1);

    const section = rendered.slice(headingIdx);
    const forbidden = [
      /coming soon/i,
      /forecast(ed)? (score|value|reading|level|index)/i,
      /predict/i,
      /chance of/i,
      /probability/i,
      /\bscore\b/i,
      /\b\d+%\s*(chance|likelihood|forecast)/i,
    ];
    for (const re of forbidden) {
      expect(section, `forecast section contains forbidden content matching ${re}`).not.toMatch(re);
    }
    // The forecast container must be present but empty (no text nodes inside).
    expect(section).toMatch(/<div[^>]+min-height:120px[^>]*>\s*(<!--[^>]*-->)?\s*<\/div>/);
  });

  it("uses email-only, non-transactional, and the wildflyapp@gmail.com default reply-to", () => {
    expect(sql).toMatch(/ARRAY\['email'\]/);
    expect(sql).toMatch(/'wildflyapp@gmail\.com'/);
    // is_transactional flag passed as false
    expect(sql).toMatch(/false,\s*\n\s*ARRAY\['email'\]/);
    // unsubscribe link present because non-transactional
    expect(html).toContain("{{unsubscribe_url}}");
    expect(text).toContain("{{unsubscribe_url}}");
  });
});
