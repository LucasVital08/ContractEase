-- Final security hardening: REVOKE FROM PUBLIC on all sensitive functions
REVOKE EXECUTE ON FUNCTION public.confirm_stellar_payment(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_otp(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_otp(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_otp(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_otp(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_otp(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_otp(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp(uuid, text, text, text) TO authenticated;
