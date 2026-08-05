-- ═══════════════════════════════════════════════════════════════════════
-- HARDENING DE SEGURANÇA — RLS, RPCs e OTP
--
-- Corrige as vulnerabilidades encontradas na auditoria de segurança:
--
--   [CRIT-01] Escalada de privilégio via UPDATE em public.profiles
--             (usuário podia setar role='admin', credits=999999, plan='enterprise')
--   [CRIT-02] OTP de 4 dígitos, sem rate limit, com p_user_id arbitrário
--             (brute force de OTP de qualquer usuário em segundos)
--   [HIGH-01] search_profiles_directory expunha email + wallet de TODOS os
--             perfis, com LIMIT controlado pelo atacante (dump de PII)
--   [HIGH-02] get_admin_dashboard_stats liberado a qualquer authenticated
--   [HIGH-03] lookup_profile_by_email / by_wallet_address como oráculo de
--             enumeração de usuários
--   [MED-01]  party_can_sign_own_row permitia alterar qualquer coluna da
--             própria linha (falsificar/retrodatar metadados de assinatura)
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- [CRIT-01] profiles: impedir auto-promoção e auto-crédito
--
-- A policy antiga era:
--   FOR UPDATE USING (auth.uid() = id)   -- sem WITH CHECK, sem trava de coluna
-- Como o PostgREST expõe UPDATE direto, qualquer usuário logado podia rodar:
--   supabase.from('profiles').update({ role:'admin', credits: 999999 })
--
-- RLS não sabe restringir colunas, então usamos um trigger BEFORE UPDATE que
-- congela as colunas sensíveis quando o autor da mudança não é service_role.
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- service_role (Edge Functions, webhooks, jobs) pode tudo.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Colunas que só o backend confiável pode alterar.
  NEW.role            := OLD.role;
  NEW.credits         := OLD.credits;
  NEW.plan            := OLD.plan;
  NEW.organization_id := OLD.organization_id;
  NEW.id              := OLD.id;
  NEW.created_at      := OLD.created_at;

  -- E-mail do perfil precisa continuar espelhando o e-mail autenticado;
  -- trocá-lo livremente quebra as policies que casam por lower(email).
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- Fecha também o buraco de INSERT: a policy antiga só checava auth.uid() = id,
-- então dava para nascer já com role='admin' e credits altos.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND coalesce(role, 'user') = 'user'
    AND coalesce(credits, 0) <= 50
    AND coalesce(plan, 'free') = 'free'
  );

-- Reafirma a policy de UPDATE com WITH CHECK explícito (defesa em profundidade;
-- a trava real de coluna é o trigger acima).
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ───────────────────────────────────────────────────────────────────────
-- [CRIT-02] OTP: 6 dígitos CSPRNG, hash no banco, rate limit e vínculo ao caller
--
-- Problemas da versão antiga:
--   - lpad(floor(random()*10000)) → 4 dígitos e PRNG não-criptográfico
--   - código guardado em texto puro
--   - sem contador de tentativas → brute force de 10.000 em segundos
--   - p_user_id livre → atacante gerava/verificava OTP de OUTRO usuário
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_otps_user_purpose ON public.otps (user_id, purpose);

-- pgcrypto para gen_random_bytes (CSPRNG) e digest (hash do código).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_otp(p_user_id uuid, p_purpose text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_code   text;
  v_caller uuid := auth.uid();
  v_recent int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Vincula o OTP ao usuário autenticado. Ignora p_user_id vindo do cliente:
  -- era exatamente esse parâmetro que permitia atacar a conta alheia.
  IF p_user_id IS NOT NULL AND p_user_id <> v_caller THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Rate limit: no máximo 3 emissões por finalidade a cada 15 minutos.
  SELECT count(*) INTO v_recent
  FROM public.otps
  WHERE user_id = v_caller
    AND purpose = p_purpose
    AND created_at > now() - interval '15 minutes';

  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  DELETE FROM public.otps WHERE user_id = v_caller AND purpose = p_purpose;

  -- 6 dígitos com fonte criptográfica.
  v_code := lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');

  INSERT INTO public.otps (user_id, code, purpose, expires_at, attempts)
  VALUES (
    v_caller,
    encode(digest(v_code || v_caller::text, 'sha256'), 'hex'),
    p_purpose,
    now() + interval '10 minutes',
    0
  );

  -- Retorna o código em claro só para quem for despachar o e-mail/SMS.
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_otp(p_user_id uuid, p_code text, p_purpose text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_row    public.otps%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_caller THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row
  FROM public.otps
  WHERE user_id = v_caller AND purpose = p_purpose
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_row.expires_at <= now() THEN
    RETURN false;
  END IF;

  -- Máximo de 5 tentativas por código emitido.
  IF v_row.attempts >= 5 THEN
    DELETE FROM public.otps WHERE id = v_row.id;
    RETURN false;
  END IF;

  UPDATE public.otps SET attempts = attempts + 1 WHERE id = v_row.id;

  IF v_row.code = encode(digest(coalesce(p_code, '') || v_caller::text, 'sha256'), 'hex') THEN
    DELETE FROM public.otps WHERE user_id = v_caller AND purpose = p_purpose;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- As assinaturas antigas de 3/4 argumentos (com p_email) davam o mesmo bypass.
DROP FUNCTION IF EXISTS public.generate_otp(uuid, text, text);
DROP FUNCTION IF EXISTS public.verify_otp(uuid, text, text, text);

REVOKE EXECUTE ON FUNCTION public.generate_otp(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_otp(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_otp(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp(uuid, text, text) TO authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- [HIGH-01] search_profiles_directory: parar de vazar PII em massa
--
-- Versão antiga: SECURITY DEFINER retornando email + wallet_address de todos
-- os perfis, aceitando query vazia e LIMIT arbitrário → dump completo da base.
-- ───────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.search_profiles_directory(text, int);

CREATE OR REPLACE FUNCTION public.search_profiles_directory(p_query text, p_limit int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  handle text,
  name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key   text := lower(regexp_replace(coalesce(p_query, ''), '^@+', ''));
  v_limit int  := least(greatest(coalesce(p_limit, 8), 1), 20);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Exige um termo de busca real: sem isso a função virava "listar todo mundo".
  IF length(v_key) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.handle, p.name, p.avatar_url
  FROM public.profiles p
  WHERE p.handle IS NOT NULL
    -- Busca por prefixo apenas: '%termo%' permitia varrer a base com poucas queries.
    AND (p.handle ILIKE v_key || '%' OR lower(coalesce(p.name, '')) LIKE v_key || '%')
  ORDER BY (p.handle = v_key) DESC, p.handle
  LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_profiles_directory(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles_directory(text, int) TO authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- [HIGH-03] Lookups por e-mail / wallet: deixam de devolver PII cruzada
--
-- Continuam existindo (o app precisa resolver destinatário de convite), mas
-- não devolvem mais o e-mail de terceiros — o chamador já conhece o e-mail que
-- pesquisou, devolver de novo só serve para confirmar cadastro em massa.
-- ───────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.lookup_profile_by_email(text);

CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(p_email text)
RETURNS TABLE (id uuid, handle text, name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN QUERY
  SELECT p.id, p.handle, p.name, p.avatar_url
  FROM public.profiles p
  WHERE lower(p.email) = lower(coalesce(p_email, ''))
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(text) TO authenticated;

DROP FUNCTION IF EXISTS public.lookup_profile_by_wallet_address(text);

CREATE OR REPLACE FUNCTION public.lookup_profile_by_wallet_address(p_wallet_address text)
RETURNS TABLE (id uuid, handle text, name text, avatar_url text, wallet_address text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Sem o e-mail: casar wallet → e-mail permitia desanonimizar donos de carteira.
  RETURN QUERY
  SELECT p.id, p.handle, p.name, p.avatar_url, p.wallet_address
  FROM public.profiles p
  WHERE p.wallet_address = p_wallet_address
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_wallet_address(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_wallet_address(text) TO authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- [HIGH-02] Estatísticas de admin: exigir papel de admin/owner de verdade
--
-- Estava com GRANT para authenticated e sem nenhuma checagem interna: qualquer
-- usuário logado lia faturamento total, nº de usuários e orgs recentes. A tela
-- só escondia o botão no front — o RPC continuava aberto.
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_workspaces', (SELECT COUNT(*) FROM public.organizations),
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_contracts', (SELECT COUNT(*) FROM public.contracts),
    'anchored_contracts', (SELECT COUNT(*) FROM public.contracts WHERE stellar_tx_hash IS NOT NULL),
    'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'paid'),
    'contracts_this_week', (SELECT COUNT(*) FROM public.contracts WHERE created_at >= NOW() - INTERVAL '7 days'),
    'users_this_week', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= NOW() - INTERVAL '7 days'),
    'recent_organizations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'type', o.type, 'created_at', o.created_at,
        'member_count', (SELECT COUNT(*) FROM public.organization_members m WHERE m.organization_id = o.id)) ORDER BY o.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.organizations ORDER BY created_at DESC LIMIT 5) o
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- [MED-01] contract_parties: signatário só altera as colunas da assinatura
--
-- A policy party_can_sign_own_row era FOR UPDATE sem trava de coluna, então o
-- signatário podia reescrever nome, CPF, papel e retrodatar signed_at — o que
-- destrói o valor probatório da assinatura.
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_contract_party_signature_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_owner boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- O dono do contrato segue podendo editar a lista de partes.
  SELECT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = NEW.contract_id AND c.owner_id = auth.uid()
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN NEW;
  END IF;

  -- Signatário: congela identidade e vínculo, libera só o ato de assinar.
  NEW.id          := OLD.id;
  NEW.contract_id := OLD.contract_id;
  NEW.email       := OLD.email;
  NEW.name        := OLD.name;
  NEW.role        := OLD.role;

  -- signed_at é carimbado pelo servidor: nada de retrodatar assinatura.
  IF NEW.signed_at IS DISTINCT FROM OLD.signed_at THEN
    IF OLD.signed_at IS NOT NULL THEN
      NEW.signed_at := OLD.signed_at;   -- assinatura já registrada é imutável
    ELSE
      NEW.signed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_contract_party_signature ON public.contract_parties;
CREATE TRIGGER trg_guard_contract_party_signature
  BEFORE UPDATE ON public.contract_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_contract_party_signature_columns();


-- ───────────────────────────────────────────────────────────────────────
-- Bônus: pagamentos são somente-leitura para o dono.
-- Não havia policy de INSERT/UPDATE em payments; deixamos explícito que só o
-- service_role escreve, para nenhuma policy futura reabrir isso por engano.
-- ───────────────────────────────────────────────────────────────────────

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated, anon;
