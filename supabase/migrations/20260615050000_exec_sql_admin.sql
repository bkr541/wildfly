-- Service-role-only SQL query executor for the admin Data view.
-- Unlike exec_sql (authenticated role, 8-second PostgREST timeout), this
-- function is callable only by service_role (edge functions) which have no
-- gateway statement timeout. The developer-allowlist check is enforced in
-- the calling edge function (admin-run-sql) before this is ever invoked.
CREATE OR REPLACE FUNCTION public.exec_sql_admin(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json)
       FROM (SELECT * FROM (%s) _q LIMIT 500) t',
    query
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_sql_admin(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql_admin(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql_admin(text) TO service_role;
