/**
 * Template Engine Service
 * Motor de templates para contratos com suporte a:
 * - Variáveis dinâmicas ({{variavel}})
 * - Lógica condicional ({{#if}} ... {{/if}})
 * - Iteradores ({{#each}} ... {{/each}})
 * - Formatação de data e moeda
 */

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'select' | 'boolean';
  defaultValue?: string;
  options?: string[]; // for select type
  required?: boolean;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  content: string;              // Template string with {{variables}}
  clauses: TemplateClause[];
  variables: TemplateVariable[];
  tags: string[];
  rating: number;
  usageCount: number;
  author: string;
  language: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFeatured: boolean;
}

export interface TemplateClause {
  order: number;
  title: string;
  content: string; // Can contain {{variables}}
  conditional?: string; // Variable name that controls visibility
}

/**
 * Merge template variables into template content
 */
export function mergeVariables(template: string, variables: Record<string, string>): string {
  let result = template;

  // Replace simple variables: {{variableName}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] ?? `{{${key}}}`;
  });

  // Process conditionals: {{#if condition}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => {
      const val = variables[key];
      if (val && val !== 'false' && val !== '0' && val !== '') {
        return content;
      }
      return '';
    }
  );

  // Process {{#unless condition}}...{{/unless}}
  result = result.replace(
    /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_, key, content) => {
      const val = variables[key];
      if (!val || val === 'false' || val === '0' || val === '') {
        return content;
      }
      return '';
    }
  );

  // Clean up extra whitespace
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Extract variable names from template content
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const vars = new Set<string>();
  for (const match of matches) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

/**
 * Format a value based on its type
 */
export function formatValue(value: string, type: TemplateVariable['type']): string {
  switch (type) {
    case 'date': {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
    }
    case 'currency': {
      const n = parseFloat(value);
      return isNaN(n) ? value : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    case 'number': {
      const n = parseFloat(value);
      return isNaN(n) ? value : n.toLocaleString('pt-BR');
    }
    default:
      return value;
  }
}

/**
 * Predefined contract templates (Marketplace)
 */
export const BUILTIN_TEMPLATES: ContractTemplate[] = [
  {
    id: 'tpl-servico-01',
    name: 'Prestação de Serviços',
    description: 'Contrato padrão para prestação de serviços profissionais com cláusulas de confidencialidade e penalidades.',
    category: 'servico',
    icon: 'solar:case-bold-duotone',
    content: '',
    clauses: [
      {
        order: 1,
        title: 'Objeto do Contrato',
        content: 'O(a) CONTRATADO(A), {{nomeContratado}}, compromete-se a prestar os seguintes serviços ao CONTRATANTE, {{nomeContratante}}: {{descricaoServico}}.',
      },
      {
        order: 2,
        title: 'Valor e Forma de Pagamento',
        content: 'Pela prestação dos serviços descritos, o CONTRATANTE pagará ao CONTRATADO o valor de {{valor}}, a ser pago {{formaPagamento}}.',
      },
      {
        order: 3,
        title: 'Prazo de Vigência',
        content: 'O presente contrato terá vigência de {{prazoVigencia}}, com início em {{dataInicio}} e término previsto para {{dataTermino}}.',
      },
      {
        order: 4,
        title: 'Obrigações do Contratado',
        content: 'O CONTRATADO se obriga a: (a) executar os serviços com diligência e qualidade profissional; (b) cumprir os prazos estabelecidos; (c) manter sigilo sobre as informações confidenciais do CONTRATANTE.',
      },
      {
        order: 5,
        title: 'Rescisão',
        content: 'O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de {{avisoPrevio}} dias, sem prejuízo das obrigações já assumidas.',
      },
      {
        order: 6,
        title: 'Confidencialidade',
        content: 'As partes comprometem-se a manter estrita confidencialidade sobre todas as informações trocadas durante a execução deste contrato, por um período de {{periodoConfidencialidade}} após o término.',
        conditional: 'incluirNDA',
      },
    ],
    variables: [
      { name: 'nomeContratante', label: 'Nome do Contratante', type: 'text', required: true },
      { name: 'nomeContratado', label: 'Nome do Contratado', type: 'text', required: true },
      { name: 'descricaoServico', label: 'Descrição do Serviço', type: 'text', required: true },
      { name: 'valor', label: 'Valor do Contrato', type: 'currency', required: true },
      { name: 'formaPagamento', label: 'Forma de Pagamento', type: 'select', options: ['à vista', 'em 2x', 'em 3x', 'mensal'] },
      { name: 'prazoVigencia', label: 'Prazo de Vigência', type: 'text', defaultValue: '12 meses' },
      { name: 'dataInicio', label: 'Data de Início', type: 'date', required: true },
      { name: 'dataTermino', label: 'Data de Término', type: 'date', required: true },
      { name: 'avisoPrevio', label: 'Aviso Prévio (dias)', type: 'number', defaultValue: '30' },
      { name: 'incluirNDA', label: 'Incluir Cláusula de NDA?', type: 'boolean', defaultValue: 'true' },
      { name: 'periodoConfidencialidade', label: 'Período de Confidencialidade', type: 'text', defaultValue: '2 anos' },
    ],
    tags: ['serviço', 'profissional', 'prestação'],
    rating: 4.8,
    usageCount: 1240,
    author: 'ContractEase',
    language: 'pt-BR',
    version: 3,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-04-20T00:00:00Z',
    isPublic: true,
    isFeatured: true,
  },
  {
    id: 'tpl-uniao-01',
    name: 'Declaração de União Estável',
    description: 'Documento formal para reconhecimento público de convivência duradoura e constituição familiar.',
    category: 'family',
    icon: 'solar:hearts-bold-duotone',
    content: '',
    clauses: [
      {
        order: 1,
        title: 'Declaração',
        content: 'Os DECLARANTES, {{declarante1}} e {{declarante2}}, declaram sob as penas da lei que convivem em união estável desde {{dataInicio}}.',
      },
      {
        order: 2,
        title: 'Regime de Bens',
        content: 'Acordam que a união será regida pelo regime de {{regimeBens}}.',
      },
      {
        order: 3,
        title: 'Residência',
        content: 'O casal reside atualmente no endereço: {{endereco}}.',
      },
    ],
    variables: [
      { name: 'declarante1', label: 'Nome do Declarante 1', type: 'text', required: true },
      { name: 'declarante2', label: 'Nome do Declarante 2', type: 'text', required: true },
      { name: 'dataInicio', label: 'Data de Início da União', type: 'date', required: true },
      { name: 'regimeBens', label: 'Regime de Bens', type: 'select', options: ['Comunhão Parcial de Bens', 'Comunhão Universal de Bens', 'Separação Total de Bens'], defaultValue: 'Comunhão Parcial de Bens' },
      { name: 'endereco', label: 'Endereço de Convivência', type: 'text', required: true },
    ],
    tags: ['família', 'união estável', 'declaração'],
    rating: 4.9,
    usageCount: 3100,
    author: 'ContractEase',
    language: 'pt-BR',
    version: 1,
    createdAt: '2025-02-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    isPublic: true,
    isFeatured: true,
  },
  {
    id: 'tpl-compra-01',
    name: 'Promessa de Compra e Venda',
    description: 'Contrato preliminar para promessa de compra e venda de imóvel residencial ou comercial.',
    category: 'real_estate',
    icon: 'solar:buildings-bold-duotone',
    content: '',
    clauses: [
      {
        order: 1,
        title: 'Objeto',
        content: 'O PROMITENTE VENDEDOR, {{vendedor}}, compromete-se a vender ao PROMISSÁRIO COMPRADOR, {{comprador}}, o imóvel situado em {{enderecoImovel}}.',
      },
      {
        order: 2,
        title: 'Preço e Condições',
        content: 'O valor total acordado é de {{valorImovel}}, a ser pago da seguinte forma: Sinal de {{valorSinal}} na assinatura, e o restante em {{parcelas}} parcelas.',
      },
      {
        order: 3,
        title: 'Posse e Escritura',
        content: 'A posse do imóvel será transferida em {{dataPosse}} e a escritura definitiva será outorgada após a quitação total.',
      },
    ],
    variables: [
      { name: 'vendedor', label: 'Nome do Vendedor', type: 'text', required: true },
      { name: 'comprador', label: 'Nome do Comprador', type: 'text', required: true },
      { name: 'enderecoImovel', label: 'Endereço do Imóvel', type: 'text', required: true },
      { name: 'valorImovel', label: 'Valor Total', type: 'currency', required: true },
      { name: 'valorSinal', label: 'Valor do Sinal', type: 'currency', required: true },
      { name: 'parcelas', label: 'Número de Parcelas', type: 'number', defaultValue: '12' },
      { name: 'dataPosse', label: 'Data de Transferência da Posse', type: 'date', required: true },
    ],
    tags: ['imóvel', 'compra e venda', 'promessa'],
    rating: 4.8,
    usageCount: 1890,
    author: 'ContractEase',
    language: 'pt-BR',
    version: 1,
    createdAt: '2025-03-10T00:00:00Z',
    updatedAt: '2025-03-10T00:00:00Z',
    isPublic: true,
    isFeatured: true,
  },
  {
    id: 'tpl-emprego-01',
    name: 'Contrato de Trabalho',
    description: 'Contrato individual de trabalho por prazo determinado ou indeterminado com todas as cláusulas CLT.',
    category: 'employment',
    icon: 'solar:user-id-bold-duotone',
    content: '',
    clauses: [
      {
        order: 1,
        title: 'Objeto',
        content: 'O EMPREGADOR, {{empregador}}, contrata o EMPREGADO, {{empregado}}, para exercer a função de {{funcao}}, com jornada de {{jornada}} horas semanais.',
      },
      {
        order: 2,
        title: 'Remuneração',
        content: 'O EMPREGADO receberá a remuneração mensal de {{salario}}, paga até o 5º dia útil de cada mês.',
      },
      {
        order: 3,
        title: 'Vigência',
        content: 'O contrato terá início em {{dataAdmissao}} com prazo {{tipoPrazo}}.',
      },
      {
        order: 4,
        title: 'Benefícios',
        content: 'O EMPREGADO terá direito a: vale-transporte, vale-refeição no valor de {{valeRefeicao}}, plano de saúde{{#if incluirPLR}}, e participação nos lucros e resultados (PLR) conforme política interna{{/if}}.',
      },
    ],
    variables: [
      { name: 'empregador', label: 'Razão Social do Empregador', type: 'text', required: true },
      { name: 'empregado', label: 'Nome do Empregado', type: 'text', required: true },
      { name: 'funcao', label: 'Função/Cargo', type: 'text', required: true },
      { name: 'jornada', label: 'Jornada Semanal (horas)', type: 'number', defaultValue: '44' },
      { name: 'salario', label: 'Salário Mensal', type: 'currency', required: true },
      { name: 'dataAdmissao', label: 'Data de Admissão', type: 'date', required: true },
      { name: 'tipoPrazo', label: 'Tipo de Prazo', type: 'select', options: ['indeterminado', 'determinado - 90 dias', 'determinado - 180 dias'] },
      { name: 'valeRefeicao', label: 'Valor do Vale-Refeição', type: 'currency', defaultValue: '800' },
      { name: 'incluirPLR', label: 'Incluir PLR?', type: 'boolean', defaultValue: 'false' },
    ],
    tags: ['emprego', 'CLT', 'trabalho'],
    rating: 4.7,
    usageCount: 670,
    author: 'ContractEase',
    language: 'pt-BR',
    version: 1,
    createdAt: '2025-04-01T00:00:00Z',
    updatedAt: '2025-04-01T00:00:00Z',
    isPublic: true,
    isFeatured: true,
  },
  {
    id: 'tpl-locacao-01',
    name: 'Contrato de Locação',
    description: 'Contrato de aluguel residencial ou comercial conforme Lei do Inquilinato.',
    category: 'rental',
    icon: 'solar:home-bold-duotone',
    content: '',
    clauses: [
      {
        order: 1,
        title: 'Objeto da Locação',
        content: 'O LOCADOR, {{locador}}, cede em locação ao LOCATÁRIO, {{locatario}}, o imóvel situado em {{enderecoImovel}}, para fins {{finalidade}}.',
      },
      {
        order: 2,
        title: 'Aluguel e Pagamento',
        content: 'O aluguel mensal é de {{valorAluguel}}, com vencimento todo dia {{diaVencimento}} de cada mês. O reajuste será aplicado {{periodicidadeReajuste}} pelo índice {{indiceReajuste}}.',
      },
      {
        order: 3,
        title: 'Prazo',
        content: 'A locação terá prazo de {{prazoLocacao}}, com início em {{dataInicioLocacao}} e término em {{dataTerminoLocacao}}.',
      },
      {
        order: 4,
        title: 'Caução',
        content: 'A título de garantia, o LOCATÁRIO depositará caução no valor de {{valorCaucao}}, equivalente a {{mesesCaucao}} meses de aluguel.',
      },
    ],
    variables: [
      { name: 'locador', label: 'Nome do Locador', type: 'text', required: true },
      { name: 'locatario', label: 'Nome do Locatário', type: 'text', required: true },
      { name: 'enderecoImovel', label: 'Endereço do Imóvel', type: 'text', required: true },
      { name: 'finalidade', label: 'Finalidade', type: 'select', options: ['residencial', 'comercial'] },
      { name: 'valorAluguel', label: 'Aluguel Mensal', type: 'currency', required: true },
      { name: 'diaVencimento', label: 'Dia de Vencimento', type: 'number', defaultValue: '10' },
      { name: 'periodicidadeReajuste', label: 'Periodicidade do Reajuste', type: 'text', defaultValue: 'anualmente' },
      { name: 'indiceReajuste', label: 'Índice de Reajuste', type: 'select', options: ['IGPM', 'IPCA', 'INPC'], defaultValue: 'IGPM' },
      { name: 'prazoLocacao', label: 'Prazo da Locação', type: 'text', defaultValue: '30 meses' },
      { name: 'dataInicioLocacao', label: 'Data de Início', type: 'date', required: true },
      { name: 'dataTerminoLocacao', label: 'Data de Término', type: 'date', required: true },
      { name: 'valorCaucao', label: 'Valor da Caução', type: 'currency' },
      { name: 'mesesCaucao', label: 'Meses de Caução', type: 'number', defaultValue: '3' },
    ],
    tags: ['locação', 'aluguel', 'imóvel'],
    rating: 4.5,
    usageCount: 1520,
    author: 'ContractEase',
    language: 'pt-BR',
    version: 2,
    createdAt: '2025-01-20T00:00:00Z',
    updatedAt: '2025-04-15T00:00:00Z',
    isPublic: true,
    isFeatured: true,
  },
  {
    id: 'tpl-testamento-01',
    name: 'Testamento Particular',
    description: 'Documento particular redigido pelo testador para disposição de última vontade de seus bens.',
    category: 'family',
    icon: 'solar:document-text-bold-duotone',
    content: '',
    clauses: [
      {
        order: 1,
        title: 'Declaração Inicial',
        content: 'Eu, {{testador}}, em pleno gozo de minhas faculdades mentais, decido dispor sobre meus bens para depois da minha morte.',
      },
      {
        order: 2,
        title: 'Disposição de Bens',
        content: 'Deixo a porcentagem de {{porcentagemBens}}% da parte disponível de meus bens para {{herdeiro}}.',
      },
      {
        order: 3,
        title: 'Testamenteiro',
        content: 'Nomeio como testamenteiro(a) o(a) Sr(a). {{testamenteiro}}, que deverá cumprir e fazer cumprir as minhas vontades aqui expressas.',
      },
    ],
    variables: [
      { name: 'testador', label: 'Nome do Testador', type: 'text', required: true },
      { name: 'porcentagemBens', label: 'Porcentagem (%)', type: 'number', defaultValue: '50' },
      { name: 'herdeiro', label: 'Nome do Herdeiro/Legatário', type: 'text', required: true },
      { name: 'testamenteiro', label: 'Nome do Testamenteiro', type: 'text', required: true },
    ],
    tags: ['testamento', 'herança', 'sucessão'],
    rating: 4.9,
    usageCount: 520,
    author: 'ContractEase',
    language: 'pt-BR',
    version: 1,
    createdAt: '2025-05-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    isPublic: true,
    isFeatured: false,
  },
];

/**
 * Template categories for the marketplace
 */
export const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'solar:layers-bold-duotone' },
  { id: 'technology', label: 'Tecnologia', icon: 'ph:laptop-duotone' },
  { id: 'commercial', label: 'Comercial', icon: 'ph:storefront-duotone' },
  { id: 'partnership', label: 'Parcerias', icon: 'ph:handshake-duotone' },
  { id: 'supply', label: 'Fornecimento', icon: 'ph:package-duotone' },
  { id: 'real_estate', label: 'Imobiliário', icon: 'ph:buildings-duotone' },
  { id: 'servico', label: 'Serviços', icon: 'ph:briefcase-duotone' },
  { id: 'employment', label: 'Trabalho', icon: 'ph:users-duotone' },
  { id: 'family', label: 'Família', icon: 'ph:heart-duotone' },
  { id: 'general', label: 'Geral', icon: 'ph:file-text-duotone' },
];
