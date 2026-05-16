-- Update OTP table and functions to support email-based OTP (no user_id required)
ALTER TABLE public.otps ADD COLUMN IF NOT EXISTS email text;

CREATE OR REPLACE FUNCTION public.generate_otp(
  p_user_id uuid DEFAULT NULL, p_purpose text DEFAULT 'action_confirmation', p_email text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_code text;
BEGIN
  IF p_user_id IS NOT NULL THEN DELETE FROM public.otps WHERE user_id = p_user_id AND purpose = p_purpose;
  ELSIF p_email IS NOT NULL THEN DELETE FROM public.otps WHERE email = p_email AND purpose = p_purpose; END IF;
  v_code := lpad(floor(random() * 10000)::text, 4, '0');
  INSERT INTO public.otps (user_id, email, code, purpose, expires_at) VALUES (p_user_id, p_email, v_code, p_purpose, now() + interval '10 minutes');
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.verify_otp(
  p_user_id uuid DEFAULT NULL, p_code text DEFAULT NULL, p_purpose text DEFAULT NULL, p_email text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.otps WHERE user_id = p_user_id AND code = p_code AND purpose = p_purpose AND expires_at > now();
  ELSE
    SELECT count(*) INTO v_count FROM public.otps WHERE email = p_email AND code = p_code AND purpose = p_purpose AND expires_at > now();
  END IF;
  IF v_count > 0 THEN
    IF p_user_id IS NOT NULL THEN DELETE FROM public.otps WHERE user_id = p_user_id AND purpose = p_purpose;
    ELSE DELETE FROM public.otps WHERE email = p_email AND purpose = p_purpose; END IF;
    RETURN true;
  ELSE RETURN false; END IF;
END; $$;
