-- Fix mutable search_path on all public functions (prevents schema hijacking)
ALTER FUNCTION public.increment_template_usage(template_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.confirm_stellar_payment(uuid, uuid, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_otp(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_otp(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_otp(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_otp(uuid, text, text, text) SET search_path = public, pg_temp;
