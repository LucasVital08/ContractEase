# ContractEase

Verifiable contracts and programmable escrow anchored on the Stellar network.

## What it does

- Upload a document → SHA-256 hash generated client-side → anchored on Stellar via `manageData`
- Issue a verifiable certificate with a public URL anyone can check
- Create escrow via Stellar Claimable Balances — funds released only when conditions are met
- Digital signature flow with multi-party support
- Deploy Soroban smart contracts (rent, e-commerce, freelancer, legal fees, construction, real estate) straight from the app

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + Storage + Edge Functions)
- Stellar SDK (`@stellar/stellar-sdk`)
- Rust + Soroban SDK (smart contracts)

## Repository layout

```
.
├── src/                  # React app
├── supabase/             # migrations + Edge Functions
├── soroban-contracts/    # Soroban smart contracts (Rust workspace)
└── .github/workflows/    # CI (app build + WASM build/upload)
```

## Setup

```bash
npm install
cp .env.example .env
```

Required env vars:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STELLAR_NETWORK=testnet   # or mainnet
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

```bash
npm run dev     # http://localhost:5173
npm run build
```

## Smart contracts (Soroban)

The `soroban-contracts/` Cargo workspace contains the escrow contracts deployed by the app — see [soroban-contracts/README.md](soroban-contracts/README.md) for build, test, and deploy instructions.

```bash
cd soroban-contracts
cargo test --workspace
./scripts/build-all.sh
```
