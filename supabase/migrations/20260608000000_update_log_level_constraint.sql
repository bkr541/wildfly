-- Update log_level validation to match the frontend LogLevel type:
--   silent | error | warn | info | debug
-- Previous allowed values were: off | error | info | debug

-- Replace the validation function with the new allowed set
CREATE OR REPLACE FUNCTION public.validate_log_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.log_level NOT IN ('silent', 'error', 'warn', 'info', 'debug') THEN
    RAISE EXCEPTION 'log_level must be silent, error, warn, info, or debug';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Migrate any existing 'off' rows to 'silent' (equivalent: nothing logs)
UPDATE public.developer_settings
SET log_level = 'silent'
WHERE log_level = 'off';
