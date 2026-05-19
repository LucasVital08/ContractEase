-- Fix storage: remove broad avatars listing, add contracts/attachments RLS
DROP POLICY IF EXISTS "Public Read Access 1oj01fe_0" ON storage.objects;

CREATE POLICY "Authenticated users can read avatars" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Owners can upload to contracts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can read contracts" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can delete contracts" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can upload attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can read attachments" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
