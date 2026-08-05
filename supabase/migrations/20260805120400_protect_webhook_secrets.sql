-- ═══════════════════════════════════════════════════════════════════════
-- [CE-14] Segredo de webhook deixa de ficar em texto puro e legível pela API
--
-- `webhooks.secret` guardava o segredo de assinatura HMAC em texto puro, numa
-- tabela com policy `FOR ALL ... USING (user_id = auth.uid())`. Como o frontend
-- faz `select('*')`, o segredo trafegava de volta para o browser a cada
-- listagem — e ficava legível em qualquer dump/backup do banco.
--
-- Duas mudanças:
--   1. O segredo sai da tabela `webhooks` e passa para `webhook_secrets`, que
--      tem RLS habilitado e NENHUMA policy: por padrão o RLS nega tudo, então
--      `authenticated` não alcança a tabela de forma alguma. Só o `service_role`
--      (que ignora RLS) enxerga — que é exatamente quem precisa, o worker de
--      entrega.
--   2. É gravado cifrado (pgcrypto/AES via pgp_sym_encrypt), com chave vinda de
--      configuração do servidor, nunca do banco de dados em si.
--
-- Sobre o alcance real: a cifragem protege contra vazamento de dump/backup e
-- contra acesso somente-leitura ao SQL. Ela NÃO protege contra
-- comprometimento total do servidor, onde a chave também seria obtida. O ganho
-- principal aqui é o item 1 — tirar o segredo de qualquer caminho alcançável
-- pelo cliente.
--
-- CONFIGURAÇÃO NECESSÁRIA antes de aplicar (uma vez, no projeto):
--   ALTER DATABASE postgres SET app.webhook_secret_key = '<chave-aleatoria-forte>';
-- Guarde essa chave junto dos demais segredos de infraestrutura.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ───────────────────────────────────────────────────────────────────────
-- Tabela isolada
-- ───────────────────────────────────────────────────────────────────────

-- Sem FK para `webhooks`: a gravação acontece num trigger BEFORE INSERT, quando
-- a linha de `webhooks` ainda não existe. A limpeza é feita pelo trigger de
-- DELETE mais abaixo.
CREATE TABLE IF NOT EXISTS public.webhook_secrets (
  webhook_id       uuid PRIMARY KEY,
  secret_encrypted bytea NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_secrets ENABLE ROW LEVEL SECURITY;
-- Intencionalmente sem policies: RLS sem policy nega tudo para anon/authenticated.
REVOKE ALL ON public.webhook_secrets FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- Chave de cifragem
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.webhook_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.webhook_secret_key', true);

  IF v_key IS NULL OR length(v_key) < 16 THEN
    -- Falha fechada: é preferível recusar a criação do webhook a gravar o
    -- segredo em claro sem ninguém perceber.
    RAISE EXCEPTION 'webhook_encryption_key_not_configured'
      USING HINT = 'Defina: ALTER DATABASE postgres SET app.webhook_secret_key = ''<chave forte>'';';
  END IF;

  RETURN v_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.webhook_encryption_key() FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- Trigger: intercepta o segredo antes de ele ser gravado em `webhooks`
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capture_webhook_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  -- Só age quando veio segredo novo em claro.
  IF NEW.secret IS NULL OR btrim(NEW.secret) = '' THEN
    -- Em UPDATE sem novo segredo, preserva o que já existe (a coluna fica NULL
    -- na tabela, então não há o que restaurar — apenas não apaga o cifrado).
    RETURN NEW;
  END IF;

  INSERT INTO public.webhook_secrets (webhook_id, secret_encrypted, updated_at)
  VALUES (
    NEW.id,
    extensions.pgp_sym_encrypt(NEW.secret, public.webhook_encryption_key()),
    now()
  )
  ON CONFLICT (webhook_id) DO UPDATE
    SET secret_encrypted = EXCLUDED.secret_encrypted,
        updated_at = now();

  -- Por ser um trigger BEFORE, o texto puro nunca chega a ser gravado na
  -- tupla — não fica em disco nem no WAL.
  NEW.secret := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_webhook_secret ON public.webhooks;
CREATE TRIGGER trg_capture_webhook_secret
  BEFORE INSERT OR UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_webhook_secret();

-- Limpeza: sem FK, a remoção precisa ser explícita.
CREATE OR REPLACE FUNCTION public.cleanup_webhook_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.webhook_secrets WHERE webhook_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_webhook_secret ON public.webhooks;
CREATE TRIGGER trg_cleanup_webhook_secret
  AFTER DELETE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_webhook_secret();

-- ───────────────────────────────────────────────────────────────────────
-- Leitura pelo worker de entrega (apenas service_role)
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_webhook_secret(p_webhook_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_cipher bytea;
BEGIN
  SELECT secret_encrypted INTO v_cipher
  FROM public.webhook_secrets
  WHERE webhook_id = p_webhook_id;

  IF v_cipher IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN extensions.pgp_sym_decrypt(v_cipher, public.webhook_encryption_key());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_webhook_secret(uuid) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────
-- Migração dos segredos já existentes
-- ───────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_pending int;
BEGIN
  SELECT count(*) INTO v_pending
  FROM public.webhooks
  WHERE secret IS NOT NULL AND btrim(secret) <> '';

  IF v_pending = 0 THEN
    RAISE NOTICE 'Nenhum segredo de webhook em texto puro para migrar.';
    RETURN;
  END IF;

  -- Se houver segredos para migrar e a chave não estiver configurada, aborta a
  -- migration inteira: seguir em frente significaria ou perder os segredos
  -- (apagando-os) ou mantê-los em claro. Configure a chave e rode de novo.
  PERFORM public.webhook_encryption_key();

  INSERT INTO public.webhook_secrets (webhook_id, secret_encrypted, updated_at)
  SELECT id,
         extensions.pgp_sym_encrypt(secret, public.webhook_encryption_key()),
         now()
  FROM public.webhooks
  WHERE secret IS NOT NULL AND btrim(secret) <> ''
  ON CONFLICT (webhook_id) DO NOTHING;

  UPDATE public.webhooks SET secret = NULL
  WHERE secret IS NOT NULL AND btrim(secret) <> '';

  RAISE NOTICE 'Migrados % segredos de webhook para armazenamento cifrado.', v_pending;
END $$;

COMMENT ON COLUMN public.webhooks.secret IS
  'Somente escrita. Um trigger move o valor para public.webhook_secrets (cifrado) '
  'e zera esta coluna. Leituras sempre retornam NULL — use get_webhook_secret() '
  'a partir do service_role.';
