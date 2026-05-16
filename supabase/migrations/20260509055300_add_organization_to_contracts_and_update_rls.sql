-- Add organization_id to contracts + org-scoped access policy
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE POLICY IF NOT EXISTS "contracts_org_access" ON public.contracts
  FOR ALL TO authenticated USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

-- Add organization_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
