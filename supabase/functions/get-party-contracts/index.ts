// ───────────────────────────────────────────────────────────────────────
// Lista os contratos em que o usuário autenticado figura como parte.
//
// [MED] Antes, o filtro era montado por interpolação de string:
//   .or(`email.eq.${user.email},user_id.eq.${user.id}`)
// O PostgREST interpreta vírgulas e parênteses como sintaxe do filtro, então
// um e-mail com esses caracteres quebra a expressão e permite injetar condições
// adicionais — e a função roda com service_role, sem RLS para conter o estrago.
// Trocamos por duas consultas com filtros parametrizados.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handler, jsonResponse, requireUser, serviceClient, HttpError } from '../_shared/security.ts';

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);
  const supabase = serviceClient();

  const contractIds = new Set<string>();

  // Partes vinculadas pelo user_id.
  const { data: byUserId, error: userIdError } = await supabase
    .from('contract_parties')
    .select('contract_id')
    .eq('user_id', user.id);

  if (userIdError) {
    throw new HttpError(500, 'parties_lookup_failed', userIdError.message);
  }
  byUserId?.forEach((p) => contractIds.add(p.contract_id));

  // Partes vinculadas pelo e-mail do token (comparação case-insensitive).
  if (user.email) {
    const { data: byEmail, error: emailError } = await supabase
      .from('contract_parties')
      .select('contract_id')
      .ilike('email', user.email);

    if (emailError) {
      throw new HttpError(500, 'parties_lookup_failed', emailError.message);
    }
    byEmail?.forEach((p) => contractIds.add(p.contract_id));
  }

  if (contractIds.size === 0) {
    return jsonResponse(req, 200, []);
  }

  const { data: contracts, error: contractsError } = await supabase
    .from('contracts')
    .select('*, contract_parties(*), contract_clauses(*), favorites:favorites(id)')
    .in('id', Array.from(contractIds));

  if (contractsError) {
    throw new HttpError(500, 'contracts_lookup_failed', contractsError.message);
  }

  return jsonResponse(req, 200, contracts ?? []);
}));
