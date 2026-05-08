/**
 * AbacatePay Service — Gateway de Pagamento
 * Docs: https://docs.abacatepay.com
 * API v2: https://api.abacatepay.com/v2
 *
 * ⚠️ IMPORTANTE: Chamadas à API do AbacatePay que usam a API Key
 * devem ser feitas por um backend (Edge Function / Supabase Function).
 * Este serviço serve como camada de abstração e inclui:
 * - Chamadas ao Supabase Edge Function (proxy seguro)
 * - Helpers para o frontend (QR Code PIX, redirect checkout)
 */

import { supabase } from '@/lib/supabase';

const ABACATE_API = 'https://api.abacatepay.com/v2';

// ─── Types ───────────────────────────────────────────────────
export interface AbacateProduct {
  id: string;
  externalId: string;
  name: string;
  price: number; // centavos
  description?: string;
  cycle?: 'WEEKLY' | 'MONTHLY' | 'SEMIANNUALLY' | 'ANNUALLY';
}

export interface AbacateCheckout {
  id: string;
  url: string;
  status: string;
  amount: number;
  devMode: boolean;
}

export interface AbacatePixQR {
  id: string;
  brCode: string;
  brCodeBase64: string;
  amount: number;
  status: string;
  expiresAt: string;
}

export interface AbacateSubscription {
  id: string;
  status: 'PENDING' | 'EXPIRED' | 'CANCELLED' | 'PAID' | 'REFUNDED';
  url: string;
}

// ─── Plans definition ────────────────────────────────────────
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0, // R$ 0
    priceDisplay: 'R$ 0',
    period: '/mês',
    description: 'Para autônomos testarem a plataforma',
    features: [
      'Até 5 contratos por mês',
      'Assinatura digital básica',
      '1 template salvo',
      'Armazenamento de 100MB',
    ],
    abacateProductId: null, // No payment needed
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9700, // R$ 97,00 in centavos
    priceDisplay: 'R$ 97',
    period: '/mês',
    description: 'Para profissionais e pequenos escritórios',
    features: [
      'Contratos ilimitados',
      'Assinatura com registro Stellar',
      'Templates ilimitados',
      'Assistente IA (100 análises/mês)',
      'Armazenamento de 5GB',
      'Lembretes automáticos',
    ],
    abacateProductId: 'contractease_pro', // externalId on AbacatePay
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 29700, // R$ 297,00 in centavos
    priceDisplay: 'R$ 297',
    period: '/mês',
    description: 'Para grandes cartórios e escritórios',
    features: [
      'Tudo do plano Pro',
      'Multi-organização (Teams)',
      'API REST pública',
      'SLA de 99.99%',
      'Integração Zapier/Make',
      'White-label (Sua marca)',
    ],
    abacateProductId: 'contractease_enterprise',
  },
} as const;

export type PlanId = keyof typeof PLANS;

// ─── Service ─────────────────────────────────────────────────
export const abacatePayService = {
  /**
   * Creates a checkout session via Supabase Edge Function (secure proxy).
   * The Edge Function holds the API key and calls AbacatePay.
   */
  createCheckout: async (planId: PlanId, userEmail: string, userName?: string): Promise<AbacateCheckout> => {
    const plan = PLANS[planId];
    if (!plan || !plan.abacateProductId) {
      throw new Error('Plano gratuito não requer pagamento.');
    }

    const { data, error } = await supabase.functions.invoke('abacatepay-checkout', {
      body: {
        planId,
        productExternalId: plan.abacateProductId,
        customerEmail: userEmail,
        customerName: userName,
        returnUrl: `${window.location.origin}/finance?status=success`,
        completionUrl: `${window.location.origin}/finance?status=completed`,
      },
    });

    if (error) throw new Error(error.message || 'Erro ao criar checkout');
    return data as AbacateCheckout;
  },

  /**
   * Creates a PIX QR Code for immediate payment (Checkout Transparente).
   */
  createPixPayment: async (
    amountCents: number,
    description: string,
    customer: { name: string; email: string; taxId?: string },
    metadata?: Record<string, any>
  ): Promise<AbacatePixQR> => {
    const { data, error } = await supabase.functions.invoke('abacatepay-pix', {
      body: {
        amount: amountCents,
        description,
        customer,
        metadata,
      },
    });

    if (error) throw new Error(error.message || 'Erro ao gerar QR Code PIX');
    return data as AbacatePixQR;
  },

  /**
   * Creates a subscription checkout (recurring billing).
   */
  createSubscription: async (planId: PlanId, userEmail: string): Promise<AbacateSubscription> => {
    const plan = PLANS[planId];
    if (!plan || !plan.abacateProductId) {
      throw new Error('Plano gratuito não requer assinatura.');
    }

    const { data, error } = await supabase.functions.invoke('abacatepay-subscription', {
      body: {
        productExternalId: plan.abacateProductId,
        customerEmail: userEmail,
        returnUrl: `${window.location.origin}/finance?status=subscribed`,
      },
    });

    if (error) throw new Error(error.message || 'Erro ao criar assinatura');
    return data as AbacateSubscription;
  },

  /**
   * Check payment status (PIX transparent).
   */
  checkPixStatus: async (pixId: string): Promise<{ status: string; paid: boolean }> => {
    const { data, error } = await supabase.functions.invoke('abacatepay-check', {
      body: { pixId },
    });

    if (error) throw new Error(error.message || 'Erro ao verificar pagamento');
    return data as { status: string; paid: boolean };
  },

  /**
   * Redirect to AbacatePay hosted checkout page.
   */
  redirectToCheckout: (checkoutUrl: string) => {
    window.location.href = checkoutUrl;
  },
};
