#![cfg(test)]

//! Testes do Vault Imobiliário.
//!
//! Como o Vault depende do `real-estate-share` (token SEP-41), os testes
//! integram os dois contratos. Helpers de Merkle são duplicados aqui
//! (em produção, o frontend computa a árvore e envia proofs).

use super::{RealEstateVault, RealEstateVaultClient, VaultInitParams, VaultStatus};
use soroban_sdk::{
    testutils::Address as _,
    token::StellarAssetClient,
    Address, Bytes, BytesN, Env, Vec,
};

const STROOP: i128 = 10_000_000;

/// Computa hash da folha (period, holder, amount) — prefixo 0x00 (folha).
fn compute_leaf(env: &Env, period: u32, holder: &Address, amount: i128) -> BytesN<32> {
    use soroban_sdk::xdr::ToXdr;
    let mut buf = Bytes::new(env);
    buf.append(&Bytes::from_array(env, &[0x00u8]));
    buf.append(&period.to_xdr(env));
    buf.append(&holder.to_xdr(env));
    buf.append(&amount.to_xdr(env));
    env.crypto().keccak256(&buf).into()
}

/// Combina dois nós para subir na árvore — prefixo 0x01 (nó interno).
fn combine(env: &Env, a: BytesN<32>, b: BytesN<32>) -> BytesN<32> {
    let aa = a.to_array();
    let bb = b.to_array();
    let (lo, hi) = if aa <= bb { (a, b) } else { (b, a) };
    let mut buf = Bytes::new(env);
    buf.append(&Bytes::from_array(env, &[0x01u8]));
    buf.append(&Bytes::from_array(env, &lo.to_array()));
    buf.append(&Bytes::from_array(env, &hi.to_array()));
    env.crypto().keccak256(&buf).into()
}

/// Computa root + proofs para um array de folhas (poder de 2 simplifica).
fn build_tree(env: &Env, leaves: &[BytesN<32>]) -> (BytesN<32>, alloc::vec::Vec<alloc::vec::Vec<BytesN<32>>>) {
    use alloc::vec::Vec as StdVec;
    let mut layers: StdVec<StdVec<BytesN<32>>> = StdVec::new();
    layers.push(leaves.to_vec());
    while layers.last().unwrap().len() > 1 {
        let last = layers.last().unwrap().clone();
        let mut next = StdVec::new();
        let mut i = 0;
        while i < last.len() {
            if i + 1 < last.len() {
                next.push(combine(env, last[i].clone(), last[i + 1].clone()));
            } else {
                next.push(last[i].clone());
            }
            i += 2;
        }
        layers.push(next);
    }
    let root = layers.last().unwrap()[0].clone();

    let mut proofs: StdVec<StdVec<BytesN<32>>> = StdVec::new();
    for idx in 0..leaves.len() {
        let mut proof = StdVec::new();
        let mut i = idx;
        for layer in layers.iter().take(layers.len() - 1) {
            let sibling_idx = if i % 2 == 0 { i + 1 } else { i - 1 };
            if sibling_idx < layer.len() {
                proof.push(layer[sibling_idx].clone());
            }
            i /= 2;
        }
        proofs.push(proof);
    }
    (root, proofs)
}

extern crate alloc;

#[test]
fn fundraising_and_close() {
    let env = Env::default();
    env.mock_all_auths();

    // Asset BRZ mock
    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);

    // Share token (real-estate-share) — registrado direto no env de teste
    let share_admin = Address::generate(&env);
    let share_id = env.register_contract(
        None,
        contractease_real_estate_share::RealEstateShare,
    );
    let share = contractease_real_estate_share::RealEstateShareClient::new(&env, &share_id);
    share.init(
        &share_admin,
        &7,
        &soroban_sdk::String::from_str(&env, "Vault X"),
        &soroban_sdk::String::from_str(&env, "VAULTX"),
    );

    // Vault
    let sponsor = Address::generate(&env);
    let vault_id = env.register_contract(None, RealEstateVault);
    let vault = RealEstateVaultClient::new(&env, &vault_id);

    let params = VaultInitParams {
        sponsor: sponsor.clone(),
        share_token: share_id.clone(),
        payout_asset: asset.clone(),
        total_shares: 100,
        share_price: 1_000 * STROOP,
        min_shares_quorum_bps: 5000, // 50%
        matricula_hash: BytesN::from_array(&env, &[1u8; 32]),
        fundraising_days: 30,
    };
    vault.init(&params);

    // Vault precisa ser o minter do share
    share.set_minter(&vault_id);

    // Investidores compram
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    asset_admin_client.mint(&alice, &(60_000 * STROOP));
    asset_admin_client.mint(&bob, &(40_000 * STROOP));

    vault.buy_shares(&alice, &30);
    vault.buy_shares(&bob, &20);

    assert_eq!(vault.get_status(), VaultStatus::Fundraising);
    assert_eq!(share.balance(&alice), 30);
    assert_eq!(share.balance(&bob), 20);

    // Sponsor encerra captação antes da meta
    vault.close_fundraising();
    assert_eq!(vault.get_status(), VaultStatus::Operational);
    assert!(share.is_locked());
}

#[test]
fn rent_distribution_with_merkle() {
    let env = Env::default();
    env.mock_all_auths();

    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);

    let share_id = env.register_contract(
        None,
        contractease_real_estate_share::RealEstateShare,
    );
    let share = contractease_real_estate_share::RealEstateShareClient::new(&env, &share_id);
    share.init(
        &Address::generate(&env),
        &7,
        &soroban_sdk::String::from_str(&env, "Vault"),
        &soroban_sdk::String::from_str(&env, "V"),
    );

    let sponsor = Address::generate(&env);
    let vault_id = env.register_contract(None, RealEstateVault);
    let vault = RealEstateVaultClient::new(&env, &vault_id);

    vault.init(&VaultInitParams {
        sponsor: sponsor.clone(),
        share_token: share_id.clone(),
        payout_asset: asset.clone(),
        total_shares: 100,
        share_price: 1_000 * STROOP,
        min_shares_quorum_bps: 5000,
        matricula_hash: BytesN::from_array(&env, &[0u8; 32]),
        fundraising_days: 30,
    });
    share.set_minter(&vault_id);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    asset_admin_client.mint(&alice, &(100_000 * STROOP));
    asset_admin_client.mint(&bob, &(100_000 * STROOP));
    asset_admin_client.mint(&sponsor, &(20_000 * STROOP));

    vault.buy_shares(&alice, &30);
    vault.buy_shares(&bob, &20);
    vault.close_fundraising();

    // Sponsor distribui 5_000 BRZ de aluguel
    // Alice tem 30/50 = 60% → 3000
    // Bob tem 20/50 = 40% → 2000
    let alice_share = 3_000 * STROOP;
    let bob_share = 2_000 * STROOP;
    let total = alice_share + bob_share;

    let leaf_alice = compute_leaf(&env, 1, &alice, alice_share);
    let leaf_bob = compute_leaf(&env, 1, &bob, bob_share);
    let leaves = [leaf_alice.clone(), leaf_bob.clone()];
    let (root, proofs) = build_tree(&env, &leaves);

    vault.distribute_rent(&total, &root);

    // Alice reclama
    let mut proof_alice = Vec::new(&env);
    for p in &proofs[0] {
        proof_alice.push_back(p.clone());
    }
    vault.claim_rent(&alice, &1, &alice_share, &proof_alice);

    // Bob reclama
    let mut proof_bob = Vec::new(&env);
    for p in &proofs[1] {
        proof_bob.push_back(p.clone());
    }
    vault.claim_rent(&bob, &1, &bob_share, &proof_bob);

    // Alice e Bob receberam suas fatias
    use soroban_sdk::token::TokenClient;
    let asset_token = TokenClient::new(&env, &asset);
    assert_eq!(
        asset_token.balance(&alice),
        100_000 * STROOP - 30_000 * STROOP + alice_share
    );
    assert_eq!(
        asset_token.balance(&bob),
        100_000 * STROOP - 20_000 * STROOP + bob_share
    );
}

#[test]
fn double_claim_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);

    let share_id = env.register_contract(
        None,
        contractease_real_estate_share::RealEstateShare,
    );
    let share = contractease_real_estate_share::RealEstateShareClient::new(&env, &share_id);
    share.init(
        &Address::generate(&env),
        &7,
        &soroban_sdk::String::from_str(&env, "V"),
        &soroban_sdk::String::from_str(&env, "V"),
    );

    let sponsor = Address::generate(&env);
    let vault_id = env.register_contract(None, RealEstateVault);
    let vault = RealEstateVaultClient::new(&env, &vault_id);
    vault.init(&VaultInitParams {
        sponsor: sponsor.clone(),
        share_token: share_id.clone(),
        payout_asset: asset.clone(),
        total_shares: 100,
        share_price: 1_000 * STROOP,
        min_shares_quorum_bps: 5000,
        matricula_hash: BytesN::from_array(&env, &[0u8; 32]),
        fundraising_days: 30,
    });
    share.set_minter(&vault_id);

    let alice = Address::generate(&env);
    asset_admin_client.mint(&alice, &(100_000 * STROOP));
    asset_admin_client.mint(&sponsor, &(10_000 * STROOP));

    vault.buy_shares(&alice, &50);
    vault.close_fundraising();

    let alice_share = 5_000 * STROOP;
    let leaf_alice = compute_leaf(&env, 1, &alice, alice_share);
    let leaves = [leaf_alice];
    let (root, _proofs) = build_tree(&env, &leaves);

    vault.distribute_rent(&alice_share, &root);

    let proof = Vec::new(&env); // 1 folha → proof vazio
    vault.claim_rent(&alice, &1, &alice_share, &proof);

    // Segunda chamada deve falhar
    let result = vault.try_claim_rent(&alice, &1, &alice_share, &proof);
    assert!(result.is_err());
}

#[test]
fn sale_proposal_voting_and_execution() {
    let env = Env::default();
    env.mock_all_auths();

    let asset_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin);
    let asset_admin_client = StellarAssetClient::new(&env, &asset);

    let share_id = env.register_contract(
        None,
        contractease_real_estate_share::RealEstateShare,
    );
    let share = contractease_real_estate_share::RealEstateShareClient::new(&env, &share_id);
    share.init(
        &Address::generate(&env),
        &7,
        &soroban_sdk::String::from_str(&env, "V"),
        &soroban_sdk::String::from_str(&env, "V"),
    );

    let sponsor = Address::generate(&env);
    let vault_id = env.register_contract(None, RealEstateVault);
    let vault = RealEstateVaultClient::new(&env, &vault_id);
    vault.init(&VaultInitParams {
        sponsor: sponsor.clone(),
        share_token: share_id.clone(),
        payout_asset: asset.clone(),
        total_shares: 100,
        share_price: 1_000 * STROOP,
        min_shares_quorum_bps: 5000,
        matricula_hash: BytesN::from_array(&env, &[0u8; 32]),
        fundraising_days: 30,
    });
    share.set_minter(&vault_id);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    asset_admin_client.mint(&alice, &(100_000 * STROOP));
    asset_admin_client.mint(&bob, &(100_000 * STROOP));
    asset_admin_client.mint(&sponsor, &(500_000 * STROOP));

    vault.buy_shares(&alice, &60);
    vault.buy_shares(&bob, &40);
    // 100/100 cotas vendidas → captação fecha automaticamente
    assert_eq!(vault.get_status(), VaultStatus::Operational);

    vault.propose_sale(&(200_000 * STROOP), &7);
    assert_eq!(vault.get_status(), VaultStatus::SaleProposed);

    vault.vote_sale(&alice, &true);
    vault.vote_sale(&bob, &false);

    // Cotas ficam escrowadas no vault durante a votação (anti voto duplo)
    assert_eq!(share.balance(&alice), 0);
    assert_eq!(share.balance(&bob), 0);
    assert_eq!(share.balance(&vault_id), 100);

    // Votar de novo falha mesmo após transferência (não há mais cotas p/ mover)
    assert!(vault.try_vote_sale(&alice, &true).is_err());

    // Alice tem 60 cotas (>50% quorum), votos yes > no → aprovado
    let proceeds_root = BytesN::from_array(&env, &[9u8; 32]);
    vault.execute_sale(&(200_000 * STROOP), &proceeds_root);
    assert_eq!(vault.get_status(), VaultStatus::SaleExecuted);

    // Após a execução, cada votante resgata suas cotas escrowadas
    vault.reclaim_vote_shares(&alice, &1);
    vault.reclaim_vote_shares(&bob, &1);
    assert_eq!(share.balance(&alice), 60);
    assert_eq!(share.balance(&bob), 40);

    // Resgatar duas vezes falha
    assert!(vault.try_reclaim_vote_shares(&alice, &1).is_err());
}
