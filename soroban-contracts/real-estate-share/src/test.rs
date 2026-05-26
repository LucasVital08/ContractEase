#![cfg(test)]

use super::{RealEstateShare, RealEstateShareClient};
use soroban_sdk::{
    testutils::Address as _,
    Address, Env, String,
};

fn setup<'a>() -> (Env, RealEstateShareClient<'a>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let minter = Address::generate(&env);

    let contract_id = env.register_contract(None, RealEstateShare);
    let token = RealEstateShareClient::new(&env, &contract_id);

    token.init(
        &admin,
        &7,
        &String::from_str(&env, "Imovel Rua X 100"),
        &String::from_str(&env, "RUAX100"),
    );
    token.set_minter(&minter);
    (env, token, admin, minter)
}

#[test]
fn mint_and_balance() {
    let (env, token, _admin, _minter) = setup();
    let holder = Address::generate(&env);
    token.mint(&holder, &500);
    assert_eq!(token.balance(&holder), 500);
    assert_eq!(token.total_supply(), 500);
}

#[test]
fn mint_after_lock_fails() {
    let (env, token, _admin, _minter) = setup();
    let holder = Address::generate(&env);
    token.mint(&holder, &100);
    token.lock_minting();

    let result = token.try_mint(&holder, &50);
    assert!(result.is_err());
    assert!(token.is_locked());
}

#[test]
fn transfer_between_holders() {
    let (env, token, _admin, _minter) = setup();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    token.mint(&a, &100);
    token.transfer(&a, &b, &30);
    assert_eq!(token.balance(&a), 70);
    assert_eq!(token.balance(&b), 30);
}

#[test]
fn approve_and_transfer_from() {
    let (env, token, _admin, _minter) = setup();
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let to = Address::generate(&env);

    token.mint(&owner, &200);
    token.approve(&owner, &spender, &50, &(env.ledger().sequence() + 1000));

    assert_eq!(token.allowance(&owner, &spender), 50);
    token.transfer_from(&spender, &owner, &to, &40);
    assert_eq!(token.balance(&to), 40);
    assert_eq!(token.allowance(&owner, &spender), 10);
}

#[test]
fn burn_by_minter_reduces_supply() {
    let (env, token, _admin, _minter) = setup();
    let h = Address::generate(&env);
    token.mint(&h, &100);
    token.burn_by_minter(&h, &30);
    assert_eq!(token.balance(&h), 70);
    assert_eq!(token.total_supply(), 70);
}

#[test]
fn transfer_more_than_balance_fails() {
    let (env, token, _admin, _minter) = setup();
    let h = Address::generate(&env);
    let to = Address::generate(&env);
    token.mint(&h, &100);
    let result = token.try_transfer(&h, &to, &150);
    assert!(result.is_err());
}
