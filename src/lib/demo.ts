/**
 * Modo demonstração.
 *
 * Serve para percorrer o app inteiro sem back-end configurado — útil para
 * revisar a experiência num branch antes de subir, e para gravar demonstrações.
 *
 * Ligado exclusivamente por variável de ambiente em tempo de build
 * (`VITE_DEMO_MODE=1`). Não há como ativar por URL ou localStorage de
 * propósito: um build de produção nunca deve conseguir entrar aqui.
 */

import type { Contract, Organization, User } from '@/types';

export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === '1';

export const DEMO_USER: User = {
  id: 'demo-user',
  name: 'Ana Ribeiro',
  email: 'ana@exemplo.com.br',
  handle: 'ana',
  role: 'owner',
  organizationId: 'personal',
  createdAt: new Date().toISOString(),
  credits: 25,
  plan: 'free',
};

export const DEMO_ORG: Organization = {
  id: 'personal',
  name: 'Espaço Pessoal',
  plan: 'free',
  createdAt: new Date().toISOString(),
};

/** Data a N meses atrás, para o gráfico ter uma curva em vez de uma linha reta. */
function monthsAgo(n: number, day = 12): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n, day);
  return d.toISOString();
}

function party(name: string, email: string, role: 'creator' | 'counterparty', signed?: boolean) {
  return {
    id: `${email}-${role}`,
    name,
    email,
    role,
    signedAt: signed ? monthsAgo(0, 3) : undefined,
  };
}

const seed: Array<Partial<Contract> & { title: string; monthsBack: number }> = [
  { title: 'Prestação de serviços — Consultoria Alfa', monthsBack: 5, status: 'completed', tags: [] },
  { title: 'Confidencialidade — Projeto Íris', monthsBack: 5, status: 'completed', tags: [] },
  { title: 'Locação comercial — Sala 402', monthsBack: 4, status: 'active', tags: ['smart-contract'] },
  { title: 'Freelancer — Identidade visual', monthsBack: 3, status: 'completed', tags: ['smart-contract'] },
  { title: 'Fornecimento — Insumos trimestrais', monthsBack: 3, status: 'active', tags: [] },
  { title: 'Compra e venda — Veículo utilitário', monthsBack: 2, status: 'active', tags: ['smart-contract'] },
  { title: 'Parceria comercial — Rede Norte', monthsBack: 2, status: 'pending', tags: [] },
  { title: 'Honorários advocatícios — Caso 118', monthsBack: 1, status: 'pending', tags: ['smart-contract'] },
  { title: 'Reforma da cozinha — João Marceneiro', monthsBack: 1, status: 'active', tags: ['smart-contract'] },
  { title: 'Recibo de quitação — Obra Vila Mar', monthsBack: 0, status: 'completed', tags: [] },
  { title: 'Contrato de trabalho — Camila Souza', monthsBack: 0, status: 'pending', tags: [] },
  { title: 'Aluguel por temporada — Casa Litoral', monthsBack: 0, status: 'draft', tags: ['smart-contract'] },
];

/** Modelos de exemplo — no formato cru que a tabela `templates` devolve. */
export const DEMO_TEMPLATES = [
  {
    id: 'tpl-servicos',
    name: 'Prestação de serviços',
    description: 'Escopo, prazo, valor e condições de pagamento para contratação de serviços.',
    category: 'Serviços',
    icon: 'solar:case-round-linear',
    content: '',
    clauses: [
      { order: 1, title: 'Objeto', content: 'Prestação dos serviços descritos no escopo anexo.' },
      { order: 2, title: 'Prazo', content: 'Execução em até {{prazo_dias}} dias corridos.' },
      { order: 3, title: 'Pagamento', content: 'R$ {{valor}}, em {{parcelas}} parcela(s).' },
    ],
    variables: ['prazo_dias', 'valor', 'parcelas'],
    tags: ['popular'],
    rating: 4.8,
    usage_count: 1240,
  },
  {
    id: 'tpl-locacao',
    name: 'Locação residencial',
    description: 'Aluguel com caução, reajuste anual e regras de rescisão.',
    category: 'Imobiliário',
    icon: 'solar:home-linear',
    content: '',
    clauses: [
      { order: 1, title: 'Imóvel', content: 'Locação do imóvel situado em {{endereco}}.' },
      { order: 2, title: 'Aluguel', content: 'R$ {{aluguel}} mensais, vencendo todo dia {{vencimento}}.' },
      { order: 3, title: 'Caução', content: 'Depósito de {{meses_caucao}} aluguéis como garantia.' },
    ],
    variables: ['endereco', 'aluguel', 'vencimento', 'meses_caucao'],
    tags: ['popular'],
    rating: 4.7,
    usage_count: 980,
  },
  {
    id: 'tpl-nda',
    name: 'Acordo de confidencialidade',
    description: 'Proteção de informações sensíveis entre as partes, com prazo e penalidade.',
    category: 'Comercial',
    icon: 'solar:lock-linear',
    content: '',
    clauses: [
      { order: 1, title: 'Informação confidencial', content: 'Define o que é considerado confidencial.' },
      { order: 2, title: 'Vigência', content: 'Obrigação mantida por {{anos}} anos após o término.' },
    ],
    variables: ['anos'],
    tags: [],
    rating: 4.6,
    usage_count: 760,
  },
  {
    id: 'tpl-freela',
    name: 'Contrato de freelancer',
    description: 'Entrega por marcos, propriedade intelectual e pagamento condicionado ao aceite.',
    category: 'Tecnologia',
    icon: 'solar:programming-linear',
    content: '',
    clauses: [
      { order: 1, title: 'Escopo', content: 'Entregáveis listados com respectivos marcos.' },
      { order: 2, title: 'Propriedade', content: 'Cessão dos direitos após quitação integral.' },
      { order: 3, title: 'Aceite', content: 'Prazo de {{dias_aceite}} dias para validar cada entrega.' },
    ],
    variables: ['dias_aceite'],
    tags: ['popular'],
    rating: 4.9,
    usage_count: 1520,
  },
  {
    id: 'tpl-compra-venda',
    name: 'Compra e venda',
    description: 'Transferência de bem com pagamento, entrega e garantia definidos.',
    category: 'Comercial',
    icon: 'solar:cart-linear',
    content: '',
    clauses: [
      { order: 1, title: 'Bem', content: 'Descrição e estado do bem negociado.' },
      { order: 2, title: 'Preço', content: 'R$ {{valor}}, pago na forma acordada.' },
    ],
    variables: ['valor'],
    tags: [],
    rating: 4.5,
    usage_count: 640,
  },
  {
    id: 'tpl-trabalho',
    name: 'Contrato de trabalho',
    description: 'Cargo, jornada, remuneração e período de experiência.',
    category: 'Trabalho',
    icon: 'solar:user-id-linear',
    content: '',
    clauses: [
      { order: 1, title: 'Função', content: 'Cargo de {{cargo}}, com as atribuições descritas.' },
      { order: 2, title: 'Remuneração', content: 'R$ {{salario}} mensais.' },
    ],
    variables: ['cargo', 'salario'],
    tags: [],
    rating: 4.4,
    usage_count: 520,
  },
];

/** Contratos de exemplo — só existem quando IS_DEMO é verdadeiro. */
export const DEMO_CONTRACTS: Contract[] = seed.map((item, index) => {
  const createdAt = monthsAgo(item.monthsBack, 4 + (index % 20));
  const signedAll = item.status === 'completed' || item.status === 'active';
  return {
    id: `demo-${String(index + 1).padStart(3, '0')}`,
    title: item.title,
    description: '',
    type: 'service',
    status: item.status ?? 'draft',
    parties: [
      party('Ana Ribeiro', 'ana@exemplo.com.br', 'creator', signedAll),
      party('Contraparte', `parte${index + 1}@exemplo.com.br`, 'counterparty', item.status === 'completed'),
    ],
    clauses: [],
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(new Date(createdAt).getTime() + 90 * 864e5).toISOString(),
    createdBy: DEMO_USER.id,
    organizationId: 'personal',
    tags: item.tags ?? [],
    stellarTxHash: index % 3 === 0 ? `demo${index}hash` : undefined,
  } as Contract;
});
