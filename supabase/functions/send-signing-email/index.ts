// ───────────────────────────────────────────────────────────────────────
// Envio do convite de assinatura
//
// [CRIT] Antes: endpoint anônimo que aceitava `to`, `signerName` e
// `contractTitle` livres e os injetava CRUS no HTML do e-mail. Isso era um
// open relay de phishing: o atacante mandava e-mail para qualquer destinatário,
// a partir do domínio verificado da ContractEase, com HTML arbitrário
// (`signerName: "<a href='http://evil'>Clique</a>"`) — herdando toda a
// reputação de entrega do domínio e queimando o SPF/DKIM da empresa.
//
// Agora: exige JWT, confirma que o caller é dono/parte do contrato, tira o
// destinatário e o título do BANCO (nunca do corpo) e escapa todo texto.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  handler,
  jsonResponse,
  requireUser,
  requireContractAccess,
  serviceClient,
  escapeHtml,
  isUuid,
  HttpError,
} from '../_shared/security.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://contractease.com';
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'ContractEase <onboarding@resend.dev>';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);

  const { contractId, partyId } = await req.json();

  if (!isUuid(contractId)) {
    throw new HttpError(400, 'invalid_contract_id', 'contractId precisa ser um UUID.');
  }
  if (!isUuid(partyId)) {
    throw new HttpError(400, 'invalid_party_id', 'partyId precisa ser um UUID.');
  }

  const supabase = serviceClient();
  await requireContractAccess(supabase, contractId, user);

  // Destinatário, nome e título vêm do banco. Aceitá-los do corpo era o que
  // transformava a função em relay: quem chama escolhe o contrato, não o e-mail.
  const { data: party, error: partyError } = await supabase
    .from('contract_parties')
    .select('id, name, email, contract_id')
    .eq('id', partyId)
    .eq('contract_id', contractId)
    .maybeSingle();

  if (partyError) {
    throw new HttpError(500, 'party_lookup_failed', partyError.message);
  }
  if (!party?.email) {
    throw new HttpError(404, 'party_not_found', 'Signatário não encontrado neste contrato.');
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('title')
    .eq('id', contractId)
    .maybeSingle();

  if (!RESEND_API_KEY) {
    console.warn('[send-signing-email] RESEND_API_KEY não configurada. E-mail não enviado.');
    return jsonResponse(req, 200, { success: true, message: 'Serviço de e-mail não configurado' });
  }

  // encodeURIComponent nos segmentos: ainda que só aceitemos UUID, manter a
  // codificação evita qualquer quebra de estrutura da URL.
  const signingUrl = `${APP_URL}/sign/${encodeURIComponent(contractId)}/${encodeURIComponent(partyId)}`;

  const safeName = escapeHtml(party.name || 'Signatário');
  const safeTitle = escapeHtml(contract?.title || 'Documento');
  const safeUrl = escapeHtml(signingUrl);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [party.email],
      subject: `Convite para Assinar: ${contract?.title ?? 'Documento'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #10b981;">Olá, ${safeName}!</h2>
          <p>Você foi convidado(a) para assinar o documento:</p>
          <p style="font-weight: bold; font-size: 18px;">${safeTitle}</p>
          <p>Clique no botão abaixo para revisar e assinar com segurança:</p>
          <a href="${safeUrl}"
             style="display:inline-block; background-color: #10b981; color: white;
                    padding: 12px 28px; text-decoration: none; border-radius: 8px;
                    font-weight: bold; margin: 16px 0;">
            Assinar Documento
          </a>
          <p style="color: #6b7280; font-size: 13px;">
            Ou acesse o link: <a href="${safeUrl}">${safeUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">
            ContractEase — Contratos digitais com prova de existência na blockchain Stellar.
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    // Resposta do provedor pode conter detalhes de conta/domínio: só no log.
    console.error('[send-signing-email] erro do Resend', { status: res.status, body: errorBody });
    throw new HttpError(502, 'email_send_failed', 'Falha ao enviar o e-mail de assinatura.');
  }

  return jsonResponse(req, 200, { success: true });
}));
