import type { FlightSearchFiltersState } from "./types";

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

const INPUT_CLS =
  "w-full h-8 bg-[#F2F3F3] rounded-lg px-2.5 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400";
const SELECT_CLS =
  "w-full h-8 bg-[#F2F3F3] rounded-lg px-2.5 text-xs text-[#2E4A4A] border-0 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none";

interface Props {
  filters: FlightSearchFiltersState;
  onChange: (patch: Partial<FlightSearchFiltersState>) => void;
  onClear: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">
      {children}
    </label>
  );
}

export function FlightSearchFilters({ filters, onChange, onClear }: Props) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-4" style={CARD_STYLE}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#6B7B7B] uppercase tracking-wide">Filters</p>
        <button
          onClick={onClear}
          className="text-[10px] font-semibold text-[#9CA3AF] hover:text-rose-500 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Row 1 – main filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        <div>
          <Label>Origin</Label>
          <input
            type="text"
            value={filters.origin}
            onChange={(e) => onChange({ origin: e.target.value.toUpperCase().slice(0, 4) })}
            placeholder="ATL"
            aria-label="Filter by origin airport"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <Label>Destination</Label>
          <input
            type="text"
            value={filters.destination}
            onChange={(e) => onChange({ destination: e.target.value.toUpperCase().slice(0, 4) })}
            placeholder="LAS"
            aria-label="Filter by destination airport"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <Label>GoWild</Label>
          <select
            value={filters.goWildStatus}
            onChange={(e) => onChange({ goWildStatus: e.target.value as FlightSearchFiltersState["goWildStatus"] })}
            aria-label="Filter by GoWild status"
            className={SELECT_CLS}
          >
            <option value="all">All</option>
            <option value="found">Found</option>
            <option value="not_found">Not Found</option>
          </select>
        </div>

        <div>
          <Label>Source</Label>
          <select
            value={filters.resultSource}
            onChange={(e) => onChange({ resultSource: e.target.value })}
            aria-label="Filter by result source"
            className={SELECT_CLS}
          >
            <option value="">All Sources</option>
            <option value="cache">Cache Hit</option>
            <option value="admin_bulk">Admin Bulk</option>
            <option value="schedul">Scheduled Scan</option>
            <option value="provider">Live API</option>
          </select>
        </div>

        <div>
          <Label>Trip Type</Label>
          <select
            value={filters.tripType}
            onChange={(e) => onChange({ tripType: e.target.value })}
            aria-label="Filter by trip type"
            className={SELECT_CLS}
          >
            <option value="">All Types</option>
            <option value="one_way">One Way</option>
            <option value="round_trip">Round Trip</option>
            <option value="day_trip">Day Trip</option>
            <option value="trip_planner">Trip Planner</option>
          </select>
        </div>

        <div>
          <Label>Destinations</Label>
          <select
            value={filters.allDestinations}
            onChange={(e) => onChange({ allDestinations: e.target.value as FlightSearchFiltersState["allDestinations"] })}
            aria-label="Filter by all destinations"
            className={SELECT_CLS}
          >
            <option value="all">All</option>
            <option value="yes">All Dest.</option>
            <option value="no">Specific Dest.</option>
          </select>
        </div>

        <div>
          <Label>Route Type</Label>
          <select
            value={filters.routeType}
            onChange={(e) => onChange({ routeType: e.target.value as FlightSearchFiltersState["routeType"] })}
            aria-label="Filter by route type"
            className={SELECT_CLS}
          >
            <option value="all">All</option>
            <option value="domestic">Domestic</option>
            <option value="international">International</option>
          </select>
        </div>

        <div>
          <Label>Freshness</Label>
          <select
            value={filters.freshness}
            onChange={(e) => onChange({ freshness: e.target.value as FlightSearchFiltersState["freshness"] })}
            aria-label="Filter by data freshness"
            className={SELECT_CLS}
          >
            <option value="all">All</option>
            <option value="fresh">Fresh (&lt;30m)</option>
            <option value="recent">Recent (3h)</option>
            <option value="aging">Aging (12h)</option>
            <option value="stale">Stale</option>
          </select>
        </div>

        <div>
          <Label>Min Results</Label>
          <input
            type="number"
            value={filters.minResults}
            onChange={(e) => onChange({ minResults: e.target.value })}
            placeholder="0"
            min="0"
            aria-label="Minimum results count"
            className={INPUT_CLS}
          />
        </div>
      </div>

      {/* Row 2 – date ranges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label>Search From</Label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            aria-label="Search timestamp from"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <Label>Search To</Label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            aria-label="Search timestamp to"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <Label>Depart From</Label>
          <input
            type="date"
            value={filters.departureDateFrom}
            onChange={(e) => onChange({ departureDateFrom: e.target.value })}
            aria-label="Departure date from"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <Label>Depart To</Label>
          <input
            type="date"
            value={filters.departureDateTo}
            onChange={(e) => onChange({ departureDateTo: e.target.value })}
            aria-label="Departure date to"
            className={INPUT_CLS}
          />
        </div>
      </div>
    </div>
  );
}
