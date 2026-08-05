// ───────────────────────────────────────────────────────────────────────
// Webhook AbacatePay
//
// [CRIT] Antes: o endpoint aceitava qualquer POST anônimo e confiava no corpo
// da requisição. Bastava enviar
//   { "event": "billing.paid", "data": { "metadata": { "userId": "<uuid>",
//     "credits": 999999 } } }
// para creditar a conta ou trocar o plano de qualquer usuário — sem pagar nada.
//
// Agora exigimos:
//   1. Assinatura HMAC válida do provedor (ABACATEPAY_WEBHOOK_SECRET);
//   2. Idempotência por checkout_id (impede replay do mesmo evento);
//   3. Crédito somado de forma atômica no banco (sem read-modify-write);
//   4. Valor de créditos derivado do PAGAMENTO, não do metadata do cliente.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serviceClient, timingSafeEqual } from '../_shared/security.ts';

const WEBHOOK_SECRET = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET') ?? '';

/** Calcula o HMAC-SHA256 hexadecimal do corpo cru. */
async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // Webhook é server-to-server: sem CORS, sem preflight, só POST.
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  if (!WEBHOOK_SECRET) {
    console.error('[abacatepay-webhook] ABACATEPAY_WEBHOOK_SECRET não configurado — recusando.');
    return json(500, { error: 'webhook_secret_not_configured' });
  }

  // Precisamos do corpo CRU para conferir a assinatura: reserializar com
  // JSON.stringify mudaria os bytes e invalidaria o HMAC.
  const rawBody = await req.text();

  const provided = (
    req.headers.get('x-abacate-signature') ??
    req.headers.get('x-webhook-signature') ??
    ''
  ).replace(/^sha256=/i, '').trim();

  if (!provided) {
    return json(401, { error: 'missing_signature' });
  }

  const expected = await hmacHex(WEBHOOK_SECRET, rawBody);
  if (!timingSafeEqual(provided.toLowerCase(), expected)) {
    console.warn('[abacatepay-webhook] assinatura inválida — evento descartado.');
    return json(401, { error: 'invalid_signature' });
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const event = payload.event ?? '';
  const data = (payload.data ?? {}) as Record<string, any>;
  const checkoutId: string | undefined = data.id;

  if (!checkoutId) {
    return json(400, { error: 'missing_checkout_id' });
  }

  const supabase = serviceClient();

  // ── Idempotência ────────────────────────────────────────────────────
  // O provedor reenvia webhooks até receber 2xx. Sem esta trava, cada reenvio
  // (ou replay capturado) creditava o usuário de novo.
  const { data: alreadyProcessed } = await supabase
    .from('payments')
    .select('id')
    .eq('abacate_checkout_id', checkoutId)
    .eq('status', 'completed')
    .maybeSingle();

  if (alreadyProcessed) {
    return json(200, { success: true, deduplicated: true });
  }

  try {
    if (event === 'checkout.completed' || event === 'subscription.completed') {
      const userId = data.metadata?.userId;
      const planId = data.metadata?.planId;

      // Só planos conhecidos: sem isso o metadata definia texto livre no campo plan.
      const VALID_PLANS = ['free', 'pro', 'business', 'enterprise'];
      if (!userId || !planId || !VALID_PLANS.includes(String(planId))) {
        return json(400, { error: 'invalid_plan_payload' });
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          plan: planId,
          abacate_customer_id: data.customerId,
          abacate_subscription_id: checkoutId,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      await supabase.from('payments').insert({
        user_id: userId,
        abacate_checkout_id: checkoutId,
        amount: data.amount,
        status: 'completed',
        method: data.methods?.[0] || 'PIX',
      });

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Assinatura Ativada! 🎉',
        message: `Seu plano ${String(planId).toUpperCase()} já está ativo.`,
        type: 'success',
      });
    }

    if (event === 'billing.completed' || event === 'billing.paid') {
      const userId = data.metadata?.userId;

      if (!userId) {
        return json(400, { error: 'missing_user_id' });
      }

      // Créditos derivados do valor efetivamente pago (centavos → créditos),
      // e não de `metadata.credits`, que é controlado por quem monta a chamada.
      const amountPaid = Number(data.amount ?? 0);
      if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        return json(400, { error: 'invalid_amount' });
      }
      const creditsToAdd = Math.floor(amountPaid / 100);

      if (creditsToAdd <= 0) {
        return json(400, { error: 'amount_below_minimum' });
      }

      // Incremento atômico: o read-modify-write anterior perdia créditos (ou
      // duplicava) quando dois webhooks chegavam juntos.
      const { error: creditError } = await supabase.rpc('increment_user_credits', {
        p_user_id: userId,
        p_credits: creditsToAdd,
      });
      if (creditError) throw creditError;

      await supabase.from('payments').insert({
        user_id: userId,
        abacate_checkout_id: checkoutId,
        amount: amountPaid,
        status: 'completed',
        method: 'PIX',
        credits_added: creditsToAdd,
      });

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Créditos Adicionados! ⚡',
        message: `Você recebeu ${creditsToAdd} novos créditos de ancoragem.`,
        type: 'success',
      });
    }

    return json(200, { success: true });
  } catch (err) {
    // Log detalhado fica no servidor; o provedor recebe só o status.
    console.error('[abacatepay-webhook] falha ao processar evento:', err);
    return json(500, { error: 'processing_failed' });
  }
});
