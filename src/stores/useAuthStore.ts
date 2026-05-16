import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization } from '@/types';
import { supabase } from '@/lib/supabase';

let profileChannel: ReturnType<typeof supabase.channel> | null = null;

function subscribeToProfile(userId: string, onUpdate: (payload: any) => void) {
  if (profileChannel) {
    supabase.removeChannel(profileChannel);
    profileChannel = null;
  }
  profileChannel = supabase
    .channel(`profile:${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, onUpdate)
    .subscribe((status, err) => { if (err) console.warn('[realtime:profile]', err); });
}

interface AuthStore {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialized: boolean;

  activeProfile: 'business' | 'developer';
  
  login: (user: User, org: Organization) => void;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  updateUser: (data: Partial<User>) => void;
  setActiveProfile: (profile: 'business' | 'developer') => void;
  switchOrganization: (org: Organization) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      isAuthenticated: false,
      isLoading: true,
      initialized: false,
      activeProfile: 'business',
      
      login: (user, organization) =>
        set({ user, organization, isAuthenticated: true, isLoading: false }),

      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, organization: null, isAuthenticated: false });
      },

      setLoading: (isLoading) => set({ isLoading }),

      updateUser: (data) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        })),

      setActiveProfile: (activeProfile) => set({ activeProfile }),

      switchOrganization: (org) => {
        set((state) => ({
          organization: org,
          user: state.user ? { ...state.user, organizationId: org.id } : null,
        }));
      },

      initialize: async () => {
        if (get().initialized) return;

        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            // 1. Fetch user profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            // 2. Fetch organization if it exists
            let organization: Organization | null = null;
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
                  plan: (orgData.plan ?? profile.plan ?? 'free') as Organization['plan'],
                  createdAt: orgData.created_at,
                };
              }
            }

            const user: User = {
              id: session.user.id,
              name: profile?.name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'Usuário',
              email: session.user.email!,
              role: (profile?.role ?? 'user') as User['role'],
              avatar: profile?.avatar_url ?? session.user.user_metadata?.avatar_url,
              organizationId: profile?.organization_id ?? 'personal',
              createdAt: session.user.created_at,
              credits: profile?.credits ?? 0,
              walletAddress: profile?.wallet_address,
              plan: (profile?.plan ?? 'free') as User['plan'],
            };

            if (!organization) {
              organization = {
                id: 'personal',
                name: 'Espaço Pessoal',
                plan: (profile?.plan ?? 'free') as Organization['plan'],
                createdAt: session.user.created_at,
              };
            }

            set({ user, organization, isAuthenticated: true, isLoading: false, initialized: true });

            subscribeToProfile(session.user.id, (payload) => {
              if (payload.new) get().updateUser({ credits: payload.new.credits, plan: payload.new.plan, name: payload.new.name });
            });
          } else {
            set({ user: null, organization: null, isAuthenticated: false, isLoading: false, initialized: true });
          }
        } catch {
          set({ isLoading: false, initialized: true });
        }

        // Listen for auth state changes (login/logout/token refresh)
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT' || !session) {
            set({ user: null, organization: null, isAuthenticated: false });
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            let organization: Organization | null = null;
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
                  plan: (orgData.plan ?? profile.plan ?? 'free') as Organization['plan'],
                  createdAt: orgData.created_at,
                };
              }
            }

            const user: User = {
              id: session.user.id,
              name: profile?.name ?? session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'Usuário',
              email: session.user.email!,
              role: (profile?.role ?? 'user') as User['role'],
              avatar: profile?.avatar_url ?? session.user.user_metadata?.avatar_url,
              organizationId: profile?.organization_id ?? 'personal',
              createdAt: session.user.created_at,
              credits: profile?.credits ?? 0,
              walletAddress: profile?.wallet_address,
              plan: (profile?.plan ?? 'free') as User['plan'],
            };

            if (!organization) {
              organization = {
                id: 'personal',
                name: 'Espaço Pessoal',
                plan: (profile?.plan ?? 'free') as Organization['plan'],
                createdAt: session.user.created_at,
              };
            }

            set({ user, organization, isAuthenticated: true, isLoading: false });

            subscribeToProfile(session.user.id, (payload) => {
              if (payload.new) get().updateUser({ credits: payload.new.credits, plan: payload.new.plan, name: payload.new.name });
            });
          }
        });
      },
    }),
    { name: 'contractease-auth' }
  )
);
