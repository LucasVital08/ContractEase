/**
 * Extended Smart Contract Templates — ContractEase
 *
 * Catálogo expandido de modelos para profissionais, construção civil,
 * veículos, RWA (Real World Assets), tokenização e registros civis on-chain.
 *
 * 22 modelos novos divididos em 5 categorias:
 *
 *  Profissional (5):
 *    11. legal_fees           Honorários Advocatícios (parcelado + êxito)
 *    12. medical_consultation Plano de Consultas Médicas
 *    13. dental_treatment     Tratamento Odontológico por Etapa
 *    14. accounting_services  Honorários Contábeis Mensais
 *    15. psychology_package   Pacote de Sessões de Psicologia
 *
 *  Construção & Reforma (3):
 *    16. construction_contract Empreitada de Obra com Marcos
 *    17. architectural_project Projeto Arquitetônico em Fases
 *    18. renovation_milestone  Reforma com Pagamento por Etapa
 *
 *  Veículos (3):
 *    19. vehicle_sale         Compra e Venda de Veículo com Escrow
 *    20. vehicle_lease        Financiamento de Veículo com Alienação
 *    21. car_rental_daily     Locação Diária de Veículo
 *
 *  RWA & Tokenização (4):
 *    22. real_estate_token    Tokenização Imobiliária (cotas fracionárias)
 *    23. commodity_token      Tokenização de Commodities Agrícolas
 *    24. carbon_credits       Créditos de Carbono Tokenizados
 *    25. solar_yield_token    Tokenização de Geração Solar
 *
 *  Registros Civis (5):
 *    26. birth_registry       Registro de Nascimento on-chain
 *    27. marriage_contract    Contrato de União / Casamento
 *    28. divorce_settlement   Acordo de Divórcio
 *    29. death_certificate    Certidão de Óbito on-chain
 *    30. notarized_declaration Declaração Notarial Genérica
 *
 *  Imóveis adicionais (2):
 *    31. commercial_rent      Aluguel Comercial
 *    32. short_stay           Aluguel por Temporada
 *
 * Todos os templates são skeleton-ready: a UI funciona end-to-end,
 * e o Soroban gerado já tem a estrutura base (states + actions) pronta
 * para extensão com lógica específica.
 */

import type { SmartContractTemplate } from './smartContractTemplates';

// ─── Helper para cabeçalho Soroban ──────────────────────────────────
const head = (id: string, name: string) => `// ──────────────────────────────────────────────────────────────
// Stellar Soroban Smart Contract — ${name}
// Gerado pelo ContractEase · Template ID: ${id}
// Compilar com: cargo build --target wasm32-unknown-unknown --release
// ──────────────────────────────────────────────────────────────

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};
`;

// ═════════════════════════════════════════════════════════════════════════
// PROFISSIONAL
// ═════════════════════════════════════════════════════════════════════════

const legalFeesTemplate: SmartContractTemplate = {
  id: 'legal_fees',
  name: 'Honorários Advocatícios',
  shortName: 'Honorários',
  description: 'Contrato de honorários com parcela fixa + percentual de êxito (quota litis).',
  plainLanguage:
    'Cliente paga uma entrada e parcelas mensais durante o andamento do processo. Se houver êxito (ganho/acordo), o contrato libera automaticamente o percentual combinado de êxito para o advogado, com base no valor recuperado.',
  icon: '⚖️',
  category: 'professional',
  difficulty: 'Intermediário',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Causas trabalhistas com expectativa de acordo',
    'Ações cíveis indenizatórias',
    'Recuperação tributária com êxito proporcional',
    'Inventários e partilhas com honorários condicionais',
  ],
  variables: [
    { name: 'lawyer', label: 'Advogado(a)', type: 'address', required: true, helper: 'OAB cadastrada na carteira Stellar' },
    { name: 'client', label: 'Cliente', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'retainerAmount', label: 'Entrada (R$)', type: 'amount', required: true, helper: 'Valor pago no ato da assinatura' },
    { name: 'monthlyFee', label: 'Honorário mensal', type: 'amount', required: true, helper: 'Mensalidade durante o processo' },
    { name: 'durationMonths', label: 'Duração estimada (meses)', type: 'number', required: true, defaultValue: '12' },
    { name: 'successRate', label: 'Êxito (%)', type: 'number', required: true, helper: 'Quota litis — % do valor recuperado', defaultValue: '20' },
    { name: 'caseDescription', label: 'Objeto do processo', type: 'text', helper: 'Ex: Ação trabalhista 0001234-56.2026', placeholder: 'Ação trabalhista contra Empresa X' },
  ],
  states: [
    { id: 'signed', label: 'Assinado', color: 'gray', description: 'Contrato firmado, aguardando início' },
    { id: 'in_progress', label: 'Em andamento', color: 'blue', description: 'Processo em curso com cobranças mensais' },
    { id: 'success', label: 'Êxito', color: 'green', description: 'Ganho/acordo registrado — êxito a liberar' },
    { id: 'closed_no_success', label: 'Encerrado sem êxito', color: 'amber', description: 'Sem êxito — apenas mensalidades mantidas' },
    { id: 'terminated', label: 'Distratado', color: 'red', description: 'Rescindido por uma das partes' },
  ],
  actions: [
    { name: 'pay_retainer', description: 'Pagamento da entrada', callableBy: 'client', preState: 'signed', postState: 'in_progress' },
    { name: 'pay_monthly', description: 'Mensalidade automática', callableBy: 'anyone', preState: 'in_progress', postState: 'in_progress' },
    { name: 'register_success', description: 'Lavra o ganho/acordo on-chain', callableBy: 'lawyer + client', preState: 'in_progress', postState: 'success' },
    { name: 'release_success_fee', description: 'Libera o percentual de êxito', callableBy: 'anyone', preState: 'success', postState: 'closed_no_success' },
    { name: 'close_no_success', description: 'Encerra sem êxito', callableBy: 'lawyer + client', preState: 'in_progress', postState: 'closed_no_success' },
  ],
  generateSoroban: (v) => `${head('legal_fees', 'Honorários Advocatícios')}
#[contract]
pub struct LegalFees;

#[contractimpl]
impl LegalFees {
    pub fn init(env: Env) {
        // Advogado: ${v.lawyer || 'G...'} · Cliente: ${v.client || 'G...'}
        // Entrada: ${v.retainerAmount || '0'} ${v.asset || 'BRZ'}
        // Mensal: ${v.monthlyFee || '0'} ${v.asset || 'BRZ'} por ${v.durationMonths || '12'} meses
        // Êxito: ${v.successRate || '20'}% sobre o valor recuperado
        // Objeto: ${v.caseDescription || '...'}
    }

    pub fn pay_retainer(env: Env) { /* TODO: client → lawyer */ }
    pub fn pay_monthly(env: Env) { /* TODO: cobrança mensal */ }
    pub fn register_success(env: Env, recovered_amount: i128) { /* TODO: assinatura dupla */ }
    pub fn release_success_fee(env: Env) { /* TODO: % do recovered_amount → lawyer */ }
    pub fn close_no_success(env: Env) { /* TODO: encerramento sem êxito */ }
}
`,
};

const medicalConsultationTemplate: SmartContractTemplate = {
  id: 'medical_consultation',
  name: 'Plano de Consultas Médicas',
  shortName: 'Consultas',
  description: 'Pacote pré-pago de consultas médicas com débito por uso e devolução do saldo.',
  plainLanguage:
    'Paciente paga antecipadamente por um pacote de N consultas. Cada vez que comparece, o médico assina um recibo on-chain que libera uma fração do valor. Se sobrarem créditos no fim do prazo, o contrato devolve o saldo automaticamente.',
  icon: '🩺',
  category: 'professional',
  difficulty: 'Iniciante',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Acompanhamento de gestação (pré-natal completo)',
    'Pacote anual de check-up empresarial',
    'Atendimento especializado (cardio, dermato)',
    'Plano de pediatria mensal para famílias',
  ],
  variables: [
    { name: 'doctor', label: 'Médico(a)', type: 'address', required: true, helper: 'CRM cadastrado' },
    { name: 'patient', label: 'Paciente', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'consultationPrice', label: 'Valor por consulta', type: 'amount', required: true },
    { name: 'totalConsultations', label: 'Total de consultas', type: 'number', required: true, defaultValue: '10' },
    { name: 'validUntil', label: 'Vencimento do pacote', type: 'date', required: true, helper: 'Créditos não utilizados após esta data são devolvidos' },
    { name: 'specialty', label: 'Especialidade', type: 'text', placeholder: 'Cardiologia, Pediatria...' },
  ],
  states: [
    { id: 'active', label: 'Ativo', color: 'green', description: 'Pacote em uso' },
    { id: 'depleted', label: 'Esgotado', color: 'gray', description: 'Todas as consultas utilizadas' },
    { id: 'expired_refund', label: 'Vencido — saldo devolvido', color: 'amber', description: 'Pacote vencido, saldo retornado ao paciente' },
  ],
  actions: [
    { name: 'use_consultation', description: 'Registra uma consulta realizada', callableBy: 'doctor + patient', preState: 'active', postState: 'active' },
    { name: 'expire_and_refund', description: 'Vence o pacote e devolve saldo', callableBy: 'anyone', preState: 'active', postState: 'expired_refund' },
  ],
  generateSoroban: (v) => `${head('medical_consultation', 'Plano de Consultas Médicas')}
#[contract]
pub struct MedicalPackage;

#[contractimpl]
impl MedicalPackage {
    pub fn init(env: Env) {
        // Médico: ${v.doctor || 'G...'} · Paciente: ${v.patient || 'G...'}
        // ${v.totalConsultations || '10'} consultas de ${v.consultationPrice || '0'} ${v.asset || 'BRZ'}
        // Especialidade: ${v.specialty || '—'} · Validade: ${v.validUntil || '(a definir)'}
    }
    pub fn use_consultation(env: Env) { /* TODO: assinatura dupla, debita 1 consulta */ }
    pub fn expire_and_refund(env: Env) { /* TODO: devolve saldo restante ao paciente */ }
}
`,
};

const dentalTreatmentTemplate: SmartContractTemplate = {
  id: 'dental_treatment',
  name: 'Tratamento Odontológico por Etapa',
  shortName: 'Odonto',
  description: 'Plano odontológico parcelado, com liberação por procedimento concluído.',
  plainLanguage:
    'Paciente trava o valor total do tratamento (ex: ortodontia, implante, prótese). A cada etapa concluída e validada por ambas as partes, o contrato libera a parcela correspondente para o dentista.',
  icon: '🦷',
  category: 'professional',
  difficulty: 'Intermediário',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Ortodontia (instalação, manutenções, remoção)',
    'Implante dental (cirurgia, cicatrização, prótese)',
    'Tratamento de canal multi-sessão',
    'Reabilitação oral completa',
  ],
  variables: [
    { name: 'dentist', label: 'Dentista', type: 'address', required: true },
    { name: 'patient', label: 'Paciente', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'totalAmount', label: 'Valor total', type: 'amount', required: true },
    { name: 'stagesCount', label: 'Quantidade de etapas', type: 'number', required: true, defaultValue: '4' },
    { name: 'treatmentType', label: 'Tipo de tratamento', type: 'text', placeholder: 'Ortodontia, Implante...', required: true },
  ],
  states: [
    { id: 'funded', label: 'Provisionado', color: 'gray', description: 'Valor total bloqueado' },
    { id: 'in_treatment', label: 'Em tratamento', color: 'blue', description: 'Etapas em andamento' },
    { id: 'completed', label: 'Concluído', color: 'green', description: 'Todas as etapas validadas' },
    { id: 'cancelled', label: 'Cancelado', color: 'red', description: 'Tratamento interrompido' },
  ],
  actions: [
    { name: 'fund', description: 'Paciente trava o valor total', callableBy: 'patient', preState: 'funded', postState: 'in_treatment' },
    { name: 'complete_stage', description: 'Confirma etapa concluída e libera parcela', callableBy: 'dentist + patient', preState: 'in_treatment', postState: 'in_treatment' },
    { name: 'cancel', description: 'Cancela tratamento e devolve saldo', callableBy: 'patient', preState: 'in_treatment', postState: 'cancelled' },
  ],
  generateSoroban: (v) => `${head('dental_treatment', 'Tratamento Odontológico')}
#[contract]
pub struct DentalTreatment;

#[contractimpl]
impl DentalTreatment {
    pub fn init(env: Env) {
        // Dentista: ${v.dentist || 'G...'} · Paciente: ${v.patient || 'G...'}
        // Tratamento: ${v.treatmentType || '—'} · ${v.stagesCount || '4'} etapas
        // Total: ${v.totalAmount || '0'} ${v.asset || 'BRZ'}
    }
    pub fn fund(env: Env) { /* TODO: patient deposita totalAmount */ }
    pub fn complete_stage(env: Env, stage_idx: u32) { /* TODO: assinatura dupla, libera parcela */ }
    pub fn cancel(env: Env) { /* TODO: devolve saldo proporcional */ }
}
`,
};

const accountingServicesTemplate: SmartContractTemplate = {
  id: 'accounting_services',
  name: 'Honorários Contábeis Mensais',
  shortName: 'Contábil',
  description: 'Mensalidade contábil com cobrança automática e SLA de entrega.',
  plainLanguage:
    'Empresa paga mensalmente seu escritório contábil. Cada mensalidade só é liberada quando o contador confirma que entregou as obrigações daquele mês (folha, DCTF, balancete). Se atrasar, o pagamento fica retido.',
  icon: '📊',
  category: 'professional',
  difficulty: 'Intermediário',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Contabilidade mensal de PMEs',
    'BPO financeiro com SLA',
    'Folha de pagamento terceirizada',
    'Compliance fiscal recorrente',
  ],
  variables: [
    { name: 'accountant', label: 'Contador', type: 'address', required: true },
    { name: 'company', label: 'Empresa cliente', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'monthlyFee', label: 'Honorário mensal', type: 'amount', required: true },
    { name: 'deliveryDeadline', label: 'Prazo de entrega (dia do mês)', type: 'number', required: true, defaultValue: '15' },
    { name: 'durationMonths', label: 'Vigência (meses)', type: 'number', required: true, defaultValue: '12' },
  ],
  states: [
    { id: 'pending_delivery', label: 'Aguardando entrega', color: 'amber', description: 'Mês corrente — contador deve confirmar entregas' },
    { id: 'paid', label: 'Pago', color: 'green', description: 'Mês liberado para o contador' },
    { id: 'overdue', label: 'Atrasado', color: 'red', description: 'Prazo de entrega vencido' },
    { id: 'closed', label: 'Encerrado', color: 'gray', description: 'Contrato finalizado' },
  ],
  actions: [
    { name: 'confirm_delivery', description: 'Contador confirma entrega do mês', callableBy: 'accountant', preState: 'pending_delivery', postState: 'paid' },
    { name: 'mark_overdue', description: 'Marca mês como atrasado', callableBy: 'company', preState: 'pending_delivery', postState: 'overdue' },
  ],
  generateSoroban: (v) => `${head('accounting_services', 'Honorários Contábeis')}
#[contract]
pub struct AccountingServices;

#[contractimpl]
impl AccountingServices {
    pub fn init(env: Env) {
        // Contador: ${v.accountant || 'G...'} · Empresa: ${v.company || 'G...'}
        // Mensal: ${v.monthlyFee || '0'} ${v.asset || 'BRZ'} · ${v.durationMonths || '12'} meses
        // SLA: entrega até dia ${v.deliveryDeadline || '15'}
    }
    pub fn confirm_delivery(env: Env, month: u32) { /* TODO: accountant assinatura → libera mês */ }
    pub fn mark_overdue(env: Env, month: u32) { /* TODO: company marca atraso */ }
}
`,
};

const psychologyPackageTemplate: SmartContractTemplate = {
  id: 'psychology_package',
  name: 'Pacote de Sessões de Psicologia',
  shortName: 'Psicologia',
  description: 'Pacote de N sessões pré-pagas com sigilo profissional e devolução de saldo.',
  plainLanguage:
    'Paciente compra um pacote de sessões (geralmente 4, 8 ou 12). A cada sessão realizada, o contrato libera o valor da consulta para o(a) psicólogo(a). O conteúdo da sessão nunca vai para a blockchain — apenas o registro de que ocorreu.',
  icon: '🧠',
  category: 'professional',
  difficulty: 'Iniciante',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Terapia individual com plano mensal/trimestral',
    'Acompanhamento psicológico empresarial (RH)',
    'Casais e família com pacotes fechados',
    'Atendimento de crianças/adolescentes',
  ],
  variables: [
    { name: 'psychologist', label: 'Psicólogo(a)', type: 'address', required: true, helper: 'CRP cadastrado' },
    { name: 'patient', label: 'Paciente', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'sessionPrice', label: 'Valor por sessão', type: 'amount', required: true },
    { name: 'totalSessions', label: 'Quantidade de sessões', type: 'number', required: true, defaultValue: '8' },
    { name: 'validityMonths', label: 'Validade (meses)', type: 'number', required: true, defaultValue: '6' },
  ],
  states: [
    { id: 'active', label: 'Ativo', color: 'green', description: 'Em uso' },
    { id: 'depleted', label: 'Concluído', color: 'gray', description: 'Todas as sessões realizadas' },
    { id: 'expired', label: 'Expirado', color: 'amber', description: 'Saldo devolvido por vencimento' },
  ],
  actions: [
    { name: 'use_session', description: 'Registra sessão realizada', callableBy: 'psychologist + patient', preState: 'active', postState: 'active' },
    { name: 'expire', description: 'Vence pacote e devolve saldo', callableBy: 'anyone', preState: 'active', postState: 'expired' },
  ],
  generateSoroban: (v) => `${head('psychology_package', 'Pacote de Psicologia')}
#[contract]
pub struct PsychologyPackage;

#[contractimpl]
impl PsychologyPackage {
    pub fn init(env: Env) {
        // Psicólogo(a): ${v.psychologist || 'G...'} · Paciente: ${v.patient || 'G...'}
        // ${v.totalSessions || '8'} sessões de ${v.sessionPrice || '0'} ${v.asset || 'BRZ'}
        // Validade: ${v.validityMonths || '6'} meses
    }
    pub fn use_session(env: Env) { /* TODO: dupla assinatura → libera 1 sessão */ }
    pub fn expire(env: Env) { /* TODO: devolve saldo remanescente */ }
}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// CONSTRUÇÃO & REFORMA
// ═════════════════════════════════════════════════════════════════════════

const constructionContractTemplate: SmartContractTemplate = {
  id: 'construction_contract',
  name: 'Empreitada de Obra com Marcos',
  shortName: 'Empreitada',
  description: 'Construção civil com pagamento por marcos físicos da obra (fundação, alvenaria, acabamento).',
  plainLanguage:
    'Contratante trava o valor total da obra. A cada marco físico concluído (fundação pronta, estrutura erguida, cobertura, acabamento), o engenheiro responsável assina e o contrato libera a parcela correspondente para a construtora. Inclui retenção de garantia (caução).',
  icon: '🏗️',
  category: 'construction',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Construção residencial unifamiliar',
    'Galpão industrial / comercial',
    'Reforma estrutural de grande porte',
    'Loteamento e infraestrutura urbana',
  ],
  variables: [
    { name: 'contractor', label: 'Construtora', type: 'address', required: true },
    { name: 'client', label: 'Contratante', type: 'address', required: true },
    { name: 'engineer', label: 'Engenheiro responsável', type: 'address', required: true, helper: 'CREA — assina cada marco' },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'totalValue', label: 'Valor total da obra', type: 'amount', required: true },
    { name: 'milestonesCount', label: 'Número de marcos', type: 'number', required: true, defaultValue: '5' },
    { name: 'retentionPct', label: 'Retenção de garantia (%)', type: 'number', required: true, defaultValue: '5', helper: 'Liberada após 90 dias sem vícios' },
    { name: 'workAddress', label: 'Endereço da obra', type: 'text', required: true },
  ],
  states: [
    { id: 'funded', label: 'Provisionado', color: 'gray', description: 'Valor total bloqueado' },
    { id: 'in_progress', label: 'Em execução', color: 'blue', description: 'Marcos sendo entregues' },
    { id: 'completed', label: 'Obra concluída', color: 'green', description: 'Habite-se / aceite final' },
    { id: 'warranty', label: 'Garantia ativa', color: 'amber', description: '90 dias de carência da retenção' },
    { id: 'closed', label: 'Encerrado', color: 'green', description: 'Retenção liberada' },
  ],
  actions: [
    { name: 'sign_milestone', description: 'Engenheiro assina marco concluído', callableBy: 'engineer', preState: 'in_progress', postState: 'in_progress' },
    { name: 'release_milestone', description: 'Libera parcela do marco', callableBy: 'client', preState: 'in_progress', postState: 'in_progress' },
    { name: 'accept_work', description: 'Aceite final da obra', callableBy: 'client', preState: 'in_progress', postState: 'warranty' },
    { name: 'release_retention', description: 'Libera retenção após carência', callableBy: 'anyone', preState: 'warranty', postState: 'closed' },
  ],
  generateSoroban: (v) => `${head('construction_contract', 'Empreitada de Obra')}
#[contract]
pub struct ConstructionContract;

#[contractimpl]
impl ConstructionContract {
    pub fn init(env: Env) {
        // Construtora: ${v.contractor || 'G...'} · Contratante: ${v.client || 'G...'}
        // Engenheiro: ${v.engineer || 'G...'}
        // Obra: ${v.workAddress || '—'}
        // Total: ${v.totalValue || '0'} ${v.asset || 'BRZ'} em ${v.milestonesCount || '5'} marcos
        // Retenção: ${v.retentionPct || '5'}% liberada após 90 dias
    }
    pub fn sign_milestone(env: Env, idx: u32) { /* TODO: engineer assinatura */ }
    pub fn release_milestone(env: Env, idx: u32) { /* TODO: libera parcela - retenção */ }
    pub fn accept_work(env: Env) { /* TODO: aceite client → warranty */ }
    pub fn release_retention(env: Env) { /* TODO: ledger.timestamp >= warranty_end */ }
}
`,
};

const architecturalProjectTemplate: SmartContractTemplate = {
  id: 'architectural_project',
  name: 'Projeto Arquitetônico em Fases',
  shortName: 'Arquitetura',
  description: 'Projeto arquitetônico dividido em estudo preliminar, anteprojeto e executivo.',
  plainLanguage:
    'Cliente paga o projeto em três fases: estudo preliminar (esboço), anteprojeto (plantas) e projeto executivo (detalhamento). A cada fase aprovada pelo cliente, o arquiteto recebe a parcela correspondente.',
  icon: '📐',
  category: 'construction',
  difficulty: 'Intermediário',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Projeto residencial completo',
    'Arquitetura comercial / corporativa',
    'Interiores e reforma com projeto',
    'Aprovação em órgãos públicos (alvará)',
  ],
  variables: [
    { name: 'architect', label: 'Arquiteto(a)', type: 'address', required: true, helper: 'CAU cadastrado' },
    { name: 'client', label: 'Cliente', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'totalFee', label: 'Honorário total', type: 'amount', required: true },
    { name: 'preliminaryPct', label: 'Estudo preliminar (%)', type: 'number', required: true, defaultValue: '20' },
    { name: 'preProjectPct', label: 'Anteprojeto (%)', type: 'number', required: true, defaultValue: '40' },
    { name: 'executivePct', label: 'Executivo (%)', type: 'number', required: true, defaultValue: '40' },
    { name: 'projectDescription', label: 'Descrição do projeto', type: 'text', placeholder: 'Casa térrea 180m² em condomínio...' },
  ],
  states: [
    { id: 'phase_1', label: 'Fase 1 — Estudo', color: 'gray', description: 'Estudo preliminar em desenvolvimento' },
    { id: 'phase_2', label: 'Fase 2 — Anteprojeto', color: 'blue', description: 'Plantas em desenvolvimento' },
    { id: 'phase_3', label: 'Fase 3 — Executivo', color: 'purple', description: 'Detalhamento técnico' },
    { id: 'delivered', label: 'Entregue', color: 'green', description: 'Projeto completo aprovado' },
  ],
  actions: [
    { name: 'approve_preliminary', description: 'Cliente aprova estudo', callableBy: 'client', preState: 'phase_1', postState: 'phase_2' },
    { name: 'approve_preproject', description: 'Cliente aprova anteprojeto', callableBy: 'client', preState: 'phase_2', postState: 'phase_3' },
    { name: 'approve_executive', description: 'Cliente aprova executivo', callableBy: 'client', preState: 'phase_3', postState: 'delivered' },
  ],
  generateSoroban: (v) => `${head('architectural_project', 'Projeto Arquitetônico')}
#[contract]
pub struct ArchitecturalProject;

#[contractimpl]
impl ArchitecturalProject {
    pub fn init(env: Env) {
        // Arquiteto: ${v.architect || 'G...'} · Cliente: ${v.client || 'G...'}
        // Projeto: ${v.projectDescription || '—'}
        // Honorário: ${v.totalFee || '0'} ${v.asset || 'BRZ'}
        // Distribuição: ${v.preliminaryPct || '20'}% / ${v.preProjectPct || '40'}% / ${v.executivePct || '40'}%
    }
    pub fn approve_preliminary(env: Env) { /* TODO: libera %1 → architect */ }
    pub fn approve_preproject(env: Env) { /* TODO: libera %2 */ }
    pub fn approve_executive(env: Env) { /* TODO: libera %3 + encerra */ }
}
`,
};

const renovationMilestoneTemplate: SmartContractTemplate = {
  id: 'renovation_milestone',
  name: 'Reforma com Pagamento por Etapa',
  shortName: 'Reforma',
  description: 'Reforma de imóvel com pagamento liberado por etapa concluída e validada com foto.',
  plainLanguage:
    'Proprietário trava o valor da reforma. Cada etapa (demolição, hidráulica, elétrica, acabamento) é concluída pelo empreiteiro e validada com upload de foto. O contrato libera a parcela depois da validação.',
  icon: '🔨',
  category: 'construction',
  difficulty: 'Intermediário',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Reforma de cozinha / banheiro',
    'Pintura e acabamento residencial',
    'Adaptação de espaço comercial',
    'Manutenção predial preventiva',
  ],
  variables: [
    { name: 'contractor', label: 'Empreiteiro', type: 'address', required: true },
    { name: 'owner', label: 'Proprietário', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'totalValue', label: 'Valor total', type: 'amount', required: true },
    { name: 'stagesCount', label: 'Etapas', type: 'number', required: true, defaultValue: '4' },
    { name: 'deadlineDays', label: 'Prazo total (dias)', type: 'number', required: true, defaultValue: '60' },
  ],
  states: [
    { id: 'funded', label: 'Provisionado', color: 'gray', description: 'Valor bloqueado' },
    { id: 'in_progress', label: 'Em execução', color: 'blue', description: 'Etapas em andamento' },
    { id: 'completed', label: 'Concluída', color: 'green', description: 'Reforma entregue' },
    { id: 'disputed', label: 'Em disputa', color: 'red', description: 'Discordância sobre alguma etapa' },
  ],
  actions: [
    { name: 'complete_stage', description: 'Empreiteiro conclui etapa', callableBy: 'contractor', preState: 'in_progress', postState: 'in_progress' },
    { name: 'approve_stage', description: 'Proprietário valida com foto', callableBy: 'owner', preState: 'in_progress', postState: 'in_progress' },
    { name: 'dispute', description: 'Abre disputa', callableBy: 'owner | contractor', preState: 'in_progress', postState: 'disputed' },
  ],
  generateSoroban: (v) => `${head('renovation_milestone', 'Reforma por Etapa')}
#[contract]
pub struct RenovationMilestone;

#[contractimpl]
impl RenovationMilestone {
    pub fn init(env: Env) {
        // Empreiteiro: ${v.contractor || 'G...'} · Proprietário: ${v.owner || 'G...'}
        // ${v.totalValue || '0'} ${v.asset || 'BRZ'} em ${v.stagesCount || '4'} etapas · Prazo: ${v.deadlineDays || '60'} dias
    }
    pub fn complete_stage(env: Env, idx: u32, photo_hash: soroban_sdk::Bytes) { /* TODO */ }
    pub fn approve_stage(env: Env, idx: u32) { /* TODO: libera parcela */ }
    pub fn dispute(env: Env, idx: u32) { /* TODO: trava etapa em disputa */ }
}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// VEÍCULOS
// ═════════════════════════════════════════════════════════════════════════

const vehicleSaleTemplate: SmartContractTemplate = {
  id: 'vehicle_sale',
  name: 'Compra e Venda de Veículo',
  shortName: 'Venda Veículo',
  description: 'Compra de veículo com escrow do valor e liberação após transferência no Detran.',
  plainLanguage:
    'Comprador deposita o valor do veículo no contrato. O vendedor entrega o carro e inicia a transferência no Detran. Quando o novo CRLV-e sai em nome do comprador (validado por oráculo Detran), o contrato libera o pagamento para o vendedor.',
  icon: '🚗',
  category: 'automotive',
  difficulty: 'Intermediário',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'Compra de carro entre particulares (evita golpe)',
    'Revenda de seminovos com garantia de transferência',
    'Importação direta com escrow internacional',
    'Trade-in entre concessionárias',
  ],
  variables: [
    { name: 'seller', label: 'Vendedor', type: 'address', required: true },
    { name: 'buyer', label: 'Comprador', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'price', label: 'Valor da venda', type: 'amount', required: true },
    { name: 'plate', label: 'Placa', type: 'text', required: true, placeholder: 'ABC1D23' },
    { name: 'renavam', label: 'RENAVAM', type: 'text', required: true },
    { name: 'vehicleDescription', label: 'Modelo / ano', type: 'text', required: true, placeholder: 'Honda Civic LX 2020' },
    { name: 'transferDeadline', label: 'Prazo para transferência (dias)', type: 'number', required: true, defaultValue: '30' },
  ],
  states: [
    { id: 'escrowed', label: 'Em escrow', color: 'gray', description: 'Comprador depositou, aguardando transferência' },
    { id: 'transferring', label: 'Transferindo', color: 'blue', description: 'Documentação em andamento no Detran' },
    { id: 'completed', label: 'Concluída', color: 'green', description: 'Veículo em nome do comprador, valor liberado' },
    { id: 'cancelled', label: 'Cancelada', color: 'red', description: 'Devolvido por inadimplência ou problema' },
  ],
  actions: [
    { name: 'deposit', description: 'Comprador deposita o valor', callableBy: 'buyer', preState: 'escrowed', postState: 'transferring' },
    { name: 'confirm_transfer', description: 'Oráculo Detran confirma nova titularidade', callableBy: 'oracle', preState: 'transferring', postState: 'completed' },
    { name: 'cancel', description: 'Cancela e devolve o valor', callableBy: 'buyer + seller', preState: 'transferring', postState: 'cancelled' },
  ],
  generateSoroban: (v) => `${head('vehicle_sale', 'Compra e Venda de Veículo')}
#[contract]
pub struct VehicleSale;

#[contractimpl]
impl VehicleSale {
    pub fn init(env: Env) {
        // Vendedor: ${v.seller || 'G...'} · Comprador: ${v.buyer || 'G...'}
        // ${v.vehicleDescription || '—'} · Placa: ${v.plate || '—'} · RENAVAM: ${v.renavam || '—'}
        // Valor: ${v.price || '0'} ${v.asset || 'BRZ'} · Prazo: ${v.transferDeadline || '30'} dias
    }
    pub fn deposit(env: Env) { /* TODO: buyer deposita price */ }
    pub fn confirm_transfer(env: Env, new_crlv_hash: soroban_sdk::Bytes) { /* TODO: validar oráculo */ }
    pub fn cancel(env: Env) { /* TODO: devolve buyer */ }
}
`,
};

const vehicleLeaseTemplate: SmartContractTemplate = {
  id: 'vehicle_lease',
  name: 'Financiamento de Veículo com Alienação',
  shortName: 'Financiamento',
  description: 'Compra parcelada com alienação fiduciária registrada on-chain.',
  plainLanguage:
    'Comprador paga entrada + parcelas mensais. O veículo fica alienado ao credor (banco/financeira) até a quitação. Se o comprador atrasar mais de 60 dias, o contrato registra a inadimplência e permite a busca e apreensão.',
  icon: '🚙',
  category: 'automotive',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Financiamento direto sem banco intermediário',
    'CDC de concessionária com transparência',
    'Consórcio contemplado',
    'Crédito P2P para veículos',
  ],
  variables: [
    { name: 'lender', label: 'Credor', type: 'address', required: true },
    { name: 'buyer', label: 'Comprador', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'downPayment', label: 'Entrada', type: 'amount', required: true },
    { name: 'monthlyInstallment', label: 'Parcela mensal', type: 'amount', required: true },
    { name: 'installmentsCount', label: 'Número de parcelas', type: 'number', required: true, defaultValue: '36' },
    { name: 'interestRate', label: 'Taxa de juros (% a.m.)', type: 'number', required: true, defaultValue: '1.5' },
    { name: 'plate', label: 'Placa', type: 'text', required: true },
  ],
  states: [
    { id: 'active', label: 'Em pagamento', color: 'blue', description: 'Parcelas em curso' },
    { id: 'overdue', label: 'Inadimplente', color: 'amber', description: 'Atrasado +30 dias' },
    { id: 'repossession', label: 'Busca e apreensão', color: 'red', description: 'Atrasado +60 dias' },
    { id: 'paid_off', label: 'Quitado', color: 'green', description: 'Alienação liberada' },
  ],
  actions: [
    { name: 'pay_installment', description: 'Paga parcela mensal', callableBy: 'anyone', preState: 'active', postState: 'active' },
    { name: 'mark_overdue', description: 'Marca inadimplência', callableBy: 'lender', preState: 'active', postState: 'overdue' },
    { name: 'trigger_repossession', description: 'Aciona busca e apreensão', callableBy: 'lender', preState: 'overdue', postState: 'repossession' },
    { name: 'pay_off', description: 'Quitação antecipada', callableBy: 'buyer', preState: 'active', postState: 'paid_off' },
  ],
  generateSoroban: (v) => `${head('vehicle_lease', 'Financiamento de Veículo')}
#[contract]
pub struct VehicleLease;

#[contractimpl]
impl VehicleLease {
    pub fn init(env: Env) {
        // Credor: ${v.lender || 'G...'} · Comprador: ${v.buyer || 'G...'}
        // Placa: ${v.plate || '—'}
        // Entrada: ${v.downPayment || '0'} + ${v.installmentsCount || '36'}x ${v.monthlyInstallment || '0'} ${v.asset || 'BRZ'}
        // Juros: ${v.interestRate || '1.5'}% a.m.
    }
    pub fn pay_installment(env: Env, n: u32) { /* TODO: buyer → lender */ }
    pub fn mark_overdue(env: Env) { /* TODO: lender após D+30 */ }
    pub fn trigger_repossession(env: Env) { /* TODO: D+60 */ }
    pub fn pay_off(env: Env) { /* TODO: quitação + liberação alienação */ }
}
`,
};

const carRentalDailyTemplate: SmartContractTemplate = {
  id: 'car_rental_daily',
  name: 'Locação Diária de Veículo',
  shortName: 'Locação',
  description: 'Aluguel de veículo por dia com caução e cobrança automática.',
  plainLanguage:
    'Locatário trava o valor da locação + caução. O contrato libera o valor da diária para a locadora a cada dia decorrido. No fim, locadora vistoria o veículo: sem dano, a caução volta integral; com dano, parte é retida.',
  icon: '🔑',
  category: 'automotive',
  difficulty: 'Iniciante',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Locadoras P2P (Turo, Movida)',
    'Aluguel para viagem / fim de semana',
    'Veículo executivo para empresas',
    'Substituto durante manutenção',
  ],
  variables: [
    { name: 'rental_company', label: 'Locadora', type: 'address', required: true },
    { name: 'renter', label: 'Locatário', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'dailyRate', label: 'Diária', type: 'amount', required: true },
    { name: 'rentalDays', label: 'Dias de locação', type: 'number', required: true, defaultValue: '7' },
    { name: 'depositAmount', label: 'Caução', type: 'amount', required: true },
    { name: 'plate', label: 'Placa', type: 'text', required: true },
    { name: 'pickupDate', label: 'Data de retirada', type: 'date', required: true },
  ],
  states: [
    { id: 'reserved', label: 'Reservado', color: 'gray', description: 'Caução depositada, aguardando retirada' },
    { id: 'active', label: 'Em locação', color: 'blue', description: 'Veículo retirado' },
    { id: 'returned', label: 'Devolvido', color: 'amber', description: 'Aguardando vistoria' },
    { id: 'closed_clean', label: 'Encerrado sem dano', color: 'green', description: 'Caução devolvida integralmente' },
    { id: 'closed_damaged', label: 'Encerrado com retenção', color: 'red', description: 'Parte da caução retida' },
  ],
  actions: [
    { name: 'pick_up', description: 'Locatário retira o veículo', callableBy: 'renter + rental_company', preState: 'reserved', postState: 'active' },
    { name: 'return_vehicle', description: 'Devolve o veículo', callableBy: 'renter', preState: 'active', postState: 'returned' },
    { name: 'release_deposit', description: 'Vistoria ok → libera caução', callableBy: 'rental_company', preState: 'returned', postState: 'closed_clean' },
    { name: 'retain_deposit', description: 'Retém parte da caução', callableBy: 'rental_company', preState: 'returned', postState: 'closed_damaged' },
  ],
  generateSoroban: (v) => `${head('car_rental_daily', 'Locação de Veículo')}
#[contract]
pub struct CarRental;

#[contractimpl]
impl CarRental {
    pub fn init(env: Env) {
        // Locadora: ${v.rental_company || 'G...'} · Locatário: ${v.renter || 'G...'}
        // Placa: ${v.plate || '—'} · Retirada: ${v.pickupDate || '(a definir)'}
        // ${v.rentalDays || '7'} dias x ${v.dailyRate || '0'} ${v.asset || 'BRZ'}
        // Caução: ${v.depositAmount || '0'} ${v.asset || 'BRZ'}
    }
    pub fn pick_up(env: Env) { /* TODO: assinatura dupla, inicia locação */ }
    pub fn return_vehicle(env: Env) { /* TODO: renter sinaliza devolução */ }
    pub fn release_deposit(env: Env) { /* TODO: rental_company → caução integral renter */ }
    pub fn retain_deposit(env: Env, retained_amount: i128, proof: soroban_sdk::Bytes) { /* TODO */ }
}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// RWA & TOKENIZAÇÃO
// ═════════════════════════════════════════════════════════════════════════

const realEstateTokenTemplate: SmartContractTemplate = {
  id: 'real_estate_token',
  name: 'Tokenização Imobiliária (Cotas)',
  shortName: 'Tokenização Imóvel',
  description: 'Fracionamento de imóvel em cotas tokenizadas com distribuição de aluguel pro-rata.',
  plainLanguage:
    'O proprietário emite N tokens representando frações de um imóvel. Investidores compram cotas e passam a receber automaticamente sua parte proporcional do aluguel todo mês. Quando o imóvel é vendido, o contrato distribui o valor para todos os cotistas.',
  icon: '🏢',
  category: 'rwa',
  difficulty: 'Avançado',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'Crowdfunding imobiliário (FIIs P2P)',
    'Sócios em imóvel para renda',
    'Família compartilhando imóvel herdado',
    'Investimento em imóvel comercial',
  ],
  variables: [
    { name: 'sponsor', label: 'Emissor / Proprietário', type: 'address', required: true },
    { name: 'asset', label: 'Moeda de distribuição', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'totalShares', label: 'Total de cotas', type: 'number', required: true, defaultValue: '1000', helper: 'Número de tokens emitidos' },
    { name: 'sharePrice', label: 'Preço da cota', type: 'amount', required: true },
    { name: 'monthlyRent', label: 'Aluguel mensal estimado', type: 'amount', required: true },
    { name: 'propertyAddress', label: 'Endereço do imóvel', type: 'text', required: true },
    { name: 'matricula', label: 'Matrícula do RGI', type: 'text', required: true, helper: 'Número do Registro Geral de Imóveis' },
  ],
  states: [
    { id: 'fundraising', label: 'Em captação', color: 'blue', description: 'Cotas à venda' },
    { id: 'active', label: 'Operacional', color: 'green', description: 'Imóvel locado, distribuindo aluguel' },
    { id: 'selling', label: 'Em venda', color: 'amber', description: 'Imóvel à venda — cotistas votaram' },
    { id: 'liquidated', label: 'Liquidado', color: 'gray', description: 'Vendido, valor distribuído' },
  ],
  actions: [
    { name: 'buy_share', description: 'Investidor compra cota', callableBy: 'anyone', preState: 'fundraising', postState: 'fundraising' },
    { name: 'distribute_rent', description: 'Distribui aluguel pro-rata', callableBy: 'sponsor | anyone', preState: 'active', postState: 'active' },
    { name: 'vote_sell', description: 'Cotistas votam pela venda', callableBy: 'shareholders', preState: 'active', postState: 'selling' },
    { name: 'distribute_sale', description: 'Distribui valor da venda', callableBy: 'sponsor', preState: 'selling', postState: 'liquidated' },
  ],
  generateSoroban: (v) => `${head('real_estate_token', 'Tokenização Imobiliária')}
#[contract]
pub struct RealEstateToken;

#[contractimpl]
impl RealEstateToken {
    pub fn init(env: Env) {
        // Emissor: ${v.sponsor || 'G...'}
        // Imóvel: ${v.propertyAddress || '—'} · Matrícula: ${v.matricula || '—'}
        // ${v.totalShares || '1000'} cotas a ${v.sharePrice || '0'} ${v.asset || 'BRZ'}
        // Aluguel: ${v.monthlyRent || '0'} ${v.asset || 'BRZ'}/mês → pro-rata
    }
    pub fn buy_share(env: Env, qty: u32, buyer: Address) { /* TODO: mint */ }
    pub fn distribute_rent(env: Env) { /* TODO: itera holders, distribui pro-rata */ }
    pub fn vote_sell(env: Env, shareholder: Address) { /* TODO: contabiliza votos */ }
    pub fn distribute_sale(env: Env, sale_price: i128) { /* TODO: distribui + burn */ }
}
`,
};

const commodityTokenTemplate: SmartContractTemplate = {
  id: 'commodity_token',
  name: 'Tokenização de Commodities Agrícolas',
  shortName: 'Commodities',
  description: 'CPR digital — token lastreado em produção agrícola futura (soja, café, milho).',
  plainLanguage:
    'O produtor emite tokens representando sacas de uma safra futura (ex: 1.000 tokens = 1.000 sacas de soja). Investidores compram antecipadamente, garantindo financiamento ao produtor. Na colheita, cada token vira direito de retirar 1 saca ou receber o equivalente em moeda.',
  icon: '🌾',
  category: 'rwa',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Cédula de Produto Rural (CPR) digital',
    'Pré-venda de safra para giro de capital',
    'Hedge de preço para indústria',
    'Investimento em commodities sem corretora',
  ],
  variables: [
    { name: 'farmer', label: 'Produtor rural', type: 'address', required: true, helper: 'CPF/CNPJ rural cadastrado' },
    { name: 'asset', label: 'Moeda do título', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'commodityType', label: 'Commodity', type: 'select', required: true, options: ['Soja', 'Milho', 'Café', 'Boi gordo', 'Algodão'] },
    { name: 'totalUnits', label: 'Quantidade (sacas/cabeças)', type: 'number', required: true, defaultValue: '1000' },
    { name: 'unitPrice', label: 'Preço por unidade', type: 'amount', required: true },
    { name: 'harvestDate', label: 'Data da colheita prevista', type: 'date', required: true },
    { name: 'farmLocation', label: 'Localização da fazenda', type: 'text', required: true },
  ],
  states: [
    { id: 'issued', label: 'Emitido', color: 'blue', description: 'Tokens à venda' },
    { id: 'growing', label: 'Em produção', color: 'amber', description: 'Safra em desenvolvimento' },
    { id: 'harvested', label: 'Colhida', color: 'green', description: 'Pronto para resgate' },
    { id: 'redeemed', label: 'Resgatado', color: 'gray', description: 'Todos os tokens resgatados' },
    { id: 'defaulted', label: 'Inadimplente', color: 'red', description: 'Safra perdida — acionar seguro' },
  ],
  actions: [
    { name: 'buy_tokens', description: 'Investidor compra tokens', callableBy: 'anyone', preState: 'issued', postState: 'issued' },
    { name: 'mark_growing', description: 'Inicia a produção', callableBy: 'farmer', preState: 'issued', postState: 'growing' },
    { name: 'confirm_harvest', description: 'Confirma colheita (oráculo)', callableBy: 'oracle | farmer', preState: 'growing', postState: 'harvested' },
    { name: 'redeem', description: 'Investidor resgata sacas', callableBy: 'token_holder', preState: 'harvested', postState: 'harvested' },
    { name: 'declare_default', description: 'Declara perda de safra', callableBy: 'oracle', preState: 'growing', postState: 'defaulted' },
  ],
  generateSoroban: (v) => `${head('commodity_token', 'Tokenização de Commodities')}
#[contract]
pub struct CommodityToken;

#[contractimpl]
impl CommodityToken {
    pub fn init(env: Env) {
        // Produtor: ${v.farmer || 'G...'}
        // ${v.commodityType || '—'} · Quantidade: ${v.totalUnits || '0'} unidades
        // Preço: ${v.unitPrice || '0'} ${v.asset || 'BRZ'}/un.
        // Fazenda: ${v.farmLocation || '—'} · Colheita: ${v.harvestDate || '(a definir)'}
    }
    pub fn buy_tokens(env: Env, qty: u32) { /* TODO: mint */ }
    pub fn mark_growing(env: Env) { /* TODO */ }
    pub fn confirm_harvest(env: Env, oracle_proof: soroban_sdk::Bytes) { /* TODO */ }
    pub fn redeem(env: Env, qty: u32) { /* TODO: burn + paga */ }
    pub fn declare_default(env: Env) { /* TODO */ }
}
`,
};

const carbonCreditsTemplate: SmartContractTemplate = {
  id: 'carbon_credits',
  name: 'Créditos de Carbono Tokenizados',
  shortName: 'Carbono',
  description: 'Emissão e queima de créditos de carbono on-chain (1 token = 1 tCO₂).',
  plainLanguage:
    'Projeto de reflorestamento ou energia limpa gera créditos. Cada tonelada de CO₂ removida vira 1 token (auditado por certificadora). Empresas compram tokens para compensar suas emissões — o ato de "queimar" o token equivale a aposentar o crédito.',
  icon: '🌳',
  category: 'rwa',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Compensação de pegada corporativa (ESG)',
    'Reflorestamento como ativo de investimento',
    'Net-zero para indústria pesada',
    'Mercado voluntário de carbono',
  ],
  variables: [
    { name: 'projectOwner', label: 'Dono do projeto', type: 'address', required: true },
    { name: 'verifier', label: 'Certificadora', type: 'address', required: true, helper: 'Ex: Verra, Gold Standard' },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'USDC' },
    { name: 'totalTons', label: 'Toneladas de CO₂ projetadas', type: 'number', required: true, defaultValue: '10000' },
    { name: 'pricePerTon', label: 'Preço por tonelada', type: 'amount', required: true },
    { name: 'projectType', label: 'Tipo de projeto', type: 'select', required: true, options: ['Reflorestamento', 'Energia eólica', 'Solar', 'Biogás', 'Conservação'] },
    { name: 'projectLocation', label: 'Localização do projeto', type: 'text', required: true },
  ],
  states: [
    { id: 'pending_audit', label: 'Aguardando auditoria', color: 'amber', description: 'Verificadora em vistoria' },
    { id: 'issued', label: 'Emitidos', color: 'blue', description: 'Tokens disponíveis' },
    { id: 'partially_retired', label: 'Parcialmente queimados', color: 'green', description: 'Alguns créditos aposentados' },
    { id: 'fully_retired', label: 'Totalmente aposentados', color: 'gray', description: 'Todos os tokens queimados' },
  ],
  actions: [
    { name: 'verify_and_issue', description: 'Certificadora valida e emite tokens', callableBy: 'verifier', preState: 'pending_audit', postState: 'issued' },
    { name: 'buy_credits', description: 'Empresa compra créditos', callableBy: 'anyone', preState: 'issued', postState: 'issued' },
    { name: 'retire', description: 'Queima crédito (compensação)', callableBy: 'token_holder', preState: 'issued', postState: 'partially_retired' },
  ],
  generateSoroban: (v) => `${head('carbon_credits', 'Créditos de Carbono')}
#[contract]
pub struct CarbonCredits;

#[contractimpl]
impl CarbonCredits {
    pub fn init(env: Env) {
        // Projeto: ${v.projectType || '—'} · Local: ${v.projectLocation || '—'}
        // Dono: ${v.projectOwner || 'G...'} · Certificadora: ${v.verifier || 'G...'}
        // ${v.totalTons || '0'} tCO₂ · ${v.pricePerTon || '0'} ${v.asset || 'USDC'}/t
    }
    pub fn verify_and_issue(env: Env, tons_verified: u32) { /* TODO: verifier mint */ }
    pub fn buy_credits(env: Env, qty: u32) { /* TODO */ }
    pub fn retire(env: Env, qty: u32, reason: soroban_sdk::String) { /* TODO: burn + evento */ }
}
`,
};

const solarYieldTokenTemplate: SmartContractTemplate = {
  id: 'solar_yield_token',
  name: 'Tokenização de Geração Solar',
  shortName: 'Solar',
  description: 'Investidores financiam usina solar e recebem % da geração elétrica vendida.',
  plainLanguage:
    'Empreendedor monta uma usina solar e oferece participação tokenizada. Cada token representa uma cota da receita futura. Mensalmente, a usina vende energia para a distribuidora — esse valor entra no contrato e é distribuído pro-rata para os holders dos tokens.',
  icon: '☀️',
  category: 'rwa',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Crowdfunding de microgeração distribuída',
    'Yieldcoin lastreado em geração elétrica',
    'Investimento ESG com retorno mensal',
    'Cooperativa solar de bairro',
  ],
  variables: [
    { name: 'operator', label: 'Operador da usina', type: 'address', required: true },
    { name: 'asset', label: 'Moeda de pagamento', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'totalShares', label: 'Total de cotas', type: 'number', required: true, defaultValue: '500' },
    { name: 'sharePrice', label: 'Preço da cota', type: 'amount', required: true },
    { name: 'installedCapacityKw', label: 'Capacidade instalada (kWp)', type: 'number', required: true, defaultValue: '50' },
    { name: 'expectedMonthlyKwh', label: 'Geração mensal estimada (kWh)', type: 'number', required: true, defaultValue: '6000' },
    { name: 'plantLocation', label: 'Localização', type: 'text', required: true },
  ],
  states: [
    { id: 'fundraising', label: 'Captação', color: 'blue', description: 'Vendendo cotas' },
    { id: 'operational', label: 'Operacional', color: 'green', description: 'Gerando e distribuindo' },
    { id: 'maintenance', label: 'Manutenção', color: 'amber', description: 'Geração interrompida temporariamente' },
    { id: 'decommissioned', label: 'Descomissionada', color: 'gray', description: 'Fim de vida útil' },
  ],
  actions: [
    { name: 'buy_share', description: 'Investidor compra cota', callableBy: 'anyone', preState: 'fundraising', postState: 'fundraising' },
    { name: 'distribute_revenue', description: 'Distribui receita mensal', callableBy: 'operator', preState: 'operational', postState: 'operational' },
    { name: 'pause_maintenance', description: 'Pausa por manutenção', callableBy: 'operator', preState: 'operational', postState: 'maintenance' },
    { name: 'resume_operation', description: 'Retoma operação', callableBy: 'operator', preState: 'maintenance', postState: 'operational' },
  ],
  generateSoroban: (v) => `${head('solar_yield_token', 'Tokenização Solar')}
#[contract]
pub struct SolarYieldToken;

#[contractimpl]
impl SolarYieldToken {
    pub fn init(env: Env) {
        // Operador: ${v.operator || 'G...'}
        // Usina: ${v.installedCapacityKw || '0'} kWp em ${v.plantLocation || '—'}
        // Geração estimada: ${v.expectedMonthlyKwh || '0'} kWh/mês
        // ${v.totalShares || '500'} cotas a ${v.sharePrice || '0'} ${v.asset || 'BRZ'}
    }
    pub fn buy_share(env: Env, qty: u32) { /* TODO: mint */ }
    pub fn distribute_revenue(env: Env, monthly_revenue: i128) { /* TODO: pro-rata */ }
    pub fn pause_maintenance(env: Env) { /* TODO */ }
    pub fn resume_operation(env: Env) { /* TODO */ }
}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// REGISTROS CIVIS
// ═════════════════════════════════════════════════════════════════════════

const birthRegistryTemplate: SmartContractTemplate = {
  id: 'birth_registry',
  name: 'Registro de Nascimento',
  shortName: 'Nascimento',
  description: 'Registro de nascimento com lavratura on-chain pelo cartório autorizado.',
  plainLanguage:
    'Cartório autorizado lavra o registro de nascimento on-chain: nome do bebê, filiação, hospital, data e hora. O hash da DNV (Declaração de Nascido Vivo) fica imutável na Stellar — qualquer prefeitura ou consulado consegue verificar em segundos.',
  icon: '👶',
  category: 'registry',
  difficulty: 'Intermediário',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Cartórios civis com registro digital nativo',
    'Reconhecimento internacional automático',
    'Combate à subnotificação em áreas remotas',
    'Verificação de documentos por bancos/escolas',
  ],
  variables: [
    { name: 'registrar', label: 'Cartório autorizado', type: 'address', required: true, helper: 'Cartório de Registro Civil' },
    { name: 'fatherWallet', label: 'Carteira do pai', type: 'address' },
    { name: 'motherWallet', label: 'Carteira da mãe', type: 'address', required: true },
    { name: 'childName', label: 'Nome completo do bebê', type: 'text', required: true },
    { name: 'birthDate', label: 'Data e hora do nascimento', type: 'date', required: true },
    { name: 'hospital', label: 'Hospital / local do nascimento', type: 'text', required: true },
    { name: 'dnvNumber', label: 'Número da DNV', type: 'text', required: true, helper: 'Declaração de Nascido Vivo' },
  ],
  states: [
    { id: 'draft', label: 'Em lavratura', color: 'amber', description: 'Cartório preenchendo' },
    { id: 'registered', label: 'Registrado', color: 'green', description: 'Lavrado e selado on-chain' },
    { id: 'corrected', label: 'Retificado', color: 'blue', description: 'Houve retificação (averbação)' },
  ],
  actions: [
    { name: 'register', description: 'Lavra o registro definitivamente', callableBy: 'registrar', preState: 'draft', postState: 'registered' },
    { name: 'amend', description: 'Averba retificação', callableBy: 'registrar', preState: 'registered', postState: 'corrected' },
  ],
  generateSoroban: (v) => `${head('birth_registry', 'Registro de Nascimento')}
#[contract]
pub struct BirthRegistry;

#[contractimpl]
impl BirthRegistry {
    pub fn init(env: Env) {
        // Cartório: ${v.registrar || 'G...'}
        // Pai: ${v.fatherWallet || 'G...'} · Mãe: ${v.motherWallet || 'G...'}
        // Nome: ${v.childName || '—'} · Nascimento: ${v.birthDate || '—'}
        // Hospital: ${v.hospital || '—'} · DNV: ${v.dnvNumber || '—'}
    }
    pub fn register(env: Env, dnv_hash: soroban_sdk::Bytes) { /* TODO: registrar.require_auth */ }
    pub fn amend(env: Env, correction_hash: soroban_sdk::Bytes) { /* TODO: averbação */ }
}
`,
};

const marriageContractTemplate: SmartContractTemplate = {
  id: 'marriage_contract',
  name: 'Contrato de União / Casamento',
  shortName: 'Casamento',
  description: 'União estável ou casamento civil com regime de bens registrado on-chain.',
  plainLanguage:
    'Os cônjuges registram o casamento ou união estável e definem o regime de bens (comunhão parcial, total, separação). O contrato fica selado na Stellar com hash da escritura pública — válido em qualquer cartório credenciado.',
  icon: '💍',
  category: 'registry',
  difficulty: 'Intermediário',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Casamento civil com regime claro de bens',
    'União estável formalizada sem cartório',
    'Pacto antenupcial registrado',
    'Reconhecimento de parceria entre nômades digitais',
  ],
  variables: [
    { name: 'partner_1', label: 'Cônjuge 1', type: 'address', required: true },
    { name: 'partner_2', label: 'Cônjuge 2', type: 'address', required: true },
    { name: 'registrar', label: 'Cartório / Notário', type: 'address', required: true },
    { name: 'unionType', label: 'Tipo de união', type: 'select', required: true, options: ['Casamento civil', 'União estável', 'Pacto antenupcial'], defaultValue: 'Casamento civil' },
    { name: 'propertyRegime', label: 'Regime de bens', type: 'select', required: true, options: ['Comunhão parcial', 'Comunhão total', 'Separação total', 'Participação final'] },
    { name: 'ceremonyDate', label: 'Data da celebração', type: 'date', required: true },
    { name: 'witnessesHash', label: 'Hash das testemunhas', type: 'text', helper: 'Endereços dos testemunhos (até 2)' },
  ],
  states: [
    { id: 'pending', label: 'Pendente celebração', color: 'amber', description: 'Aguardando data' },
    { id: 'married', label: 'Celebrado', color: 'green', description: 'União registrada' },
    { id: 'separated', label: 'Separado', color: 'blue', description: 'Em processo de divórcio' },
    { id: 'dissolved', label: 'Dissolvido', color: 'gray', description: 'Casamento desfeito' },
  ],
  actions: [
    { name: 'celebrate', description: 'Cartório celebra a união', callableBy: 'registrar', preState: 'pending', postState: 'married' },
    { name: 'initiate_separation', description: 'Inicia processo de separação', callableBy: 'partner_1 | partner_2', preState: 'married', postState: 'separated' },
    { name: 'dissolve', description: 'Dissolução final', callableBy: 'registrar', preState: 'separated', postState: 'dissolved' },
  ],
  generateSoroban: (v) => `${head('marriage_contract', 'Contrato de União')}
#[contract]
pub struct MarriageContract;

#[contractimpl]
impl MarriageContract {
    pub fn init(env: Env) {
        // Cônjuges: ${v.partner_1 || 'G...'} & ${v.partner_2 || 'G...'}
        // Tipo: ${v.unionType || '—'} · Regime: ${v.propertyRegime || '—'}
        // Cartório: ${v.registrar || 'G...'} · Data: ${v.ceremonyDate || '—'}
    }
    pub fn celebrate(env: Env, escritura_hash: soroban_sdk::Bytes) { /* TODO: registrar */ }
    pub fn initiate_separation(env: Env) { /* TODO: assinatura de 1 dos 2 */ }
    pub fn dissolve(env: Env) { /* TODO: registrar valida partilha */ }
}
`,
};

const divorceSettlementTemplate: SmartContractTemplate = {
  id: 'divorce_settlement',
  name: 'Acordo de Divórcio',
  shortName: 'Divórcio',
  description: 'Divórcio consensual com partilha de bens e pensão alimentícia automática.',
  plainLanguage:
    'Casal em divórcio consensual registra a partilha de bens e, se houver, pensão alimentícia para filhos ou ex-cônjuge. A pensão é debitada automaticamente todo mês da carteira de quem paga para quem recebe — sem boleto, sem atraso.',
  icon: '📋',
  category: 'registry',
  difficulty: 'Avançado',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Divórcio extrajudicial em cartório',
    'Pensão alimentícia sem boleto',
    'Partilha de bens documentada',
    'Acordo de guarda compartilhada',
  ],
  variables: [
    { name: 'spouse_1', label: 'Cônjuge 1', type: 'address', required: true },
    { name: 'spouse_2', label: 'Cônjuge 2', type: 'address', required: true },
    { name: 'lawyer', label: 'Advogado(a) que assistiu', type: 'address', required: true },
    { name: 'asset', label: 'Moeda da pensão', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'alimonyAmount', label: 'Pensão alimentícia mensal', type: 'amount', helper: 'Deixe 0 se não houver' },
    { name: 'alimonyPayer', label: 'Quem paga a pensão', type: 'select', required: true, options: ['Cônjuge 1', 'Cônjuge 2', 'Nenhum'] },
    { name: 'alimonyDurationMonths', label: 'Duração da pensão (meses)', type: 'number', helper: 'Use 999 para indeterminada' },
    { name: 'propertyDivision', label: 'Descrição da partilha', type: 'text', required: true },
  ],
  states: [
    { id: 'agreed', label: 'Acordado', color: 'gray', description: 'Acordo firmado' },
    { id: 'active', label: 'Em execução', color: 'blue', description: 'Pensão sendo paga' },
    { id: 'completed', label: 'Concluído', color: 'green', description: 'Duração da pensão encerrada' },
    { id: 'breached', label: 'Inadimplido', color: 'red', description: 'Pagador atrasou pensão' },
  ],
  actions: [
    { name: 'execute', description: 'Inicia execução do acordo', callableBy: 'lawyer', preState: 'agreed', postState: 'active' },
    { name: 'pay_alimony', description: 'Pensão mensal automática', callableBy: 'anyone', preState: 'active', postState: 'active' },
    { name: 'mark_breached', description: 'Marca inadimplência', callableBy: 'spouse_1 | spouse_2', preState: 'active', postState: 'breached' },
  ],
  generateSoroban: (v) => `${head('divorce_settlement', 'Acordo de Divórcio')}
#[contract]
pub struct DivorceSettlement;

#[contractimpl]
impl DivorceSettlement {
    pub fn init(env: Env) {
        // Cônjuges: ${v.spouse_1 || 'G...'} & ${v.spouse_2 || 'G...'}
        // Advogado: ${v.lawyer || 'G...'}
        // Pensão: ${v.alimonyAmount || '0'} ${v.asset || 'BRZ'}/mês paga por ${v.alimonyPayer || '—'}
        // Duração: ${v.alimonyDurationMonths || '0'} meses
        // Partilha: ${v.propertyDivision || '—'}
    }
    pub fn execute(env: Env) { /* TODO: lawyer assinatura */ }
    pub fn pay_alimony(env: Env) { /* TODO: debita automaticamente */ }
    pub fn mark_breached(env: Env) { /* TODO */ }
}
`,
};

const deathCertificateTemplate: SmartContractTemplate = {
  id: 'death_certificate',
  name: 'Certidão de Óbito',
  shortName: 'Óbito',
  description: 'Registro de óbito on-chain com causa mortis e início automático de sucessão.',
  plainLanguage:
    'Cartório lavra a certidão de óbito on-chain a partir da Declaração de Óbito médica. O registro dispara automaticamente os procedimentos sucessórios pré-configurados (testamento, partilha, seguros), e bloqueia novas operações em carteiras vinculadas ao falecido.',
  icon: '🕊️',
  category: 'registry',
  difficulty: 'Avançado',
  popularity: 2,
  isFullyImplemented: false,
  useCases: [
    'Cartório de Registro Civil digital',
    'Acionamento automático de seguro de vida',
    'Bloqueio de contas e abertura de inventário',
    'Notificação de previdência (INSS, privada)',
  ],
  variables: [
    { name: 'registrar', label: 'Cartório', type: 'address', required: true },
    { name: 'doctor', label: 'Médico atestante', type: 'address', required: true, helper: 'CRM que assinou a DO' },
    { name: 'deceasedName', label: 'Nome do falecido', type: 'text', required: true },
    { name: 'deceasedWallet', label: 'Carteira do falecido', type: 'address', helper: 'Para bloqueio automático' },
    { name: 'deathDate', label: 'Data e hora do óbito', type: 'date', required: true },
    { name: 'causeOfDeath', label: 'Causa mortis (CID)', type: 'text', required: true },
    { name: 'placeOfDeath', label: 'Local do óbito', type: 'text', required: true },
    { name: 'doNumber', label: 'Número da DO', type: 'text', required: true, helper: 'Declaração de Óbito' },
  ],
  states: [
    { id: 'draft', label: 'Em lavratura', color: 'amber', description: 'Cartório preenchendo' },
    { id: 'registered', label: 'Registrado', color: 'gray', description: 'Óbito lavrado' },
    { id: 'succession_open', label: 'Inventário aberto', color: 'blue', description: 'Procedimentos sucessórios em curso' },
    { id: 'closed', label: 'Encerrado', color: 'green', description: 'Sucessão concluída' },
  ],
  actions: [
    { name: 'register_death', description: 'Lavra o óbito', callableBy: 'registrar', preState: 'draft', postState: 'registered' },
    { name: 'open_succession', description: 'Abre inventário automaticamente', callableBy: 'anyone', preState: 'registered', postState: 'succession_open' },
    { name: 'close_succession', description: 'Finaliza sucessão', callableBy: 'registrar', preState: 'succession_open', postState: 'closed' },
  ],
  generateSoroban: (v) => `${head('death_certificate', 'Certidão de Óbito')}
#[contract]
pub struct DeathCertificate;

#[contractimpl]
impl DeathCertificate {
    pub fn init(env: Env) {
        // Cartório: ${v.registrar || 'G...'} · Médico: ${v.doctor || 'G...'}
        // Falecido: ${v.deceasedName || '—'} (${v.deceasedWallet || 'sem carteira'})
        // Óbito: ${v.deathDate || '—'} · CID: ${v.causeOfDeath || '—'}
        // Local: ${v.placeOfDeath || '—'} · DO: ${v.doNumber || '—'}
    }
    pub fn register_death(env: Env, do_hash: soroban_sdk::Bytes) { /* TODO */ }
    pub fn open_succession(env: Env) { /* TODO: aciona testamento + seguros */ }
    pub fn close_succession(env: Env) { /* TODO */ }
}
`,
};

const notarizedDeclarationTemplate: SmartContractTemplate = {
  id: 'notarized_declaration',
  name: 'Declaração Notarial Genérica',
  shortName: 'Declaração',
  description: 'Declaração com fé pública on-chain — substitui reconhecimento de firma.',
  plainLanguage:
    'Substitui o reconhecimento de firma em cartório. Quem declara assina com sua carteira (equivalente à firma reconhecida) e o tabelião valida com sua chave. Vale para procuração, declaração de residência, autorização de viagem, anuência, etc.',
  icon: '✍️',
  category: 'registry',
  difficulty: 'Iniciante',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Procuração com prazo de validade',
    'Declaração de residência',
    'Autorização de viagem de menor',
    'Anuência de cônjuge ou herdeiro',
  ],
  variables: [
    { name: 'declarant', label: 'Declarante', type: 'address', required: true },
    { name: 'notary', label: 'Tabelião', type: 'address', required: true },
    { name: 'beneficiary', label: 'Beneficiário (opcional)', type: 'address' },
    { name: 'declarationType', label: 'Tipo de declaração', type: 'select', required: true, options: ['Procuração', 'Residência', 'Autorização de viagem', 'Anuência', 'Outra'] },
    { name: 'declarationText', label: 'Texto da declaração', type: 'text', required: true, helper: 'Conteúdo que está sendo declarado' },
    { name: 'validityDate', label: 'Validade até', type: 'date', helper: 'Deixe em branco para indeterminada' },
  ],
  states: [
    { id: 'signed', label: 'Assinada', color: 'amber', description: 'Declarante assinou' },
    { id: 'notarized', label: 'Notarizada', color: 'green', description: 'Tabelião validou' },
    { id: 'expired', label: 'Vencida', color: 'gray', description: 'Validade ultrapassada' },
    { id: 'revoked', label: 'Revogada', color: 'red', description: 'Declarante revogou' },
  ],
  actions: [
    { name: 'sign', description: 'Declarante assina', callableBy: 'declarant', preState: 'signed', postState: 'signed' },
    { name: 'notarize', description: 'Tabelião confere fé pública', callableBy: 'notary', preState: 'signed', postState: 'notarized' },
    { name: 'revoke', description: 'Revoga declaração', callableBy: 'declarant', preState: 'notarized', postState: 'revoked' },
  ],
  generateSoroban: (v) => `${head('notarized_declaration', 'Declaração Notarial')}
#[contract]
pub struct NotarizedDeclaration;

#[contractimpl]
impl NotarizedDeclaration {
    pub fn init(env: Env) {
        // Declarante: ${v.declarant || 'G...'} · Tabelião: ${v.notary || 'G...'}
        // Beneficiário: ${v.beneficiary || '—'}
        // Tipo: ${v.declarationType || '—'} · Validade: ${v.validityDate || 'indeterminada'}
        // Conteúdo: ${v.declarationText || '—'}
    }
    pub fn sign(env: Env, content_hash: soroban_sdk::Bytes) { /* TODO: declarant.require_auth */ }
    pub fn notarize(env: Env) { /* TODO: notary fé pública */ }
    pub fn revoke(env: Env) { /* TODO */ }
}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// IMÓVEIS ADICIONAIS
// ═════════════════════════════════════════════════════════════════════════

const commercialRentTemplate: SmartContractTemplate = {
  id: 'commercial_rent',
  name: 'Aluguel Comercial',
  shortName: 'Sala Comercial',
  description: 'Locação não-residencial com reajuste anual por IPCA e multa rescisória.',
  plainLanguage:
    'Para sala, loja ou galpão. Aluguel mensal automatizado com reajuste anual pelo IPCA via oráculo. Inclui multa de 3 aluguéis em caso de rescisão antes do prazo e devolução proporcional da caução.',
  icon: '🏪',
  category: 'real_estate',
  difficulty: 'Intermediário',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Locação de loja em shopping ou rua',
    'Sala corporativa para PJ',
    'Galpão logístico',
    'Espaço de coworking dedicado',
  ],
  variables: [
    { name: 'landlord', label: 'Locador', type: 'address', required: true },
    { name: 'tenant', label: 'Locatário (PJ)', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'monthlyRent', label: 'Aluguel mensal', type: 'amount', required: true },
    { name: 'depositMonths', label: 'Caução (meses)', type: 'number', required: true, defaultValue: '3' },
    { name: 'durationMonths', label: 'Duração (meses)', type: 'number', required: true, defaultValue: '60' },
    { name: 'penaltyMonths', label: 'Multa rescisória (meses)', type: 'number', required: true, defaultValue: '3' },
    { name: 'propertyAddress', label: 'Endereço', type: 'text', required: true },
    { name: 'cnpj', label: 'CNPJ do locatário', type: 'text', required: true },
  ],
  states: [
    { id: 'awaiting_deposit', label: 'Aguardando caução', color: 'gray', description: 'Aguardando depósito inicial' },
    { id: 'active', label: 'Vigente', color: 'green', description: 'Em curso' },
    { id: 'overdue', label: 'Inadimplente', color: 'amber', description: 'Atrasado' },
    { id: 'early_termination', label: 'Rescisão antecipada', color: 'red', description: 'Multa devida' },
    { id: 'closed', label: 'Encerrado', color: 'gray', description: 'Fim normal do contrato' },
  ],
  actions: [
    { name: 'pay_deposit', description: 'Locatário deposita caução', callableBy: 'tenant', preState: 'awaiting_deposit', postState: 'active' },
    { name: 'pay_rent', description: 'Aluguel mensal', callableBy: 'anyone', preState: 'active', postState: 'active' },
    { name: 'annual_ipca_adjust', description: 'Reajuste IPCA (oráculo)', callableBy: 'oracle', preState: 'active', postState: 'active' },
    { name: 'terminate_early', description: 'Rescinde antes do prazo (com multa)', callableBy: 'tenant | landlord', preState: 'active', postState: 'early_termination' },
    { name: 'close', description: 'Encerra ao fim do prazo', callableBy: 'anyone', preState: 'active', postState: 'closed' },
  ],
  generateSoroban: (v) => `${head('commercial_rent', 'Aluguel Comercial')}
#[contract]
pub struct CommercialRent;

#[contractimpl]
impl CommercialRent {
    pub fn init(env: Env) {
        // Locador: ${v.landlord || 'G...'} · Locatário: ${v.tenant || 'G...'} (CNPJ ${v.cnpj || '—'})
        // ${v.monthlyRent || '0'} ${v.asset || 'BRZ'}/mês · ${v.durationMonths || '60'} meses
        // Caução: ${v.depositMonths || '3'} aluguéis · Multa rescisória: ${v.penaltyMonths || '3'} aluguéis
        // Imóvel: ${v.propertyAddress || '—'}
    }
    pub fn pay_deposit(env: Env) { /* TODO */ }
    pub fn pay_rent(env: Env) { /* TODO */ }
    pub fn annual_ipca_adjust(env: Env, ipca_basis_points: i128) { /* TODO */ }
    pub fn terminate_early(env: Env) { /* TODO: cobra multa */ }
    pub fn close(env: Env) { /* TODO: devolve caução */ }
}
`,
};

const shortStayTemplate: SmartContractTemplate = {
  id: 'short_stay',
  name: 'Aluguel por Temporada',
  shortName: 'Temporada',
  description: 'Hospedagem por noite estilo Airbnb com check-in/check-out automático.',
  plainLanguage:
    'Hóspede paga noites + taxa de limpeza + caução. No check-in, valor das noites é liberado ao anfitrião. No check-out, se não houver dano, a caução volta integral ao hóspede; com dano, o anfitrião retém parte com prova.',
  icon: '🏝️',
  category: 'real_estate',
  difficulty: 'Iniciante',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'Casa de praia ou montanha',
    'Apartamento turístico',
    'Airbnb sem intermediário',
    'Bed & breakfast familiar',
  ],
  variables: [
    { name: 'host', label: 'Anfitrião', type: 'address', required: true },
    { name: 'guest', label: 'Hóspede', type: 'address', required: true },
    { name: 'asset', label: 'Moeda', type: 'select', required: true, options: ['BRZ', 'USDC'], defaultValue: 'USDC' },
    { name: 'nightlyRate', label: 'Diária', type: 'amount', required: true },
    { name: 'nightsCount', label: 'Noites', type: 'number', required: true, defaultValue: '3' },
    { name: 'cleaningFee', label: 'Taxa de limpeza', type: 'amount', required: true },
    { name: 'depositAmount', label: 'Caução', type: 'amount', required: true },
    { name: 'checkInDate', label: 'Check-in', type: 'date', required: true },
    { name: 'propertyAddress', label: 'Endereço', type: 'text', required: true },
  ],
  states: [
    { id: 'reserved', label: 'Reservado', color: 'gray', description: 'Aguardando check-in' },
    { id: 'checked_in', label: 'Hospedado', color: 'blue', description: 'Em uso' },
    { id: 'checked_out', label: 'Vistoriado', color: 'amber', description: 'Aguardando vistoria final' },
    { id: 'closed_clean', label: 'Encerrado ok', color: 'green', description: 'Caução devolvida' },
    { id: 'closed_damaged', label: 'Com retenção', color: 'red', description: 'Parte da caução retida' },
  ],
  actions: [
    { name: 'check_in', description: 'Hóspede faz check-in', callableBy: 'guest + host', preState: 'reserved', postState: 'checked_in' },
    { name: 'check_out', description: 'Hóspede faz check-out', callableBy: 'guest', preState: 'checked_in', postState: 'checked_out' },
    { name: 'release_deposit', description: 'Anfitrião libera caução', callableBy: 'host', preState: 'checked_out', postState: 'closed_clean' },
    { name: 'retain_deposit', description: 'Retém parte da caução', callableBy: 'host', preState: 'checked_out', postState: 'closed_damaged' },
  ],
  generateSoroban: (v) => `${head('short_stay', 'Aluguel Temporada')}
#[contract]
pub struct ShortStay;

#[contractimpl]
impl ShortStay {
    pub fn init(env: Env) {
        // Anfitrião: ${v.host || 'G...'} · Hóspede: ${v.guest || 'G...'}
        // ${v.nightsCount || '3'} noites x ${v.nightlyRate || '0'} ${v.asset || 'USDC'} + limpeza ${v.cleaningFee || '0'}
        // Caução: ${v.depositAmount || '0'} ${v.asset || 'USDC'}
        // Imóvel: ${v.propertyAddress || '—'} · Check-in: ${v.checkInDate || '—'}
    }
    pub fn check_in(env: Env) { /* TODO: libera nightly + cleaning ao host */ }
    pub fn check_out(env: Env) { /* TODO */ }
    pub fn release_deposit(env: Env) { /* TODO: devolve caução guest */ }
    pub fn retain_deposit(env: Env, retained: i128, proof: soroban_sdk::Bytes) { /* TODO */ }
}
`,
};

// ─── Array exportado ────────────────────────────────────────────────────

export const EXTENDED_TEMPLATES: SmartContractTemplate[] = [
  // Profissional
  legalFeesTemplate,
  medicalConsultationTemplate,
  dentalTreatmentTemplate,
  accountingServicesTemplate,
  psychologyPackageTemplate,
  // Construção
  constructionContractTemplate,
  architecturalProjectTemplate,
  renovationMilestoneTemplate,
  // Veículos
  vehicleSaleTemplate,
  vehicleLeaseTemplate,
  carRentalDailyTemplate,
  // RWA
  realEstateTokenTemplate,
  commodityTokenTemplate,
  carbonCreditsTemplate,
  solarYieldTokenTemplate,
  // Registros
  birthRegistryTemplate,
  marriageContractTemplate,
  divorceSettlementTemplate,
  deathCertificateTemplate,
  notarizedDeclarationTemplate,
  // Imóveis adicionais
  commercialRentTemplate,
  shortStayTemplate,
];
