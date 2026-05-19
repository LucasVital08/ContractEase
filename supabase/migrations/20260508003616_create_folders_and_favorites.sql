-- Folders and favorites tables
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, contract_id)
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE POLICY "Users can manage their own folders" ON public.folders FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Folders are viewable by organization members" ON public.folders FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Enable access for owners and organization members (folders)" ON public.folders FOR ALL TO authenticated USING (auth.uid() = owner_id OR (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM organization_members WHERE organization_members.organization_id = folders.organization_id AND organization_members.user_id = auth.uid()))) WITH CHECK (auth.uid() = owner_id OR (organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM organization_members WHERE organization_members.organization_id = folders.organization_id AND organization_members.user_id = auth.uid())));
CREATE POLICY "Users can manage their own favorites" ON public.favorites FOR ALL USING (user_id = auth.uid());
