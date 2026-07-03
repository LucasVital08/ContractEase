//! # Venda Online com Garantia (ecommerce)
//!
//! Escrow para vendas online com 3 modos de finalização:
//!
//! 1. **Confirmação manual** — comprador confirma recebimento → libera ao vendedor.
//! 2. **Auto-release** — após N dias do envio sem disputa, qualquer um aciona.
//! 3. **Disputa com árbitro** — se houver `arbiter`, ele decide refund parcial/total
//!    em até `dispute_resolution_days`. Sem árbitro, a disputa força refund integral
//!    pelo vendedor ou expira (timeout) liberando ao vendedor.
//!
//! Suporta também:
//! - **Refund parcial** (produto chegou com defeito menor).
//! - **Extensão de prazo** (correios atrasados).
//! - Mensagens de log on-chain (hash de evidências off-chain).

#![no_std]

use contractease_common::{
    add_days, bump_instance, panic_with_error, require_state, token_balance, token_transfer,
    CommonError, SECONDS_PER_DAY,
};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    String, Symbol,
};

const DATA: Symbol = symbol_short!("DATA");

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EcomError {
    NoArbiter = 100,
    DisputeTimeoutNotReached = 101,
    InvalidRefund = 102,
    ProductNotShipped = 103,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SaleState {
    AwaitingPayment,
    Paid,
    Shipped,
    Delivered,
    Disputed,
    Refunded,
    PartiallyRefunded,
}

#[contracttype]
#[derive(Clone)]
pub struct OnlineSale {
    pub buyer: Address,
    pub seller: Address,
    pub arbiter: Option<Address>,
    pub asset: Address,
    pub amount: i128,
    pub paid_amount: i128,
    pub shipped_ts: u64,
    pub auto_release_secs: u64,
    pub dispute_opened_ts: u64,
    pub dispute_resolution_secs: u64,
    pub product_hash: BytesN<32>,
    pub state: SaleState,
}

#[contracttype]
pub struct EcomInitParams {
    pub buyer: Address,
    pub seller: Address,
    pub arbiter: Option<Address>,
    pub asset: Address,
    pub amount: i128,
    pub auto_release_days: u32,
    pub dispute_resolution_days: u32,
    /// Hash SHA-256 da descrição do produto (nome, foto, especificação).
    pub product_hash: BytesN<32>,
}

#[contract]
pub struct EcommerceEscrow;

#[contractimpl]
impl EcommerceEscrow {
    pub fn init(env: Env, params: EcomInitParams) {
        if env.storage().instance().has(&DATA) {
            panic_with_error(&env, CommonError::AlreadyInitialized);
        }
        if params.amount <= 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let sale = OnlineSale {
            buyer: params.buyer.clone(),
            seller: params.seller.clone(),
            arbiter: params.arbiter,
            asset: params.asset,
            amount: params.amount,
            paid_amount: 0,
            shipped_ts: 0,
            auto_release_secs: (params.auto_release_days as u64) * SECONDS_PER_DAY,
            dispute_opened_ts: 0,
            dispute_resolution_secs: (params.dispute_resolution_days as u64) * SECONDS_PER_DAY,
            product_hash: params.product_hash,
            state: SaleState::AwaitingPayment,
        };
        env.storage().instance().set(&DATA, &sale);

        env.events()
            .publish((symbol_short!("init"),), (params.buyer, params.seller));
    }

    /// Comprador deposita o valor no escrow.
    pub fn pay(env: Env) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::AwaitingPayment);
        s.buyer.require_auth();

        token_transfer(
            &env,
            &s.asset,
            &s.buyer,
            &env.current_contract_address(),
            s.amount,
        );

        s.paid_amount = s.amount;
        s.state = SaleState::Paid;
        save(&env, &s);

        env.events().publish((symbol_short!("paid"),), s.amount);
    }

    /// Vendedor registra envio. `tracking_hash` é hash do código + carrier.
    pub fn mark_shipped(env: Env, tracking_hash: BytesN<32>) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Paid);
        s.seller.require_auth();

        s.shipped_ts = env.ledger().timestamp();
        s.state = SaleState::Shipped;
        save(&env, &s);

        env.events()
            .publish((symbol_short!("shipped"),), tracking_hash);
    }

    /// Comprador confirma recebimento. Libera valor ao vendedor.
    pub fn confirm_delivery(env: Env) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Shipped);
        s.buyer.require_auth();

        token_transfer(
            &env,
            &s.asset,
            &env.current_contract_address(),
            &s.seller,
            s.paid_amount,
        );
        s.state = SaleState::Delivered;
        save(&env, &s);

        env.events()
            .publish((symbol_short!("delivered"),), s.paid_amount);
    }

    /// Auto-release após prazo expirar sem confirmação nem disputa.
    pub fn auto_release(env: Env) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Shipped);

        let now = env.ledger().timestamp();
        if now < s.shipped_ts + s.auto_release_secs {
            panic_with_error(&env, CommonError::DeadlineNotReached);
        }

        token_transfer(
            &env,
            &s.asset,
            &env.current_contract_address(),
            &s.seller,
            s.paid_amount,
        );
        s.state = SaleState::Delivered;
        save(&env, &s);

        env.events()
            .publish((symbol_short!("autorel"),), s.paid_amount);
    }

    /// Comprador abre disputa. Trava liberação até resolução manual ou árbitro.
    pub fn open_dispute(env: Env, reason_hash: BytesN<32>) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Shipped);
        s.buyer.require_auth();

        s.dispute_opened_ts = env.ledger().timestamp();
        s.state = SaleState::Disputed;
        save(&env, &s);

        env.events()
            .publish((symbol_short!("dispute"),), reason_hash);
    }

    /// Vendedor aceita reembolso integral.
    pub fn refund(env: Env) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Disputed);
        s.seller.require_auth();

        token_transfer(
            &env,
            &s.asset,
            &env.current_contract_address(),
            &s.buyer,
            s.paid_amount,
        );
        s.state = SaleState::Refunded;
        save(&env, &s);

        env.events()
            .publish((symbol_short!("refund"),), s.paid_amount);
    }

    /// Reembolso parcial (produto com defeito menor). Vendedor recebe o restante.
    pub fn partial_refund(env: Env, buyer_refund: i128) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Disputed);
        s.seller.require_auth();

        if buyer_refund <= 0 || buyer_refund >= s.paid_amount {
            panic_with_error_ecom(&env, EcomError::InvalidRefund);
        }

        let seller_amount = s.paid_amount - buyer_refund;

        token_transfer(
            &env,
            &s.asset,
            &env.current_contract_address(),
            &s.buyer,
            buyer_refund,
        );
        token_transfer(
            &env,
            &s.asset,
            &env.current_contract_address(),
            &s.seller,
            seller_amount,
        );
        s.state = SaleState::PartiallyRefunded;
        save(&env, &s);

        env.events()
            .publish((symbol_short!("partrf"),), (buyer_refund, seller_amount));
    }

    /// Árbitro decide a disputa. Pode definir qualquer split (0..paid_amount).
    pub fn arbitrate(env: Env, buyer_refund: i128, ruling_hash: BytesN<32>) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Disputed);

        let arbiter = match &s.arbiter {
            Some(a) => a.clone(),
            None => panic_with_error_ecom(&env, EcomError::NoArbiter),
        };
        arbiter.require_auth();

        if buyer_refund < 0 || buyer_refund > s.paid_amount {
            panic_with_error_ecom(&env, EcomError::InvalidRefund);
        }
        let seller_amount = s.paid_amount - buyer_refund;

        if buyer_refund > 0 {
            token_transfer(
                &env,
                &s.asset,
                &env.current_contract_address(),
                &s.buyer,
                buyer_refund,
            );
        }
        if seller_amount > 0 {
            token_transfer(
                &env,
                &s.asset,
                &env.current_contract_address(),
                &s.seller,
                seller_amount,
            );
        }

        s.state = if buyer_refund == s.paid_amount {
            SaleState::Refunded
        } else if seller_amount == s.paid_amount {
            SaleState::Delivered
        } else {
            SaleState::PartiallyRefunded
        };
        save(&env, &s);

        env.events().publish(
            (symbol_short!("ruling"),),
            (buyer_refund, seller_amount, ruling_hash),
        );
    }

    /// Após dispute_resolution_secs sem árbitro decidir, vendedor pode reivindicar.
    /// Mecanismo anti-trolling do comprador.
    pub fn claim_after_dispute_timeout(env: Env) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Disputed);
        s.seller.require_auth();

        let now = env.ledger().timestamp();
        if now < s.dispute_opened_ts + s.dispute_resolution_secs {
            panic_with_error_ecom(&env, EcomError::DisputeTimeoutNotReached);
        }

        token_transfer(
            &env,
            &s.asset,
            &env.current_contract_address(),
            &s.seller,
            s.paid_amount,
        );
        s.state = SaleState::Delivered;
        save(&env, &s);

        env.events()
            .publish((symbol_short!("dtimeout"),), s.paid_amount);
    }

    /// Comprador concede mais tempo ao vendedor (extensão do auto-release).
    pub fn extend_deadline(env: Env, extra_days: u32) {
        let mut s: OnlineSale = load(&env);
        require_state(&env, s.state == SaleState::Shipped);
        s.buyer.require_auth();

        let extra = (extra_days as u64) * SECONDS_PER_DAY;
        s.auto_release_secs = s
            .auto_release_secs
            .checked_add(extra)
            .unwrap_or_else(|| panic_with_error(&env, CommonError::Overflow));
        save(&env, &s);

        env.events()
            .publish((symbol_short!("extend"),), extra_days);
    }

    // ─── READ-ONLY ───────────────────────────────────────────────────

    pub fn get_state(env: Env) -> SaleState {
        load(&env).state
    }

    pub fn get_sale(env: Env) -> OnlineSale {
        load(&env)
    }

    pub fn escrow_balance(env: Env) -> i128 {
        let s = load(&env);
        token_balance(&env, &s.asset, &env.current_contract_address())
    }

    pub fn auto_release_at(env: Env) -> u64 {
        let s = load(&env);
        if s.shipped_ts == 0 {
            return 0;
        }
        add_days(&env, s.shipped_ts, s.auto_release_secs / SECONDS_PER_DAY)
    }
}

fn load(env: &Env) -> OnlineSale {
    bump_instance(env);
    env.storage()
        .instance()
        .get(&DATA)
        .unwrap_or_else(|| panic_with_error(env, CommonError::NotInitialized))
}

fn save(env: &Env, s: &OnlineSale) {
    env.storage().instance().set(&DATA, s);
}

fn panic_with_error_ecom(env: &Env, err: EcomError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

#[cfg(test)]
mod test;
