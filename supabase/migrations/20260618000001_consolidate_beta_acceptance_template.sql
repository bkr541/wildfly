-- ============================================================
-- Consolidate beta acceptance email templates.
--
-- The canonical template is beta-application-accepted.
-- The legacy template beta-applicant-selected is archived
-- (is_active = false) so historical message records remain
-- intact while no new sends can select it.
--
-- Also updates available_variables / required_variables on
-- the canonical template to match what admin-approve-beta-
-- application now provides, and adds a case-insensitive
-- unique index to prevent future slug collisions.
-- ============================================================

-- 1. Ensure the canonical template is active and its variable
--    metadata matches the Edge Function's variable map.
UPDATE public.messaging_templates
SET
  is_active          = true,
  available_variables = ARRAY[
    'first_name', 'last_name', 'full_name', 'email',
    'home_airport', 'app_name', 'app_url',
    'account_cta_label', 'account_cta_url', 'action_link',
    'support_email', 'physical_address', 'current_year'
  ],
  required_variables  = ARRAY[
    'first_name', 'account_cta_label', 'account_cta_url', 'support_email'
  ],
  updated_at         = NOW()
WHERE slug = 'beta-application-accepted';

-- 2. Archive the legacy template so it cannot be selected
--    for new sends. Historical message records are preserved.
UPDATE public.messaging_templates
SET
  is_active  = false,
  name       = 'Beta Applicant Selected (Legacy)',
  updated_at = NOW()
WHERE slug = 'beta-applicant-selected';

-- 3. Add a case-insensitive unique index on slug so future
--    inserts cannot introduce variants that differ only by case.
--    The existing UNIQUE constraint on slug is case-sensitive;
--    this index closes that gap without dropping the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS messaging_templates_slug_unique_lower_idx
  ON public.messaging_templates (LOWER(slug));
