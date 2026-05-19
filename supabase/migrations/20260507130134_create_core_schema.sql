-- Core schema: profiles, contracts, contract_parties, contract_clauses, contract_logs, notifications, payments
-- Plus: handle_new_user trigger, update_updated_at_column trigger, rls_auto_enable event trigger

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text DEFAULT 'user' CHECK (role = ANY (ARRAY['user','admin','owner'])),
  avatar_url text,
  plan text DEFAULT 'free',
  credits integer DEFAULT 0,
  wallet_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  cnpj text,
  logo_url text,
  type text DEFAULT 'business' CHECK (type = ANY (ARRAY['business','team'])),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL,
  status text DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','review','pending','active','completed','cancelled','failed','archived'])),
  value numeric,
  currency text DEFAULT 'BRL',
  stellar_tx_hash text,
  stellar_tx_id text,
  tags text[] DEFAULT '{}',
  signature_order text DEFAULT 'parallel' CHECK (signature_order = ANY (ARRAY['parallel','sequential'])),
  multisig_enabled boolean DEFAULT false,
  contract_hash text,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['creator','counterparty','witness'])),
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','signed','rejected'])),
  signed_at timestamptz,
  cpf text,
  ip_address text,
  user_agent text,
  geolocation text,
  signature_type text CHECK (signature_type = ANY (ARRAY['draw','type','upload','a1','freighter'])),
  signature_image text,
  lgpd_consent boolean DEFAULT false,
  public_key text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  order_index integer DEFAULT 0,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  abacate_checkout_id text UNIQUE,
  amount numeric NOT NULL,
  status text NOT NULL,
  method text,
  credits_added integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text,
  icon text,
  content text,
  variables jsonb DEFAULT '[]',
  clauses jsonb DEFAULT '[]',
  author text,
  usage_count integer DEFAULT 0,
  rating numeric DEFAULT 0,
  version text DEFAULT '1.0.0',
  is_featured boolean DEFAULT false,
  tags text[],
  language text DEFAULT 'pt-BR',
  created_at timestamptz DEFAULT now()
);

-- ─── Functions ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    END IF;
  END LOOP;
END; $$;

-- ─── Triggers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_clauses_updated_at
  BEFORE UPDATE ON public.contract_clauses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE EVENT TRIGGER rls_auto_enable_trigger ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "contracts_owner_access" ON public.contracts FOR ALL TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner manages parties" ON public.contract_parties FOR ALL USING (EXISTS (SELECT 1 FROM contracts c WHERE c.id = contract_parties.contract_id AND c.owner_id = auth.uid()));
CREATE POLICY "Owner manages clauses" ON public.contract_clauses FOR ALL USING (EXISTS (SELECT 1 FROM contracts c WHERE c.id = contract_clauses.contract_id AND c.owner_id = auth.uid()));
CREATE POLICY "Users can only see their own notifications" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can see their own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Everyone can view templates" ON public.templates FOR SELECT USING (true);
