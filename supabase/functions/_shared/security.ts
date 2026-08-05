// ═══════════════════════════════════════════════════════════════════════
// Utilitários de segurança compartilhados pelas Edge Functions.
//
// Antes deste módulo, praticamente toda função era anônima (`Access-Control-
// Allow-Origin: *` e nenhuma checagem de JWT), o que permitia a qualquer
// pessoa na internet gastar a chave da Gemini, disparar e-mails com o domínio
// verificado da plataforma, drenar o XLM do sponsor e sobrescrever linhas de
// `contracts` via service_role.
// ═══════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Origens autorizadas a chamar as funções pelo browser.
 * Configure `ALLOWED_ORIGINS` (lista separada por vírgula) nos secrets.
 */
function allowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
    ?? Deno.env.get('APP_URL')
    ?? '';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

/**
 * CORS por origem, em vez de `*`.
 *
 * Com `*` qualquer site conseguia montar um formulário/fetch contra estas
 * funções usando a sessão do visitante. Agora só as origens declaradas passam.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const list = allowedOrigins();

  // Sem allowlist configurada, não refletimos a origem do atacante:
  // devolvemos a APP_URL (ou nada) e a chamada cross-site falha fechada.
  const allow = list.includes(origin) ? origin : (list[0] ?? '');

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response {
  return new Response('ok', { headers: corsHeaders(req) });
}

/** Cliente com service_role — ignora RLS. Use só depois de autorizar o caller. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Valida o JWT do header Authorization e devolve o usuário.
 * Lança `HttpError(401)` se ausente/inválido.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new HttpError(401, 'missing_authorization', 'Header Authorization ausente.');
  }

  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data?.user) {
    throw new HttpError(401, 'invalid_token', 'Token inválido ou expirado.');
  }

  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Confirma que `userId` pode agir sobre `contractId` (dono ou parte listada).
 *
 * Necessário porque as funções usam service_role: sem esta checagem o RLS não
 * protege nada e qualquer UUID enviado no body era aceito.
 */
export async function requireContractAccess(
  supabase: SupabaseClient,
  contractId: string,
  user: AuthedUser,
): Promise<void> {
  if (!isUuid(contractId)) {
    throw new HttpError(400, 'invalid_contract_id', 'contractId precisa ser um UUID.');
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, owner_id')
    .eq('id', contractId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, 'contract_lookup_failed', error.message);
  }
  if (!contract) {
    // 404 em vez de 403 para não confirmar a existência do contrato.
    throw new HttpError(404, 'contract_not_found', 'Contrato não encontrado.');
  }
  if (contract.owner_id === user.id) {
    return;
  }

  if (user.email) {
    const { data: party } = await supabase
      .from('contract_parties')
      .select('id')
      .eq('contract_id', contractId)
      .ilike('email', user.email)
      .maybeSingle();

    if (party) return;
  }

  throw new HttpError(403, 'forbidden', 'Sem permissão sobre este contrato.');
}

/**
 * Protege endpoints internos (cron/worker) com um segredo compartilhado,
 * comparado em tempo constante.
 */
export function requireInternalSecret(req: Request, envVar: string): void {
  const expected = Deno.env.get(envVar) ?? '';
  if (!expected) {
    throw new HttpError(500, 'secret_not_configured', `${envVar} não configurado.`);
  }
  const provided = req.headers.get('x-internal-secret') ?? '';
  if (!timingSafeEqual(provided, expected)) {
    throw new HttpError(401, 'unauthorized', 'Segredo interno inválido.');
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Compara sempre o mesmo número de bytes para não vazar o tamanho.
  let diff = ba.length ^ bb.length;
  const len = Math.max(ba.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Escapa texto que vai para dentro de HTML (e-mails, principalmente). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Envolve o handler: trata preflight, converte HttpError em resposta e evita
 * que stack traces / mensagens internas vazem para o cliente.
 */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight(req);

    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonResponse(req, err.status, { error: err.code, message: err.message });
      }
      console.error('[edge] erro inesperado:', err);
      return jsonResponse(req, 500, { error: 'internal_error' });
    }
  };
}
