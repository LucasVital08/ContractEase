// ───────────────────────────────────────────────────────────────────────
// Checkout PIX/Cartão via AbacatePay
//
// [CRIT] Antes: anônimo e com `amount` + `metadata` vindos do corpo. O cliente
// criava um produto de R$ 0,01 com metadata `{ credits: 999999 }` e o webhook
// creditava tudo. Preço e quantidade eram, na prática, escolhidos pelo comprador.
//
// Agora: exige JWT, o pacote vem da tabela de preços do servidor e o metadata
// é montado aqui (userId do token), nunca reaproveitado do cliente.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handler, jsonResponse, requireUser, HttpError } from '../_shared/security.ts';
import { resolvePackage } from '../_shared/pricing.ts';

const ABACATE_API = 'https://api.abacatepay.com/v2';
const ABACATE_KEY = Deno.env.get('ABACATEPAY_API_KEY') || '';
const APP_URL = Deno.env.get('APP_URL') || 'https://contractease.com';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);

  if (!ABACATE_KEY) {
    throw new HttpError(500, 'abacate_not_configured', 'ABACATEPAY_API_KEY não configurada.');
  }

  const { packageId } = await req.json();
  const pkg = resolvePackage(packageId);

  if (!pkg) {
    throw new HttpError(400, 'invalid_package', 'packageId inválido.');
  }

  // PASSO 1: produto com o preço da tabela do servidor.
  const productRes = await fetch(`${ABACATE_API}/products/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ABACATE_KEY}`,
    },
    body: JSON.stringify({
      externalId: `prod-${pkg.id}-${Date.now()}`,
      name: `${pkg.label} - ContractEase`,
      price: pkg.amountCents,
      currency: 'BRL',
    }),
  });

  const productData = await productRes.json();
  if (!productData.success) {
    console.error('[abacatepay-pix] falha ao criar produto:', productData);
    throw new HttpError(502, 'product_create_failed', 'Não foi possível criar o produto de cobrança.');
  }

  // PASSO 2: checkout. O metadata é montado no servidor — o webhook confia
  // nele para identificar o usuário, então ele não pode vir do browser.
  const checkoutRes = await fetch(`${ABACATE_API}/checkouts/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ABACATE_KEY}`,
    },
    body: JSON.stringify({
      frequency: 'ONE_TIME',
      methods: ['PIX', 'CARD'],
      items: [{ id: productData.data.id, quantity: 1 }],
      returnUrl: `${APP_URL}/finance`,
      completionUrl: `${APP_URL}/finance?success=true`,
      metadata: {
        userId: user.id,
        packageId: pkg.id,
        credits: pkg.credits,
      },
    }),
  });

  const checkoutData = await checkoutRes.json();
  if (!checkoutData.success) {
    console.error('[abacatepay-pix] falha ao criar checkout:', checkoutData);
    throw new HttpError(502, 'checkout_create_failed', 'Não foi possível criar o checkout.');
  }

  return jsonResponse(req, 200, { success: true, data: checkoutData.data });
}));
