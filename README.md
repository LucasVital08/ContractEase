# ContractEase

Verifiable contracts and programmable escrow anchored on the Stellar network.

## What it does

- Upload a document → SHA-256 hash generated client-side → anchored on Stellar via `manageData`
- Issue a verifiable certificate with a public URL anyone can check
- Create escrow via Stellar Claimable Balances — funds released only when conditions are met
- Digital signature flow with multi-party support
- Deploy Soroban smart contracts (rent, e-commerce, freelancer, legal fees, construction, real estate) straight from the app

## User-facing flow

The app has one main path, four destinations, and no hidden navigation:

`Início` → `Criar contrato` → `Meus contratos` → `Carteira`

`/criar` is a six-step guided wizard (objective → details → people → review →
wallet → on-chain registration). Every step that touches blockchain answers the
same three questions in the same order: **o que é isso**, **por que existe**,
**como fazer**. Everything secondary lives behind "Mais" in the sidebar.

### Wallets

Three providers behind one interface (`src/services/wallet/`):

| Provider | How it works | Networks |
| --- | --- | --- |
| **MetaMask** (recommended) | Stellar support via the [`npm:stellar-snap`](https://github.com/paulfears/StellarSnap) MetaMask Snap, installed once from inside MetaMask | testnet + mainnet |
| **Freighter** | Native Stellar extension, no add-on needed | testnet + mainnet |
| **ContractEase test wallet** | Keypair generated in the browser, funded by Friendbot — lets someone try the whole flow without installing anything | testnet only |

MetaMask does not speak Stellar on its own — the Snap is what bridges it. The
UI states this explicitly rather than hiding it.

Adding a wallet means implementing the `WalletProvider` interface and adding it
to `WALLET_PROVIDERS`; no screen changes.

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

### Demo mode

Runs the whole UI without a backend — useful for reviewing a branch or
recording a walkthrough:

```bash
npm run demo    # abre http://localhost:5173 já logado
```

It loads `.env.demo` (`vite --mode demo`), so it works the same on macOS,
Linux and Windows without extra dependencies.

It signs in a fixed demo user and skips Supabase. The blockchain side stays
real: the test wallet, Friendbot funding, and the on-chain registration all hit
Stellar testnet. Enabled only by this build-time env var — never by URL or
localStorage — so a production build can't enter it.

## Smart contracts (Soroban)

The `soroban-contracts/` Cargo workspace contains the escrow contracts deployed by the app — see [soroban-contracts/README.md](soroban-contracts/README.md) for build, test, and deploy instructions.

```bash
cd soroban-contracts
cargo test --workspace
./scripts/build-all.sh
```
