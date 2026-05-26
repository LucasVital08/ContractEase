create or replace function public.get_public_profile(handle_or_id text)
returns table (
  id uuid,
  name text,
  handle text,
  avatar_url text,
  cover_url text,
  bio text,
  location text,
  website text,
  linkedin_url text,
  github_url text,
  twitter_url text,
  job_title text,
  verification_level text,
  verification_badges jsonb,
  trust_score integer,
  followers_count integer,
  following_count integer,
  wallet_address text,
  email text,
  phone text,
  plan text,
  created_at timestamptz,
  is_followed_by_me boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
  privacy jsonb;
  viewer uuid;
begin
  viewer := auth.uid();

  if handle_or_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select p.id into target_id
      from public.profiles p
     where p.id = handle_or_id::uuid;
  else
    select p.id into target_id
      from public.profiles p
     where lower(p.handle) = lower(regexp_replace(handle_or_id, '^@', ''));
  end if;

  if target_id is null then
    return;
  end if;

  if viewer is null or viewer != target_id then
    update public.profiles
       set profile_views = public.profiles.profile_views + 1
     where public.profiles.id = target_id;
  end if;

  select coalesce(p.privacy_settings, '{}'::jsonb)
    into privacy
    from public.profiles p
   where p.id = target_id;

  return query
  select
    p.id,
    p.name,
    p.handle,
    p.avatar_url,
    p.cover_url,
    p.bio,
    p.location,
    p.website,
    p.linkedin_url,
    p.github_url,
    p.twitter_url,
    p.job_title,
    p.verification_level,
    p.verification_badges,
    p.trust_score,
    case when coalesce((privacy->>'show_followers')::boolean, true) or viewer = target_id
         then p.followers_count else 0 end,
    case when coalesce((privacy->>'show_followers')::boolean, true) or viewer = target_id
         then p.following_count else 0 end,
    case when coalesce((privacy->>'show_wallet')::boolean, true) or viewer = target_id
         then p.wallet_address else null end,
    case when coalesce((privacy->>'show_email')::boolean, false) or viewer = target_id
         then p.email else null end,
    case when coalesce((privacy->>'show_phone')::boolean, false) or viewer = target_id
         then p.phone else null end,
    p.plan,
    p.created_at,
    case when viewer is null then false
         else exists (
           select 1 from public.profile_followers f
            where f.follower_id = viewer and f.following_id = target_id
         ) end
  from public.profiles p
  where p.id = target_id
    and p.public_profile = true;
end;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;