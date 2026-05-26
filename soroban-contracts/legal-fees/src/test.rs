#![cfg(test)]

use super::{LegalFees, LegalFeesClient, LegalInitParams, LegalState};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env,
};

const STROOP: i128 = 10_000_000;

struct Fixture<'a> {
    env: Env,
    contract: LegalFeesClient<'a>,
    asset_token: TokenClient<'a>,
    lawyer: Address,
    client: Address,
}

fn setup<'a>(retainer: i128, monthly: i128, success_bps: u32) -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);
    let asset_token = TokenClient::new(&env, &asset);

    let lawyer = Address::generate(&env);
    let client = Address::generate(&env);

    // Cliente tem saldo suficiente para retainer + 12 meses + êxito de 100k
    asset_admin_client.mint(&client, &(retainer + monthly * 12 + 100_000 * STROOP));

    let contract_id = env.register_contract(None, LegalFees);
    let contract = LegalFeesClient::new(&env, &contract_id);

    let params = LegalInitParams {
        lawyer: lawyer.clone(),
        client: client.clone(),
        asset,
        retainer,
        monthly_fee: monthly,
        duration_months: 12,
        success_rate_bps: success_bps,
        termination_fee_bps: 1_000, // 10%
        case_id_hash: BytesN::from_array(&env, &[1u8; 32]),
    };
    contract.init(&params);

    Fixture {
        env,
        contract,
        asset_token,
        lawyer,
        client,
    }
}

fn advance_days(env: &Env, days: u64) {
    let info = env.ledger().get();
    env.ledger().set(LedgerInfo {
        timestamp: info.timestamp + days * 86_400,
        ..info
    });
}

#[test]
fn happy_path_with_success() {
    let retainer = 5_000 * STROOP;
    let monthly = 1_500 * STROOP;
    let fx = setup(retainer, monthly, 2000); // 20% êxito

    fx.contract.pay_retainer();
    assert_eq!(fx.contract.get_state(), LegalState::Active);
    assert_eq!(fx.asset_token.balance(&fx.lawyer), retainer);

    // 6 meses de mensalidade
    for _ in 0..6 {
        advance_days(&fx.env, 30);
        fx.contract.pay_monthly();
    }
    assert_eq!(
        fx.asset_token.balance(&fx.lawyer),
        retainer + monthly * 6
    );

    // Advogado propõe êxito de R$ 50.000
    let recovered = 50_000 * STROOP;
    fx.contract.propose_success(&fx.lawyer, &recovered);

    // Cliente confirma → 20% libera ao advogado
    let lawyer_before = fx.asset_token.balance(&fx.lawyer);
    fx.contract.confirm_success(&fx.client);

    let success_fee = recovered * 2000 / 10_000;
    assert_eq!(
        fx.asset_token.balance(&fx.lawyer) - lawyer_before,
        success_fee
    );
    assert_eq!(fx.contract.get_state(), LegalState::Success);
}

#[test]
fn pay_monthly_before_due_fails() {
    let fx = setup(1_000 * STROOP, 500 * STROOP, 2000);
    fx.contract.pay_retainer();

    // Tenta cobrar antes de 30 dias
    let result = fx.contract.try_pay_monthly();
    assert!(result.is_err());
}

#[test]
fn close_no_success_requires_both_sides() {
    let fx = setup(1_000 * STROOP, 500 * STROOP, 2000);
    fx.contract.pay_retainer();

    advance_days(&fx.env, 30);
    fx.contract.pay_monthly();

    fx.contract.close_no_success();
    assert_eq!(fx.contract.get_state(), LegalState::ClosedNoSuccess);
}

#[test]
fn terminate_early_charges_penalty() {
    let monthly = 1_000 * STROOP;
    let fx = setup(2_000 * STROOP, monthly, 2000);
    fx.contract.pay_retainer();

    advance_days(&fx.env, 30);
    fx.contract.pay_monthly();
    // 11 meses restantes × 1000 × 10% = 1100 de multa

    let lawyer_before = fx.asset_token.balance(&fx.lawyer);
    fx.contract.terminate_early(&fx.client);

    let expected_penalty = monthly * 11 * 1_000 / 10_000;
    assert_eq!(
        fx.asset_token.balance(&fx.lawyer) - lawyer_before,
        expected_penalty
    );
    assert_eq!(fx.contract.get_state(), LegalState::Terminated);
}

#[test]
fn same_party_cannot_propose_and_confirm_success() {
    let fx = setup(1_000 * STROOP, 500 * STROOP, 2000);
    fx.contract.pay_retainer();

    fx.contract.propose_success(&fx.lawyer, &(10_000 * STROOP));

    let result = fx.contract.try_confirm_success(&fx.lawyer);
    assert!(result.is_err());
}

#[test]
fn double_success_proposal_fails() {
    let fx = setup(1_000 * STROOP, 500 * STROOP, 2000);
    fx.contract.pay_retainer();

    fx.contract.propose_success(&fx.lawyer, &(10_000 * STROOP));
    let result = fx.contract.try_propose_success(&fx.client, &(20_000 * STROOP));
    assert!(result.is_err());
}
