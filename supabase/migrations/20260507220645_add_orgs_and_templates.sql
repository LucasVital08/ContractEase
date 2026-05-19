-- Organizations and organization_members tables + related RLS
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner','admin','member','viewer'])),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization" ON public.organizations FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their organization" ON public.organizations FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Members can view their org memberships" ON public.organization_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Org owners can add members" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (true);
