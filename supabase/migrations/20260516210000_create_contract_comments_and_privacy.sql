-- Contract comments
CREATE TABLE IF NOT EXISTS public.contract_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.contract_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contract participants can manage comments" ON public.contract_comments
  FOR ALL TO authenticated USING (
    user_id = auth.uid()
    OR contract_id IN (SELECT id FROM public.contracts WHERE owner_id = auth.uid())
    OR contract_id IN (SELECT contract_id FROM public.contract_parties WHERE lower(email) = lower(auth.email()))
  ) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_contract_comments_contract_id ON public.contract_comments(contract_id);
CREATE OR REPLACE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.contract_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Privacy on contracts (private | organization | public)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS privacy text DEFAULT 'private'
  CHECK (privacy = ANY (ARRAY['private', 'organization', 'public']));

-- Workspace role permissions stored in organizations.member_permissions JSONB
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS member_permissions jsonb DEFAULT '{
  "member": {"can_create": true, "can_sign": true, "can_view_all": false, "can_delete": false},
  "viewer": {"can_create": false, "can_sign": true, "can_view_all": false, "can_delete": false}
}'::jsonb;
