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
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
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

  signInWithOtp: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        shouldCreateUser: false,
      }
    });
    if (error) throw new Error(error.message);
  },

  verifyOtp: async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) throw new Error(error.message);
    if (!data.user || !data.session) throw new Error('Falha na verificação do código.');

    // Processar perfil e organização
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

  reauthenticate: async () => {
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw new Error(error.message);
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

  uploadAvatar: async (userId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  mfa: {
    enroll: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      return data;
    },
    challenge: async (factorId: string) => {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      return data;
    },
    verify: async (factorId: string, challengeId: string, code: string) => {
      const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
      if (error) throw error;
      return data;
    },
    listFactors: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
    unenroll: async (factorId: string) => {
      const { data, error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      return data;
    },
  },

  otp: {
    generate: async ({ userId, email, purpose }: { userId?: string; email?: string; purpose: string }) => {
      const { data, error } = await supabase.rpc('generate_otp', { 
        p_user_id: userId || null, 
        p_email: email || null,
        p_purpose: purpose 
      });
      if (error) throw error;
      return data;
    },
    verify: async ({ userId, email, code, purpose }: { userId?: string; email?: string; code: string; purpose: string }) => {
      const { data, error } = await supabase.rpc('verify_otp', { 
        p_user_id: userId || null, 
        p_email: email || null,
        p_code: code, 
        p_purpose: purpose 
      });
      if (error) throw error;
      return data;
    }
  }
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
  list: async (orgId?: string): Promise<Contract[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;

    // Query 1: contracts owned by the user (or their org)
    let query = supabase
      .from('contracts')
      .select('*, contract_parties(*), contract_clauses(*), favorites:favorites(id)');

    if (orgId && orgId !== 'personal') {
      query = query.eq('organization_id', orgId);
    } else {
      query = query.is('organization_id', null);
    }

    const { data: ownContracts, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    // Query 2: contracts where the user is a party but not the owner
    let partyContracts: DbContract[] = [];
    if (userEmail) {
      const { data: partyRows } = await supabase
        .from('contract_parties')
        .select('contract_id')
        .eq('email', userEmail);

      const ownIds = new Set((ownContracts as DbContract[]).map(c => c.id));
      const partyIds = (partyRows ?? [])
        .map(p => p.contract_id)
        .filter((id): id is string => !!id && !ownIds.has(id));

      if (partyIds.length > 0) {
        const { data } = await supabase
          .from('contracts')
          .select('*, contract_parties(*), contract_clauses(*), favorites:favorites(id)')
          .in('id', partyIds);
        partyContracts = (data as DbContract[]) ?? [];
      }
    }

    const all = [...(ownContracts as DbContract[]), ...partyContracts];
    return all.map(mapDbToContract);
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

  create: async (draft: ContractDraft, orgId?: string): Promise<Contract> => {
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
        organization_id: (orgId && orgId !== 'personal') ? orgId : null
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
  list: async (orgId?: string) => {
    let query = supabase.from('folders').select('*');
    
    if (orgId && orgId !== 'personal') {
      query = query.eq('organization_id', orgId);
    } else {
      query = query.is('organization_id', null);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;
    return data;
  },

  create: async (name: string, color: string, orgId?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase
      .from('folders')
      .insert({
        name,
        color,
        owner_id: session?.user.id,
        organization_id: (orgId && orgId !== 'personal') ? orgId : null
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

// ─── AI (Gemini via Edge Function) ───────────────────────────
export const aiService = {
  analyzeContract: async (contract: any) => {
    const { data, error } = await supabase.functions.invoke('ai-agent', {
      body: { 
        action: 'analyze', 
        contractContent: JSON.stringify(contract.clauses || contract) 
      }
    });
    if (error) throw error;
    try {
      // O Gemini as vezes retorna blocos markdown tipo ```json ... ```
      const cleanedText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText);
    } catch(e) {
      console.error('Failed to parse AI response', data.text);
      return { score: 80, summary: "Análise concluída, mas falhou ao extrair os dados estruturados.", risks: [] };
    }
  },
  chat: async (contract: any, message: string) => {
    const { data, error } = await supabase.functions.invoke('ai-agent', {
      body: { 
        action: 'chat', 
        contractContent: JSON.stringify(contract.clauses || contract),
        userMessage: message 
      }
    });
    if (error) throw error;
    return data.text;
  },
  translateClause: async (content: string, targetLang: 'PT' | 'EN' | 'ES'): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('ai-agent', {
      body: { 
        action: 'chat', 
        contractContent: content,
        userMessage: `Traduza o seguinte texto jurídico para ${targetLang}. Responda APENAS com a tradução e nada mais.`
      }
    });
    if (error) throw error;
    return data.text;
  },
  // Mantidos como mocks os demais métodos por retrocompatibilidade se usados em outro lugar
  generateContract: async (prompt: string): Promise<Partial<Contract>> => {
    const { data, error } = await supabase.functions.invoke('ai-agent', {
      body: { action: 'generate', prompt }
    });
    if (error) throw error;
    try {
      const cleanedText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText);
    } catch(e) {
      console.error('Failed to parse AI generate response', data.text);
      throw new Error("Falha ao estruturar o contrato gerado pela IA.", { cause: e });
    }
  },
  getDashboardInsights: async (contracts: any[]): Promise<string> => {
    // Mandamos uma versão simplificada para a IA (economiza tokens)
    const summaryList = contracts.map(c => ({ title: c.title, status: c.status, expiresAt: c.expiresAt }));
    const { data, error } = await supabase.functions.invoke('ai-agent', {
      body: { action: 'dashboard_insights', contracts: summaryList }
    });
    if (error) throw error;
    return data.text;
  },
  calculateHealthScore: async (contract: any): Promise<number> => 85,
  detectAbusiveClauses: async (clauses: any[]) => [],
  generateSummary: async (contract: any): Promise<string> => "Resumo do contrato."
};

// ─── Organizations & Team ──────────────────────────────────
export const organizationService = {
  get: async (orgId: string) => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*, organization_members(*, profiles(id, name))')
      .eq('id', orgId)
      .single();
    if (error) throw error;
    return data;
  },

  listMyOrganizations: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: ownedOrgs } = await supabase
      .from('organizations')
      .select('id, name, logo_url, created_at')
      .eq('owner_id', user.id);

    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

    const memberOrgIds = (memberships || [])
      .map(m => m.organization_id)
      .filter(id => !(ownedOrgs || []).some(o => o.id === id));

    let memberOrgs: any[] = [];
    if (memberOrgIds.length > 0) {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, logo_url, created_at')
        .in('id', memberOrgIds);
      memberOrgs = data || [];
    }

    return [...(ownedOrgs || []), ...memberOrgs];
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
    if (!profile?.organization_id || profile.organization_id === 'personal') return null;
    return organizationService.get(profile.organization_id);
  },

  create: async (payload: { name: string; tax_id?: string; type?: 'business' | 'team' }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({ 
        name: payload.name, 
        cnpj: payload.tax_id || null, 
        owner_id: user.id,
        type: payload.type || 'business'
      })
      .select()
      .single();
    if (orgError) throw orgError;

    await supabase.from('profiles').update({ organization_id: orgData.id }).eq('id', user.id);
    
    await supabase.from('organization_members').insert({
      organization_id: orgData.id,
      user_id: user.id,
      role: 'owner'
    });

    return orgData;
  },

  inviteMember: async (email: string, role: string, orgId: string) => {
    const { data: funcData, error: funcError } = await supabase.functions.invoke('invite-member', {
      body: { email, role, orgId }
    });

    if (funcError) {
      console.warn("Edge function 'invite-member' failed. Using fallback local insert.", funcError);
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single();
      if (!profile) throw new Error('Usuário não encontrado com este e-mail para inserção direta.');

      const { data, error } = await supabase
        .from('organization_members')
        .insert({ organization_id: orgId, user_id: profile.id, role })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    
    return funcData;
  },

  uploadLogo: async (orgId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${orgId}-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('brand-kits')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('brand-kits')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: publicUrl })
      .eq('id', orgId);

    if (updateError) throw updateError;
    return publicUrl;
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

// ─── User Settings (persisted in profiles.settings JSONB) ──────
export const userSettingsService = {
  get: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
    return data?.settings || {};
  },
  save: async (settings: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');
    // Merge with existing settings
    const { data: current } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
    const merged = { ...(current?.settings || {}), ...settings };
    const { error } = await supabase.from('profiles').update({ settings: merged }).eq('id', user.id);
    if (error) throw error;
    return merged;
  },
};

// ─── Signing & Notifications ──────────────────────────────────
export const signingService = {
  lookupProfiles: async (query: string): Promise<{ id: string; name: string; email: string; avatar_url: string | null }[]> => {
    if (query.length < 2) return [];
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .or(`email.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(6);
    return data || [];
  },

  signParty: async (partyId: string, data: { cpf?: string; lgpdConsent: boolean }) => {
    const { error } = await supabase
      .from('contract_parties')
      .update({
        signed_at: new Date().toISOString(),
        status: 'signed',
        signature_type: 'type',
        lgpd_consent: data.lgpdConsent,
        cpf: data.cpf || null,
        user_agent: navigator.userAgent,
      })
      .eq('id', partyId);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  notifyUser: async (userId: string, notification: { title: string; message: string; type: string; link?: string }) => {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link || null,
      read: false,
    });
    if (error) console.error('[notifyUser]', error);
  },

  notifyContractParties: async (
    contractId: string,
    contractTitle: string,
    parties: { name?: string; email: string }[]
  ) => {
    for (const party of parties) {
      // 1. In-app notification (for users already registered)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', party.email)
        .maybeSingle();

      if (profile?.id) {
        await signingService.notifyUser(profile.id, {
          title: 'Convite para Assinar Documento',
          message: `Você foi convidado(a) a assinar: "${contractTitle}".`,
          type: 'signing_invite',
          link: `/contracts/${contractId}`,
        });
      }

      // 2. Email notification (works for any email, registered or not)
      supabase.functions
        .invoke('send-signing-email', {
          body: {
            to: party.email,
            signerName: party.name ?? '',
            contractTitle,
            contractId,
          },
        })
        .catch(err => console.warn('[notifyContractParties] email error:', err));
    }
  },

  checkAndCompleteContract: async (contractId: string) => {
    const { data: parties } = await supabase
      .from('contract_parties')
      .select('signed_at')
      .eq('contract_id', contractId);
    if (parties && parties.length > 0 && parties.every(p => p.signed_at)) {
      await supabase
        .from('contracts')
        .update({ status: 'active' })
        .eq('id', contractId);
    }
  },

  getPendingForUser: async (userEmail: string) => {
    const { data } = await supabase
      .from('contract_parties')
      .select('id, contract_id, name, email, role, contracts(id, title, status)')
      .eq('email', userEmail)
      .is('signed_at', null);
    return data || [];
  },
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
  settings: userSettingsService,
  signing: signingService,
};
