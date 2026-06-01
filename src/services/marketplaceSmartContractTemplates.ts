/**
 * Marketplace Smart Contract Templates — ContractEase
 *
 * Templates voltados ao feed de oportunidades do marketplace. Cobrem casos
 * de negócio que aparecem com frequência em "quero contratar" / "estou
 * disponível": gestão de redes sociais, design, serviços jurídicos simples,
 * tráfego pago e dois fluxos de financiamento (empenho público e obra
 * privada com nota fiscal).
 *
 *  Marketing & Criativo (3):
 *    33. social_media_management   Gestão de Redes Sociais por Pacote Mensal
 *    34. design_creative_brief     Briefing Criativo de Design (escrow + revisões)
 *    35. paid_traffic_kpi          Tráfego Pago com Fee por Performance
 *
 *  Profissional (1):
 *    36. legal_simple_service      Serviço Jurídico Simples (parecer, notificação, contrato)
 *
 *  Financiamento (2):
 *    37. bid_financing             Antecipação de Empenho Público (licitação ganha)
 *    38. private_construction_funding  Financiamento de Obra Privada (nota + 20%/45d)
 */

import type { SmartContractTemplate } from './smartContractTemplates';

const head = (id: string, name: string) => `// ──────────────────────────────────────────────────────────────
// Stellar Soroban Smart Contract — ${name}
// Gerado pelo ContractEase · Template ID: ${id}
// Compilar com: cargo build --target wasm32-unknown-unknown --release
// ──────────────────────────────────────────────────────────────

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};
`;

// ═════════════════════════════════════════════════════════════════════════
// 33. GESTÃO DE REDES SOCIAIS POR PACOTE MENSAL
// ═════════════════════════════════════════════════════════════════════════
const socialMediaManagementTemplate: SmartContractTemplate = {
  id: 'social_media_management',
  name: 'Gestão de Redes Sociais',
  shortName: 'Social Media',
  description: 'Pacote mensal de social media com entregas fixas (posts, stories, reels) e bonificação por KPI atingido.',
  plainLanguage:
    'O cliente paga mensalmente um valor fixo pelo pacote (quantidade definida de posts, stories e reels). O contrato libera o valor base ao final do ciclo, e libera um bônus extra automaticamente se o KPI combinado (ex: novos seguidores, alcance, engajamento) for atingido e comprovado.',
  icon: '📱',
  category: 'business',
  difficulty: 'Iniciante',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'Agência de social media com retainer mensal',
    'Freelancer assumindo redes de pequena empresa',
    'Influenciador gerenciando perfil de marca',
    'Gestão de redes sociais com KPI mensurável',
  ],
  variables: [
    { name: 'client', label: 'Cliente / Marca', type: 'address', required: true, placeholder: '@marca ou G...' },
    { name: 'manager', label: 'Social Media Manager', type: 'address', required: true, placeholder: '@profissional ou G...' },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'monthlyFee', label: 'Valor base mensal', type: 'amount', required: true, placeholder: '2500' },
    { name: 'bonusAmount', label: 'Bônus por meta atingida', type: 'amount', helper: 'Liberado se KPI for atingido no ciclo', defaultValue: '500' },
    { name: 'postsPerMonth', label: 'Posts no feed/mês', type: 'number', required: true, defaultValue: '12' },
    { name: 'storiesPerMonth', label: 'Stories/mês', type: 'number', required: true, defaultValue: '40' },
    { name: 'reelsPerMonth', label: 'Reels/mês', type: 'number', required: true, defaultValue: '4' },
    { name: 'targetKpi', label: 'KPI alvo', type: 'select', options: ['Novos seguidores', 'Alcance', 'Engajamento', 'Leads gerados'], defaultValue: 'Novos seguidores' },
    { name: 'kpiThreshold', label: 'Meta numérica do KPI', type: 'number', required: true, helper: 'Quantidade mínima pra liberar o bônus', defaultValue: '500' },
    { name: 'durationMonths', label: 'Duração do contrato (meses)', type: 'number', required: true, defaultValue: '6' },
    { name: 'platforms', label: 'Redes incluídas', type: 'text', placeholder: 'Instagram, TikTok, LinkedIn' },
  ],
  states: [
    { id: 'active', label: 'Vigente', color: 'green', description: 'Ciclo em execução' },
    { id: 'cycle_review', label: 'Em fechamento de ciclo', color: 'blue', description: 'Aguardando reporte e validação do mês' },
    { id: 'paid', label: 'Ciclo pago', color: 'green', description: 'Mensalidade liberada — pode incluir bônus' },
    { id: 'dispute', label: 'Em disputa', color: 'amber', description: 'Cliente contesta entregáveis do ciclo' },
    { id: 'closed', label: 'Encerrado', color: 'gray', description: 'Contrato finalizado' },
  ],
  actions: [
    { name: 'submit_report', description: 'Manager envia reporte mensal (links + métricas)', callableBy: 'manager', preState: 'active', postState: 'cycle_review' },
    { name: 'approve_cycle', description: 'Cliente aprova o ciclo e libera mensalidade', callableBy: 'client', preState: 'cycle_review', postState: 'paid' },
    { name: 'release_bonus', description: 'Libera bônus se KPI for batido (auto se oracle ou manual com print)', callableBy: 'client | oracle', preState: 'paid', postState: 'active' },
    { name: 'open_dispute', description: 'Abre disputa se entregáveis ficaram abaixo do combinado', callableBy: 'client', preState: 'cycle_review', postState: 'dispute' },
    { name: 'close_contract', description: 'Encerra o contrato ao fim da duração', callableBy: 'client | manager', preState: 'paid', postState: 'closed' },
  ],
  generateSoroban: (v) => `${head('social_media_management', 'Gestão de Redes Sociais')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum SmmState { Active, CycleReview, Paid, Dispute, Closed }

#[contracttype]
pub struct SmmAgreement {
    pub client: Address,
    pub manager: Address,
    pub monthly_fee: i128,
    pub bonus_amount: i128,
    pub asset: Symbol,
    pub posts_per_month: u32,
    pub stories_per_month: u32,
    pub reels_per_month: u32,
    pub kpi_threshold: u32,
    pub duration_months: u32,
    pub cycles_paid: u32,
    pub state: SmmState,
}

const DATA: Symbol = symbol_short!("SMM");

#[contract]
pub struct SocialMediaContract;

#[contractimpl]
impl SocialMediaContract {
    pub fn init(env: Env) {
        // TODO: inicializar com vars do contrato
        // monthly_fee = ${v.monthlyFee || '2500'} ${v.asset || 'BRZ'}
        // posts/mês = ${v.postsPerMonth || '12'} · KPI alvo = ${v.targetKpi || 'seguidores'} (${v.kpiThreshold || '500'})
    }
    pub fn submit_report(env: Env, reach: u32, engagement: u32, followers_gained: u32) { /* TODO */ }
    pub fn approve_cycle(env: Env) { /* TODO: libera monthly_fee ao manager */ }
    pub fn release_bonus(env: Env, kpi_achieved: u32) { /* TODO: se kpi_achieved >= threshold, libera bonus_amount */ }
    pub fn open_dispute(env: Env, reason: soroban_sdk::String) { /* TODO */ }
    pub fn close_contract(env: Env) { /* TODO */ }
}
// Redes: ${v.platforms || '(definir)'} · Duração: ${v.durationMonths || '6'} meses
`,
};

// ═════════════════════════════════════════════════════════════════════════
// 34. BRIEFING CRIATIVO DE DESIGN
// ═════════════════════════════════════════════════════════════════════════
const designCreativeBriefTemplate: SmartContractTemplate = {
  id: 'design_creative_brief',
  name: 'Briefing Criativo de Design',
  shortName: 'Design',
  description: 'Projeto de design com escrow, rodadas de revisão limitadas e cessão de direitos automática na entrega final.',
  plainLanguage:
    'O cliente deposita o valor total no contrato. O designer entrega o briefing inicial e o cliente tem até N rodadas de revisão (geralmente 2 ou 3). Quando o arquivo final for aceito, o pagamento é liberado e a cessão dos direitos autorais é registrada on-chain.',
  icon: '🎨',
  category: 'business',
  difficulty: 'Iniciante',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'Identidade visual completa (logo + manual de marca)',
    'Design de embalagem e key visual',
    'Web design e UI kit',
    'Material gráfico para campanha',
  ],
  variables: [
    { name: 'client', label: 'Cliente', type: 'address', required: true },
    { name: 'designer', label: 'Designer / Estúdio', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'totalAmount', label: 'Valor total do projeto', type: 'amount', required: true, placeholder: '4500' },
    { name: 'kickoffAmount', label: 'Sinal de kickoff (%)', type: 'number', defaultValue: '30', helper: '% liberado no início após briefing' },
    { name: 'revisionRounds', label: 'Rodadas de revisão incluídas', type: 'number', required: true, defaultValue: '2' },
    { name: 'extraRevisionFee', label: 'Valor por revisão extra', type: 'amount', defaultValue: '300' },
    { name: 'deliveryDays', label: 'Prazo de 1ª entrega (dias)', type: 'number', required: true, defaultValue: '10' },
    { name: 'deliverables', label: 'Entregáveis', type: 'text', placeholder: 'Logo, manual de marca, papelaria, perfis sociais' },
    { name: 'rightsTransfer', label: 'Cessão de direitos', type: 'select', options: ['Total e perpétua', 'Limitada a uso comercial', 'Apenas uso restrito'], defaultValue: 'Total e perpétua' },
  ],
  states: [
    { id: 'briefing', label: 'Briefing', color: 'gray', description: 'Alinhamento inicial em curso' },
    { id: 'in_design', label: 'Em criação', color: 'blue', description: 'Designer produzindo a 1ª entrega' },
    { id: 'review', label: 'Em revisão', color: 'amber', description: 'Cliente avaliando entrega ou revisão' },
    { id: 'approved', label: 'Aprovado', color: 'green', description: 'Arquivos finais aprovados — pagamento liberado' },
    { id: 'rights_assigned', label: 'Direitos cedidos', color: 'purple', description: 'Cessão de direitos registrada on-chain' },
    { id: 'cancelled', label: 'Cancelado', color: 'red', description: 'Projeto cancelado por uma das partes' },
  ],
  actions: [
    { name: 'fund_escrow', description: 'Cliente deposita valor total no contrato', callableBy: 'client', preState: 'briefing', postState: 'in_design' },
    { name: 'submit_delivery', description: 'Designer envia entrega/revisão', callableBy: 'designer', preState: 'in_design', postState: 'review' },
    { name: 'request_revision', description: 'Cliente solicita revisão (dentro do limite)', callableBy: 'client', preState: 'review', postState: 'in_design' },
    { name: 'pay_extra_revision', description: 'Cliente paga revisão extra além do limite', callableBy: 'client', preState: 'review', postState: 'in_design' },
    { name: 'approve_final', description: 'Cliente aprova arquivos finais e libera pagamento', callableBy: 'client', preState: 'review', postState: 'approved' },
    { name: 'assign_rights', description: 'Registra cessão de direitos autorais on-chain', callableBy: 'designer', preState: 'approved', postState: 'rights_assigned' },
    { name: 'cancel', description: 'Cancelamento com refund proporcional', callableBy: 'client | designer', preState: 'briefing | in_design | review', postState: 'cancelled' },
  ],
  generateSoroban: (v) => `${head('design_creative_brief', 'Briefing Criativo de Design')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum DesignState { Briefing, InDesign, Review, Approved, RightsAssigned, Cancelled }

#[contracttype]
pub struct DesignBrief {
    pub client: Address,
    pub designer: Address,
    pub total_amount: i128,
    pub kickoff_pct: u32,
    pub revisions_allowed: u32,
    pub revisions_used: u32,
    pub extra_revision_fee: i128,
    pub asset: Symbol,
    pub state: DesignState,
}

const DATA: Symbol = symbol_short!("DESIGN");

#[contract]
pub struct DesignBriefContract;

#[contractimpl]
impl DesignBriefContract {
    pub fn init(env: Env) {
        // TODO: init com vars
        // total = ${v.totalAmount || '4500'} ${v.asset || 'BRZ'} · revisões = ${v.revisionRounds || '2'}
    }
    pub fn fund_escrow(env: Env) { /* TODO: client transfere total p/ contrato + kickoff_pct ao designer */ }
    pub fn submit_delivery(env: Env, file_hash: soroban_sdk::Bytes) { /* TODO */ }
    pub fn request_revision(env: Env) { /* TODO: revisions_used++; se > revisions_allowed exige pay_extra */ }
    pub fn pay_extra_revision(env: Env) { /* TODO: cobra extra_revision_fee */ }
    pub fn approve_final(env: Env) { /* TODO: libera saldo restante ao designer */ }
    pub fn assign_rights(env: Env, ipfs_uri: soroban_sdk::String) { /* TODO: emit event RightsTransferred */ }
    pub fn cancel(env: Env, by: Address) { /* TODO: refund proporcional ao progresso */ }
}
// Entregáveis: ${v.deliverables || '(definir)'}
// Direitos: ${v.rightsTransfer || 'Total e perpétua'}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// 35. TRÁFEGO PAGO COM FEE POR PERFORMANCE
// ═════════════════════════════════════════════════════════════════════════
const paidTrafficKpiTemplate: SmartContractTemplate = {
  id: 'paid_traffic_kpi',
  name: 'Tráfego Pago por Performance',
  shortName: 'Tráfego Pago',
  description: 'Gestão de mídia paga com verba mensal separada e fee de performance liberado por resultado (leads, vendas ou CPA atingido).',
  plainLanguage:
    'O cliente deposita verba (que vai pra plataforma de ads) e fee de gestão. O contrato libera o fee fixo mensal ao gestor ao final de cada ciclo. Se o KPI de performance (custo por lead, ROAS, conversões) for atingido, o contrato libera o bônus de performance automaticamente.',
  icon: '🎯',
  category: 'business',
  difficulty: 'Intermediário',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'Agência de tráfego com performance fee',
    'Gestor de Google/Meta Ads para e-commerce',
    'Operações com meta de CPA ou ROAS',
    'Captação de leads para serviços B2B',
  ],
  variables: [
    { name: 'advertiser', label: 'Anunciante (cliente)', type: 'address', required: true },
    { name: 'mediaBuyer', label: 'Gestor de Tráfego', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'monthlyBudget', label: 'Verba de mídia/mês', type: 'amount', required: true, placeholder: '5000', helper: 'Valor reservado pra ads' },
    { name: 'managementFee', label: 'Fee fixo de gestão/mês', type: 'amount', required: true, placeholder: '1500' },
    { name: 'performanceBonus', label: 'Bônus por meta atingida', type: 'amount', defaultValue: '800' },
    { name: 'kpiType', label: 'Tipo de KPI', type: 'select', required: true, options: ['CPA (custo por aquisição)', 'ROAS (retorno sobre investimento)', 'Leads gerados', 'Vendas'], defaultValue: 'Leads gerados' },
    { name: 'kpiTarget', label: 'Meta do KPI', type: 'number', required: true, placeholder: '150', helper: 'Ex: 150 leads, ROAS 3, CPA <80, 30 vendas' },
    { name: 'platforms', label: 'Plataformas', type: 'text', placeholder: 'Meta Ads, Google Ads, TikTok Ads' },
    { name: 'durationMonths', label: 'Duração (meses)', type: 'number', required: true, defaultValue: '3' },
  ],
  states: [
    { id: 'funded', label: 'Verba depositada', color: 'green', description: 'Verba + fee no contrato' },
    { id: 'running_campaign', label: 'Campanha rodando', color: 'blue', description: 'Mídia em veiculação no ciclo' },
    { id: 'cycle_close', label: 'Fechamento do ciclo', color: 'amber', description: 'Aguardando relatório de performance' },
    { id: 'paid', label: 'Ciclo liquidado', color: 'green', description: 'Fee + bônus (se houve) liberados' },
    { id: 'closed', label: 'Encerrado', color: 'gray', description: 'Fim da vigência' },
  ],
  actions: [
    { name: 'fund_cycle', description: 'Anunciante deposita verba + fee do mês', callableBy: 'advertiser', preState: 'funded | paid', postState: 'running_campaign' },
    { name: 'submit_report', description: 'Gestor envia relatório com métricas verificáveis', callableBy: 'mediaBuyer', preState: 'running_campaign', postState: 'cycle_close' },
    { name: 'settle_cycle', description: 'Libera fee fixo + bônus se KPI atingido', callableBy: 'advertiser | oracle', preState: 'cycle_close', postState: 'paid' },
    { name: 'close', description: 'Encerra ao fim da duração', callableBy: 'advertiser | mediaBuyer', preState: 'paid', postState: 'closed' },
  ],
  generateSoroban: (v) => `${head('paid_traffic_kpi', 'Tráfego Pago por Performance')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum AdsState { Funded, RunningCampaign, CycleClose, Paid, Closed }

#[contracttype]
pub struct AdsAgreement {
    pub advertiser: Address,
    pub media_buyer: Address,
    pub monthly_budget: i128,
    pub management_fee: i128,
    pub performance_bonus: i128,
    pub kpi_target: u32,
    pub asset: Symbol,
    pub cycle: u32,
    pub state: AdsState,
}

const DATA: Symbol = symbol_short!("ADS");

#[contract]
pub struct PaidTrafficContract;

#[contractimpl]
impl PaidTrafficContract {
    pub fn init(env: Env) {
        // TODO: init
        // verba/mês = ${v.monthlyBudget || '5000'} ${v.asset || 'BRZ'} · fee gestão = ${v.managementFee || '1500'} · bônus = ${v.performanceBonus || '800'}
        // KPI = ${v.kpiType || 'Leads'} (meta: ${v.kpiTarget || '150'})
    }
    pub fn fund_cycle(env: Env) { /* TODO: advertiser transfere monthly_budget + management_fee */ }
    pub fn submit_report(env: Env, kpi_actual: u32, report_uri: soroban_sdk::String) { /* TODO */ }
    pub fn settle_cycle(env: Env, kpi_actual: u32) {
        // TODO: libera management_fee p/ media_buyer
        // se kpi_actual >= kpi_target libera performance_bonus
    }
    pub fn close(env: Env) { /* TODO */ }
}
// Plataformas: ${v.platforms || '(definir)'} · Duração: ${v.durationMonths || '3'} ciclos
`,
};

// ═════════════════════════════════════════════════════════════════════════
// 36. SERVIÇO JURÍDICO SIMPLES (parecer, notificação, contrato)
// ═════════════════════════════════════════════════════════════════════════
const legalSimpleServiceTemplate: SmartContractTemplate = {
  id: 'legal_simple_service',
  name: 'Serviço Jurídico Simples',
  shortName: 'Jurídico Simples',
  description: 'Honorários fixos por entregável jurídico único (parecer, notificação extrajudicial, redação de contrato ou consulta).',
  plainLanguage:
    'Cliente contrata um entregável jurídico fechado (não um processo recorrente): parecer escrito, notificação extrajudicial, redação ou revisão de contrato, ou consulta com relatório. O valor vai pro contrato, o advogado entrega o documento, e o pagamento é liberado quando o cliente aceitar.',
  icon: '📜',
  category: 'professional',
  difficulty: 'Iniciante',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Parecer jurídico fechado',
    'Notificação extrajudicial avulsa',
    'Redação ou revisão de contrato',
    'Consulta jurídica com relatório',
  ],
  variables: [
    { name: 'lawyer', label: 'Advogado(a)', type: 'address', required: true, helper: 'OAB ativa' },
    { name: 'client', label: 'Cliente', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'fee', label: 'Honorário fixo', type: 'amount', required: true, placeholder: '950' },
    { name: 'serviceType', label: 'Tipo de serviço', type: 'select', required: true, options: ['Parecer escrito', 'Notificação extrajudicial', 'Redação de contrato', 'Revisão de contrato', 'Consulta com relatório'] },
    { name: 'deliveryDays', label: 'Prazo de entrega (dias)', type: 'number', required: true, defaultValue: '7' },
    { name: 'scope', label: 'Escopo / objeto', type: 'text', placeholder: 'Notificação ao locatário João da Silva por inadimplência' },
    { name: 'revisionAllowed', label: 'Revisões incluídas', type: 'number', defaultValue: '1' },
  ],
  states: [
    { id: 'funded', label: 'Honorário depositado', color: 'green', description: 'Valor no contrato aguardando entrega' },
    { id: 'in_preparation', label: 'Em elaboração', color: 'blue', description: 'Advogado redigindo' },
    { id: 'delivered', label: 'Entregue', color: 'amber', description: 'Documento enviado — aguardando aceite' },
    { id: 'accepted', label: 'Aceito', color: 'green', description: 'Cliente aceitou e honorário liberado' },
    { id: 'rejected', label: 'Recusado', color: 'red', description: 'Necessita revisão (dentro do limite)' },
  ],
  actions: [
    { name: 'fund', description: 'Cliente deposita honorário', callableBy: 'client', preState: 'funded', postState: 'in_preparation' },
    { name: 'deliver', description: 'Advogado entrega o documento', callableBy: 'lawyer', preState: 'in_preparation', postState: 'delivered' },
    { name: 'accept', description: 'Cliente aceita e libera honorário', callableBy: 'client', preState: 'delivered', postState: 'accepted' },
    { name: 'request_revision', description: 'Cliente pede ajustes (dentro do limite)', callableBy: 'client', preState: 'delivered', postState: 'in_preparation' },
  ],
  generateSoroban: (v) => `${head('legal_simple_service', 'Serviço Jurídico Simples')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum LegalState { Funded, InPreparation, Delivered, Accepted, Rejected }

#[contracttype]
pub struct LegalService {
    pub lawyer: Address,
    pub client: Address,
    pub fee: i128,
    pub asset: Symbol,
    pub revisions_allowed: u32,
    pub revisions_used: u32,
    pub state: LegalState,
}

const DATA: Symbol = symbol_short!("LEGAL_S");

#[contract]
pub struct LegalSimpleContract;

#[contractimpl]
impl LegalSimpleContract {
    pub fn init(env: Env) {
        // TODO: init com fee = ${v.fee || '950'} ${v.asset || 'BRZ'}
        // Tipo: ${v.serviceType || 'Parecer escrito'} · Prazo: ${v.deliveryDays || '7'} dias
    }
    pub fn fund(env: Env) { /* TODO: client transfere fee p/ contrato */ }
    pub fn deliver(env: Env, doc_hash: soroban_sdk::Bytes) { /* TODO */ }
    pub fn accept(env: Env) { /* TODO: libera fee p/ lawyer */ }
    pub fn request_revision(env: Env) {
        // TODO: revisions_used++; se > revisions_allowed retorna estado Rejected
    }
}
// Escopo: ${v.scope || '(definir)'}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// 37. FINANCIAMENTO DE EMPENHO PÚBLICO (LICITAÇÃO GANHA)
// ═════════════════════════════════════════════════════════════════════════
const bidFinancingTemplate: SmartContractTemplate = {
  id: 'bid_financing',
  name: 'Antecipação de Empenho Público',
  shortName: 'Empenho Público',
  description: 'Financiamento de capital de giro pra empresas que ganharam licitação pública, lastreado no empenho emitido pelo órgão.',
  plainLanguage:
    'Empresa venceu uma licitação e tem nota de empenho emitida pelo órgão público, mas vai receber só daqui a 60-90 dias. Investidor (financiador) deposita o valor antecipado descontado de uma taxa. Quando o órgão público pagar o empenho na data, o contrato libera o valor cheio pro investidor e a sobra pra empresa.',
  icon: '🏛️',
  category: 'finance',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'PME que ganhou pregão e precisa executar antes do pagamento',
    'Fornecedor de prefeitura/estado com empenho a vencer',
    'Construtora que ganhou obra pública',
    'Empresa que precisa antecipar capital pra cumprir contrato',
  ],
  variables: [
    { name: 'contractor', label: 'Empresa vencedora', type: 'address', required: true },
    { name: 'funder', label: 'Financiador / investidor', type: 'address', required: true },
    { name: 'publicEntity', label: 'Órgão público pagador', type: 'text', required: true, placeholder: 'Prefeitura Municipal de Campinas / Secretaria X' },
    { name: 'asset', label: 'Moeda', type: 'select', options: ['BRZ'], defaultValue: 'BRZ' },
    { name: 'empenhoNumber', label: 'Nº do empenho', type: 'text', required: true, placeholder: '2026NE000234' },
    { name: 'faceValue', label: 'Valor de face do empenho', type: 'amount', required: true, placeholder: '180000' },
    { name: 'advanceRate', label: 'Taxa de antecipação (% am)', type: 'number', required: true, defaultValue: '2.4', helper: 'Desconto ao mês — define o valor que o investidor adianta' },
    { name: 'tenorDays', label: 'Prazo até o pagamento (dias)', type: 'number', required: true, defaultValue: '75' },
    { name: 'bidNumber', label: 'Nº da licitação / contrato', type: 'text', placeholder: 'Pregão 045/2026' },
    { name: 'deliveryStatus', label: 'Status da entrega', type: 'select', options: ['Em execução', 'Entregue, aguardando atesto', 'Atestado'] },
  ],
  states: [
    { id: 'pending_funding', label: 'Aguardando funding', color: 'gray', description: 'Empenho cadastrado, esperando investidor' },
    { id: 'funded', label: 'Adiantado', color: 'blue', description: 'Investidor depositou — empresa recebeu antecipado' },
    { id: 'awaiting_settlement', label: 'Aguardando pagto do órgão', color: 'amber', description: 'Empenho dentro do prazo' },
    { id: 'settled', label: 'Liquidado', color: 'green', description: 'Órgão pagou — investidor recebeu valor cheio' },
    { id: 'overdue', label: 'Atrasado', color: 'red', description: 'Órgão não pagou no prazo' },
    { id: 'default', label: 'Inadimplência', color: 'red', description: 'Contrato em default — execução garantia' },
  ],
  actions: [
    { name: 'register_empenho', description: 'Empresa cadastra o empenho e documentos', callableBy: 'contractor', preState: 'pending_funding', postState: 'pending_funding' },
    { name: 'fund_advance', description: 'Investidor adianta valor descontado', callableBy: 'funder', preState: 'pending_funding', postState: 'funded' },
    { name: 'mark_in_settlement', description: 'Empresa marca como em fluxo de pagamento', callableBy: 'contractor', preState: 'funded', postState: 'awaiting_settlement' },
    { name: 'confirm_settlement', description: 'Órgão pagou — libera valor cheio pro investidor + sobra pra empresa', callableBy: 'funder | oracle', preState: 'awaiting_settlement', postState: 'settled' },
    { name: 'mark_overdue', description: 'Marca como atrasado após vencimento', callableBy: 'anyone', preState: 'awaiting_settlement', postState: 'overdue' },
    { name: 'trigger_default', description: 'Aciona garantias e default', callableBy: 'funder', preState: 'overdue', postState: 'default' },
  ],
  generateSoroban: (v) => {
    const face = parseFloat(v.faceValue || '0');
    const rate = parseFloat(v.advanceRate || '2.4');
    const tenor = parseFloat(v.tenorDays || '75');
    const discount = face * (rate / 100) * (tenor / 30);
    const advance = Math.max(face - discount, 0);
    return `${head('bid_financing', 'Antecipação de Empenho Público')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum BidFinState { PendingFunding, Funded, AwaitingSettlement, Settled, Overdue, Default }

#[contracttype]
pub struct BidFinance {
    pub contractor: Address,
    pub funder: Address,
    pub face_value: i128,
    pub advance_value: i128,
    pub asset: Symbol,
    pub tenor_days: u32,
    pub funded_ts: u64,
    pub state: BidFinState,
}

const DATA: Symbol = symbol_short!("BIDFIN");

#[contract]
pub struct BidFinancingContract;

#[contractimpl]
impl BidFinancingContract {
    pub fn init(env: Env) {
        // TODO: init
        // Órgão: ${v.publicEntity || '(definir)'} · Empenho: ${v.empenhoNumber || '—'}
        // Face: ${face.toFixed(2)} ${v.asset || 'BRZ'} · Antecipação: ${advance.toFixed(2)} ${v.asset || 'BRZ'} (desconto: ${discount.toFixed(2)})
        // Prazo: ${v.tenorDays || '75'} dias · Taxa: ${v.advanceRate || '2.4'}% am
    }
    pub fn register_empenho(env: Env, doc_uri: soroban_sdk::String) { /* TODO */ }
    pub fn fund_advance(env: Env) { /* TODO: funder transfere advance_value p/ contractor */ }
    pub fn mark_in_settlement(env: Env) { /* TODO */ }
    pub fn confirm_settlement(env: Env, amount_received: i128) {
        // TODO: contractor (ou conta destino) recebeu face_value do órgão
        // libera face_value p/ funder · diferença (se houver) p/ contractor
    }
    pub fn mark_overdue(env: Env) { /* TODO */ }
    pub fn trigger_default(env: Env) { /* TODO: aciona garantias */ }
}
// Licitação: ${v.bidNumber || '—'} · Status entrega: ${v.deliveryStatus || '—'}
`;
  },
};

// ═════════════════════════════════════════════════════════════════════════
// 38. FINANCIAMENTO DE OBRA PRIVADA (NOTA + 20% EM 45D)
// ═════════════════════════════════════════════════════════════════════════
const privateConstructionFundingTemplate: SmartContractTemplate = {
  id: 'private_construction_funding',
  name: 'Financiamento de Obra Privada (NF + 20%/45d)',
  shortName: 'Obra Privada',
  description: 'Antecipação de obra privada lastreada em nota fiscal, com pagamento mínimo de 20% em 45 dias e saldo em até o prazo total acordado.',
  plainLanguage:
    'Construtora/empreiteira tem obra contratada e nota fiscal emitida pelo cliente final. Financiador antecipa o valor pra capital de giro. O cliente final paga 20% em 45 dias (gatilho obrigatório) e o saldo no prazo combinado. O contrato libera os valores automaticamente conforme cada parcela for paga.',
  icon: '🏗️',
  category: 'finance',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Construtora antecipa giro de obra residencial',
    'Empreiteira antecipa fluxo de obra comercial',
    'Reforma de grande porte com pagamento parcelado',
    'Fornecedor de serviços técnicos com NF + recebimento longo',
  ],
  variables: [
    { name: 'builder', label: 'Construtora / empreiteira', type: 'address', required: true },
    { name: 'funder', label: 'Financiador', type: 'address', required: true },
    { name: 'finalClient', label: 'Cliente final pagador', type: 'text', required: true, placeholder: 'Razão social do contratante da obra' },
    { name: 'asset', label: 'Moeda', type: 'select', options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'invoiceNumber', label: 'Nº da nota fiscal', type: 'text', required: true, placeholder: 'NF 023456' },
    { name: 'invoiceValue', label: 'Valor total da NF', type: 'amount', required: true, placeholder: '250000' },
    { name: 'firstInstallmentPct', label: '% 1ª parcela (mínimo 20)', type: 'number', required: true, defaultValue: '20' },
    { name: 'firstInstallmentDays', label: 'Prazo 1ª parcela (dias)', type: 'number', required: true, defaultValue: '45' },
    { name: 'totalTenorDays', label: 'Prazo total até quitação', type: 'number', required: true, defaultValue: '120' },
    { name: 'advanceRate', label: 'Taxa de antecipação (% am)', type: 'number', required: true, defaultValue: '2.8' },
    { name: 'projectAddress', label: 'Endereço da obra', type: 'text', placeholder: 'Rua, número, cidade' },
    { name: 'guarantee', label: 'Garantia adicional', type: 'select', options: ['Aval dos sócios', 'Alienação fiduciária', 'Seguro garantia', 'Nenhuma'] },
  ],
  states: [
    { id: 'registered', label: 'NF registrada', color: 'gray', description: 'Nota e obra cadastradas, aguardando funding' },
    { id: 'funded', label: 'Antecipado', color: 'blue', description: 'Financiador adiantou o valor pra construtora' },
    { id: 'first_paid', label: '1ª parcela liquidada', color: 'amber', description: 'Cliente pagou os 20% em 45d' },
    { id: 'fully_settled', label: 'Quitado', color: 'green', description: 'NF integralmente liquidada' },
    { id: 'overdue', label: 'Em atraso', color: 'red', description: 'Parcela em atraso' },
    { id: 'default', label: 'Inadimplência', color: 'red', description: 'Default — garantias acionadas' },
  ],
  actions: [
    { name: 'register_invoice', description: 'Construtora cadastra NF + cronograma', callableBy: 'builder', preState: 'registered', postState: 'registered' },
    { name: 'fund', description: 'Financiador adianta valor (NF descontada)', callableBy: 'funder', preState: 'registered', postState: 'funded' },
    { name: 'confirm_first_installment', description: 'Confirma 20% recebido em 45d', callableBy: 'funder | oracle', preState: 'funded', postState: 'first_paid' },
    { name: 'confirm_full_payment', description: 'Confirma quitação total', callableBy: 'funder | oracle', preState: 'first_paid', postState: 'fully_settled' },
    { name: 'mark_overdue', description: 'Marca atraso', callableBy: 'funder', preState: 'funded | first_paid', postState: 'overdue' },
    { name: 'trigger_default', description: 'Aciona garantias', callableBy: 'funder', preState: 'overdue', postState: 'default' },
  ],
  generateSoroban: (v) => {
    const face = parseFloat(v.invoiceValue || '0');
    const rate = parseFloat(v.advanceRate || '2.8');
    const tenor = parseFloat(v.totalTenorDays || '120');
    const discount = face * (rate / 100) * (tenor / 30);
    const advance = Math.max(face - discount, 0);
    const firstPct = parseFloat(v.firstInstallmentPct || '20');
    return `${head('private_construction_funding', 'Financiamento de Obra Privada')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ConstFinState { Registered, Funded, FirstPaid, FullySettled, Overdue, Default }

#[contracttype]
pub struct ConstructionFunding {
    pub builder: Address,
    pub funder: Address,
    pub invoice_value: i128,
    pub advance_value: i128,
    pub first_installment_value: i128,
    pub asset: Symbol,
    pub first_due_ts: u64,
    pub full_due_ts: u64,
    pub state: ConstFinState,
}

const DATA: Symbol = symbol_short!("CONFIN");

#[contract]
pub struct PrivateConstructionFundingContract;

#[contractimpl]
impl PrivateConstructionFundingContract {
    pub fn init(env: Env) {
        // TODO: init
        // NF: ${v.invoiceNumber || '—'} · Cliente final: ${v.finalClient || '—'}
        // Face: ${face.toFixed(2)} ${v.asset || 'BRZ'} · Antecipação: ${advance.toFixed(2)} (desconto: ${discount.toFixed(2)})
        // 1ª parcela: ${firstPct}% (= ${(face * firstPct / 100).toFixed(2)}) em ${v.firstInstallmentDays || '45'} dias
        // Quitação total em ${v.totalTenorDays || '120'} dias · Garantia: ${v.guarantee || '—'}
    }
    pub fn register_invoice(env: Env, doc_uri: soroban_sdk::String) { /* TODO */ }
    pub fn fund(env: Env) { /* TODO: funder transfere advance_value p/ builder */ }
    pub fn confirm_first_installment(env: Env, amount: i128) {
        // TODO: amount ≥ first_installment_value · libera proporcional p/ funder
    }
    pub fn confirm_full_payment(env: Env, amount: i128) {
        // TODO: liquidação total — funder recebe saldo do face_value
    }
    pub fn mark_overdue(env: Env) { /* TODO */ }
    pub fn trigger_default(env: Env) { /* TODO: aciona garantia (${v.guarantee || 'aval'}) */ }
}
// Obra: ${v.projectAddress || '(definir)'}
`;
  },
};

// ─── Export ─────────────────────────────────────────────────────────────

export const MARKETPLACE_TEMPLATES: SmartContractTemplate[] = [
  socialMediaManagementTemplate,
  designCreativeBriefTemplate,
  paidTrafficKpiTemplate,
  legalSimpleServiceTemplate,
  bidFinancingTemplate,
  privateConstructionFundingTemplate,
];
