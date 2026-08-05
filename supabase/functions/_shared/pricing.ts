// ═══════════════════════════════════════════════════════════════════════
// Tabela de preços — fonte da verdade do lado do servidor.
//
// [CRIT] As funções de pagamento aceitavam `amount` e `credits` direto do
// corpo da requisição. Isso permitia pedir 1.000.000 de créditos por R$ 0,01:
// o cliente escolhia o próprio preço. Nada que venha do browser pode definir
// quanto se paga nem quanto se recebe — só o ID do pacote.
// ═══════════════════════════════════════════════════════════════════════

export interface CreditPackage {
  id: string;
  credits: number;
  /** Valor em centavos de BRL. */
  amountCents: number;
  /** Valor em XLM (string com 7 casas, formato Stellar). */
  amountXlm: string;
  label: string;
}

// Espelha exatamente os pacotes exibidos em src/services/creditPackages.ts.
// Ao alterar preços, mude NOS DOIS lugares — o servidor é quem manda, o
// frontend só exibe.
//
// NOTA: `amountXlm` replica o comportamento anterior, em que o valor em BRL era
// enviado como quantidade de XLM. Isso não é uma conversão de câmbio real e
// deve ser revisto pelo time de produto (ver SECURITY_AUDIT.md).
export const CREDIT_PACKAGES: Record<string, CreditPackage> = {
  basic: { id: 'basic', credits: 50, amountCents: 2990, amountXlm: '29.9000000', label: 'Pacote Básico — 50 Créditos' },
  pro: { id: 'pro', credits: 200, amountCents: 9990, amountXlm: '99.9000000', label: 'Pacote Pro — 200 Créditos' },
  volume: { id: 'volume', credits: 1000, amountCents: 39990, amountXlm: '399.9000000', label: 'Pacote Volume — 1000 Créditos' },
};

export function resolvePackage(packageId: unknown): CreditPackage | null {
  if (typeof packageId !== 'string') return null;
  return CREDIT_PACKAGES[packageId] ?? null;
}
