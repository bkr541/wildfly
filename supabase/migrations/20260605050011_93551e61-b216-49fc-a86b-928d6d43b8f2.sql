CREATE TABLE IF NOT EXISTS public.beta_applications (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                 text        NOT NULL,
  email                     text        NOT NULL,
  normalized_email          text        GENERATED ALWAYS AS (lower(trim(email))) STORED,
  home_airport              text        NOT NULL,
  gowild_status             text        NOT NULL,
  gowild_pass_duration      text        NULL,
  gowild_search_frequency   text        NOT NULL,
  frontier_flight_frequency text        NOT NULL,
  uses_gowild_search_tool   text        NOT NULL,
  gowild_search_tool_name   text        NULL,
  beta_testing_experience   text        NOT NULL,
  beta_testing_details      text        NULL,
  feedback_commitment       boolean     NOT NULL DEFAULT false,
  primary_device            text        NOT NULL,
  preferred_feedback_method text        NULL,
  frequent_destinations     text        NULL,
  interested_features       text[]      NOT NULL DEFAULT '{}',
  value_expectation         text        NULL,
  additional_notes          text        NULL,
  source                    text        NOT NULL DEFAULT 'public_beta_page',
  utm_source                text        NULL,
  utm_medium                text        NULL,
  utm_campaign              text        NULL,
  referrer                  text        NULL,
  status                    text        NOT NULL DEFAULT 'new',
  internal_notes            text        NULL,
  selected_at               timestamptz NULL,
  invited_at                timestamptz NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_applications_status_check
    CHECK (status IN ('new', 'shortlisted', 'invited', 'accepted', 'rejected')),
  CONSTRAINT beta_applications_gowild_status_check
    CHECK (gowild_status IN ('current_pass_holder','former_pass_holder','considering','no_frontier_flyer','no_not_frontier_flyer')),
  CONSTRAINT beta_applications_gowild_pass_duration_check
    CHECK (gowild_pass_duration IS NULL OR gowild_pass_duration IN ('less_than_3_months','three_to_six_months','six_to_twelve_months','one_to_two_years','two_plus_years')),
  CONSTRAINT beta_applications_gowild_search_frequency_check
    CHECK (gowild_search_frequency IN ('daily','few_times_week','weekly','few_times_month','planning_only','rarely')),
  CONSTRAINT beta_applications_frontier_flight_frequency_check
    CHECK (frontier_flight_frequency IN ('weekly','few_times_month','monthly','few_times_year','rarely','never')),
  CONSTRAINT beta_applications_uses_gowild_search_tool_check
    CHECK (uses_gowild_search_tool IN ('yes', 'no', 'used_to', 'not_sure')),
  CONSTRAINT beta_applications_beta_testing_experience_check
    CHECK (beta_testing_experience IN ('yes_professional', 'no', 'informal')),
  CONSTRAINT beta_applications_primary_device_check
    CHECK (primary_device IN ('iphone','android','desktop_laptop','tablet','multiple')),
  CONSTRAINT beta_applications_preferred_feedback_method_check
    CHECK (preferred_feedback_method IS NULL OR preferred_feedback_method IN ('email','in_app','google_form','discord','text_message','screen_recording')),
  CONSTRAINT beta_applications_full_name_length_check
    CHECK (char_length(full_name) <= 120),
  CONSTRAINT beta_applications_email_length_check
    CHECK (char_length(email) <= 254),
  CONSTRAINT beta_applications_home_airport_length_check
    CHECK (char_length(home_airport) <= 20),
  CONSTRAINT beta_applications_gowild_search_tool_name_length_check
    CHECK (gowild_search_tool_name IS NULL OR char_length(gowild_search_tool_name) <= 255),
  CONSTRAINT beta_applications_beta_testing_details_length_check
    CHECK (beta_testing_details IS NULL OR char_length(beta_testing_details) <= 500),
  CONSTRAINT beta_applications_frequent_destinations_length_check
    CHECK (frequent_destinations IS NULL OR char_length(frequent_destinations) <= 500),
  CONSTRAINT beta_applications_value_expectation_length_check
    CHECK (value_expectation IS NULL OR char_length(value_expectation) <= 1000),
  CONSTRAINT beta_applications_additional_notes_length_check
    CHECK (additional_notes IS NULL OR char_length(additional_notes) <= 1000)
);

GRANT INSERT ON public.beta_applications TO anon, authenticated;
GRANT ALL ON public.beta_applications TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS beta_applications_normalized_email_uidx ON public.beta_applications (normalized_email);
CREATE INDEX IF NOT EXISTS beta_applications_home_airport_idx ON public.beta_applications (home_airport);
CREATE INDEX IF NOT EXISTS beta_applications_status_idx ON public.beta_applications (status);
CREATE INDEX IF NOT EXISTS beta_applications_gowild_status_idx ON public.beta_applications (gowild_status);
CREATE INDEX IF NOT EXISTS beta_applications_created_at_idx ON public.beta_applications (created_at DESC);

ALTER TABLE public.beta_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a beta application"
  ON public.beta_applications
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_beta_applications_updated_at
  BEFORE UPDATE ON public.beta_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();