-- Handle (@username) support for profiles
-- Allows referencing users by @handle in contracts and notifications,
-- so that mentioning a registered user automatically routes signing
-- invites to their in-app inbox and registered e-mail address.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_handle_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_format
  CHECK (handle IS NULL OR handle ~ '^[a-z][a-z0-9_]{1,30}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_handle
  ON public.profiles(handle) WHERE handle IS NOT NULL;

-- Public-safe handle lookup that bypasses the strict "view own profile" RLS.
-- Returns the minimal contact info needed to notify a user mentioned by @handle.
-- Only authenticated users can call it, so handles cannot be enumerated by anon.
CREATE OR REPLACE FUNCTION public.lookup_profile_by_handle(p_handle text)
RETURNS TABLE (
  id uuid,
  handle text,
  name text,
  email text,
  avatar_url text,
  wallet_address text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.handle, p.name, p.email, p.avatar_url, p.wallet_address
  FROM public.profiles p
  WHERE p.handle = lower(regexp_replace(coalesce(p_handle, ''), '^@+', ''))
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_handle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_handle(text) TO authenticated;

-- Autocomplete helper — returns up to N matches by handle prefix or name substring.
CREATE OR REPLACE FUNCTION public.search_profile_handles(p_query text, p_limit int DEFAULT 6)
RETURNS TABLE (
  id uuid,
  handle text,
  name text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT lower(regexp_replace(coalesce(p_query, ''), '^@+', '')) AS k
  )
  SELECT p.id, p.handle, p.name, p.avatar_url
  FROM public.profiles p, q
  WHERE p.handle IS NOT NULL
    AND (
      q.k = ''
      OR p.handle ILIKE q.k || '%'
      OR p.name ILIKE '%' || q.k || '%'
    )
  ORDER BY (p.handle = q.k) DESC,
           (p.handle ILIKE q.k || '%') DESC,
           p.handle
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.search_profile_handles(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profile_handles(text, int) TO authenticated;

-- Seed a default handle for new users from the local-part of their e-mail,
-- so onboarding doesn't require an extra step. Collisions fall back to NULL
-- and the user can pick a handle later from the profile settings screen.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp' AS $$
DECLARE
  candidate text;
BEGIN
  candidate := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '_', 'g'));
  IF candidate !~ '^[a-z]' THEN
    candidate := 'u_' || candidate;
  END IF;
  candidate := substr(candidate, 1, 31);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate) THEN
    candidate := NULL;
  END IF;

  INSERT INTO public.profiles (id, name, email, avatar_url, handle)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    candidate
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name);
  RETURN NEW;
END; $$;
