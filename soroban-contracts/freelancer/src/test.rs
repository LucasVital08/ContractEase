#![cfg(test)]

use super::{
    FreelInitParams, FreelancerContract, FreelancerContractClient, ProjectStatus,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env,
};

const STROOP: i128 = 10_000_000;

struct Fixture<'a> {
    env: Env,
    contract: FreelancerContractClient<'a>,
    asset_token: TokenClient<'a>,
    asset: Address,
    client: Address,
    freelancer: Address,
}

fn setup<'a>(milestones: &[i128]) -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);
    let asset_token = TokenClient::new(&env, &asset);

    let client = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let total: i128 = milestones.iter().sum();
    asset_admin_client.mint(&client, &(total * 3));

    let contract_id = env.register_contract(None, FreelancerContract);
    let contract = FreelancerContractClient::new(&env, &contract_id);

    let mut amounts = soroban_sdk::Vec::new(&env);
    for m in milestones {
        amounts.push_back(*m);
    }

    let params = FreelInitParams {
        client: client.clone(),
        freelancer: freelancer.clone(),
        asset: asset.clone(),
        milestone_amounts: amounts,
        review_days: 5,
        stale_after_days: 30,
    };
    contract.init(&params);

    Fixture {
        env,
        contract,
        asset_token,
        asset,
        client,
        freelancer,
    }
}

fn advance_time(env: &Env, seconds: u64) {
    let info = env.ledger().get();
    env.ledger().set(LedgerInfo {
        timestamp: info.timestamp + seconds,
        ..info
    });
}

fn proof(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn happy_path_four_milestones() {
    let m = [3000 * STROOP, 4000 * STROOP, 5000 * STROOP, 3000 * STROOP];
    let total: i128 = m.iter().sum();
    let fx = setup(&m);

    assert_eq!(fx.contract.get_status(), ProjectStatus::Created);
    fx.contract.fund_project();
    assert_eq!(fx.contract.get_status(), ProjectStatus::InProgress);
    assert_eq!(fx.asset_token.balance(&fx.contract.address), total);

    for (i, _amt) in m.iter().enumerate() {
        fx.contract.submit_delivery(&(i as u32), &proof(&fx.env, i as u8));
        fx.contract.approve_delivery(&(i as u32));
    }

    assert_eq!(fx.contract.get_status(), ProjectStatus::Completed);
    assert_eq!(fx.asset_token.balance(&fx.freelancer), total);
}

#[test]
fn auto_approve_after_review_window() {
    let fx = setup(&[5000 * STROOP, 5000 * STROOP]);
    fx.contract.fund_project();

    fx.contract.submit_delivery(&0, &proof(&fx.env, 0));

    // antes do prazo: falha
    let early = fx.contract.try_auto_approve(&0);
    assert!(early.is_err());

    advance_time(&fx.env, 5 * 86_400 + 1);

    fx.contract.auto_approve(&0);
    assert_eq!(fx.asset_token.balance(&fx.freelancer), 5000 * STROOP);
}

#[test]
fn reject_then_resubmit() {
    let fx = setup(&[1000 * STROOP, 1000 * STROOP]);
    fx.contract.fund_project();

    fx.contract.submit_delivery(&0, &proof(&fx.env, 1));
    fx.contract.reject_delivery(&0, &proof(&fx.env, 9));

    let d = fx.contract.get_delivery(&0).unwrap();
    assert_eq!(d.status, super::DeliveryStatus::Rejected);

    fx.contract.submit_delivery(&0, &proof(&fx.env, 2));
    fx.contract.approve_delivery(&0);
    assert_eq!(fx.asset_token.balance(&fx.freelancer), 1000 * STROOP);
}

#[test]
fn withdraw_unspent_after_staleness() {
    let fx = setup(&[1000 * STROOP, 1000 * STROOP]);
    fx.contract.fund_project();

    // Avança 31 dias sem atividade
    advance_time(&fx.env, 31 * 86_400);

    let client_before = fx.asset_token.balance(&fx.client);
    fx.contract.withdraw_unspent();

    assert_eq!(fx.contract.get_status(), ProjectStatus::Cancelled);
    assert_eq!(
        fx.asset_token.balance(&fx.client) - client_before,
        2000 * STROOP
    );
}

#[test]
fn withdraw_unspent_too_early_fails() {
    let fx = setup(&[1000 * STROOP]);
    fx.contract.fund_project();

    let result = fx.contract.try_withdraw_unspent();
    assert!(result.is_err());
}

#[test]
fn cancel_mutual_returns_remaining() {
    let fx = setup(&[1000 * STROOP, 1000 * STROOP]);
    fx.contract.fund_project();

    fx.contract.submit_delivery(&0, &proof(&fx.env, 0));
    fx.contract.approve_delivery(&0);
    // freelancer já tem 1000

    fx.contract.cancel_mutual();
    assert_eq!(fx.contract.get_status(), ProjectStatus::Cancelled);
    // Cliente recupera 1000 (saldo restante)
}

#[test]
fn propose_and_accept_change_with_complement() {
    let fx = setup(&[1000 * STROOP, 1000 * STROOP]);
    fx.contract.fund_project();

    // Cliente propõe ampliar para 3000 com 3 entregas
    fx.contract.propose_change(&fx.client, &(3000 * STROOP), &3);

    // Freelancer aceita → cliente deve complementar 1000
    fx.contract.accept_change(&fx.freelancer);

    let p = fx.contract.get_project();
    assert_eq!(p.total, 3000 * STROOP);
    assert_eq!(p.delivery_count, 3);
    assert_eq!(fx.asset_token.balance(&fx.contract.address), 3000 * STROOP);
}

#[test]
fn propose_change_below_paid_out_fails() {
    let fx = setup(&[1000 * STROOP, 1000 * STROOP]);
    fx.contract.fund_project();
    fx.contract.submit_delivery(&0, &proof(&fx.env, 0));
    fx.contract.approve_delivery(&0);
    // paid_out = 1000

    // Propor reduzir total para 500 (abaixo do paid_out) → deve falhar no accept
    fx.contract.propose_change(&fx.client, &(500 * STROOP), &1);
    let result = fx.contract.try_accept_change(&fx.freelancer);
    assert!(result.is_err());
}

#[test]
fn double_init_fails() {
    let fx = setup(&[1000 * STROOP]);
    let mut amounts = soroban_sdk::Vec::new(&fx.env);
    amounts.push_back(1000 * STROOP);

    let params = FreelInitParams {
        client: fx.client.clone(),
        freelancer: fx.freelancer.clone(),
        asset: fx.asset.clone(),
        milestone_amounts: amounts,
        review_days: 5,
        stale_after_days: 30,
    };
    let result = fx.contract.try_init(&params);
    assert!(result.is_err());
}
