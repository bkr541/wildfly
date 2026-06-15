-- Developer-only SQL execution function for the admin Data view.
-- SECURITY DEFINER lets it bypass RLS, but the allowlist check ensures
-- only users in developer_allowlist can invoke it.
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.developer_allowlist WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: developer access required';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s) t',
    query
  ) INTO result;

  RETURN result;
END;
$$;

-- Revoke from public; only authenticated sessions may call this.
-- The allowlist check inside the function provides the second layer.
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
