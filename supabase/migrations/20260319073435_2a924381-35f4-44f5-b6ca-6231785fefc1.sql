
-- ══════════════════════════════════════════════════════════════
-- 1. Backfill user_settings for all existing users who lack one
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.user_settings (
  user_id,
  notifications_enabled,
  notify_gowild_availability,
  notify_new_features,
  notify_new_routes,
  notify_pass_sales,
  theme_preference,
  default_departure_to_home,
  allow_friend_requests,
  show_home_city_to_friends,
  show_upcoming_trips_to_friends,
  show_activity_feed_to_friends,
  show_trip_overlap_alerts
)
SELECT
  ui.auth_user_id,
  false,
  false,
  true,
  false,
  false,
  'system',
  false,
  true,
  true,
  true,
  true,
  true
FROM public.user_info ui
LEFT JOIN public.user_settings s ON s.user_id = ui.auth_user_id
WHERE ui.auth_user_id IS NOT NULL
  AND s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 2. Backfill user_subscriptions gaps (defensive)
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.user_subscriptions (user_id, plan_id, status)
SELECT ui.auth_user_id, 'free', 'active'
FROM public.user_info ui
LEFT JOIN public.user_subscriptions us ON us.user_id = ui.auth_user_id
WHERE ui.auth_user_id IS NOT NULL
  AND us.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 3. Backfill user_credit_wallet gaps (defensive)
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.user_credit_wallet (user_id, monthly_used, monthly_period_start, monthly_period_end, purchased_balance)
SELECT ui.auth_user_id, 0, now(), now() + interval '1 month', 0
FROM public.user_info ui
LEFT JOIN public.user_credit_wallet w ON w.user_id = ui.auth_user_id
WHERE ui.auth_user_id IS NOT NULL
  AND w.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 4. Update provisioning trigger to also create user_settings
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_credit_wallet (user_id, monthly_used, monthly_period_start, monthly_period_end, purchased_balance)
  VALUES (NEW.id, 0, now(), now() + interval '1 month', 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_settings (
    user_id,
    notifications_enabled,
    notify_gowild_availability,
    notify_new_features,
    notify_new_routes,
    notify_pass_sales,
    theme_preference,
    default_departure_to_home,
    allow_friend_requests,
    show_home_city_to_friends,
    show_upcoming_trips_to_friends,
    show_activity_feed_to_friends,
    show_trip_overlap_alerts
  )
  VALUES (
    NEW.id,
    false,
    false,
    true,
    false,
    false,
    'system',
    false,
    true,
    true,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
