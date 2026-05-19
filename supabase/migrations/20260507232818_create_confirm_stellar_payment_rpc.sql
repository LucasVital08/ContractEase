-- Idempotent: confirm_stellar_payment already created in infrastructure_boost
-- This migration ensures the function exists with correct permissions
GRANT EXECUTE ON FUNCTION public.confirm_stellar_payment(uuid, uuid, integer, text) TO authenticated;
