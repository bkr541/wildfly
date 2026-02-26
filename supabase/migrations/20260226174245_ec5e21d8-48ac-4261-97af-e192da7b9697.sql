
CREATE TABLE public.gowild_snapshots (
  id bigserial primary key,
  observed_at timestamptz not null default now(),
  observed_date date not null generated always as (timezone('UTC', observed_at)::date) stored,
  origin_iata text not null,
  destination_iata text not null,
  travel_date date not null,
  total_flights int not null,
  gowild_flights int not null,
  nonstop_total int not null,
  nonstop_gowild int not null,
  gowild_avalseats int null,
  min_gowild_fare numeric null,
  min_fare numeric null,
  raw_response jsonb not null
);

CREATE UNIQUE INDEX gowild_snapshots_unique
  ON public.gowild_snapshots (observed_date, origin_iata, destination_iata, travel_date);

CREATE INDEX gowild_snapshots_route_date
  ON public.gowild_snapshots (origin_iata, destination_iata, travel_date);

CREATE INDEX gowild_snapshots_observed_at
  ON public.gowild_snapshots (observed_at);

ALTER TABLE public.gowild_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshots"
  ON public.gowild_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert snapshots"
  ON public.gowild_snapshots FOR INSERT
  WITH CHECK (true);
