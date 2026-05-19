-- Performance: add covering indexes for all unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_contract_clauses_contract_id ON public.contract_clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_logs_contract_id ON public.contract_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_logs_user_id ON public.contract_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_parties_contract_id ON public.contract_parties(contract_id);
CREATE INDEX IF NOT EXISTS idx_favorites_contract_id ON public.favorites(contract_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
