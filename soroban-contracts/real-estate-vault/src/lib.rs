//! # Real Estate Vault (Tokenização Imobiliária)
//!
//! Lógica de negócio do imóvel tokenizado. Trabalha em par com o token SEP-41
//! `real-estate-share` (que representa as cotas).
//!
//! Fluxo:
//!
//! 1. **Captação** — investidores compram cotas. Cada cota custa `share_price`
//!    e mintar tokens via `share_token.mint(buyer, qty)`.
//! 2. **Encerramento** — sponsor (após atingir meta ou prazo) chama
//!    `close_fundraising`. Trava o minting do `real-estate-share`.
//! 3. **Distribuição de aluguel** — sponsor publica `distribute_rent(merkle_root)`
//!    com um root das alocações por holder. Cada holder reclama com
//!    `claim_rent(period, amount, merkle_proof)`.
//!
//!    Razão do design: Soroban NÃO permite iterar storage. Mantemos o snapshot
//!    de holders off-chain (indexer) e publicamos apenas o Merkle root on-chain.
//!    Cada holder reclama provando que sua alocação está incluída.
//!
//! 4. **Venda do imóvel** — sponsor cria proposta (`propose_sale`), holders
//!    votam ponderado por cotas. Se aprovada, sponsor executa
//!    (`execute_sale(price)`) e holders resgatam com `claim_sale_proceeds`
//!    via Merkle (e queima das cotas).

#![no_std]

use contractease_common::{
    add_days, panic_with_error, require_state, token_balance, token_transfer, CommonError,
    SECONDS_PER_DAY,
};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, xdr::ToXdr, Address,
    Bytes, BytesN, Env, Symbol,
};

const VAULT: Symbol = symbol_short!("VAULT");
const RENT: Symbol = symbol_short!("RENT");
const CLAIMED: Symbol = symbol_short!("CLAIMED");
const SALE: Symbol = symbol_short!("SALE");
const VOTE: Symbol = symbol_short!("VOTE");

const BPS_DENOM: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    InvalidMerkleProof = 100,
    AlreadyClaimed = 101,
    FundraisingClosed = 102,
    InsufficientVotes = 103,
    AlreadyVoted = 104,
    SaleNotApproved = 105,
    NotShareholder = 106,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum VaultStatus {
    Fundraising,
    Operational,
    SaleProposed,
    SaleExecuted,
    Liquidated,
}

#[contracttype]
#[derive(Clone)]
pub struct Vault {
    pub sponsor: Address,
    pub share_token: Address,
    pub payout_asset: Address,
    pub total_shares: u32,
    pub shares_sold: u32,
    pub share_price: i128,
    pub min_shares_quorum_bps: u32,
    pub matricula_hash: BytesN<32>,
    pub fundraising_deadline_ts: u64,
    pub current_rent_period: u32,
    pub status: VaultStatus,
}

#[contracttype]
#[derive(Clone)]
pub struct RentPeriod {
    pub period: u32,
    pub total_amount: i128,
    pub claimed_amount: i128,
    pub merkle_root: BytesN<32>,
    pub published_ts: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct SaleProposal {
    pub min_price: i128,
    pub votes_yes_shares: u32,
    pub votes_no_shares: u32,
    pub final_price: i128,
    pub proceeds_merkle_root: BytesN<32>,
    pub deadline_ts: u64,
}

#[contracttype]
pub struct VaultInitParams {
    pub sponsor: Address,
    pub share_token: Address,
    pub payout_asset: Address,
    pub total_shares: u32,
    pub share_price: i128,
    pub min_shares_quorum_bps: u32, // p/ aprovar venda (ex: 5000 = 50% das cotas)
    pub matricula_hash: BytesN<32>,
    pub fundraising_days: u32,
}

#[contract]
pub struct RealEstateVault;

#[contractimpl]
impl RealEstateVault {
    pub fn init(env: Env, params: VaultInitParams) {
        if env.storage().instance().has(&VAULT) {
            panic_with_error(&env, CommonError::AlreadyInitialized);
        }
        if params.total_shares == 0 || params.share_price <= 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }
        if params.min_shares_quorum_bps as i128 > BPS_DENOM {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let v = Vault {
            sponsor: params.sponsor.clone(),
            share_token: params.share_token,
            payout_asset: params.payout_asset,
            total_shares: params.total_shares,
            shares_sold: 0,
            share_price: params.share_price,
            min_shares_quorum_bps: params.min_shares_quorum_bps,
            matricula_hash: params.matricula_hash,
            fundraising_deadline_ts: add_days(
                &env,
                env.ledger().timestamp(),
                params.fundraising_days as u64,
            ),
            current_rent_period: 0,
            status: VaultStatus::Fundraising,
        };
        env.storage().instance().set(&VAULT, &v);

        env.events()
            .publish((symbol_short!("init"),), (params.sponsor, params.total_shares));
    }

    /// Investidor compra `qty` cotas. Paga `qty * share_price` ao sponsor.
    /// Mint das cotas é feito pelo Vault (que é o minter do share_token).
    pub fn buy_shares(env: Env, buyer: Address, qty: u32) {
        let mut v = load_vault(&env);
        require_state(&env, v.status == VaultStatus::Fundraising);
        buyer.require_auth();

        if env.ledger().timestamp() > v.fundraising_deadline_ts {
            panic_with_error_vault(&env, VaultError::FundraisingClosed);
        }
        let new_sold = v
            .shares_sold
            .checked_add(qty)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));
        if new_sold > v.total_shares {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let cost = v
            .share_price
            .checked_mul(qty as i128)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));

        // Pagamento direto ao sponsor (captação)
        token_transfer(&env, &v.payout_asset, &buyer, &v.sponsor, cost);

        // Mint das cotas via cross-contract call
        env.invoke_contract::<()>(
            &v.share_token,
            &soroban_sdk::Symbol::new(&env, "mint"),
            (buyer.clone(), qty as i128).into_val(&env),
        );

        v.shares_sold = new_sold;
        if v.shares_sold == v.total_shares {
            v.status = VaultStatus::Operational;
            lock_share_minting(&env, &v.share_token);
        }
        save_vault(&env, &v);

        env.events()
            .publish((symbol_short!("buy"), buyer), (qty, cost));
    }

    /// Sponsor encerra captação (antes da meta ou após o prazo).
    /// Se shares_sold == 0, contrato fica `Liquidated` (não há cotistas).
    pub fn close_fundraising(env: Env) {
        let mut v = load_vault(&env);
        require_state(&env, v.status == VaultStatus::Fundraising);
        v.sponsor.require_auth();

        if v.shares_sold == 0 {
            v.status = VaultStatus::Liquidated;
        } else {
            v.status = VaultStatus::Operational;
            lock_share_minting(&env, &v.share_token);
        }
        save_vault(&env, &v);

        env.events()
            .publish((symbol_short!("closefr"),), v.shares_sold);
    }

    /// Sponsor distribui aluguel publicando o Merkle root da alocação.
    /// `total_amount` é depositado no Vault (vem da carteira do sponsor).
    /// Cada holder reclamará sua fatia com `claim_rent`.
    pub fn distribute_rent(env: Env, total_amount: i128, merkle_root: BytesN<32>) {
        let mut v = load_vault(&env);
        require_state(&env, v.status == VaultStatus::Operational);
        v.sponsor.require_auth();

        if total_amount <= 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        token_transfer(
            &env,
            &v.payout_asset,
            &v.sponsor,
            &env.current_contract_address(),
            total_amount,
        );

        v.current_rent_period += 1;
        let period = RentPeriod {
            period: v.current_rent_period,
            total_amount,
            claimed_amount: 0,
            merkle_root,
            published_ts: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&(RENT, v.current_rent_period), &period);
        save_vault(&env, &v);

        env.events()
            .publish((symbol_short!("rentpub"), v.current_rent_period), total_amount);
    }

    /// Holder reclama sua fatia do aluguel do período `period`.
    /// Verifica via Merkle que `(period, holder, amount)` está incluído no root.
    pub fn claim_rent(
        env: Env,
        holder: Address,
        period: u32,
        amount: i128,
        proof: soroban_sdk::Vec<BytesN<32>>,
    ) {
        let v = load_vault(&env);
        holder.require_auth();

        let mut rp: RentPeriod = env
            .storage()
            .persistent()
            .get(&(RENT, period))
            .unwrap_or_else(|| panic_with_error(&env, CommonError::IndexOutOfRange));

        let claim_key = (CLAIMED, period, holder.clone());
        if env.storage().persistent().has(&claim_key) {
            panic_with_error_vault(&env, VaultError::AlreadyClaimed);
        }

        let leaf = leaf_hash(&env, period, &holder, amount);
        if !verify_merkle(&env, &leaf, &rp.merkle_root, &proof) {
            panic_with_error_vault(&env, VaultError::InvalidMerkleProof);
        }

        token_transfer(
            &env,
            &v.payout_asset,
            &env.current_contract_address(),
            &holder,
            amount,
        );

        rp.claimed_amount = rp
            .claimed_amount
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));
        env.storage().persistent().set(&(RENT, period), &rp);
        env.storage().persistent().set(&claim_key, &true);

        env.events()
            .publish((symbol_short!("rentcl"), period, holder), amount);
    }

    /// Sponsor propõe venda do imóvel por `min_price`.
    /// Cotistas têm `voting_days` para votar.
    pub fn propose_sale(env: Env, min_price: i128, voting_days: u32) {
        let mut v = load_vault(&env);
        require_state(&env, v.status == VaultStatus::Operational);
        v.sponsor.require_auth();
        if min_price <= 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let proposal = SaleProposal {
            min_price,
            votes_yes_shares: 0,
            votes_no_shares: 0,
            final_price: 0,
            proceeds_merkle_root: BytesN::from_array(&env, &[0u8; 32]),
            deadline_ts: add_days(&env, env.ledger().timestamp(), voting_days as u64),
        };
        env.storage().instance().set(&SALE, &proposal);

        v.status = VaultStatus::SaleProposed;
        save_vault(&env, &v);

        env.events()
            .publish((symbol_short!("salepr"),), (min_price, voting_days));
    }

    /// Holder vota (peso = nº de cotas). Cada wallet vota uma vez.
    pub fn vote_sale(env: Env, voter: Address, approve: bool) {
        let v = load_vault(&env);
        require_state(&env, v.status == VaultStatus::SaleProposed);
        voter.require_auth();

        let mut prop: SaleProposal = env
            .storage()
            .instance()
            .get(&SALE)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::NotInitialized));

        if env.ledger().timestamp() > prop.deadline_ts {
            panic_with_error(&env, CommonError::DeadlineExpired);
        }

        let vote_key = (VOTE, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            panic_with_error_vault(&env, VaultError::AlreadyVoted);
        }

        // Peso = balance no share_token
        let balance: i128 = env.invoke_contract(
            &v.share_token,
            &soroban_sdk::Symbol::new(&env, "balance"),
            (voter.clone(),).into_val(&env),
        );
        if balance <= 0 {
            panic_with_error_vault(&env, VaultError::NotShareholder);
        }

        if approve {
            prop.votes_yes_shares = prop
                .votes_yes_shares
                .checked_add(balance as u32)
                .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));
        } else {
            prop.votes_no_shares = prop
                .votes_no_shares
                .checked_add(balance as u32)
                .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));
        }
        env.storage().instance().set(&SALE, &prop);
        env.storage().persistent().set(&vote_key, &approve);

        env.events()
            .publish((symbol_short!("vote"), voter), (approve, balance));
    }

    /// Sponsor executa a venda. Valida quorum mínimo + maioria.
    /// `proceeds_merkle_root` é a alocação do `sale_price` por holder.
    pub fn execute_sale(
        env: Env,
        sale_price: i128,
        proceeds_merkle_root: BytesN<32>,
    ) {
        let mut v = load_vault(&env);
        require_state(&env, v.status == VaultStatus::SaleProposed);
        v.sponsor.require_auth();

        let mut prop: SaleProposal = env
            .storage()
            .instance()
            .get(&SALE)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::NotInitialized));

        if sale_price < prop.min_price {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        // Quorum: cotas-yes >= total_shares * quorum_bps / 10000
        let quorum_required = (v.total_shares as i128) * (v.min_shares_quorum_bps as i128)
            / BPS_DENOM;
        if (prop.votes_yes_shares as i128) < quorum_required {
            panic_with_error_vault(&env, VaultError::InsufficientVotes);
        }
        if prop.votes_yes_shares <= prop.votes_no_shares {
            panic_with_error_vault(&env, VaultError::SaleNotApproved);
        }

        token_transfer(
            &env,
            &v.payout_asset,
            &v.sponsor,
            &env.current_contract_address(),
            sale_price,
        );

        prop.final_price = sale_price;
        prop.proceeds_merkle_root = proceeds_merkle_root;
        env.storage().instance().set(&SALE, &prop);

        v.status = VaultStatus::SaleExecuted;
        save_vault(&env, &v);

        env.events()
            .publish((symbol_short!("saleex"),), sale_price);
    }

    /// Holder resgata sua fração da venda. Queima as cotas no processo.
    pub fn claim_sale_proceeds(
        env: Env,
        holder: Address,
        amount: i128,
        shares_to_burn: u32,
        proof: soroban_sdk::Vec<BytesN<32>>,
    ) {
        let v = load_vault(&env);
        require_state(&env, v.status == VaultStatus::SaleExecuted);
        holder.require_auth();

        let prop: SaleProposal = env
            .storage()
            .instance()
            .get(&SALE)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::NotInitialized));

        let claim_key = (CLAIMED, 0u32, holder.clone()); // period 0 = venda
        if env.storage().persistent().has(&claim_key) {
            panic_with_error_vault(&env, VaultError::AlreadyClaimed);
        }

        let leaf = leaf_hash_sale(&env, &holder, amount, shares_to_burn);
        if !verify_merkle(&env, &leaf, &prop.proceeds_merkle_root, &proof) {
            panic_with_error_vault(&env, VaultError::InvalidMerkleProof);
        }

        // Queima as cotas (Vault é o minter autorizado)
        env.invoke_contract::<()>(
            &v.share_token,
            &soroban_sdk::Symbol::new(&env, "burn_by_minter"),
            (holder.clone(), shares_to_burn as i128).into_val(&env),
        );

        // Paga em payout_asset
        token_transfer(
            &env,
            &v.payout_asset,
            &env.current_contract_address(),
            &holder,
            amount,
        );

        env.storage().persistent().set(&claim_key, &true);

        env.events()
            .publish((symbol_short!("salecl"), holder), (amount, shares_to_burn));
    }

    // ─── READ-ONLY ───────────────────────────────────────────────────

    pub fn get_vault(env: Env) -> Vault {
        load_vault(&env)
    }

    pub fn get_status(env: Env) -> VaultStatus {
        load_vault(&env).status
    }

    pub fn get_rent_period(env: Env, period: u32) -> Option<RentPeriod> {
        env.storage().persistent().get(&(RENT, period))
    }

    pub fn get_sale_proposal(env: Env) -> Option<SaleProposal> {
        env.storage().instance().get(&SALE)
    }

    pub fn vault_balance(env: Env) -> i128 {
        let v = load_vault(&env);
        token_balance(&env, &v.payout_asset, &env.current_contract_address())
    }

    pub fn has_claimed_rent(env: Env, period: u32, holder: Address) -> bool {
        env.storage().persistent().has(&(CLAIMED, period, holder))
    }
}

// ─── HELPERS PRIVADOS ────────────────────────────────────────────────

use soroban_sdk::IntoVal;

fn load_vault(env: &Env) -> Vault {
    env.storage()
        .instance()
        .get(&VAULT)
        .unwrap_or_else(|| panic_with_error(env, CommonError::NotInitialized))
}

fn save_vault(env: &Env, v: &Vault) {
    env.storage().instance().set(&VAULT, v);
}

fn lock_share_minting(env: &Env, share_token: &Address) {
    env.invoke_contract::<()>(
        share_token,
        &soroban_sdk::Symbol::new(env, "lock_minting"),
        ().into_val(env),
    );
}

/// Hash da folha: keccak(period || holder || amount)
fn leaf_hash(env: &Env, period: u32, holder: &Address, amount: i128) -> BytesN<32> {
    let mut buf = Bytes::new(env);
    buf.append(&period.to_xdr(env));
    buf.append(&holder.to_xdr(env));
    buf.append(&amount.to_xdr(env));
    env.crypto().keccak256(&buf).into()
}

/// Hash da folha de venda: keccak(holder || amount || shares_to_burn)
fn leaf_hash_sale(env: &Env, holder: &Address, amount: i128, shares: u32) -> BytesN<32> {
    let mut buf = Bytes::new(env);
    buf.append(&holder.to_xdr(env));
    buf.append(&amount.to_xdr(env));
    buf.append(&shares.to_xdr(env));
    env.crypto().keccak256(&buf).into()
}

/// Verifica uma Merkle proof. Pares ordenados (menor || maior) para evitar
/// problemas de segunda-imagem.
fn verify_merkle(
    env: &Env,
    leaf: &BytesN<32>,
    root: &BytesN<32>,
    proof: &soroban_sdk::Vec<BytesN<32>>,
) -> bool {
    let mut computed = leaf.clone();
    for sibling in proof.iter() {
        let (a, b) = if bytes_lt(&computed, &sibling) {
            (computed.clone(), sibling)
        } else {
            (sibling, computed.clone())
        };
        let mut buf = Bytes::new(env);
        buf.append(&Bytes::from_array(env, &a.to_array()));
        buf.append(&Bytes::from_array(env, &b.to_array()));
        computed = env.crypto().keccak256(&buf).into();
    }
    computed == *root
}

fn bytes_lt(a: &BytesN<32>, b: &BytesN<32>) -> bool {
    let aa = a.to_array();
    let bb = b.to_array();
    for i in 0..32 {
        if aa[i] < bb[i] {
            return true;
        }
        if aa[i] > bb[i] {
            return false;
        }
    }
    false
}

fn panic_with_error_vault(env: &Env, err: VaultError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

#[cfg(test)]
mod test;
