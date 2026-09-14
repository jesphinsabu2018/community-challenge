/*
# Create submissions storage bucket

1. Storage
- Create a public bucket named "submissions" for challenge proof uploads (photos, videos, files)
- Allow authenticated users to upload to their own folder
- Allow public read access for viewing submissions
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submissions');

-- Allow public read
DROP POLICY IF EXISTS "Allow public read submissions" ON storage.objects;
CREATE POLICY "Allow public read submissions" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'submissions');

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Allow users delete own submissions" ON storage.objects;
CREATE POLICY "Allow users delete own submissions" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'submissions' AND owner = auth.uid());
