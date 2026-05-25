-- Backfill missing handles for existing profiles and expose safe lookup/search
-- RPCs that bypass the strict "view own profile" RLS for authenticated users.

DO $$
DECLARE
  rec record;
  candidate text;
  suffix int;
BEGIN
  FOR rec IN
    SELECT id, email, name
    FROM public.profiles
    WHERE handle IS NULL OR handle = ''
    ORDER BY created_at NULLS FIRST, id
  LOOP
    candidate := lower(regexp_replace(split_part(coalesce(rec.email, rec.name, rec.id::text), '@', 1), '[^a-z0-9_]', '_', 'g'));

    IF candidate = '' THEN
      candidate := 'user';
    END IF;

    IF candidate !~ '^[a-z]' THEN
      candidate := 'u_' || candidate;
    END IF;

    candidate := substr(candidate, 1, 31);
    suffix := 1;

    WHILE EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE handle = candidate
        AND id <> rec.id
    ) LOOP
      candidate := substr(regexp_replace(split_part(coalesce(rec.email, rec.name, rec.id::text), '@', 1), '[^a-z0-9_]', '_', 'g'), 1, GREATEST(1, 31 - length(suffix::text) - 1));
      IF candidate = '' THEN
        candidate := 'user';
      END IF;
      IF candidate !~ '^[a-z]' THEN
        candidate := 'u_' || candidate;
      END IF;
      candidate := substr(candidate, 1, GREATEST(1, 31 - length(suffix::text) - 1)) || '_' || suffix::text;
      suffix := suffix + 1;
    END LOOP;

    UPDATE public.profiles
    SET handle = candidate
    WHERE id = rec.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.search_profiles_directory(p_query text, p_limit int DEFAULT 8)
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
  WITH q AS (
    SELECT lower(regexp_replace(coalesce(p_query, ''), '^@+', '')) AS k
  )
  SELECT p.id, p.handle, p.name, p.email, p.avatar_url, p.wallet_address
  FROM public.profiles p, q
  WHERE p.handle IS NOT NULL
    AND (
      q.k = ''
      OR p.handle ILIKE '%' || q.k || '%'
      OR coalesce(p.name, '') ILIKE '%' || q.k || '%'
      OR coalesce(p.email, '') ILIKE '%' || q.k || '%'
    )
  ORDER BY
    (p.handle = q.k) DESC,
    (p.handle ILIKE q.k || '%') DESC,
    (coalesce(p.name, '') ILIKE q.k || '%') DESC,
    (coalesce(p.email, '') ILIKE q.k || '%') DESC,
    p.handle
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.search_profiles_directory(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles_directory(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_profile_by_wallet_address(p_wallet_address text)
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
  WHERE p.wallet_address = p_wallet_address
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_wallet_address(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_wallet_address(text) TO authenticated;