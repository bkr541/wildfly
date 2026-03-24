
-- ============================================================
-- Migration: create flight_snapshots analytics table
-- References: public.flight_searches(id)  ← real table name
--             (user specified "flights_search" but the actual
--              table in this project is "flight_searches")
-- ============================================================

create table if not exists public.flight_snapshots (
  id                          uuid        primary key default gen_random_uuid(),

  -- parent search reference (FK → public.flight_searches.id)
  flight_search_id            uuid        not null,

  -- snapshot timestamp
  snapshot_at                 timestamptz not null default now(),

  -- itinerary identity / context
  source_itinerary_id         text        not null,
  itinerary_flight_number     text,
  airline                     text,
  origin_iata                 text        not null,          -- itinerary origin
  final_destination_iata      text        not null,          -- itinerary destination
  display_cabin               text,
  display_price               numeric(10,2),
  currency                    text,
  notes                       text,

  -- itinerary-level trip context
  flight_type                 text,                          -- NonStop / Connect
  stops                       smallint,
  total_trip_minutes          integer,
  total_duration_display      text,

  -- leg grain
  leg_index                   smallint    not null,          -- 1, 2, 3…
  carrier_code                text,
  flight_number               text        not null,          -- segment flight number
  leg_origin_iata             text        not null,
  leg_destination_iata        text        not null,
  departure_at                timestamp   not null,
  arrival_at                  timestamp   not null,
  -- generated stored column: no default/nullability needed
  leg_route                   text        generated always as (leg_origin_iata || '-' || leg_destination_iata) stored,

  -- Go Wild fare tier
  has_go_wild                 boolean     not null default false,
  go_wild_available_seats     integer,
  go_wild_fare_status         integer,
  go_wild_total               numeric(10,2),
  go_wild_loyalty_points      integer,

  -- Standard fare tier
  standard_available_seats    integer,
  standard_fare_status        integer,
  standard_total              numeric(10,2),
  standard_loyalty_points     integer,

  -- Discount Den fare tier
  discount_den_available_seats  integer,
  discount_den_fare_status      integer,
  discount_den_total            numeric(10,2),
  discount_den_loyalty_points   integer,

  -- Miles fare tier
  miles_available_seats       integer,
  miles_fare_status           integer,
  miles_total                 numeric(10,2),
  miles_loyalty_points        integer,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- unique per (search, itinerary, leg position)
  constraint flight_snapshots_unique_leg
    unique (flight_search_id, source_itinerary_id, leg_index),

  -- FK to the real parent table
  constraint flight_snapshots_flight_search_id_fkey
    foreign key (flight_search_id)
    references public.flight_searches (id)
    on delete cascade
);

-- ── Indexes ─────────────────────────────────────────────────

create index if not exists flight_snapshots_snapshot_idx
  on public.flight_snapshots (snapshot_at desc);

create index if not exists flight_snapshots_flight_search_idx
  on public.flight_snapshots (flight_search_id);

create index if not exists flight_snapshots_flight_number_idx
  on public.flight_snapshots (flight_number, snapshot_at desc);

create index if not exists flight_snapshots_leg_route_idx
  on public.flight_snapshots (leg_route, snapshot_at desc);

create index if not exists flight_snapshots_final_destination_idx
  on public.flight_snapshots (final_destination_iata, snapshot_at desc);

create index if not exists flight_snapshots_origin_destination_idx
  on public.flight_snapshots (origin_iata, final_destination_iata, snapshot_at desc);

create index if not exists flight_snapshots_has_gowild_idx
  on public.flight_snapshots (has_go_wild, snapshot_at desc);

-- partial index: only rows where GoWild is available
create index if not exists flight_snapshots_gowild_seats_idx
  on public.flight_snapshots (go_wild_available_seats desc)
  where has_go_wild = true;

-- ── updated_at trigger ───────────────────────────────────────

create or replace trigger flight_snapshots_updated_at
  before update on public.flight_snapshots
  for each row execute function public.handle_updated_at();

-- ── RLS ─────────────────────────────────────────────────────

alter table public.flight_snapshots enable row level security;

-- Users may only read snapshots that belong to their own searches
create policy "Users can view own flight snapshots"
  on public.flight_snapshots
  for select
  using (
    exists (
      select 1
      from public.flight_searches fs
      where fs.id = flight_search_id
        and fs.user_id = auth.uid()
    )
  );

-- No direct client writes; rows are inserted by backend functions only
create policy "No client insert flight snapshots"
  on public.flight_snapshots
  for insert
  with check (false);

create policy "No client update flight snapshots"
  on public.flight_snapshots
  for update
  using (false);

create policy "No client delete flight snapshots"
  on public.flight_snapshots
  for delete
  using (false);
