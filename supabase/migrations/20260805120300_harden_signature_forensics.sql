-- ═══════════════════════════════════════════════════════════════════════
-- [CE-09] Metadados forenses da assinatura deixam de ser ditados pelo cliente
--
-- PublicSignPage.tsx gravava, via UPDATE direto do browser:
--   ip_address:  buscado em api.ipify.org PELO PRÓPRIO NAVEGADOR
--   geolocation: navigator.geolocation
--   user_agent:  navigator.userAgent
--   cpf, signature_image, lgpd_consent
--
-- Todos forjáveis por quem assina — e `pdfGenerator.ts` despeja esses campos no
-- **certificado de assinatura**. Ou seja, a prova que sustenta o valor jurídico
-- do documento era escrita por quem tinha interesse em manipulá-la.
--
-- A correção anterior (20260805120000) congelou identidade e `signed_at`, mas
-- deixou passar justamente as colunas forenses. Esta migration fecha isso:
--   - `ip_address` e `user_agent` passam a ser derivados dos headers da
--     requisição, no servidor;
--   - `geolocation` e `cpf` viram imutáveis depois de gravados;
--   - todo o bloco de assinatura vira imutável depois que `signed_at` existe.
--
-- Isto é mitigação, não a solução completa: enquanto o UPDATE partir do
-- cliente, não há verificação de identidade de fato (ver HIGH-07 em
-- SECURITY_AUDIT.md — a assinatura precisa migrar para uma Edge Function que
-- valide o OTP no servidor).
-- ═══════════════════════════════════════════════════════════════════════

/**
 * Extrai o IP de origem dos headers que o PostgREST expõe na sessão.
 * `x-forwarded-for` pode vir como "cliente, proxy1, proxy2" — o primeiro
 * elemento é o cliente.
 */
CREATE OR REPLACE FUNCTION public.request_client_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headers json;
  v_fwd     text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF v_headers IS NULL THEN
    RETURN NULL;
  END IF;

  v_fwd := coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip');
  IF v_fwd IS NULL OR btrim(v_fwd) = '' THEN
    RETURN NULL;
  END IF;

  RETURN btrim(split_part(v_fwd, ',', 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.request_user_agent()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headers json;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN left(coalesce(v_headers ->> 'user-agent', ''), 500);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- Trigger de assinatura — versão estendida
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_contract_party_signature_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_owner boolean;
  v_signing  boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = NEW.contract_id AND c.owner_id = auth.uid()
  ) INTO v_is_owner;

  -- Identidade e vínculo continuam congelados para o signatário; o dono do
  -- contrato segue podendo editar a lista de partes.
  IF NOT v_is_owner THEN
    NEW.id          := OLD.id;
    NEW.contract_id := OLD.contract_id;
    NEW.email       := OLD.email;
    NEW.name        := OLD.name;
    NEW.role        := OLD.role;
  END IF;

  -- ── Assinatura já registrada é imutável, inclusive para o dono ──────
  -- Sem isto, o dono do contrato poderia reescrever a prova depois do ato,
  -- que é tão ruim quanto o signatário poder fazê-lo.
  IF OLD.signed_at IS NOT NULL THEN
    NEW.signed_at       := OLD.signed_at;
    NEW.signature_type  := OLD.signature_type;
    NEW.signature_image := OLD.signature_image;
    NEW.ip_address      := OLD.ip_address;
    NEW.user_agent      := OLD.user_agent;
    NEW.geolocation     := OLD.geolocation;
    NEW.cpf             := OLD.cpf;
    NEW.lgpd_consent    := OLD.lgpd_consent;
    RETURN NEW;
  END IF;

  -- ── Ato de assinatura (primeira vez) ────────────────────────────────
  v_signing := NEW.signed_at IS DISTINCT FROM OLD.signed_at;

  IF v_signing THEN
    -- Carimbo do servidor: nada de retrodatar.
    NEW.signed_at := now();

    -- IP e user-agent derivados da requisição. O valor que o cliente mandou é
    -- descartado — era ele que vinha do api.ipify.org do próprio navegador.
    NEW.ip_address := coalesce(public.request_client_ip(), 'unknown');
    NEW.user_agent := coalesce(public.request_user_agent(), 'unknown');

    -- `geolocation` só existe no navegador: não há como validá-la no servidor.
    -- Fica gravada como DECLARADA, com prefixo explícito, para que o
    -- certificado não a apresente como fato verificado.
    IF NEW.geolocation IS NOT NULL AND btrim(NEW.geolocation) <> '' THEN
      NEW.geolocation := 'declarado:' || left(NEW.geolocation, 200);
    END IF;
  ELSE
    -- Fora do ato de assinar, ninguém mexe nas colunas forenses.
    NEW.ip_address  := OLD.ip_address;
    NEW.user_agent  := OLD.user_agent;
    NEW.geolocation := OLD.geolocation;
    NEW.signed_at   := OLD.signed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_contract_party_signature ON public.contract_parties;
CREATE TRIGGER trg_guard_contract_party_signature
  BEFORE UPDATE ON public.contract_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_contract_party_signature_columns();

REVOKE EXECUTE ON FUNCTION public.request_client_ip() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_user_agent() FROM PUBLIC, anon;
