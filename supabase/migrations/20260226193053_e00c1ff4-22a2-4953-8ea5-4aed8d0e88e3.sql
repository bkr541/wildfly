ALTER TABLE public.airports ADD COLUMN IF NOT EXISTS is_hub boolean NOT NULL DEFAULT false;

UPDATE public.airports SET is_hub = true WHERE iata_code IN ('ATL','MDW','CLE','DFW','DEN','LAS','MIA','MCO','PHL','PHX','TPA','TTN');