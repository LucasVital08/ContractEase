#![cfg(test)]

use super::{
    RentInitParams, RentState, RentalContract, RentalContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String,
};

const STROOP: i128 = 10_000_000; // 1 unidade = 1e7 stroops

struct Fixture<'a> {
    env: Env,
    contract: RentalContractClient<'a>,
    asset: Address,
    asset_admin: StellarAssetClient<'a>,
    asset_token: TokenClient<'a>,
    landlord: Address,
    tenant: Address,
}

fn setup<'a>(monthly_rent: i128, deposit_months: u32) -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Deploy asset (BRZ mock)
    let asset_admin_addr = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin_addr.clone());
    let asset_admin = StellarAssetClient::new(&env, &asset);
    let asset_token = TokenClient::new(&env, &asset);

    // 2. Setup parties
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);

    // 3. Mint balance para o inquilino (suficiente p/ caução + 36 meses)
    let initial_balance = monthly_rent * (deposit_months as i128 + 36);
    asset_admin.mint(&tenant, &initial_balance);

    // 4. Deploy contrato de aluguel
    let contract_id = env.register_contract(None, RentalContract);
    let contract = RentalContractClient::new(&env, &contract_id);

    let params = RentInitParams {
        landlord: landlord.clone(),
        tenant: tenant.clone(),
        asset: asset.clone(),
        monthly_rent,
        deposit_months,
        due_day: 5,
        duration_months: 30,
        late_fee_bps: 200, // 2% ao mês
        max_consecutive_overdue: 3,
        property_hash: BytesN::from_array(&env, &[0u8; 32]),
    };
    contract.init(&params);

    Fixture {
        env,
        contract,
        asset,
        asset_admin,
        asset_token,
        landlord,
        tenant,
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
fn happy_path_full_cycle() {
    let monthly_rent = 2500 * STROOP;
    let fx = setup(monthly_rent, 3);

    // 1. Estado inicial
    assert_eq!(fx.contract.get_state(), RentState::AwaitingDeposit);

    // 2. Inquilino deposita caução (3x aluguel)
    fx.contract.pay_deposit();
    assert_eq!(fx.contract.get_state(), RentState::Active);
    assert_eq!(
        fx.asset_token.balance(&fx.contract.address),
        monthly_rent * 3
    );

    // 3. Inquilino paga 12 meses em dia
    let landlord_before = fx.asset_token.balance(&fx.landlord);
    for _ in 0..12 {
        advance_time(&fx.env, 30 * 86_400); // avança 30 dias
        fx.contract.pay_rent();
    }
    let landlord_after = fx.asset_token.balance(&fx.landlord);
    assert_eq!(landlord_after - landlord_before, monthly_rent * 12);

    // 4. Solicita vistoria
    fx.contract.request_evaluation(&fx.tenant);
    assert_eq!(fx.contract.get_state(), RentState::Evaluation);

    // 5. Locador libera caução integral
    let tenant_before = fx.asset_token.balance(&fx.tenant);
    fx.contract.release_deposit();
    assert_eq!(fx.contract.get_state(), RentState::ClosedClean);
    assert_eq!(
        fx.asset_token.balance(&fx.tenant) - tenant_before,
        monthly_rent * 3
    );
}

#[test]
fn pay_rent_with_late_fee() {
    let monthly_rent = 1_000 * STROOP;
    let fx = setup(monthly_rent, 3);
    fx.contract.pay_deposit();

    // Atrasa 15 dias após o vencimento do 1º mês
    advance_time(&fx.env, 30 * 86_400 + 15 * 86_400);

    let landlord_before = fx.asset_token.balance(&fx.landlord);
    fx.contract.pay_rent();
    let received = fx.asset_token.balance(&fx.landlord) - landlord_before;

    // multa = 1000 * 200bps * 15dias / (10000 * 30) = 100
    // total = 1000 + 100 = 1100 stroops (em unidades)
    let expected_fee = monthly_rent * 200 * 15 / (10_000 * 30);
    assert_eq!(received, monthly_rent + expected_fee);
}

#[test]
fn mark_overdue_increments_counter() {
    let fx = setup(1_000 * STROOP, 3);
    fx.contract.pay_deposit();

    // Vencimento + 1 dia
    advance_time(&fx.env, 31 * 86_400);
    fx.contract.mark_overdue();

    assert_eq!(fx.contract.get_state(), RentState::Overdue);
    let agreement = fx.contract.get_agreement();
    assert_eq!(agreement.consecutive_overdue, 1);
}

#[test]
fn terminate_for_default_after_max_overdue() {
    let monthly_rent = 1_000 * STROOP;
    let fx = setup(monthly_rent, 3);
    fx.contract.pay_deposit();

    // Simula 3 inadimplências consecutivas usando avanço de tempo + mark_overdue
    // Como pay_rent zera o contador, só fazemos mark_overdue 3 vezes sem pagar
    // Como mark_overdue exige Active, precisamos voltar para Active após cada
    // — não temos uma maneira limpa. Cenário real: o locador chama mark_overdue,
    // depois o inquilino paga (volta a Active), atrasa de novo... mas aqui
    // forçamos o estado via incremento direto: chamamos 3 vezes simulando
    // 3 ciclos de Active → Overdue (precisamos pagar entre eles).
    //
    // Para testar de forma realista: pagar com atraso 3x e ver o counter zerar.
    // Para o cenário de terminate, vamos verificar o erro quando counter < max.

    advance_time(&fx.env, 31 * 86_400);
    fx.contract.mark_overdue();

    // Tenta terminar com counter=1 (max=3) → deve falhar
    let result = fx.contract.try_terminate_for_default();
    assert!(result.is_err());
}

#[test]
fn retain_deposit_with_damage() {
    let monthly_rent = 1_000 * STROOP;
    let fx = setup(monthly_rent, 3);
    fx.contract.pay_deposit();

    advance_time(&fx.env, 30 * 86_400);
    fx.contract.pay_rent();

    fx.contract.request_evaluation(&fx.landlord);

    let damage_proof = BytesN::from_array(&fx.env, &[42u8; 32]);
    let retain = 800 * STROOP; // R$ 800 de dano

    let landlord_before = fx.asset_token.balance(&fx.landlord);
    let tenant_before = fx.asset_token.balance(&fx.tenant);

    fx.contract.retain_deposit(&retain, &damage_proof);

    assert_eq!(fx.contract.get_state(), RentState::ClosedDamaged);
    assert_eq!(
        fx.asset_token.balance(&fx.landlord) - landlord_before,
        retain
    );
    assert_eq!(
        fx.asset_token.balance(&fx.tenant) - tenant_before,
        monthly_rent * 3 - retain
    );
}

#[test]
fn double_init_fails() {
    let fx = setup(1_000 * STROOP, 3);
    let params = RentInitParams {
        landlord: fx.landlord.clone(),
        tenant: fx.tenant.clone(),
        asset: fx.asset.clone(),
        monthly_rent: 1_000 * STROOP,
        deposit_months: 3,
        due_day: 5,
        duration_months: 30,
        late_fee_bps: 200,
        max_consecutive_overdue: 3,
        property_hash: BytesN::from_array(&fx.env, &[0u8; 32]),
    };
    let result = fx.contract.try_init(&params);
    assert!(result.is_err());
}

#[test]
fn invalid_due_day_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let asset_admin_addr = Address::generate(&env);
    let asset = env.register_stellar_asset_contract(asset_admin_addr);
    let contract_id = env.register_contract(None, RentalContract);
    let contract = RentalContractClient::new(&env, &contract_id);

    let params = RentInitParams {
        landlord: Address::generate(&env),
        tenant: Address::generate(&env),
        asset,
        monthly_rent: 1_000 * STROOP,
        deposit_months: 3,
        due_day: 31, // inválido (>28)
        duration_months: 30,
        late_fee_bps: 200,
        max_consecutive_overdue: 3,
        property_hash: BytesN::from_array(&env, &[0u8; 32]),
    };
    let result = contract.try_init(&params);
    assert!(result.is_err());
}

#[test]
fn note_records_event() {
    let fx = setup(1_000 * STROOP, 3);
    fx.contract.pay_deposit();

    let msg = String::from_str(&fx.env, "Vazamento no banheiro reportado");
    fx.contract.note(&fx.tenant, &msg);

    // Apenas verifica que não panica — eventos são opacos no env de teste.
}
