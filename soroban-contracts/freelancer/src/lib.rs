//! # Contrato de Freelancer por Entregas (freelancer)
//!
//! Cliente trava o valor total do projeto. Freelancer entrega em milestones.
//! Cada milestone tem valor próprio (não precisa ser igual ao dos outros).
//!
//! Fluxo:
//! 1. `init` — define cliente, freelancer, milestones (descrição + valor cada).
//! 2. `fund_project` — cliente deposita soma de todos os milestones.
//! 3. Para cada milestone:
//!    - `submit_delivery(idx, proof_hash)` — freelancer entrega.
//!    - `approve_delivery(idx)` — cliente aprova → freelancer recebe parcela.
//!    - `reject_delivery(idx, reason_hash)` — cliente rejeita → volta para Pending.
//!    - `auto_approve(idx)` — após review_secs sem rejeição.
//! 4. Renegociação opcional: `propose_change` requer aprovação das duas partes.
//! 5. Se freelancer abandonar (`stale_after_days`), cliente recupera saldo restante.
//! 6. Cancelamento amigável: ambos assinam, saldo volta proporcional.

#![no_std]

use contractease_common::{
    add_days, panic_with_error, require_state, token_balance, token_transfer, CommonError,
    SECONDS_PER_DAY,
};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    Symbol, Vec,
};

const PROJ: Symbol = symbol_short!("PROJ");
const DEL: Symbol = symbol_short!("DEL");
const CHG: Symbol = symbol_short!("CHG");

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FreelError {
    DeliveryNotSubmitted = 100,
    DeliveryAlreadyApproved = 101,
    ReviewWindowNotPassed = 102,
    ProjectNotFunded = 103,
    InconsistentMilestones = 104,
    NoStaleness = 105,
    ChangeAlreadyProposed = 106,
    NoChangeProposal = 107,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeliveryStatus {
    Pending,
    Submitted,
    Approved,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProjectStatus {
    Created,
    Funded,
    InProgress,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct Delivery {
    pub idx: u32,
    pub amount: i128,
    pub status: DeliveryStatus,
    pub submitted_ts: u64,
    pub last_proof_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub struct FreelanceProject {
    pub client: Address,
    pub freelancer: Address,
    pub asset: Address,
    pub total: i128,
    pub delivery_count: u32,
    pub deliveries_approved: u32,
    pub paid_out: i128,
    pub review_secs: u64,
    pub stale_secs: u64,
    pub last_activity_ts: u64,
    pub status: ProjectStatus,
}

#[contracttype]
#[derive(Clone)]
pub struct ChangeProposal {
    pub new_total: i128,
    pub new_count: u32,
    pub proposed_by: Address,
    pub proposed_ts: u64,
}

#[contracttype]
pub struct FreelInitParams {
    pub client: Address,
    pub freelancer: Address,
    pub asset: Address,
    /// Valor de cada milestone (em stroops). `total = sum(milestones)`.
    pub milestone_amounts: Vec<i128>,
    pub review_days: u32,
    pub stale_after_days: u32,
}

#[contract]
pub struct FreelancerContract;

#[contractimpl]
impl FreelancerContract {
    pub fn init(env: Env, params: FreelInitParams) {
        if env.storage().instance().has(&PROJ) {
            panic_with_error(&env, CommonError::AlreadyInitialized);
        }
        let count = params.milestone_amounts.len();
        if count == 0 {
            panic_with_error_freel(&env, FreelError::InconsistentMilestones);
        }

        let mut total: i128 = 0;
        for amt in params.milestone_amounts.iter() {
            if amt <= 0 {
                panic_with_error(&env, CommonError::InvalidAmount);
            }
            total = total
                .checked_add(amt)
                .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));
        }

        let proj = FreelanceProject {
            client: params.client.clone(),
            freelancer: params.freelancer.clone(),
            asset: params.asset,
            total,
            delivery_count: count,
            deliveries_approved: 0,
            paid_out: 0,
            review_secs: (params.review_days as u64) * SECONDS_PER_DAY,
            stale_secs: (params.stale_after_days as u64) * SECONDS_PER_DAY,
            last_activity_ts: env.ledger().timestamp(),
            status: ProjectStatus::Created,
        };
        env.storage().instance().set(&PROJ, &proj);

        for (i, amt) in params.milestone_amounts.iter().enumerate() {
            let d = Delivery {
                idx: i as u32,
                amount: amt,
                status: DeliveryStatus::Pending,
                submitted_ts: 0,
                last_proof_hash: BytesN::from_array(&env, &[0u8; 32]),
            };
            env.storage().persistent().set(&(DEL, i as u32), &d);
        }

        env.events()
            .publish((symbol_short!("init"),), (params.client, params.freelancer, count));
    }

    pub fn fund_project(env: Env) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::Created);
        p.client.require_auth();

        token_transfer(
            &env,
            &p.asset,
            &p.client,
            &env.current_contract_address(),
            p.total,
        );

        p.status = ProjectStatus::InProgress;
        p.last_activity_ts = env.ledger().timestamp();
        save(&env, &p);

        env.events().publish((symbol_short!("funded"),), p.total);
    }

    pub fn submit_delivery(env: Env, idx: u32, proof_hash: BytesN<32>) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        p.freelancer.require_auth();

        let mut d = load_delivery(&env, idx);
        require_state(
            &env,
            d.status == DeliveryStatus::Pending || d.status == DeliveryStatus::Rejected,
        );

        d.status = DeliveryStatus::Submitted;
        d.submitted_ts = env.ledger().timestamp();
        d.last_proof_hash = proof_hash.clone();
        env.storage().persistent().set(&(DEL, idx), &d);

        p.last_activity_ts = env.ledger().timestamp();
        save(&env, &p);

        env.events()
            .publish((symbol_short!("submit"), idx), proof_hash);
    }

    pub fn approve_delivery(env: Env, idx: u32) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        p.client.require_auth();

        finalize_approval(&env, &mut p, idx);
    }

    pub fn auto_approve(env: Env, idx: u32) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);

        let d = load_delivery(&env, idx);
        if d.status != DeliveryStatus::Submitted {
            panic_with_error_freel(&env, FreelError::DeliveryNotSubmitted);
        }
        let now = env.ledger().timestamp();
        if now < d.submitted_ts + p.review_secs {
            panic_with_error_freel(&env, FreelError::ReviewWindowNotPassed);
        }

        finalize_approval(&env, &mut p, idx);
    }

    pub fn reject_delivery(env: Env, idx: u32, reason_hash: BytesN<32>) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        p.client.require_auth();

        let mut d = load_delivery(&env, idx);
        if d.status != DeliveryStatus::Submitted {
            panic_with_error_freel(&env, FreelError::DeliveryNotSubmitted);
        }

        d.status = DeliveryStatus::Rejected;
        env.storage().persistent().set(&(DEL, idx), &d);

        p.last_activity_ts = env.ledger().timestamp();
        save(&env, &p);

        env.events()
            .publish((symbol_short!("reject"), idx), reason_hash);
    }

    /// Cliente recupera saldo se freelancer ficar inativo por stale_secs.
    pub fn withdraw_unspent(env: Env) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        p.client.require_auth();

        let now = env.ledger().timestamp();
        if now < p.last_activity_ts + p.stale_secs {
            panic_with_error_freel(&env, FreelError::NoStaleness);
        }

        let balance = token_balance(&env, &p.asset, &env.current_contract_address());
        if balance > 0 {
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.client,
                balance,
            );
        }
        p.status = ProjectStatus::Cancelled;
        save(&env, &p);

        env.events().publish((symbol_short!("stale"),), balance);
    }

    /// Cancelamento amigável: ambos assinam, freelancer recebe pelas entregas
    /// já aprovadas, cliente recupera o restante.
    pub fn cancel_mutual(env: Env) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        p.client.require_auth();
        p.freelancer.require_auth();

        let balance = token_balance(&env, &p.asset, &env.current_contract_address());
        if balance > 0 {
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.client,
                balance,
            );
        }
        p.status = ProjectStatus::Cancelled;
        save(&env, &p);

        env.events().publish((symbol_short!("cancel"),), balance);
    }

    /// Propõe mudança no escopo (novo total + nova contagem).
    /// Vigora apenas após a contraparte aceitar.
    pub fn propose_change(env: Env, proposer: Address, new_total: i128, new_count: u32) {
        let p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        proposer.require_auth();

        if proposer != p.client && proposer != p.freelancer {
            panic_with_error(&env, CommonError::Unauthorized);
        }
        if env.storage().persistent().has(&CHG) {
            panic_with_error_freel(&env, FreelError::ChangeAlreadyProposed);
        }
        if new_total <= 0 || new_count == 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let proposal = ChangeProposal {
            new_total,
            new_count,
            proposed_by: proposer.clone(),
            proposed_ts: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&CHG, &proposal);
        env.events()
            .publish((symbol_short!("chgprop"),), (proposer, new_total, new_count));
    }

    /// Aceita a proposta de mudança. Ajusta o `total` do projeto.
    /// Se `new_total > paid_out`, cliente precisa depositar o delta.
    /// Se `new_total < paid_out`, freelancer já recebeu mais do que o novo total
    /// → operação falha (precisaria de refund manual).
    pub fn accept_change(env: Env, acceptor: Address) {
        let mut p = load(&env);
        let proposal: ChangeProposal = env
            .storage()
            .persistent()
            .get(&CHG)
            .unwrap_or_else(|| panic_with_error_freel(&env, FreelError::NoChangeProposal));

        if acceptor == proposal.proposed_by {
            panic_with_error(&env, CommonError::Unauthorized);
        }
        if acceptor != p.client && acceptor != p.freelancer {
            panic_with_error(&env, CommonError::Unauthorized);
        }
        acceptor.require_auth();

        if proposal.new_total < p.paid_out {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let delta = proposal.new_total - p.total;
        if delta > 0 {
            // cliente complementa
            token_transfer(
                &env,
                &p.asset,
                &p.client,
                &env.current_contract_address(),
                delta,
            );
        } else if delta < 0 {
            // devolve excesso ao cliente
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.client,
                -delta,
            );
        }

        p.total = proposal.new_total;
        p.delivery_count = proposal.new_count;
        save(&env, &p);

        env.storage().persistent().remove(&CHG);
        env.events()
            .publish((symbol_short!("chgok"),), (proposal.new_total, proposal.new_count));
    }

    // ─── READ-ONLY ───────────────────────────────────────────────────

    pub fn get_status(env: Env) -> ProjectStatus {
        load(&env).status
    }

    pub fn get_project(env: Env) -> FreelanceProject {
        load(&env)
    }

    pub fn get_delivery(env: Env, idx: u32) -> Option<Delivery> {
        env.storage().persistent().get(&(DEL, idx))
    }

    pub fn escrow_balance(env: Env) -> i128 {
        let p = load(&env);
        token_balance(&env, &p.asset, &env.current_contract_address())
    }

    pub fn stale_at(env: Env) -> u64 {
        let p = load(&env);
        add_days(&env, p.last_activity_ts, p.stale_secs / SECONDS_PER_DAY)
    }
}

// ─── HELPERS PRIVADOS ────────────────────────────────────────────────

fn load(env: &Env) -> FreelanceProject {
    env.storage()
        .instance()
        .get(&PROJ)
        .unwrap_or_else(|| panic_with_error(env, CommonError::NotInitialized))
}

fn save(env: &Env, p: &FreelanceProject) {
    env.storage().instance().set(&PROJ, p);
}

fn load_delivery(env: &Env, idx: u32) -> Delivery {
    env.storage()
        .persistent()
        .get(&(DEL, idx))
        .unwrap_or_else(|| panic_with_error(env, CommonError::IndexOutOfRange))
}

fn finalize_approval(env: &Env, p: &mut FreelanceProject, idx: u32) {
    let mut d = load_delivery(env, idx);
    if d.status != DeliveryStatus::Submitted {
        panic_with_error_freel(env, FreelError::DeliveryNotSubmitted);
    }

    token_transfer(
        env,
        &p.asset,
        &env.current_contract_address(),
        &p.freelancer,
        d.amount,
    );

    d.status = DeliveryStatus::Approved;
    env.storage().persistent().set(&(DEL, idx), &d);

    p.deliveries_approved += 1;
    p.paid_out = p
        .paid_out
        .checked_add(d.amount)
        .unwrap_or_else(|| panic_with_error(env, CommonError::Overflow));
    p.last_activity_ts = env.ledger().timestamp();

    if p.deliveries_approved == p.delivery_count {
        p.status = ProjectStatus::Completed;
    }
    save(env, p);

    env.events()
        .publish((symbol_short!("approved"), idx), d.amount);
}

fn panic_with_error_freel(env: &Env, err: FreelError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

#[cfg(test)]
mod test;
