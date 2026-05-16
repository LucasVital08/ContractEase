-- Add logo_url to organizations (already in schema) and fix insert policy
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;

-- Fix insert policy to require owner_id match
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
