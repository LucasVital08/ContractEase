# ContractEase — Soroban Smart Contracts

Workspace Cargo dos smart contracts da plataforma ContractEase, escritos em
Rust + Soroban SDK e prontos para deploy na Stellar (Testnet → Mainnet).

## Contratos

| Pacote                    | ID Template            | Descrição                                                     | Status |
|---------------------------|------------------------|---------------------------------------------------------------|--------|
| `rent/`                   | `rent`                 | Aluguel residencial com caução, mora e rescisão por default   | ✅      |
| `ecommerce/`              | `ecommerce`            | Escrow para vendas online com árbitro e refund parcial        | ✅      |
| `freelancer/`             | `freelancer`           | Projetos por milestones com renegociação e proteção anti-stale | ✅      |
| `legal-fees/`             | `legal_fees`           | Honorários com retainer + mensal + quota litis (dupla assinatura) | ✅      |
| `construction/`           | `construction_contract`| Empreitada com marcos físicos, tri-assinatura e warranty       | ✅      |
| `real-estate-share/`      | —                      | Token SEP-41 das cotas (dependência do vault)                 | ✅      |
| `real-estate-vault/`      | `real_estate_token`    | Vault com captação, distribuição via Merkle e venda votada    | ✅      |
| `common/`                 | —                      | Lib interna (erros padrão, helpers SEP-41, admin storage)     | ✅      |

## Estrutura

```
soroban-contracts/
├── Cargo.toml              # workspace
├── rust-toolchain.toml     # versão fixa (1.81.0)
├── common/                 # lib compartilhada (Error, token_transfer, admin)
├── rent/                   # cada contrato é um pacote independente
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs          # implementação
│       └── test.rs         # testes (#[cfg(test)])
├── ecommerce/
├── freelancer/
├── legal-fees/
├── construction/
├── real-estate-share/
├── real-estate-vault/
├── scripts/
│   ├── build-all.sh        # cargo build + stellar contract optimize
│   └── upload-wasms.sh     # supabase storage cp para bucket contracts-wasm
└── dist/                   # WASMs otimizados (gerado pelo build)
```

## Pré-requisitos

```bash
# 1. Rust + target wasm
rustup install 1.81.0
rustup target add wasm32-unknown-unknown --toolchain 1.81.0

# 2. Stellar CLI (otimização e ferramentas de deploy)
cargo install --locked stellar-cli@22.0.0

# 3. Supabase CLI (upload dos WASMs)
npm install -g supabase
supabase login
```

## Build

```bash
cd soroban-contracts
./scripts/build-all.sh
```

Saída em `dist/`:

```
rent.wasm                   ~ 15 KB
ecommerce.wasm              ~ 14 KB
freelancer.wasm             ~ 18 KB
legal_fees.wasm             ~ 14 KB
construction.wasm           ~ 22 KB
real_estate_share.wasm      ~ 16 KB
real_estate_vault.wasm      ~ 24 KB
```

## Testes

```bash
# todos
cargo test --workspace

# de um único contrato
cargo test -p contractease-rent
cargo test -p contractease-ecommerce -- --nocapture
```

Cada contrato tem 6-8 testes cobrindo happy path, falhas de estado, autenticação
e edge cases (timeout, double-spend, etc).

## Deploy completo (Testnet)

### 1. Configurar Sponsor account

```bash
# Gerar par de chaves
stellar keys generate sponsor

# Fund na testnet
stellar keys fund sponsor

# Pegar a private key (S...)
stellar keys show sponsor --secret
```

Configure como secret no Supabase:

```bash
supabase secrets set STELLAR_SECRET_KEY=S....
```

### 2. Criar bucket no Storage

No painel Supabase → Storage → New bucket → **`contracts-wasm`** (privado).
Adicione policy permitindo apenas service_role (Edge Function vai usar).

### 3. Build + Upload

```bash
./scripts/build-all.sh
./scripts/upload-wasms.sh
```

### 4. Deploy de Edge Function

```bash
cd ../apps/contractease/supabase
supabase functions deploy deploy-soroban
```

### 5. Migration do DB

```bash
supabase db push  # aplica 20260526120000_add_soroban_deployment_columns.sql
```

### 6. Testar deploy a partir do frontend

```typescript
import { deployContract, sc } from '@/services/sorobanDeploy';

await deployContract({
  contractId: 'uuid-do-doc',
  templateId: 'rent',
  initArgs: [
    sc.struct({
      landlord: sc.addr('G...'),
      tenant: sc.addr('G...'),
      asset: sc.addr('CB...'),     // endereço BRZ
      monthly_rent: sc.i128('25000000000'),    // 2500 BRZ em stroops
      deposit_months: sc.u32(3),
      due_day: sc.u32(5),
      duration_months: sc.u32(30),
      late_fee_bps: sc.u32(200),
      max_consecutive_overdue: sc.u32(3),
      property_hash: sc.bytes('ab12...'),
    }),
  ],
});
```

## Token BRZ na Testnet

O contrato BRZ oficial mantido pela Transfero está deployado em:

| Rede     | Address                                                       |
|----------|---------------------------------------------------------------|
| Testnet  | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` *  |
| Mainnet  | (a confirmar com Transfero antes do go-live)                   |

> ⚠️ * Endereço placeholder — **verificar com a Transfero antes de usar**. Caso
> a BRZ ainda não tenha SAC token na testnet, criamos um Stellar Asset Contract
> com `stellar contract asset deploy --asset BRZ:G<emissor>` e usamos como mock.

## Decisões de Design

### Por que workspace Cargo?

Cada contrato precisa ser um **`cdylib` independente** para gerar seu próprio
WASM. O workspace compartilha `Cargo.lock` e dependências (`soroban-sdk` em
`workspace.dependencies`), garantindo versões consistentes entre todos.

### Por que evitar iteração de storage?

Soroban **não permite** iterar mapas/listas no storage por questões de
custo determinístico. Por isso o `real-estate-vault` usa **Merkle proofs**:
o sponsor publica apenas o `root` da árvore de alocações, e cada holder
reclama provando inclusão. O snapshot é mantido off-chain (indexer).

### Por que `i128` em stroops?

Padrão Stellar: todo valor numérico é multiplicado por 10⁷ (7 casas decimais).
O frontend converte para exibição. `i128` evita overflow em valores grandes
(ex: tokenização imobiliária com bilhões de stroops).

### Erros tipados

Cada contrato define um enum `*Error` com discriminantes a partir do 100.
Erros comuns (1-99) vivem em `common::CommonError`. O frontend mapeia o
discriminante para mensagens user-friendly em pt-BR.

## Próximos passos

- [ ] Pipeline CI: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`
- [ ] Auditoria externa de cada contrato antes de mainnet
- [ ] Mock do BRZ confirmado com Transfero (mainnet)
- [ ] Compliance jurídico do `real-estate-token` (CVM 88)

## Licença

Apache-2.0
