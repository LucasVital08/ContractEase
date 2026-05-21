-- Allow the contract creator to look up other users' profile IDs by e-mail,
-- so that in-app notifications (e.g. "Convite para Assinar") can be inserted
-- against the recipient's user_id.
--
-- Without this, the lookup goes through the "Users can view own profile"
-- RLS policy and only returns the caller's own row — making cross-user
-- notification delivery impossible from the client.

CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  handle text,
  name text,
  email text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.handle, p.name, p.email, p.avatar_url
  FROM public.profiles p
  WHERE lower(p.email) = lower(coalesce(p_email, ''))
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_profile_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_profile_by_email(text) TO authenticated;
