-- Add type column to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'business' CHECK (type = ANY (ARRAY['business','team']));
