// ───────────────────────────────────────────────────────────────────────
// Criação de intenção de pagamento via Stellar (memo + carteira da plataforma)
//
// [CRIT] Antes: sem autenticação e com `userId`, `amount` e `credits` vindos
// do corpo. Um atacante criava um pagamento pendente com credits=1.000.000 e
// amount=0.0000001, mandava a poeira de XLM com o memo e o stellar-checker
// creditava tudo. Também dava para poluir a conta de qualquer usuário.
//
// Agora: JWT obrigatório, `user_id` derivado do token e valores tirados
// exclusivamente da tabela de preços do servidor.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handler, jsonResponse, requireUser, serviceClient, HttpError } from '../_shared/security.ts';
import { resolvePackage } from '../_shared/pricing.ts';

const PLATFORM_WALLET = Deno.env.get('STELLAR_PLATFORM_WALLET') ?? '';

/** Memo alfanumérico de 12 chars com CSPRNG (o antigo usava Math.random). */
function generateMemo(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);

  if (!PLATFORM_WALLET) {
    throw new HttpError(500, 'wallet_not_configured', 'STELLAR_PLATFORM_WALLET não configurada.');
  }

  const { packageId } = await req.json();
  const pkg = resolvePackage(packageId);

  if (!pkg) {
    throw new HttpError(400, 'invalid_package', 'packageId inválido.');
  }

  const supabase = serviceClient();

  // Reaproveita uma intenção pendente do MESMO usuário e pacote, para não
  // encher a tabela a cada refresh da tela de checkout.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, amount, stellar_memo')
    .eq('user_id', user.id)
    .eq('status', 'pending_stellar')
    .eq('credits_added', pkg.credits)
    .eq('method', 'STELLAR')
    .maybeSingle();

  if (existingPayment) {
    return jsonResponse(req, 200, {
      success: true,
      data: {
        memo: existingPayment.stellar_memo,
        walletAddress: PLATFORM_WALLET,
        amount: existingPayment.amount,
        paymentId: existingPayment.id,
        instruction: `Envie ${existingPayment.amount} XLM para ${PLATFORM_WALLET} com o MEMO: ${existingPayment.stellar_memo}`,
      },
    });
  }

  const memo = generateMemo();

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: user.id,          // vem do JWT, nunca do corpo
      amount: pkg.amountXlm,     // preço do servidor
      credits_added: pkg.credits,
      status: 'pending_stellar',
      method: 'STELLAR',
      stellar_memo: memo,
    })
    .select('id')
    .single();

  if (paymentError) {
    throw new HttpError(500, 'payment_create_failed', paymentError.message);
  }

  return jsonResponse(req, 200, {
    success: true,
    data: {
      memo,
      walletAddress: PLATFORM_WALLET,
      amount: pkg.amountXlm,
      paymentId: payment.id,
      instruction: `Envie ${pkg.amountXlm} XLM para ${PLATFORM_WALLET} com o MEMO: ${memo}`,
    },
  });
}));
