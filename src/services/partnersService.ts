import { searchHandles } from '@/services/handleResolver';

export type PartnerConnectionStatus = 'pending' | 'accepted' | 'rejected';

export interface PartnerConnection {
  id: string;
  initiatorId: string;
  initiatorName: string;
  initiatorHandle: string;
  initiatorAvatarUrl: string | null;
  partnerId: string;
  partnerName: string;
  partnerHandle: string;
  partnerAvatarUrl: string | null;
  partnerBio: string | null;
  partnerJobTitle: string | null;
  status: PartnerConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SendConnectionRequestInput {
  initiatorId: string;
  initiatorName: string;
  initiatorHandle: string;
  initiatorAvatarUrl?: string | null;
  partnerId: string;
  partnerName: string;
  partnerHandle: string;
  partnerAvatarUrl?: string | null;
  partnerBio?: string | null;
  partnerJobTitle?: string | null;
}

export interface UserSearchResult {
  userId: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  jobTitle: string | null;
  hasWallet: boolean;
}

// In-memory store. Quando a tabela `partner_connections` for criada no
// Supabase, trocar pra persistência real (mesma estratégia das propostas).
const connectionStore: PartnerConnection[] = [];

export const partnersService = {
  async listForUser(userId: string): Promise<PartnerConnection[]> {
    return connectionStore.filter(
      (c) => c.initiatorId === userId || c.partnerId === userId,
    );
  },

  async sendRequest(input: SendConnectionRequestInput): Promise<PartnerConnection> {
    const existing = connectionStore.find(
      (c) => (c.initiatorId === input.initiatorId && c.partnerId === input.partnerId)
        || (c.initiatorId === input.partnerId && c.partnerId === input.initiatorId),
    );
    if (existing) return { ...existing };

    const now = new Date().toISOString();
    const conn: PartnerConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      initiatorId: input.initiatorId,
      initiatorName: input.initiatorName,
      initiatorHandle: input.initiatorHandle,
      initiatorAvatarUrl: input.initiatorAvatarUrl ?? null,
      partnerId: input.partnerId,
      partnerName: input.partnerName,
      partnerHandle: input.partnerHandle,
      partnerAvatarUrl: input.partnerAvatarUrl ?? null,
      partnerBio: input.partnerBio ?? null,
      partnerJobTitle: input.partnerJobTitle ?? null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    connectionStore.push(conn);
    return { ...conn };
  },

  async acceptRequest(connectionId: string): Promise<PartnerConnection | null> {
    const conn = connectionStore.find((c) => c.id === connectionId);
    if (!conn) return null;
    conn.status = 'accepted';
    conn.updatedAt = new Date().toISOString();
    return { ...conn };
  },

  async rejectRequest(connectionId: string): Promise<void> {
    const conn = connectionStore.find((c) => c.id === connectionId);
    if (conn) {
      conn.status = 'rejected';
      conn.updatedAt = new Date().toISOString();
    }
  },

  async removePartner(connectionId: string): Promise<void> {
    const idx = connectionStore.findIndex((c) => c.id === connectionId);
    if (idx >= 0) connectionStore.splice(idx, 1);
  },

  async searchUsers(query: string): Promise<UserSearchResult[]> {
    if (!query || query.length < 2) return [];
    const results = await searchHandles(query, 10);
    return results.map((r) => ({
      userId: r.userId ?? r.address ?? r.handle,
      handle: r.handle,
      name: r.displayName,
      avatarUrl: r.avatar && /^https?:\/\//i.test(r.avatar) ? r.avatar : null,
      bio: null,
      jobTitle: null,
      hasWallet: Boolean(r.hasWallet),
    }));
  },
};
