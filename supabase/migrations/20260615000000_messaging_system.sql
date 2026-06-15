-- ============================================================
-- Messaging System
-- Full transactional email + in-app messaging infrastructure.
-- Tables: messaging_templates, messaging_audiences,
--         messaging_messages, messaging_recipients,
--         messaging_provider_events, messaging_suppressions,
--         messaging_audit_log, messaging_settings,
--         user_email_preferences
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. messaging_templates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_templates (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                        text        NOT NULL UNIQUE,
  name                        text        NOT NULL,
  description                 text,
  category                    text        NOT NULL DEFAULT 'General',
  is_active                   boolean     NOT NULL DEFAULT true,
  is_transactional            boolean     NOT NULL DEFAULT false,
  supported_channels          text[]      NOT NULL DEFAULT ARRAY['email'],

  -- Email fields
  email_subject               text,
  email_preheader             text,
  email_html                  text,
  email_text                  text,
  email_cta_label             text,
  email_cta_url               text,
  default_reply_to            text        NOT NULL DEFAULT 'wildflyapp@gmail.com',

  -- In-app notification fields
  notification_type           text,
  notification_title          text,
  notification_body           text,
  notification_detail_text    text,
  notification_cta_label      text,
  notification_cta_url        text,

  -- Variable declarations
  available_variables         text[]      NOT NULL DEFAULT '{}',
  required_variables          text[]      NOT NULL DEFAULT '{}',

  version                     integer     NOT NULL DEFAULT 1,
  created_by                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  archived_at                 timestamptz
);

ALTER TABLE public.messaging_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read messaging templates"
  ON public.messaging_templates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can insert messaging templates"
  ON public.messaging_templates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can update messaging templates"
  ON public.messaging_templates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 2. messaging_audiences
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_audiences (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  description             text,
  filter_definition       jsonb       NOT NULL DEFAULT '{}',
  is_active               boolean     NOT NULL DEFAULT true,
  last_estimated_count    integer,
  last_estimated_at       timestamptz,
  created_by              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  archived_at             timestamptz
);

ALTER TABLE public.messaging_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read messaging audiences"
  ON public.messaging_audiences FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can insert messaging audiences"
  ON public.messaging_audiences FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can update messaging audiences"
  ON public.messaging_audiences FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 3. messaging_messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_messages (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name           text        NOT NULL,
  internal_description    text,
  category                text        NOT NULL DEFAULT 'General',
  classification          text        NOT NULL DEFAULT 'non_transactional',
  template_id             uuid        REFERENCES public.messaging_templates(id) ON DELETE SET NULL,
  template_version        integer,
  status                  text        NOT NULL DEFAULT 'draft',
  channels                text[]      NOT NULL DEFAULT ARRAY['email'],

  -- Audience
  audience_id             uuid        REFERENCES public.messaging_audiences(id) ON DELETE SET NULL,
  audience_definition     jsonb       NOT NULL DEFAULT '{}',
  recipient_count         integer     NOT NULL DEFAULT 0,
  eligible_count          integer     NOT NULL DEFAULT 0,
  suppressed_count        integer     NOT NULL DEFAULT 0,
  invalid_count           integer     NOT NULL DEFAULT 0,

  -- Snapshotted email content
  email_subject           text,
  email_preheader         text,
  email_html              text,
  email_text              text,
  email_cta_label         text,
  email_cta_url           text,
  reply_to                text        NOT NULL DEFAULT 'wildflyapp@gmail.com',

  -- Snapshotted in-app content
  notification_type       text,
  notification_title      text,
  notification_body       text,
  notification_detail_text text,
  notification_cta_label  text,
  notification_cta_url    text,

  -- Timing
  scheduled_at            timestamptz,
  queued_at               timestamptz,
  started_at              timestamptz,
  completed_at            timestamptz,
  cancelled_at            timestamptz,

  -- Metadata
  created_by              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  idempotency_key         text        UNIQUE,
  last_error              text,

  CONSTRAINT messaging_messages_status_check
    CHECK (status IN ('draft','scheduled','queued','processing','partially_completed','completed','cancelled','failed')),
  CONSTRAINT messaging_messages_classification_check
    CHECK (classification IN ('transactional','non_transactional'))
);

ALTER TABLE public.messaging_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read messaging messages"
  ON public.messaging_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can insert messaging messages"
  ON public.messaging_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can update messaging messages"
  ON public.messaging_messages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 4. messaging_recipients
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_recipients (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id              uuid        NOT NULL REFERENCES public.messaging_messages(id) ON DELETE CASCADE,
  channel                 text        NOT NULL,

  -- Identity
  user_id                 uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  beta_application_id     uuid        REFERENCES public.beta_applications(id) ON DELETE SET NULL,
  email                   text,
  normalized_email        text,
  recipient_name          text,

  -- Personalization snapshot
  personalization         jsonb       NOT NULL DEFAULT '{}',

  -- Delivery state
  status                  text        NOT NULL DEFAULT 'pending',
  provider                text,
  provider_message_id     text,

  -- Retry tracking
  attempt_count           integer     NOT NULL DEFAULT 0,
  next_attempt_at         timestamptz,
  last_attempt_at         timestamptz,
  last_error              text,

  -- Delivery timestamps
  queued_at               timestamptz,
  sent_at                 timestamptz,
  delivered_at            timestamptz,
  opened_at               timestamptz,
  clicked_at              timestamptz,
  failed_at               timestamptz,
  bounced_at              timestamptz,
  complained_at           timestamptz,
  unsubscribed_at         timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT messaging_recipients_status_check
    CHECK (status IN ('pending','queued','processing','sent','delivered','opened','clicked','failed','bounced','complained','suppressed','unsubscribed','cancelled')),
  CONSTRAINT messaging_recipients_channel_check
    CHECK (channel IN ('email','in_app')),
  CONSTRAINT messaging_recipients_unique_per_message
    UNIQUE (message_id, normalized_email, channel)
);

CREATE INDEX IF NOT EXISTS idx_messaging_recipients_message_id
  ON public.messaging_recipients (message_id);
CREATE INDEX IF NOT EXISTS idx_messaging_recipients_status
  ON public.messaging_recipients (status);
CREATE INDEX IF NOT EXISTS idx_messaging_recipients_next_attempt
  ON public.messaging_recipients (next_attempt_at)
  WHERE status IN ('pending','queued') AND next_attempt_at IS NOT NULL;

ALTER TABLE public.messaging_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read messaging recipients"
  ON public.messaging_recipients FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 5. messaging_provider_events
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_provider_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id        uuid        REFERENCES public.messaging_recipients(id) ON DELETE CASCADE,
  message_id          uuid        REFERENCES public.messaging_messages(id) ON DELETE CASCADE,
  provider            text        NOT NULL,
  provider_message_id text,
  event_type          text        NOT NULL,
  provider_event_id   text,
  event_payload       jsonb       NOT NULL DEFAULT '{}',
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT messaging_provider_events_unique_event
    UNIQUE NULLS NOT DISTINCT (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_messaging_provider_events_recipient
  ON public.messaging_provider_events (recipient_id);

ALTER TABLE public.messaging_provider_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on provider events"
  ON public.messaging_provider_events FOR ALL
  USING (false);

-- ─────────────────────────────────────────────────────────────
-- 6. messaging_suppressions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_suppressions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email  text        NOT NULL,
  scope             text        NOT NULL DEFAULT 'all_non_transactional',
  reason            text        NOT NULL,
  source            text        NOT NULL DEFAULT 'system',
  provider          text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  removed_at        timestamptz,

  CONSTRAINT messaging_suppressions_reason_check
    CHECK (reason IN ('unsubscribed','hard_bounce','complaint','manual','invalid')),
  CONSTRAINT messaging_suppressions_scope_check
    CHECK (scope IN ('marketing','product_updates','beta_updates','all_non_transactional','all'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messaging_suppressions_unique
  ON public.messaging_suppressions (normalized_email, scope, reason)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messaging_suppressions_email
  ON public.messaging_suppressions (normalized_email);

ALTER TABLE public.messaging_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read messaging suppressions"
  ON public.messaging_suppressions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can manage messaging suppressions"
  ON public.messaging_suppressions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can update messaging suppressions"
  ON public.messaging_suppressions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 7. user_email_preferences
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  user_id                 uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled           boolean     NOT NULL DEFAULT true,
  email_product_updates   boolean     NOT NULL DEFAULT false,
  email_gowild_updates    boolean     NOT NULL DEFAULT false,
  email_beta_updates      boolean     NOT NULL DEFAULT false,
  email_account_messages  boolean     NOT NULL DEFAULT true,
  email_marketing         boolean     NOT NULL DEFAULT false,
  unsubscribed_at         timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own email preferences"
  ON public.user_email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email preferences"
  ON public.user_email_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 8. messaging_audit_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   uuid,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messaging_audit_log_entity
  ON public.messaging_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_messaging_audit_log_actor
  ON public.messaging_audit_log (actor_id, created_at DESC);

ALTER TABLE public.messaging_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read messaging audit log"
  ON public.messaging_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 9. messaging_settings (key/value store for non-secret config)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaging_settings (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL DEFAULT 'null',
  updated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read messaging settings"
  ON public.messaging_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

CREATE POLICY "Devs can manage messaging settings"
  ON public.messaging_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- 10. beta_applications — additional welcome-email tracking columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.beta_applications
  ADD COLUMN IF NOT EXISTS welcome_message_id      uuid        REFERENCES public.messaging_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS welcome_delivery_status  text        NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS welcome_sent_at          timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_last_error       text;

-- ─────────────────────────────────────────────────────────────
-- 11. updated_at triggers
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.messaging_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'messaging_templates',
    'messaging_audiences',
    'messaging_messages',
    'messaging_recipients',
    'messaging_suppressions',
    'user_email_preferences'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I;
       CREATE TRIGGER %I
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.messaging_set_updated_at();',
      tbl || '_updated_at', tbl,
      tbl || '_updated_at', tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 12. Seed: messaging_templates
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.messaging_templates (
  slug, name, description, category, is_active, is_transactional, supported_channels,
  email_subject, email_preheader,
  email_html, email_text,
  email_cta_label, email_cta_url,
  default_reply_to,
  available_variables, required_variables, version
)
VALUES

-- 1. Welcome to Wildfly
(
  'welcome-to-wildfly',
  'Welcome to Wildfly',
  'General welcome email for new Wildfly users.',
  'Onboarding',
  true, true,
  ARRAY['email'],
  'Welcome to Wildfly ✈️',
  'Your Wildfly account is ready.',
  '<html><body style="font-family:sans-serif;color:#1A2E2E;max-width:600px;margin:0 auto;padding:24px;">
<h1 style="color:#059669;">Welcome to Wildfly</h1>
<p>Hi {{first_name}},</p>
<p>Your Wildfly account is ready. Start exploring smarter flight search and GoWild insights.</p>
<p style="margin:24px 0;"><a href="{{app_url}}" style="background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Wildfly</a></p>
<p>Questions? Reach us at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
<p style="color:#9CA3AF;font-size:12px;margin-top:32px;">The Wildfly Team</p>
</body></html>',
  'Hi {{first_name}}, your Wildfly account is ready. Visit {{app_url}} to get started. Questions? {{support_email}}',
  'Open Wildfly', '{{app_url}}',
  'wildflyapp@gmail.com',
  ARRAY['first_name','last_name','full_name','email','app_url','support_email','unsubscribe_url'],
  ARRAY['first_name','app_url'],
  1
),

-- 2. Beta Applicant Selected (new account — needs to set password)
(
  'beta-applicant-selected',
  'Beta Applicant Selected',
  'Sent to accepted beta testers. Includes account setup link.',
  'Beta',
  true, true,
  ARRAY['email'],
  'Welcome to the Wildfly Beta ✈️',
  'You''ve been selected for the Wildfly beta.',
  '<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2F3F3;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F3F3;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#059669,#10B981);padding:32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-0.5px;">Wildfly Beta</h1>
    <p style="color:#A7F3D0;margin:8px 0 0;font-size:14px;">You''re in.</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px;">
    <p style="color:#1A2E2E;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi <strong>{{first_name}}</strong>,</p>
    <p style="color:#1A2E2E;font-size:16px;line-height:1.6;margin:0 0 24px;">You''ve been selected to join the Wildfly beta testing group. Welcome aboard!</p>
    <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 16px;">Wildfly is being built to make Frontier and GoWild flight discovery faster, clearer, and far less dependent on repeatedly searching the same routes by hand.</p>
    <!-- Features list -->
    <table cellpadding="0" cellspacing="0" style="background:#F0FDF4;border-radius:12px;padding:20px;margin:0 0 24px;width:100%;">
      <tr><td style="color:#1A2E2E;font-size:14px;line-height:2;">
        <div>✅ Search one-way, round-trip, day-trip, and multi-day flight options</div>
        <div>✅ Search multiple airports or explore all available destinations</div>
        <div>✅ Quickly identify flights with GoWild fares and available GoWild seats</div>
        <div>✅ Compare departure times, routes, fare options, and connections</div>
        <div>✅ Explore GoWild availability, timing, route, and seat insights</div>
        <div>✅ Save, organize, and share flight-search results</div>
      </td></tr>
    </table>
    <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 24px;">Your beta account also includes <strong style="color:#059669;">Gold access</strong>, giving you full access to Wildfly''s available search and insight features while you help test the app.</p>
    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="background:#059669;border-radius:10px;">
        <a href="{{account_cta_url}}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">{{account_cta_label}}</a>
      </td></tr>
    </table>
    <p style="color:#6B7280;font-size:13px;margin:0 0 8px;">Or copy this link:</p>
    <p style="color:#6B7280;font-size:12px;word-break:break-all;margin:0 0 24px;"><a href="{{account_cta_url}}" style="color:#059669;">{{account_cta_url}}</a></p>
    <!-- Feedback -->
    <table cellpadding="0" cellspacing="0" style="border-left:3px solid #059669;padding:0 0 0 16px;margin:0 0 24px;">
      <tr><td>
        <p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0 0 8px;">During testing, the most helpful feedback includes:</p>
        <ul style="color:#4B5563;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Flight information that appears incorrect or incomplete</li>
          <li>Searches that return unexpected results</li>
          <li>Buttons, filters, or screens that are confusing</li>
          <li>Features that save you time</li>
          <li>Features or improvements you believe would make Wildfly more useful</li>
        </ul>
      </td></tr>
    </table>
    <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 24px;">Questions or feedback can be sent to <a href="mailto:{{support_email}}" style="color:#059669;">{{support_email}}</a>.</p>
    <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0;">Thank you for helping shape Wildfly before its wider release.</p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#F8F9F9;padding:20px 32px;border-top:1px solid #F0F1F1;">
    <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0 0 8px;">The Wildfly Team</p>
    <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:0 0 4px;">You received this email because you applied to participate in the Wildfly beta.</p>
    <p style="color:#9CA3AF;font-size:11px;text-align:center;margin:0;"><a href="{{unsubscribe_url}}" style="color:#9CA3AF;">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>',
  'Hi {{first_name}},

You''ve been selected to join the Wildfly beta testing group. Welcome aboard!

Wildfly is being built to make Frontier and GoWild flight discovery faster, clearer, and far less dependent on repeatedly searching the same routes by hand.

With Wildfly, you can:

• Search one-way, round-trip, day-trip, and multi-day flight options
• Search multiple airports or explore all available destinations
• Quickly identify flights with GoWild fares and available GoWild seats
• Compare departure times, routes, fare options, and connections
• Explore GoWild availability, timing, route, and seat insights
• Save, organize, and share flight-search results

Your beta account also includes Gold access, giving you full access to Wildfly''s available search and insight features while you help test the app.

To get started, use the link below:

{{account_cta_label}}: {{account_cta_url}}

During testing, the most helpful feedback includes:

• Flight information that appears incorrect or incomplete
• Searches that return unexpected results
• Buttons, filters, or screens that are confusing
• Features that save you time
• Features or improvements you believe would make Wildfly more useful

Questions or feedback can be sent to {{support_email}}.

Thank you for helping shape Wildfly before its wider release.

The Wildfly Team

You received this email because you applied to participate in the Wildfly beta.',
  '{{account_cta_label}}', '{{account_cta_url}}',
  'wildflyapp@gmail.com',
  ARRAY['first_name','last_name','full_name','email','home_airport','account_cta_label','account_cta_url','support_email','app_url','unsubscribe_url'],
  ARRAY['first_name','account_cta_label','account_cta_url','support_email'],
  1
),

-- 3. New Feature Rollout
(
  'new-feature-rollout',
  'New Feature Rollout',
  'Announce a new feature to product-update subscribers.',
  'Product Update',
  true, false,
  ARRAY['email','in_app'],
  'New in Wildfly: {{feature_name}}',
  'See what''s new in the Wildfly app.',
  '<html><body style="font-family:sans-serif;color:#1A2E2E;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#059669;">What''s New in Wildfly</h2>
<p>Hi {{first_name}},</p>
<p>We just shipped something new. Check it out in the app.</p>
<p><a href="{{app_url}}" style="background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Wildfly</a></p>
<hr style="border:none;border-top:1px solid #F0F1F1;margin:24px 0;">
<p style="color:#9CA3AF;font-size:12px;">You''re receiving this because you opted in to product updates. <a href="{{unsubscribe_url}}" style="color:#9CA3AF;">Unsubscribe</a></p>
</body></html>',
  'Hi {{first_name}}, we just shipped something new in Wildfly. Check it out at {{app_url}}. Unsubscribe: {{unsubscribe_url}}',
  'See What''s New', '{{app_url}}',
  'wildflyapp@gmail.com',
  ARRAY['first_name','full_name','email','app_url','support_email','unsubscribe_url'],
  ARRAY['first_name','app_url','unsubscribe_url'],
  1
),

-- 4. GoWild Feature Update
(
  'gowild-feature-update',
  'GoWild Feature Update',
  'Announce GoWild-specific features or pass updates.',
  'GoWild Update',
  true, false,
  ARRAY['email','in_app'],
  'GoWild Update from Wildfly ✈️',
  'New GoWild insights available.',
  '<html><body style="font-family:sans-serif;color:#1A2E2E;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#059669;">GoWild Update</h2>
<p>Hi {{first_name}},</p>
<p>There''s a new GoWild update worth knowing about. Open Wildfly to explore the latest GoWild insights.</p>
<p><a href="{{app_url}}" style="background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Wildfly</a></p>
<hr style="border:none;border-top:1px solid #F0F1F1;margin:24px 0;">
<p style="color:#9CA3AF;font-size:12px;"><a href="{{unsubscribe_url}}" style="color:#9CA3AF;">Unsubscribe</a></p>
</body></html>',
  'Hi {{first_name}}, there''s a new GoWild update in Wildfly. Check it out at {{app_url}}. Unsubscribe: {{unsubscribe_url}}',
  'Open Wildfly', '{{app_url}}',
  'wildflyapp@gmail.com',
  ARRAY['first_name','full_name','email','app_url','support_email','unsubscribe_url'],
  ARRAY['first_name','app_url','unsubscribe_url'],
  1
),

-- 5. Scheduled Maintenance
(
  'scheduled-maintenance',
  'Scheduled Maintenance',
  'Notify users of planned downtime.',
  'Maintenance',
  true, false,
  ARRAY['email','in_app'],
  'Wildfly Maintenance — {{maintenance_date}}',
  'Brief planned maintenance scheduled.',
  '<html><body style="font-family:sans-serif;color:#1A2E2E;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#D97706;">Scheduled Maintenance</h2>
<p>Hi {{first_name}},</p>
<p>Wildfly will undergo brief scheduled maintenance. The app may be temporarily unavailable during this time.</p>
<p style="color:#9CA3AF;font-size:12px;margin-top:24px;"><a href="{{unsubscribe_url}}" style="color:#9CA3AF;">Unsubscribe</a></p>
</body></html>',
  'Hi {{first_name}}, Wildfly will undergo brief scheduled maintenance. Unsubscribe: {{unsubscribe_url}}',
  NULL, NULL,
  'wildflyapp@gmail.com',
  ARRAY['first_name','full_name','email','app_url','support_email','unsubscribe_url'],
  ARRAY['first_name','unsubscribe_url'],
  1
),

-- 6. Feedback Request
(
  'feedback-request',
  'Feedback Request',
  'Ask users for feedback on their Wildfly experience.',
  'Feedback',
  true, false,
  ARRAY['email'],
  'How is Wildfly working for you?',
  'We''d love your feedback.',
  '<html><body style="font-family:sans-serif;color:#1A2E2E;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#059669;">We''d Love Your Feedback</h2>
<p>Hi {{first_name}},</p>
<p>You''ve been using Wildfly, and we''d love to hear what you think. Reply to this email or reach us at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
<p style="color:#9CA3AF;font-size:12px;margin-top:24px;"><a href="{{unsubscribe_url}}" style="color:#9CA3AF;">Unsubscribe</a></p>
</body></html>',
  'Hi {{first_name}}, we''d love your feedback on Wildfly. Reply to this email or reach us at {{support_email}}. Unsubscribe: {{unsubscribe_url}}',
  NULL, NULL,
  'wildflyapp@gmail.com',
  ARRAY['first_name','full_name','email','support_email','unsubscribe_url'],
  ARRAY['first_name','support_email','unsubscribe_url'],
  1
),

-- 7. Account Update
(
  'account-update',
  'Account Update',
  'Transactional account notification (plan change, access update, etc.).',
  'Account',
  true, true,
  ARRAY['email'],
  'Your Wildfly Account Update',
  'An update to your Wildfly account.',
  '<html><body style="font-family:sans-serif;color:#1A2E2E;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#059669;">Account Update</h2>
<p>Hi {{first_name}},</p>
<p>There has been an update to your Wildfly account. If you have questions, contact us at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
<p style="color:#9CA3AF;font-size:12px;margin-top:24px;">The Wildfly Team</p>
</body></html>',
  'Hi {{first_name}}, there has been an update to your Wildfly account. Questions? {{support_email}}',
  'Open Wildfly', '{{app_url}}',
  'wildflyapp@gmail.com',
  ARRAY['first_name','full_name','email','app_url','support_email'],
  ARRAY['first_name','support_email'],
  1
)

ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 13. Seed: messaging_audiences
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.messaging_audiences (name, description, filter_definition)
VALUES
  ('All Active Users',            'All Wildfly users with an active account.',
   '{"sources":[{"type":"active_users","filters":{}}],"logic":"union"}'),
  ('Accepted Beta Testers',       'Beta applicants with status = accepted.',
   '{"sources":[{"type":"beta_applicants","filters":{"status":"accepted"}}],"logic":"union"}'),
  ('Shortlisted Beta Applicants', 'Beta applicants with status = shortlisted.',
   '{"sources":[{"type":"beta_applicants","filters":{"status":"shortlisted"}}],"logic":"union"}'),
  ('Gold Members',                'Users with an active Gold subscription.',
   '{"sources":[{"type":"active_users","filters":{"plan":"gold"}}],"logic":"union"}'),
  ('Product Update Subscribers',  'Users who opted into product update emails.',
   '{"sources":[{"type":"active_users","filters":{"email_pref":"email_product_updates"}}],"logic":"union"}'),
  ('Beta Update Subscribers',     'Users who opted into beta update emails.',
   '{"sources":[{"type":"active_users","filters":{"email_pref":"email_beta_updates"}}],"logic":"union"}')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 14. Default messaging_settings
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.messaging_settings (key, value)
VALUES
  ('from_name',         '"Wildfly"'),
  ('reply_to',          '"wildflyapp@gmail.com"'),
  ('support_email',     '"wildflyapp@gmail.com"'),
  ('unsubscribe_base',  '"https://wildflyapp.com/unsubscribe"'),
  ('physical_address',  '"Wildfly, United States"')
ON CONFLICT (key) DO NOTHING;
