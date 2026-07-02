//! # Empreitada de Obra com Marcos (construction)
//!
//! Construção civil dividida em **marcos físicos** (fundação, alvenaria, etc).
//! Cada marco tem valor próprio. Fluxo de aprovação **tri-partido**:
//!
//! 1. **Construtora** submete o marco (`submit_milestone`) com hash do laudo.
//! 2. **Engenheiro** assina atestando a execução técnica (`engineer_sign`).
//! 3. **Cliente** libera o pagamento (`client_release`).
//!
//! Em cada liberação, `retention_bps` ficam retidos como caução até o aceite final.
//!
//! - `accept_work` — cliente aceita a obra → inicia warranty (90 dias).
//! - `release_retention` — após warranty sem reclamações.
//! - `claim_warranty` — cliente reclama vício oculto → trava retenção.
//! - `arbitrate_warranty` — árbitro (CREA/CAU) decide split.

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
const MS: Symbol = symbol_short!("MS");

const BPS_DENOM: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ConstructionError {
    MilestoneNotSubmitted = 100,
    EngineerNotSigned = 101,
    AlreadyPaid = 102,
    WarrantyNotPassed = 103,
    InvalidRetention = 104,
    NoWarrantyClaim = 105,
    NoArbiter = 106,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    EngineerApproved,
    Paid,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProjectStatus {
    Funded,
    InProgress,
    AwaitingAcceptance,
    Warranty,
    WarrantyClaim,
    Closed,
}

#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    pub idx: u32,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub submitted_ts: u64,
    pub laudo_hash: BytesN<32>,
    pub engineer_signed_ts: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct ConstructionProject {
    pub contractor: Address,
    pub client: Address,
    pub engineer: Address,
    pub arbiter: Option<Address>,
    pub asset: Address,
    pub total_value: i128,
    pub milestones_count: u32,
    pub milestones_paid: u32,
    pub retention_bps: u32,
    pub retention_locked: i128,
    pub warranty_secs: u64,
    pub accepted_ts: u64,
    pub work_address_hash: BytesN<32>,
    pub status: ProjectStatus,
}

#[contracttype]
pub struct ConstructionInitParams {
    pub contractor: Address,
    pub client: Address,
    pub engineer: Address,
    pub arbiter: Option<Address>,
    pub asset: Address,
    pub milestone_amounts: Vec<i128>,
    pub retention_bps: u32,
    pub warranty_days: u32,
    pub work_address_hash: BytesN<32>,
}

#[contract]
pub struct ConstructionContract;

#[contractimpl]
impl ConstructionContract {
    pub fn init(env: Env, params: ConstructionInitParams) {
        if env.storage().instance().has(&PROJ) {
            panic_with_error(&env, CommonError::AlreadyInitialized);
        }
        if params.retention_bps as i128 > BPS_DENOM / 2 {
            panic_with_error_constr(&env, ConstructionError::InvalidRetention);
        }
        let count = params.milestone_amounts.len();
        if count == 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
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

        let proj = ConstructionProject {
            contractor: params.contractor.clone(),
            client: params.client.clone(),
            engineer: params.engineer.clone(),
            arbiter: params.arbiter,
            asset: params.asset.clone(),
            total_value: total,
            milestones_count: count,
            milestones_paid: 0,
            retention_bps: params.retention_bps,
            retention_locked: 0,
            warranty_secs: (params.warranty_days as u64) * SECONDS_PER_DAY,
            accepted_ts: 0,
            work_address_hash: params.work_address_hash,
            status: ProjectStatus::Funded,
        };

        // Cliente já trava o valor total na inicialização
        params.client.require_auth();
        token_transfer(
            &env,
            &params.asset,
            &params.client,
            &env.current_contract_address(),
            total,
        );

        env.storage().instance().set(&PROJ, &proj);

        for (i, amt) in params.milestone_amounts.iter().enumerate() {
            let m = Milestone {
                idx: i as u32,
                amount: amt,
                status: MilestoneStatus::Pending,
                submitted_ts: 0,
                laudo_hash: BytesN::from_array(&env, &[0u8; 32]),
                engineer_signed_ts: 0,
            };
            env.storage().persistent().set(&(MS, i as u32), &m);
        }

        env.events()
            .publish((symbol_short!("init"),), (params.contractor, total, count));
    }

    /// Construtora submete marco com laudo (ART/RRT hash).
    pub fn submit_milestone(env: Env, idx: u32, laudo_hash: BytesN<32>) {
        let mut p = load(&env);
        require_state(
            &env,
            p.status == ProjectStatus::Funded || p.status == ProjectStatus::InProgress,
        );
        p.contractor.require_auth();

        let mut m = load_milestone(&env, idx);
        if m.status != MilestoneStatus::Pending {
            panic_with_error(&env, CommonError::InvalidState);
        }

        m.status = MilestoneStatus::Submitted;
        m.submitted_ts = env.ledger().timestamp();
        m.laudo_hash = laudo_hash.clone();
        env.storage().persistent().set(&(MS, idx), &m);

        if p.status == ProjectStatus::Funded {
            p.status = ProjectStatus::InProgress;
            save(&env, &p);
        }

        env.events()
            .publish((symbol_short!("submit"), idx), laudo_hash);
    }

    /// Engenheiro independente atesta tecnicamente o marco.
    pub fn engineer_sign(env: Env, idx: u32) {
        let p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        p.engineer.require_auth();

        let mut m = load_milestone(&env, idx);
        if m.status != MilestoneStatus::Submitted {
            panic_with_error_constr(&env, ConstructionError::MilestoneNotSubmitted);
        }

        m.status = MilestoneStatus::EngineerApproved;
        m.engineer_signed_ts = env.ledger().timestamp();
        env.storage().persistent().set(&(MS, idx), &m);

        env.events()
            .publish((symbol_short!("engsign"), idx), p.engineer);
    }

    /// Cliente libera o pagamento do marco (já assinado pelo engenheiro).
    /// Retém `retention_bps` do valor.
    pub fn client_release(env: Env, idx: u32) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::InProgress);
        p.client.require_auth();

        let mut m = load_milestone(&env, idx);
        if m.status != MilestoneStatus::EngineerApproved {
            panic_with_error_constr(&env, ConstructionError::EngineerNotSigned);
        }

        let retain = m
            .amount
            .checked_mul(p.retention_bps as i128)
            .and_then(|x| x.checked_div(BPS_DENOM))
            .unwrap_or(0);
        let pay = m.amount - retain;

        token_transfer(
            &env,
            &p.asset,
            &env.current_contract_address(),
            &p.contractor,
            pay,
        );

        m.status = MilestoneStatus::Paid;
        env.storage().persistent().set(&(MS, idx), &m);

        p.milestones_paid += 1;
        p.retention_locked = p
            .retention_locked
            .checked_add(retain)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));

        if p.milestones_paid == p.milestones_count {
            p.status = ProjectStatus::AwaitingAcceptance;
        }

        save(&env, &p);

        env.events()
            .publish((symbol_short!("release"), idx), (pay, retain));
    }

    /// Cliente aceita a obra → inicia warranty (90 dias por default).
    pub fn accept_work(env: Env) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::AwaitingAcceptance);
        p.client.require_auth();

        p.accepted_ts = env.ledger().timestamp();
        p.status = ProjectStatus::Warranty;
        save(&env, &p);

        env.events()
            .publish((symbol_short!("accept"),), p.accepted_ts);
    }

    /// Após warranty_secs sem reclamação, libera a retenção para construtora.
    /// Chamável por qualquer um (cron).
    pub fn release_retention(env: Env) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::Warranty);

        let now = env.ledger().timestamp();
        if now < p.accepted_ts + p.warranty_secs {
            panic_with_error_constr(&env, ConstructionError::WarrantyNotPassed);
        }

        if p.retention_locked > 0 {
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.contractor,
                p.retention_locked,
            );
        }
        let released = p.retention_locked;
        p.retention_locked = 0;
        p.status = ProjectStatus::Closed;
        save(&env, &p);

        env.events().publish((symbol_short!("retrel"),), released);
    }

    /// Cliente reclama vício oculto dentro da warranty.
    /// Trava a retenção até arbitragem.
    ///
    /// Exige que o projeto tenha árbitro: sem ele, o estado `WarrantyClaim`
    /// não teria saída via `arbitrate_warranty` e a retenção ficaria travada
    /// para sempre (restaria apenas o acordo mútuo de `settle_warranty`).
    pub fn claim_warranty(env: Env, defect_hash: BytesN<32>) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::Warranty);
        p.client.require_auth();

        if p.arbiter.is_none() {
            panic_with_error_constr(&env, ConstructionError::NoArbiter);
        }

        let now = env.ledger().timestamp();
        if now >= p.accepted_ts + p.warranty_secs {
            panic_with_error_constr(&env, ConstructionError::WarrantyNotPassed);
        }

        p.status = ProjectStatus::WarrantyClaim;
        save(&env, &p);

        env.events()
            .publish((symbol_short!("claim"),), defect_hash);
    }

    /// Acordo mútuo sobre a reclamação de garantia: cliente e construtora
    /// assinam juntos o split da retenção, sem depender do árbitro.
    pub fn settle_warranty(env: Env, client_share: i128) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::WarrantyClaim);
        p.client.require_auth();
        p.contractor.require_auth();

        if client_share < 0 || client_share > p.retention_locked {
            panic_with_error(&env, CommonError::InvalidAmount);
        }
        let contractor_share = p.retention_locked - client_share;

        if client_share > 0 {
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.client,
                client_share,
            );
        }
        if contractor_share > 0 {
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.contractor,
                contractor_share,
            );
        }

        p.retention_locked = 0;
        p.status = ProjectStatus::Closed;
        save(&env, &p);

        env.events().publish(
            (symbol_short!("settle"),),
            (client_share, contractor_share),
        );
    }

    /// Árbitro (CREA/CAU) decide o split da retenção.
    /// `client_share` é a fatia que volta para o cliente.
    pub fn arbitrate_warranty(env: Env, client_share: i128, ruling_hash: BytesN<32>) {
        let mut p = load(&env);
        require_state(&env, p.status == ProjectStatus::WarrantyClaim);

        let arbiter = match &p.arbiter {
            Some(a) => a.clone(),
            None => panic_with_error(&env, CommonError::Unauthorized),
        };
        arbiter.require_auth();

        if client_share < 0 || client_share > p.retention_locked {
            panic_with_error(&env, CommonError::InvalidAmount);
        }
        let contractor_share = p.retention_locked - client_share;

        if client_share > 0 {
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.client,
                client_share,
            );
        }
        if contractor_share > 0 {
            token_transfer(
                &env,
                &p.asset,
                &env.current_contract_address(),
                &p.contractor,
                contractor_share,
            );
        }

        p.retention_locked = 0;
        p.status = ProjectStatus::Closed;
        save(&env, &p);

        env.events().publish(
            (symbol_short!("ruling"),),
            (client_share, contractor_share, ruling_hash),
        );
    }

    // ─── READ-ONLY ───────────────────────────────────────────────────

    pub fn get_status(env: Env) -> ProjectStatus {
        load(&env).status
    }

    pub fn get_project(env: Env) -> ConstructionProject {
        load(&env)
    }

    pub fn get_milestone(env: Env, idx: u32) -> Option<Milestone> {
        env.storage().persistent().get(&(MS, idx))
    }

    pub fn escrow_balance(env: Env) -> i128 {
        let p = load(&env);
        token_balance(&env, &p.asset, &env.current_contract_address())
    }

    pub fn warranty_ends_at(env: Env) -> u64 {
        let p = load(&env);
        if p.accepted_ts == 0 {
            return 0;
        }
        add_days(
            &env,
            p.accepted_ts,
            p.warranty_secs / SECONDS_PER_DAY,
        )
    }
}

fn load(env: &Env) -> ConstructionProject {
    env.storage()
        .instance()
        .get(&PROJ)
        .unwrap_or_else(|| panic_with_error(env, CommonError::NotInitialized))
}

fn save(env: &Env, p: &ConstructionProject) {
    env.storage().instance().set(&PROJ, p);
}

fn load_milestone(env: &Env, idx: u32) -> Milestone {
    env.storage()
        .persistent()
        .get(&(MS, idx))
        .unwrap_or_else(|| panic_with_error(env, CommonError::IndexOutOfRange))
}

fn panic_with_error_constr(env: &Env, err: ConstructionError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

#[cfg(test)]
mod test;
