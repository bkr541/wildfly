-- Add length constraints to beta_applications text columns.
-- Safe: table was just created in 20260605032408_beta_applications.sql;
-- no production data exists yet.
-- Mirrors frontend maxLength values so the DB enforces the same limits
-- even if the frontend is bypassed.

ALTER TABLE public.beta_applications
  ADD CONSTRAINT beta_applications_full_name_length_check
    CHECK (char_length(full_name) <= 120),
  ADD CONSTRAINT beta_applications_email_length_check
    CHECK (char_length(email) <= 254),
  ADD CONSTRAINT beta_applications_home_airport_length_check
    CHECK (char_length(home_airport) <= 20),
  ADD CONSTRAINT beta_applications_gowild_search_tool_name_length_check
    CHECK (gowild_search_tool_name IS NULL OR char_length(gowild_search_tool_name) <= 255),
  ADD CONSTRAINT beta_applications_beta_testing_details_length_check
    CHECK (beta_testing_details IS NULL OR char_length(beta_testing_details) <= 500),
  ADD CONSTRAINT beta_applications_frequent_destinations_length_check
    CHECK (frequent_destinations IS NULL OR char_length(frequent_destinations) <= 500),
  ADD CONSTRAINT beta_applications_value_expectation_length_check
    CHECK (value_expectation IS NULL OR char_length(value_expectation) <= 1000),
  ADD CONSTRAINT beta_applications_additional_notes_length_check
    CHECK (additional_notes IS NULL OR char_length(additional_notes) <= 1000);
