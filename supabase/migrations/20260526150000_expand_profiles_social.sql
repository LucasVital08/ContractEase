-- ─────────────────────────────────────────────────────────────────────
-- Expansão do perfil para "rede social profissional":
--
--   • Banner (cover_url), localização, links externos
--   • Verification levels (none / basic / kyc / notarial)
--   • Verification badges (array de strings: 'email','phone','wallet','kyc','builder')
--   • Trust score (0-100) computado por trigger
--   • Privacy settings granular (mostrar contratos? wallet? atividade?)
--   • Bio promovida a coluna nativa (não mais em settings JSONB)
--
-- Tabelas novas:
--   • profile_activity   — timeline pública
--   • profile_followers  — relação assíncrona (Instagram-style)
--
-- RPCs:
--   • get_public_profile(handle_or_id)
--   • compute_trust_score(uid)
--   • follow_profile / unfollow_profile
-- ─────────────────────────────────────────────────────────────────────

-- ── COLUNAS NOVAS EM PROFILES ────────────────────────────────────────

alter table public.profiles
  add column if not exists cover_url text,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists website text,
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists twitter_url text,
  add column if not exists job_title text,
  add column if not exists verification_level text not null default 'none'
    check (verification_level in ('none','basic','kyc','notarial')),
  add column if not exists verification_badges jsonb not null default '[]'::jsonb,
  add column if not exists trust_score integer not null default 0
    check (trust_score >= 0 and trust_score <= 100),
  add column if not exists public_profile boolean not null default true,
  add column if not exists privacy_settings jsonb not null default jsonb_build_object(
    'show_contracts', true,
    'show_wallet', true,
    'show_email', false,
    'show_phone', false,
    'show_stats', true,
    'show_activity', true,
    'show_followers', true
  ),
  add column if not exists followers_count integer not null default 0,
  add column if not exists following_count integer not null default 0,
  add column if not exists profile_views integer not null default 0;

-- Backfill: copia bio/jobTitle do settings JSONB para colunas nativas
update public.profiles
   set bio = coalesce(bio, settings->>'bio'),
       job_title = coalesce(job_title, settings->>'jobTitle')
 where (bio is null and settings ? 'bio')
    or (job_title is null and settings ? 'jobTitle');

create index if not exists idx_profiles_handle_search
  on public.profiles using gin (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(handle,'') || ' ' || coalesce(bio,'')));

create index if not exists idx_profiles_verification
  on public.profiles (verification_level)
  where verification_level != 'none';

-- ── PROFILE ACTIVITY ─────────────────────────────────────────────────

create table if not exists public.profile_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'signed_contract','created_contract','completed_contract',
    'verified_email','verified_phone','verified_wallet','verified_kyc',
    'earned_badge','joined_platform','published_template'
  )),
  ref_id text,
  ref_type text,
  message text,
  metadata jsonb default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_activity_user
  on public.profile_activity (user_id, created_at desc);

create index if not exists idx_profile_activity_public
  on public.profile_activity (created_at desc)
  where is_public = true;

alter table public.profile_activity enable row level security;

drop policy if exists "profile_activity_read_public" on public.profile_activity;
create policy "profile_activity_read_public" on public.profile_activity
  for select using (
    is_public = true
    or user_id = auth.uid()
  );

drop policy if exists "profile_activity_insert_self" on public.profile_activity;
create policy "profile_activity_insert_self" on public.profile_activity
  for insert with check (user_id = auth.uid());

-- ── PROFILE FOLLOWERS ────────────────────────────────────────────────

create table if not exists public.profile_followers (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

create index if not exists idx_followers_following
  on public.profile_followers (following_id, created_at desc);

create index if not exists idx_followers_follower
  on public.profile_followers (follower_id, created_at desc);

alter table public.profile_followers enable row level security;

drop policy if exists "followers_read_all" on public.profile_followers;
create policy "followers_read_all" on public.profile_followers
  for select using (true);

drop policy if exists "followers_insert_self" on public.profile_followers;
create policy "followers_insert_self" on public.profile_followers
  for insert with check (follower_id = auth.uid());

drop policy if exists "followers_delete_self" on public.profile_followers;
create policy "followers_delete_self" on public.profile_followers
  for delete using (follower_id = auth.uid());

-- ── TRIGGER: MANTÉM CONTADORES SINCRONIZADOS ─────────────────────────

create or replace function public.sync_follower_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_follower_counts on public.profile_followers;
create trigger trg_sync_follower_counts
  after insert or delete on public.profile_followers
  for each row execute function public.sync_follower_counts();

-- ── FUNÇÃO: COMPUTE TRUST SCORE ──────────────────────────────────────
--
-- Score 0-100 ponderado:
--   • email verificado      → 10
--   • phone verificado      → 10
--   • wallet conectada      → 15
--   • KYC completo          → 25
--   • contratos assinados   → 1 ponto por contrato (até 20)
--   • contratos concluidos  → 1 ponto por contrato (até 10)
--   • tempo na plataforma   → 1 ponto por mês (até 10)
--
-- Total possivel: 100

create or replace function public.compute_trust_score(uid uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  score integer := 0;
  badges jsonb;
  signed_count integer;
  completed_count integer;
  months_active integer;
  prof record;
begin
  select * into prof from public.profiles where id = uid;
  if not found then return 0; end if;

  badges := coalesce(prof.verification_badges, '[]'::jsonb);

  if badges ? 'email'  then score := score + 10; end if;
  if badges ? 'phone'  then score := score + 10; end if;
  if badges ? 'wallet' then score := score + 15; end if;
  if badges ? 'kyc'    then score := score + 25; end if;

  select count(*) into signed_count
    from public.contract_parties
   where signer_user_id = uid
     and signed_at is not null;
  score := score + least(coalesce(signed_count, 0), 20);

  select count(*) into completed_count
    from public.contracts c
    join public.contract_parties p on p.contract_id = c.id
   where p.signer_user_id = uid
     and c.status = 'completed';
  score := score + least(coalesce(completed_count, 0), 10);

  months_active := greatest(0, extract(epoch from (now() - prof.created_at)) / (30 * 86400))::integer;
  score := score + least(months_active, 10);

  return least(score, 100);
exception
  when undefined_column or undefined_table then
    -- Tolerante se contract_parties/contracts ainda não tem a coluna esperada
    return score;
end;
$$;

-- ── FUNÇÃO: ATUALIZA TRUST SCORE E NIVEL ─────────────────────────────

create or replace function public.refresh_trust_metrics(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  new_score integer;
  badges jsonb;
  new_level text;
begin
  new_score := public.compute_trust_score(uid);
  select coalesce(verification_badges, '[]'::jsonb) into badges
    from public.profiles where id = uid;

  if badges ? 'kyc' then
    new_level := 'kyc';
  elsif badges ? 'email' and badges ? 'phone' then
    new_level := 'basic';
  else
    new_level := 'none';
  end if;

  update public.profiles
     set trust_score = new_score,
         verification_level = new_level,
         updated_at = now()
   where id = uid;
end;
$$;

-- ── RPC: GET PUBLIC PROFILE ──────────────────────────────────────────
--
-- Retorna o perfil público respeitando `privacy_settings`. Campos privados
-- são NULLificados se o dono não autorizou exibição.

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
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
  privacy jsonb;
  viewer uuid;
begin
  viewer := auth.uid();

  if handle_or_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select p.id into target_id from public.profiles p where p.id = handle_or_id::uuid;
  else
    select p.id into target_id
      from public.profiles p
     where lower(p.handle) = lower(regexp_replace(handle_or_id, '^@', ''));
  end if;

  if target_id is null then
    return;
  end if;

  -- Incrementa contador de visualizações (best-effort)
  if viewer is null or viewer != target_id then
    update public.profiles set profile_views = profile_views + 1 where id = target_id;
  end if;

  select coalesce(p.privacy_settings, '{}'::jsonb) into privacy
    from public.profiles p where p.id = target_id;

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
  where p.id = target_id and p.public_profile = true;
end;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ── RPC: GET PROFILE STATS (estatisticas publicas) ──────────────────

create or replace function public.get_profile_stats(handle_or_id text)
returns table (
  total_signed integer,
  total_created integer,
  total_completed integer,
  total_on_chain integer
)
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
begin
  if handle_or_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    target_id := handle_or_id::uuid;
  else
    select id into target_id from public.profiles
     where lower(handle) = lower(regexp_replace(handle_or_id, '^@', ''));
  end if;

  return query
  select
    (select count(*)::integer from public.contract_parties
      where signer_user_id = target_id and signed_at is not null),
    (select count(*)::integer from public.contracts
      where created_by = target_id),
    (select count(*)::integer from public.contracts c
       join public.contract_parties p on p.contract_id = c.id
      where p.signer_user_id = target_id and c.status = 'completed'),
    (select count(*)::integer from public.contracts c
       join public.contract_parties p on p.contract_id = c.id
      where p.signer_user_id = target_id and c.stellar_tx_hash is not null);
exception
  when undefined_column or undefined_table then
    return query select 0, 0, 0, 0;
end;
$$;

grant execute on function public.get_profile_stats(text) to anon, authenticated;

-- ── RPC: FOLLOW / UNFOLLOW ───────────────────────────────────────────

create or replace function public.follow_profile(target_handle text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then return false; end if;

  select id into target_id from public.profiles
   where lower(handle) = lower(regexp_replace(target_handle, '^@', ''));

  if target_id is null or target_id = auth.uid() then return false; end if;

  insert into public.profile_followers (follower_id, following_id)
  values (auth.uid(), target_id)
  on conflict do nothing;

  return true;
end;
$$;

grant execute on function public.follow_profile(text) to authenticated;

create or replace function public.unfollow_profile(target_handle text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then return false; end if;

  select id into target_id from public.profiles
   where lower(handle) = lower(regexp_replace(target_handle, '^@', ''));

  if target_id is null then return false; end if;

  delete from public.profile_followers
   where follower_id = auth.uid() and following_id = target_id;

  return true;
end;
$$;

grant execute on function public.unfollow_profile(text) to authenticated;

-- ── BUCKETS STORAGE PARA COVER ───────────────────────────────────────
-- (avatars já existe; criamos um bucket para banners)

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- Politicas Storage para covers
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'Public read covers'
  ) then
    create policy "Public read covers" on storage.objects
      for select using (bucket_id = 'covers');
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'Authenticated upload covers'
  ) then
    create policy "Authenticated upload covers" on storage.objects
      for insert with check (bucket_id = 'covers' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'Owner delete covers'
  ) then
    create policy "Owner delete covers" on storage.objects
      for delete using (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;

comment on column public.profiles.cover_url is 'URL pública do banner de perfil (Supabase Storage bucket covers/).';
comment on column public.profiles.trust_score is '0-100 calculado por compute_trust_score(). Atualizado via refresh_trust_metrics().';
comment on column public.profiles.privacy_settings is 'Controle granular do que aparece em get_public_profile().';
