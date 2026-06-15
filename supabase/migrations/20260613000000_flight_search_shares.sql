
-- ============================================================
-- Immutable Public Flight-Search Result Shares
-- ============================================================
-- Replaces the earlier undeployed draft that used
-- `flight_search_shares`. That table was never pushed to
-- production so this file consolidates the design cleanly.
--
-- Two JSONB columns serve distinct, non-overlapping purposes:
--
--   raw_search_payload
--     The complete, unabridged API response as it existed at
--     share-creation time. Stored at full fidelity so future
--     versions of the public share page can surface additional
--     flight fields without requiring a new search run.
--     Credential-named keys are stripped at ingestion by the
--     create-flight-search-share Edge Function; no auth headers,
--     JWTs, cookies, or API keys are ever written here.
--
--   display_model
--     A versioned, validated presentation model (v1 = FlightShareModel)
--     used by the public share template to render the page.
--     Derived from raw_search_payload at creation time and frozen.
--     The public renderer reads only this column for visual stability;
--     it is never re-derived from raw_search_payload at read time.
--     Separating the two means scraper-format changes never break
--     existing share URLs and raw data is preserved for future use.
--
-- Security model:
--   · The raw public token is never stored; only its SHA-256 hash.
--   · Anonymous clients cannot SELECT the table (no anon RLS policy).
--   · Authenticated owners may SELECT and UPDATE lifecycle fields only.
--   · Inserts go through create-flight-search-share Edge Function
--     (service-role key; bypasses RLS).
--   · Public reads go through get-public-flight-search-share Edge Function
--     which calls get_shared_flight_result RPC (service-role only).
--   · Immutable columns are enforced by a BEFORE UPDATE trigger AND
--     column-level privilege revocation; two independent layers.
-- ============================================================


-- ── Drop prior undeployed draft artifacts ─────────────────────────────────────
-- These never reached production, but local dev environments may have
-- applied the previous version. Guard with IF EXISTS for idempotency.

DROP FUNCTION IF EXISTS public.record_flight_search_share_view(text);
DROP TABLE IF EXISTS public.flight_search_shares;


-- ── Table ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shared_flight_results (

  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner who created the share. Row is hard-deleted when the auth user is deleted.
  owner_user_id           uuid        NOT NULL
                                      REFERENCES auth.users(id)
                                      ON DELETE CASCADE,

  -- Optional back-reference to the originating flight_searches row.
  -- NULLed (not cascade-deleted) when the source search is removed so this
  -- snapshot remains independently accessible.
  source_flight_search_id uuid        NULL
                                      REFERENCES public.flight_searches(id)
                                      ON DELETE SET NULL,

  -- SHA-256 hex digest of the 256-bit random public token.
  -- The raw token is returned exactly once at creation and never persisted.
  public_token_hash       text        NOT NULL,

  -- Schema version tags for forward-compatible deserialization.
  payload_version         integer     NOT NULL DEFAULT 1,
  display_model_version   integer     NOT NULL DEFAULT 1,

  -- Full API response captured at share-creation time. Immutable after insert.
  raw_search_payload      jsonb       NOT NULL,

  -- Versioned presentation snapshot used by the public share template.
  -- Derived from raw_search_payload at insert time and frozen independently
  -- so the public page renders consistently even if the raw format evolves.
  display_model           jsonb       NOT NULL,

  -- Denormalized search-context metadata.
  -- Set server-side at creation; never accepted directly from client input.
  departure_airport       text,
  arrival_airport         text,
  departure_date          date,
  return_date             date,
  trip_type               text,
  all_destinations        boolean     NOT NULL DEFAULT false,
  flight_count            integer     NOT NULL DEFAULT 0,

  -- Analytics. Updated atomically via get_shared_flight_result RPC only.
  -- Blocked for the authenticated role by column-level privilege revocation.
  view_count              bigint      NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  last_viewed_at          timestamptz,

  -- Lifecycle fields. These are the ONLY columns an authenticated owner
  -- may modify after insert (verified by the immutability trigger).
  expires_at              timestamptz,
  revoked_at              timestamptz,


  -- ── Constraints ─────────────────────────────────────────────────

  CONSTRAINT sfr_token_hash_unique
    UNIQUE (public_token_hash),

  -- SHA-256 hex: exactly 64 lowercase hexadecimal characters.
  CONSTRAINT sfr_token_hash_format
    CHECK (public_token_hash ~ '^[a-f0-9]{64}$'),

  CONSTRAINT sfr_payload_version_valid
    CHECK (payload_version >= 1 AND payload_version <= 100),

  CONSTRAINT sfr_display_model_version_valid
    CHECK (display_model_version >= 1 AND display_model_version <= 100),

  CONSTRAINT sfr_flight_count_nonneg
    CHECK (flight_count >= 0),

  CONSTRAINT sfr_view_count_nonneg
    CHECK (view_count >= 0),

  -- NULL is allowed when the trip type is not yet determinable.
  CONSTRAINT sfr_trip_type_valid
    CHECK (trip_type IS NULL OR trip_type IN ('one-way', 'round-trip'))
);

COMMENT ON TABLE public.shared_flight_results IS
  'Append-only public flight-search snapshot rows. Each row is created once by the create-flight-search-share Edge Function. The only mutable columns after insert are expires_at and revoked_at (owner) and view_count / last_viewed_at (RPC only). Anonymous access is forbidden at the table level; all public reads go through the get_shared_flight_result SECURITY DEFINER RPC (service-role only).';

COMMENT ON COLUMN public.shared_flight_results.raw_search_payload IS
  'Complete API response at share-creation time, stored at full fidelity. Allows future share-page versions to display additional fields without a new search. Credential-named keys are stripped before insert. Never returned by the public RPC.';

COMMENT ON COLUMN public.shared_flight_results.display_model IS
  'Versioned presentation model used by the public share template (v1 = FlightShareModel). Derived from raw_search_payload at creation and frozen independently. The public page renders exclusively from this column so that scraper-format changes never break existing share URLs.';

COMMENT ON COLUMN public.shared_flight_results.public_token_hash IS
  'SHA-256 hex digest of the 256-bit raw public token. The raw token is returned exactly once at share-creation time and is never stored.';

COMMENT ON COLUMN public.shared_flight_results.view_count IS
  'Atomically incremented on each public view via the get_shared_flight_result RPC. Blocked for the authenticated role via column-level REVOKE.';

COMMENT ON COLUMN public.shared_flight_results.expires_at IS
  'Optional hard expiration. NULL = no expiration. The public reader rejects rows where expires_at <= now().';

COMMENT ON COLUMN public.shared_flight_results.revoked_at IS
  'Set by the owner to invalidate the share link without deleting the row. The public reader rejects any row where revoked_at IS NOT NULL.';


-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Public-token lookup (primary hot path; unique constraint also creates an index,
-- but an explicit one lets us name it and confirm it exists).
CREATE INDEX IF NOT EXISTS idx_sfr_token_hash
  ON public.shared_flight_results (public_token_hash);

-- Owner's share history list, most-recent first.
CREATE INDEX IF NOT EXISTS idx_sfr_owner_created
  ON public.shared_flight_results (owner_user_id, created_at DESC);

-- FK scan when a flight_searches row is deleted (ON DELETE SET NULL).
CREATE INDEX IF NOT EXISTS idx_sfr_source_search
  ON public.shared_flight_results (source_flight_search_id)
  WHERE source_flight_search_id IS NOT NULL;

-- Expiration sweep: only rows that can expire.
CREATE INDEX IF NOT EXISTS idx_sfr_expires
  ON public.shared_flight_results (expires_at)
  WHERE expires_at IS NOT NULL;

-- Route + departure date for future share-management dashboard queries.
CREATE INDEX IF NOT EXISTS idx_sfr_route_date
  ON public.shared_flight_results (departure_airport, arrival_airport, departure_date)
  WHERE departure_airport IS NOT NULL;


-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE public.shared_flight_results ENABLE ROW LEVEL SECURITY;

-- Authenticated owners may read their own share rows.
CREATE POLICY "sfr_owner_select"
  ON public.shared_flight_results FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Owners may update lifecycle fields (expires_at, revoked_at).
-- Column-level privilege revocation and the immutability trigger together
-- prevent any other columns from being changed.
CREATE POLICY "sfr_owner_update"
  ON public.shared_flight_results FOR UPDATE
  USING  (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- No INSERT policy: all inserts go through the create-flight-search-share
-- Edge Function using the service-role key, which bypasses RLS and sets
-- owner_user_id from the verified JWT, never from client input.

-- No anonymous SELECT policy: public reads go exclusively through the
-- get-public-flight-search-share Edge Function (service-role) which calls
-- the get_shared_flight_result SECURITY DEFINER RPC.


-- ── Column-level privilege: protect analytics columns ─────────────────────────
-- Prevents authenticated clients from directly updating view_count or
-- last_viewed_at via the table API, even if they own the row.
-- These columns are updated only by the get_shared_flight_result RPC
-- running as the function definer (service_role / postgres).

REVOKE UPDATE (view_count, last_viewed_at)
  ON public.shared_flight_results
  FROM authenticated;


-- ── Immutability trigger ───────────────────────────────────────────────────────
-- Enforces that snapshot columns cannot be changed after insert.
-- This is a second, independent enforcement layer on top of the RLS UPDATE
-- policy; it catches service-role clients that bypass RLS.
--
-- Mutable columns (excluded from checks below):
--   expires_at, revoked_at       — owner lifecycle fields
--   view_count, last_viewed_at   — RPC-only analytics
--
-- source_flight_search_id is also excluded: it may legitimately become NULL
-- when the referenced flight_searches row is deleted (ON DELETE SET NULL).
-- Changing it from one non-null UUID to another is still blocked.

CREATE OR REPLACE FUNCTION public.sfr_protect_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'sfr: column id is immutable after insert';
  END IF;
  IF OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'sfr: column owner_user_id is immutable after insert';
  END IF;
  -- source_flight_search_id: allow NULL-ing (FK cascade), block any other change.
  IF OLD.source_flight_search_id IS NOT NULL
     AND NEW.source_flight_search_id IS NOT NULL
     AND OLD.source_flight_search_id IS DISTINCT FROM NEW.source_flight_search_id
  THEN
    RAISE EXCEPTION 'sfr: column source_flight_search_id is immutable after insert';
  END IF;
  IF OLD.public_token_hash IS DISTINCT FROM NEW.public_token_hash THEN
    RAISE EXCEPTION 'sfr: column public_token_hash is immutable after insert';
  END IF;
  IF OLD.payload_version IS DISTINCT FROM NEW.payload_version THEN
    RAISE EXCEPTION 'sfr: column payload_version is immutable after insert';
  END IF;
  IF OLD.display_model_version IS DISTINCT FROM NEW.display_model_version THEN
    RAISE EXCEPTION 'sfr: column display_model_version is immutable after insert';
  END IF;
  IF OLD.raw_search_payload IS DISTINCT FROM NEW.raw_search_payload THEN
    RAISE EXCEPTION 'sfr: column raw_search_payload is immutable after insert';
  END IF;
  IF OLD.display_model IS DISTINCT FROM NEW.display_model THEN
    RAISE EXCEPTION 'sfr: column display_model is immutable after insert';
  END IF;
  IF OLD.departure_airport IS DISTINCT FROM NEW.departure_airport THEN
    RAISE EXCEPTION 'sfr: column departure_airport is immutable after insert';
  END IF;
  IF OLD.arrival_airport IS DISTINCT FROM NEW.arrival_airport THEN
    RAISE EXCEPTION 'sfr: column arrival_airport is immutable after insert';
  END IF;
  IF OLD.departure_date IS DISTINCT FROM NEW.departure_date THEN
    RAISE EXCEPTION 'sfr: column departure_date is immutable after insert';
  END IF;
  IF OLD.return_date IS DISTINCT FROM NEW.return_date THEN
    RAISE EXCEPTION 'sfr: column return_date is immutable after insert';
  END IF;
  IF OLD.trip_type IS DISTINCT FROM NEW.trip_type THEN
    RAISE EXCEPTION 'sfr: column trip_type is immutable after insert';
  END IF;
  IF OLD.all_destinations IS DISTINCT FROM NEW.all_destinations THEN
    RAISE EXCEPTION 'sfr: column all_destinations is immutable after insert';
  END IF;
  IF OLD.flight_count IS DISTINCT FROM NEW.flight_count THEN
    RAISE EXCEPTION 'sfr: column flight_count is immutable after insert';
  END IF;
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'sfr: column created_at is immutable after insert';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sfr_protect_immutable_cols IS
  'BEFORE UPDATE trigger guard for public.shared_flight_results. Raises an exception if any immutable snapshot column is changed after insert. Mutable columns (expires_at, revoked_at, view_count, last_viewed_at) are intentionally omitted from the checks. source_flight_search_id may be NULLed by FK cascade but cannot be changed between two non-null values.';

CREATE TRIGGER trg_sfr_protect_immutable
  BEFORE UPDATE ON public.shared_flight_results
  FOR EACH ROW EXECUTE FUNCTION public.sfr_protect_immutable_cols();


-- ── Atomic view-tracking RPC ───────────────────────────────────────────────────
-- Combines UPDATE + RETURNING in a single statement so view_count is never
-- read-modify-written from JavaScript. Returns sanitized public fields only;
-- owner_user_id, public_token_hash, raw_search_payload, and internal IDs
-- are never returned.
--
-- Callable ONLY by service_role (the get-public-flight-search-share Edge Function).
-- Public and authenticated callers cannot invoke this function.

CREATE OR REPLACE FUNCTION public.get_shared_flight_result(
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.shared_flight_results;
BEGIN
  UPDATE public.shared_flight_results
  SET
    view_count     = view_count + 1,
    last_viewed_at = now()
  WHERE public_token_hash = p_token_hash
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Return only the public presentation fields.
  -- owner_user_id, public_token_hash, raw_search_payload, and the row's
  -- internal UUID are intentionally excluded from this response.
  RETURN jsonb_build_object(
    'display_model_version', v_row.display_model_version,
    'display_model',         v_row.display_model,
    'created_at',            v_row.created_at,
    'expires_at',            v_row.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.get_shared_flight_result IS
  'Atomically increments view_count, sets last_viewed_at = now(), and returns the sanitized public payload for the share identified by p_token_hash. Returns NULL when the record does not exist, is revoked, or is expired. Never returns owner_user_id, public_token_hash, raw_search_payload, or the row id. Callable by service_role only.';

-- Revoke from PUBLIC first (which covers anon and authenticated),
-- then grant exclusively to service_role.
REVOKE ALL ON FUNCTION public.get_shared_flight_result(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_flight_result(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_shared_flight_result(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_flight_result(text) TO service_role;
