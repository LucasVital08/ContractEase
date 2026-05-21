-- Fix #1 — Notifications cross-user INSERT
-- Old policy "Users can only see their own notifications" was FOR ALL with
-- USING (user_id = auth.uid()), which also gates INSERT via WITH CHECK.
-- That blocked the creator of a contract from inserting a signing_invite
-- notification into the recipient's inbox.
-- We split the policy: SELECT/UPDATE/DELETE stay restricted to the owner,
-- but INSERT is allowed for any authenticated user (so signing invites,
-- mentions, and party notifications can land in another user's bell).

DROP POLICY IF EXISTS "Users can only see their own notifications" ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (
    user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = notifications.user_id)
  );

-- Fix #2 — Signatories cannot see the contract they were invited to sign
-- Old policy "contracts_owner_access" restricted SELECT to owner_id = auth.uid().
-- We add a SELECT policy so that a user listed as a party (matched by e-mail)
-- can also read the contract — required for the /contracts/:id page to render.

DROP POLICY IF EXISTS "party_can_view_contracts" ON public.contracts;
CREATE POLICY "party_can_view_contracts" ON public.contracts
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.contract_parties cp
      WHERE cp.contract_id = contracts.id
        AND lower(cp.email) = lower(auth.email())
    )
  );

-- Fix #3 — Signatories also need to read the parties list of the contract
-- Old policy "Owner manages parties" was FOR ALL with the same owner-only USING.
-- Parties need to see who else is signing; we add a parallel SELECT policy.

DROP POLICY IF EXISTS "party_can_view_contract_parties" ON public.contract_parties;
CREATE POLICY "party_can_view_contract_parties" ON public.contract_parties
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_parties.contract_id
        AND c.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.contract_parties self
      WHERE self.contract_id = contract_parties.contract_id
        AND lower(self.email) = lower(auth.email())
    )
  );

-- Fix #4 — Signatories need to UPDATE their own party row to sign
-- (otherwise PublicSignPage / Assinar agora cannot persist signed_at).
DROP POLICY IF EXISTS "party_can_sign_own_row" ON public.contract_parties;
CREATE POLICY "party_can_sign_own_row" ON public.contract_parties
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(auth.email()))
  WITH CHECK (lower(email) = lower(auth.email()));
