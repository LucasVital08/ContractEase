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

  const demo = HANDLES_BY_NAME.get(normalized);
  if (demo) return { ...demo, source: 'demo' };

  return resolveHandleFromProfiles(normalized);
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

    const row = data as {
      id: string;
      handle: string;
      name: string;
      email: string | null;
      avatar_url: string | null;
      wallet_address: string | null;
    };

    return {
      handle: row.handle,
      address: row.wallet_address ?? '',
      displayName: row.name,
      avatar: row.avatar_url ?? undefined,
      verified: false,
      kind: 'person',
      email: row.email ?? undefined,
      userId: row.id,
      source: 'profile',
    };
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
  return HANDLES_BY_NAME.get(normalized) || null;
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
  const normalized = normalizeHandle(query);
  if (!normalized || normalized.length < 1) {
    // Sem query: retorna os destaques (verified primeiro)
    return DEMO_HANDLES.filter(h => h.verified).slice(0, limit);
  }

  // Match priorizando: começa com > contém handle > contém displayName
  const startsWith: ResolvedHandle[] = [];
  const containsHandle: ResolvedHandle[] = [];
  const containsName: ResolvedHandle[] = [];

  for (const h of DEMO_HANDLES) {
    const lower = h.handle.toLowerCase();
    const dnLower = h.displayName.toLowerCase();
    if (lower.startsWith(normalized)) {
      startsWith.push({ ...h, source: 'demo' });
    } else if (lower.includes(normalized)) {
      containsHandle.push({ ...h, source: 'demo' });
    } else if (dnLower.includes(normalized)) {
      containsName.push({ ...h, source: 'demo' });
    }
  }

  const demoResults = [...startsWith, ...containsHandle, ...containsName];
  const profileResults = await searchProfileHandles(normalized, limit);

  // Dedup por handle — demo tem prioridade (avatar curado, verified, etc.)
  const seen = new Set(demoResults.map(h => h.handle.toLowerCase()));
  const merged = [...demoResults];
  for (const p of profileResults) {
    if (!seen.has(p.handle.toLowerCase())) {
      merged.push(p);
      seen.add(p.handle.toLowerCase());
    }
  }

  return merged.slice(0, limit);
}

async function searchProfileHandles(normalized: string, limit: number): Promise<ResolvedHandle[]> {
  try {
    const { data, error } = await supabase.rpc('search_profile_handles', {
      p_query: normalized,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];

    return (data as Array<{ id: string; handle: string; name: string; avatar_url: string | null }>).map(row => ({
      handle: row.handle,
      address: '',
      displayName: row.name,
      avatar: row.avatar_url ?? undefined,
      verified: false,
      kind: 'person' as const,
      userId: row.id,
      source: 'profile' as const,
    }));
  } catch {
    return [];
  }
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
