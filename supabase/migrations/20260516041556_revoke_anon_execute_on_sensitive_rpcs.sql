-- Revoke anon access to sensitive RPCs (security hardening)
REVOKE EXECUTE ON FUNCTION public.confirm_stellar_payment(uuid, uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_stellar_payment(uuid, uuid, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_otp(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_otp(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_otp(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_otp(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
