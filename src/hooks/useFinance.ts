import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores';

export interface Payment {
  id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
  plan_id?: string;
  credits_added?: number;
}

export function useFinance() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<{ plan: string; credits: number } | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFinanceData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // 1. Buscar perfil (plano e créditos)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan, credits')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        // Sincronizar com a store global para atualizar Topbar, etc.
        useAuthStore.getState().updateUser({ credits: profileData.credits, plan: profileData.plan as any });
      }

      // 2. Buscar histórico de pagamentos
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (paymentsData) setPayments(paymentsData);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [user?.id]);

  return { profile, payments, loading, refresh: fetchFinanceData };
}
