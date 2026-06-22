import React, { useState, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChartBarLineIcon,
  ChartLineData01Icon,
  PieChart01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ReportChart as ReportChartConfig, ReportColumn, ReportRow } from "./reportingTypes";
import { formatCell } from "./reportingFormatters";

// ── Colour palette ─────────────────────────────────────────────────────────────

export const SERIES_COLORS = [
  "#059669", // emerald
  "#0891b2", // cyan
  "#d97706", // amber
  "#e11d48", // rose
  "#4f46e5", // indigo
] as const;

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Returns true when the chart config and rows can produce a usable chart.
 * Exported for testing.
 */
export function isChartRenderable(
  chart: ReportChartConfig | undefined,
  rows:  ReportRow[],
): boolean {
  if (!chart) return false;
  if (chart.type === "none") return false;
  if (!rows || rows.length === 0) return false;
  if (chart.type === "donut") {
    // Donut needs at least one series with a key
    return Array.isArray(chart.series) && chart.series.length > 0;
  }
  // Line and Bar need both xKey and series
  if (!chart.xKey) return false;
  if (!Array.isArray(chart.series) || chart.series.length === 0) return false;
  return true;
}

/**
 * Safely convert a cell to a finite number for chart rendering.
 * Returns null for missing / non-numeric values.
 */
export function toChartNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltipContent({
  active,
  payload,
  label,
  columns,
}: {
  active?:  boolean;
  payload?: Array<{ name: string; value: unknown; color: string }>;
  label?:   unknown;
  columns:  ReportColumn[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  function fmt(name: string, value: unknown): string {
    const col = columns.find((c) => c.key === name || c.label === name);
    return formatCell(value, col?.type);
  }

  return (
    <div
      className="rounded-xl border border-[#E8EEEE] bg-white/95 px-3 py-2.5 shadow-sm text-xs"
      style={{ backdropFilter: "blur(8px)" }}
    >
      {label !== undefined && label !== null && (
        <p className="font-semibold text-[#1A2E2E] mb-1.5">{String(label)}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-[#6B7280]">{p.name}:</span>
          <span className="font-semibold text-[#1A2E2E]">
            {fmt(p.name, p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Chart type icon ────────────────────────────────────────────────────────────

function chartIcon(type: ReportChartConfig["type"]) {
  switch (type) {
    case "line":  return ChartLineData01Icon;
    case "bar":   return ChartBarLineIcon;
    case "donut": return PieChart01Icon;
    default:      return ChartBarLineIcon;
  }
}

// ── Donut chart (SVG-rendered via Recharts PieChart) ──────────────────────────

function DonutChartBody({
  chart,
  rows,
  columns,
}: {
  chart:   ReportChartConfig;
  rows:    ReportRow[];
  columns: ReportColumn[];
}) {
  const series    = chart.series ?? [];
  const firstSeries = series[0];
  if (!firstSeries) return null;

  // Aggregate: one slice per row, keyed by first series value
  const xCol = chart.xKey ? columns.find((c) => c.key === chart.xKey) : undefined;
  const data  = rows
    .map((row) => ({
      name:  xCol ? String(row[xCol.key] ?? "") : String(row[firstSeries.key] ?? ""),
      value: toChartNumber(row[firstSeries.key]) ?? 0,
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-[#9CA3AF]">
        No positive values to chart.
      </div>
    );
  }

  const srSummary = data
    .map((d) => `${d.name}: ${formatCell(d.value, firstSeries.key ? columns.find((c) => c.key === firstSeries.key)?.type : undefined)}`)
    .join(", ");

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {firstSeries.label} breakdown: {srSummary}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="72%"
            strokeWidth={2}
            stroke="white"
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={<ChartTooltipContent columns={columns} />}
          />
          <Legend
            formatter={(value) => (
              <span className="text-[11px] text-[#374151]">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Line / Bar chart ───────────────────────────────────────────────────────────

function CartesianChartBody({
  chart,
  rows,
  columns,
}: {
  chart:   ReportChartConfig;
  rows:    ReportRow[];
  columns: ReportColumn[];
}) {
  const { xKey, series = [], type } = chart;
  if (!xKey || series.length === 0) return null;

  const xCol = columns.find((c) => c.key === xKey);

  // Build recharts-compatible data array
  const data = rows.map((row) => {
    const entry: Record<string, unknown> = {
      __x: xCol ? formatCell(row[xKey], xCol.type) : String(row[xKey] ?? ""),
    };
    for (const s of series) {
      entry[s.key] = toChartNumber(row[s.key]);
    }
    return entry;
  });

  // Find column type for each series key (for tooltip formatting)
  const colByKey = Object.fromEntries(columns.map((c) => [c.key, c]));

  const srSummary = series
    .map((s) => {
      const values = data.map((d) => d[s.key]).filter((v): v is number => v !== null);
      const max    = values.length > 0 ? Math.max(...values) : null;
      return max !== null ? `${s.label} max: ${formatCell(max, colByKey[s.key]?.type)}` : null;
    })
    .filter(Boolean)
    .join(". ");

  const ChartComponent = type === "bar" ? BarChart : LineChart;

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        Chart data. {srSummary}
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ChartComponent
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F1F1" />
          <XAxis
            dataKey="__x"
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            width={40}
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltipContent columns={columns} />}
          />
          {series.length > 1 && (
            <Legend
              formatter={(value) => (
                <span className="text-[11px] text-[#374151]">{value}</span>
              )}
            />
          )}
          {series.map((s, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            if (type === "bar") {
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
              );
            }
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ReportChartProps {
  chart:      ReportChartConfig;
  columns:    ReportColumn[];
  rows:       ReportRow[];
  reportName: string;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ReportChart({
  chart,
  columns,
  rows,
  reportName,
}: ReportChartProps) {
  const [collapsed, setCollapsed] = useState(false);

  const renderable = useMemo(
    () => isChartRenderable(chart, rows),
    [chart, rows],
  );

  if (!renderable) return null;

  const Icon  = chartIcon(chart.type);
  const title = `${reportName} — ${chart.type === "donut" ? "Donut" : chart.type === "bar" ? "Bar" : "Line"} Chart`;

  return (
    <div
      className="rounded-xl border border-[#E8EEEE] bg-white overflow-hidden"
      aria-label={title}
      role="region"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F1F1]">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Icon}
            size={14}
            color="#059669"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="text-xs font-bold text-[#1A2E2E] capitalize">
            {chart.type} Chart
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand chart" : "Collapse chart"}
          className="flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#374151] transition-colors"
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={13}
            color="currentColor"
            strokeWidth={2.5}
            style={{
              transform:  collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.2s ease",
            }}
          />
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {/* Chart body */}
      {!collapsed && (
        <div className="p-4">
          {chart.type === "donut" ? (
            <DonutChartBody chart={chart} rows={rows} columns={columns} />
          ) : (
            <CartesianChartBody chart={chart} rows={rows} columns={columns} />
          )}
        </div>
      )}
    </div>
  );
}
