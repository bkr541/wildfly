alter table public.flight_searches
  add column if not exists triggered_by text default null;

comment on column public.flight_searches.triggered_by is
  'Identifies what triggered the search. NULL = normal user search. "admin_bulk_search" = admin bulk-search tool.';