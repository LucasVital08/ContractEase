/**
 * Handle Resolver — @username → endereço Stellar
 *
 * Permite que o usuário do ContractEase identifique partes do contrato por
 * @handle (ex: @lucas, @acme) em vez de colar a chave pública Stellar (G...).
 *
 * Marketing: "Smart contract descomplicado — dinheiro programável simples
 * como mandar um @ no WhatsApp."
 *
 * Estratégia de resolução (em ordem):
 *   1. Diretório curado de demo handles (para o hackathon e onboarding)
 *   2. Perfis do Supabase com handle cadastrado (RPC lookup_profile_by_handle)
 *   3. SocialPay handles directory (futuro: cross-app via edge function)
 *
 * O diretório curado segue como fast-path para demos sem rede; perfis reais
 * caem no fallback assíncrono que consulta a tabela profiles via RPC seguro.
 */

import { supabase } from '@/lib/supabase';

export interface ResolvedHandle {
  handle: string;            // ex: "lucas" (sem o @)
  address: string;           // chave pública Stellar G...
  displayName: string;       // nome exibível
  avatar?: string;           // emoji ou URL
  verified?: boolean;        // ✓ azul se for conta verificada
  kind?: 'person' | 'company' | 'project' | 'supplier';
  email?: string;            // e-mail do perfil (quando vindo do Supabase)
  userId?: string;           // profiles.id (quando vindo do Supabase)
  source?: 'demo' | 'profile';
  preferredInput?: string;   // valor ideal para preencher o campo (@handle ou G...)
  hasWallet?: boolean;       // se o perfil já tem carteira Stellar configurada
}

interface ProfileLookupRow {
  id: string;
  handle: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
}

// ─── Diretório curado de demos ───────────────────────────────────────
// Endereços Stellar Testnet reais — podem ser usados em transações de teste

const DEMO_HANDLES: ResolvedHandle[] = [
  {
    handle: 'lucas',
    address: 'GCKFBEIYTKP74Q4O7QH3VBHX4Z3CTKEMR4D5W5NDFTC5UZIFSBGTTAS6',
    displayName: 'Lucas Vital',
    avatar: '👨‍💻',
    verified: true,
    kind: 'person',
  },
  {
    handle: 'gabriel',
    address: 'GD7XKBVUUZJBOXBV7KSGS7E2LZGCDJHM4GH2BNGZGTVB6UWUTPDFTEAK',
    displayName: 'Gabriel Costa',
    avatar: '👨‍💼',
    verified: true,
    kind: 'person',
  },
  {
    handle: 'maria',
    address: 'GBJTHTZB4JCKKWGJSMHM3WANPQ6E54RWUDDXOZAKW2HM47AZ7FT6EKV4',
    displayName: 'Maria Silva',
    avatar: '👩‍💼',
    verified: true,
    kind: 'person',
  },
  {
    handle: 'ana',
    address: 'GA5XAYDD3JKZWNVCK3I4G2ITIVZIXLR2KMVZUHM4VW2XJWS6FGH2WPTC',
    displayName: 'Ana Souza',
    avatar: '🧑‍🎨',
    verified: true,
    kind: 'person',
  },
  {
    handle: 'joao',
    address: 'GBYSBDAJZMHL5AMD7QXQ3JEP4Q2CKTKE3R5N4VBPDXWZ6KSGPNMGAFXR',
    displayName: 'João Santos',
    avatar: '🧑',
    kind: 'person',
  },
  {
    handle: 'pedro',
    address: 'GCYZA2P6XLPCWQVK4A2TG5XCK7HJEY2VWGSXMQPMR7HKHTPRBYO6JL3F',
    displayName: 'Pedro Almeida',
    avatar: '🧑',
    kind: 'person',
  },
  {
    handle: 'acme',
    address: 'GACMERCO5KZWQOYUSHWMRTTQVYWHB5MAYE2W2QGFG37VCXJMLZBQFKAJ',
    displayName: 'Acme Corp',
    avatar: '🏢',
    verified: true,
    kind: 'company',
  },
  {
    handle: 'startupx',
    address: 'GASTARTPX4JKMVCZ6OBHM4VLBM4PJDPHGSPDV62EWZTKL5XHTPYBSUPX',
    displayName: 'Startup X',
    avatar: '🚀',
    verified: true,
    kind: 'company',
  },
  {
    handle: 'devteam',
    address: 'GDEVTEAMNPKLM4ZQHC2MR4ABMLR5OBHJTW6FXMVKPLAMTGSP6XCYREWZ',
    displayName: 'Dev Team',
    avatar: '👥',
    kind: 'project',
  },
  {
    handle: 'imobiliaria_rio',
    address: 'GIMOBRIO4KZWQOYUSHWMRTTQVYWHB5MAYE2W2QGFG37VCXJMLZBQRIVO',
    displayName: 'Imobiliária Rio',
    avatar: '🏢',
    verified: true,
    kind: 'company',
  },
  {
    handle: 'oracle_voos',
    address: 'GORCVOO5KZWQOYUSHWMRTTQVYWHB5MAYE2W2QGFG37VCXJMLZBQVOOSS',
    displayName: 'Oracle Voos Brasil',
    avatar: '✈️',
    verified: true,
    kind: 'supplier',
  },
  {
    handle: 'arbiter',
    address: 'GARBT45KZWQOYUSHWMRTTQVYWHB5MAYE2W2QGFG37VCXJMLZBQARBTRR',
    displayName: 'Árbitro Neutro',
    avatar: '⚖️',
    verified: true,
    kind: 'supplier',
  },
];

const HANDLES_BY_NAME = new Map(DEMO_HANDLES.map(h => [h.handle.toLowerCase(), h]));
const HANDLES_BY_ADDR = new Map(DEMO_HANDLES.map(h => [h.address, h]));

// ─── API pública ────────────────────────────────────────────────────

/**
 * Detecta se uma string é um handle (@username) ou um endereço Stellar bruto.
 */
export function isHandle(input: string): boolean {
  return /^@?[a-z][a-z0-9_]{1,30}$/i.test(input.trim());
}

export function isStellarAddress(input: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(input.trim());
}

/**
 * Normaliza um handle removendo @ e baixando case.
 */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Resolve um handle (@lucas ou lucas) para um endereço Stellar.
 * Retorna null se não encontrar.
 *
 * Ordem:
 *   1. Diretório curado (fast-path, sem rede)
 *   2. Perfil real no Supabase via RPC lookup_profile_by_handle
 */
export async function resolveHandle(handle: string): Promise<ResolvedHandle | null> {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;

  const profile = await resolveHandleFromProfiles(normalized);
  if (profile) return profile;

  const demo = HANDLES_BY_NAME.get(normalized);
  if (demo) {
    return {
      ...demo,
      source: 'demo',
      preferredInput: `@${demo.handle}`,
      hasWallet: true,
    };
  }

  return null;
}

/**
 * Consulta direta à tabela profiles via RPC `lookup_profile_by_handle`.
 * O RPC roda como SECURITY DEFINER e expõe apenas campos seguros (id, nome,
 * e-mail, avatar, wallet_address). Falhas de rede retornam null em vez de
 * lançar — quem chama trata como "não encontrado".
 */
async function resolveHandleFromProfiles(normalized: string): Promise<ResolvedHandle | null> {
  try {
    const { data, error } = await supabase
      .rpc('lookup_profile_by_handle', { p_handle: normalized })
      .maybeSingle();
    if (error || !data) return null;

    return mapProfileRowToResolved(data as ProfileLookupRow);
  } catch {
    return null;
  }
}

/**
 * Versão síncrona — útil em validações de input em tempo real.
 */
export function resolveHandleSync(handle: string): ResolvedHandle | null {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;
  const demo = HANDLES_BY_NAME.get(normalized);
  if (!demo) return null;

  return {
    ...demo,
    preferredInput: `@${demo.handle}`,
    hasWallet: true,
  };
}

/**
 * Resolução reversa: dado um endereço Stellar, encontra o handle (se houver).
 */
export function lookupHandleByAddress(address: string): ResolvedHandle | null {
  return HANDLES_BY_ADDR.get(address) || null;
}

/**
 * Busca handles que começam ou contêm o query (para autocomplete).
 */
export async function searchHandles(query: string, limit = 6): Promise<ResolvedHandle[]> {
  return searchExistingProfiles(query, limit);
}

async function searchExistingProfiles(query: string, limit: number): Promise<ResolvedHandle[]> {
  try {
    const normalized = query.trim().replace(/^@+/, '').toLowerCase();
    const rpcResults = await searchProfilesDirectoryRpc(normalized, limit);
    if (rpcResults.length > 0) return rpcResults;

    const legacyResults = await searchLegacyProfiles(normalized, limit);
    if (legacyResults.length > 0) return legacyResults;

    const exactEmailMatch = await lookupProfileByEmail(normalized);
    return exactEmailMatch ? [exactEmailMatch] : [];
  } catch {
    return [];
  }
}

export async function lookupProfileByAddress(address: string): Promise<ResolvedHandle | null> {
  try {
    const { data, error } = await supabase
      .rpc('lookup_profile_by_wallet_address', { p_wallet_address: address })
      .maybeSingle();
    if (error || !data) return null;
    return mapProfileRowToResolved(data as ProfileLookupRow);
  } catch {
    return null;
  }
}

async function searchProfilesDirectoryRpc(query: string, limit: number): Promise<ResolvedHandle[]> {
  const { data, error } = await supabase.rpc('search_profiles_directory', {
    p_query: query,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];

  return (data as ProfileLookupRow[])
    .map(mapProfileRowToResolved)
    .sort((left, right) => scoreProfileResult(query, right) - scoreProfileResult(query, left)
      || Number(Boolean(right.hasWallet)) - Number(Boolean(left.hasWallet))
      || left.displayName.localeCompare(right.displayName, 'pt-BR'))
    .slice(0, limit);
}

async function searchLegacyProfiles(query: string, limit: number): Promise<ResolvedHandle[]> {
  const { data, error } = await supabase.rpc('search_profile_handles', {
    p_query: query,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];

  return (data as Array<{ id: string; handle: string; name: string; avatar_url: string | null }>)
    .map((row) => mapProfileRowToResolved({
      id: row.id,
      handle: row.handle,
      name: row.name,
      email: null,
      avatar_url: row.avatar_url,
      wallet_address: null,
    }))
    .slice(0, limit);
}

async function lookupProfileByEmail(email: string): Promise<ResolvedHandle | null> {
  if (!email.includes('@')) return null;

  const { data, error } = await supabase
    .rpc('lookup_profile_by_email', { p_email: email })
    .maybeSingle();
  if (error || !data) return null;

  const row = data as { id: string; email: string | null };
  return mapProfileRowToResolved({
    id: row.id,
    handle: null,
    name: row.email,
    email: row.email,
    avatar_url: null,
    wallet_address: null,
  });
}

function mapProfileRowToResolved(row: ProfileLookupRow): ResolvedHandle {
  const fallbackHandle = row.handle || normalizeHandle(row.email || row.name || row.id.slice(0, 8));
  const address = row.wallet_address ?? '';
  return {
    handle: fallbackHandle,
    address,
    displayName: row.name || row.email || `@${fallbackHandle}`,
    avatar: row.avatar_url ?? undefined,
    verified: false,
    kind: 'person',
    email: row.email ?? undefined,
    userId: row.id,
    source: 'profile',
    preferredInput: row.handle ? `@${row.handle}` : (address || undefined),
    hasWallet: Boolean(address),
  };
}

function scoreProfileResult(query: string, result: ResolvedHandle) {
  if (!query) {
    return (result.hasWallet ? 10 : 0) + (result.handle ? 4 : 0);
  }

  const handle = result.handle.toLowerCase();
  const name = result.displayName.toLowerCase();
  const email = (result.email || '').toLowerCase();

  let score = 0;
  if (handle === query) score += 100;
  if (handle.startsWith(query)) score += 80;
  if (name.startsWith(query)) score += 55;
  if (email.startsWith(query)) score += 50;
  if (handle.includes(query)) score += 35;
  if (name.includes(query)) score += 25;
  if (email.includes(query)) score += 20;
  if (result.hasWallet) score += 12;
  if (result.handle) score += 6;

  return score;
}

/**
 * Extrai todos os @handles mencionados em um texto livre.
 * Útil para o assistente IA processar mensagens em linguagem natural.
 */
export function extractHandlesFromText(text: string): string[] {
  const matches = text.match(/@([a-z][a-z0-9_]{1,30})/gi) || [];
  return Array.from(new Set(matches.map(m => normalizeHandle(m))));
}

/**
 * Resolve um valor que pode ser um @handle OU um endereço Stellar bruto,
 * retornando o endereço final. Usado para preencher campos do contrato.
 */
export async function resolveToAddress(input: string): Promise<{
  address: string | null;
  resolved?: ResolvedHandle;
  error?: string;
}> {
  const trimmed = input.trim();
  if (!trimmed) return { address: null };

  // Já é um endereço Stellar válido — retorna direto
  if (isStellarAddress(trimmed)) {
    const reverseLookup = lookupHandleByAddress(trimmed);
    return { address: trimmed, resolved: reverseLookup || undefined };
  }

  // É um handle — tenta resolver
  if (isHandle(trimmed)) {
    const resolved = await resolveHandle(trimmed);
    if (resolved) {
      return { address: resolved.address, resolved };
    }
    return { address: null, error: `@${normalizeHandle(trimmed)} não encontrado` };
  }

  return { address: null, error: 'Use um @handle ou endereço Stellar (G...)' };
}

/**
 * Lista todos os handles disponíveis (para o painel de "todos os usuários").
 */
export function getAllHandles(): ResolvedHandle[] {
  return [...DEMO_HANDLES];
}
