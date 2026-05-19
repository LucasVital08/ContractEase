-- OTP system: table + generate/verify functions
CREATE TABLE IF NOT EXISTS public.otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  code text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own OTPs" ON public.otps FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.generate_otp(p_user_id uuid, p_purpose text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_code text;
BEGIN
  DELETE FROM public.otps WHERE user_id = p_user_id AND purpose = p_purpose;
  v_code := lpad(floor(random() * 10000)::text, 4, '0');
  INSERT INTO public.otps (user_id, code, purpose, expires_at) VALUES (p_user_id, v_code, p_purpose, now() + interval '10 minutes');
  RETURN v_code;
END; $$;

CREATE OR REPLACE FUNCTION public.verify_otp(p_user_id uuid, p_code text, p_purpose text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.otps WHERE user_id = p_user_id AND code = p_code AND purpose = p_purpose AND expires_at > now();
  IF v_count > 0 THEN
    DELETE FROM public.otps WHERE user_id = p_user_id AND purpose = p_purpose;
    RETURN true;
  ELSE RETURN false; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN UPDATE public.templates SET usage_count = usage_count + 1 WHERE id = template_id; END; $$;
