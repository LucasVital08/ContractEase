//! # Real Estate Share Token (SEP-41 compatível)
//!
//! Token fungível que representa cotas de um imóvel tokenizado.
//!
//! Características:
//! - `mint` restrita ao Vault (controlado por `set_minter`).
//! - `lock_minting` é definitivo — após encerrar a captação, ninguém pode mintar.
//! - `burn` aberta ao próprio holder (usado pelo Vault no resgate de venda).
//! - Implementa a interface SEP-41 padrão (`transfer`, `approve`, `balance`).

#![no_std]

use contractease_common::{admin_get, admin_set, panic_with_error, CommonError};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String,
    Symbol,
};

const META: Symbol = symbol_short!("META");
const MINTER: Symbol = symbol_short!("MINTER");
const LOCKED: Symbol = symbol_short!("LOCKED");
const BALANCE: Symbol = symbol_short!("BAL");
const ALLOW: Symbol = symbol_short!("ALLOW");
const SUPPLY: Symbol = symbol_short!("SUPPLY");

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ShareError {
    MintingLocked = 100,
    NotMinter = 101,
    AllowanceExceeded = 102,
    InsufficientBalance = 103,
}

#[contracttype]
#[derive(Clone)]
pub struct TokenMeta {
    pub decimals: u32,
    pub name: String,
    pub symbol: String,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contract]
pub struct RealEstateShare;

#[contractimpl]
impl RealEstateShare {
    pub fn init(
        env: Env,
        admin: Address,
        decimals: u32,
        name: String,
        symbol: String,
    ) {
        if env.storage().instance().has(&META) {
            panic_with_error(&env, CommonError::AlreadyInitialized);
        }
        admin_set(&env, &admin);
        env.storage()
            .instance()
            .set(&META, &TokenMeta { decimals, name, symbol });
        env.storage().instance().set(&SUPPLY, &0i128);
        env.storage().instance().set(&LOCKED, &false);
    }

    /// Admin define o contrato Vault como minter autorizado.
    pub fn set_minter(env: Env, minter: Address) {
        let admin = admin_get(&env);
        admin.require_auth();
        env.storage().instance().set(&MINTER, &minter);
    }

    /// Mint de novas cotas. Só o `minter` pode chamar.
    pub fn mint(env: Env, to: Address, amount: i128) {
        if env.storage().instance().get::<_, bool>(&LOCKED).unwrap_or(false) {
            panic_with_error_share(&env, ShareError::MintingLocked);
        }
        if amount <= 0 {
            panic_with_error(&env, CommonError::InvalidAmount);
        }

        let minter: Address = env
            .storage()
            .instance()
            .get(&MINTER)
            .unwrap_or_else(|| panic_with_error_share(&env, ShareError::NotMinter));
        minter.require_auth();

        let current = balance_of(&env, &to);
        env.storage()
            .persistent()
            .set(&(BALANCE, to.clone()), &(current + amount));

        let supply: i128 = env.storage().instance().get(&SUPPLY).unwrap_or(0);
        env.storage()
            .instance()
            .set(&SUPPLY, &supply.checked_add(amount).unwrap());

        env.events().publish((symbol_short!("mint"), to), amount);
    }

    /// Trava o minting permanentemente. Chamada pelo Vault ao encerrar a captação.
    pub fn lock_minting(env: Env) {
        let minter: Address = env
            .storage()
            .instance()
            .get(&MINTER)
            .unwrap_or_else(|| panic_with_error_share(&env, ShareError::NotMinter));
        minter.require_auth();
        env.storage().instance().set(&LOCKED, &true);
        env.events().publish((symbol_short!("locked"),), ());
    }

    /// Burn de cotas. Caller deve ser o owner OU o minter (para resgate de venda).
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        burn_internal(&env, &from, amount);
    }

    pub fn burn_by_minter(env: Env, from: Address, amount: i128) {
        let minter: Address = env
            .storage()
            .instance()
            .get(&MINTER)
            .unwrap_or_else(|| panic_with_error_share(&env, ShareError::NotMinter));
        minter.require_auth();
        burn_internal(&env, &from, amount);
    }

    // ─── SEP-41 INTERFACE ────────────────────────────────────────────

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        do_transfer(&env, &from, &to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        consume_allowance(&env, &from, &spender, amount);
        do_transfer(&env, &from, &to, amount);
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        env.storage().temporary().set(
            &(ALLOW, from.clone(), spender.clone()),
            &AllowanceValue {
                amount,
                expiration_ledger,
            },
        );
        env.events()
            .publish((symbol_short!("approve"), from, spender), amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        balance_of(&env, &id)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let av: Option<AllowanceValue> =
            env.storage().temporary().get(&(ALLOW, from, spender));
        match av {
            Some(v) if v.expiration_ledger >= env.ledger().sequence() => v.amount,
            _ => 0,
        }
    }

    pub fn decimals(env: Env) -> u32 {
        let m: TokenMeta = env.storage().instance().get(&META).unwrap();
        m.decimals
    }

    pub fn name(env: Env) -> String {
        let m: TokenMeta = env.storage().instance().get(&META).unwrap();
        m.name
    }

    pub fn symbol(env: Env) -> String {
        let m: TokenMeta = env.storage().instance().get(&META).unwrap();
        m.symbol
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&SUPPLY).unwrap_or(0)
    }

    pub fn is_locked(env: Env) -> bool {
        env.storage().instance().get(&LOCKED).unwrap_or(false)
    }

    pub fn minter(env: Env) -> Option<Address> {
        env.storage().instance().get(&MINTER)
    }
}

// ─── HELPERS PRIVADOS ────────────────────────────────────────────────

fn balance_of(env: &Env, id: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&(BALANCE, id.clone()))
        .unwrap_or(0)
}

fn do_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
    if amount <= 0 {
        panic_with_error(env, CommonError::InvalidAmount);
    }
    let from_bal = balance_of(env, from);
    if from_bal < amount {
        panic_with_error_share(env, ShareError::InsufficientBalance);
    }
    env.storage()
        .persistent()
        .set(&(BALANCE, from.clone()), &(from_bal - amount));
    let to_bal = balance_of(env, to);
    env.storage()
        .persistent()
        .set(&(BALANCE, to.clone()), &(to_bal + amount));
    env.events()
        .publish((symbol_short!("transfer"), from.clone(), to.clone()), amount);
}

fn consume_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
    let av: Option<AllowanceValue> = env
        .storage()
        .temporary()
        .get(&(ALLOW, from.clone(), spender.clone()));
    let mut v = av.unwrap_or(AllowanceValue {
        amount: 0,
        expiration_ledger: 0,
    });
    if v.amount < amount || v.expiration_ledger < env.ledger().sequence() {
        panic_with_error_share(env, ShareError::AllowanceExceeded);
    }
    v.amount -= amount;
    env.storage()
        .temporary()
        .set(&(ALLOW, from.clone(), spender.clone()), &v);
}

fn burn_internal(env: &Env, from: &Address, amount: i128) {
    if amount <= 0 {
        panic_with_error(env, CommonError::InvalidAmount);
    }
    let bal = balance_of(env, from);
    if bal < amount {
        panic_with_error_share(env, ShareError::InsufficientBalance);
    }
    env.storage()
        .persistent()
        .set(&(BALANCE, from.clone()), &(bal - amount));

    let supply: i128 = env.storage().instance().get(&SUPPLY).unwrap_or(0);
    env.storage()
        .instance()
        .set(&SUPPLY, &(supply - amount));
    env.events().publish((symbol_short!("burn"), from.clone()), amount);
}

fn panic_with_error_share(env: &Env, err: ShareError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

#[cfg(test)]
mod test;
