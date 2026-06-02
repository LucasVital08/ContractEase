-- Welcome credits: 50 free credits for every new and existing account.
--
-- Default was 0, so accounts created without an explicit credits grant
-- (like Gabriel @aks_empreendimento) ended up at 0 while older accounts
-- that had been manually topped up (like Lucas @lucas) showed 50.

-- 1. Bump the default so any future profile starts at 50.
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 50;

-- 2. Backfill: anyone currently sitting at 0 (or NULL) gets the same
--    welcome bonus. We keep accounts that were intentionally topped up
--    higher than 50 untouched.
UPDATE public.profiles
SET credits = 50, updated_at = now()
WHERE COALESCE(credits, 0) = 0;
