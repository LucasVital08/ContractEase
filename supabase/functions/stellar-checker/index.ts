// ───────────────────────────────────────────────────────────────────────
// Conferência de pagamentos Stellar pendentes
//
// [CRIT] Antes, o casamento era feito SÓ pelo memo:
//   if (txDetail.memo === payment.stellar_memo) → credita
// Não se verificava valor, ativo nem destinatário. Ou seja: bastava enviar
// 0.0000001 XLM com o memo certo para liberar qualquer quantidade de créditos.
// Também era anônimo (qualquer um disparava o processamento) e fazia N+1
// requisições à Horizon.
//
// Agora: exige segredo interno (cron), e um pagamento só é confirmado quando
// destino, ativo e VALOR conferem com o registro pendente.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handler, jsonResponse, requireInternalSecret, serviceClient, HttpError } from '../_shared/security.ts';

const PLATFORM_WALLET = Deno.env.get('STELLAR_PLATFORM_WALLET') ?? '';
const HORIZON_URL = Deno.env.get('STELLAR_NETWORK') === 'testnet'
  ? 'https://horizon-testnet.stellar.org'
  : 'https://horizon.stellar.org';

interface HorizonPayment {
  type: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  transaction_hash?: string;
  transaction_successful?: boolean;
  transaction?: { memo?: string; memo_type?: string; successful?: boolean };
}

Deno.serve(handler(async (req) => {
  // Job interno: não deve ser disparável por visitante anônimo.
  requireInternalSecret(req, 'STELLAR_CHECKER_SECRET');

  if (!PLATFORM_WALLET) {
    throw new HttpError(500, 'wallet_not_configured', 'STELLAR_PLATFORM_WALLET não configurada.');
  }

  const supabase = serviceClient();

  const { data: pendingPayments, error: fetchError } = await supabase
    .from('payments')
    .select('id, user_id, amount, credits_added, stellar_memo')
    .eq('status', 'pending_stellar')
    .eq('method', 'STELLAR');

  if (fetchError) {
    throw new HttpError(500, 'pending_fetch_failed', fetchError.message);
  }
  if (!pendingPayments?.length) {
    return jsonResponse(req, 200, { message: 'Nenhum pagamento pendente para verificar' });
  }

  // `join=transactions` traz o memo junto — elimina o N+1 (uma chamada por
  // transação) que o código anterior fazia dentro de um laço aninhado.
  const stellarRes = await fetch(
    `${HORIZON_URL}/accounts/${PLATFORM_WALLET}/payments?order=desc&limit=200&join=transactions`,
  );
  if (!stellarRes.ok) {
    throw new HttpError(502, 'horizon_unavailable', 'Falha ao consultar a Horizon.');
  }

  const stellarData = await stellarRes.json();
  const records: HorizonPayment[] = stellarData?._embedded?.records ?? [];

  // Indexa por memo para casar em O(1).
  const byMemo = new Map<string, HorizonPayment[]>();
  for (const rec of records) {
    const memo = rec.transaction?.memo;
    if (!memo) continue;
    const list = byMemo.get(memo) ?? [];
    list.push(rec);
    byMemo.set(memo, list);
  }

  const processedMemos: string[] = [];

  for (const payment of pendingPayments) {
    const candidates = byMemo.get(payment.stellar_memo) ?? [];
    const expected = Number(payment.amount);

    const match = candidates.find((rec) => {
      // 1. Precisa ser um pagamento de fato, bem-sucedido.
      if (rec.type !== 'payment') return false;
      if (rec.transaction_successful === false || rec.transaction?.successful === false) return false;

      // 2. Precisa ter chegado NA carteira da plataforma (e não sido só
      //    uma transação qualquer contendo o memo).
      if (rec.to !== PLATFORM_WALLET) return false;

      // 3. Precisa ser XLM nativo — senão bastava criar um token próprio
      //    sem valor e "pagar" com ele.
      if (rec.asset_type !== 'native') return false;

      // 4. E o VALOR precisa cobrir o que foi cobrado. Esta era a checagem
      //    ausente que permitia comprar créditos por poeira.
      const paid = Number(rec.amount ?? '0');
      return Number.isFinite(paid) && Number.isFinite(expected) && paid + 1e-7 >= expected;
    });

    if (!match) continue;

    const { error: updateError } = await supabase.rpc('confirm_stellar_payment', {
      p_payment_id: payment.id,
      p_user_id: payment.user_id,
      p_credits: payment.credits_added,
      p_tx_hash: match.transaction_hash,
    });

    if (updateError) {
      console.error(`[stellar-checker] erro ao confirmar pagamento ${payment.id}:`, updateError);
    } else {
      processedMemos.push(payment.stellar_memo);
    }
  }

  return jsonResponse(req, 200, {
    success: true,
    verified_count: processedMemos.length,
  });
}));
