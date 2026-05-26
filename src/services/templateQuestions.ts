/**
 * Template Questions — banco de perguntas estruturadas
 *
 * Cada template tem um questionário guiado que substitui o chat com IA
 * em modo "passo a passo". Cada pergunta mapeia para uma `variable` do
 * template via campo `bindTo`.
 *
 * Tipos de pergunta:
 *   - 'open': input livre (texto, valor, data, endereço Stellar/@handle)
 *   - 'choice': cards de alternativa com value + descrição
 */

import type { SCQuestion, SCQuestionOption } from './smartContractTemplates';

// ─── Opções recorrentes ────────────────────────────────────────────────

const ASSET_OPTIONS_BRL_FIRST: SCQuestionOption[] = [
  { value: 'BRZ', label: 'BRZ', description: 'Real brasileiro tokenizado (1 BRZ ≈ R$ 1,00)' },
  { value: 'USDC', label: 'USDC', description: 'Dólar estável americano (1 USDC ≈ US$ 1,00)' },
  { value: 'XLM', label: 'XLM', description: 'Lumens — moeda nativa da Stellar' },
];

const ASSET_OPTIONS_USD_FIRST: SCQuestionOption[] = [
  { value: 'USDC', label: 'USDC', description: 'Dólar estável americano' },
  { value: 'BRZ', label: 'BRZ', description: 'Real brasileiro tokenizado' },
  { value: 'XLM', label: 'XLM', description: 'Lumens — moeda nativa da Stellar' },
];

const ASSET_OPTIONS_BRL_USD: SCQuestionOption[] = [
  { value: 'BRZ', label: 'BRZ', description: 'Real brasileiro tokenizado' },
  { value: 'USDC', label: 'USDC', description: 'Dólar estável americano' },
];

// ─── 10 templates originais ────────────────────────────────────────────

const rentQuestions: SCQuestion[] = [
  {
    id: 'q-landlord',
    question: 'Quem é o locador (dono do imóvel)?',
    context: 'É a pessoa que vai receber o aluguel todo mês. Você pode usar o @handle (ex: @joao) ou colar o endereço Stellar.',
    type: 'open', inputType: 'address', bindTo: 'landlord', required: true,
    placeholder: '@joao ou G...',
  },
  {
    id: 'q-tenant',
    question: 'Quem é o locatário (inquilino)?',
    context: 'É quem vai pagar o aluguel e morar no imóvel.',
    type: 'open', inputType: 'address', bindTo: 'tenant', required: true,
    placeholder: '@maria ou G...',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda o aluguel será cobrado?',
    context: 'O contrato cobra automaticamente nessa moeda da carteira do inquilino.',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_FIRST,
  },
  {
    id: 'q-rent',
    question: 'Qual o valor mensal do aluguel?',
    context: 'Valor que será debitado todo mês na data combinada. Aceita formatos: 2500, 2.500, 2,5k, etc.',
    type: 'open', inputType: 'amount', bindTo: 'monthlyRent', required: true,
    placeholder: '2500',
  },
  {
    id: 'q-deposit',
    question: 'Quantos aluguéis ficam de caução?',
    context: 'O valor fica travado no contrato e devolvido no fim — substitui fiador.',
    type: 'choice', bindTo: 'depositMonths', required: true,
    options: [
      { value: '1', label: '1 aluguel', description: 'Caução simbólica para locações curtas' },
      { value: '2', label: '2 aluguéis', description: 'Para inquilinos com bom histórico' },
      { value: '3', label: '3 aluguéis', description: 'Padrão da Lei do Inquilinato' },
      { value: '4', label: '4 ou mais', description: 'Maior segurança para o locador' },
    ],
  },
  {
    id: 'q-due-day',
    question: 'Em que dia do mês o aluguel vence?',
    context: 'Dia entre 1 e 28 — depois de D+5 sem pagamento o contrato marca inadimplência.',
    type: 'open', inputType: 'number', bindTo: 'dueDay', required: true, placeholder: '5',
  },
  {
    id: 'q-duration',
    question: 'Por quantos meses o contrato vai durar?',
    context: 'A Lei do Inquilinato exige mínimo de 30 meses.',
    type: 'choice', bindTo: 'durationMonths', required: true,
    options: [
      { value: '12', label: '12 meses', description: 'Locação anual (com renovação)' },
      { value: '24', label: '24 meses', description: 'Bienal — comum em SP' },
      { value: '30', label: '30 meses', description: 'Mínimo legal — padrão' },
      { value: '36', label: '36 meses', description: 'Inquilinos PJ ou consolidados' },
    ],
  },
  {
    id: 'q-address',
    question: 'Qual o endereço completo do imóvel?',
    context: 'Vai ficar registrado on-chain como parte do contrato.',
    type: 'open', inputType: 'long_text', bindTo: 'propertyAddress', required: true,
    placeholder: 'Rua, número, complemento, bairro, cidade — UF',
  },
];

const ecommerceQuestions: SCQuestion[] = [
  {
    id: 'q-seller',
    question: 'Quem está vendendo?',
    context: 'O vendedor só recebe quando o comprador confirmar o recebimento.',
    type: 'open', inputType: 'address', bindTo: 'seller', required: true,
    placeholder: '@vendedor ou G...',
  },
  {
    id: 'q-buyer',
    question: 'Quem está comprando?',
    context: 'O dinheiro do comprador fica em escrow no contrato até a entrega confirmada.',
    type: 'open', inputType: 'address', bindTo: 'buyer', required: true,
    placeholder: '@comprador ou G...',
  },
  {
    id: 'q-product',
    question: 'O que está sendo vendido?',
    context: 'Descreva o produto/serviço de forma clara. Vai aparecer no recibo on-chain.',
    type: 'open', inputType: 'long_text', bindTo: 'productName', required: true,
    placeholder: 'Ex: iPhone 15 Pro 256GB, cor titânio natural, lacrado',
  },
  {
    id: 'q-amount',
    question: 'Qual o valor da venda?',
    type: 'open', inputType: 'amount', bindTo: 'amount', required: true, placeholder: '4500',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_FIRST,
  },
  {
    id: 'q-auto-release',
    question: 'Em quantos dias sem confirmação o pagamento libera automaticamente?',
    context: 'Se o comprador sumir após receber, o contrato libera o pagamento para o vendedor após esse prazo.',
    type: 'choice', bindTo: 'autoReleaseDays', required: true,
    options: [
      { value: '3', label: '3 dias', description: 'Para serviços digitais entregues na hora' },
      { value: '7', label: '7 dias', description: 'Padrão para entregas físicas no Brasil' },
      { value: '15', label: '15 dias', description: 'Itens com instalação ou montagem' },
      { value: '30', label: '30 dias', description: 'Importados ou produtos sob encomenda' },
    ],
  },
];

const freelancerQuestions: SCQuestion[] = [
  {
    id: 'q-client',
    question: 'Quem vai contratar este trabalho?',
    context: 'Se você veio do feed com match aceito, esse campo normalmente já vem preenchido com o contratante.',
    type: 'open', inputType: 'address', bindTo: 'client', required: true, placeholder: '@cliente ou G...',
  },
  {
    id: 'q-freelancer',
    question: 'Quem vai executar o trabalho?',
    context: 'Informe o prestador responsável pela execução. Pode ser você ou outro perfil selecionado no fluxo.',
    type: 'open', inputType: 'address', bindTo: 'freelancer', required: true, placeholder: '@freelancer ou G...',
  },
  {
    id: 'q-scope',
    question: 'Qual o escopo do projeto?',
    context: 'Descreva o que precisa ser entregue. Vai virar a cláusula principal do contrato.',
    type: 'open', inputType: 'long_text', bindTo: 'projectScope', required: true,
    placeholder: 'Ex: Site institucional WordPress, 5 páginas, blog, contato, responsivo',
  },
  {
    id: 'q-total',
    question: 'Qual o valor total do projeto?',
    type: 'open', inputType: 'amount', bindTo: 'totalAmount', required: true, placeholder: '15000',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda o pagamento será feito?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_USD_FIRST,
  },
  {
    id: 'q-milestones',
    question: 'Em quantas entregas o projeto será dividido?',
    context: 'O cliente trava o valor total e cada entrega aprovada libera uma parcela.',
    type: 'choice', bindTo: 'milestoneCount', required: true,
    options: [
      { value: '2', label: '2 entregas', description: 'Adiantamento + entrega final' },
      { value: '3', label: '3 entregas', description: 'Início, meio e fim' },
      { value: '4', label: '4 entregas', description: 'Mais previsibilidade de fluxo' },
      { value: '6', label: '6 ou mais', description: 'Projetos longos / sprints' },
    ],
  },
  {
    id: 'q-deadline',
    question: 'Qual o prazo final do projeto?',
    type: 'open', inputType: 'date', bindTo: 'deadline', required: true,
  },
  {
    id: 'q-review',
    question: 'Em quantos dias o cliente revisa cada entrega?',
    context: 'Após esse prazo sem rejeição, a entrega é aprovada automaticamente — protege o freelancer de cliente sumido.',
    type: 'choice', bindTo: 'reviewDays', required: true,
    options: [
      { value: '3', label: '3 dias', description: 'Revisão rápida para entregas simples' },
      { value: '5', label: '5 dias', description: 'Padrão para a maioria dos projetos' },
      { value: '7', label: '7 dias', description: 'Para revisões com clientes corporativos' },
      { value: '14', label: '14 dias', description: 'Projetos com comitê de aprovação' },
    ],
  },
];

const payrollQuestions: SCQuestion[] = [
  {
    id: 'q-company',
    question: 'Qual é a empresa que paga a folha?',
    type: 'open', inputType: 'address', bindTo: 'company', required: true, placeholder: '@minhaempresa ou G...',
  },
  {
    id: 'q-employees',
    question: 'Quais funcionários e respectivos salários?',
    context: 'Use o formato: @handle:valor, separado por vírgula. Ex: @ana:5000,@joao:8000,@maria:6500',
    type: 'open', inputType: 'long_text', bindTo: 'employees', required: true,
    placeholder: '@ana:5000,@joao:8000,@maria:6500',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda os salários serão pagos?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_USD_FIRST,
  },
  {
    id: 'q-pay-day',
    question: 'Em que dia do mês a folha é executada?',
    context: 'Dia entre 1 e 28. O contrato executa automaticamente no dia escolhido.',
    type: 'choice', bindTo: 'payDay', required: true,
    options: [
      { value: '1', label: 'Dia 1º', description: 'No primeiro dia do mês seguinte' },
      { value: '5', label: 'Dia 5', description: 'Padrão CLT' },
      { value: '10', label: 'Dia 10', description: 'Equilíbrio entre caixa e equipe' },
      { value: '15', label: 'Dia 15', description: 'Pagamento na metade do mês' },
    ],
  },
  {
    id: 'q-start',
    question: 'Quando começa o primeiro pagamento?',
    type: 'open', inputType: 'date', bindTo: 'startDate', required: true,
  },
];

const royaltiesQuestions: SCQuestion[] = [
  {
    id: 'q-product',
    question: 'Qual o nome do produto/conteúdo?',
    context: 'Música, livro, software, curso… qualquer obra que gere receita recorrente.',
    type: 'open', inputType: 'text', bindTo: 'product', required: true,
    placeholder: 'Ex: Música "Saudade" — João Silva',
  },
  {
    id: 'q-beneficiaries',
    question: 'Como dividir os royalties entre os criadores?',
    context: 'Use o formato: @handle:percentual, separado por vírgula. Os percentuais precisam somar 100.',
    type: 'open', inputType: 'long_text', bindTo: 'beneficiaries', required: true,
    placeholder: '@ana:70,@startupx:20,@joao:10',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda os royalties serão recebidos?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_USD_FIRST,
  },
];

const factoringQuestions: SCQuestion[] = [
  {
    id: 'q-issuer',
    question: 'Quem emite a Nota Fiscal (PME que precisa do dinheiro)?',
    context: 'A PME vende a NF antecipada para virar caixa imediato.',
    type: 'open', inputType: 'address', bindTo: 'issuer', required: true, placeholder: '@minhaempresa ou G...',
  },
  {
    id: 'q-debtor',
    question: 'Quem é o sacado (cliente que vai pagar a NF)?',
    context: 'O sacado é a empresa que comprou da PME e vai pagar na data de vencimento.',
    type: 'open', inputType: 'address', bindTo: 'debtor', required: true, placeholder: '@cliente_grande ou G...',
  },
  {
    id: 'q-investor',
    question: 'Quem é o investidor que compra a NF antecipada?',
    type: 'open', inputType: 'address', bindTo: 'investor', required: true, placeholder: '@investidor ou G...',
  },
  {
    id: 'q-face-value',
    question: 'Qual o valor de face da NF?',
    context: 'Valor cheio que será pago pelo sacado no vencimento.',
    type: 'open', inputType: 'amount', bindTo: 'faceValue', required: true, placeholder: '100000',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-discount',
    question: 'Qual o desconto que o investidor recebe? (% do valor)',
    context: 'O investidor paga valor menos desconto e recebe o cheio no vencimento — é o lucro.',
    type: 'choice', bindTo: 'discountPct', required: true,
    options: [
      { value: '2', label: '2%', description: 'NF de risco baixo / prazo curto' },
      { value: '3', label: '3%', description: 'Padrão de mercado para 30 dias' },
      { value: '5', label: '5%', description: '60 dias / risco médio' },
      { value: '8', label: '8% ou mais', description: 'Prazo longo / sacado novo' },
    ],
  },
  {
    id: 'q-due-date',
    question: 'Quando vence a NF?',
    type: 'open', inputType: 'date', bindTo: 'dueDate', required: true,
  },
  {
    id: 'q-invoice',
    question: 'Qual o número da NF?',
    type: 'open', inputType: 'text', bindTo: 'invoiceNumber', required: true, placeholder: 'NFe-000123',
  },
];

const founderVestingQuestions: SCQuestion[] = [
  {
    id: 'q-company',
    question: 'Qual é a empresa custodiante (startup)?',
    type: 'open', inputType: 'address', bindTo: 'company', required: true, placeholder: '@startup ou G...',
  },
  {
    id: 'q-beneficiary',
    question: 'Quem é o cofundador/colaborador beneficiário?',
    type: 'open', inputType: 'address', bindTo: 'beneficiary', required: true, placeholder: '@cofundador ou G...',
  },
  {
    id: 'q-role',
    question: 'Qual o cargo/papel desse beneficiário?',
    type: 'open', inputType: 'text', bindTo: 'role', required: true, placeholder: 'Ex: Co-founder & CTO',
  },
  {
    id: 'q-total',
    question: 'Qual o valor total a vestar?',
    context: 'Pode ser equity tokenizada ou em moeda. Vai sendo liberado conforme passa o tempo.',
    type: 'open', inputType: 'amount', bindTo: 'totalAmount', required: true, placeholder: '500000',
  },
  {
    id: 'q-asset',
    question: 'Em que asset?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_USD_FIRST,
  },
  {
    id: 'q-cliff',
    question: 'Qual o cliff (carência inicial)?',
    context: 'Período em que nada vesta. Se sair antes, perde tudo. Padrão Silicon Valley: 12 meses.',
    type: 'choice', bindTo: 'cliffMonths', required: true,
    options: [
      { value: '0', label: 'Sem cliff', description: 'Vesta linear do dia 1' },
      { value: '6', label: '6 meses', description: 'Para roles de hire' },
      { value: '12', label: '12 meses', description: 'Padrão para cofundadores' },
      { value: '24', label: '24 meses', description: 'Carência longa para C-level' },
    ],
  },
  {
    id: 'q-vesting',
    question: 'Qual o período total de vesting?',
    context: 'Tempo até liberar 100% do valor.',
    type: 'choice', bindTo: 'vestingMonths', required: true,
    options: [
      { value: '24', label: '24 meses', description: 'Vesting curto para advisors' },
      { value: '36', label: '36 meses', description: 'Funcionários sêniores' },
      { value: '48', label: '48 meses', description: 'Padrão Silicon Valley (4 anos)' },
      { value: '60', label: '60 meses', description: 'Founders com lock-up longo' },
    ],
  },
  {
    id: 'q-start',
    question: 'Quando começa o vesting?',
    type: 'open', inputType: 'date', bindTo: 'startDate', required: true,
  },
];

const fixedYieldQuestions: SCQuestion[] = [
  {
    id: 'q-investor',
    question: 'Quem é o investidor?',
    type: 'open', inputType: 'address', bindTo: 'investor', required: true, placeholder: '@investidor ou G...',
  },
  {
    id: 'q-issuer',
    question: 'Quem é o emissor (banco/empresa que paga os juros)?',
    type: 'open', inputType: 'address', bindTo: 'issuer', required: true, placeholder: '@banco ou G...',
  },
  {
    id: 'q-principal',
    question: 'Qual o valor investido?',
    type: 'open', inputType: 'amount', bindTo: 'principal', required: true, placeholder: '50000',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-rate',
    question: 'Qual a taxa anual (% a.a.)?',
    context: 'Taxa garantida pelo emissor sobre o principal investido.',
    type: 'open', inputType: 'number', bindTo: 'annualRate', required: true, placeholder: '12',
  },
  {
    id: 'q-term',
    question: 'Prazo do investimento (meses)?',
    type: 'choice', bindTo: 'termMonths', required: true,
    options: [
      { value: '6', label: '6 meses', description: 'Curto prazo / liquidez maior' },
      { value: '12', label: '12 meses', description: 'Padrão para CDB / poupança' },
      { value: '24', label: '24 meses', description: 'Médio prazo com taxa melhor' },
      { value: '36', label: '36 meses', description: 'Longo prazo / maior retorno' },
    ],
  },
  {
    id: 'q-early',
    question: 'Permite resgate antecipado?',
    context: 'Se sim, o investidor pode sair antes — mas com penalidade.',
    type: 'choice', bindTo: 'earlyWithdrawal', required: true,
    options: [
      { value: 'Sim (com penalidade 2%)', label: 'Sim — com penalidade 2%', description: 'Liquidez maior, retorno menor se sair antes' },
      { value: 'Não', label: 'Não', description: 'Travado até vencimento (taxa cheia garantida)' },
    ],
  },
];

const groupBuyQuestions: SCQuestion[] = [
  {
    id: 'q-seller',
    question: 'Quem é o vendedor?',
    type: 'open', inputType: 'address', bindTo: 'seller', required: true, placeholder: '@vendedor ou G...',
  },
  {
    id: 'q-product',
    question: 'O que vai ser comprado coletivamente?',
    context: 'Inclua o desconto que será aplicado se atingir a meta.',
    type: 'open', inputType: 'long_text', bindTo: 'product', required: true,
    placeholder: 'Ex: iPhone 15 com 10% off em compra coletiva',
  },
  {
    id: 'q-price',
    question: 'Quanto cada pessoa paga?',
    type: 'open', inputType: 'amount', bindTo: 'unitPrice', required: true, placeholder: '500',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-min',
    question: 'Mínimo de participantes para a compra acontecer?',
    context: 'Se não atingir o mínimo até o prazo, todos recebem reembolso integral.',
    type: 'open', inputType: 'number', bindTo: 'minParticipants', required: true, placeholder: '20',
  },
  {
    id: 'q-deadline',
    question: 'Qual o prazo limite para fechar a compra?',
    type: 'open', inputType: 'date', bindTo: 'deadline', required: true,
  },
];

const parametricInsuranceQuestions: SCQuestion[] = [
  {
    id: 'q-insurer',
    question: 'Quem é o segurador (vende o seguro)?',
    type: 'open', inputType: 'address', bindTo: 'insurer', required: true, placeholder: '@seguradora ou G...',
  },
  {
    id: 'q-insured',
    question: 'Quem é o segurado?',
    type: 'open', inputType: 'address', bindTo: 'insured', required: true, placeholder: '@segurado ou G...',
  },
  {
    id: 'q-event',
    question: 'Qual o evento gatilho que dispara a indenização?',
    context: 'Precisa ser objetivo e mensurável. Ex: "voo atrasou +3h" funciona. "produto ruim" não.',
    type: 'open', inputType: 'long_text', bindTo: 'triggerEvent', required: true,
    placeholder: 'Ex: Voo LATAM 3456 atrasado > 3h em 15/06',
  },
  {
    id: 'q-oracle',
    question: 'Qual oráculo confirma se o evento ocorreu?',
    context: 'API externa que reporta o dado on-chain. Pode ser uma API de aeroporto, INMET, Reflector, etc.',
    type: 'open', inputType: 'address', bindTo: 'oracle', required: true, placeholder: '@oracle ou G...',
  },
  {
    id: 'q-premium',
    question: 'Quanto o segurado paga de prêmio?',
    type: 'open', inputType: 'amount', bindTo: 'premium', required: true, placeholder: '50',
  },
  {
    id: 'q-payout',
    question: 'Quanto é a indenização se o evento acontecer?',
    context: 'Costuma ser 10x a 20x o prêmio. Quanto maior o risco, maior a indenização.',
    type: 'open', inputType: 'amount', bindTo: 'payout', required: true, placeholder: '500',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_USD_FIRST,
  },
  {
    id: 'q-expiry',
    question: 'Até quando a apólice é válida?',
    context: 'Se o evento não acontecer até essa data, o prêmio fica com o segurador.',
    type: 'open', inputType: 'date', bindTo: 'expiryDate', required: true,
  },
];

// ─── 22 templates novos ─────────────────────────────────────────────────

const legalFeesQuestions: SCQuestion[] = [
  {
    id: 'q-lawyer',
    question: 'Quem é o(a) advogado(a) que vai atuar na causa?',
    context: 'Vai receber a entrada, mensalidades e percentual de êxito.',
    type: 'open', inputType: 'address', bindTo: 'lawyer', required: true, placeholder: '@dr_silva ou G...',
  },
  {
    id: 'q-client',
    question: 'Quem é o cliente da causa?',
    type: 'open', inputType: 'address', bindTo: 'client', required: true, placeholder: '@cliente ou G...',
  },
  {
    id: 'q-case',
    question: 'Qual o objeto do processo?',
    context: 'Descreva resumidamente a causa — ação trabalhista, indenização, recuperação tributária, etc.',
    type: 'open', inputType: 'long_text', bindTo: 'caseDescription', required: true,
    placeholder: 'Ex: Ação trabalhista contra Empresa X — verbas rescisórias e dano moral',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-retainer',
    question: 'Qual o valor da entrada?',
    context: 'Pago no ato da assinatura, libera o início do trabalho.',
    type: 'open', inputType: 'amount', bindTo: 'retainerAmount', required: true, placeholder: '3000',
  },
  {
    id: 'q-monthly',
    question: 'Qual o valor da mensalidade durante o processo?',
    type: 'open', inputType: 'amount', bindTo: 'monthlyFee', required: true, placeholder: '800',
  },
  {
    id: 'q-duration',
    question: 'Por quantos meses se estima o processo?',
    type: 'choice', bindTo: 'durationMonths', required: true,
    options: [
      { value: '6', label: '6 meses', description: 'Acordos extrajudiciais rápidos' },
      { value: '12', label: '12 meses', description: 'Causas simples ou acordo na 1ª instância' },
      { value: '24', label: '24 meses', description: 'Padrão para causas judicializadas' },
      { value: '36', label: '36 meses ou mais', description: 'Causas complexas com recursos' },
    ],
  },
  {
    id: 'q-success',
    question: 'Qual o percentual de êxito (quota litis)?',
    context: 'Percentual sobre o valor recuperado — pago só se houver ganho/acordo.',
    type: 'choice', bindTo: 'successRate', required: true,
    options: [
      { value: '10', label: '10%', description: 'Causas de alto valor ou ganho provável' },
      { value: '20', label: '20%', description: 'Padrão OAB para a maioria dos casos' },
      { value: '30', label: '30%', description: 'Risco elevado / sem honorário inicial' },
    ],
  },
];

const medicalConsultationQuestions: SCQuestion[] = [
  {
    id: 'q-doctor',
    question: 'Quem é o(a) médico(a) responsável?',
    type: 'open', inputType: 'address', bindTo: 'doctor', required: true, placeholder: '@dra_oliveira ou G...',
  },
  {
    id: 'q-patient',
    question: 'Quem é o paciente?',
    type: 'open', inputType: 'address', bindTo: 'patient', required: true, placeholder: '@paciente ou G...',
  },
  {
    id: 'q-specialty',
    question: 'Qual a especialidade do atendimento?',
    type: 'open', inputType: 'text', bindTo: 'specialty', required: true,
    placeholder: 'Cardiologia, Pediatria, Ginecologia...',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda o pacote será cobrado?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-price',
    question: 'Quanto custa cada consulta?',
    type: 'open', inputType: 'amount', bindTo: 'consultationPrice', required: true, placeholder: '250',
  },
  {
    id: 'q-total',
    question: 'Quantas consultas o pacote inclui?',
    type: 'choice', bindTo: 'totalConsultations', required: true,
    options: [
      { value: '4', label: '4 consultas', description: 'Acompanhamento trimestral' },
      { value: '6', label: '6 consultas', description: 'Pré-natal por trimestre / check-up' },
      { value: '10', label: '10 consultas', description: 'Pacote anual completo' },
      { value: '12', label: '12 consultas', description: 'Acompanhamento mensal' },
    ],
  },
  {
    id: 'q-validity',
    question: 'Até quando o pacote é válido?',
    context: 'Se sobrarem consultas no fim, o valor é devolvido ao paciente automaticamente.',
    type: 'open', inputType: 'date', bindTo: 'validUntil', required: true,
  },
];

const dentalTreatmentQuestions: SCQuestion[] = [
  {
    id: 'q-dentist',
    question: 'Quem é o(a) dentista responsável?',
    type: 'open', inputType: 'address', bindTo: 'dentist', required: true, placeholder: '@dr_dentista ou G...',
  },
  {
    id: 'q-patient',
    question: 'Quem é o paciente?',
    type: 'open', inputType: 'address', bindTo: 'patient', required: true, placeholder: '@paciente ou G...',
  },
  {
    id: 'q-treatment',
    question: 'Que tipo de tratamento será realizado?',
    type: 'choice', bindTo: 'treatmentType', required: true,
    options: [
      { value: 'Ortodontia', label: 'Ortodontia', description: 'Aparelho fixo/móvel com manutenções' },
      { value: 'Implante dental', label: 'Implante', description: 'Cirurgia + cicatrização + prótese' },
      { value: 'Tratamento de canal', label: 'Canal', description: 'Endodontia multi-sessão' },
      { value: 'Reabilitação oral', label: 'Reabilitação', description: 'Tratamento completo com prótese' },
    ],
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-total',
    question: 'Qual o valor total do tratamento?',
    type: 'open', inputType: 'amount', bindTo: 'totalAmount', required: true, placeholder: '8000',
  },
  {
    id: 'q-stages',
    question: 'Em quantas etapas o tratamento será dividido?',
    context: 'Cada etapa concluída e validada libera uma parcela proporcional.',
    type: 'choice', bindTo: 'stagesCount', required: true,
    options: [
      { value: '2', label: '2 etapas', description: 'Procedimentos simples' },
      { value: '3', label: '3 etapas', description: 'Tratamento padrão' },
      { value: '4', label: '4 etapas', description: 'Implantes ou ortodontia' },
      { value: '6', label: '6 ou mais', description: 'Reabilitação completa' },
    ],
  },
];

const accountingServicesQuestions: SCQuestion[] = [
  {
    id: 'q-accountant',
    question: 'Quem é o(a) contador(a) responsável?',
    type: 'open', inputType: 'address', bindTo: 'accountant', required: true, placeholder: '@contador ou G...',
  },
  {
    id: 'q-company',
    question: 'Qual a empresa cliente?',
    type: 'open', inputType: 'address', bindTo: 'company', required: true, placeholder: '@empresa ou G...',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-monthly',
    question: 'Qual o honorário mensal?',
    type: 'open', inputType: 'amount', bindTo: 'monthlyFee', required: true, placeholder: '1500',
  },
  {
    id: 'q-deadline',
    question: 'Até que dia do mês as obrigações precisam estar entregues?',
    context: 'Mensalidade fica retida até o contador confirmar entrega (folha, DCTF, balancete).',
    type: 'choice', bindTo: 'deliveryDeadline', required: true,
    options: [
      { value: '10', label: 'Dia 10', description: 'Padrão para empresas no Simples' },
      { value: '15', label: 'Dia 15', description: 'Folga para DCTF e GPS' },
      { value: '20', label: 'Dia 20', description: 'Compatível com Lucro Real' },
      { value: '25', label: 'Dia 25', description: 'Empresas com fechamento mensal completo' },
    ],
  },
  {
    id: 'q-duration',
    question: 'Por quantos meses o contrato vai durar?',
    type: 'choice', bindTo: 'durationMonths', required: true,
    options: [
      { value: '6', label: '6 meses', description: 'Período experimental' },
      { value: '12', label: '12 meses', description: 'Padrão anual' },
      { value: '24', label: '24 meses', description: 'Renovação automática para confiança' },
    ],
  },
];

const psychologyPackageQuestions: SCQuestion[] = [
  {
    id: 'q-psychologist',
    question: 'Quem é o(a) psicólogo(a)?',
    type: 'open', inputType: 'address', bindTo: 'psychologist', required: true, placeholder: '@psi_clara ou G...',
  },
  {
    id: 'q-patient',
    question: 'Quem é o paciente?',
    type: 'open', inputType: 'address', bindTo: 'patient', required: true, placeholder: '@paciente ou G...',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-price',
    question: 'Quanto custa cada sessão?',
    type: 'open', inputType: 'amount', bindTo: 'sessionPrice', required: true, placeholder: '200',
  },
  {
    id: 'q-total',
    question: 'Quantas sessões compõem o pacote?',
    type: 'choice', bindTo: 'totalSessions', required: true,
    options: [
      { value: '4', label: '4 sessões', description: 'Pacote mensal' },
      { value: '8', label: '8 sessões', description: 'Bimestral / padrão' },
      { value: '12', label: '12 sessões', description: 'Trimestral' },
      { value: '24', label: '24 sessões', description: 'Acompanhamento semestral' },
    ],
  },
  {
    id: 'q-validity',
    question: 'Validade do pacote (meses)?',
    context: 'Sessões não usadas até essa data são reembolsadas automaticamente.',
    type: 'choice', bindTo: 'validityMonths', required: true,
    options: [
      { value: '3', label: '3 meses', description: 'Para pacotes pequenos' },
      { value: '6', label: '6 meses', description: 'Padrão' },
      { value: '12', label: '12 meses', description: 'Pacotes grandes / semanais' },
    ],
  },
];

const constructionContractQuestions: SCQuestion[] = [
  {
    id: 'q-contractor',
    question: 'Qual a construtora que vai executar a obra?',
    type: 'open', inputType: 'address', bindTo: 'contractor', required: true, placeholder: '@construtora ou G...',
  },
  {
    id: 'q-client',
    question: 'Quem é o contratante (dono da obra)?',
    type: 'open', inputType: 'address', bindTo: 'client', required: true, placeholder: '@cliente ou G...',
  },
  {
    id: 'q-engineer',
    question: 'Quem é o engenheiro responsável (CREA)?',
    context: 'Vai assinar cada marco concluído da obra.',
    type: 'open', inputType: 'address', bindTo: 'engineer', required: true, placeholder: '@eng_carlos ou G...',
  },
  {
    id: 'q-address',
    question: 'Qual o endereço da obra?',
    type: 'open', inputType: 'long_text', bindTo: 'workAddress', required: true,
    placeholder: 'Rua, número, lote, quadra, cidade — UF',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-total',
    question: 'Qual o valor total da obra?',
    type: 'open', inputType: 'amount', bindTo: 'totalValue', required: true, placeholder: '350000',
  },
  {
    id: 'q-milestones',
    question: 'Em quantos marcos físicos a obra será dividida?',
    context: 'Cada marco assinado pelo engenheiro libera uma parcela do total.',
    type: 'choice', bindTo: 'milestonesCount', required: true,
    options: [
      { value: '3', label: '3 marcos', description: 'Fundação, estrutura, acabamento' },
      { value: '5', label: '5 marcos', description: 'Granularidade padrão' },
      { value: '7', label: '7 marcos', description: 'Mais controle de fluxo' },
      { value: '10', label: '10 ou mais', description: 'Obras grandes ou condomínios' },
    ],
  },
  {
    id: 'q-retention',
    question: 'Qual o percentual de retenção de garantia?',
    context: 'Fica retido por 90 dias após habite-se para cobrir vícios construtivos.',
    type: 'choice', bindTo: 'retentionPct', required: true,
    options: [
      { value: '3', label: '3%', description: 'Obras menores ou de baixa complexidade' },
      { value: '5', label: '5%', description: 'Padrão de mercado' },
      { value: '10', label: '10%', description: 'Obras críticas / estruturais' },
    ],
  },
];

const architecturalProjectQuestions: SCQuestion[] = [
  {
    id: 'q-architect',
    question: 'Quem é o(a) arquiteto(a) (CAU)?',
    type: 'open', inputType: 'address', bindTo: 'architect', required: true, placeholder: '@arq_ana ou G...',
  },
  {
    id: 'q-client',
    question: 'Quem é o cliente?',
    type: 'open', inputType: 'address', bindTo: 'client', required: true, placeholder: '@cliente ou G...',
  },
  {
    id: 'q-description',
    question: 'Descreva o projeto a ser desenvolvido',
    type: 'open', inputType: 'long_text', bindTo: 'projectDescription', required: true,
    placeholder: 'Ex: Casa térrea de 180m² em condomínio fechado, 3 quartos, piscina',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-total',
    question: 'Qual o honorário total do projeto?',
    type: 'open', inputType: 'amount', bindTo: 'totalFee', required: true, placeholder: '25000',
  },
  {
    id: 'q-preliminary',
    question: 'Percentual do estudo preliminar?',
    type: 'choice', bindTo: 'preliminaryPct', required: true,
    options: [
      { value: '15', label: '15%', description: 'Estudo enxuto' },
      { value: '20', label: '20%', description: 'Padrão' },
      { value: '25', label: '25%', description: 'Estudo aprofundado com várias opções' },
    ],
  },
  {
    id: 'q-preproject',
    question: 'Percentual do anteprojeto?',
    type: 'choice', bindTo: 'preProjectPct', required: true,
    options: [
      { value: '30', label: '30%', description: 'Para projetos rápidos' },
      { value: '40', label: '40%', description: 'Padrão' },
      { value: '50', label: '50%', description: 'Projetos com plantas detalhadas' },
    ],
  },
  {
    id: 'q-executive',
    question: 'Percentual do executivo?',
    context: 'A soma das três fases deve dar 100%.',
    type: 'choice', bindTo: 'executivePct', required: true,
    options: [
      { value: '30', label: '30%', description: 'Detalhamento básico' },
      { value: '40', label: '40%', description: 'Padrão para aprovação' },
      { value: '50', label: '50%', description: 'Executivo completo com BIM' },
    ],
  },
];

const renovationMilestoneQuestions: SCQuestion[] = [
  {
    id: 'q-contractor',
    question: 'Quem é o empreiteiro?',
    type: 'open', inputType: 'address', bindTo: 'contractor', required: true, placeholder: '@empreiteiro ou G...',
  },
  {
    id: 'q-owner',
    question: 'Quem é o proprietário?',
    type: 'open', inputType: 'address', bindTo: 'owner', required: true, placeholder: '@cliente ou G...',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-total',
    question: 'Qual o valor total da reforma?',
    type: 'open', inputType: 'amount', bindTo: 'totalValue', required: true, placeholder: '18000',
  },
  {
    id: 'q-stages',
    question: 'Em quantas etapas a reforma será dividida?',
    type: 'choice', bindTo: 'stagesCount', required: true,
    options: [
      { value: '3', label: '3 etapas', description: 'Reforma pequena' },
      { value: '4', label: '4 etapas', description: 'Demolição, hidráulica, elétrica, acabamento' },
      { value: '6', label: '6 etapas', description: 'Reformas extensas' },
    ],
  },
  {
    id: 'q-deadline',
    question: 'Prazo total da reforma (dias)?',
    type: 'choice', bindTo: 'deadlineDays', required: true,
    options: [
      { value: '30', label: '30 dias', description: 'Reforma rápida (pintura, pequenos reparos)' },
      { value: '60', label: '60 dias', description: 'Padrão para reforma de cozinha/banheiro' },
      { value: '120', label: '120 dias', description: 'Reforma estrutural' },
      { value: '180', label: '180 dias', description: 'Reforma completa de imóvel' },
    ],
  },
];

const vehicleSaleQuestions: SCQuestion[] = [
  {
    id: 'q-seller',
    question: 'Quem está vendendo o veículo?',
    type: 'open', inputType: 'address', bindTo: 'seller', required: true, placeholder: '@vendedor ou G...',
  },
  {
    id: 'q-buyer',
    question: 'Quem está comprando?',
    type: 'open', inputType: 'address', bindTo: 'buyer', required: true, placeholder: '@comprador ou G...',
  },
  {
    id: 'q-vehicle',
    question: 'Qual o veículo? (modelo, ano, cor)',
    type: 'open', inputType: 'text', bindTo: 'vehicleDescription', required: true,
    placeholder: 'Honda Civic LX 2020 prata',
  },
  {
    id: 'q-plate',
    question: 'Qual a placa?',
    type: 'open', inputType: 'text', bindTo: 'plate', required: true, placeholder: 'ABC1D23',
  },
  {
    id: 'q-renavam',
    question: 'Qual o RENAVAM?',
    type: 'open', inputType: 'text', bindTo: 'renavam', required: true, placeholder: '00123456789',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-price',
    question: 'Qual o valor da venda?',
    type: 'open', inputType: 'amount', bindTo: 'price', required: true, placeholder: '75000',
  },
  {
    id: 'q-deadline',
    question: 'Prazo para transferência no Detran (dias)?',
    context: 'O valor só é liberado quando o oráculo confirmar o novo CRLV-e no nome do comprador.',
    type: 'choice', bindTo: 'transferDeadline', required: true,
    options: [
      { value: '15', label: '15 dias', description: 'Quando ambos moram na mesma cidade' },
      { value: '30', label: '30 dias', description: 'Padrão para venda entre estados' },
      { value: '60', label: '60 dias', description: 'Venda interestadual com leilão prévio' },
    ],
  },
];

const vehicleLeaseQuestions: SCQuestion[] = [
  {
    id: 'q-lender',
    question: 'Quem financia (credor)?',
    type: 'open', inputType: 'address', bindTo: 'lender', required: true, placeholder: '@financeira ou G...',
  },
  {
    id: 'q-buyer',
    question: 'Quem é o comprador?',
    type: 'open', inputType: 'address', bindTo: 'buyer', required: true, placeholder: '@comprador ou G...',
  },
  {
    id: 'q-plate',
    question: 'Qual a placa do veículo financiado?',
    type: 'open', inputType: 'text', bindTo: 'plate', required: true, placeholder: 'XYZ9A87',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-down',
    question: 'Qual o valor da entrada?',
    type: 'open', inputType: 'amount', bindTo: 'downPayment', required: true, placeholder: '10000',
  },
  {
    id: 'q-installment',
    question: 'Qual o valor de cada parcela?',
    type: 'open', inputType: 'amount', bindTo: 'monthlyInstallment', required: true, placeholder: '1200',
  },
  {
    id: 'q-count',
    question: 'Quantas parcelas?',
    type: 'choice', bindTo: 'installmentsCount', required: true,
    options: [
      { value: '24', label: '24 meses', description: 'Financiamento curto' },
      { value: '36', label: '36 meses', description: 'Padrão para CDC' },
      { value: '48', label: '48 meses', description: 'Padrão para zero-km' },
      { value: '60', label: '60 meses', description: 'Prazo máximo' },
    ],
  },
  {
    id: 'q-rate',
    question: 'Qual a taxa de juros mensal (% a.m.)?',
    type: 'open', inputType: 'number', bindTo: 'interestRate', required: true, placeholder: '1.5',
  },
];

const carRentalDailyQuestions: SCQuestion[] = [
  {
    id: 'q-company',
    question: 'Qual a locadora?',
    type: 'open', inputType: 'address', bindTo: 'rental_company', required: true, placeholder: '@locadora ou G...',
  },
  {
    id: 'q-renter',
    question: 'Quem é o locatário?',
    type: 'open', inputType: 'address', bindTo: 'renter', required: true, placeholder: '@cliente ou G...',
  },
  {
    id: 'q-plate',
    question: 'Qual a placa do veículo?',
    type: 'open', inputType: 'text', bindTo: 'plate', required: true, placeholder: 'ABC1234',
  },
  {
    id: 'q-pickup',
    question: 'Data da retirada?',
    type: 'open', inputType: 'date', bindTo: 'pickupDate', required: true,
  },
  {
    id: 'q-days',
    question: 'Quantos dias de locação?',
    type: 'choice', bindTo: 'rentalDays', required: true,
    options: [
      { value: '1', label: '1 dia', description: 'Diária curta' },
      { value: '3', label: '3 dias', description: 'Fim de semana' },
      { value: '7', label: '7 dias', description: 'Semana de férias' },
      { value: '15', label: '15 dias', description: 'Mês de viagem' },
      { value: '30', label: '30 dias', description: 'Mensal corporativo' },
    ],
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-rate',
    question: 'Qual o valor da diária?',
    type: 'open', inputType: 'amount', bindTo: 'dailyRate', required: true, placeholder: '180',
  },
  {
    id: 'q-deposit',
    question: 'Qual o valor da caução?',
    context: 'Devolvida integralmente se não houver dano no carro.',
    type: 'open', inputType: 'amount', bindTo: 'depositAmount', required: true, placeholder: '1000',
  },
];

const realEstateTokenQuestions: SCQuestion[] = [
  {
    id: 'q-sponsor',
    question: 'Quem é o emissor / proprietário do imóvel?',
    type: 'open', inputType: 'address', bindTo: 'sponsor', required: true, placeholder: '@dono ou G...',
  },
  {
    id: 'q-address',
    question: 'Endereço completo do imóvel?',
    type: 'open', inputType: 'long_text', bindTo: 'propertyAddress', required: true,
    placeholder: 'Rua, número, apto, cidade — UF',
  },
  {
    id: 'q-matricula',
    question: 'Qual o número da matrícula no RGI?',
    context: 'Registro Geral de Imóveis — vincula o token ao imóvel real.',
    type: 'open', inputType: 'text', bindTo: 'matricula', required: true, placeholder: 'Ex: 12.345',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda os aluguéis serão distribuídos?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-total',
    question: 'Em quantas cotas o imóvel será fracionado?',
    context: 'Quanto mais cotas, menor o ticket mínimo de investimento.',
    type: 'choice', bindTo: 'totalShares', required: true,
    options: [
      { value: '100', label: '100 cotas', description: 'Tickets maiores, menos sócios' },
      { value: '500', label: '500 cotas', description: 'Equilíbrio padrão' },
      { value: '1000', label: '1.000 cotas', description: 'Tickets acessíveis' },
      { value: '10000', label: '10.000 cotas', description: 'Crowdfunding em larga escala' },
    ],
  },
  {
    id: 'q-price',
    question: 'Qual o preço de cada cota?',
    type: 'open', inputType: 'amount', bindTo: 'sharePrice', required: true, placeholder: '500',
  },
  {
    id: 'q-rent',
    question: 'Qual o aluguel mensal estimado do imóvel?',
    context: 'Esse valor será distribuído pro-rata entre os cotistas a cada mês.',
    type: 'open', inputType: 'amount', bindTo: 'monthlyRent', required: true, placeholder: '4500',
  },
];

const commodityTokenQuestions: SCQuestion[] = [
  {
    id: 'q-farmer',
    question: 'Quem é o produtor rural?',
    type: 'open', inputType: 'address', bindTo: 'farmer', required: true, placeholder: '@produtor ou G...',
  },
  {
    id: 'q-commodity',
    question: 'Qual a commodity?',
    type: 'choice', bindTo: 'commodityType', required: true,
    options: [
      { value: 'Soja', label: 'Soja', description: 'Unidade: saca de 60kg' },
      { value: 'Milho', label: 'Milho', description: 'Unidade: saca de 60kg' },
      { value: 'Café', label: 'Café', description: 'Unidade: saca de 60kg' },
      { value: 'Boi gordo', label: 'Boi gordo', description: 'Unidade: cabeça' },
      { value: 'Algodão', label: 'Algodão', description: 'Unidade: arroba' },
    ],
  },
  {
    id: 'q-units',
    question: 'Quantas unidades serão emitidas?',
    context: 'Cada token representa 1 unidade (1 saca, 1 cabeça, etc).',
    type: 'open', inputType: 'number', bindTo: 'totalUnits', required: true, placeholder: '1000',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda os tokens serão vendidos?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-price',
    question: 'Preço de cada unidade (token)?',
    type: 'open', inputType: 'amount', bindTo: 'unitPrice', required: true, placeholder: '150',
  },
  {
    id: 'q-harvest',
    question: 'Quando é a colheita prevista?',
    type: 'open', inputType: 'date', bindTo: 'harvestDate', required: true,
  },
  {
    id: 'q-location',
    question: 'Onde fica a fazenda?',
    type: 'open', inputType: 'long_text', bindTo: 'farmLocation', required: true,
    placeholder: 'Fazenda Boa Vista, Sorriso — MT',
  },
];

const carbonCreditsQuestions: SCQuestion[] = [
  {
    id: 'q-owner',
    question: 'Quem é o dono do projeto de carbono?',
    type: 'open', inputType: 'address', bindTo: 'projectOwner', required: true, placeholder: '@projeto ou G...',
  },
  {
    id: 'q-verifier',
    question: 'Qual a certificadora que valida os créditos?',
    context: 'Verifica que as toneladas reportadas foram realmente capturadas/removidas.',
    type: 'open', inputType: 'address', bindTo: 'verifier', required: true, placeholder: '@verra ou G...',
  },
  {
    id: 'q-type',
    question: 'Qual o tipo de projeto?',
    type: 'choice', bindTo: 'projectType', required: true,
    options: [
      { value: 'Reflorestamento', label: 'Reflorestamento', description: 'Plantio e manejo de florestas' },
      { value: 'Energia eólica', label: 'Eólica', description: 'Substituição de matriz fóssil' },
      { value: 'Solar', label: 'Solar', description: 'Geração renovável' },
      { value: 'Biogás', label: 'Biogás', description: 'Captura de metano em aterros/granjas' },
      { value: 'Conservação', label: 'Conservação', description: 'Proteção de áreas nativas (REDD+)' },
    ],
  },
  {
    id: 'q-location',
    question: 'Onde fica o projeto?',
    type: 'open', inputType: 'long_text', bindTo: 'projectLocation', required: true,
    placeholder: 'Amazônia legal, município X, Pará',
  },
  {
    id: 'q-tons',
    question: 'Quantas toneladas de CO₂ o projeto deve capturar/evitar?',
    type: 'open', inputType: 'number', bindTo: 'totalTons', required: true, placeholder: '10000',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda os créditos serão vendidos?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_USD_FIRST,
  },
  {
    id: 'q-price',
    question: 'Qual o preço por tonelada de CO₂?',
    type: 'open', inputType: 'amount', bindTo: 'pricePerTon', required: true, placeholder: '15',
  },
];

const solarYieldTokenQuestions: SCQuestion[] = [
  {
    id: 'q-operator',
    question: 'Quem é o operador da usina?',
    type: 'open', inputType: 'address', bindTo: 'operator', required: true, placeholder: '@solar_co ou G...',
  },
  {
    id: 'q-location',
    question: 'Onde está localizada a usina?',
    type: 'open', inputType: 'long_text', bindTo: 'plantLocation', required: true,
    placeholder: 'Petrolina — PE',
  },
  {
    id: 'q-capacity',
    question: 'Capacidade instalada (kWp)?',
    type: 'open', inputType: 'number', bindTo: 'installedCapacityKw', required: true, placeholder: '50',
  },
  {
    id: 'q-monthly',
    question: 'Geração mensal estimada (kWh)?',
    type: 'open', inputType: 'number', bindTo: 'expectedMonthlyKwh', required: true, placeholder: '6000',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda os investidores recebem?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-shares',
    question: 'Em quantas cotas o projeto é fracionado?',
    type: 'choice', bindTo: 'totalShares', required: true,
    options: [
      { value: '100', label: '100 cotas', description: 'Investidores qualificados' },
      { value: '500', label: '500 cotas', description: 'Crowdfunding equilibrado' },
      { value: '1000', label: '1.000 cotas', description: 'Tickets pequenos' },
    ],
  },
  {
    id: 'q-price',
    question: 'Preço de cada cota?',
    type: 'open', inputType: 'amount', bindTo: 'sharePrice', required: true, placeholder: '200',
  },
];

const birthRegistryQuestions: SCQuestion[] = [
  {
    id: 'q-registrar',
    question: 'Qual o cartório de Registro Civil?',
    type: 'open', inputType: 'address', bindTo: 'registrar', required: true, placeholder: '@cartorio ou G...',
  },
  {
    id: 'q-mother',
    question: 'Quem é a mãe (carteira)?',
    type: 'open', inputType: 'address', bindTo: 'motherWallet', required: true, placeholder: '@mae ou G...',
  },
  {
    id: 'q-father',
    question: 'Quem é o pai (carteira)? (opcional)',
    context: 'Pode ficar em branco em caso de registro sem paternidade declarada.',
    type: 'open', inputType: 'address', bindTo: 'fatherWallet', placeholder: '@pai ou G...',
  },
  {
    id: 'q-name',
    question: 'Qual o nome completo do bebê?',
    type: 'open', inputType: 'text', bindTo: 'childName', required: true,
    placeholder: 'Ex: João Pedro Silva Oliveira',
  },
  {
    id: 'q-date',
    question: 'Data do nascimento?',
    type: 'open', inputType: 'date', bindTo: 'birthDate', required: true,
  },
  {
    id: 'q-hospital',
    question: 'Em que hospital ou local nasceu?',
    type: 'open', inputType: 'long_text', bindTo: 'hospital', required: true,
    placeholder: 'Hospital Albert Einstein, São Paulo — SP',
  },
  {
    id: 'q-dnv',
    question: 'Qual o número da DNV (Declaração de Nascido Vivo)?',
    type: 'open', inputType: 'text', bindTo: 'dnvNumber', required: true, placeholder: 'Ex: 1234567-89',
  },
];

const marriageContractQuestions: SCQuestion[] = [
  {
    id: 'q-partner1',
    question: 'Quem é o(a) primeiro(a) cônjuge?',
    type: 'open', inputType: 'address', bindTo: 'partner_1', required: true, placeholder: '@conjuge1 ou G...',
  },
  {
    id: 'q-partner2',
    question: 'Quem é o(a) segundo(a) cônjuge?',
    type: 'open', inputType: 'address', bindTo: 'partner_2', required: true, placeholder: '@conjuge2 ou G...',
  },
  {
    id: 'q-registrar',
    question: 'Qual o cartório ou tabelião responsável?',
    type: 'open', inputType: 'address', bindTo: 'registrar', required: true, placeholder: '@cartorio ou G...',
  },
  {
    id: 'q-type',
    question: 'Qual o tipo de união?',
    type: 'choice', bindTo: 'unionType', required: true,
    options: [
      { value: 'Casamento civil', label: 'Casamento civil', description: 'Oficial perante o cartório' },
      { value: 'União estável', label: 'União estável', description: 'Convivência reconhecida' },
      { value: 'Pacto antenupcial', label: 'Pacto antenupcial', description: 'Registro prévio do regime' },
    ],
  },
  {
    id: 'q-regime',
    question: 'Qual o regime de bens?',
    type: 'choice', bindTo: 'propertyRegime', required: true,
    options: [
      { value: 'Comunhão parcial', label: 'Comunhão parcial', description: 'Bens adquiridos durante o casamento são comuns (padrão)' },
      { value: 'Comunhão total', label: 'Comunhão total', description: 'Tudo se comunica, antes e depois do casamento' },
      { value: 'Separação total', label: 'Separação total', description: 'Cada um mantém seus bens' },
      { value: 'Participação final', label: 'Participação final', description: 'Regime híbrido — partilha só na dissolução' },
    ],
  },
  {
    id: 'q-date',
    question: 'Data da celebração?',
    type: 'open', inputType: 'date', bindTo: 'ceremonyDate', required: true,
  },
];

const divorceSettlementQuestions: SCQuestion[] = [
  {
    id: 'q-spouse1',
    question: 'Quem é o(a) primeiro(a) cônjuge?',
    type: 'open', inputType: 'address', bindTo: 'spouse_1', required: true, placeholder: '@ex1 ou G...',
  },
  {
    id: 'q-spouse2',
    question: 'Quem é o(a) segundo(a) cônjuge?',
    type: 'open', inputType: 'address', bindTo: 'spouse_2', required: true, placeholder: '@ex2 ou G...',
  },
  {
    id: 'q-lawyer',
    question: 'Quem é o(a) advogado(a) que assistiu o acordo?',
    type: 'open', inputType: 'address', bindTo: 'lawyer', required: true, placeholder: '@dr_silva ou G...',
  },
  {
    id: 'q-property',
    question: 'Descreva a partilha de bens',
    context: 'Como ficam os bens (imóveis, veículos, contas) entre os cônjuges.',
    type: 'open', inputType: 'long_text', bindTo: 'propertyDivision', required: true,
    placeholder: 'Imóvel X fica com cônjuge 1, veículo Y com cônjuge 2, contas conjuntas divididas 50/50…',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda a pensão será paga?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-alimony',
    question: 'Qual o valor mensal da pensão? (use 0 se não houver)',
    type: 'open', inputType: 'amount', bindTo: 'alimonyAmount', required: true, placeholder: '1500',
  },
  {
    id: 'q-payer',
    question: 'Quem paga a pensão?',
    type: 'choice', bindTo: 'alimonyPayer', required: true,
    options: [
      { value: 'Cônjuge 1', label: 'Cônjuge 1', description: 'Primeiro cônjuge listado paga' },
      { value: 'Cônjuge 2', label: 'Cônjuge 2', description: 'Segundo cônjuge listado paga' },
      { value: 'Nenhum', label: 'Nenhum', description: 'Sem pensão alimentícia' },
    ],
  },
  {
    id: 'q-duration',
    question: 'Por quantos meses a pensão deve ser paga?',
    context: 'Use 999 para indeterminada (até nova ordem judicial).',
    type: 'choice', bindTo: 'alimonyDurationMonths', required: true,
    options: [
      { value: '12', label: '12 meses', description: 'Pensão de transição' },
      { value: '24', label: '24 meses', description: 'Recuperação financeira' },
      { value: '60', label: '60 meses', description: 'Pensão de longo prazo' },
      { value: '999', label: 'Indeterminada', description: 'Filhos menores ou incapazes' },
    ],
  },
];

const deathCertificateQuestions: SCQuestion[] = [
  {
    id: 'q-registrar',
    question: 'Qual o cartório?',
    type: 'open', inputType: 'address', bindTo: 'registrar', required: true, placeholder: '@cartorio ou G...',
  },
  {
    id: 'q-doctor',
    question: 'Qual o médico atestante (CRM)?',
    type: 'open', inputType: 'address', bindTo: 'doctor', required: true, placeholder: '@dr_medico ou G...',
  },
  {
    id: 'q-name',
    question: 'Qual o nome completo do(a) falecido(a)?',
    type: 'open', inputType: 'text', bindTo: 'deceasedName', required: true,
    placeholder: 'Ex: João Pedro Silva',
  },
  {
    id: 'q-wallet',
    question: 'Qual a carteira do(a) falecido(a)? (opcional)',
    context: 'Se informada, o contrato bloqueia automaticamente operações nessa carteira.',
    type: 'open', inputType: 'address', bindTo: 'deceasedWallet', placeholder: '@falecido ou G...',
  },
  {
    id: 'q-date',
    question: 'Data e hora do óbito?',
    type: 'open', inputType: 'date', bindTo: 'deathDate', required: true,
  },
  {
    id: 'q-cause',
    question: 'Causa do óbito (CID-10)?',
    type: 'open', inputType: 'text', bindTo: 'causeOfDeath', required: true,
    placeholder: 'Ex: I46 — Parada cardíaca',
  },
  {
    id: 'q-place',
    question: 'Local do óbito?',
    type: 'open', inputType: 'long_text', bindTo: 'placeOfDeath', required: true,
    placeholder: 'Hospital ou endereço completo',
  },
  {
    id: 'q-do',
    question: 'Qual o número da DO (Declaração de Óbito)?',
    type: 'open', inputType: 'text', bindTo: 'doNumber', required: true, placeholder: 'Ex: 9876543-21',
  },
];

const notarizedDeclarationQuestions: SCQuestion[] = [
  {
    id: 'q-declarant',
    question: 'Quem é o(a) declarante?',
    type: 'open', inputType: 'address', bindTo: 'declarant', required: true, placeholder: '@declarante ou G...',
  },
  {
    id: 'q-notary',
    question: 'Qual o tabelião que confere fé pública?',
    type: 'open', inputType: 'address', bindTo: 'notary', required: true, placeholder: '@cartorio ou G...',
  },
  {
    id: 'q-beneficiary',
    question: 'Quem é o beneficiário? (opcional)',
    context: 'Aplicável a procurações, autorizações, etc.',
    type: 'open', inputType: 'address', bindTo: 'beneficiary', placeholder: '@beneficiario ou G...',
  },
  {
    id: 'q-type',
    question: 'Qual o tipo de declaração?',
    type: 'choice', bindTo: 'declarationType', required: true,
    options: [
      { value: 'Procuração', label: 'Procuração', description: 'Conferir poderes a terceiro' },
      { value: 'Residência', label: 'Residência', description: 'Comprovar endereço' },
      { value: 'Autorização de viagem', label: 'Autorização viagem', description: 'Para menor desacompanhado' },
      { value: 'Anuência', label: 'Anuência', description: 'Concordância de cônjuge/herdeiro' },
      { value: 'Outra', label: 'Outra', description: 'Declaração genérica com fé pública' },
    ],
  },
  {
    id: 'q-text',
    question: 'Qual o texto da declaração?',
    context: 'Conteúdo que está sendo declarado. Será o que fica selado on-chain.',
    type: 'open', inputType: 'long_text', bindTo: 'declarationText', required: true,
    placeholder: 'Ex: Declaro para os devidos fins que…',
  },
  {
    id: 'q-validity',
    question: 'Até quando essa declaração é válida?',
    context: 'Deixe em branco para validade indeterminada.',
    type: 'open', inputType: 'date', bindTo: 'validityDate',
  },
];

const commercialRentQuestions: SCQuestion[] = [
  {
    id: 'q-landlord',
    question: 'Quem é o locador (dono do imóvel)?',
    type: 'open', inputType: 'address', bindTo: 'landlord', required: true, placeholder: '@imobiliaria ou G...',
  },
  {
    id: 'q-tenant',
    question: 'Quem é o locatário (empresa)?',
    type: 'open', inputType: 'address', bindTo: 'tenant', required: true, placeholder: '@empresa ou G...',
  },
  {
    id: 'q-cnpj',
    question: 'Qual o CNPJ do locatário?',
    type: 'open', inputType: 'text', bindTo: 'cnpj', required: true, placeholder: '00.000.000/0001-00',
  },
  {
    id: 'q-address',
    question: 'Endereço do imóvel?',
    type: 'open', inputType: 'long_text', bindTo: 'propertyAddress', required: true,
    placeholder: 'Endereço completo do estabelecimento',
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_BRL_USD,
  },
  {
    id: 'q-rent',
    question: 'Qual o aluguel mensal?',
    type: 'open', inputType: 'amount', bindTo: 'monthlyRent', required: true, placeholder: '3500',
  },
  {
    id: 'q-deposit',
    question: 'Caução em quantos aluguéis?',
    type: 'choice', bindTo: 'depositMonths', required: true,
    options: [
      { value: '2', label: '2 aluguéis', description: 'Para inquilinos PJ consolidados' },
      { value: '3', label: '3 aluguéis', description: 'Padrão' },
      { value: '6', label: '6 aluguéis', description: 'PJ nova ou ponto comercial premium' },
    ],
  },
  {
    id: 'q-duration',
    question: 'Duração do contrato (meses)?',
    type: 'choice', bindTo: 'durationMonths', required: true,
    options: [
      { value: '12', label: '12 meses', description: 'Locação anual' },
      { value: '36', label: '36 meses', description: 'Padrão para PME' },
      { value: '60', label: '60 meses', description: 'Padrão comercial / shopping' },
    ],
  },
  {
    id: 'q-penalty',
    question: 'Multa por rescisão antecipada (em aluguéis)?',
    type: 'choice', bindTo: 'penaltyMonths', required: true,
    options: [
      { value: '1', label: '1 aluguel', description: 'Multa simbólica' },
      { value: '3', label: '3 aluguéis', description: 'Padrão' },
      { value: '6', label: '6 aluguéis', description: 'Ponto comercial valioso' },
    ],
  },
];

const shortStayQuestions: SCQuestion[] = [
  {
    id: 'q-host',
    question: 'Quem é o anfitrião (dono do imóvel)?',
    type: 'open', inputType: 'address', bindTo: 'host', required: true, placeholder: '@anfitriao ou G...',
  },
  {
    id: 'q-guest',
    question: 'Quem é o hóspede?',
    type: 'open', inputType: 'address', bindTo: 'guest', required: true, placeholder: '@hospede ou G...',
  },
  {
    id: 'q-address',
    question: 'Onde fica a hospedagem?',
    type: 'open', inputType: 'long_text', bindTo: 'propertyAddress', required: true,
    placeholder: 'Endereço completo do imóvel',
  },
  {
    id: 'q-checkin',
    question: 'Data de check-in?',
    type: 'open', inputType: 'date', bindTo: 'checkInDate', required: true,
  },
  {
    id: 'q-nights',
    question: 'Quantas noites?',
    type: 'choice', bindTo: 'nightsCount', required: true,
    options: [
      { value: '1', label: '1 noite', description: 'Pernoite curto' },
      { value: '2', label: '2 noites', description: 'Fim de semana' },
      { value: '3', label: '3 noites', description: 'Feriado prolongado' },
      { value: '7', label: '7 noites', description: 'Semana de férias' },
      { value: '15', label: '15 noites', description: 'Estadia longa' },
      { value: '30', label: '30 noites', description: 'Aluguel mensal informal' },
    ],
  },
  {
    id: 'q-asset',
    question: 'Em que moeda?',
    type: 'choice', bindTo: 'asset', required: true, options: ASSET_OPTIONS_USD_FIRST,
  },
  {
    id: 'q-rate',
    question: 'Qual o valor da diária?',
    type: 'open', inputType: 'amount', bindTo: 'nightlyRate', required: true, placeholder: '80',
  },
  {
    id: 'q-cleaning',
    question: 'Qual a taxa de limpeza?',
    type: 'open', inputType: 'amount', bindTo: 'cleaningFee', required: true, placeholder: '30',
  },
  {
    id: 'q-deposit',
    question: 'Qual o valor da caução?',
    context: 'Devolvida no check-out se não houver dano ou regra violada.',
    type: 'open', inputType: 'amount', bindTo: 'depositAmount', required: true, placeholder: '200',
  },
];

// ─── Map principal ────────────────────────────────────────────────────

export const TEMPLATE_QUESTIONS: Record<string, SCQuestion[]> = {
  // Originais
  rent: rentQuestions,
  ecommerce: ecommerceQuestions,
  freelancer: freelancerQuestions,
  payroll: payrollQuestions,
  royalties: royaltiesQuestions,
  factoring: factoringQuestions,
  founder_vesting: founderVestingQuestions,
  fixed_yield: fixedYieldQuestions,
  group_buy: groupBuyQuestions,
  parametric_insurance: parametricInsuranceQuestions,

  // Profissional
  legal_fees: legalFeesQuestions,
  medical_consultation: medicalConsultationQuestions,
  dental_treatment: dentalTreatmentQuestions,
  accounting_services: accountingServicesQuestions,
  psychology_package: psychologyPackageQuestions,

  // Construção
  construction_contract: constructionContractQuestions,
  architectural_project: architecturalProjectQuestions,
  renovation_milestone: renovationMilestoneQuestions,

  // Veículos
  vehicle_sale: vehicleSaleQuestions,
  vehicle_lease: vehicleLeaseQuestions,
  car_rental_daily: carRentalDailyQuestions,

  // RWA
  real_estate_token: realEstateTokenQuestions,
  commodity_token: commodityTokenQuestions,
  carbon_credits: carbonCreditsQuestions,
  solar_yield_token: solarYieldTokenQuestions,

  // Registros
  birth_registry: birthRegistryQuestions,
  marriage_contract: marriageContractQuestions,
  divorce_settlement: divorceSettlementQuestions,
  death_certificate: deathCertificateQuestions,
  notarized_declaration: notarizedDeclarationQuestions,

  // Imóveis adicionais
  commercial_rent: commercialRentQuestions,
  short_stay: shortStayQuestions,
};

/**
 * Retorna as perguntas de um template, ou uma lista derivada das variables
 * caso ainda não tenha questionário definido.
 */
export function getQuestionsForTemplate(templateId: string): SCQuestion[] {
  return TEMPLATE_QUESTIONS[templateId] ?? [];
}
