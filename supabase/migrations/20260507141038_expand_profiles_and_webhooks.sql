-- Expand profiles with plan, credits, wallet; payments with stellar columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS credits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS abacate_customer_id text,
  ADD COLUMN IF NOT EXISTS abacate_subscription_id text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stellar_memo text UNIQUE,
  ADD COLUMN IF NOT EXISTS stellar_tx_hash text;
