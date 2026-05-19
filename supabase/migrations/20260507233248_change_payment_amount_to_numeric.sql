-- Change payments.amount from integer to numeric for precision
ALTER TABLE public.payments ALTER COLUMN amount TYPE numeric USING amount::numeric;
