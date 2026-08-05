/**
 * Catálogo de pacotes de crédito exibido na tela de finanças.
 *
 * Os valores aqui são apenas para EXIBIÇÃO. Quem define quanto se paga e quanto
 * se recebe é a tabela equivalente no servidor
 * (`supabase/functions/_shared/pricing.ts`) — o cliente envia somente o `id`.
 *
 * Antes, a tela mandava `amount` e `credits` no corpo da requisição, e as Edge
 * Functions confiavam nesses números: dava para pedir 1.000.000 de créditos por
 * um centavo. Manter o preço só na exibição é o que impede isso.
 */
export interface CreditPackageView {
  id: 'basic' | 'pro' | 'volume';
  credits: number;
  /** Preço em BRL, apenas para renderizar. */
  price: number;
  label: string;
  popular?: boolean;
}

export const CREDIT_PACKAGES: CreditPackageView[] = [
  { id: 'basic', credits: 50, price: 29.9, label: 'Pacote Básico' },
  { id: 'pro', credits: 200, price: 99.9, label: 'Pacote Pro', popular: true },
  { id: 'volume', credits: 1000, price: 399.9, label: 'Pacote Volume' },
];
