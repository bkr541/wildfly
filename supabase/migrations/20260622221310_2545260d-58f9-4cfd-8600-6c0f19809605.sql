CREATE OR REPLACE FUNCTION public.apply_pending_migration(p_version text, p_name text, p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, supabase_migrations
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_already boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.developer_allowlist WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Unauthorized: developer access required';
  END IF;
  IF p_version IS NULL OR length(trim(p_version)) = 0 THEN
    RAISE EXCEPTION 'p_version required';
  END IF;
  IF p_sql IS NULL OR length(trim(p_sql)) = 0 THEN
    RAISE EXCEPTION 'p_sql required';
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = p_version) THEN
    RETURN jsonb_build_object('status', 'skipped', 'version', p_version);
  END IF;

  BEGIN
    EXECUTE p_sql;
  EXCEPTION
    WHEN duplicate_table OR duplicate_object OR duplicate_function
      OR duplicate_schema OR duplicate_column OR duplicate_alias THEN
      v_already := true;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%already exists%' THEN
        v_already := true;
      ELSE
        RAISE;
      END IF;
  END;

  INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
  VALUES (p_version, COALESCE(p_name, ''), ARRAY[p_sql])
  ON CONFLICT (version) DO NOTHING;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_already THEN 'already_applied' ELSE 'applied' END,
    'version', p_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_pending_migration(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_pending_migration(text, text, text) TO authenticated, service_role;