import { supabase } from '@/lib/supabase';
import type { Contract, ContractDraft, Party, Clause } from '@/types';

// ─── Auth ────────────────────────────────────────────────────
export const authService = {
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const profile = await authService.getProfile(data.user.id);
    
    let organization: any = {
      id: 'personal',
      name: 'Espaço Pessoal',
      plan: (profile?.plan ?? 'free') as any,
      createdAt: data.user.created_at,
    };

    if (profile?.organization_id && profile.organization_id !== 'personal') {
       const { data: orgData } = await supabase
         .from('organizations')
         .select('*')
         .eq('id', profile.organization_id)
         .single();
       
       if (orgData) {
         organization = {
           id: orgData.id,
           name: orgData.name,
           plan: (orgData.plan ?? profile.plan ?? 'free') as any,
           createdAt: orgData.created_at,
         };
       }
    }

    return {
      user: {
        id: data.user.id,
        name: profile?.name ?? email.split('@')[0],
        email: data.user.email!,
        role: (profile?.role ?? 'user') as any,
        avatar: profile?.avatar_url ?? undefined,
        organizationId: profile?.organization_id ?? 'personal',
        createdAt: data.user.created_at,
        credits: profile?.credits ?? 0,
        plan: (profile?.plan ?? 'free') as any,
      },
      organization,
      token: data.session.access_token,
    };
  },

  register: async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Erro ao criar conta. Verifique seu e-mail.');

    return {
      user: {
        id: data.user.id,
        name,
        email: data.user.email!,
        role: 'owner' as const,
        organizationId: 'personal',
        createdAt: data.user.created_at,
        credits: 0,
        plan: 'free' as const,
      },
      organization: {
        id: 'personal',
        name: 'Espaço Pessoal',
        plan: 'free' as const,
        createdAt: data.user.created_at,
      },
      token: data.session?.access_token ?? '',
    };
  },

  loginWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw new Error(error.message);
  },

  loginWithGithub: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw new Error(error.message);
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { success: true };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  getProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  },

  updateProfile: async (userId: string, updates: { name?: string; avatar_url?: string }) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ─── Helpers: DB row <-> Frontend type mapping ───────────────
interface DbContract {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  value: number | null;
  currency: string;
  stellar_tx_hash: string | null;
  stellar_tx_id: string | null;
  tags: string[];
  signature_order: string;
  multisig_enabled: boolean;
  contract_hash: string | null;
  owner_id: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  contract_parties?: DbParty[];
  contract_clauses?: DbClause[];
  folder_id: string | null;
  favorites?: { id: string }[];
}

interface DbParty {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  signed_at: string | null;
  cpf: string | null;
  ip_address: string | null;
  user_agent: string | null;
  geolocation: string | null;
  signature_type: string | null;
  signature_image: string | null;
  lgpd_consent: boolean;
  public_key: string | null;
}

interface DbClause {
  id: string;
  title: string;
  content: string;
  order_index: number;
  is_custom: boolean;
}

function mapDbToContract(row: DbContract): Contract {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type as Contract['type'],
    status: row.status as Contract['status'],
    tags: row.tags ?? [],
    stellarTxHash: row.stellar_tx_hash ?? undefined,
    signatureOrder: row.signature_order as 'parallel' | 'sequential',
    multisigEnabled: row.multisig_enabled,
    contractHash: row.contract_hash ?? undefined,
    expiresAt: row.expires_at ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    parties: (row.contract_parties ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role as Party['role'],
      signedAt: p.signed_at ?? undefined,
      cpf: p.cpf ?? undefined,
      ipAddress: p.ip_address ?? undefined,
      userAgent: p.user_agent ?? undefined,
      geolocation: p.geolocation ?? undefined,
      signatureType: p.signature_type as Party['signatureType'],
      signatureImage: p.signature_image ?? undefined,
      lgpdConsent: p.lgpd_consent,
    })),
    clauses: (row.contract_clauses ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((c) => ({
        id: c.id,
        order: c.order_index,
        title: c.title,
        content: c.content,
      })),
    folderId: row.folder_id ?? undefined,
    isFavorite: (row.favorites?.length ?? 0) > 0,
  };
}

// ─── Contracts ───────────────────────────────────────────────
export const contractsService = {
  list: async (): Promise<Contract[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('contracts')
      .select('*, contract_parties(*), contract_clauses(*), favorites:favorites(id)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DbContract[]).map(mapDbToContract);
  },

  get: async (id: string): Promise<Contract | undefined> => {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, contract_parties(*), contract_clauses(*), favorites:favorites(id)')
      .eq('id', id)
      .single();
    if (error) return undefined;
    return mapDbToContract(data as DbContract);
  },

  create: async (draft: ContractDraft): Promise<Contract> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Não autenticado');

    // 1. Insert the contract
    const { data: contract, error } = await supabase
      .from('contracts')
      .insert({
        title: draft.title,
        description: draft.description,
        type: draft.type,
        tags: draft.tags,
        expires_at: draft.expiresAt || null,
        signature_order: draft.signatureOrder ?? 'parallel',
        owner_id: session.user.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // 2. Insert parties
    if (draft.parties.length > 0) {
      const { error: pError } = await supabase.from('contract_parties').insert(
        draft.parties.map((p) => ({
          contract_id: contract.id,
          name: p.name,
          email: p.email,
          role: p.role,
        }))
      );
      if (pError) throw new Error(pError.message);
    }

    // 3. Insert clauses
    if (draft.clauses.length > 0) {
      const { error: cError } = await supabase.from('contract_clauses').insert(
        draft.clauses.map((c, i) => ({
          contract_id: contract.id,
          title: c.title,
          content: c.content,
          order_index: c.order ?? i,
        }))
      );
      if (cError) throw new Error(cError.message);
    }

    // 4. Re-fetch full contract with relations
    const full = await contractsService.get(contract.id);
    if (!full) throw new Error('Erro ao buscar contrato criado');
    return full;
  },

  update: async (id: string, data: Partial<Contract>): Promise<Contract> => {
    const updatePayload: Record<string, unknown> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.type !== undefined) updatePayload.type = data.type;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.tags !== undefined) updatePayload.tags = data.tags;
    if (data.expiresAt !== undefined) updatePayload.expires_at = data.expiresAt;
    if (data.stellarTxHash !== undefined) updatePayload.stellar_tx_hash = data.stellarTxHash;
    if (data.signatureOrder !== undefined) updatePayload.signature_order = data.signatureOrder;
    if (data.folderId !== undefined) updatePayload.folder_id = data.folderId;

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from('contracts')
        .update(updatePayload)
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    const full = await contractsService.get(id);
    if (!full) throw new Error('Contrato não encontrado');
    return full;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  toggleFavorite: async (contractId: string, isFav: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (isFav) {
      await supabase.from('favorites').delete().eq('contract_id', contractId).eq('user_id', session.user.id);
    } else {
      await supabase.from('favorites').insert({ contract_id: contractId, user_id: session.user.id });
    }
  },

  moveToFolder: async (contractId: string, folderId: string | null) => {
    const { error } = await supabase
      .from('contracts')
      .update({ folder_id: folderId })
      .eq('id', contractId);
    if (error) throw error;
  }
};

// ─── Folders ─────────────────────────────────────────────────
export const foldersService = {
  list: async () => {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  create: async (name: string, color: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile } = await supabase.from('profiles').select('organization_id').single();
    
    const { data, error } = await supabase
      .from('folders')
      .insert({
        name,
        color,
        owner_id: session?.user.id,
        organization_id: profile?.organization_id !== 'personal' ? profile?.organization_id : null
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }
};

// ─── AI (kept as mock — will plug into OpenAI/Claude later) ──
export const aiService = {
  generateContract: async (prompt: string): Promise<Partial<Contract>> => {
    await new Promise((r) => setTimeout(r, 2500));
    return {
      title: 'Contrato Gerado por IA',
      description: `Gerado a partir do prompt: "${prompt}"`,
      type: 'service',
      clauses: [
        { id: `cls_${Date.now()}_1`, title: 'Objeto', content: 'O presente contrato tem por objeto a prestação de serviços descritos no prompt.', order: 1 },
        { id: `cls_${Date.now()}_2`, title: 'Obrigações', content: 'As partes se comprometem a cumprir com as obrigações estipuladas com zelo e confidencialidade.', order: 2 },
        { id: `cls_${Date.now()}_3`, title: 'Foro', content: 'Fica eleito o foro da comarca da capital para dirimir quaisquer dúvidas.', order: 3 },
      ],
    };
  },
  rewriteClause: async (content: string, style: 'simplify' | 'formal'): Promise<string> => {
    await new Promise((r) => setTimeout(r, 1500));
    if (style === 'simplify') {
      return `(Legal Design) ${content.substring(0, 50)}... Em resumo: as partes concordam com os termos de forma clara e objetiva.`;
    }
    return `(Formal/Juridiquês) Fica convencionado e acordado, de forma irrevogável e irretratável, sob as penas da lei, que: ${content}`;
  },
  translateClause: async (content: string, targetLang: 'PT' | 'EN' | 'ES'): Promise<string> => {
    await new Promise((r) => setTimeout(r, 1500));
    const labels = { PT: 'Português', EN: 'Inglês', ES: 'Espanhol' };
    return `[Tradução para ${labels[targetLang]}] ${content.substring(0, 100)}... (Traduzido com rigor jurídico)`;
  },
  generateSummary: async (contract: any): Promise<string> => {
    await new Promise((r) => setTimeout(r, 2000));
    return `Este contrato de ${contract.type} estabelece obrigações claras entre as partes. Em resumo: você está contratando um serviço pelo prazo estipulado, com garantias de confidencialidade e regras de rescisão padrão.`;
  },
  detectAbusiveClauses: async (clauses: any[]): Promise<{ clauseId: string; risk: string; reason: string }[]> => {
    await new Promise((r) => setTimeout(r, 2000));
    // Simulate finding a risk in the first clause
    if (clauses.length > 0) {
      return [{
        clauseId: clauses[0].id,
        risk: 'HIGH',
        reason: 'A multa rescisória de 50% é considerada abusiva pelo CDC em contratos de prestação de serviços padrão.'
      }];
    }
    return [];
  },
  calculateHealthScore: async (contract: any): Promise<number> => {
    await new Promise((r) => setTimeout(r, 1500));
    return 85; // Mock score
  }
};

// ─── Organizations & Team ──────────────────────────────────
export const organizationService = {
  get: async (orgId: string) => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*, organization_members(*, profiles(*))')
      .eq('id', orgId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (orgId: string, updates: any) => {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getMyOrganization: async () => {
    const { data: profile } = await supabase.from('profiles').select('organization_id').single();
    if (!profile?.organization_id) return null;
    return organizationService.get(profile.organization_id);
  },

  inviteMember: async (email: string, role: string, orgId: string) => {
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single();
    if (!profile) throw new Error('Usuário não encontrado com este e-mail.');

    const { data, error } = await supabase
      .from('organization_members')
      .insert({ organization_id: orgId, user_id: profile.id, role })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  removeMember: async (memberId: string) => {
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) throw error;
  },
};

// ─── Templates ───────────────────────────────────────────
export const templateService = {
  list: async (category?: string) => {
    let query = supabase.from('templates').select('*').order('usage_count', { ascending: false });
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase.from('templates').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  incrementUsage: async (id: string) => {
    const { error } = await supabase.rpc('increment_template_usage', { template_id: id });
    if (error) console.error('Error incrementing usage:', error);
  },
};

// ─── Analytics ───────────────────────────────────────────
export const analyticsService = {
  getUserStats: async () => {
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('id, status, stellar_tx_hash, created_at, contract_parties(signed_at)');
    if (error) throw error;

    const total = contracts.length;
    const active = contracts.filter(c => c.status === 'active').length;
    const anchored = contracts.filter(c => c.stellar_tx_hash).length;
    const pending = contracts.filter(c => c.status === 'pending').length;
    
    const totalSignatures = contracts.reduce((acc, c) => {
      const signed = (c.contract_parties as any[])?.filter(p => p.signed_at).length || 0;
      return acc + signed;
    }, 0);

    return { total, active, anchored, pending, totalSignatures, contracts };
  },

  getAdminStats: async () => {
    // Requires specialized RPC or higher permissions
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
    if (error) {
      // Fallback for demo if RPC doesn't exist
      return { total_workspaces: 0, total_users: 0, total_contracts: 0, total_revenue: 0 };
    }
    return data;
  }
};

// ─── Unified API export (drop-in replacement) ────────────────
export const api = {
  auth: authService,
  contracts: contractsService,
  ai: aiService,
  organization: organizationService,
  templates: templateService,
  analytics: analyticsService,
  folders: foldersService,
};
