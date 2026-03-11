
-- ============================================================
-- WILDFLY FRIENDS SYSTEM MIGRATION
-- ============================================================
-- Purpose: Full backend for friend requests, friendships,
--          notifications, trip sharing, and user discovery.
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. ALTER user_info — User Discovery Fields
-- ============================================================
ALTER TABLE public.user_info
  ADD COLUMN IF NOT EXISTS display_name   text,
  ADD COLUMN IF NOT EXISTS avatar_url     text,
  ADD COLUMN IF NOT EXISTS home_city      text,
  ADD COLUMN IF NOT EXISTS home_airport   text,
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT true;

-- username already exists on user_info per schema; ensure unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_info_username_key' AND conrelid = 'public.user_info'::regclass
  ) THEN
    ALTER TABLE public.user_info ADD CONSTRAINT user_info_username_key UNIQUE (username);
  END IF;
END$$;

COMMENT ON COLUMN public.user_info.display_name    IS 'User-facing display name shown on profile and search results';
COMMENT ON COLUMN public.user_info.avatar_url      IS 'URL to the user avatar image (storage bucket or external)';
COMMENT ON COLUMN public.user_info.home_city       IS 'User''s home city, shown to friends when permission granted';
COMMENT ON COLUMN public.user_info.home_airport    IS 'User''s preferred home airport IATA code';
COMMENT ON COLUMN public.user_info.is_discoverable IS 'When false the user cannot be found via friend search';

-- ============================================================
-- 2. ALTER user_settings — Friend Privacy Fields
-- ============================================================
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS allow_friend_requests          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_home_city_to_friends      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_upcoming_trips_to_friends boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_activity_feed_to_friends  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_trip_overlap_alerts       boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_settings.allow_friend_requests          IS 'When false incoming friend requests are silently ignored';
COMMENT ON COLUMN public.user_settings.show_home_city_to_friends      IS 'Controls whether friends can see home city';
COMMENT ON COLUMN public.user_settings.show_upcoming_trips_to_friends IS 'Controls whether friends can see upcoming saved trips';
COMMENT ON COLUMN public.user_settings.show_activity_feed_to_friends  IS 'Controls whether friends can see activity feed entries';
COMMENT ON COLUMN public.user_settings.show_trip_overlap_alerts       IS 'Controls overlap alerts when a friend books same route/date';

-- ============================================================
-- 3. friend_requests TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id   uuid NOT NULL,
  recipient_user_id   uuid NOT NULL,
  status              text NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  responded_at        timestamptz,

  CONSTRAINT friend_requests_no_self_request
    CHECK (requester_user_id <> recipient_user_id),

  CONSTRAINT friend_requests_unique_pair
    UNIQUE (requester_user_id, recipient_user_id),

  CONSTRAINT friend_requests_status_values
    CHECK (status IN ('pending', 'accepted', 'declined', 'canceled'))
);

COMMENT ON TABLE public.friend_requests IS
  'Stores pending and resolved friend requests between Wildfly users. '
  'One row per directed request; status tracks lifecycle from pending through accepted/declined/canceled.';

COMMENT ON COLUMN public.friend_requests.requester_user_id IS 'auth.uid() of the user who sent the request';
COMMENT ON COLUMN public.friend_requests.recipient_user_id IS 'auth.uid() of the user who received the request';
COMMENT ON COLUMN public.friend_requests.status           IS 'pending | accepted | declined | canceled';
COMMENT ON COLUMN public.friend_requests.responded_at     IS 'Timestamp when the recipient took action on the request';

-- Indexes
CREATE INDEX IF NOT EXISTS index_friend_requests_requester
  ON public.friend_requests (requester_user_id);

CREATE INDEX IF NOT EXISTS index_friend_requests_recipient
  ON public.friend_requests (recipient_user_id);

CREATE INDEX IF NOT EXISTS index_friend_requests_status
  ON public.friend_requests (status);

-- ============================================================
-- 4. friends TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.friends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  friend_user_id    uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  source_request_id uuid REFERENCES public.friend_requests (id) ON DELETE SET NULL,

  CONSTRAINT friends_no_self_friendship
    CHECK (user_id <> friend_user_id),

  CONSTRAINT friends_unique_pair
    UNIQUE (user_id, friend_user_id)
);

COMMENT ON TABLE public.friends IS
  'Stores accepted bidirectional friendships. Two rows are inserted per friendship (A→B and B→A) '
  'so every user can query "my friends" with a simple WHERE user_id = auth.uid().';

COMMENT ON COLUMN public.friends.user_id           IS 'The user who has the friend';
COMMENT ON COLUMN public.friends.friend_user_id    IS 'The friend''s auth.uid()';
COMMENT ON COLUMN public.friends.source_request_id IS 'FK back to the friend_requests row that created this friendship';

-- Indexes
CREATE INDEX IF NOT EXISTS index_friends_user_id
  ON public.friends (user_id);

CREATE INDEX IF NOT EXISTS index_friends_friend_user_id
  ON public.friends (friend_user_id);

-- ============================================================
-- 5. notifications TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS
  'In-app notification inbox for each user. Supports multiple notification types '
  '(friend_request_received, friend_request_accepted, trip_invite_received, trip_invite_accepted, etc.).';

COMMENT ON COLUMN public.notifications.type    IS 'Notification category, e.g. friend_request_received, friend_request_accepted, trip_invite_received, trip_invite_accepted';
COMMENT ON COLUMN public.notifications.data    IS 'Flexible JSON payload for deep-linking (e.g. {request_id, flight_id})';
COMMENT ON COLUMN public.notifications.is_read IS 'True once the user has viewed/dismissed the notification';

-- Indexes
CREATE INDEX IF NOT EXISTS index_notifications_user
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS index_notifications_unread
  ON public.notifications (user_id) WHERE is_read = false;

-- ============================================================
-- 6. trip_shares TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_shares (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_flight_id       uuid NOT NULL REFERENCES public.user_flights (id) ON DELETE CASCADE,
  owner_user_id        uuid NOT NULL,
  shared_with_user_id  uuid NOT NULL,
  status               text NOT NULL DEFAULT 'invited',
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trip_shares_no_self_share
    CHECK (owner_user_id <> shared_with_user_id),

  CONSTRAINT trip_shares_unique_invite
    UNIQUE (user_flight_id, shared_with_user_id),

  CONSTRAINT trip_shares_status_values
    CHECK (status IN ('invited', 'accepted', 'declined'))
);

COMMENT ON TABLE public.trip_shares IS
  'Allows a user to invite one or more friends to join / view a specific saved trip (user_flights row). '
  'status tracks the invite lifecycle: invited → accepted | declined.';

COMMENT ON COLUMN public.trip_shares.user_flight_id      IS 'FK to the user_flights row being shared';
COMMENT ON COLUMN public.trip_shares.owner_user_id       IS 'auth.uid() of the trip owner who sent the invite';
COMMENT ON COLUMN public.trip_shares.shared_with_user_id IS 'auth.uid() of the friend being invited';
COMMENT ON COLUMN public.trip_shares.status              IS 'invited | accepted | declined';

-- Indexes
CREATE INDEX IF NOT EXISTS index_trip_shares_owner
  ON public.trip_shares (owner_user_id);

CREATE INDEX IF NOT EXISTS index_trip_shares_shared
  ON public.trip_shares (shared_with_user_id);

-- ============================================================
-- 7. TRIGRAM + DISCOVERY INDEXES on user_info
-- ============================================================
CREATE INDEX IF NOT EXISTS index_user_info_username_trgm
  ON public.user_info USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS index_user_info_home_city
  ON public.user_info (home_city);

CREATE INDEX IF NOT EXISTS index_user_info_home_airport
  ON public.user_info (home_airport);

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

-- ---- friend_requests ----
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friend requests"
  ON public.friend_requests FOR SELECT
  USING (
    auth.uid() = requester_user_id OR
    auth.uid() = recipient_user_id
  );

CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_user_id);

CREATE POLICY "Recipient can update (accept/decline) friend request"
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Requester can cancel their own friend request"
  ON public.friend_requests FOR DELETE
  USING (auth.uid() = requester_user_id);

-- ---- friends ----
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friends"
  ON public.friends FOR SELECT
  USING (auth.uid() = user_id);

-- ---- notifications ----
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ---- trip_shares ----
ALTER TABLE public.trip_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trip shares they own or received"
  ON public.trip_shares FOR SELECT
  USING (
    auth.uid() = owner_user_id OR
    auth.uid() = shared_with_user_id
  );

CREATE POLICY "Owners can create trip share invites"
  ON public.trip_shares FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Recipient can respond to trip share invite"
  ON public.trip_shares FOR UPDATE
  USING (auth.uid() = shared_with_user_id);

-- ============================================================
-- 9. HELPER SECURITY-DEFINER FUNCTIONS (avoid RLS recursion)
-- ============================================================

-- Returns true if a friendship already exists between two users
CREATE OR REPLACE FUNCTION public.are_friends(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE user_id = _user_a AND friend_user_id = _user_b
  );
$$;

COMMENT ON FUNCTION public.are_friends IS
  'Security-definer helper: returns true when a bidirectional friendship exists. '
  'Used inside RLS policies to avoid infinite recursion.';

-- ============================================================
-- 10. accept_friend_request FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_friend_request(request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_req        record;
BEGIN
  -- 1. Fetch and validate the request
  SELECT id, requester_user_id, recipient_user_id, status
  INTO   v_req
  FROM   public.friend_requests
  WHERE  id = request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'REQUEST_NOT_FOUND');
  END IF;

  IF v_req.recipient_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'reason', 'NOT_RECIPIENT');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'REQUEST_NOT_PENDING', 'current_status', v_req.status);
  END IF;

  -- 2. Prevent duplicate friendship (idempotent guard)
  IF public.are_friends(v_req.requester_user_id, v_req.recipient_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_FRIENDS');
  END IF;

  -- 3. Mark request accepted
  UPDATE public.friend_requests
  SET    status       = 'accepted',
         responded_at = now()
  WHERE  id = request_id;

  -- 4. Insert bidirectional friendship rows
  INSERT INTO public.friends (user_id, friend_user_id, source_request_id)
  VALUES
    (v_req.requester_user_id, v_req.recipient_user_id, request_id),
    (v_req.recipient_user_id, v_req.requester_user_id, request_id)
  ON CONFLICT (user_id, friend_user_id) DO NOTHING;

  -- 5. Notify the requester
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_req.requester_user_id,
    'friend_request_accepted',
    'Friend request accepted',
    'Your friend request was accepted.',
    jsonb_build_object('request_id', request_id, 'accepted_by', v_uid)
  );

  RETURN jsonb_build_object('success', true, 'request_id', request_id);
END;
$$;

COMMENT ON FUNCTION public.accept_friend_request IS
  'Atomically accepts a pending friend request: validates recipient identity, '
  'updates status, inserts two friends rows, and fires a notification to the requester.';

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

-- Auto-notify recipient when a new friend request is received
CREATE OR REPLACE FUNCTION public.notify_friend_request_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire on new pending requests
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.recipient_user_id,
      'friend_request_received',
      'New friend request',
      'You have a new friend request.',
      jsonb_build_object('request_id', NEW.id, 'from_user_id', NEW.requester_user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_friend_request
  AFTER INSERT ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request_received();

COMMENT ON FUNCTION public.notify_friend_request_received IS
  'Trigger function: inserts a notification for the recipient whenever a new friend_request row is inserted with status=pending.';

-- Auto-notify recipient when they are invited to a trip
CREATE OR REPLACE FUNCTION public.notify_trip_invite_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.shared_with_user_id,
    'trip_invite_received',
    'Trip invite',
    'A friend invited you to a trip.',
    jsonb_build_object('trip_share_id', NEW.id, 'from_user_id', NEW.owner_user_id, 'user_flight_id', NEW.user_flight_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_trip_invite
  AFTER INSERT ON public.trip_shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_invite_received();

COMMENT ON FUNCTION public.notify_trip_invite_received IS
  'Trigger function: inserts a notification for the invitee whenever a new trip_shares row is inserted.';

-- Auto-notify owner when invite is accepted
CREATE OR REPLACE FUNCTION public.notify_trip_invite_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'invited' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.owner_user_id,
      'trip_invite_accepted',
      'Trip invite accepted',
      'A friend accepted your trip invite.',
      jsonb_build_object('trip_share_id', NEW.id, 'accepted_by', NEW.shared_with_user_id, 'user_flight_id', NEW.user_flight_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_trip_invite_accepted
  AFTER UPDATE ON public.trip_shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_invite_accepted();

COMMENT ON FUNCTION public.notify_trip_invite_accepted IS
  'Trigger function: fires a notification to the trip owner when a shared_with_user_id changes status to accepted.';

-- ============================================================
-- 12. VIEWS
-- ============================================================

-- friends_with_profiles — enriches friends list with profile data
CREATE OR REPLACE VIEW public.friends_with_profiles AS
SELECT
  f.user_id,
  f.friend_user_id,
  ui.username,
  ui.display_name,
  ui.avatar_url,
  ui.home_city,
  ui.home_airport
FROM public.friends f
JOIN public.user_info ui
  ON ui.auth_user_id = f.friend_user_id;

COMMENT ON VIEW public.friends_with_profiles IS
  'Joins the friends table with user_info to expose profile fields for each friend. '
  'Filter by user_id = auth.uid() in application code (RLS on the friends base table enforces ownership).';

-- pending_friend_requests — enriches incoming requests with requester profile
CREATE OR REPLACE VIEW public.pending_friend_requests AS
SELECT
  fr.id,
  fr.requester_user_id,
  fr.recipient_user_id,
  ui.username         AS requester_username,
  ui.avatar_url       AS requester_avatar,
  fr.created_at
FROM public.friend_requests fr
JOIN public.user_info ui
  ON ui.auth_user_id = fr.requester_user_id
WHERE fr.status = 'pending';

COMMENT ON VIEW public.pending_friend_requests IS
  'Returns all pending friend requests joined with the requester''s public profile fields. '
  'Filter by recipient_user_id = auth.uid() in application code.';
