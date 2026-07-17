-- Landlord-recorded rent payments per property and occupant.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  owner_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid references public.users(id) on delete set null,
  occupant_name text not null,
  amount numeric(12,2) not null,
  period text not null,
  paid_at date not null default current_date,
  method text not null default 'Cash',
  reference text,
  note text,
  created_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_occupant_name_not_blank check (length(trim(occupant_name)) > 0),
  constraint payments_period_not_blank check (length(trim(period)) > 0)
);

create index if not exists payments_house_paid_idx on public.payments (house_id, paid_at desc);
create index if not exists payments_owner_paid_idx on public.payments (owner_id, paid_at desc);
create index if not exists payments_tenant_paid_idx on public.payments (tenant_id, paid_at desc);
create index if not exists payments_contract_idx on public.payments (contract_id);

alter table public.payments enable row level security;

drop policy if exists "payments_participants_read" on public.payments;
create policy "payments_participants_read" on public.payments
for select
using (
  auth.uid() = owner_id
  or auth.uid() = tenant_id
  or exists (
    select 1
    from public.users
    join public.role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  )
);

drop policy if exists "payments_owner_insert" on public.payments;
create policy "payments_owner_insert" on public.payments
for insert
with check (
  (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.users
      join public.role on role.id = users.role_id
      where users.id = auth.uid()
        and role.name = 'admin'
    )
  )
  and exists (
    select 1
    from public.houses
    where houses.id = payments.house_id
      and houses.owner_id = payments.owner_id
  )
  and (
    payments.contract_id is null
    or exists (
      select 1
      from public.contracts
      where contracts.id = payments.contract_id
        and contracts.house_id = payments.house_id
        and contracts.owner_id = payments.owner_id
        and contracts.tenant_id = payments.tenant_id
    )
  )
);

drop policy if exists "payments_owner_update" on public.payments;
create policy "payments_owner_update" on public.payments
for update
using (
  auth.uid() = owner_id
  or exists (
    select 1
    from public.users
    join public.role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  )
)
with check (
  auth.uid() = owner_id
  or exists (
    select 1
    from public.users
    join public.role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  )
);

drop policy if exists "payments_owner_delete" on public.payments;
create policy "payments_owner_delete" on public.payments
for delete
using (
  auth.uid() = owner_id
  or exists (
    select 1
    from public.users
    join public.role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  )
);