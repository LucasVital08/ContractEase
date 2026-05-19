# ContractEase

Verifiable contracts and programmable escrow anchored on the Stellar network.

## What it does

- Upload a document → SHA-256 hash generated client-side → anchored on Stellar via `manageData`
- Issue a verifiable certificate with a public URL anyone can check
- Create escrow via Stellar Claimable Balances — funds released only when conditions are met
- Digital signature flow with multi-party support

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + Storage)
- Stellar SDK (`@stellar/stellar-sdk`)

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

## Docs

Full architecture, API reference, and ADRs at `/doc/ai/contractease` on the landing page.
