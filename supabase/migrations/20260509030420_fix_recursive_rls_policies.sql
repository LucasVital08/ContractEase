-- Fix recursive RLS: contract_parties self-access, parties_self_access
CREATE POLICY IF NOT EXISTS "parties_self_access" ON public.contract_parties
  FOR SELECT TO authenticated USING (lower(email) = lower(auth.email()));

CREATE POLICY IF NOT EXISTS "parties_owner_access" ON public.contract_parties
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM contracts c WHERE c.id = contract_parties.contract_id AND c.owner_id = auth.uid()));
