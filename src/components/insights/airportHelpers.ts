export type FlightSnapshot = {
  id: string;
  flight_search_id?: string | null;
  snapshot_at: string;
  departure_at: string | null;
  leg_origin_iata: string | null;
  leg_destination_iata: string | null;
  origin_iata?: string | null;
  destination_iata?: string | null;
  has_go_wild: boolean | string | number | null;
  go_wild_total?: number | null;
  standard_total?: number | null;
  go_wild_available_seats?: number | null;
};

export type DateRange = { start: string; end: string };

export type AirportInsightsProps = {
  snapshots: FlightSnapshot[];
  dateRange?: DateRange;
};

export type Confidence = "high" | "medium" | "low";

export type AirportStat = {
  code: string;
  totalLegs: number;
  goWildLegs: number;
  goWildRate: number;
  avgSeats: number | null;
  avgSavings: number | null;
  confidence: Confidence;
};

export type HeatmapCell = {
  totalLegs: number;
  goWildLegs: number;
  goWildRate: number;
} | null;

export type HeatmapRow = {
  airport: string;
  cells: HeatmapCell[];
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function isGoWild(value: boolean | string | number | null | undefined): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1";
  }
  return false;
}

export function normalizeAirport(code: string | null | undefined): string | null {
  if (!code) return null;
  const t = code.trim().toUpperCase();
  if (t.length < 2 || t.length > 4) return null;
  return t;
}

export function inDateRange(date: string, range: DateRange): boolean {
  const t = new Date(date).getTime();
  if (isNaN(t)) return false;
  return t >= new Date(range.start).getTime() && t <= new Date(range.end).getTime();
}

export function getFilteredSnapshots(snapshots: FlightSnapshot[], dateRange?: DateRange): FlightSnapshot[] {
  if (!dateRange) return snapshots;
  return snapshots.filter((s) => inDateRange(s.snapshot_at, dateRange));
}

export function getAirportConfidence(totalLegs: number): Confidence {
  if (totalLegs >= 20) return "high";
  if (totalLegs >= 8) return "medium";
  return "low";
}

export function formatPercent(value: number): string {
  return value.toFixed(1) + "%";
}

export function getWeekdayFromDeparture(departure_at: string | null | undefined): number | null {
  if (!departure_at) return null;
  const d = new Date(departure_at);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay(); // 0=Sun … 6=Sat
  return day === 0 ? 6 : day - 1; // Mon=0 … Sun=6
}

function buildAirportStats(
  snapshots: FlightSnapshot[],
  getCode: (s: FlightSnapshot) => string | null
): AirportStat[] {
  type Entry = { total: number; goWild: number; seats: number[]; savings: number[] };
  const map = new Map<string, Entry>();

  for (const s of snapshots) {
    const code = getCode(s);
    if (!code) continue;
    if (!map.has(code)) map.set(code, { total: 0, goWild: 0, seats: [], savings: [] });
    const e = map.get(code)!;
    e.total++;
    if (isGoWild(s.has_go_wild)) {
      e.goWild++;
      if (s.go_wild_available_seats != null) e.seats.push(s.go_wild_available_seats);
      if (s.standard_total != null && s.go_wild_total != null)
        e.savings.push(s.standard_total - s.go_wild_total);
    }
  }

  return Array.from(map.entries())
    .map(([code, d]): AirportStat => ({
      code,
      totalLegs: d.total,
      goWildLegs: d.goWild,
      goWildRate: d.total > 0 ? (d.goWild / d.total) * 100 : 0,
      avgSeats: d.seats.length > 0 ? d.seats.reduce((a, b) => a + b, 0) / d.seats.length : null,
      avgSavings: d.savings.length > 0 ? d.savings.reduce((a, b) => a + b, 0) / d.savings.length : null,
      confidence: getAirportConfidence(d.total),
    }))
    .filter((s) => s.totalLegs >= 3)
    .sort((a, b) => b.goWildRate - a.goWildRate || b.goWildLegs - a.goWildLegs || b.totalLegs - a.totalLegs)
    .slice(0, 5);
}

export function getOriginAirportStats(snapshots: FlightSnapshot[]): AirportStat[] {
  return buildAirportStats(snapshots, (s) =>
    normalizeAirport(s.leg_origin_iata) ?? normalizeAirport(s.origin_iata)
  );
}

export function getDestinationAirportStats(snapshots: FlightSnapshot[]): AirportStat[] {
  return buildAirportStats(snapshots, (s) =>
    normalizeAirport(s.leg_destination_iata) ?? normalizeAirport(s.destination_iata)
  );
}

export function getHeatmapData(snapshots: FlightSnapshot[]): HeatmapRow[] {
  type AirportEntry = { total: number; cells: { total: number; goWild: number }[] };
  const map = new Map<string, AirportEntry>();

  for (const s of snapshots) {
    const dayIdx = getWeekdayFromDeparture(s.departure_at);
    if (dayIdx === null) continue;
    const code = normalizeAirport(s.leg_origin_iata) ?? normalizeAirport(s.origin_iata);
    if (!code) continue;
    if (!map.has(code))
      map.set(code, { total: 0, cells: Array.from({ length: 7 }, () => ({ total: 0, goWild: 0 })) });
    const e = map.get(code)!;
    e.total++;
    e.cells[dayIdx].total++;
    if (isGoWild(s.has_go_wild)) e.cells[dayIdx].goWild++;
  }

  return Array.from(map.entries())
    .filter(([, d]) => d.cells.some((c) => c.total > 0))
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([airport, data]) => ({
      airport,
      cells: data.cells.map((c) =>
        c.total === 0
          ? null
          : { totalLegs: c.total, goWildLegs: c.goWild, goWildRate: (c.goWild / c.total) * 100 }
      ),
    }));
}
