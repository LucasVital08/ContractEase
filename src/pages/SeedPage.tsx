import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores';

const uid = () => crypto.randomUUID();

function isoDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function futureIso(fromDaysAgo: number, plusDays: number) {
  const d = new Date();
  d.setDate(d.getDate() - fromDaysAgo + plusDays);
  return d.toISOString();
}

function fakeHash(len = 64) {
  const c = '0123456789abcdef';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * 16)]).join('');
}

function fakeCPF() {
  const r = () => Math.floor(Math.random() * 9);
  return `${r()+1}${r()}${r()}.${r()}${r()}${r()}.${r()}${r()}${r()}-${r()}${r()}`;
}

export default function SeedPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const push = (msg: string) => setLog(prev => [...prev, msg]);

  useEffect(() => {
    if (!user) return;
    runSeed();
  }, [user]);

  async function insert(table: string, row: object) {
    const { error } = await supabase.from(table as any).insert(row as any);
    if (error) throw new Error(`[${table}] ${error.message}`);
  }

  async function runSeed() {
    push(`Usuário: ${user!.email} (${user!.id})`);
    push('Iniciando inserção de contratos...\n');

    const userId = user!.id;
    const userName = user!.name || 'Lucas Vital';
    const userEmail = user!.email;

    const contracts = [
      {
        meta: {
          title: 'Acordo de Confidencialidade — Startup FinTech Velox',
          description: 'NDA firmado para avaliação de due diligence de rodada Seed da Velox Soluções Financeiras Ltda.',
          type: 'nda', status: 'completed',
          daysAgo: 165, expireDays: 365,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['startup', 'fintech', 'due-diligence', 'seed'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 163, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Camila Rodrigues Ferreira', email: 'camila.rodrigues@veloxfintech.com.br', role: 'counterparty', status: 'signed', signedAgo: 162, cpf: fakeCPF(), sig: 'type' },
          { name: 'Thiago Augusto Leal', email: 'thiago.leal@veloxfintech.com.br', role: 'witness', status: 'signed', signedAgo: 160, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Objeto do Acordo', content: 'O presente instrumento tem por objeto estabelecer as condições de sigilo e confidencialidade das informações trocadas entre as partes no contexto da avaliação estratégica e financeira da Velox Soluções Financeiras Ltda., incluindo, mas não se limitando a: planos de negócios, projeções financeiras, dados de clientes, código-fonte e propriedade intelectual.', idx: 1 },
          { title: 'Obrigações das Partes', content: 'Cada parte se compromete a (i) manter absoluto sigilo sobre as informações confidenciais recebidas; (ii) utilizá-las exclusivamente para os fins previstos neste Acordo; (iii) não reproduzir, copiar ou distribuir tais informações sem autorização expressa da parte divulgadora; (iv) adotar medidas de segurança adequadas para proteger as informações contra acesso não autorizado.', idx: 2 },
          { title: 'Prazo de Vigência', content: 'O presente Acordo vigorará pelo prazo de 12 (doze) meses a contar da data de sua assinatura, podendo ser renovado por igual período mediante aditivo escrito firmado por ambas as partes.', idx: 3 },
          { title: 'Penalidades', content: 'O descumprimento de qualquer cláusula sujeitará a parte infratora ao pagamento de multa equivalente a R$ 50.000,00 (cinquenta mil reais), além de perdas e danos devidamente comprovados, sem prejuízo das medidas judiciais cabíveis.', idx: 4 },
          { title: 'Foro', content: 'As partes elegem o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias oriundas do presente instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.', idx: 5 },
        ],
      },
      {
        meta: {
          title: 'Contrato de Prestação de Serviços — Desenvolvimento de Software',
          description: 'Contrato PJ com desenvolvedor sênior para desenvolvimento do módulo de integrações da plataforma ContractEase.',
          type: 'service', status: 'active',
          daysAgo: 120, expireDays: 240,
          value: 18000, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['desenvolvimento', 'pj', 'mensal', 'backend'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 119, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Lucas Vinícius Cardoso', email: 'lucas.cardoso@devops.solutions', role: 'counterparty', status: 'signed', signedAgo: 117, cpf: fakeCPF(), sig: 'draw' },
        ],
        clauses: [
          { title: 'Objeto', content: 'O CONTRATADO compromete-se a prestar serviços de desenvolvimento de software back-end para a plataforma ContractEase, abrangendo: arquitetura de microsserviços, integrações com APIs de terceiros (Stellar Blockchain, DocuSign, Receita Federal), desenvolvimento de testes automatizados e documentação técnica.', idx: 1 },
          { title: 'Remuneração e Forma de Pagamento', content: 'Pelos serviços prestados, a CONTRATANTE pagará ao CONTRATADO o valor mensal de R$ 18.000,00 (dezoito mil reais), mediante emissão de Nota Fiscal de Serviços até o 5º dia útil do mês subsequente, com pagamento até o 10º dia útil do mês de vencimento.', idx: 2 },
          { title: 'Propriedade Intelectual', content: 'Todo o código-fonte, documentação técnica e demais criações intelectuais desenvolvidos pelo CONTRATADO serão de propriedade exclusiva da CONTRATANTE, cedidos de forma irrevogável mediante pagamento da remuneração prevista.', idx: 3 },
          { title: 'Confidencialidade', content: 'O CONTRATADO obriga-se a manter em sigilo todas as informações técnicas, comerciais e estratégicas da CONTRATANTE durante a vigência do contrato e por 24 meses após seu término.', idx: 4 },
        ],
      },
      {
        meta: {
          title: 'Acordo de Parceria Estratégica — Lawtec & ContractEase',
          description: 'Parceria comercial e tecnológica com a Lawtec Consultoria Jurídica para distribuição conjunta da plataforma no mercado jurídico nacional.',
          type: 'partnership', status: 'active',
          daysAgo: 95, expireDays: 730,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: true,
          tags: ['parceria', 'legaltech', 'distribuição', 'b2b'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 93, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Fernanda Cristina Bastos', email: 'fernanda.bastos@lawtec.com.br', role: 'counterparty', status: 'signed', signedAgo: 92, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Rodrigo Nunes Oliveira', email: 'rodrigo.oliveira@lawtec.com.br', role: 'counterparty', status: 'signed', signedAgo: 91, cpf: fakeCPF(), sig: 'type' },
          { name: 'Mariana Sousa Lima', email: 'mariana.lima@notariacartorio.com.br', role: 'witness', status: 'signed', signedAgo: 90, cpf: fakeCPF(), sig: 'draw' },
        ],
        clauses: [
          { title: 'Objeto da Parceria', content: 'As partes estabelecem parceria estratégica de natureza não exclusiva com o objetivo de promover, comercializar e distribuir a plataforma ContractEase junto a escritórios de advocacia, departamentos jurídicos corporativos e startups do segmento legaltech em todo o território nacional.', idx: 1 },
          { title: 'Modelo de Receita Compartilhada', content: 'A LAWTEC fará jus à comissão de 20% sobre o valor da primeira mensalidade de cada cliente captado por sua rede, paga no mês subsequente à confirmação do pagamento, mediante relatório mensal de indicações.', idx: 2 },
          { title: 'Obrigações da ContractEase', content: 'A ContractEase compromete-se a: (i) fornecer acesso gratuito à plataforma para a equipe da LAWTEC; (ii) oferecer treinamentos mensais remotos; (iii) disponibilizar material de marketing white-label; (iv) priorizar suporte técnico a clientes indicados.', idx: 3 },
          { title: 'Prazo e Rescisão', content: 'A parceria vigorará por 24 meses, renovável automaticamente por igual período. Qualquer das partes poderá rescindir mediante notificação por escrito com 60 dias de antecedência.', idx: 4 },
          { title: 'Não Concorrência', content: 'Durante a vigência e por 12 meses após seu término, a LAWTEC compromete-se a não representar, distribuir ou desenvolver plataformas de gestão e assinatura digital de contratos que concorram diretamente com a ContractEase.', idx: 5 },
        ],
      },
      {
        meta: {
          title: 'Contrato de Trabalho CLT — Analista Jurídica Plena',
          description: 'Contrato de emprego CLT para analista jurídica especializada em direito contratual e LGPD.',
          type: 'employment', status: 'active',
          daysAgo: 80, expireDays: null,
          value: 7500, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['clt', 'rh', 'jurídico', 'lgpd'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 79, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Isabela Monteiro Freitas', email: 'isabela.freitas@gmail.com', role: 'counterparty', status: 'signed', signedAgo: 78, cpf: fakeCPF(), sig: 'draw' },
          { name: 'Antônio Carlos Ribeiro', email: 'antonio.ribeiro@dpejuridico.com.br', role: 'witness', status: 'signed', signedAgo: 77, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Cargo e Função', content: 'A EMPREGADA é admitida no cargo de Analista Jurídica Plena, com jornada de 44 horas semanais, de segunda a sexta-feira, das 09h às 18h, com intervalo de 1 hora para refeição.', idx: 1 },
          { title: 'Remuneração e Benefícios', content: 'A EMPREGADA receberá salário mensal bruto de R$ 7.500,00, acrescidos de vale-refeição de R$ 880,00/mês, vale-transporte conforme legislação, plano de saúde Amil 400 e participação nos lucros (PPR).', idx: 2 },
          { title: 'Regime Híbrido', content: 'A EMPREGADA exercerá suas atividades em regime híbrido, com presença obrigatória de 3 dias semanais na sede (Av. Paulista, 1.000, São Paulo/SP) e os demais dias em home office conforme política interna.', idx: 3 },
          { title: 'Confidencialidade e LGPD', content: 'A EMPREGADA compromete-se a observar as políticas internas de proteção de dados pessoais (Lei nº 13.709/2018 — LGPD) e a manter sigilo sobre informações confidenciais de clientes e da empresa, sob pena de rescisão por justa causa.', idx: 4 },
        ],
      },
      {
        meta: {
          title: 'SLA — Infraestrutura Cloud (CloudBrasil Tecnologia)',
          description: 'Acordo de Nível de Serviço para infraestrutura cloud, monitoramento 24/7 e suporte técnico especializado da plataforma ContractEase.',
          type: 'sla', status: 'active',
          daysAgo: 60, expireDays: 305,
          value: 4200, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['cloud', 'infraestrutura', 'suporte', 'devops'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 59, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Eduardo Prado Nascimento', email: 'eduardo.prado@cloudbrasil.com.br', role: 'counterparty', status: 'signed', signedAgo: 58, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Disponibilidade Garantida', content: 'A CONTRATADA garante disponibilidade mínima de 99,9% mensal para todos os serviços contratados, excluídas janelas de manutenção previamente comunicadas com 72h de antecedência.', idx: 1 },
          { title: 'Tempo de Resposta e Resolução', content: 'Incidentes classificados como: Crítico (P1): resposta em 15 min, resolução em 4h; Alto (P2): resposta em 1h, resolução em 8h; Médio (P3): resposta em 4h, resolução em 24h; Baixo (P4): resposta em 1 dia útil, resolução em 5 dias úteis.', idx: 2 },
          { title: 'Créditos por Indisponibilidade', content: 'Em caso de descumprimento: 10% do valor mensal para disponibilidade entre 99,0% e 99,9%; 25% para disponibilidade entre 95% e 99%; 50% para disponibilidade inferior a 95%.', idx: 3 },
          { title: 'Backup e Recuperação', content: 'Backups automáticos diários (retenção 30 dias), semanais (90 dias) e mensais (12 meses). RTO máximo: 4h. RPO máximo: 1h.', idx: 4 },
          { title: 'Relatórios e Transparência', content: 'Dashboard em tempo real com métricas de disponibilidade, latência e throughput, além de relatório mensal enviado até o 5º dia útil do mês subsequente.', idx: 5 },
        ],
      },
      {
        meta: {
          title: 'Locação Comercial — Av. Brigadeiro Faria Lima, 3.477',
          description: 'Locação de espaço comercial de 120m² na Faria Lima para sede e showroom da plataforma ContractEase.',
          type: 'rental', status: 'pending',
          daysAgo: 18, expireDays: 730,
          value: 12500, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['locação', 'escritório', 'faria-lima', 'imóvel-comercial'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 17, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Construtora Itacolomi S.A.', email: 'contratos@itacolomi.com.br', role: 'counterparty', status: 'pending', signedAgo: null, cpf: null, sig: 'upload' },
          { name: 'Patrícia Helena Drummond', email: 'patricia.drummond@imobmarques.com.br', role: 'witness', status: 'pending', signedAgo: null, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Objeto e Descrição do Imóvel', content: 'O LOCADOR cede ao LOCATÁRIO espaço comercial localizado na Av. Brigadeiro Faria Lima, 3.477, conjunto 121, Torre Sul, Itaim Bibi, São Paulo/SP, CEP 04538-133, com área privativa de 120m² e 2 vagas de garagem.', idx: 1 },
          { title: 'Valor e Reajuste', content: 'Aluguel mensal de R$ 12.500,00, pago até o 5º dia útil de cada mês, reajustável anualmente pelo IGP-M/FGV (ou IPCA se IGP-M negativo).', idx: 2 },
          { title: 'Prazo e Multa Rescisória', content: 'Prazo de 24 meses a contar da entrega das chaves. Rescisão antecipada implica multa proporcional equivalente a 3 aluguéis mensais, nos termos da Lei 8.245/91.', idx: 3 },
          { title: 'Garantia Locatícia', content: 'Seguro fiança locatícia da Porto Seguro, apólice nº 2025/4471822, no valor equivalente a 12 aluguéis, renovável anualmente e mantido por 30 dias após entrega das chaves.', idx: 4 },
        ],
      },
      {
        meta: {
          title: 'Licença de Software — Suite Jurídica Premium (LexSoft)',
          description: 'Licenciamento da Suite Jurídica Premium para uso corporativo com 25 assentos e suporte prioritário.',
          type: 'license', status: 'review',
          daysAgo: 12, expireDays: 365,
          value: 29900, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['software', 'licença', 'jurídico', 'saas'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 11, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Bruna Takahashi Oliveira', email: 'bruna.takahashi@lexsoft.com.br', role: 'counterparty', status: 'pending', signedAgo: null, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Concessão de Licença', content: 'Licença não exclusiva e intransferível para uso da Suite Jurídica Premium (módulos: gestão de processos, peticionamento eletrônico, controle de prazos, gestão documental e BI jurídico) para até 25 usuários simultâneos.', idx: 1 },
          { title: 'Restrições de Uso', content: 'É vedado: (i) sublicenciar ou transferir o software; (ii) realizar engenharia reversa; (iii) remover notificações de propriedade intelectual; (iv) usar para fins ilícitos ou contrários à ética da OAB.', idx: 2 },
          { title: 'Suporte e Atualizações', content: 'Suporte prioritário via chat, e-mail e telefone (dias úteis 8h-20h, plantão 24/7 para P1). Atualizações de segurança e novas versões incluídas sem custo adicional.', idx: 3 },
          { title: 'LGPD e Proteção de Dados', content: 'A LICENCIANTE atua como operadora de dados nos termos da LGPD, com certificação ISO 27001. Notificará incidentes de segurança em até 72h.', idx: 4 },
          { title: 'Valor e Pagamento', content: 'Valor anual de R$ 29.900,00, em 12 parcelas mensais de R$ 2.491,67, vencimento dia 15. Atraso superior a 30 dias implica suspensão de acesso.', idx: 5 },
        ],
      },
      {
        meta: {
          title: 'Contrato de Compra e Venda — Equipamentos de TI',
          description: 'Aquisição de notebooks, monitores e periféricos para modernização da infraestrutura do escritório.',
          type: 'sale', status: 'completed',
          daysAgo: 140, expireDays: 90,
          value: 38500, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['compra', 'ti', 'equipamentos', 'notebook'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 139, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'TechMaster Equipamentos Ltda.', email: 'vendas@techmaster.com.br', role: 'counterparty', status: 'signed', signedAgo: 138, cpf: null, sig: 'upload' },
        ],
        clauses: [
          { title: 'Objeto da Venda', content: 'Venda dos seguintes bens: 5 notebooks Apple MacBook Pro 14" M3 Pro; 10 monitores LG UltraWide 34"; 5 webcams Logitech 4K; 5 headsets Sony WH-1000XM5; demais periféricos do Anexo I. Total: R$ 38.500,00.', idx: 1 },
          { title: 'Forma de Pagamento', content: '50% no ato da assinatura (R$ 19.250,00) e 50% na entrega dos equipamentos testados e aprovados, mediante Termo de Recebimento.', idx: 2 },
          { title: 'Entrega e Garantia', content: 'Entrega em até 15 dias corridos da assinatura. Garantia do fabricante de 12 meses e garantia adicional da VENDEDORA de 6 meses para defeitos de transporte.', idx: 3 },
        ],
      },
      {
        meta: {
          title: 'NDA — Reunião com Fundo VC Atlântico Capital (Série A)',
          description: 'Acordo de confidencialidade para apresentação da ContractEase ao fundo Atlântico Capital para explorar rodada Série A.',
          type: 'nda', status: 'draft',
          daysAgo: 3, expireDays: 180,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['vc', 'investimento', 'série-a', 'fundraising'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'pending', signedAgo: null, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Gabriel Siqueira Andrade', email: 'gabriel.andrade@atlanticocapital.vc', role: 'counterparty', status: 'pending', signedAgo: null, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Definição de Informações Confidenciais', content: 'São consideradas "Informações Confidenciais" toda e qualquer informação divulgada por uma parte à outra, incluindo: dados financeiros, projeções de crescimento, métricas de usuários, código-fonte, estratégias de go-to-market, acordos comerciais e propriedade intelectual, independentemente do meio de divulgação.', idx: 1 },
          { title: 'Uso das Informações', content: 'As Informações Confidenciais serão utilizadas exclusivamente para avaliação da viabilidade de investimento da Atlântico Capital na ContractEase, sendo vedada qualquer outra utilização sem consentimento expresso e por escrito.', idx: 2 },
          { title: 'Exceções', content: 'As obrigações de confidencialidade não se aplicam a informações que: (i) já sejam de domínio público; (ii) tornem-se públicas sem culpa da receptora; (iii) sejam conhecidas pela receptora previamente; (iv) obtidas legalmente de terceiros sem restrição; (v) divulgadas por obrigação legal ou judicial.', idx: 3 },
          { title: 'Vigência', content: 'Este Acordo terá vigência de 6 meses a contar da assinatura, prazo durante o qual as negociações deverão ser concluídas ou formalmente encerradas.', idx: 4 },
        ],
      },
      {
        meta: {
          title: 'Contrato de Mútuo — Capital de Giro Operacional',
          description: 'Empréstimo entre sócios para aporte de capital de giro. Cancelado após aprovação de aporte via equity.',
          type: 'loan', status: 'cancelled',
          daysAgo: 50, expireDays: 180,
          value: 75000, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['mútuo', 'capital-giro', 'cancelado', 'interno'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 49, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Henrique Albuquerque Pires', email: 'henrique.pires@escritorioexemplo.com.br', role: 'counterparty', status: 'signed', signedAgo: 48, cpf: fakeCPF(), sig: 'draw' },
          { name: 'Juliana Mendes Correa', email: 'juliana.correa@cartoriosp.com.br', role: 'witness', status: 'signed', signedAgo: 47, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Objeto do Mútuo', content: 'O MUTUANTE empresta ao MUTUÁRIO R$ 75.000,00 (setenta e cinco mil reais) para fins de capital de giro operacional, que o MUTUÁRIO recebe neste ato declarando-se quitado quanto ao recebimento.', idx: 1 },
          { title: 'Prazo e Restituição', content: 'Valor restituído em 6 parcelas mensais de R$ 12.500,00, vencendo no último dia útil de cada mês a partir do mês subsequente à assinatura, via transferência bancária.', idx: 2 },
          { title: 'Encargos', content: 'Juros de 0,5% ao mês capitalizados e atualização pelo IPCA. Em inadimplemento: multa de 2% e juros moratórios de 1% ao mês.', idx: 3 },
          { title: 'Motivo do Cancelamento', content: 'As partes cancelam este instrumento de comum acordo em razão da aprovação de aporte societário via aumento de capital, tornando desnecessário o empréstimo. Os efeitos ficam extintos a partir da data de cancelamento.', idx: 4 },
        ],
      },
    ];

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < contracts.length; i++) {
      const { meta, parties, clauses } = contracts[i];
      const contractId = uid();
      const createdAt = isoDate(meta.daysAgo);
      const updatedAt = isoDate(Math.floor(meta.daysAgo * 0.3));
      const expiresAt = meta.expireDays ? futureIso(meta.daysAgo, meta.expireDays) : null;

      try {
        push(`[${i + 1}/10] ${meta.title.substring(0, 50)}...`);

        await insert('contracts', {
          id: contractId,
          title: meta.title,
          description: meta.description,
          type: meta.type,
          status: meta.status,
          created_at: createdAt,
          updated_at: updatedAt,
          expires_at: expiresAt,
          owner_id: userId,
          organization_id: null,
          value: meta.value,
          currency: meta.currency,
          stellar_tx_hash: meta.hasTx ? fakeHash(64).toUpperCase() : null,
          contract_hash: meta.hasTx ? fakeHash(64) : null,
          signature_order: meta.signature_order,
          multisig_enabled: meta.multisig_enabled,
          tags: meta.tags,
        });

        for (const p of parties) {
          await insert('contract_parties', {
            id: uid(),
            contract_id: contractId,
            name: p.name,
            email: p.email,
            role: p.role,
            status: p.status,
            signed_at: p.signedAgo !== null ? isoDate(p.signedAgo) : null,
            cpf: p.cpf ?? null,
            signature_type: p.sig,
            lgpd_consent: true,
          });
        }

        for (const c of clauses) {
          await insert('contract_clauses', {
            id: uid(),
            contract_id: contractId,
            title: c.title,
            content: c.content,
            order_index: c.idx,
            is_custom: false,
          });
        }

        push(`  ✔ Inserido com ${parties.length} partes e ${clauses.length} cláusulas`);
        ok++;
      } catch (err: any) {
        push(`  ✖ Erro: ${err.message}`);
        fail++;
      }
    }

    push(`\n═══════════════════════════════════`);
    push(`Concluído! ${ok} contratos inseridos, ${fail} erros.`);
    push('Redirecionando para o dashboard...');
    setDone(true);

    setTimeout(() => navigate('/dashboard'), 2500);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-mono">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-lg">CE</div>
          <div>
            <h1 className="text-xl font-bold">ContractEase — Seed de Dados</h1>
            <p className="text-neutral-500 text-sm">Inserindo contratos mockados para demonstração</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 space-y-1 min-h-64">
          {log.length === 0 && (
            <div className="flex items-center gap-2 text-neutral-500">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Inicializando...
            </div>
          )}
          {log.map((line, i) => (
            <div key={i} className={`text-sm ${line.includes('✔') ? 'text-emerald-400' : line.includes('✖') || line.includes('Erro') ? 'text-red-400' : line.includes('═') || line.includes('Concluído') ? 'text-white font-bold' : 'text-neutral-400'}`}>
              {line}
            </div>
          ))}
        </div>

        {done && (
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm text-center">
            ✔ Tudo pronto! Redirecionando para o dashboard...
          </div>
        )}
      </div>
    </div>
  );
}
