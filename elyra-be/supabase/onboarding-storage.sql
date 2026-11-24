-- Run in the Supabase SQL editor. Keep this bucket name in sync with SUPABASE_BUCKET.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'elyra-onboarding', 'elyra-onboarding', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Broad policies for other buckets must not expose onboarding photos or selfies.
-- Elyra's backend authorizes each object operation against the Clerk account.
DROP POLICY IF EXISTS "onboarding storage is server only" ON storage.objects;
CREATE POLICY "onboarding storage is server only" ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'elyra-onboarding')
  WITH CHECK (bucket_id <> 'elyra-onboarding');
