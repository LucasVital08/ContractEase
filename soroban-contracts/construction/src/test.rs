#![cfg(test)]

use super::{
    ConstructionContract, ConstructionContractClient, ConstructionInitParams, ProjectStatus,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env,
};

const STROOP: i128 = 10_000_000;

struct Fixture<'a> {
    env: Env,
    contract: ConstructionContractClient<'a>,
    asset_token: TokenClient<'a>,
    contractor: Address,
    client: Address,
    engineer: Address,
    arbiter: Address,
}

fn setup<'a>(milestones: &[i128], retention_bps: u32, with_arbiter: bool) -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);
    let asset_token = TokenClient::new(&env, &asset);

    let contractor = Address::generate(&env);
    let client = Address::generate(&env);
    let engineer = Address::generate(&env);
    let arbiter = Address::generate(&env);

    let total: i128 = milestones.iter().sum();
    asset_admin_client.mint(&client, &(total * 2));

    let contract_id = env.register_contract(None, ConstructionContract);
    let contract = ConstructionContractClient::new(&env, &contract_id);

    let mut amounts = soroban_sdk::Vec::new(&env);
    for m in milestones {
        amounts.push_back(*m);
    }

    let params = ConstructionInitParams {
        contractor: contractor.clone(),
        client: client.clone(),
        engineer: engineer.clone(),
        arbiter: if with_arbiter { Some(arbiter.clone()) } else { None },
        asset,
        milestone_amounts: amounts,
        retention_bps,
        warranty_days: 90,
        work_address_hash: BytesN::from_array(&env, &[1u8; 32]),
    };
    contract.init(&params);

    Fixture {
        env,
        contract,
        asset_token,
        contractor,
        client,
        engineer,
        arbiter,
    }
}

fn advance_days(env: &Env, days: u64) {
    let info = env.ledger().get();
    env.ledger().set(LedgerInfo {
        timestamp: info.timestamp + days * 86_400,
        ..info
    });
}

fn h(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn happy_path_5_milestones_with_retention() {
    let milestones = [
        50_000 * STROOP,
        80_000 * STROOP,
        60_000 * STROOP,
        40_000 * STROOP,
        70_000 * STROOP,
    ];
    let total: i128 = milestones.iter().sum();
    let retention_bps = 500u32; // 5%
    let fx = setup(&milestones, retention_bps, false);

    assert_eq!(fx.contract.get_status(), ProjectStatus::Funded);
    assert_eq!(fx.asset_token.balance(&fx.contract.address), total);

    let mut expected_paid: i128 = 0;
    let mut expected_retained: i128 = 0;

    for (i, amt) in milestones.iter().enumerate() {
        fx.contract.submit_milestone(&(i as u32), &h(&fx.env, i as u8));
        fx.contract.engineer_sign(&(i as u32));
        fx.contract.client_release(&(i as u32));

        let retain = amt * retention_bps as i128 / 10_000;
        let pay = amt - retain;
        expected_paid += pay;
        expected_retained += retain;
    }

    assert_eq!(fx.contract.get_status(), ProjectStatus::AwaitingAcceptance);
    assert_eq!(fx.asset_token.balance(&fx.contractor), expected_paid);

    fx.contract.accept_work();
    assert_eq!(fx.contract.get_status(), ProjectStatus::Warranty);

    // Avança 90 dias e libera retenção
    advance_days(&fx.env, 91);
    fx.contract.release_retention();

    assert_eq!(fx.contract.get_status(), ProjectStatus::Closed);
    assert_eq!(
        fx.asset_token.balance(&fx.contractor),
        expected_paid + expected_retained
    );
}

#[test]
fn cannot_release_without_engineer_sign() {
    let fx = setup(&[10_000 * STROOP], 500, false);

    fx.contract.submit_milestone(&0, &h(&fx.env, 1));
    let result = fx.contract.try_client_release(&0);
    assert!(result.is_err());
}

#[test]
fn warranty_claim_with_arbitration() {
    let total = 100_000 * STROOP;
    let retention_bps = 1000u32; // 10%
    let fx = setup(&[total], retention_bps, true);

    fx.contract.submit_milestone(&0, &h(&fx.env, 0));
    fx.contract.engineer_sign(&0);
    fx.contract.client_release(&0);

    fx.contract.accept_work();
    assert_eq!(fx.contract.get_status(), ProjectStatus::Warranty);

    // Cliente reclama vício oculto
    fx.contract.claim_warranty(&h(&fx.env, 7));
    assert_eq!(fx.contract.get_status(), ProjectStatus::WarrantyClaim);

    // Árbitro decide: 60% volta ao cliente, 40% para construtora
    let retention = total * retention_bps as i128 / 10_000;
    let client_share = retention * 6 / 10;
    let contractor_share = retention - client_share;

    let client_before = fx.asset_token.balance(&fx.client);
    let contractor_before = fx.asset_token.balance(&fx.contractor);

    fx.contract.arbitrate_warranty(&client_share, &h(&fx.env, 9));

    assert_eq!(
        fx.asset_token.balance(&fx.client) - client_before,
        client_share
    );
    assert_eq!(
        fx.asset_token.balance(&fx.contractor) - contractor_before,
        contractor_share
    );
    assert_eq!(fx.contract.get_status(), ProjectStatus::Closed);
}

#[test]
fn release_retention_before_warranty_fails() {
    let fx = setup(&[10_000 * STROOP], 500, false);
    fx.contract.submit_milestone(&0, &h(&fx.env, 0));
    fx.contract.engineer_sign(&0);
    fx.contract.client_release(&0);
    fx.contract.accept_work();

    let early = fx.contract.try_release_retention();
    assert!(early.is_err());
}

#[test]
fn invalid_retention_above_50pct_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let client = Address::generate(&env);

    let contract_id = env.register_contract(None, ConstructionContract);
    let contract = ConstructionContractClient::new(&env, &contract_id);

    let mut amounts = soroban_sdk::Vec::new(&env);
    amounts.push_back(10_000 * STROOP);

    let params = ConstructionInitParams {
        contractor: Address::generate(&env),
        client,
        engineer: Address::generate(&env),
        arbiter: None,
        asset,
        milestone_amounts: amounts,
        retention_bps: 6_000, // 60% — inválido
        warranty_days: 90,
        work_address_hash: BytesN::from_array(&env, &[0u8; 32]),
    };
    let result = contract.try_init(&params);
    assert!(result.is_err());
}
