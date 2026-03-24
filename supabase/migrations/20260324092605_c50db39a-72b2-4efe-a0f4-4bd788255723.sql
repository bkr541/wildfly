-- Allow authenticated users to insert flight_snapshots for their own searches
DROP POLICY IF EXISTS "No client insert flight snapshots" ON public.flight_snapshots;

CREATE POLICY "Users can insert snapshots for own searches"
  ON public.flight_snapshots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.flight_searches fs
      WHERE fs.id = flight_search_id
        AND fs.user_id = auth.uid()
    )
  );
