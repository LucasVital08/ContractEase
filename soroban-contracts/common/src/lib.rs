//! ContractEase — Common Library
//!
//! Abstrações compartilhadas por todos os smart contracts da plataforma.
//!
//! - [`Error`]:  enum padrão de erros, com discriminantes estáveis.
//! - [`token_transfer`]: helper SEP-41 para transferência de fungíveis.
//! - [`require_state`]: macro auxiliar para validação de máquina de estado.
//! - [`AdminStorage`]: padrão de owner/admin com suporte a transferência.
//!
//! Todas as funções aqui são `#![no_std]` e seguras para uso em runtime Soroban.

#![no_std]

use soroban_sdk::{contracterror, contracttype, token, Address, Env, Symbol};

// ─────────────────────────────────────────────────────────────────────
// ERROS PADRÃO
// ─────────────────────────────────────────────────────────────────────

/// Erros padrão da plataforma ContractEase.
///
/// Discriminantes 1-99 são reservados para erros comuns.
/// Cada contrato pode definir seus próprios erros a partir do discriminante 100.
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    /// Chamador não tem permissão para essa ação.
    Unauthorized = 1,
    /// Estado atual não permite essa transição.
    InvalidState = 2,
    /// Saldo insuficiente no contrato.
    InsufficientFunds = 3,
    /// Prazo ainda não foi atingido.
    DeadlineNotReached = 4,
    /// Prazo já expirou.
    DeadlineExpired = 5,
    /// Valor fornecido é zero ou negativo quando deveria ser positivo.
    InvalidAmount = 6,
    /// Índice fora do range válido.
    IndexOutOfRange = 7,
    /// Contrato já foi inicializado.
    AlreadyInitialized = 8,
    /// Contrato ainda não foi inicializado.
    NotInitialized = 9,
    /// Operação aritmética overflow.
    Overflow = 10,
}

// ─────────────────────────────────────────────────────────────────────
// TRANSFERÊNCIA SEP-41
// ─────────────────────────────────────────────────────────────────────

/// Transfere `amount` do token `asset` de `from` para `to`.
///
/// Usa o padrão SEP-41 (interface de token fungível Soroban).
/// O chamador deve já ter invocado `from.require_auth()` antes.
pub fn token_transfer(env: &Env, asset: &Address, from: &Address, to: &Address, amount: i128) {
    if amount <= 0 {
        panic_with_error(env, CommonError::InvalidAmount);
    }
    token::Client::new(env, asset).transfer(from, to, &amount);
}

/// Consulta o saldo de `account` no token `asset`.
pub fn token_balance(env: &Env, asset: &Address, account: &Address) -> i128 {
    token::Client::new(env, asset).balance(account)
}

// ─────────────────────────────────────────────────────────────────────
// ADMIN STORAGE
// ─────────────────────────────────────────────────────────────────────

const ADMIN_KEY: Symbol = soroban_sdk::symbol_short!("ADMIN");

/// Define o admin (owner) do contrato. Falha se já existir.
pub fn admin_set(env: &Env, admin: &Address) {
    if env.storage().instance().has(&ADMIN_KEY) {
        panic_with_error(env, CommonError::AlreadyInitialized);
    }
    env.storage().instance().set(&ADMIN_KEY, admin);
}

/// Recupera o admin atual. Panic se contrato não foi inicializado.
pub fn admin_get(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&ADMIN_KEY)
        .unwrap_or_else(|| panic_with_error(env, CommonError::NotInitialized))
}

/// Exige que o chamador seja o admin.
pub fn admin_require(env: &Env) {
    let admin = admin_get(env);
    admin.require_auth();
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

/// Panic com um erro tipado.
///
/// Usa o sistema de erro tipado do Soroban — o frontend recebe o discriminante
/// e pode mapear para mensagens user-friendly.
pub fn panic_with_error(env: &Env, err: CommonError) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}

/// Valida se a transição de estado é permitida.
///
/// Uso: `require_state(&env, current == expected)`
pub fn require_state(env: &Env, ok: bool) {
    if !ok {
        panic_with_error(env, CommonError::InvalidState);
    }
}

/// Valida que `caller` é uma das `allowed`.
pub fn require_any_caller(env: &Env, caller: &Address, allowed: &[&Address]) {
    let is_allowed = allowed.iter().any(|a| *a == caller);
    if !is_allowed {
        panic_with_error(env, CommonError::Unauthorized);
    }
    caller.require_auth();
}

// ─────────────────────────────────────────────────────────────────────
// TTL / ARQUIVAMENTO DE STORAGE
// ─────────────────────────────────────────────────────────────────────
//
// Na Stellar, toda entrada de storage tem um "time to live" (TTL) em ledgers.
// Quando o TTL expira, a entrada é ARQUIVADA e deixa de ser acessível até ser
// restaurada — o que, para contratos de longa duração (um aluguel de 30 meses,
// por exemplo), significaria estado/fundos inacessíveis. Por isso todo método
// que toca o contrato deve "renovar" o TTL das entradas que usa.
//
// A cada ~5s fecha um ledger, então ~17.280 ledgers = 1 dia.

/// Ledgers em um dia (aprox., assumindo ledgers de 5s).
pub const LEDGERS_PER_DAY: u32 = 17_280;
/// Se o TTL cair abaixo disto (~30 dias), renovamos.
pub const TTL_THRESHOLD: u32 = LEDGERS_PER_DAY * 30;
/// Alvo de renovação (~90 dias). O host limita ao máximo permitido pela rede.
pub const TTL_EXTEND_TO: u32 = LEDGERS_PER_DAY * 90;

/// Renova o TTL do instance storage (onde vive o struct principal do contrato).
/// Deve ser chamado no início de qualquer método que leia/escreva o estado.
pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Renova o TTL de uma entrada persistente específica (registros de mês,
/// milestones, períodos de aluguel, saldos de token, etc).
pub fn bump_persistent<K>(env: &Env, key: &K)
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

// ─────────────────────────────────────────────────────────────────────
// CONSTANTES DE TEMPO
// ─────────────────────────────────────────────────────────────────────

pub const SECONDS_PER_DAY: u64 = 86_400;
pub const SECONDS_PER_HOUR: u64 = 3_600;

/// Calcula `base_ts + days` em segundos com proteção contra overflow.
pub fn add_days(env: &Env, base_ts: u64, days: u64) -> u64 {
    base_ts
        .checked_add(days.saturating_mul(SECONDS_PER_DAY))
        .unwrap_or_else(|| panic_with_error(env, CommonError::Overflow))
}

// ─────────────────────────────────────────────────────────────────────
// META-INFO PADRÃO
// ─────────────────────────────────────────────────────────────────────

/// Estrutura de metadados que todo contrato deve expor via `meta()`.
///
/// Usada pelo frontend para mostrar versão e identificação na UI.
#[contracttype]
#[derive(Clone)]
pub struct ContractMeta {
    pub template_id: Symbol,
    pub version: u32,
    pub deployed_at: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn admin_lifecycle() {
        let env = Env::default();
        let admin = Address::generate(&env);

        // Necessário rodar dentro de contexto de contrato para tocar instance storage
        let contract_id = env.register_contract(None, TestContract);
        env.as_contract(&contract_id, || {
            admin_set(&env, &admin);
            assert_eq!(admin_get(&env), admin);
        });
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #8)")]
    fn admin_set_twice_fails() {
        let env = Env::default();
        let a1 = Address::generate(&env);
        let a2 = Address::generate(&env);

        let contract_id = env.register_contract(None, TestContract);
        env.as_contract(&contract_id, || {
            admin_set(&env, &a1);
            admin_set(&env, &a2); // panic AlreadyInitialized (#8)
        });
    }

    use soroban_sdk::contract;

    #[contract]
    struct TestContract;
}
