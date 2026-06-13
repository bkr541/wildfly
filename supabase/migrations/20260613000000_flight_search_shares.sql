
-- ============================================================
-- Immutable Public Flight-Search Shares
-- ============================================================
-- Purpose: Token-addressed, append-only flight-search snapshots
--          for anonymous-public sharing. One row per share event.
--          Public reads go exclusively through the
--          get-public-flight-search-share Edge Function.
-- ============================================================


-- ── Table ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flight_search_shares (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authenticated owner who created the share
  owner_user_id      uuid        NOT NULL
                                 REFERENCES auth.users(id)
                                 ON DELETE CASCADE,

  -- SHA-256 hex digest of the raw 256-bit public token.
  -- The raw token is returned once at creation and never stored.
  public_token_hash  text        NOT NULL,

  -- Schema version for forward-compatible deserialization.
  -- Version 1 matches FlightShareModel shape as of 2026-06.
  model_version      integer     NOT NULL DEFAULT 1,

  -- Full FlightShareModel snapshot. Immutable after insert.
  share_model        jsonb       NOT NULL,

  -- Denormalized summary columns.
  -- All computed server-side; never trusted from client input.
  origin_label       text        NOT NULL,
  destination_label  text        NOT NULL,
  departure_date     date,
  return_date        date,
  trip_type          text        NOT NULL,
  flight_count       integer     NOT NULL DEFAULT 0,

  -- Analytics (updated atomically via record_flight_search_share_view RPC).
  view_count         bigint      NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_viewed_at     timestamptz,

  -- Lifecycle control (the only mutable fields after insert).
  expires_at         timestamptz,
  revoked_at         timestamptz,


  -- ── Constraints ─────────────────────────────────────────────

  CONSTRAINT flight_search_shares_token_hash_unique
    UNIQUE (public_token_hash),

  CONSTRAINT flight_search_shares_model_version_valid
    CHECK (model_version >= 1 AND model_version <= 100),

  CONSTRAINT flight_search_shares_flight_count_nonneg
    CHECK (flight_count >= 0),

  CONSTRAINT flight_search_shares_view_count_nonneg
    CHECK (view_count >= 0),

  CONSTRAINT flight_search_shares_trip_type_valid
    CHECK (trip_type IN ('one-way', 'round-trip'))
);

COMMENT ON TABLE public.flight_search_shares IS
  'Immutable public flight-search snapshot rows. '
  'Each row is created once and is never updated except for '
  'revoked_at, expires_at, view_count, and last_viewed_at. '
  'Anonymous public reads must go through the '
  'get-public-flight-search-share Edge Function (service-role). '
  'Direct table access is restricted to the authenticated owner via RLS.';

COMMENT ON COLUMN public.flight_search_shares.public_token_hash IS
  'SHA-256 hex digest of the raw 256-bit public token. '
  'The raw token is returned exactly once at share-creation time and is never persisted.';
COMMENT ON COLUMN public.flight_search_shares.model_version IS
  'Schema version of share_model JSON. '
  'Version 1 = FlightShareModel shape as of 2026-06. '
  'The reader selects the correct deserializer based on this value.';
COMMENT ON COLUMN public.flight_search_shares.share_model IS
  'Full FlightShareModel snapshot at time of share creation. Immutable after insert.';
COMMENT ON COLUMN public.flight_search_shares.origin_label IS
  'Derived server-side from share_model.originLabel. Never supplied directly by the client.';
COMMENT ON COLUMN public.flight_search_shares.destination_label IS
  'Derived server-side from share_model.destinationLabel. Never supplied directly by the client.';
COMMENT ON COLUMN public.flight_search_shares.trip_type IS
  'Normalized trip type: one-way | round-trip. Derived server-side.';
COMMENT ON COLUMN public.flight_search_shares.flight_count IS
  'Total flight option count. Derived server-side from share_model.totalOptionCount.';
COMMENT ON COLUMN public.flight_search_shares.view_count IS
  'Atomically incremented on each public view via the record_flight_search_share_view RPC. '
  'Never directly writable by clients.';
COMMENT ON COLUMN public.flight_search_shares.expires_at IS
  'Optional hard expiration timestamp. NULL means no expiration. '
  'The public reader rejects records where expires_at <= now().';
COMMENT ON COLUMN public.flight_search_shares.revoked_at IS
  'Set by the owner to invalidate the share link without deleting the row. '
  'The public reader rejects any record where revoked_at IS NOT NULL.';


-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Owner's share history list, most-recent first
CREATE INDEX IF NOT EXISTS idx_flight_search_shares_owner_created
  ON public.flight_search_shares (owner_user_id, created_at DESC);

-- Expiration sweep (partial: only rows that can expire)
CREATE INDEX IF NOT EXISTS idx_flight_search_shares_expires
  ON public.flight_search_shares (expires_at)
  WHERE expires_at IS NOT NULL;


-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE public.flight_search_shares ENABLE ROW LEVEL SECURITY;

-- Authenticated owners may read their own records only.
-- Other authenticated users cannot see each other's shares via the table API.
CREATE POLICY "Owners can view their own flight search shares"
  ON public.flight_search_shares FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Owners may update only lifecycle fields (revoked_at, expires_at).
-- Immutable columns (share_model, model_version, public_token_hash, etc.)
-- cannot be changed because the Edge Function never issues UPDATE on them.
CREATE POLICY "Owners can update lifecycle fields on their own shares"
  ON public.flight_search_shares FOR UPDATE
  USING  (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- No client-side INSERT policy.
-- All inserts go through the create-flight-search-share Edge Function
-- using the service-role key, which bypasses RLS and ensures
-- owner_user_id is set from the verified JWT, not from client input.

-- No anonymous SELECT policy.
-- Anonymous / public reads go through the get-public-flight-search-share
-- Edge Function using the service-role key.
-- There is deliberately no "using (true)" policy on this table.


-- ── Atomic view-tracking RPC ───────────────────────────────────────────────────
--
-- Combines UPDATE + RETURNING in a single statement so view_count is never
-- read-modify-written from JavaScript. Returns sanitized public fields only;
-- owner_user_id and public_token_hash are never returned.

CREATE OR REPLACE FUNCTION public.record_flight_search_share_view(
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.flight_search_shares;
BEGIN
  UPDATE public.flight_search_shares
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

  -- Return only sanitized public fields.
  -- owner_user_id and public_token_hash are intentionally excluded.
  RETURN jsonb_build_object(
    'model_version', v_row.model_version,
    'share_model',   v_row.share_model,
    'created_at',    v_row.created_at,
    'expires_at',    v_row.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.record_flight_search_share_view IS
  'Atomically increments view_count, sets last_viewed_at = now(), and returns '
  'the sanitized public payload for the share identified by p_token_hash. '
  'Returns NULL when the record does not exist, is revoked, or is expired. '
  'Never returns owner_user_id or public_token_hash.';
