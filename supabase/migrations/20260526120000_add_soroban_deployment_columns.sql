-- ─────────────────────────────────────────────────────────────────────
-- Adiciona colunas para rastreabilidade de deploys Soroban nos contratos.
--
-- Cada contrato que vira smart contract on-chain ganha:
--   - soroban_contract_address: o C... onde mora a instância
--   - soroban_wasm_hash:        hash do WASM utilizado (para auditoria)
--   - soroban_deploy_tx / soroban_init_tx: hashes das transações de deploy
--   - soroban_network:          'testnet' | 'mainnet'
--   - soroban_deployed_at:      timestamp do deploy
--   - soroban_template_id:      template usado (rent, ecommerce, etc.)
-- ─────────────────────────────────────────────────────────────────────

alter table public.contracts
  add column if not exists soroban_contract_address text,
  add column if not exists soroban_wasm_hash text,
  add column if not exists soroban_deploy_tx text,
  add column if not exists soroban_init_tx text,
  add column if not exists soroban_network text check (soroban_network in ('testnet', 'mainnet')),
  add column if not exists soroban_deployed_at timestamptz,
  add column if not exists soroban_template_id text;

-- Index para lookup rápido por endereço do contrato
create index if not exists idx_contracts_soroban_address
  on public.contracts (soroban_contract_address)
  where soroban_contract_address is not null;

-- Index por template (analytics de uso por tipo de smart contract)
create index if not exists idx_contracts_soroban_template
  on public.contracts (soroban_template_id)
  where soroban_template_id is not null;

comment on column public.contracts.soroban_contract_address is
  'Endereço C... do contrato Soroban deployado. Null = ainda não foi para a chain.';

comment on column public.contracts.soroban_wasm_hash is
  'Hash do WASM (hex) usado no deploy. Permite verificar integridade do bytecode.';

comment on column public.contracts.soroban_network is
  'Rede do deploy: testnet (validação) ou mainnet (produção).';
