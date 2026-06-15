CREATE OR REPLACE FUNCTION public.admin_exec_ddl(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.developer_allowlist WHERE user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Unauthorized: developer access required';
  END IF;

  IF p_sql IS NULL OR length(trim(p_sql)) = 0 THEN
    RAISE EXCEPTION 'p_sql cannot be empty';
  END IF;

  EXECUTE p_sql;

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_exec_ddl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_exec_ddl(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exec_ddl(text) TO service_role;