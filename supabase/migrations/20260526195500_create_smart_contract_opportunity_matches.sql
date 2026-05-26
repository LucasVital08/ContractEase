create table if not exists public.smart_contract_opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.smart_contract_opportunities(id) on delete cascade,
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  executor_id uuid not null references public.profiles(id) on delete cascade,
  accepted_by_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'matched' check (status in ('matched', 'contract_drafting', 'contract_sent', 'closed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  matched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smart_contract_opportunity_matches_distinct_parties
    check (contractor_id <> executor_id)
);

create index if not exists idx_smart_contract_opportunity_matches_contractor
  on public.smart_contract_opportunity_matches (contractor_id, matched_at desc);

create index if not exists idx_smart_contract_opportunity_matches_executor
  on public.smart_contract_opportunity_matches (executor_id, matched_at desc);

alter table public.smart_contract_opportunity_matches enable row level security;

drop policy if exists "opportunity_matches_read_participants" on public.smart_contract_opportunity_matches;
create policy "opportunity_matches_read_participants" on public.smart_contract_opportunity_matches
  for select to authenticated
  using (auth.uid() in (contractor_id, executor_id));

create or replace function public.touch_smart_contract_opportunity_match()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_smart_contract_opportunity_match on public.smart_contract_opportunity_matches;
create trigger trg_touch_smart_contract_opportunity_match
  before update on public.smart_contract_opportunity_matches
  for each row execute function public.touch_smart_contract_opportunity_match();

create or replace function public.accept_smart_contract_opportunity(p_opportunity_id uuid)
returns table (
  match_id uuid,
  opportunity_id uuid,
  opportunity_status text,
  contractor_id uuid,
  contractor_name text,
  contractor_handle text,
  executor_id uuid,
  executor_name text,
  executor_handle text,
  accepted_by_id uuid,
  matched_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  viewer uuid := auth.uid();
  opportunity_row public.smart_contract_opportunities%rowtype;
  match_row public.smart_contract_opportunity_matches%rowtype;
begin
  if viewer is null then
    raise exception 'Você precisa estar autenticado para aceitar uma oportunidade.';
  end if;

  select *
    into opportunity_row
    from public.smart_contract_opportunities
   where id = p_opportunity_id
   for update;

  if not found or coalesce(opportunity_row.is_public, true) = false then
    raise exception 'Oportunidade não encontrada.';
  end if;

  if opportunity_row.status <> 'open' then
    raise exception 'Essa oportunidade já foi aceita ou não está mais disponível.';
  end if;

  if opportunity_row.owner_id = viewer then
    raise exception 'Você não pode aceitar a sua própria oportunidade.';
  end if;

  insert into public.smart_contract_opportunity_matches (
    opportunity_id,
    contractor_id,
    executor_id,
    accepted_by_id,
    status,
    metadata
  ) values (
    opportunity_row.id,
    case when opportunity_row.opportunity_type = 'request' then opportunity_row.owner_id else viewer end,
    case when opportunity_row.opportunity_type = 'request' then viewer else opportunity_row.owner_id end,
    viewer,
    'matched',
    jsonb_build_object(
      'opportunity_type', opportunity_row.opportunity_type,
      'service_category', opportunity_row.service_category,
      'template_id', opportunity_row.template_id
    )
  )
  returning * into match_row;

  update public.smart_contract_opportunities
     set status = 'matched',
         metadata = coalesce(public.smart_contract_opportunities.metadata, '{}'::jsonb)
           || jsonb_build_object(
             'match_id', match_row.id,
             'accepted_by_id', viewer,
             'accepted_at', match_row.matched_at,
             'contractor_id', match_row.contractor_id,
             'executor_id', match_row.executor_id
           )
   where public.smart_contract_opportunities.id = opportunity_row.id;

  return query
  select
    match_row.id,
    opportunity_row.id,
    'matched'::text,
    contractor.id,
    contractor.name,
    contractor.handle,
    executor.id,
    executor.name,
    executor.handle,
    match_row.accepted_by_id,
    match_row.matched_at
  from public.profiles contractor
  join public.profiles executor on executor.id = match_row.executor_id
  where contractor.id = match_row.contractor_id;

exception
  when unique_violation then
    raise exception 'Essa oportunidade já foi aceita por outra pessoa.';
end;
$$;

revoke execute on function public.accept_smart_contract_opportunity(uuid) from public;
grant execute on function public.accept_smart_contract_opportunity(uuid) to authenticated;

comment on table public.smart_contract_opportunity_matches is 'Matches fechados entre contratante e executor a partir do feed de oportunidades.';