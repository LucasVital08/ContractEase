-- ═══════════════════════════════════════════════════════════════════════
-- Crédito atômico
--
-- O webhook de pagamento fazia read-modify-write:
--   SELECT credits → newCredits = credits + N → UPDATE credits = newCredits
-- Entre o SELECT e o UPDATE cabe outra requisição. Dois webhooks simultâneos
-- (o provedor reenvia até receber 2xx) liam o mesmo valor e um sobrescrevia o
-- outro — o usuário pagava dois pacotes e recebia um. Na direção oposta, o
-- mesmo padrão em um endpoint de consumo permitiria gastar crédito duas vezes.
--
-- UPDATE ... SET credits = credits + N resolve no próprio banco, sob o lock da
-- linha, sem janela de corrida.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_user_credits(p_user_id uuid, p_credits integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_total integer;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'invalid_credit_amount';
  END IF;

  UPDATE public.profiles
  SET credits = COALESCE(credits, 0) + p_credits,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING credits INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN v_new_total;
END;
$$;

-- Só o service_role (Edge Functions) credita. Se `authenticated` pudesse
-- chamar, o cliente se creditaria sozinho — que é justamente o furo que o
-- hardening do webhook fecha.
REVOKE EXECUTE ON FUNCTION public.increment_user_credits(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Débito de créditos com trava: impede saldo negativo mesmo sob concorrência.
CREATE OR REPLACE FUNCTION public.consume_user_credits(p_user_id uuid, p_credits integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_total integer;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'invalid_credit_amount';
  END IF;

  UPDATE public.profiles
  SET credits = credits - p_credits,
      updated_at = now()
  WHERE id = p_user_id
    AND COALESCE(credits, 0) >= p_credits
  RETURNING credits INTO v_new_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  RETURN v_new_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_user_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
