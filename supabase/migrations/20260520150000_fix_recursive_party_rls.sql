-- Fix infinite recursion on contract_parties RLS policy
-- The previous "party_can_view_contract_parties" policy did
--   EXISTS (SELECT 1 FROM contract_parties self WHERE ...)
-- which re-triggers the same policy on every row check → 42P17 (infinite recursion).
-- The same trap affects party_can_view_contracts and party_can_view_contract_clauses,
-- because both query contract_parties from inside a policy.
--
-- Fix: extract the "is the caller a party of contract X" check into a SECURITY
-- DEFINER function. Calling a SECURITY DEFINER function from inside a policy
-- bypasses RLS on the inner read, breaking the recursion cycle.

CREATE OR REPLACE FUNCTION public.is_party_of_contract(p_contract_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contract_parties cp
    WHERE cp.contract_id = p_contract_id
      AND lower(cp.email) = lower(coalesce(auth.email(), ''))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_party_of_contract(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_party_of_contract(uuid) TO authenticated;

-- Rebuild contract_parties SELECT policy without the self-reference.
DROP POLICY IF EXISTS "party_can_view_contract_parties" ON public.contract_parties;
CREATE POLICY "party_can_view_contract_parties" ON public.contract_parties
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_parties.contract_id
        AND c.owner_id = auth.uid()
    )
    OR public.is_party_of_contract(contract_parties.contract_id)
  );

-- Rebuild contracts SELECT policy to use the same helper, so policy evaluation
-- never goes through the (potentially RLS-restricted) contract_parties table.
DROP POLICY IF EXISTS "party_can_view_contracts" ON public.contracts;
CREATE POLICY "party_can_view_contracts" ON public.contracts
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid()
    OR public.is_party_of_contract(id)
  );

-- Rebuild contract_clauses SELECT policy for the same reason.
DROP POLICY IF EXISTS "party_can_view_contract_clauses" ON public.contract_clauses;
CREATE POLICY "party_can_view_contract_clauses" ON public.contract_clauses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_clauses.contract_id
        AND c.owner_id = auth.uid()
    )
    OR public.is_party_of_contract(contract_clauses.contract_id)
  );
