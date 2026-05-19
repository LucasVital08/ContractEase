-- Fix RLS bugs: contract_clauses self-ref, contract_logs, organizations members, org_members INSERT

-- Fix 1: contract_clauses — self-reference data leak
DROP POLICY IF EXISTS "party_can_view_contract_clauses" ON public.contract_clauses;
CREATE POLICY "party_can_view_contract_clauses" ON public.contract_clauses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contract_parties cp WHERE cp.contract_id = contract_clauses.contract_id AND lower(cp.email) = lower(auth.email()))
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_clauses.contract_id AND c.owner_id = auth.uid())
  );

-- Fix 2: contract_logs — broken subquery
DROP POLICY IF EXISTS "Users can view logs of their own contracts" ON public.contract_logs;
CREATE POLICY "Users can view logs of their own contracts" ON public.contract_logs
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR contract_id IN (SELECT id FROM public.contracts WHERE owner_id = auth.uid())
  );

-- Add INSERT policy for contract_logs
DROP POLICY IF EXISTS "Authenticated users can insert contract logs" ON public.contract_logs;
CREATE POLICY "Authenticated users can insert contract logs" ON public.contract_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Fix 3: organizations — members can view their org
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization" ON public.organizations
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid() OR id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

-- Fix 4: organization_members — INSERT with proper permission check
DROP POLICY IF EXISTS "Org owners can add members" ON public.organization_members;
CREATE POLICY "Org owners can add members" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  );
