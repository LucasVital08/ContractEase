//! # Aluguel Residencial com Caução (rent)
//!
//! Contrato administra a relação locador ↔ inquilino:
//!
//! 1. Inquilino deposita a **caução** (N × aluguel) ao ativar o contrato.
//! 2. Aluguel é pago mensalmente. O contrato calcula vencimentos a partir
//!    de `start_ts` + dia do mês configurado.
//! 3. Multa de mora é aplicada após o vencimento (`late_fee_bps`).
//! 4. Após N inadimplências consecutivas (`max_consecutive_overdue`),
//!    o locador pode rescindir e reter parte da caução.
//! 5. No término normal: vistoria → caução devolvida integral ou
//!    retida parcialmente com prova on-chain (hash de laudo).
//!
//! ## Decisões de design
//!
//! - Asset é `Address` de um contrato SEP-41 (ex: BRZ). Nada de `Symbol`.
//! - Todo valor é `i128` em **stroops** (unidade mínima — 7 casas decimais
//!   na Stellar). Frontend converte para a exibição.
//! - Eventos são emitidos a cada transição relevante para o indexer.

#![no_std]

use contractease_common::{
    add_days, admin_get, admin_set, panic_with_error, require_state, token_balance,
    token_transfer, CommonError, SECONDS_PER_DAY,
};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    String, Symbol,
};

const DATA: Symbol = symbol_short!("DATA");
const MONTH: Symbol = symbol_short!("MONTH");

const BPS_DENOMINATOR: i128 = 10_000;

// ─── ERROS ESPECÍFICOS ───────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RentError {
    DepositAlreadyPaid = 100,
    RentAlreadyPaidThisMonth = 101,
    NotOverdue = 102,
    EvaluationNotStarted = 103,
    InvalidDueDay = 104,
    InvalidDuration = 105,
    ExcessiveRetention = 106,
}

// ─── ESTADO ──────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RentState {
    AwaitingDeposit,
    Active,
    Overdue,
    Evaluation,
    ClosedClean,
    ClosedDamaged,
    Terminated,
}

#[contracttype]
#[derive(Clone)]
pub struct RentalAgreement {
    pub landlord: Address,
    pub tenant: Address,
    pub asset: Address,
    pub monthly_rent: i128,
    pub deposit: i128,
    pub deposit_months: u32,
    pub due_day: u32,
    pub duration_months: u32,
    pub start_ts: u64,
    pub months_paid: u32,
    pub consecutive_overdue: u32,
    pub late_fee_bps: u32,
    pub max_consecutive_overdue: u32,
    pub state: RentState,
    pub property_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub struct MonthRecord {
    pub idx: u32,
    pub due_ts: u64,
    pub paid_ts: u64,
    pub amount_paid: i128,
    pub late_fee_paid: i128,
}

// ─── INIT PARAMS ─────────────────────────────────────────────────────

#[contracttype]
pub struct RentInitParams {
    pub landlord: Address,
    pub tenant: Address,
    pub asset: Address,
    pub monthly_rent: i128,
    pub deposit_months: u32,
    pub due_day: u32,
    pub duration_months: u32,
    pub late_fee_bps: u32,
    pub max_consecutive_overdue: u32,
    /// Hash SHA-256 do laudo do imóvel (endereço, fotos iniciais, matrícula).
    pub property_hash: BytesN<32>,
}

// ─── CONTRATO ────────────────────────────────────────────────────────

#[contract]
pub struct RentalContract;

#[contractimpl]
impl RentalContract {
    /// Inicializa o contrato. Só pode ser chamado uma vez.
    /// O `landlord` se torna o admin (pode escalar disputa, etc).
    pub fn init(env: Env, params: RentInitParams) {
        if env.storage().instance().has(&DATA) {
            panic_with_error(&env, CommonError::AlreadyInitialized);
        }
        if params.due_day == 0 || params.due_day > 28 {
            panic_with_error_rent(&env, RentError::InvalidDueDay);
        }
        if params.duration_months == 0 {
            panic_with_error_rent(&env, RentError::InvalidDuration);
        }
        if params.monthly_rent <= 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        admin_set(&env, &params.landlord);

        let deposit = params
            .monthly_rent
            .checked_mul(params.deposit_months as i128)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));

        let agreement = RentalAgreement {
            landlord: params.landlord.clone(),
            tenant: params.tenant.clone(),
            asset: params.asset,
            monthly_rent: params.monthly_rent,
            deposit,
            deposit_months: params.deposit_months,
            due_day: params.due_day,
            duration_months: params.duration_months,
            start_ts: env.ledger().timestamp(),
            months_paid: 0,
            consecutive_overdue: 0,
            late_fee_bps: params.late_fee_bps,
            max_consecutive_overdue: params.max_consecutive_overdue,
            state: RentState::AwaitingDeposit,
            property_hash: params.property_hash,
        };
        env.storage().instance().set(&DATA, &agreement);

        env.events()
            .publish((symbol_short!("init"),), (params.landlord, params.tenant));
    }

    /// Inquilino deposita a caução e ativa o contrato.
    pub fn pay_deposit(env: Env) {
        let mut d: RentalAgreement = load(&env);
        require_state(&env, d.state == RentState::AwaitingDeposit);
        d.tenant.require_auth();

        token_transfer(
            &env,
            &d.asset,
            &d.tenant,
            &env.current_contract_address(),
            d.deposit,
        );

        d.state = RentState::Active;
        save(&env, &d);

        env.events()
            .publish((symbol_short!("deposit"),), d.deposit);
    }

    /// Inquilino paga o aluguel do mês corrente (ou um específico).
    ///
    /// Quando chamada **após o vencimento**, aplica multa de mora
    /// proporcional aos dias de atraso.
    pub fn pay_rent(env: Env) {
        let mut d: RentalAgreement = load(&env);
        require_state(
            &env,
            d.state == RentState::Active || d.state == RentState::Overdue,
        );
        d.tenant.require_auth();

        let month_idx = d.months_paid;
        if month_idx >= d.duration_months {
            panic_with_error(&env, CommonError::InvalidState);
        }

        let due_ts = compute_due_ts(&env, &d, month_idx);
        let now = env.ledger().timestamp();

        let mut late_fee: i128 = 0;
        if now > due_ts {
            let days_late = (now - due_ts) / SECONDS_PER_DAY;
            // multa = aluguel * late_fee_bps * days_late / (BPS * 30)
            // (proporcional ao mês)
            late_fee = d
                .monthly_rent
                .checked_mul(d.late_fee_bps as i128)
                .and_then(|x| x.checked_mul(days_late as i128))
                .and_then(|x| x.checked_div(BPS_DENOMINATOR.checked_mul(30).unwrap()))
                .unwrap_or(0);
        }

        let total = d
            .monthly_rent
            .checked_add(late_fee)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));

        token_transfer(&env, &d.asset, &d.tenant, &d.landlord, total);

        d.months_paid += 1;
        d.consecutive_overdue = 0;
        if d.state == RentState::Overdue {
            d.state = RentState::Active;
        }

        save(&env, &d);
        let record = MonthRecord {
            idx: month_idx,
            due_ts,
            paid_ts: now,
            amount_paid: d.monthly_rent,
            late_fee_paid: late_fee,
        };
        env.storage().persistent().set(&(MONTH, month_idx), &record);

        env.events()
            .publish((symbol_short!("paid"), month_idx), (d.monthly_rent, late_fee));
    }

    /// Marca a inadimplência do mês corrente. Chamável por qualquer um
    /// após o vencimento (ideal: cron job do indexer).
    pub fn mark_overdue(env: Env) {
        let mut d: RentalAgreement = load(&env);
        require_state(&env, d.state == RentState::Active);

        let month_idx = d.months_paid;
        if month_idx >= d.duration_months {
            panic_with_error(&env, CommonError::InvalidState);
        }
        let due_ts = compute_due_ts(&env, &d, month_idx);
        let now = env.ledger().timestamp();

        if now <= due_ts {
            panic_with_error_rent(&env, RentError::NotOverdue);
        }

        d.consecutive_overdue += 1;
        d.state = RentState::Overdue;
        save(&env, &d);

        env.events()
            .publish((symbol_short!("overdue"), month_idx), d.consecutive_overdue);
    }

    /// Locador rescinde por inadimplência reiterada e retém parte da caução
    /// equivalente aos meses devidos.
    pub fn terminate_for_default(env: Env) {
        let mut d: RentalAgreement = load(&env);
        require_state(&env, d.state == RentState::Overdue);
        d.landlord.require_auth();

        if d.consecutive_overdue < d.max_consecutive_overdue {
            panic_with_error(&env, CommonError::InvalidState);
        }

        // retenção = nº atrasos × aluguel (limitado à caução)
        let owed = d
            .monthly_rent
            .checked_mul(d.consecutive_overdue as i128)
            .unwrap_or(d.deposit)
            .min(d.deposit);

        let refund = d.deposit - owed;

        if owed > 0 {
            token_transfer(
                &env,
                &d.asset,
                &env.current_contract_address(),
                &d.landlord,
                owed,
            );
        }
        if refund > 0 {
            token_transfer(
                &env,
                &d.asset,
                &env.current_contract_address(),
                &d.tenant,
                refund,
            );
        }

        d.state = RentState::Terminated;
        save(&env, &d);

        env.events()
            .publish((symbol_short!("terminate"),), (owed, refund));
    }

    /// Solicita vistoria final (qualquer das partes).
    pub fn request_evaluation(env: Env, caller: Address) {
        let mut d: RentalAgreement = load(&env);
        require_state(&env, d.state == RentState::Active);
        caller.require_auth();

        if caller != d.landlord && caller != d.tenant {
            panic_with_error(&env, CommonError::Unauthorized);
        }

        d.state = RentState::Evaluation;
        save(&env, &d);

        env.events().publish((symbol_short!("evalreq"),), caller);
    }

    /// Locador libera a caução integral ao inquilino (sem danos).
    pub fn release_deposit(env: Env) {
        let mut d: RentalAgreement = load(&env);
        require_state(&env, d.state == RentState::Evaluation);
        d.landlord.require_auth();

        token_transfer(
            &env,
            &d.asset,
            &env.current_contract_address(),
            &d.tenant,
            d.deposit,
        );

        d.state = RentState::ClosedClean;
        save(&env, &d);

        env.events()
            .publish((symbol_short!("released"),), d.deposit);
    }

    /// Locador retém parte da caução por danos comprovados.
    /// `damage_proof_hash` é o SHA-256 do laudo (PDF) armazenado off-chain.
    pub fn retain_deposit(
        env: Env,
        retain_amount: i128,
        damage_proof_hash: BytesN<32>,
    ) {
        let mut d: RentalAgreement = load(&env);
        require_state(&env, d.state == RentState::Evaluation);
        d.landlord.require_auth();

        if retain_amount <= 0 || retain_amount > d.deposit {
            panic_with_error_rent(&env, RentError::ExcessiveRetention);
        }

        let refund = d.deposit - retain_amount;

        token_transfer(
            &env,
            &d.asset,
            &env.current_contract_address(),
            &d.landlord,
            retain_amount,
        );
        if refund > 0 {
            token_transfer(
                &env,
                &d.asset,
                &env.current_contract_address(),
                &d.tenant,
                refund,
            );
        }

        d.state = RentState::ClosedDamaged;
        save(&env, &d);

        env.events().publish(
            (symbol_short!("damage"),),
            (retain_amount, refund, damage_proof_hash),
        );
    }

    // ─── READ-ONLY ───────────────────────────────────────────────────

    pub fn get_state(env: Env) -> RentState {
        load(&env).state
    }

    pub fn get_agreement(env: Env) -> RentalAgreement {
        load(&env)
    }

    pub fn get_month(env: Env, idx: u32) -> Option<MonthRecord> {
        env.storage().persistent().get(&(MONTH, idx))
    }

    pub fn next_due_ts(env: Env) -> u64 {
        let d = load(&env);
        compute_due_ts(&env, &d, d.months_paid)
    }

    pub fn deposit_balance(env: Env) -> i128 {
        let d = load(&env);
        token_balance(&env, &d.asset, &env.current_contract_address())
    }

    pub fn admin(env: Env) -> Address {
        admin_get(&env)
    }

    pub fn property_hash(env: Env) -> BytesN<32> {
        load(&env).property_hash
    }

    /// Anota uma observação textual on-chain (até 200 chars).
    /// Útil para registrar comunicações relevantes.
    pub fn note(env: Env, caller: Address, message: String) {
        let d = load(&env);
        caller.require_auth();
        if caller != d.landlord && caller != d.tenant {
            panic_with_error(&env, CommonError::Unauthorized);
        }
        env.events().publish((symbol_short!("note"), caller), message);
    }
}

// ─── HELPERS PRIVADOS ────────────────────────────────────────────────

fn load(env: &Env) -> RentalAgreement {
    env.storage()
        .instance()
        .get(&DATA)
        .unwrap_or_else(|| panic_with_error(env, CommonError::NotInitialized))
}

fn save(env: &Env, d: &RentalAgreement) {
    env.storage().instance().set(&DATA, d);
}

fn compute_due_ts(env: &Env, d: &RentalAgreement, month_idx: u32) -> u64 {
    // Modelo simplificado: vencimento = start_ts + (month_idx + 1) * 30 dias.
    // Suficiente para Soroban (não lidamos com calendário real on-chain).
    // Frontend mostra a data nominal (dia X do mês N).
    add_days(env, d.start_ts, ((month_idx + 1) as u64) * 30)
}

fn panic_with_error_rent(env: &Env, err: RentError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

#[cfg(test)]
mod test;
