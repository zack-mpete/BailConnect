-- Keep public property data readable without exposing private profile fields,
-- and prevent users from assigning themselves an elevated role.

-- Some existing projects were initialized before contract management fields
-- were added. Keep this migration rerunnable and independent from that state.
alter table public.houses add column if not exists district text;
alter table public.houses add column if not exists address text;
alter table public.houses add column if not exists latitude double precision;
alter table public.houses add column if not exists longitude double precision;
alter table public.houses add column if not exists image_url text;
alter table public.houses add column if not exists features text[] default '{}';
alter table public.houses add column if not exists current_tenant_id uuid;
alter table public.houses add column if not exists current_contract_id uuid;
alter table public.houses add column if not exists contract_duration_months int not null default 12;
alter table public.houses add column if not exists contract_deposit numeric(12,2);
alter table public.houses add column if not exists contract_payment_terms text;
alter table public.houses add column if not exists contract_special_terms text;
alter table public.houses add column if not exists contract_title text;
alter table public.houses add column if not exists contract_body text;

do $$
begin
  alter table public.houses
    add constraint houses_current_tenant_id_fkey
    foreign key (current_tenant_id) references public.users(id) on delete set null;
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

revoke select on public.users from anon;
grant select (id, full_name) on public.users to anon;
grant select on public.users to authenticated;

revoke select on public.houses from anon;
grant select (
  id,
  owner_id,
  title,
  description,
  city,
  commune,
  district,
  address,
  latitude,
  longitude,
  price,
  rooms,
  type,
  status,
  image_url,
  features,
  contract_duration_months,
  contract_deposit,
  contract_payment_terms,
  contract_special_terms,
  contract_title,
  contract_body,
  created_at
) on public.houses to anon;
grant select on public.houses to authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    join public.role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.current_user_role_id()
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select role_id from public.users where id = auth.uid();
$$;

revoke all on function public.current_user_role_id() from public;
grant execute on function public.current_user_role_id() to authenticated;

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
for insert
with check (
  auth.uid() = id
  and role_id = (select id from public.role where name = 'locataire')
);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id and role_id = public.current_user_role_id());

drop policy if exists "users_admin_update" on public.users;
create policy "users_admin_update" on public.users
for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());
