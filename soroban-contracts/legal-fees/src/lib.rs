//! # Honorários Advocatícios (legal-fees)
//!
//! Contrato de honorários com 3 componentes:
//!
//! 1. **Entrada (retainer)** — paga ao assinar o contrato.
//! 2. **Mensalidades** — pagas a cada 30 dias durante `duration_months`.
//! 3. **Êxito (quota litis)** — % do valor recuperado, paga ao registrar o ganho.
//!
//! Conformidade OAB:
//! - Quota litis é registrada com **dupla assinatura** (advogado + cliente)
//!   para evitar disputa sobre valor recuperado.
//! - Distrato (terminação antecipada) calcula honorários proporcionais
//!   aos meses já trabalhados + multa configurável (default 10%).
//! - `case_id_hash` referencia o número de processo + objeto da causa.

#![no_std]

use contractease_common::{
    add_days, bump_instance, panic_with_error, require_state, token_balance, token_transfer,
    CommonError, SECONDS_PER_DAY,
};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    Symbol,
};

const DATA: Symbol = symbol_short!("DATA");
const SUCC: Symbol = symbol_short!("SUCC");
const BPS_DENOM: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LegalError {
    RetainerAlreadyPaid = 100,
    SuccessNotProposed = 101,
    SuccessAlreadyProposed = 102,
    PartiesMismatch = 103,
    MonthNotDue = 104,
    NotInSuccessPhase = 105,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LegalState {
    Signed,
    Active,
    Success,
    ClosedNoSuccess,
    Terminated,
}

#[contracttype]
#[derive(Clone)]
pub struct LegalAgreement {
    pub lawyer: Address,
    pub client: Address,
    pub asset: Address,
    pub retainer: i128,
    pub monthly_fee: i128,
    pub duration_months: u32,
    pub success_rate_bps: u32, // 2000 = 20%
    pub termination_fee_bps: u32, // 1000 = 10%
    pub start_ts: u64,
    pub months_paid: u32,
    pub retainer_paid: bool,
    pub recovered_amount: i128,
    pub state: LegalState,
    pub case_id_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub struct SuccessProposal {
    pub recovered_amount: i128,
    pub proposed_by: Address,
    pub proposed_ts: u64,
}

#[contracttype]
pub struct LegalInitParams {
    pub lawyer: Address,
    pub client: Address,
    pub asset: Address,
    pub retainer: i128,
    pub monthly_fee: i128,
    pub duration_months: u32,
    pub success_rate_bps: u32,
    pub termination_fee_bps: u32,
    pub case_id_hash: BytesN<32>,
}

#[contract]
pub struct LegalFees;

#[contractimpl]
impl LegalFees {
    pub fn init(env: Env, params: LegalInitParams) {
        if env.storage().instance().has(&DATA) {
            panic_with_error(&env, CommonError::AlreadyInitialized);
        }
        if params.retainer < 0 || params.monthly_fee < 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }
        if params.success_rate_bps > BPS_DENOM as u32 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let agreement = LegalAgreement {
            lawyer: params.lawyer.clone(),
            client: params.client.clone(),
            asset: params.asset,
            retainer: params.retainer,
            monthly_fee: params.monthly_fee,
            duration_months: params.duration_months,
            success_rate_bps: params.success_rate_bps,
            termination_fee_bps: params.termination_fee_bps,
            start_ts: env.ledger().timestamp(),
            months_paid: 0,
            retainer_paid: false,
            recovered_amount: 0,
            state: LegalState::Signed,
            case_id_hash: params.case_id_hash,
        };
        env.storage().instance().set(&DATA, &agreement);

        env.events()
            .publish((symbol_short!("init"),), (params.lawyer, params.client));
    }

    /// Cliente paga a entrada → ativa o contrato.
    pub fn pay_retainer(env: Env) {
        let mut d = load(&env);
        require_state(&env, d.state == LegalState::Signed);
        d.client.require_auth();

        if d.retainer_paid {
            panic_with_error_legal(&env, LegalError::RetainerAlreadyPaid);
        }

        if d.retainer > 0 {
            token_transfer(&env, &d.asset, &d.client, &d.lawyer, d.retainer);
        }

        d.retainer_paid = true;
        d.state = LegalState::Active;
        save(&env, &d);

        env.events().publish((symbol_short!("retainer"),), d.retainer);
    }

    /// Cobrança mensal. Calcula índice do mês a partir de `start_ts`.
    /// Pode ser chamada por qualquer pessoa (cron); só processa se o mês está devido.
    pub fn pay_monthly(env: Env) {
        let mut d = load(&env);
        require_state(&env, d.state == LegalState::Active);

        if d.months_paid >= d.duration_months {
            panic_with_error(&env, CommonError::InvalidState);
        }

        let due_ts = add_days(
            &env,
            d.start_ts,
            ((d.months_paid + 1) as u64) * 30,
        );
        if env.ledger().timestamp() < due_ts {
            panic_with_error_legal(&env, LegalError::MonthNotDue);
        }

        d.client.require_auth();
        if d.monthly_fee > 0 {
            token_transfer(&env, &d.asset, &d.client, &d.lawyer, d.monthly_fee);
        }
        d.months_paid += 1;
        save(&env, &d);

        env.events()
            .publish((symbol_short!("monthly"), d.months_paid), d.monthly_fee);
    }

    /// Uma das partes propõe o valor recuperado (ganho do processo).
    /// A outra parte precisa confirmar com `confirm_success` para liberar o êxito.
    pub fn propose_success(env: Env, proposer: Address, recovered_amount: i128) {
        let d = load(&env);
        require_state(&env, d.state == LegalState::Active);
        proposer.require_auth();

        if proposer != d.lawyer && proposer != d.client {
            panic_with_error(&env, CommonError::Unauthorized);
        }
        if recovered_amount <= 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }
        if env.storage().persistent().has(&SUCC) {
            panic_with_error_legal(&env, LegalError::SuccessAlreadyProposed);
        }

        let prop = SuccessProposal {
            recovered_amount,
            proposed_by: proposer.clone(),
            proposed_ts: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&SUCC, &prop);

        env.events()
            .publish((symbol_short!("propsucc"),), (proposer, recovered_amount));
    }

    /// Contraparte confirma o valor proposto. Aplica % e libera ao advogado.
    /// O valor do êxito vem da carteira do cliente (não há escrow no legal-fees).
    pub fn confirm_success(env: Env, confirmer: Address) {
        let mut d = load(&env);
        require_state(&env, d.state == LegalState::Active);

        let prop: SuccessProposal = env
            .storage()
            .persistent()
            .get(&SUCC)
            .unwrap_or_else(|| panic_with_error_legal(&env, LegalError::SuccessNotProposed));

        if confirmer == prop.proposed_by {
            panic_with_error(&env, CommonError::Unauthorized);
        }
        if confirmer != d.lawyer && confirmer != d.client {
            panic_with_error(&env, CommonError::Unauthorized);
        }
        confirmer.require_auth();

        let success_fee = prop
            .recovered_amount
            .checked_mul(d.success_rate_bps as i128)
            .and_then(|x| x.checked_div(BPS_DENOM))
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));

        if success_fee > 0 {
            token_transfer(&env, &d.asset, &d.client, &d.lawyer, success_fee);
        }

        d.recovered_amount = prop.recovered_amount;
        d.state = LegalState::Success;
        save(&env, &d);
        env.storage().persistent().remove(&SUCC);

        env.events()
            .publish((symbol_short!("success"),), (prop.recovered_amount, success_fee));
    }

    /// Encerra o processo sem êxito (apenas mensalidades pagas).
    /// Requer dupla assinatura — protege ambos os lados.
    pub fn close_no_success(env: Env) {
        let mut d = load(&env);
        require_state(&env, d.state == LegalState::Active);

        d.lawyer.require_auth();
        d.client.require_auth();

        d.state = LegalState::ClosedNoSuccess;
        save(&env, &d);

        env.events()
            .publish((symbol_short!("nosucc"),), d.months_paid);
    }

    /// Distrato antecipado. Pode ser solicitado por qualquer parte (com auth).
    /// Cliente paga multa de `termination_fee_bps` sobre os meses restantes.
    pub fn terminate_early(env: Env, caller: Address) {
        let mut d = load(&env);
        require_state(&env, d.state == LegalState::Active);
        caller.require_auth();

        if caller != d.lawyer && caller != d.client {
            panic_with_error(&env, CommonError::Unauthorized);
        }

        let remaining_months = (d.duration_months - d.months_paid) as i128;
        let remaining_value = d.monthly_fee.saturating_mul(remaining_months);
        let penalty = remaining_value
            .checked_mul(d.termination_fee_bps as i128)
            .and_then(|x| x.checked_div(BPS_DENOM))
            .unwrap_or(0);

        // Quem terminou paga a multa para a contraparte
        if penalty > 0 {
            let (from, to) = if caller == d.client {
                (d.client.clone(), d.lawyer.clone())
            } else {
                (d.lawyer.clone(), d.client.clone())
            };
            token_transfer(&env, &d.asset, &from, &to, penalty);
        }

        d.state = LegalState::Terminated;
        save(&env, &d);

        env.events()
            .publish((symbol_short!("term"),), (caller, penalty));
    }

    // ─── READ-ONLY ───────────────────────────────────────────────────

    pub fn get_state(env: Env) -> LegalState {
        load(&env).state
    }

    pub fn get_agreement(env: Env) -> LegalAgreement {
        load(&env)
    }

    pub fn pending_success(env: Env) -> Option<SuccessProposal> {
        env.storage().persistent().get(&SUCC)
    }

    pub fn next_month_due_ts(env: Env) -> u64 {
        let d = load(&env);
        add_days(
            &env,
            d.start_ts,
            ((d.months_paid + 1) as u64) * 30,
        )
    }

    pub fn balance(env: Env) -> i128 {
        let d = load(&env);
        token_balance(&env, &d.asset, &env.current_contract_address())
    }
}

fn load(env: &Env) -> LegalAgreement {
    bump_instance(env);
    env.storage()
        .instance()
        .get(&DATA)
        .unwrap_or_else(|| panic_with_error(env, CommonError::NotInitialized))
}

fn save(env: &Env, d: &LegalAgreement) {
    env.storage().instance().set(&DATA, d);
}

fn panic_with_error_legal(env: &Env, err: LegalError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

#[cfg(test)]
mod test;
