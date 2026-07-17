-- Moderation, rental request decisions and contract termination metadata.
-- Enum values are committed here before the workflow migration. Historical
-- conflicts are normalized in place; no request or contract row is deleted.

do $$
begin
  create type public.publication_status as enum ('en_attente', 'validee', 'rejetee');
exception
  when duplicate_object then null;
end $$;

alter type public.contract_status add value if not exists 'resiliation_programmee';
alter type public.contract_status add value if not exists 'resilie';

alter table public.houses add column if not exists publication_status public.publication_status;
alter table public.houses add column if not exists publication_reviewed_at timestamptz;
alter table public.houses add column if not exists publication_reviewed_by uuid;
alter table public.houses add column if not exists publication_rejection_reason text;
alter table public.houses add column if not exists current_tenant_id uuid;
alter table public.houses add column if not exists current_contract_id uuid;

-- Existing listings keep their historical public visibility. New rows wait
-- for an explicit administrator decision.
update public.houses
set publication_status = 'validee',
    publication_reviewed_at = coalesce(publication_reviewed_at, created_at, now())
where publication_status is null;

alter table public.houses alter column publication_status set default 'en_attente';
alter table public.houses alter column publication_status set not null;

update public.houses house
set publication_reviewed_by = null
where publication_reviewed_by is not null
  and not exists (
    select 1 from public.users app_user
    where app_user.id = house.publication_reviewed_by
  );

update public.houses house
set current_tenant_id = null
where current_tenant_id is not null
  and not exists (
    select 1 from public.users app_user
    where app_user.id = house.current_tenant_id
  );

do $$
begin
  alter table public.houses
    add constraint houses_publication_reviewed_by_fkey
    foreign key (publication_reviewed_by) references public.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.houses
    add constraint houses_current_tenant_id_fkey
    foreign key (current_tenant_id) references public.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table public.rental_requests add column if not exists decided_at timestamptz;
alter table public.rental_requests add column if not exists decided_by uuid;
alter table public.rental_requests add column if not exists decision_reason text;
alter table public.rental_requests add column if not exists cancelled_at timestamptz;
alter table public.rental_requests add column if not exists updated_at timestamptz not null default now();

update public.rental_requests request
set decided_by = null
where decided_by is not null
  and not exists (
    select 1 from public.users app_user
    where app_user.id = request.decided_by
  );

do $$
begin
  alter table public.rental_requests
    add constraint rental_requests_decided_by_fkey
    foreign key (decided_by) references public.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

-- Normalize historical labels instead of blocking an existing database.
alter table public.rental_requests
  drop constraint if exists rental_requests_status_check;

update public.rental_requests
set
  decision_reason = case
    when lower(trim(status::text)) not in (
      'en_attente', 'en attente', 'pending',
      'approuvee', 'approuvée', 'acceptee', 'acceptée', 'approved',
      'rejetee', 'rejetée', 'refusee', 'refusée', 'rejected',
      'annulee', 'annulée', 'cancelled', 'canceled'
    )
      then coalesce(
        decision_reason,
        'Statut historique normalisé pendant la migration : ' || coalesce(status::text, 'NULL')
      )
    else decision_reason
  end,
  status = case
    when lower(trim(status::text)) in ('en_attente', 'en attente', 'pending') then 'en_attente'
    when lower(trim(status::text)) in ('approuvee', 'approuvée', 'acceptee', 'acceptée', 'approved') then 'approuvee'
    when lower(trim(status::text)) in ('rejetee', 'rejetée', 'refusee', 'refusée', 'rejected') then 'rejetee'
    else 'annulee'
  end,
  cancelled_at = case
    when lower(trim(status::text)) in (
      'en_attente', 'en attente', 'pending',
      'approuvee', 'approuvée', 'acceptee', 'acceptée', 'approved',
      'rejetee', 'rejetée', 'refusee', 'refusée', 'rejected'
    ) then cancelled_at
    else coalesce(cancelled_at, now())
  end,
  updated_at = now()
where status is null
   or status::text not in ('en_attente', 'approuvee', 'rejetee', 'annulee');

-- Keep the newest pending request for each tenant/house pair and preserve
-- older duplicates as cancelled history.
with ranked_pending_requests as (
  select
    id,
    row_number() over (
      partition by house_id, tenant_id
      order by created_at desc nulls last, id desc
    ) as position
  from public.rental_requests
  where status = 'en_attente'
)
update public.rental_requests request
set
  status = 'annulee',
  cancelled_at = coalesce(request.cancelled_at, now()),
  decision_reason = coalesce(
    request.decision_reason,
    'Demande en attente dupliquée annulée automatiquement pendant la migration.'
  ),
  updated_at = now()
from ranked_pending_requests ranked
where request.id = ranked.id
  and ranked.position > 1;

alter table public.rental_requests
  add constraint rental_requests_status_check
  check (status::text in ('en_attente', 'approuvee', 'rejetee', 'annulee'));

create unique index if not exists rental_requests_one_pending_per_tenant_house
  on public.rental_requests (house_id, tenant_id)
  where status = 'en_attente';

alter table public.contracts add column if not exists contract_title text;
alter table public.contracts add column if not exists contract_body text;
alter table public.contracts add column if not exists contract_deposit numeric(12,2);
alter table public.contracts add column if not exists contract_payment_terms text;
alter table public.contracts add column if not exists contract_special_terms text;
alter table public.contracts add column if not exists agreed_by_owner_at timestamptz;
alter table public.contracts add column if not exists agreed_by_tenant_at timestamptz;
alter table public.contracts add column if not exists signed_by_owner_at timestamptz;
alter table public.contracts add column if not exists signed_by_tenant_at timestamptz;
alter table public.contracts add column if not exists contract_request_id uuid;
alter table public.contracts add column if not exists termination_effective_date date;
alter table public.contracts add column if not exists termination_reason text;
alter table public.contracts add column if not exists termination_note text;
alter table public.contracts add column if not exists termination_requested_at timestamptz;
alter table public.contracts add column if not exists termination_requested_by uuid;
alter table public.contracts add column if not exists terminated_at timestamptz;
alter table public.contracts add column if not exists terminated_by uuid;

update public.contracts contract
set
  contract_title = coalesce(contract.contract_title, house.contract_title),
  contract_body = coalesce(contract.contract_body, house.contract_body),
  contract_deposit = coalesce(contract.contract_deposit, house.contract_deposit),
  contract_payment_terms = coalesce(contract.contract_payment_terms, house.contract_payment_terms),
  contract_special_terms = coalesce(contract.contract_special_terms, house.contract_special_terms)
from public.houses house
where house.id = contract.house_id;

update public.contracts contract
set contract_request_id = null
where contract_request_id is not null
  and not exists (
    select 1 from public.rental_requests request
    where request.id = contract.contract_request_id
  );

update public.houses house
set current_contract_id = null
where current_contract_id is not null
  and not exists (
    select 1 from public.contracts contract
    where contract.id = house.current_contract_id
      and contract.house_id = house.id
  );

update public.contracts contract
set termination_requested_by = null
where termination_requested_by is not null
  and not exists (
    select 1 from public.users app_user
    where app_user.id = contract.termination_requested_by
  );

update public.contracts contract
set terminated_by = null
where terminated_by is not null
  and not exists (
    select 1 from public.users app_user
    where app_user.id = contract.terminated_by
  );

-- A historical request may have been linked to several contracts. Keep the
-- strongest/latest link and detach the others without deleting any contract.
with ranked_request_contracts as (
  select
    id,
    row_number() over (
      partition by contract_request_id
      order by
        case status::text
          when 'resiliation_programmee' then 6
          when 'signe' then 5
          when 'pret_a_signer' then 4
          when 'brouillon' then 3
          when 'resilie' then 2
          else 1
        end desc,
        created_at desc nulls last,
        id desc
    ) as position
  from public.contracts
  where contract_request_id is not null
)
update public.contracts contract
set contract_request_id = null
from ranked_request_contracts ranked
where contract.id = ranked.id
  and ranked.position > 1;

do $$
begin
  alter table public.contracts
    add constraint contracts_contract_request_id_fkey
    foreign key (contract_request_id) references public.rental_requests(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.houses
    add constraint houses_current_contract_id_fkey
    foreign key (current_contract_id) references public.contracts(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.contracts
    add constraint contracts_termination_requested_by_fkey
    foreign key (termination_requested_by) references public.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.contracts
    add constraint contracts_terminated_by_fkey
    foreign key (terminated_by) references public.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists contracts_one_per_request
  on public.contracts (contract_request_id)
  where contract_request_id is not null;

create index if not exists houses_public_catalog_idx
  on public.houses (publication_status, status, created_at desc);

create index if not exists rental_requests_house_status_idx
  on public.rental_requests (house_id, status, created_at desc);

create index if not exists rental_requests_tenant_status_idx
  on public.rental_requests (tenant_id, status, created_at desc);

create index if not exists contracts_termination_due_idx
  on public.contracts (termination_effective_date)
  where termination_effective_date is not null;
