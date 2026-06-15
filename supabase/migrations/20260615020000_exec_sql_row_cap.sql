-- Replace exec_sql with a version that caps results at 500 rows and raises
-- the local statement timeout so it isn't killed by the default 8s limit.
-- The row cap prevents json_agg from reading the full table into memory.
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

  -- Give complex queries up to 30 s before timing out.
  SET LOCAL statement_timeout = '30000';

  -- Wrap the caller's query with a hard 500-row cap so json_agg never has to
  -- aggregate an entire large table into memory.
  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json)
       FROM (SELECT * FROM (%s) _q LIMIT 500) t',
    query
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
