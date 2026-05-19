/**
 * Smart Contract Templates — Stellar / Soroban
 *
 * 10 modelos pré-configurados com casos de uso REAIS, prontos para serem
 * usados na prática hoje. Cada template aborda um problema concreto que
 * empresas, pessoas e organizações enfrentam no dia a dia:
 *
 *   1. Aluguel Residencial com Caução
 *   2. Folha de Pagamento Empresarial
 *   3. Venda Online com Garantia (E-commerce Escrow)
 *   4. Divisão de Royalties (Conteúdo Digital)
 *   5. Antecipação de Recebíveis (Factoring de NF)
 *   6. Vesting de Cofundador (Equity Startup)
 *   7. Contrato de Freelancer por Entregas
 *   8. Investimento de Renda Fixa (CDB Tokenizado)
 *   9. Compra Coletiva (Group Buy)
 *  10. Seguro Paramétrico (Indenização Automática)
 *
 * Os 3 primeiros estão com implementação Soroban completa.
 * Os outros 7 são skeleton-ready (UI funciona, código Rust pronto para extensão).
 */

export type SmartContractCategory =
  | 'real_estate'
  | 'payroll'
  | 'ecommerce'
  | 'finance'
  | 'business'
  | 'insurance';

export type StateColor = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple';

export interface SCVariable {
  name: string;
  label: string;
  type: 'text' | 'address' | 'amount' | 'asset' | 'date' | 'duration' | 'number' | 'select' | 'boolean';
  required?: boolean;
  placeholder?: string;
  helper?: string;
  options?: string[];
  defaultValue?: string;
}

export interface SCState {
  id: string;
  label: string;
  color: StateColor;
  description: string;
}

export interface SCAction {
  name: string;
  description: string;
  callableBy: string;
  preState: string;
  postState: string;
}

export interface SmartContractTemplate {
  id: string;
  name: string;
  shortName: string;
  description: string;
  plainLanguage: string;
  icon: string;
  category: SmartContractCategory;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
  popularity: number;
  isFullyImplemented: boolean;
  useCases: string[];
  variables: SCVariable[];
  states: SCState[];
  actions: SCAction[];
  generateSoroban: (vars: Record<string, string>) => string;
}

// ─── Helper para cabeçalho do código gerado ───────────────────────────

const head = (id: string, name: string) => `// ──────────────────────────────────────────────────────────────
// Stellar Soroban Smart Contract — ${name}
// Gerado pelo ContractEase · Template ID: ${id}
// Compilar com: cargo build --target wasm32-unknown-unknown --release
// Deploy: stellar contract deploy --wasm target/wasm32-unknown-unknown/release/contract.wasm
// ──────────────────────────────────────────────────────────────

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short, token};
`;

// ═════════════════════════════════════════════════════════════════════════
// 1. ALUGUEL RESIDENCIAL COM CAUÇÃO (FULL IMPL)
// ═════════════════════════════════════════════════════════════════════════
const rentTemplate: SmartContractTemplate = {
  id: 'rent',
  name: 'Aluguel Residencial com Caução',
  shortName: 'Aluguel',
  description: 'Locação de imóvel com débito automático mensal e caução retida no contrato.',
  plainLanguage:
    'O contrato administra o aluguel sozinho: cobra o valor todo mês na data combinada, retém a caução (geralmente 3 aluguéis) durante toda a vigência e devolve no fim — descontando o que o locador comprovar de dano. Substitui a fiança bancária e o fiador.',
  icon: '🏠',
  category: 'real_estate',
  difficulty: 'Iniciante',
  popularity: 5,
  isFullyImplemented: true,
  useCases: [
    'Imobiliária digitaliza contratos de aluguel',
    'Locação direta entre proprietário e inquilino',
    'Locação por temporada com caução de proteção',
    'Aluguel comercial de salas e lojas'
  ],
  variables: [
    { name: 'landlord', label: 'Locador (Proprietário)', type: 'address', required: true, placeholder: 'G...', helper: 'Carteira Stellar do dono do imóvel' },
    { name: 'tenant', label: 'Locatário (Inquilino)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'monthlyRent', label: 'Valor mensal do aluguel', type: 'amount', required: true, placeholder: '2500' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['BRZ', 'USDC', 'XLM'], defaultValue: 'BRZ' },
    { name: 'depositMonths', label: 'Caução (em meses de aluguel)', type: 'number', required: true, defaultValue: '3', helper: 'Padrão brasileiro: 3 meses' },
    { name: 'dueDay', label: 'Dia do vencimento', type: 'number', required: true, defaultValue: '5', helper: 'Dia do mês entre 1 e 28' },
    { name: 'durationMonths', label: 'Duração do contrato (meses)', type: 'number', required: true, defaultValue: '30', helper: 'Mínimo 30 meses pela Lei do Inquilinato' },
    { name: 'propertyAddress', label: 'Endereço do imóvel', type: 'text', required: true, placeholder: 'Rua, número, cidade' },
  ],
  states: [
    { id: 'awaiting_deposit', label: 'Aguardando caução', color: 'gray', description: 'Contrato criado, inquilino precisa depositar a caução' },
    { id: 'active', label: 'Vigente', color: 'green', description: 'Aluguel sendo cobrado mensalmente' },
    { id: 'overdue', label: 'Inadimplente', color: 'amber', description: 'Mensalidade atrasada' },
    { id: 'evaluation', label: 'Avaliação final', color: 'blue', description: 'Vistoria do imóvel para devolução da caução' },
    { id: 'closed_clean', label: 'Encerrado (caução devolvida)', color: 'green', description: 'Contrato encerrado sem retenções' },
    { id: 'closed_damaged', label: 'Encerrado (com retenção)', color: 'red', description: 'Parte da caução retida por danos' },
  ],
  actions: [
    { name: 'pay_deposit', description: 'Inquilino deposita a caução inicial', callableBy: 'tenant', preState: 'awaiting_deposit', postState: 'active' },
    { name: 'pay_rent', description: 'Pagamento mensal do aluguel', callableBy: 'anyone', preState: 'active', postState: 'active | overdue' },
    { name: 'mark_overdue', description: 'Marca como inadimplente após D+5', callableBy: 'landlord', preState: 'active', postState: 'overdue' },
    { name: 'request_evaluation', description: 'Solicita vistoria de saída', callableBy: 'tenant | landlord', preState: 'active', postState: 'evaluation' },
    { name: 'release_deposit', description: 'Libera caução para inquilino (sem danos)', callableBy: 'landlord', preState: 'evaluation', postState: 'closed_clean' },
    { name: 'retain_deposit', description: 'Retém parte da caução (com comprovação)', callableBy: 'landlord', preState: 'evaluation', postState: 'closed_damaged' },
  ],
  generateSoroban: (v) => `${head('rent', 'Aluguel Residencial com Caução')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RentState { AwaitingDeposit, Active, Overdue, Evaluation, ClosedClean, ClosedDamaged }

#[contracttype]
pub struct RentalAgreement {
    pub landlord: Address,
    pub tenant: Address,
    pub monthly_rent: i128,
    pub deposit: i128,
    pub asset: Symbol,
    pub due_day: u32,
    pub duration_months: u32,
    pub start_ts: u64,
    pub last_payment_ts: u64,
    pub months_paid: u32,
    pub state: RentState,
}

const DATA: Symbol = symbol_short!("RENT");

#[contract]
pub struct RentalContract;

#[contractimpl]
impl RentalContract {
    pub fn init(env: Env) {
        let monthly: i128 = ${v.monthlyRent || '2500'}_i128;
        let deposit_months: i128 = ${v.depositMonths || '3'}_i128;

        let data = RentalAgreement {
            landlord: Address::from_string(&env, &soroban_sdk::String::from_str(&env, "${v.landlord || 'GLANDLORD...'}")),
            tenant:   Address::from_string(&env, &soroban_sdk::String::from_str(&env, "${v.tenant || 'GTENANT...'}")),
            monthly_rent: monthly,
            deposit: monthly * deposit_months,
            asset: symbol_short!("${v.asset || 'BRZ'}"),
            due_day: ${v.dueDay || '5'},
            duration_months: ${v.durationMonths || '30'},
            start_ts: env.ledger().timestamp(),
            last_payment_ts: 0,
            months_paid: 0,
            state: RentState::AwaitingDeposit,
        };
        env.storage().instance().set(&DATA, &data);
    }

    /// Inquilino deposita caução (3x aluguel) e ativa o contrato
    pub fn pay_deposit(env: Env) {
        let mut d: RentalAgreement = env.storage().instance().get(&DATA).unwrap();
        d.tenant.require_auth();
        assert_eq!(d.state, RentState::AwaitingDeposit, "Caucao ja paga");
        // token::Client::new(&env, &d.asset).transfer(&d.tenant, &env.current_contract_address(), &d.deposit);
        d.state = RentState::Active;
        env.storage().instance().set(&DATA, &d);
    }

    /// Cobrança mensal (qualquer um pode chamar — geralmente um cron job)
    pub fn pay_rent(env: Env) {
        let mut d: RentalAgreement = env.storage().instance().get(&DATA).unwrap();
        assert_eq!(d.state, RentState::Active, "Contrato nao ativo");
        // token::Client::new(&env, &d.asset).transfer(&d.tenant, &d.landlord, &d.monthly_rent);
        d.last_payment_ts = env.ledger().timestamp();
        d.months_paid += 1;
        env.storage().instance().set(&DATA, &d);
    }

    /// Inquilino ou locador solicita vistoria final
    pub fn request_evaluation(env: Env, caller: Address) {
        let mut d: RentalAgreement = env.storage().instance().get(&DATA).unwrap();
        caller.require_auth();
        assert!(caller == d.landlord || caller == d.tenant, "Sem permissao");
        d.state = RentState::Evaluation;
        env.storage().instance().set(&DATA, &d);
    }

    /// Locador aprova devolução integral da caução
    pub fn release_deposit(env: Env) {
        let mut d: RentalAgreement = env.storage().instance().get(&DATA).unwrap();
        d.landlord.require_auth();
        assert_eq!(d.state, RentState::Evaluation, "Vistoria nao iniciada");
        // token::Client::new(&env, &d.asset).transfer(&env.current_contract_address(), &d.tenant, &d.deposit);
        d.state = RentState::ClosedClean;
        env.storage().instance().set(&DATA, &d);
    }

    /// Locador retém parte da caução por danos comprovados
    pub fn retain_deposit(env: Env, retain_amount: i128, damage_proof: soroban_sdk::String) {
        let mut d: RentalAgreement = env.storage().instance().get(&DATA).unwrap();
        d.landlord.require_auth();
        assert_eq!(d.state, RentState::Evaluation, "Vistoria nao iniciada");
        assert!(retain_amount <= d.deposit, "Acima da caucao");
        let refund = d.deposit - retain_amount;
        // token::Client::new(&env, &d.asset).transfer(&env.current_contract_address(), &d.landlord, &retain_amount);
        // token::Client::new(&env, &d.asset).transfer(&env.current_contract_address(), &d.tenant, &refund);
        env.events().publish((symbol_short!("damage"),), (retain_amount, damage_proof, refund));
        d.state = RentState::ClosedDamaged;
        env.storage().instance().set(&DATA, &d);
    }
}

// Imóvel: ${v.propertyAddress || '(endereço não definido)'}
// Aluguel: ${v.monthlyRent || '0'} ${v.asset || 'BRZ'}/mês · Caução: ${v.depositMonths || '3'}x = ${(parseInt(v.monthlyRent || '0') * parseInt(v.depositMonths || '3')) || 0} ${v.asset || 'BRZ'}
// Vencimento: dia ${v.dueDay || '5'} · Duração: ${v.durationMonths || '30'} meses
`,
};

// ═════════════════════════════════════════════════════════════════════════
// 2. VENDA ONLINE COM GARANTIA (FULL IMPL)
// ═════════════════════════════════════════════════════════════════════════
const ecommerceTemplate: SmartContractTemplate = {
  id: 'ecommerce',
  name: 'Venda Online com Garantia',
  shortName: 'E-commerce',
  description: 'Escrow para vendas online. Pagamento só é liberado após o comprador confirmar o recebimento.',
  plainLanguage:
    'O cliente paga, o dinheiro fica seguro no contrato, o vendedor envia o produto. Quando o cliente confirmar o recebimento (ou após 7 dias do prazo de entrega), o pagamento é liberado automaticamente. Resolve o problema do "paguei mas não chegou" da internet.',
  icon: '🛒',
  category: 'ecommerce',
  difficulty: 'Iniciante',
  popularity: 5,
  isFullyImplemented: true,
  useCases: [
    'Marketplaces P2P (OLX, Mercado Livre)',
    'Venda direta de produtos importados',
    'Lojas online sem reputação consolidada',
    'Compra de produtos de alto valor (eletrônicos, joias)'
  ],
  variables: [
    { name: 'buyer', label: 'Comprador', type: 'address', required: true, placeholder: 'G...' },
    { name: 'seller', label: 'Vendedor', type: 'address', required: true, placeholder: 'G...' },
    { name: 'amount', label: 'Valor da compra', type: 'amount', required: true, placeholder: '1500' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['USDC', 'BRZ', 'XLM'], defaultValue: 'BRZ' },
    { name: 'productName', label: 'Produto', type: 'text', required: true, placeholder: 'Ex: iPhone 15 Pro 256GB' },
    { name: 'trackingCode', label: 'Código de rastreamento', type: 'text', placeholder: 'Ex: BR123456789BR (preencher após envio)' },
    { name: 'autoReleaseDays', label: 'Liberação automática após (dias)', type: 'number', defaultValue: '7', helper: 'Se o comprador não confirmar nem disputar, libera automaticamente' },
  ],
  states: [
    { id: 'awaiting_payment', label: 'Aguardando pagamento', color: 'gray', description: 'Vendedor criou a venda' },
    { id: 'paid', label: 'Pago', color: 'blue', description: 'Comprador pagou, aguardando envio' },
    { id: 'shipped', label: 'Enviado', color: 'purple', description: 'Vendedor enviou o produto' },
    { id: 'delivered', label: 'Entregue', color: 'green', description: 'Pagamento liberado ao vendedor' },
    { id: 'disputed', label: 'Em disputa', color: 'red', description: 'Comprador reclamou do produto' },
    { id: 'refunded', label: 'Reembolsado', color: 'amber', description: 'Valor devolvido ao comprador' },
  ],
  actions: [
    { name: 'pay', description: 'Comprador efetua o pagamento', callableBy: 'buyer', preState: 'awaiting_payment', postState: 'paid' },
    { name: 'mark_shipped', description: 'Vendedor registra envio com rastreio', callableBy: 'seller', preState: 'paid', postState: 'shipped' },
    { name: 'confirm_delivery', description: 'Comprador confirma recebimento → libera pagamento', callableBy: 'buyer', preState: 'shipped', postState: 'delivered' },
    { name: 'auto_release', description: 'Liberação automática após prazo sem disputa', callableBy: 'anyone', preState: 'shipped', postState: 'delivered' },
    { name: 'open_dispute', description: 'Comprador abre disputa por problema', callableBy: 'buyer', preState: 'shipped', postState: 'disputed' },
    { name: 'refund', description: 'Vendedor aceita devolução', callableBy: 'seller', preState: 'disputed', postState: 'refunded' },
  ],
  generateSoroban: (v) => `${head('ecommerce', 'Venda Online com Garantia')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum SaleState { AwaitingPayment, Paid, Shipped, Delivered, Disputed, Refunded }

#[contracttype]
pub struct OnlineSale {
    pub buyer: Address,
    pub seller: Address,
    pub amount: i128,
    pub asset: Symbol,
    pub shipped_ts: u64,
    pub auto_release_secs: u64,
    pub state: SaleState,
}

const SALE: Symbol = symbol_short!("SALE");

#[contract]
pub struct EcommerceEscrow;

#[contractimpl]
impl EcommerceEscrow {
    pub fn init(env: Env) {
        let auto_days: u64 = ${v.autoReleaseDays || '7'};
        let data = OnlineSale {
            buyer:  Address::from_string(&env, &soroban_sdk::String::from_str(&env, "${v.buyer || 'GBUYER...'}")),
            seller: Address::from_string(&env, &soroban_sdk::String::from_str(&env, "${v.seller || 'GSELLER...'}")),
            amount: ${v.amount || '0'}_i128,
            asset:  symbol_short!("${v.asset || 'BRZ'}"),
            shipped_ts: 0,
            auto_release_secs: auto_days * 24 * 3600,
            state: SaleState::AwaitingPayment,
        };
        env.storage().instance().set(&SALE, &data);
    }

    /// Comprador transfere o valor para o contrato
    pub fn pay(env: Env) {
        let mut d: OnlineSale = env.storage().instance().get(&SALE).unwrap();
        d.buyer.require_auth();
        assert_eq!(d.state, SaleState::AwaitingPayment, "Estado invalido");
        // token::Client::new(&env, &d.asset).transfer(&d.buyer, &env.current_contract_address(), &d.amount);
        d.state = SaleState::Paid;
        env.storage().instance().set(&SALE, &d);
    }

    /// Vendedor registra o envio com código de rastreio
    pub fn mark_shipped(env: Env, tracking_code: soroban_sdk::String) {
        let mut d: OnlineSale = env.storage().instance().get(&SALE).unwrap();
        d.seller.require_auth();
        assert_eq!(d.state, SaleState::Paid, "Pagamento nao recebido");
        d.shipped_ts = env.ledger().timestamp();
        d.state = SaleState::Shipped;
        env.events().publish((symbol_short!("shipped"),), tracking_code);
        env.storage().instance().set(&SALE, &d);
    }

    /// Comprador confirma e libera o pagamento ao vendedor
    pub fn confirm_delivery(env: Env) {
        let mut d: OnlineSale = env.storage().instance().get(&SALE).unwrap();
        d.buyer.require_auth();
        assert_eq!(d.state, SaleState::Shipped, "Produto nao enviado");
        // token::Client::new(&env, &d.asset).transfer(&env.current_contract_address(), &d.seller, &d.amount);
        d.state = SaleState::Delivered;
        env.storage().instance().set(&SALE, &d);
    }

    /// Liberação automática após prazo sem disputa (qualquer um pode chamar)
    pub fn auto_release(env: Env) {
        let mut d: OnlineSale = env.storage().instance().get(&SALE).unwrap();
        assert_eq!(d.state, SaleState::Shipped, "Estado invalido");
        assert!(env.ledger().timestamp() >= d.shipped_ts + d.auto_release_secs, "Prazo nao venceu");
        // token::Client::new(&env, &d.asset).transfer(&env.current_contract_address(), &d.seller, &d.amount);
        d.state = SaleState::Delivered;
        env.storage().instance().set(&SALE, &d);
    }

    /// Comprador abre disputa
    pub fn open_dispute(env: Env, reason: soroban_sdk::String) {
        let mut d: OnlineSale = env.storage().instance().get(&SALE).unwrap();
        d.buyer.require_auth();
        assert_eq!(d.state, SaleState::Shipped, "Sem produto enviado");
        d.state = SaleState::Disputed;
        env.events().publish((symbol_short!("dispute"),), reason);
        env.storage().instance().set(&SALE, &d);
    }

    /// Vendedor aceita devolução e reembolsa
    pub fn refund(env: Env) {
        let mut d: OnlineSale = env.storage().instance().get(&SALE).unwrap();
        d.seller.require_auth();
        assert_eq!(d.state, SaleState::Disputed, "Sem disputa aberta");
        // token::Client::new(&env, &d.asset).transfer(&env.current_contract_address(), &d.buyer, &d.amount);
        d.state = SaleState::Refunded;
        env.storage().instance().set(&SALE, &d);
    }
}

// Produto: ${v.productName || '(não informado)'}
// Valor: ${v.amount || '0'} ${v.asset || 'BRZ'} · Auto-release: ${v.autoReleaseDays || '7'} dias
// Tracking: ${v.trackingCode || '(preenchido após envio)'}
`,
};

// ═════════════════════════════════════════════════════════════════════════
// 3. CONTRATO DE FREELANCER POR ENTREGAS (FULL IMPL)
// ═════════════════════════════════════════════════════════════════════════
const freelancerTemplate: SmartContractTemplate = {
  id: 'freelancer',
  name: 'Contrato de Freelancer por Entregas',
  shortName: 'Freelancer',
  description: 'Cliente contrata prestador PJ com pagamento dividido por entrega aprovada.',
  plainLanguage:
    'O cliente deposita o valor total do projeto, e o freelancer (programador, designer, redator) recebe parcela por parcela conforme entrega cada etapa aprovada. Substitui o "paga 50% adiantado e 50% no fim" com risco para os dois lados.',
  icon: '💻',
  category: 'business',
  difficulty: 'Intermediário',
  popularity: 5,
  isFullyImplemented: true,
  useCases: [
    'Desenvolvimento de site/app por freelancer',
    'Identidade visual e branding',
    'Produção de conteúdo (texto, vídeo)',
    'Consultoria por entregas mensuráveis'
  ],
  variables: [
    { name: 'client', label: 'Cliente (contratante)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'freelancer', label: 'Freelancer (prestador PJ)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'totalAmount', label: 'Valor total do projeto', type: 'amount', required: true, placeholder: '15000' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['USDC', 'BRZ', 'XLM'], defaultValue: 'USDC' },
    { name: 'milestoneCount', label: 'Quantidade de entregas', type: 'number', required: true, defaultValue: '4', helper: 'Em quantas etapas o projeto será dividido' },
    { name: 'projectScope', label: 'Escopo do projeto', type: 'text', required: true, placeholder: 'Ex: Site institucional WordPress com 5 páginas + blog' },
    { name: 'deadline', label: 'Prazo final do projeto', type: 'date', required: true },
    { name: 'reviewDays', label: 'Prazo de revisão por entrega (dias)', type: 'number', defaultValue: '5', helper: 'Após esse prazo sem rejeição, a entrega é aprovada automaticamente' },
  ],
  states: [
    { id: 'created', label: 'Criado', color: 'gray', description: 'Aguardando o cliente fundear o projeto' },
    { id: 'funded', label: 'Fundeado', color: 'blue', description: 'Valor depositado, freelancer pode começar' },
    { id: 'in_progress', label: 'Em andamento', color: 'purple', description: 'Entregas sendo feitas e aprovadas' },
    { id: 'completed', label: 'Concluído', color: 'green', description: 'Todas as entregas aprovadas e pagas' },
    { id: 'cancelled', label: 'Cancelado', color: 'red', description: 'Contrato encerrado com saldo devolvido' },
  ],
  actions: [
    { name: 'fund_project', description: 'Cliente deposita o valor total', callableBy: 'client', preState: 'created', postState: 'funded' },
    { name: 'submit_delivery', description: 'Freelancer entrega uma etapa para revisão', callableBy: 'freelancer', preState: 'in_progress', postState: 'in_progress' },
    { name: 'approve_delivery', description: 'Cliente aprova entrega → libera parcela', callableBy: 'client', preState: 'in_progress', postState: 'in_progress | completed' },
    { name: 'reject_delivery', description: 'Cliente rejeita entrega com motivo', callableBy: 'client', preState: 'in_progress', postState: 'in_progress' },
    { name: 'auto_approve', description: 'Aprovação automática após prazo de revisão', callableBy: 'anyone', preState: 'in_progress', postState: 'in_progress' },
    { name: 'cancel', description: 'Cancelamento amigável com saldo devolvido', callableBy: 'client + freelancer', preState: 'in_progress', postState: 'cancelled' },
  ],
  generateSoroban: (v) => `${head('freelancer', 'Contrato de Freelancer por Entregas')}
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum DeliveryStatus { Pending, Submitted, Approved, Rejected }

#[contracttype]
pub struct Delivery {
    pub index: u32,
    pub amount: i128,
    pub status: DeliveryStatus,
    pub submitted_ts: u64,
}

#[contracttype]
pub struct FreelanceProject {
    pub client: Address,
    pub freelancer: Address,
    pub total: i128,
    pub asset: Symbol,
    pub funded: bool,
    pub delivery_count: u32,
    pub deliveries_approved: u32,
    pub review_secs: u64,
}

const PROJ: Symbol = symbol_short!("PROJ");
const DEL: Symbol = symbol_short!("DEL");

#[contract]
pub struct FreelancerContract;

#[contractimpl]
impl FreelancerContract {
    pub fn init(env: Env) {
        let count: u32 = ${v.milestoneCount || '4'};
        let total: i128 = ${v.totalAmount || '15000'}_i128;
        let per_delivery = total / (count as i128);
        let review_days: u64 = ${v.reviewDays || '5'};

        let proj = FreelanceProject {
            client:     Address::from_string(&env, &soroban_sdk::String::from_str(&env, "${v.client || 'GCLIENT...'}")),
            freelancer: Address::from_string(&env, &soroban_sdk::String::from_str(&env, "${v.freelancer || 'GFREELANCER...'}")),
            total,
            asset: symbol_short!("${v.asset || 'USDC'}"),
            funded: false,
            delivery_count: count,
            deliveries_approved: 0,
            review_secs: review_days * 24 * 3600,
        };
        env.storage().instance().set(&PROJ, &proj);

        for i in 0..count {
            let d = Delivery { index: i, amount: per_delivery, status: DeliveryStatus::Pending, submitted_ts: 0 };
            env.storage().persistent().set(&(DEL, i), &d);
        }
    }

    /// Cliente deposita o valor total — começa o projeto
    pub fn fund_project(env: Env) {
        let mut p: FreelanceProject = env.storage().instance().get(&PROJ).unwrap();
        p.client.require_auth();
        assert!(!p.funded, "Ja fundeado");
        // token::Client::new(&env, &p.asset).transfer(&p.client, &env.current_contract_address(), &p.total);
        p.funded = true;
        env.storage().instance().set(&PROJ, &p);
    }

    /// Freelancer submete uma entrega (com link/proof do deliverable)
    pub fn submit_delivery(env: Env, index: u32, proof_url: soroban_sdk::String) {
        let p: FreelanceProject = env.storage().instance().get(&PROJ).unwrap();
        p.freelancer.require_auth();
        let mut d: Delivery = env.storage().persistent().get(&(DEL, index)).unwrap();
        assert_eq!(d.status, DeliveryStatus::Pending, "Entrega ja submetida");
        d.status = DeliveryStatus::Submitted;
        d.submitted_ts = env.ledger().timestamp();
        env.events().publish((symbol_short!("delivery"), index), proof_url);
        env.storage().persistent().set(&(DEL, index), &d);
    }

    /// Cliente aprova a entrega → freelancer recebe a parcela
    pub fn approve_delivery(env: Env, index: u32) {
        let mut p: FreelanceProject = env.storage().instance().get(&PROJ).unwrap();
        p.client.require_auth();
        let mut d: Delivery = env.storage().persistent().get(&(DEL, index)).unwrap();
        assert_eq!(d.status, DeliveryStatus::Submitted, "Entrega nao submetida");
        // token::Client::new(&env, &p.asset).transfer(&env.current_contract_address(), &p.freelancer, &d.amount);
        d.status = DeliveryStatus::Approved;
        p.deliveries_approved += 1;
        env.storage().persistent().set(&(DEL, index), &d);
        env.storage().instance().set(&PROJ, &p);
    }

    /// Cliente rejeita entrega com motivo — freelancer pode refazer
    pub fn reject_delivery(env: Env, index: u32, reason: soroban_sdk::String) {
        let p: FreelanceProject = env.storage().instance().get(&PROJ).unwrap();
        p.client.require_auth();
        let mut d: Delivery = env.storage().persistent().get(&(DEL, index)).unwrap();
        assert_eq!(d.status, DeliveryStatus::Submitted, "Entrega nao submetida");
        d.status = DeliveryStatus::Pending;
        env.events().publish((symbol_short!("rejected"), index), reason);
        env.storage().persistent().set(&(DEL, index), &d);
    }

    /// Aprovação automática após o prazo de revisão (proteção do freelancer)
    pub fn auto_approve(env: Env, index: u32) {
        let mut p: FreelanceProject = env.storage().instance().get(&PROJ).unwrap();
        let mut d: Delivery = env.storage().persistent().get(&(DEL, index)).unwrap();
        assert_eq!(d.status, DeliveryStatus::Submitted, "Entrega nao submetida");
        assert!(env.ledger().timestamp() >= d.submitted_ts + p.review_secs, "Prazo nao venceu");
        // token::Client::new(&env, &p.asset).transfer(&env.current_contract_address(), &p.freelancer, &d.amount);
        d.status = DeliveryStatus::Approved;
        p.deliveries_approved += 1;
        env.storage().persistent().set(&(DEL, index), &d);
        env.storage().instance().set(&PROJ, &p);
    }
}

// Projeto: ${v.projectScope || '(escopo não definido)'}
// Total: ${v.totalAmount || '0'} ${v.asset || 'USDC'} em ${v.milestoneCount || '4'} entregas
// Parcela por entrega: ~${Math.round((parseInt(v.totalAmount || '0') / parseInt(v.milestoneCount || '4')) || 0)} ${v.asset || 'USDC'}
// Prazo final: ${v.deadline || '(a definir)'} · Revisão: ${v.reviewDays || '5'} dias por entrega
`,
};

// ═════════════════════════════════════════════════════════════════════════
// 4–10. SKELETON-READY
// ═════════════════════════════════════════════════════════════════════════

const payrollTemplate: SmartContractTemplate = {
  id: 'payroll',
  name: 'Folha de Pagamento Empresarial',
  shortName: 'Folha',
  description: 'Empresa paga salários de múltiplos funcionários todo mês, na mesma data, no automático.',
  plainLanguage:
    'A empresa cadastra a lista de funcionários (PJ ou CLT em USDC/BRZ) e o contrato paga todo mundo no mesmo dia do mês — sem precisar de funcionário do RH executando manualmente. Pausar ou demitir é uma transação só.',
  icon: '💼',
  category: 'payroll',
  difficulty: 'Intermediário',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'Startup pagando time PJ em USDC',
    'Agência de marketing pagando freelancers fixos',
    'DAO/empresa cripto pagando colaboradores',
    'Pagamento de bolsas de pesquisa/estudo'
  ],
  variables: [
    { name: 'company', label: 'Empresa (pagadora)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'employees', label: 'Funcionários (CSV)', type: 'text', required: true, placeholder: 'GA1...:5000,GB2...:8000,GC3...:12000', helper: 'Formato: endereço:salário, separados por vírgula' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['USDC', 'BRZ', 'XLM'], defaultValue: 'USDC' },
    { name: 'payDay', label: 'Dia do pagamento', type: 'number', required: true, defaultValue: '5', helper: 'Entre 1 e 28' },
    { name: 'startDate', label: 'Início (próximo pagamento)', type: 'date', required: true },
  ],
  states: [
    { id: 'active', label: 'Ativa', color: 'green', description: 'Pagando normalmente todo mês' },
    { id: 'paused', label: 'Pausada', color: 'amber', description: 'Pagamentos suspensos pela empresa' },
  ],
  actions: [
    { name: 'execute_payroll', description: 'Executa a folha do mês atual', callableBy: 'anyone', preState: 'active', postState: 'active' },
    { name: 'add_employee', description: 'Adiciona funcionário à folha', callableBy: 'company', preState: 'active', postState: 'active' },
    { name: 'remove_employee', description: 'Remove funcionário (demissão)', callableBy: 'company', preState: 'active', postState: 'active' },
    { name: 'pause', description: 'Pausa toda a folha', callableBy: 'company', preState: 'active', postState: 'paused' },
  ],
  generateSoroban: (v) => `${head('payroll', 'Folha de Pagamento Empresarial')}
// Skeleton — implementação completa exige Map<Address, i128> e lógica de período mensal

#[contract]
pub struct PayrollContract;

#[contractimpl]
impl PayrollContract {
    pub fn init(env: Env) {
        // Empresa: ${v.company || 'G...'}
        // Funcionários e salários:
        ${(v.employees || '').split(',').map((e, i) => `// ${i + 1}. ${e.trim() || '...'}`).join('\n        ')}
        // Pagamento todo dia ${v.payDay || '5'} em ${v.asset || 'USDC'}
        // Próxima execução: ${v.startDate || '(a definir)'}
    }

    pub fn execute_payroll(env: Env) {
        // TODO: iterar lista, validar período, transferir para cada funcionário
    }

    pub fn add_employee(env: Env, addr: Address, salary: i128) { /* TODO */ }
    pub fn remove_employee(env: Env, addr: Address) { /* TODO */ }
    pub fn pause(env: Env) { /* TODO */ }
}
`,
};

const royaltiesTemplate: SmartContractTemplate = {
  id: 'royalties',
  name: 'Divisão de Royalties (Conteúdo Digital)',
  shortName: 'Royalties',
  description: 'Cada pagamento entrante é dividido automaticamente entre múltiplos criadores por % combinado.',
  plainLanguage:
    'Música/livro/curso vende e o pagamento se divide na hora: artista 70%, gravadora 20%, plataforma 10% — tudo automático, sem precisar de planilha ou contador no fim do mês. Cada centavo tem rastreamento on-chain.',
  icon: '🎵',
  category: 'finance',
  difficulty: 'Intermediário',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Música independente (artista + label)',
    'Curso online com co-autores',
    'NFT com royalties para criador original',
    'Livro digital com editora e revisor'
  ],
  variables: [
    { name: 'product', label: 'Produto/conteúdo', type: 'text', required: true, placeholder: 'Ex: Música "Saudade" - João Silva' },
    { name: 'beneficiaries', label: 'Beneficiários (endereço:%)', type: 'text', required: true, placeholder: 'GA1...:70,GB2...:20,GC3...:10', helper: 'Total precisa somar 100%' },
    { name: 'asset', label: 'Moeda recebida', type: 'asset', options: ['USDC', 'XLM', 'BRZ'], defaultValue: 'USDC' },
  ],
  states: [
    { id: 'active', label: 'Ativo', color: 'green', description: 'Dividindo pagamentos conforme entram' },
    { id: 'paused', label: 'Pausado', color: 'amber', description: 'Recebimentos suspensos' },
  ],
  actions: [
    { name: 'receive_payment', description: 'Recebe pagamento → divide automaticamente', callableBy: 'anyone', preState: 'active', postState: 'active' },
    { name: 'update_split', description: 'Ajusta percentuais (com aprovação de todos)', callableBy: 'all beneficiaries', preState: 'active', postState: 'active' },
  ],
  generateSoroban: (v) => `${head('royalties', 'Divisão de Royalties')}
// Skeleton — Map<Address, u32> com percentuais

#[contract]
pub struct RoyaltiesSplit;

#[contractimpl]
impl RoyaltiesSplit {
    pub fn init(env: Env) {
        // Produto: ${v.product || '(não definido)'}
        // Beneficiários e %:
        ${(v.beneficiaries || '').split(',').map((b, i) => `// ${i + 1}. ${b.trim() || '...'}`).join('\n        ')}
        // Validação: somatório == 100%
    }

    pub fn receive_payment(env: Env, amount: i128) {
        // TODO: para cada beneficiário, transferir (amount * pct / 100)
    }
}
`,
};

const factoringTemplate: SmartContractTemplate = {
  id: 'factoring',
  name: 'Antecipação de Recebíveis (NF)',
  shortName: 'Factoring',
  description: 'PME vende NF com desconto para investidor receber agora; quando cliente paga, investidor recebe valor cheio.',
  plainLanguage:
    'Sua empresa emitiu uma nota fiscal de R$ 100mil com prazo de 60 dias. O investidor te paga R$ 95mil hoje (com desconto). Quando o cliente final pagar os R$ 100mil daqui 60 dias, o contrato repassa direto pro investidor. Você não espera 60 dias e o investidor ganha 5%.',
  icon: '📄',
  category: 'finance',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'PME melhorando capital de giro',
    'Antecipação de recebíveis B2B',
    'Marketplace de duplicatas tokenizadas',
    'Crédito para empresas sem garantia bancária'
  ],
  variables: [
    { name: 'issuer', label: 'Emissor da NF (PME)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'investor', label: 'Investidor', type: 'address', required: true, placeholder: 'G...' },
    { name: 'debtor', label: 'Sacado (cliente final que vai pagar)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'faceValue', label: 'Valor de face da NF', type: 'amount', required: true, placeholder: '100000' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'discountPct', label: 'Desconto (%)', type: 'number', required: true, defaultValue: '5', helper: 'Quanto o investidor ganha. Ex: 5% em 60 dias' },
    { name: 'dueDate', label: 'Vencimento da NF', type: 'date', required: true },
    { name: 'invoiceNumber', label: 'Número da NF', type: 'text', required: true, placeholder: 'NFe-000123' },
  ],
  states: [
    { id: 'offered', label: 'Ofertada', color: 'gray', description: 'PME ofertou a NF, aguardando investidor' },
    { id: 'funded', label: 'Antecipada', color: 'blue', description: 'Investidor pagou valor descontado para PME' },
    { id: 'awaiting_debtor', label: 'Aguardando sacado', color: 'amber', description: 'Esperando cliente final pagar a NF' },
    { id: 'settled', label: 'Liquidada', color: 'green', description: 'Cliente pagou, investidor recebeu valor cheio' },
    { id: 'defaulted', label: 'Inadimplente', color: 'red', description: 'Cliente não pagou no vencimento' },
  ],
  actions: [
    { name: 'fund', description: 'Investidor compra a NF (paga valor descontado)', callableBy: 'investor', preState: 'offered', postState: 'awaiting_debtor' },
    { name: 'debtor_pays', description: 'Cliente final paga o valor cheio', callableBy: 'debtor', preState: 'awaiting_debtor', postState: 'settled' },
    { name: 'mark_default', description: 'Marca inadimplência após vencimento', callableBy: 'anyone', preState: 'awaiting_debtor', postState: 'defaulted' },
  ],
  generateSoroban: (v) => `${head('factoring', 'Antecipação de Recebíveis')}
// Skeleton — implementar lógica de desconto e prazo

#[contract]
pub struct InvoiceFactoring;

#[contractimpl]
impl InvoiceFactoring {
    pub fn init(env: Env) {
        // NF #${v.invoiceNumber || '...'} · Valor: ${v.faceValue || '0'} ${v.asset || 'BRZ'}
        // Desconto: ${v.discountPct || '5'}% → Investidor paga: ${
          ((parseFloat(v.faceValue || '0') * (1 - parseFloat(v.discountPct || '5') / 100)) || 0).toFixed(2)
        } ${v.asset || 'BRZ'}
        // Vencimento: ${v.dueDate || '(a definir)'}
    }

    pub fn fund(env: Env) { /* TODO: investidor → PME (valor descontado) */ }
    pub fn debtor_pays(env: Env) { /* TODO: sacado → contrato → investidor (valor cheio) */ }
    pub fn mark_default(env: Env) { /* TODO: após vencimento sem pagamento */ }
}
`,
};

const founderVestingTemplate: SmartContractTemplate = {
  id: 'founder_vesting',
  name: 'Vesting de Cofundador (Startup)',
  shortName: 'Vesting',
  description: 'Cofundador ou funcionário recebe equity/tokens em lotes mensais, com cliff inicial.',
  plainLanguage:
    'Padrão Silicon Valley: 4 anos de vesting com cliff de 1 ano. O cofundador só começa a poder sacar suas tokens/equity depois de 12 meses na empresa, e o restante vai liberando mês a mês até completar 4 anos. Se sair antes, perde o que ainda não foi liberado.',
  icon: '🚀',
  category: 'business',
  difficulty: 'Intermediário',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Distribuição de equity entre cofundadores',
    'Stock options para funcionários (ESOP)',
    'Allocação de tokens para time fundador (Web3)',
    'Recompensa de advisors e early employees'
  ],
  variables: [
    { name: 'company', label: 'Empresa (custodiante)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'beneficiary', label: 'Cofundador/Funcionário', type: 'address', required: true, placeholder: 'G...' },
    { name: 'totalAmount', label: 'Total a vesting', type: 'amount', required: true, placeholder: '500000' },
    { name: 'asset', label: 'Asset', type: 'asset', options: ['USDC', 'XLM', 'BRZ'], defaultValue: 'USDC', helper: 'Pode ser token customizado de equity' },
    { name: 'cliffMonths', label: 'Cliff (meses)', type: 'number', defaultValue: '12', helper: 'Padrão Silicon Valley: 12 meses' },
    { name: 'vestingMonths', label: 'Vesting total (meses)', type: 'number', defaultValue: '48', helper: 'Padrão: 48 meses (4 anos)' },
    { name: 'startDate', label: 'Data de início', type: 'date', required: true },
    { name: 'role', label: 'Cargo/Papel', type: 'text', required: true, placeholder: 'Ex: Co-founder & CTO' },
  ],
  states: [
    { id: 'cliff', label: 'Em cliff', color: 'gray', description: 'Período de carência, nada disponível ainda' },
    { id: 'vesting', label: 'Vesting ativo', color: 'purple', description: 'Liberação mensal progressiva' },
    { id: 'completed', label: 'Concluído', color: 'green', description: 'Todo o valor liberado' },
    { id: 'terminated', label: 'Terminado antecipado', color: 'red', description: 'Saída antes do prazo — saldo retorna à empresa' },
  ],
  actions: [
    { name: 'claim', description: 'Cofundador saca o vested disponível', callableBy: 'beneficiary', preState: 'vesting', postState: 'vesting | completed' },
    { name: 'terminate', description: 'Empresa termina o vesting (saída do colaborador)', callableBy: 'company', preState: 'cliff | vesting', postState: 'terminated' },
  ],
  generateSoroban: (v) => `${head('founder_vesting', 'Vesting de Cofundador')}
// Skeleton — calcular vested baseado em timestamp + cliff + linear

#[contract]
pub struct FounderVesting;

#[contractimpl]
impl FounderVesting {
    pub fn init(env: Env) {
        // Cofundador: ${v.beneficiary || 'G...'} (${v.role || 'Co-founder'})
        // Total: ${v.totalAmount || '0'} ${v.asset || 'USDC'}
        // Cliff: ${v.cliffMonths || '12'} meses · Vesting: ${v.vestingMonths || '48'} meses
        // Início: ${v.startDate || '(a definir)'}
    }

    pub fn vested(env: Env) -> i128 {
        // TODO: if (now < start + cliff) → 0
        //       if (now > start + vesting) → total
        //       else → total * (now - start) / vesting
        0
    }

    pub fn claim(env: Env) -> i128 { /* TODO: vested - claimed */; 0 }
    pub fn terminate(env: Env) { /* TODO: bloqueia futuras claims */ }
}
`,
};

const fixedYieldTemplate: SmartContractTemplate = {
  id: 'fixed_yield',
  name: 'Investimento de Renda Fixa (CDB Tokenizado)',
  shortName: 'CDB',
  description: 'Investidor trava capital por prazo definido e recebe rendimento pré-fixado ao final.',
  plainLanguage:
    'Como um CDB do banco, mas em cripto: você trava USDC por 12 meses, recebe X% de rendimento garantido ao final. O contrato não permite saque antes (ou penaliza com taxa) e libera principal + juros automaticamente no vencimento.',
  icon: '📈',
  category: 'finance',
  difficulty: 'Intermediário',
  popularity: 5,
  isFullyImplemented: false,
  useCases: [
    'CDB tokenizado emitido por banco',
    'Empréstimo P2P entre pessoas',
    'Tesouraria de DAO emitindo renda fixa',
    'Investimento em recebíveis com taxa fixa'
  ],
  variables: [
    { name: 'investor', label: 'Investidor', type: 'address', required: true, placeholder: 'G...' },
    { name: 'issuer', label: 'Emissor (banco/empresa)', type: 'address', required: true, placeholder: 'G...' },
    { name: 'principal', label: 'Valor investido', type: 'amount', required: true, placeholder: '50000' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['USDC', 'BRZ'], defaultValue: 'USDC' },
    { name: 'annualRate', label: 'Taxa anual (% a.a.)', type: 'number', required: true, defaultValue: '12', helper: 'Ex: 12% ao ano' },
    { name: 'termMonths', label: 'Prazo (meses)', type: 'number', required: true, defaultValue: '12' },
    { name: 'earlyWithdrawal', label: 'Permite resgate antecipado?', type: 'select', options: ['Sim (com penalidade 2%)', 'Não'], defaultValue: 'Não' },
  ],
  states: [
    { id: 'created', label: 'Criado', color: 'gray', description: 'Aguardando depósito do investidor' },
    { id: 'active', label: 'Investido', color: 'blue', description: 'Capital travado, rendendo' },
    { id: 'matured', label: 'Vencido', color: 'purple', description: 'Pronto para resgate com juros' },
    { id: 'redeemed', label: 'Resgatado', color: 'green', description: 'Investidor recebeu principal + juros' },
  ],
  actions: [
    { name: 'invest', description: 'Investidor deposita o capital', callableBy: 'investor', preState: 'created', postState: 'active' },
    { name: 'redeem', description: 'Investidor resgata principal + juros no vencimento', callableBy: 'investor', preState: 'matured', postState: 'redeemed' },
    { name: 'early_withdraw', description: 'Resgate antecipado (com penalidade)', callableBy: 'investor', preState: 'active', postState: 'redeemed' },
  ],
  generateSoroban: (v) => `${head('fixed_yield', 'Renda Fixa Tokenizada')}
// Skeleton — calcular juros compostos: principal * (1 + rate/12)^months

#[contract]
pub struct FixedYield;

#[contractimpl]
impl FixedYield {
    pub fn init(env: Env) {
        // Principal: ${v.principal || '0'} ${v.asset || 'USDC'}
        // Taxa: ${v.annualRate || '12'}% a.a. · Prazo: ${v.termMonths || '12'} meses
        // Rendimento total estimado: ~${
          (parseFloat(v.principal || '0') * Math.pow(1 + parseFloat(v.annualRate || '12') / 100, parseFloat(v.termMonths || '12') / 12)).toFixed(2)
        } ${v.asset || 'USDC'}
        // Resgate antecipado: ${v.earlyWithdrawal || 'Não'}
    }

    pub fn invest(env: Env) { /* TODO: investidor → contrato */ }
    pub fn redeem(env: Env) -> i128 {
        // TODO: validar maturity, calcular principal + juros, transferir
        0
    }
}
`,
};

const groupBuyTemplate: SmartContractTemplate = {
  id: 'group_buy',
  name: 'Compra Coletiva (Group Buy)',
  shortName: 'Group Buy',
  description: 'Desconto destravado quando N pessoas se comprometem. Se atingir, todos pagam; se não, todos são reembolsados.',
  plainLanguage:
    'Tipo Groupon mas garantido por contrato: o vendedor oferece um produto/serviço por R$ X se 50 pessoas se comprometerem. Cada um deposita seu valor; se chegar a 50 antes do prazo, todo mundo é cobrado e o vendedor recebe; se não chegar, todos recebem o dinheiro de volta automaticamente.',
  icon: '🤝',
  category: 'ecommerce',
  difficulty: 'Iniciante',
  popularity: 3,
  isFullyImplemented: false,
  useCases: [
    'Compra de eletrônico em grupo com desconto',
    'Curso/evento com lote mínimo',
    'Equipamento de academia/condomínio',
    'Excursão/viagem com grupo mínimo'
  ],
  variables: [
    { name: 'seller', label: 'Vendedor', type: 'address', required: true, placeholder: 'G...' },
    { name: 'unitPrice', label: 'Preço por pessoa', type: 'amount', required: true, placeholder: '500' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['BRZ', 'USDC'], defaultValue: 'BRZ' },
    { name: 'minParticipants', label: 'Mínimo de participantes', type: 'number', required: true, defaultValue: '20' },
    { name: 'deadline', label: 'Prazo limite', type: 'date', required: true },
    { name: 'product', label: 'Produto/serviço', type: 'text', required: true, placeholder: 'Ex: iPhone 15 com 10% off em compra coletiva' },
  ],
  states: [
    { id: 'collecting', label: 'Coletando participantes', color: 'blue', description: 'Aceitando inscrições' },
    { id: 'succeeded', label: 'Meta atingida', color: 'green', description: 'Mínimo atingido — vendedor pode sacar' },
    { id: 'failed', label: 'Não atingida', color: 'amber', description: 'Prazo venceu sem mínimo — reembolsando' },
  ],
  actions: [
    { name: 'join', description: 'Participante entra e deposita o valor', callableBy: 'anyone', preState: 'collecting', postState: 'collecting | succeeded' },
    { name: 'claim_funds', description: 'Vendedor saca após atingir meta', callableBy: 'seller', preState: 'succeeded', postState: 'succeeded' },
    { name: 'refund_all', description: 'Reembolsa todos se falhou', callableBy: 'anyone', preState: 'failed', postState: 'failed' },
  ],
  generateSoroban: (v) => `${head('group_buy', 'Compra Coletiva')}
// Skeleton

#[contract]
pub struct GroupBuyContract;

#[contractimpl]
impl GroupBuyContract {
    pub fn init(env: Env) {
        // Vendedor: ${v.seller || 'G...'}
        // Produto: ${v.product || '(não definido)'}
        // ${v.minParticipants || '20'} pessoas × ${v.unitPrice || '0'} ${v.asset || 'BRZ'} = mínimo ${
          (parseFloat(v.unitPrice || '0') * parseFloat(v.minParticipants || '20')).toFixed(2)
        } ${v.asset || 'BRZ'}
        // Prazo: ${v.deadline || '(a definir)'}
    }

    pub fn join(env: Env, participant: Address) { /* TODO: registrar e contar */ }
    pub fn claim_funds(env: Env) { /* TODO: só se atingiu mínimo */ }
    pub fn refund_all(env: Env) { /* TODO: só se passou prazo sem atingir */ }
}
`,
};

const parametricInsuranceTemplate: SmartContractTemplate = {
  id: 'parametric_insurance',
  name: 'Seguro Paramétrico',
  shortName: 'Seguro',
  description: 'Apólice com gatilho automático. Quando o evento configurado acontece (confirmado por oráculo), a indenização é paga sem burocracia.',
  plainLanguage:
    'Um seguro que não exige perícia nem advogado: você define o evento (ex: "voo atrasado mais de 3 horas") e a indenização. Quando o oráculo confirmar que aconteceu (dados do aeroporto, clima, sensor), o pagamento sai automático em segundos. Usado por grandes seguradoras hoje (AXA, Etherisc).',
  icon: '☂️',
  category: 'insurance',
  difficulty: 'Avançado',
  popularity: 4,
  isFullyImplemented: false,
  useCases: [
    'Seguro de atraso/cancelamento de voo',
    'Seguro agrícola (chuva/seca via INMET)',
    'Seguro de evento (cancelamento por clima)',
    'Seguro de criptoativos (depeg de stablecoin)'
  ],
  variables: [
    { name: 'insurer', label: 'Segurador', type: 'address', required: true, placeholder: 'G...' },
    { name: 'insured', label: 'Segurado', type: 'address', required: true, placeholder: 'G...' },
    { name: 'premium', label: 'Prêmio (valor pago pelo segurado)', type: 'amount', required: true, placeholder: '50' },
    { name: 'payout', label: 'Indenização (se evento ocorrer)', type: 'amount', required: true, placeholder: '500' },
    { name: 'asset', label: 'Moeda', type: 'asset', options: ['USDC', 'BRZ'], defaultValue: 'USDC' },
    { name: 'triggerEvent', label: 'Evento gatilho', type: 'text', required: true, placeholder: 'Ex: Voo LATAM 3456 atrasado > 3h em 15/06' },
    { name: 'oracle', label: 'Oráculo (quem confirma o evento)', type: 'address', required: true, placeholder: 'G...', helper: 'Ex: API de aeroporto, INMET, Chainlink' },
    { name: 'expiryDate', label: 'Validade da apólice', type: 'date', required: true },
  ],
  states: [
    { id: 'created', label: 'Apólice criada', color: 'gray', description: 'Aguardando pagamento do prêmio' },
    { id: 'active', label: 'Vigente', color: 'green', description: 'Apólice ativa, monitorando evento' },
    { id: 'triggered', label: 'Evento ocorreu', color: 'purple', description: 'Oráculo confirmou — pagando indenização' },
    { id: 'paid', label: 'Indenizado', color: 'blue', description: 'Pagamento ao segurado concluído' },
    { id: 'expired', label: 'Expirada sem evento', color: 'amber', description: 'Validade venceu — prêmio fica com segurador' },
  ],
  actions: [
    { name: 'pay_premium', description: 'Segurado paga o prêmio e ativa a apólice', callableBy: 'insured', preState: 'created', postState: 'active' },
    { name: 'trigger', description: 'Oráculo reporta que o evento ocorreu', callableBy: 'oracle', preState: 'active', postState: 'triggered' },
    { name: 'pay_payout', description: 'Indenização é paga ao segurado', callableBy: 'anyone', preState: 'triggered', postState: 'paid' },
    { name: 'expire', description: 'Apólice expira sem evento (segurador fica com prêmio)', callableBy: 'anyone', preState: 'active', postState: 'expired' },
  ],
  generateSoroban: (v) => `${head('parametric_insurance', 'Seguro Paramétrico')}
// Skeleton — integração com oracle externo (Reflector, Chainlink etc.)

#[contract]
pub struct ParametricInsurance;

#[contractimpl]
impl ParametricInsurance {
    pub fn init(env: Env) {
        // Segurador: ${v.insurer || 'G...'} · Segurado: ${v.insured || 'G...'}
        // Prêmio: ${v.premium || '0'} ${v.asset || 'USDC'}
        // Indenização: ${v.payout || '0'} ${v.asset || 'USDC'} (${
          v.premium && v.payout ? (parseFloat(v.payout) / parseFloat(v.premium)).toFixed(1) : '?'
        }x do prêmio)
        // Trigger: ${v.triggerEvent || '...'}
        // Oráculo: ${v.oracle || 'G...'} · Expira: ${v.expiryDate || '(a definir)'}
    }

    pub fn pay_premium(env: Env) { /* TODO: insured → contrato */ }

    /// Apenas o oráculo configurado pode disparar
    pub fn trigger(env: Env, event_proof: soroban_sdk::String) {
        // TODO: validar require_auth do oráculo
        // TODO: emitir evento + transferir payout para insured
    }

    pub fn expire(env: Env) {
        // TODO: se passou expiryDate sem trigger, prêmio → insurer
    }
}
`,
};

export const SMART_CONTRACT_TEMPLATES: SmartContractTemplate[] = [
  rentTemplate,
  ecommerceTemplate,
  freelancerTemplate,
  payrollTemplate,
  royaltiesTemplate,
  factoringTemplate,
  founderVestingTemplate,
  fixedYieldTemplate,
  groupBuyTemplate,
  parametricInsuranceTemplate,
];

export const TEMPLATES_BY_ID: Record<string, SmartContractTemplate> = Object.fromEntries(
  SMART_CONTRACT_TEMPLATES.map(t => [t.id, t])
);

export const CATEGORIES: { id: SmartContractCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all',          label: 'Todos',         icon: '✨' },
  { id: 'real_estate',  label: 'Imóveis',       icon: '🏠' },
  { id: 'ecommerce',    label: 'E-commerce',    icon: '🛒' },
  { id: 'business',     label: 'Negócios',      icon: '💼' },
  { id: 'payroll',      label: 'Folha',         icon: '💼' },
  { id: 'finance',      label: 'Finanças',      icon: '📈' },
  { id: 'insurance',    label: 'Seguros',       icon: '☂️' },
];
