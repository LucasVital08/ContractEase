#![cfg(test)]

use super::{EcomInitParams, EcommerceEscrow, EcommerceEscrowClient, SaleState};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env,
};

const STROOP: i128 = 10_000_000;

struct Fixture<'a> {
    env: Env,
    contract: EcommerceEscrowClient<'a>,
    asset_token: TokenClient<'a>,
    buyer: Address,
    seller: Address,
    arbiter: Address,
}

fn setup<'a>(amount: i128, with_arbiter: bool) -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);
    let asset_token = TokenClient::new(&env, &asset);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let arbiter = Address::generate(&env);

    asset_admin_client.mint(&buyer, &(amount * 2));

    let contract_id = env.register_contract(None, EcommerceEscrow);
    let contract = EcommerceEscrowClient::new(&env, &contract_id);

    let params = EcomInitParams {
        buyer: buyer.clone(),
        seller: seller.clone(),
        arbiter: if with_arbiter { Some(arbiter.clone()) } else { None },
        asset,
        amount,
        auto_release_days: 7,
        dispute_resolution_days: 15,
        product_hash: BytesN::from_array(&env, &[0u8; 32]),
    };
    contract.init(&params);

    Fixture {
        env,
        contract,
        asset_token,
        buyer,
        seller,
        arbiter,
    }
}

fn advance_time(env: &Env, seconds: u64) {
    let info = env.ledger().get();
    env.ledger().set(LedgerInfo {
        timestamp: info.timestamp + seconds,
        ..info
    });
}

#[test]
fn happy_path() {
    let amount = 1500 * STROOP;
    let fx = setup(amount, false);

    assert_eq!(fx.contract.get_state(), SaleState::AwaitingPayment);
    fx.contract.pay();
    assert_eq!(fx.contract.get_state(), SaleState::Paid);
    assert_eq!(fx.asset_token.balance(&fx.contract.address), amount);

    let tracking = BytesN::from_array(&fx.env, &[1u8; 32]);
    fx.contract.mark_shipped(&tracking);
    assert_eq!(fx.contract.get_state(), SaleState::Shipped);

    let seller_before = fx.asset_token.balance(&fx.seller);
    fx.contract.confirm_delivery();
    assert_eq!(fx.contract.get_state(), SaleState::Delivered);
    assert_eq!(
        fx.asset_token.balance(&fx.seller) - seller_before,
        amount
    );
}

#[test]
fn auto_release_after_7_days() {
    let amount = 1000 * STROOP;
    let fx = setup(amount, false);
    fx.contract.pay();
    fx.contract.mark_shipped(&BytesN::from_array(&fx.env, &[0u8; 32]));

    // Antes do prazo: deve falhar
    let early = fx.contract.try_auto_release();
    assert!(early.is_err());

    advance_time(&fx.env, 7 * 86_400 + 1);

    let seller_before = fx.asset_token.balance(&fx.seller);
    fx.contract.auto_release();
    assert_eq!(fx.contract.get_state(), SaleState::Delivered);
    assert_eq!(
        fx.asset_token.balance(&fx.seller) - seller_before,
        amount
    );
}

#[test]
fn dispute_with_full_refund() {
    let amount = 1000 * STROOP;
    let fx = setup(amount, false);
    fx.contract.pay();
    fx.contract.mark_shipped(&BytesN::from_array(&fx.env, &[0u8; 32]));

    fx.contract.open_dispute(&BytesN::from_array(&fx.env, &[2u8; 32]));
    assert_eq!(fx.contract.get_state(), SaleState::Disputed);

    let buyer_before = fx.asset_token.balance(&fx.buyer);
    fx.contract.refund();
    assert_eq!(fx.contract.get_state(), SaleState::Refunded);
    assert_eq!(
        fx.asset_token.balance(&fx.buyer) - buyer_before,
        amount
    );
}

#[test]
fn dispute_with_partial_refund() {
    let amount = 1000 * STROOP;
    let fx = setup(amount, false);
    fx.contract.pay();
    fx.contract.mark_shipped(&BytesN::from_array(&fx.env, &[0u8; 32]));
    fx.contract.open_dispute(&BytesN::from_array(&fx.env, &[0u8; 32]));

    let buyer_before = fx.asset_token.balance(&fx.buyer);
    let seller_before = fx.asset_token.balance(&fx.seller);

    let refund = 300 * STROOP;
    fx.contract.partial_refund(&refund);

    assert_eq!(fx.contract.get_state(), SaleState::PartiallyRefunded);
    assert_eq!(
        fx.asset_token.balance(&fx.buyer) - buyer_before,
        refund
    );
    assert_eq!(
        fx.asset_token.balance(&fx.seller) - seller_before,
        amount - refund
    );
}

#[test]
fn arbiter_decides_split() {
    let amount = 1000 * STROOP;
    let fx = setup(amount, true);
    fx.contract.pay();
    fx.contract.mark_shipped(&BytesN::from_array(&fx.env, &[0u8; 32]));
    fx.contract.open_dispute(&BytesN::from_array(&fx.env, &[0u8; 32]));

    let ruling = BytesN::from_array(&fx.env, &[7u8; 32]);
    // Árbitro decide 60% comprador, 40% vendedor
    let buyer_share = 600 * STROOP;
    fx.contract.arbitrate(&buyer_share, &ruling);

    assert_eq!(fx.contract.get_state(), SaleState::PartiallyRefunded);
}

#[test]
fn dispute_timeout_lets_seller_claim() {
    let amount = 1000 * STROOP;
    let fx = setup(amount, true);
    fx.contract.pay();
    fx.contract.mark_shipped(&BytesN::from_array(&fx.env, &[0u8; 32]));
    fx.contract.open_dispute(&BytesN::from_array(&fx.env, &[0u8; 32]));

    // Antes do timeout: falha
    let early = fx.contract.try_claim_after_dispute_timeout();
    assert!(early.is_err());

    advance_time(&fx.env, 15 * 86_400 + 1);

    let seller_before = fx.asset_token.balance(&fx.seller);
    fx.contract.claim_after_dispute_timeout();
    assert_eq!(fx.contract.get_state(), SaleState::Delivered);
    assert_eq!(
        fx.asset_token.balance(&fx.seller) - seller_before,
        amount
    );
}

#[test]
fn extend_deadline_postpones_auto_release() {
    let amount = 1000 * STROOP;
    let fx = setup(amount, false);
    fx.contract.pay();
    fx.contract.mark_shipped(&BytesN::from_array(&fx.env, &[0u8; 32]));

    // Comprador concede +5 dias
    fx.contract.extend_deadline(&5);

    // Após 7 dias originais: ainda não pode liberar
    advance_time(&fx.env, 7 * 86_400 + 1);
    let early = fx.contract.try_auto_release();
    assert!(early.is_err());

    // Após +5 dias: já pode
    advance_time(&fx.env, 5 * 86_400);
    fx.contract.auto_release();
    assert_eq!(fx.contract.get_state(), SaleState::Delivered);
}

#[test]
fn no_arbiter_arbitrate_fails() {
    let amount = 1000 * STROOP;
    let fx = setup(amount, false);
    fx.contract.pay();
    fx.contract.mark_shipped(&BytesN::from_array(&fx.env, &[0u8; 32]));
    fx.contract.open_dispute(&BytesN::from_array(&fx.env, &[0u8; 32]));

    let ruling = BytesN::from_array(&fx.env, &[0u8; 32]);
    let result = fx.contract.try_arbitrate(&(500 * STROOP), &ruling);
    assert!(result.is_err());
}
