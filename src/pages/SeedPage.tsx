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
  const [running, setRunning] = useState(false);
  const [existingCount, setExistingCount] = useState<number | null>(null);

  const push = (msg: string) => setLog(prev => [...prev, msg]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      if (!cancelled) setExistingCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function insert(table: string, row: object) {
    const { error } = await supabase.from(table as any).insert(row as any);
    if (error) throw new Error(`[${table}] ${error.message}`);
  }

  async function refreshCount() {
    if (!user) return;
    const { count } = await supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id);
    setExistingCount(count ?? 0);
  }

  async function clearMyContracts() {
    if (!user) return;
    const confirmed = window.confirm(
      `Tem certeza? Isto vai apagar TODOS os contratos do usuário ${user.email}. ` +
      `Esta ação é irreversível.`
    );
    if (!confirmed) return;
    setRunning(true);
    setLog([]);
    setDone(false);
    setError('');
    try {
      push(`Apagando contratos de ${user.email}...`);
      const { data: rows, error: selErr } = await supabase
        .from('contracts')
        .select('id')
        .eq('owner_id', user.id);
      if (selErr) throw new Error(selErr.message);
      const ids = (rows ?? []).map((r: any) => r.id);
      push(`Encontrados ${ids.length} contratos para apagar.`);
      if (ids.length > 0) {
        const { error: cpErr } = await supabase.from('contract_parties').delete().in('contract_id', ids);
        if (cpErr) push(`  ⚠ contract_parties: ${cpErr.message}`);
        const { error: ccErr } = await supabase.from('contract_clauses').delete().in('contract_id', ids);
        if (ccErr) push(`  ⚠ contract_clauses: ${ccErr.message}`);
        const { error: cErr } = await supabase.from('contracts').delete().in('id', ids);
        if (cErr) throw new Error(cErr.message);
      }
      push(`✔ Limpeza concluída.`);
      await refreshCount();
    } catch (err: any) {
      setError(err.message);
      push(`✖ Erro: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  async function runSeed() {
    setRunning(true);
    setLog([]);
    setDone(false);
    setError('');
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

      // ══════════════════════════════════════════════════════════════
      // EXPANSÃO: +30 contratos cobrindo 6 meses (alternando documentos
      // contratuais e smart contracts — marcador: tag "smart-contract")
      // ══════════════════════════════════════════════════════════════

      // 11. DOC · Service (consultoria)
      {
        meta: {
          title: 'Consultoria Estratégica de Crescimento — Q3/26',
          description: 'Mentoria executiva trimestral para founders sobre go-to-market B2B e estruturação comercial.',
          type: 'service', status: 'active',
          daysAgo: 22, expireDays: 90,
          value: 12000, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['consultoria', 'mentoria', 'go-to-market'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 21, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Beatriz Camargo Tavares', email: 'beatriz@growthlab.com.br', role: 'counterparty', status: 'signed', signedAgo: 20, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Escopo da Consultoria', content: 'A CONTRATADA prestará 8 sessões quinzenais de mentoria executiva de 90 minutos, abordando pricing, funil de vendas B2B, ciclo comercial e estruturação de SDR/AE.', idx: 1 },
          { title: 'Remuneração', content: 'Valor total de R$ 12.000,00 dividido em 3 parcelas mensais de R$ 4.000,00, com NF emitida a cada vencimento.', idx: 2 },
        ],
      },

      // 12. SMART · Aluguel residencial com caução
      {
        meta: {
          title: '[Smart] Aluguel Residencial — Apto Vila Madalena com Caução On-Chain',
          description: 'Locação de apartamento de 75m² com caução tokenizada em BRZ e cobrança automatizada via smart contract.',
          type: 'rental', status: 'active',
          daysAgo: 40, expireDays: 900,
          value: 4200, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: true,
          tags: ['smart-contract', 'aluguel', 'caução-onchain', 'rent-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 39, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Marcos Antônio Pereira', email: 'marcos.pereira@gmail.com', role: 'counterparty', status: 'signed', signedAgo: 38, cpf: fakeCPF(), sig: 'freighter' },
        ],
        clauses: [
          { title: 'Imóvel e Valor', content: 'Locação de apartamento de 75m² na Vila Madalena, R$ 4.200,00/mês com caução de 3x retida no smart contract.', idx: 1 },
          { title: 'Execução Automática', content: 'Smart contract em Soroban executa cobrança mensal no dia 5, marca inadimplência após D+5 e libera caução conforme vistoria final.', idx: 2 },
        ],
      },

      // 13. DOC · NDA bilateral curto
      {
        meta: {
          title: 'NDA Bilateral — Reunião Técnica com OpenBank',
          description: 'Acordo de confidencialidade para reunião sobre integração com Open Finance.',
          type: 'nda', status: 'completed',
          daysAgo: 110, expireDays: 365,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['nda', 'open-finance', 'integração'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 109, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Renata Marin Silveira', email: 'renata.silveira@openbank.com.br', role: 'counterparty', status: 'signed', signedAgo: 108, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Confidencialidade Bilateral', content: 'Ambas as partes obrigam-se a manter sigilo sobre informações técnicas, comerciais e arquiteturais trocadas no contexto da avaliação de integração.', idx: 1 },
          { title: 'Vigência', content: 'Vigência de 12 meses, com obrigação de sigilo perdurando por 24 meses após o término.', idx: 2 },
        ],
      },

      // 14. SMART · E-commerce escrow
      {
        meta: {
          title: '[Smart] Venda Online com Escrow — Marketplace de Eletrônicos',
          description: 'Escrow on-chain para venda de iPhone 15 Pro entre P2P, com liberação automática após confirmação de entrega.',
          type: 'sale', status: 'completed',
          daysAgo: 58, expireDays: 30,
          value: 7800, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'escrow', 'p2p', 'ecommerce-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 57, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Pedro Henrique Sá', email: 'pedro.sa@gmail.com', role: 'counterparty', status: 'signed', signedAgo: 56, cpf: fakeCPF(), sig: 'freighter' },
        ],
        clauses: [
          { title: 'Objeto da Venda', content: 'Venda de iPhone 15 Pro 256GB Titânio (IMEI 35238765432156) por R$ 7.800,00 com pagamento em escrow.', idx: 1 },
          { title: 'Liberação Automática', content: 'Smart contract libera valor ao vendedor após confirmação do comprador OU 7 dias após data de entrega rastreada via API dos Correios.', idx: 2 },
        ],
      },

      // 15. DOC · Employment (PJ)
      {
        meta: {
          title: 'Prestação de Serviços PJ — Designer UI/UX Sênior',
          description: 'Contrato PJ mensal com designer sênior para evolução da identidade visual e fluxos do produto.',
          type: 'service', status: 'active',
          daysAgo: 75, expireDays: 270,
          value: 14500, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['pj', 'design', 'produto'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 74, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Larissa Pimentel Souza', email: 'larissa@designcraft.studio', role: 'counterparty', status: 'signed', signedAgo: 72, cpf: fakeCPF(), sig: 'draw' },
        ],
        clauses: [
          { title: 'Escopo Mensal', content: 'Entregáveis: refinamento de UI dos fluxos críticos, manutenção do Design System, prototipação de novas features e revisão de hand-off semanal.', idx: 1 },
          { title: 'Remuneração e PI', content: 'R$ 14.500,00/mês via NF. Toda PI gerada é cedida integralmente à CONTRATANTE mediante quitação mensal.', idx: 2 },
        ],
      },

      // 16. SMART · Freelancer milestone (dev software)
      {
        meta: {
          title: '[Smart] Desenvolvimento Fullstack — Módulo de Telemedicina (4 marcos)',
          description: 'Smart contract de freelancer com 4 marcos de entrega e pagamento liberado por aceite de cada marco.',
          type: 'service', status: 'active',
          daysAgo: 28, expireDays: 90,
          value: 28000, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'milestone', 'freelancer-template', 'desenvolvimento'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 27, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Vinícius Costa Almeida', email: 'vinicius.almeida@devstack.io', role: 'counterparty', status: 'signed', signedAgo: 26, cpf: fakeCPF(), sig: 'freighter' },
        ],
        clauses: [
          { title: 'Marcos e Liberação', content: 'M1 setup+auth+agenda (R$ 7k) · M2 sala de vídeo+chat (R$ 8k) · M3 prescrição digital (R$ 7k) · M4 painel admin+handoff (R$ 6k). Cada aceite libera o valor automaticamente.', idx: 1 },
          { title: 'Janela de Revisão', content: 'Cliente tem 5 dias úteis pra aceitar ou solicitar revisão de cada marco. Sem resposta = aceite automático.', idx: 2 },
        ],
      },

      // 17. DOC · Partnership (afiliação)
      {
        meta: {
          title: 'Acordo de Afiliação — Programa de Indicação Premium',
          description: 'Programa de indicação com comissão recorrente sobre primeira mensalidade de clientes captados.',
          type: 'partnership', status: 'active',
          daysAgo: 100, expireDays: 365,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['afiliação', 'indicação', 'comissão'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 99, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Diego Marques Andrade', email: 'diego@growthpartners.com.br', role: 'counterparty', status: 'signed', signedAgo: 98, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Comissionamento', content: 'O AFILIADO recebe 30% sobre o valor da primeira mensalidade de cada cliente captado, pago no mês seguinte à confirmação do pagamento.', idx: 1 },
          { title: 'Atribuição e Cookies', content: 'Atribuição via link rastreável com cookie de 60 dias. Em caso de múltiplas indicações: last-click ganha.', idx: 2 },
        ],
      },

      // 18. SMART · Folha de pagamento
      {
        meta: {
          title: '[Smart] Folha de Pagamento Programada — Setembro/26',
          description: 'Folha mensal automatizada com 8 colaboradores PJ pagos via stream programado em BRZ no dia 5.',
          type: 'service', status: 'active',
          daysAgo: 33, expireDays: 330,
          value: 78400, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: true,
          tags: ['smart-contract', 'folha', 'payroll-template', 'recorrente'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 32, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Tesouraria Operacional', email: 'tesouraria@contractease.app', role: 'counterparty', status: 'signed', signedAgo: 31, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Beneficiários e Valores', content: 'Smart contract programa pagamento mensal de 8 colaboradores totalizando R$ 78.400 em BRZ no dia 5 de cada mês. Multi-sig 2-de-3 requerido pra alteração.', idx: 1 },
          { title: 'Auditoria', content: 'Todos os pagamentos ficam ancorados em testnet com hash recuperável pra conferência fiscal e contábil.', idx: 2 },
        ],
      },

      // 19. DOC · License software
      {
        meta: {
          title: 'Licença de Uso — Plataforma BI Corporativo (DataLogics)',
          description: 'Licença anual para 15 usuários da plataforma de BI corporativo com dashboards customizados.',
          type: 'license', status: 'active',
          daysAgo: 130, expireDays: 235,
          value: 18900, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['licença', 'bi', 'saas'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 129, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Karina Vieira Branco', email: 'karina.branco@datalogics.io', role: 'counterparty', status: 'signed', signedAgo: 128, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Escopo da Licença', content: 'Licença não-exclusiva para 15 usuários nomeados, com acesso a todos os módulos premium incluindo conectores SAP, Salesforce e Stripe.', idx: 1 },
          { title: 'Pagamento Anual', content: 'R$ 18.900,00/ano cobrados em parcela única ou 12x sem juros via boleto, com renovação automática salvo notificação 60 dias antes.', idx: 2 },
        ],
      },

      // 20. SMART · Social media (template novo)
      {
        meta: {
          title: '[Smart] Social Media com KPI — Marca Beleza Urbana',
          description: 'Pacote mensal de gestão de redes com bônus on-chain liberado ao atingir +500 seguidores qualificados/mês.',
          type: 'service', status: 'active',
          daysAgo: 15, expireDays: 180,
          value: 2800, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'social-media', 'kpi', 'social_media_management-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 14, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Beleza Urbana Cosméticos Ltda.', email: 'marketing@belezaurbana.com.br', role: 'counterparty', status: 'signed', signedAgo: 13, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Pacote Mensal', content: '12 posts no feed + 40 stories + 4 reels por mês. Mensalidade de R$ 2.800 + bônus de R$ 500 se +500 seguidores qualificados validados via report.', idx: 1 },
          { title: 'Aceite e Liberação', content: 'Manager envia report ao fim de cada ciclo. Cliente tem 5 dias pra aceitar — sem resposta = aceite automático.', idx: 2 },
        ],
      },

      // 21. DOC · SLA cliente (atendimento)
      {
        meta: {
          title: 'SLA de Atendimento — Conta Enterprise Hospital Sírio',
          description: 'SLA Enterprise com plantão 24/7, SLA de resposta P1 em 15min e gerente de conta dedicado.',
          type: 'sla', status: 'active',
          daysAgo: 90, expireDays: 275,
          value: 8900, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['sla', 'enterprise', 'saúde'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 89, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Ricardo Yamamoto', email: 'ricardo.yamamoto@hsiriolibanes.com.br', role: 'counterparty', status: 'signed', signedAgo: 87, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Níveis de Serviço', content: 'P1 resposta 15min, resolução 4h · P2 1h/8h · P3 4h/24h · P4 1 dia útil/5 dias úteis. Disponibilidade 99,95%.', idx: 1 },
          { title: 'Penalidades', content: 'Descumprimento gera créditos automáticos: 15% para P1 perdido, 10% por queda abaixo de 99,9%, 25% abaixo de 99%.', idx: 2 },
        ],
      },

      // 22. SMART · Vesting cofundador
      {
        meta: {
          title: '[Smart] Vesting de Cofundador — 4 anos com cliff de 12 meses',
          description: 'Smart contract de vesting de 5% de equity em 4 anos com cliff de 12 meses para CTO cofundador.',
          type: 'service', status: 'active',
          daysAgo: 155, expireDays: 1310,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: true,
          tags: ['smart-contract', 'vesting', 'equity', 'founderVesting-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 154, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Gustavo Henrique Rocha', email: 'gustavo.rocha@contractease.app', role: 'counterparty', status: 'signed', signedAgo: 153, cpf: fakeCPF(), sig: 'freighter' },
        ],
        clauses: [
          { title: 'Cronograma de Vesting', content: '5% de equity total, vested em 48 meses com cliff de 12 meses. 25% libera no aniversário do cliff, restante linear mensal.', idx: 1 },
          { title: 'Aceleração e Bad Leaver', content: 'Aceleração de 100% em mudança de controle. Bad leaver (rescisão por justa causa) implica perda de tokens não vested e recompra dos vested ao valor nominal.', idx: 2 },
        ],
      },

      // 23. DOC · Rental comercial pendente
      {
        meta: {
          title: 'Locação Comercial — Sala 1402 Edifício Faria Lima Plaza',
          description: 'Locação comercial de 80m² com 2 vagas, sublocada para coworking parceiro.',
          type: 'rental', status: 'pending',
          daysAgo: 8, expireDays: 730,
          value: 9800, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['rental', 'comercial', 'sublocação'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 7, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'JFL Realty Investimentos S.A.', email: 'contratos@jflrealty.com.br', role: 'counterparty', status: 'pending', signedAgo: null, cpf: null, sig: 'upload' },
        ],
        clauses: [
          { title: 'Imóvel e Valor', content: 'Sala 1402, 80m², com 2 vagas, R$ 9.800/mês reajustável pelo IGP-M anualmente.', idx: 1 },
          { title: 'Garantia', content: 'Seguro fiança Porto Seguro apólice 2026/884412 no valor de 12 aluguéis.', idx: 2 },
        ],
      },

      // 24. SMART · Royalties (música)
      {
        meta: {
          title: '[Smart] Split de Royalties — Álbum "Atlântico" (Estúdio Lunar)',
          description: 'Distribuição automática de royalties entre 4 cocriadores conforme percentuais acordados e plataformas DSP.',
          type: 'service', status: 'active',
          daysAgo: 70, expireDays: 1825,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: true,
          tags: ['smart-contract', 'royalties', 'royalties-template', 'música'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 69, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Estúdio Lunar Produções', email: 'estudio@lunarproducoes.com.br', role: 'counterparty', status: 'signed', signedAgo: 68, cpf: null, sig: 'freighter' },
          { name: 'Felipe Vieira (compositor)', email: 'felipe.vieira@gmail.com', role: 'counterparty', status: 'signed', signedAgo: 67, cpf: fakeCPF(), sig: 'draw' },
        ],
        clauses: [
          { title: 'Splits Programados', content: 'Compositor 40%, Intérprete 30%, Estúdio 20%, Produtor 10%. Receita entra → contrato distribui em até 1h conforme split.', idx: 1 },
          { title: 'Alteração de Split', content: 'Qualquer mudança requer aprovação multi-sig de todos os beneficiários atuais.', idx: 2 },
        ],
      },

      // 25. DOC · Power of Attorney
      {
        meta: {
          title: 'Procuração Específica — Representação em AGE da Holding',
          description: 'Procuração ad hoc para representação em Assembleia Geral Extraordinária da holding controladora.',
          type: 'power_of_attorney', status: 'completed',
          daysAgo: 45, expireDays: 90,
          value: null, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['procuração', 'societário', 'age'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 44, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Dra. Cláudia Beraldo Toledo', email: 'claudia.toledo@beraldoadvocacia.com.br', role: 'counterparty', status: 'signed', signedAgo: 43, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Poderes Outorgados', content: 'Representar o OUTORGANTE em AGE prevista para 18/06/2026, votar matérias da ordem do dia, assinar atas e demais documentos correlatos.', idx: 1 },
          { title: 'Prazo de Validade', content: 'Validade restrita à AGE de 18/06/2026 e atos imediatamente correlatos, extinguindo-se automaticamente em 90 dias.', idx: 2 },
        ],
      },

      // 26. SMART · Factoring (antecipação NF)
      {
        meta: {
          title: '[Smart] Antecipação de Recebíveis — NF 023456 (R$ 95k)',
          description: 'Cessão de NF emitida ao sacado Distribuidora Sul para investidor com liquidação automática no vencimento.',
          type: 'service', status: 'active',
          daysAgo: 18, expireDays: 60,
          value: 95000, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'factoring', 'factoring-template', 'antecipação'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 17, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Fundo Antares Crédito FIDC', email: 'op@antarescredito.fidc.br', role: 'counterparty', status: 'signed', signedAgo: 16, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Cessão e Desconto', content: 'Cessão de NF 023456 ao FIDC com desconto de 2,4% a.m. por 45 dias. Investidor adianta R$ 91.580 hoje.', idx: 1 },
          { title: 'Liquidação Automática', content: 'No vencimento, sacado paga R$ 95.000 ao contrato, que libera valor cheio ao FIDC. Em caso de atraso, smart contract aciona regra de mora.', idx: 2 },
        ],
      },

      // 27. DOC · Sale equipamentos pequeno porte
      {
        meta: {
          title: 'Compra de Mobiliário Corporativo — Escritório Nova Sede',
          description: 'Aquisição de 12 estações de trabalho, cadeiras ergonômicas e mobiliário de copa.',
          type: 'sale', status: 'completed',
          daysAgo: 175, expireDays: 60,
          value: 24800, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['compra', 'mobiliário', 'escritório'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 174, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Mobiplan Móveis Corporativos Ltda.', email: 'comercial@mobiplan.com.br', role: 'counterparty', status: 'signed', signedAgo: 173, cpf: null, sig: 'upload' },
        ],
        clauses: [
          { title: 'Objeto e Valor', content: '12 estações modulares Slim Plus, 12 cadeiras Flexform Ergo, conjunto de copa (geladeira + bancada). Total R$ 24.800.', idx: 1 },
          { title: 'Garantia', content: 'Garantia de 5 anos da fabricante, com troca expressa em até 30 dias para defeitos de fabricação.', idx: 2 },
        ],
      },

      // 28. SMART · Design (template novo)
      {
        meta: {
          title: '[Smart] Identidade Visual — Marca CafeNouveau (escrow + 2 revisões)',
          description: 'Projeto de identidade visual completo com escrow on-chain e 2 rodadas de revisão incluídas.',
          type: 'service', status: 'active',
          daysAgo: 12, expireDays: 30,
          value: 4500, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'design', 'escrow', 'design_creative_brief-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 11, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Estúdio Folha Design', email: 'oi@estudiofolha.com.br', role: 'counterparty', status: 'signed', signedAgo: 10, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Entregáveis', content: 'Logo, manual de marca, papelaria institucional, perfis sociais e key visual para campanha de lançamento.', idx: 1 },
          { title: 'Escrow e Revisões', content: 'R$ 4.500 em escrow. 30% liberado após briefing aprovado. 2 revisões incluídas, extras a R$ 300/cada. Cessão total na entrega final.', idx: 2 },
        ],
      },

      // 29. DOC · Declaration (LGPD)
      {
        meta: {
          title: 'Declaração de Tratamento de Dados — Cliente Healthtech',
          description: 'Declaração formal sobre tratamento de dados pessoais sensíveis em conformidade com LGPD para parceiro healthtech.',
          type: 'declaration', status: 'completed',
          daysAgo: 64, expireDays: 365,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['declaração', 'lgpd', 'dados-sensíveis'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 63, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Acme Health Tecnologia Ltda.', email: 'dpo@acmehealth.com.br', role: 'counterparty', status: 'signed', signedAgo: 62, cpf: null, sig: 'type' },
        ],
        clauses: [
          { title: 'Bases Legais', content: 'Tratamento fundado em consentimento expresso (LGPD art. 7º I) e tutela da saúde (art. 11 II f).', idx: 1 },
          { title: 'Medidas de Segurança', content: 'Criptografia em repouso AES-256, em trânsito TLS 1.3, controle de acesso por RBAC, auditoria contínua e notificação de incidentes em até 72h.', idx: 2 },
        ],
      },

      // 30. SMART · Tráfego pago (template novo)
      {
        meta: {
          title: '[Smart] Tráfego Pago com Performance — VitaFit Suplementos',
          description: 'Gestão de mídia paga com verba e fee em escrow, com bônus liberado on-chain quando ROAS ≥ 3,5x.',
          type: 'service', status: 'active',
          daysAgo: 10, expireDays: 90,
          value: 1500, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'tráfego-pago', 'performance', 'paid_traffic_kpi-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 9, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'VitaFit Suplementos Ltda.', email: 'growth@vitafit.com.br', role: 'counterparty', status: 'signed', signedAgo: 8, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Estrutura de Pagamento', content: 'R$ 5.000 de verba/mês em Meta + Google Ads. Fee fixo de R$ 1.500/mês. Bônus de R$ 800 quando ROAS ≥ 3,5x no ciclo.', idx: 1 },
          { title: 'Verificação', content: 'Settle do ciclo só com report contendo ID das campanhas e prints da plataforma — auditável.', idx: 2 },
        ],
      },

      // 31. DOC · Service — Marketing/conteúdo
      {
        meta: {
          title: 'Criação de Conteúdo Editorial — Blog Corporativo',
          description: 'Pacote mensal de 8 artigos otimizados para SEO, com pesquisa de palavras-chave e revisão editorial.',
          type: 'service', status: 'active',
          daysAgo: 38, expireDays: 240,
          value: 4800, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['conteúdo', 'seo', 'marketing'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 37, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Mariana Schmidt Lopes', email: 'mariana@contentlab.com.br', role: 'counterparty', status: 'signed', signedAgo: 36, cpf: fakeCPF(), sig: 'draw' },
        ],
        clauses: [
          { title: 'Entregáveis Mensais', content: '8 artigos de 1500-2000 palavras com pesquisa SEO, briefing aprovado, revisão e publicação no CMS.', idx: 1 },
          { title: 'Direitos Autorais', content: 'Cessão integral e exclusiva dos direitos para uso comercial perpétuo a partir do pagamento mensal.', idx: 2 },
        ],
      },

      // 32. SMART · Jurídico simples (template novo)
      {
        meta: {
          title: '[Smart] Notificação Extrajudicial — Cobrança de Locatário',
          description: 'Smart contract para entrega de notificação extrajudicial com pagamento em escrow ao aceite do cliente.',
          type: 'service', status: 'completed',
          daysAgo: 35, expireDays: 30,
          value: 950, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'jurídico', 'legal_simple_service-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 34, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Dra. Ana Clara Mendes', email: 'anaclara.mendes@gmail.com', role: 'counterparty', status: 'signed', signedAgo: 33, cpf: fakeCPF(), sig: 'draw' },
        ],
        clauses: [
          { title: 'Escopo', content: 'Redação e protocolo de notificação extrajudicial via cartório de títulos e documentos, com AR e comprovante digital.', idx: 1 },
          { title: 'Honorário em Escrow', content: 'R$ 950 em escrow, liberado automaticamente após aceite do cliente ou em D+3 do envio do comprovante sem resposta.', idx: 2 },
        ],
      },

      // 33. DOC · Service — RH/recrutamento
      {
        meta: {
          title: 'Recrutamento Executivo — Head of Engineering',
          description: 'Serviço de headhunting para vaga de Head of Engineering com placement fee de 18% do salário anual.',
          type: 'service', status: 'pending',
          daysAgo: 25, expireDays: 90,
          value: 36000, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['recrutamento', 'executive-search', 'rh'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 24, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Talent Search Brasil Consultoria', email: 'parcerias@talentsearch.com.br', role: 'counterparty', status: 'pending', signedAgo: null, cpf: null, sig: 'type' },
        ],
        clauses: [
          { title: 'Placement Fee', content: 'Comissão de 18% sobre o salário anual da posição preenchida, paga em 3 parcelas (50% no aceite, 25% em 30d, 25% em 60d).', idx: 1 },
          { title: 'Garantia', content: 'Garantia de 90 dias: se o profissional sair no período, recrutadora repõe sem custo adicional.', idx: 2 },
        ],
      },

      // 34. SMART · Aluguel comercial
      {
        meta: {
          title: '[Smart] Locação Comercial — Loja Itaim com Caução Tokenizada',
          description: 'Locação comercial com smart contract executando aluguel mensal e caução de 12x retida on-chain.',
          type: 'rental', status: 'pending',
          daysAgo: 5, expireDays: 1095,
          value: 14500, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: true,
          tags: ['smart-contract', 'rental', 'comercial', 'commercial_rent-template'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 4, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Imobiliária Pádua Negócios', email: 'locacao@paduanegocios.com.br', role: 'counterparty', status: 'pending', signedAgo: null, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Imóvel e Valor', content: 'Loja térrea de 95m² no Itaim, R$ 14.500/mês com caução de 12 meses retida no smart contract.', idx: 1 },
          { title: 'Execução', content: 'Reajuste anual pelo IGP-M, cobrança automática no dia 5, vistoria final on-chain libera caução.', idx: 2 },
        ],
      },

      // 35. DOC · NDA mais antigo arquivado
      {
        meta: {
          title: 'NDA Mútuo — Parceria Frustrada com TradeTech',
          description: 'NDA firmado para negociação que não evoluiu. Arquivado por término do prazo de avaliação.',
          type: 'nda', status: 'archived',
          daysAgo: 178, expireDays: 180,
          value: null, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['nda', 'arquivado', 'parceria-frustrada'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 177, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Mauricio Lustosa Filho', email: 'mauricio.lustosa@tradetech.io', role: 'counterparty', status: 'signed', signedAgo: 176, cpf: fakeCPF(), sig: 'type' },
        ],
        clauses: [
          { title: 'Confidencialidade', content: 'Manutenção do sigilo sobre informações trocadas pelo prazo de 18 meses contados desta data.', idx: 1 },
          { title: 'Arquivamento', content: 'Arquivado pelo decurso do prazo de avaliação sem evolução para contrato definitivo.', idx: 2 },
        ],
      },

      // 36. SMART · Financiamento empenho (template novo)
      {
        meta: {
          title: '[Smart] Antecipação de Empenho Público — NE 2026/0234 (R$ 180k)',
          description: 'Smart contract de antecipação sobre empenho da prefeitura municipal com liquidação automática no recebimento.',
          type: 'service', status: 'active',
          daysAgo: 6, expireDays: 75,
          value: 180000, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: true,
          tags: ['smart-contract', 'financiamento', 'empenho-público', 'bid_financing-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 5, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Construtora Bandeirantes Ltda.', email: 'financeiro@constbandeirantes.com.br', role: 'counterparty', status: 'signed', signedAgo: 4, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Empenho e Antecipação', content: 'NE 2026/0234 da Prefeitura de Campinas, face R$ 180.000, vencimento 75 dias. Taxa de antecipação 2,4% a.m. — adiantado R$ 169.200.', idx: 1 },
          { title: 'Liquidação', content: 'No pagamento do órgão, contrato libera valor cheio ao financiador e sobra ao contractor automaticamente.', idx: 2 },
        ],
      },

      // 37. DOC · Service — auditoria
      {
        meta: {
          title: 'Auditoria de Segurança da Informação — Pentest Externo',
          description: 'Pentest externo + interno + revisão de código com relatório executivo e plano de remediação.',
          type: 'service', status: 'completed',
          daysAgo: 105, expireDays: 90,
          value: 32000, currency: 'BRL',
          signature_order: 'sequential', multisig_enabled: false,
          tags: ['segurança', 'pentest', 'compliance'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 104, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'RedTeam Security Solutions', email: 'comercial@redteamsec.com.br', role: 'counterparty', status: 'signed', signedAgo: 103, cpf: null, sig: 'type' },
        ],
        clauses: [
          { title: 'Escopo do Pentest', content: 'Pentest externo black-box + interno gray-box + revisão de código nas APIs críticas, com 20 dias úteis de duração.', idx: 1 },
          { title: 'Entregáveis', content: 'Relatório executivo, relatório técnico detalhado com CVSS, PoCs reprodutíveis e plano de remediação priorizado.', idx: 2 },
        ],
      },

      // 38. SMART · Financiamento obra privada (template novo)
      {
        meta: {
          title: '[Smart] Financiamento de Obra Privada — NF 023456 (R$ 250k · 20%/45d)',
          description: 'Antecipação de NF de obra residencial com gatilho de 20% em 45d e quitação total em 120d.',
          type: 'service', status: 'active',
          daysAgo: 2, expireDays: 120,
          value: 250000, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: true,
          tags: ['smart-contract', 'financiamento', 'obra-privada', 'private_construction_funding-template'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 1, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Incorporadora Mirante S.A.', email: 'cfo@incmirante.com.br', role: 'counterparty', status: 'signed', signedAgo: 1, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Antecipação', content: 'NF 023456 — valor de face R$ 250.000. Antecipação descontada a 2,8% a.m. por 120d. Funder adianta R$ 222.000 hoje.', idx: 1 },
          { title: 'Gatilho de 20% e Quitação', content: 'Cliente final paga 20% (R$ 50.000) obrigatoriamente em 45d e saldo em até 120d. Cada parcela libera proporcional ao funder.', idx: 2 },
        ],
      },

      // 39. DOC · Service — manutenção
      {
        meta: {
          title: 'Manutenção Preventiva — Climatização e Elétrica do Escritório',
          description: 'Contrato anual de manutenção preventiva e corretiva de ar-condicionado e instalações elétricas.',
          type: 'service', status: 'active',
          daysAgo: 145, expireDays: 220,
          value: 1850, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['manutenção', 'predial', 'recorrente'], hasTx: false,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 144, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'TecnoClima Engenharia Ltda.', email: 'contratos@tecnoclima.com.br', role: 'counterparty', status: 'signed', signedAgo: 143, cpf: null, sig: 'type' },
        ],
        clauses: [
          { title: 'Periodicidade', content: 'Manutenção preventiva mensal de 12 splits + quadros elétricos + ronda predial. Corretivas atendidas em até 8h úteis.', idx: 1 },
          { title: 'Mensalidade', content: 'R$ 1.850/mês com NF emitida no dia 1º, pagamento via boleto até o dia 10.', idx: 2 },
        ],
      },

      // 40. SMART · Seguro paramétrico
      {
        meta: {
          title: '[Smart] Seguro Paramétrico de Chuva — Evento Outdoor 15/Jul',
          description: 'Seguro paramétrico de chuva para evento corporativo com indenização automática se precipitação > 5mm/h.',
          type: 'service', status: 'active',
          daysAgo: 4, expireDays: 60,
          value: 8500, currency: 'BRL',
          signature_order: 'parallel', multisig_enabled: false,
          tags: ['smart-contract', 'seguro', 'paramétrico', 'parametric_insurance-template', 'evento'], hasTx: true,
        },
        parties: [
          { name: userName, email: userEmail, role: 'creator', status: 'signed', signedAgo: 3, cpf: fakeCPF(), sig: 'freighter' },
          { name: 'Resseguradora Cardinal', email: 'paramétrico@cardinalre.com', role: 'counterparty', status: 'signed', signedAgo: 2, cpf: null, sig: 'freighter' },
        ],
        clauses: [
          { title: 'Cobertura', content: 'Indenização automática de R$ 80.000 se oracle Chainlink registrar precipitação > 5mm/h na coordenada do evento entre 14h-22h de 15/07/2026.', idx: 1 },
          { title: 'Prêmio', content: 'Prêmio único de R$ 8.500 pago no ato. Liquidação automática em até 30 minutos do trigger climático.', idx: 2 },
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
        push(`[${i + 1}/${contracts.length}] ${meta.title.substring(0, 50)}...`);

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
    setDone(true);
    setRunning(false);
    await refreshCount();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-mono">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-lg">CE</div>
          <div>
            <h1 className="text-xl font-bold">ContractEase — Seed de Dados</h1>
            <p className="text-neutral-500 text-sm">Painel manual de inserção e limpeza de dados mockados</p>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-neutral-900 border border-white/10 text-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider">Conta logada</p>
              <p className="text-white">{user?.email ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-neutral-500 text-xs uppercase tracking-wider">Contratos atuais</p>
              <p className="text-emerald-400 text-2xl font-bold">{existingCount ?? '…'}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={running || !user}
            onClick={runSeed}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors flex items-center gap-2"
          >
            {running ? '...' : '▶'} Inserir 40 contratos
          </button>
          <button
            type="button"
            disabled={running || !user}
            onClick={clearMyContracts}
            className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-500/25 transition-colors flex items-center gap-2"
          >
            🗑 Limpar meus contratos
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 font-bold text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            ← Voltar ao dashboard
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 space-y-1 min-h-64">
          {log.length === 0 && (
            <div className="text-neutral-500 text-sm">
              Nenhuma operação executada. Clique em <span className="text-emerald-400">Inserir 40 contratos</span> ou <span className="text-red-300">Limpar meus contratos</span> para começar.
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
            ✔ Operação finalizada.
          </div>
        )}
      </div>
    </div>
  );
}
