-- Add credits_added to payments (stellar payment credits tracking)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS credits_added integer;
