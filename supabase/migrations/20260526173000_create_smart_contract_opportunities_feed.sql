-- Marketplace/feed de oportunidades para smart contracts.
-- Substitui a ideia de posts genéricos por demandas e disponibilidades
-- profissionais que podem ser convertidas direto em fluxo contratual.

alter table public.profile_activity
  drop constraint if exists profile_activity_activity_type_check;

alter table public.profile_activity
  add constraint profile_activity_activity_type_check
  check (activity_type in (
    'signed_contract','created_contract','completed_contract',
    'verified_email','verified_phone','verified_wallet','verified_kyc',
    'earned_badge','joined_platform','published_template','published_opportunity'
  ));

create table if not exists public.smart_contract_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_type text not null check (opportunity_type in ('offer', 'request')),
  title text not null,
  summary text not null,
  service_category text not null,
  template_id text not null,
  reward_amount numeric(12,2),
  reward_asset text not null default 'BRZ',
  payout_mode text not null default 'fixed' check (payout_mode in ('fixed', 'milestone', 'hourly', 'success_fee')),
  engagement_type text not null default 'one_off' check (engagement_type in ('one_off', 'recurring', 'milestone')),
  location text,
  remote_allowed boolean not null default true,
  status text not null default 'open' check (status in ('open', 'matched', 'in_progress', 'completed', 'cancelled')),
  is_public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_smart_contract_opportunities_feed
  on public.smart_contract_opportunities (status, created_at desc)
  where is_public = true;

create index if not exists idx_smart_contract_opportunities_owner
  on public.smart_contract_opportunities (owner_id, created_at desc);

create index if not exists idx_smart_contract_opportunities_service
  on public.smart_contract_opportunities (service_category, opportunity_type);

alter table public.smart_contract_opportunities enable row level security;

drop policy if exists "opportunities_read_public" on public.smart_contract_opportunities;
create policy "opportunities_read_public" on public.smart_contract_opportunities
  for select using (is_public = true);

drop policy if exists "opportunities_insert_self" on public.smart_contract_opportunities;
create policy "opportunities_insert_self" on public.smart_contract_opportunities
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "opportunities_update_self" on public.smart_contract_opportunities;
create policy "opportunities_update_self" on public.smart_contract_opportunities
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "opportunities_delete_self" on public.smart_contract_opportunities;
create policy "opportunities_delete_self" on public.smart_contract_opportunities
  for delete to authenticated
  using (owner_id = auth.uid());

create or replace function public.touch_smart_contract_opportunity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_smart_contract_opportunity on public.smart_contract_opportunities;
create trigger trg_touch_smart_contract_opportunity
  before update on public.smart_contract_opportunities
  for each row execute function public.touch_smart_contract_opportunity();

create or replace function public.log_smart_contract_opportunity_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.is_public, true) then
    insert into public.profile_activity (
      user_id,
      activity_type,
      ref_id,
      ref_type,
      message,
      metadata,
      is_public
    ) values (
      new.owner_id,
      'published_opportunity',
      new.id::text,
      'smart_contract_opportunity',
      format('Publicou a oportunidade "%s"', new.title),
      jsonb_build_object(
        'opportunity_type', new.opportunity_type,
        'service_category', new.service_category,
        'template_id', new.template_id,
        'reward_amount', new.reward_amount,
        'reward_asset', new.reward_asset,
        'payout_mode', new.payout_mode,
        'status', new.status
      ),
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_smart_contract_opportunity_activity on public.smart_contract_opportunities;
create trigger trg_log_smart_contract_opportunity_activity
  after insert on public.smart_contract_opportunities
  for each row execute function public.log_smart_contract_opportunity_activity();

create or replace function public.get_smart_contract_opportunity_feed(
  p_limit int default 24,
  p_kind text default null,
  p_service_category text default null,
  p_handle text default null,
  p_status text default 'open'
)
returns table (
  id uuid,
  owner_id uuid,
  opportunity_type text,
  title text,
  summary text,
  service_category text,
  template_id text,
  reward_amount numeric,
  reward_asset text,
  payout_mode text,
  engagement_type text,
  location text,
  remote_allowed boolean,
  status text,
  is_public boolean,
  metadata jsonb,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  owner_name text,
  owner_handle text,
  owner_avatar_url text,
  owner_job_title text,
  owner_verification_level text,
  owner_trust_score integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with handle_filter as (
    select lower(regexp_replace(coalesce(p_handle, ''), '^@+', '')) as handle_key
  )
  select
    o.id,
    o.owner_id,
    o.opportunity_type,
    o.title,
    o.summary,
    o.service_category,
    o.template_id,
    o.reward_amount,
    o.reward_asset,
    o.payout_mode,
    o.engagement_type,
    o.location,
    o.remote_allowed,
    o.status,
    o.is_public,
    o.metadata,
    o.expires_at,
    o.created_at,
    o.updated_at,
    p.name as owner_name,
    p.handle as owner_handle,
    p.avatar_url as owner_avatar_url,
    p.job_title as owner_job_title,
    p.verification_level as owner_verification_level,
    coalesce(p.trust_score, 0) as owner_trust_score
  from public.smart_contract_opportunities o
  join public.profiles p on p.id = o.owner_id
  cross join handle_filter hf
  where o.is_public = true
    and p.public_profile = true
    and (p_kind is null or p_kind = '' or o.opportunity_type = p_kind)
    and (p_status is null or p_status = '' or o.status = p_status)
    and (
      p_service_category is null
      or p_service_category = ''
      or o.service_category ilike '%' || p_service_category || '%'
    )
    and (
      hf.handle_key = ''
      or p.handle = hf.handle_key
    )
  order by o.created_at desc
  limit greatest(coalesce(p_limit, 24), 1);
$$;

revoke execute on function public.get_smart_contract_opportunity_feed(int, text, text, text, text) from public;
grant execute on function public.get_smart_contract_opportunity_feed(int, text, text, text, text) to anon, authenticated;

comment on table public.smart_contract_opportunities is 'Feed/marketplace de oportunidades convertíveis em smart contracts.';