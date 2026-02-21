
-- Ensure avatars bucket is public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- Allow authenticated users to SELECT avatars
CREATE POLICY "Allow authenticated users to SELECT avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Allow authenticated users to INSERT avatars
CREATE POLICY "Allow authenticated users to INSERT avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to UPDATE avatars
CREATE POLICY "Allow authenticated users to UPDATE avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');
