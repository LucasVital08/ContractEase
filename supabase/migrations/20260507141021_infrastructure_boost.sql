-- Infrastructure: confirm_stellar_payment RPC, cron + net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.confirm_stellar_payment(
  p_payment_id uuid, p_user_id uuid, p_credits integer, p_tx_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.payments SET status = 'completed', stellar_tx_hash = p_tx_hash
  WHERE id = p_payment_id AND status = 'pending_stellar';
  IF FOUND THEN
    UPDATE public.profiles SET credits = COALESCE(credits, 0) + p_credits, updated_at = now() WHERE id = p_user_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (p_user_id, 'Pagamento Stellar Confirmado', 'Sua recarga de ' || p_credits || ' créditos foi processada com sucesso via rede Stellar.', 'success');
  END IF;
END; $$;
