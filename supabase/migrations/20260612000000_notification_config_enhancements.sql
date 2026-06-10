
-- ============================================================
-- Notification Type Config Enhancements
-- Extends notification_type_configs with display metadata,
-- creates notification_feed_view for config-enriched reads,
-- and upserts the canonical set of known notification types.
-- ============================================================


-- ── 1. Extend notification_type_configs ──────────────────────

ALTER TABLE public.notification_type_configs
  ADD COLUMN IF NOT EXISTS display_type              text,
  ADD COLUMN IF NOT EXISTS icon_name                 text,
  ADD COLUMN IF NOT EXISTS main_color                text,
  ADD COLUMN IF NOT EXISTS background_color          text,
  ADD COLUMN IF NOT EXISTS border_color              text,
  ADD COLUMN IF NOT EXISTS severity                  text    NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS authority                 text    NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS default_detail_text       text,
  ADD COLUMN IF NOT EXISTS sort_order                integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS show_in_admin             boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_user_notifications boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_type_configs.display_type IS
  'Broad user-facing category: Request, Invite, Issue, Flight Alert, Success, System, etc.';
COMMENT ON COLUMN public.notification_type_configs.icon_name IS
  'Hugeicons component name stored as a string, resolved at runtime via the icon registry.';
COMMENT ON COLUMN public.notification_type_configs.main_color IS
  'Primary brand color for this notification type (hex). Preferred over legacy group_color.';
COMMENT ON COLUMN public.notification_type_configs.background_color IS
  'Soft background fill for icon containers and card tints (hex).';
COMMENT ON COLUMN public.notification_type_configs.border_color IS
  'Card border color when this notification type is unread (hex).';
COMMENT ON COLUMN public.notification_type_configs.severity IS
  'One of: info | success | warning | critical. Controls accent styling in the UI.';
COMMENT ON COLUMN public.notification_type_configs.authority IS
  'Who creates this notification: user | admin | system.';
COMMENT ON COLUMN public.notification_type_configs.default_detail_text IS
  'Optional longer technical detail template, surfaced in admin and detail views.';
COMMENT ON COLUMN public.notification_type_configs.sort_order IS
  'Display ordering within a group. Lower = earlier.';
COMMENT ON COLUMN public.notification_type_configs.show_in_admin IS
  'Whether this type appears in the admin Sent tab. False for high-volume user types.';
COMMENT ON COLUMN public.notification_type_configs.show_in_user_notifications IS
  'Whether notifications of this type appear in the user-facing Notifications page.';

-- Backfill main_color from group_color for rows created before this migration
UPDATE public.notification_type_configs
SET main_color = group_color
WHERE main_color IS NULL AND group_color IS NOT NULL;


-- ── 2. Read policy for authenticated users on config table ───
-- Config data (labels, colors, icons) is display metadata, not sensitive.
-- Regular app users must be able to resolve it via notification_feed_view.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notification_type_configs'
      AND policyname = 'Authenticated users can read notification type configs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can read notification type configs"
        ON public.notification_type_configs FOR SELECT
        USING (auth.role() = 'authenticated')
    $policy$;
  END IF;
END $$;


-- ── 3. notification_feed_view ─────────────────────────────────
-- Joins notifications with their config for enriched client reads.
-- RLS on notifications still applies (users see only their own rows).

CREATE OR REPLACE VIEW public.notification_feed_view AS
SELECT
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.body,
  n.detail_text,
  n.data,
  n.is_read,
  n.audience,
  n.created_at,

  -- notification_group: prefer the stored value on the row, then fall back to config
  coalesce(n.notification_group, ntc.notification_group, 'General')  AS notification_group,

  -- config-derived display fields
  ntc.label                                                            AS config_label,
  ntc.display_type,
  ntc.icon_name,
  coalesce(ntc.main_color, ntc.group_color, '#059669')                AS main_color,
  coalesce(ntc.background_color, '#ECFDF5')                           AS background_color,
  coalesce(ntc.border_color, '#A7F3D0')                               AS border_color,
  coalesce(ntc.severity, 'info')                                      AS severity,
  ntc.authority,
  ntc.is_active   AS config_is_active,
  ntc.show_in_admin,
  ntc.show_in_user_notifications

FROM public.notifications n
LEFT JOIN public.notification_type_configs ntc
  ON ntc.type = n.type;

GRANT SELECT ON public.notification_feed_view TO authenticated;

COMMENT ON VIEW public.notification_feed_view IS
  'Enriched notification feed: joins notifications with notification_type_configs to resolve icon, colors, display_type, and group labels. RLS from the notifications table still applies.';


-- ── 4. Upsert canonical notification type configs ─────────────

INSERT INTO public.notification_type_configs (
  type,
  label,
  display_type,
  notification_group,
  icon_name,
  main_color,
  background_color,
  border_color,
  group_color,
  severity,
  audience,
  authority,
  default_title,
  default_body,
  default_detail_text,
  sort_order,
  is_active,
  show_in_admin,
  show_in_user_notifications
)
VALUES

  -- ── Friends ───────────────────────────────────────────────
  (
    'friend_request_received',
    'Friend Request Received',
    'Request',
    'Friends',
    'UserAdd01Icon',
    '#2563EB', '#EFF6FF', '#BFDBFE', '#2563EB',
    'info', 'All', 'user',
    'New Friend Request',
    'You have a new friend request.',
    'Review and respond to the friend request.',
    10, true, false, true
  ),
  (
    'friend_request_accepted',
    'Friend Request Accepted',
    'Success',
    'Friends',
    'UserCheck01Icon',
    '#10B981', '#ECFDF5', '#A7F3D0', '#10B981',
    'success', 'All', 'user',
    'Friend Request Accepted',
    'Your friend request was accepted.',
    'You are now connected.',
    20, true, false, true
  ),

  -- ── Trips ─────────────────────────────────────────────────
  (
    'trip_invite_received',
    'Trip Invite Received',
    'Invite',
    'Trips',
    'Route01Icon',
    '#7C3AED', '#F5F3FF', '#DDD6FE', '#7C3AED',
    'info', 'All', 'user',
    'Trip Invite',
    'You have been invited to a trip.',
    'Open the invite to view trip details.',
    30, true, false, true
  ),
  (
    'trip_invite_accepted',
    'Trip Invite Accepted',
    'Success',
    'Trips',
    'CheckmarkCircle01Icon',
    '#10B981', '#ECFDF5', '#A7F3D0', '#10B981',
    'success', 'All', 'user',
    'Trip Invite Accepted',
    'Your trip invite was accepted.',
    'The trip member list has been updated.',
    40, true, false, true
  ),

  -- ── Job Schedules ─────────────────────────────────────────
  (
    'bulk_search_stuck',
    'Bulk Search Stuck',
    'Issue',
    'Job Schedules',
    'Alert02Icon',
    '#F59E0B', '#FFFBEB', '#FDE68A', '#F59E0B',
    'warning', 'Admin', 'admin',
    'Bulk Search Stuck',
    'A bulk search job appears to be stuck.',
    'Review the job schedule and retry or cancel the process.',
    90, true, true, false
  ),
  (
    'bulk_search_failed',
    'Bulk Search Failed',
    'Issue',
    'Job Schedules',
    'Alert01Icon',
    '#DC2626', '#FEF2F2', '#FECACA', '#DC2626',
    'critical', 'Admin', 'admin',
    'Bulk Search Failed',
    'A bulk search job failed.',
    'Review the failure details in the job schedule logs.',
    100, true, true, false
  )

ON CONFLICT (type) DO UPDATE SET
  label                       = EXCLUDED.label,
  display_type                = EXCLUDED.display_type,
  notification_group          = EXCLUDED.notification_group,
  icon_name                   = EXCLUDED.icon_name,
  main_color                  = EXCLUDED.main_color,
  background_color            = EXCLUDED.background_color,
  border_color                = EXCLUDED.border_color,
  group_color                 = EXCLUDED.group_color,
  severity                    = EXCLUDED.severity,
  audience                    = EXCLUDED.audience,
  authority                   = EXCLUDED.authority,
  default_title               = EXCLUDED.default_title,
  default_body                = EXCLUDED.default_body,
  default_detail_text         = EXCLUDED.default_detail_text,
  sort_order                  = EXCLUDED.sort_order,
  is_active                   = EXCLUDED.is_active,
  show_in_admin               = EXCLUDED.show_in_admin,
  show_in_user_notifications  = EXCLUDED.show_in_user_notifications;
