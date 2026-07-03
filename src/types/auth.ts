export interface User {
  id: string;
  name: string;
  email: string;
  handle?: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  organizationId: string;
  createdAt: string;
  credits?: number;
  walletAddress?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  /** Preferências salvas em profiles.settings (JSON livre). */
  settings?: Record<string, unknown>;
}

export interface Organization {
  id: string;
  name: string;
  logo?: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
