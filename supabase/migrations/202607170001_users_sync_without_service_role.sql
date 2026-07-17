-- Allow profile synchronization with the authenticated user's JWT.
-- No service role key is required for /api/users/sync.

alter table public.users enable row level security;

grant select on public.role to authenticated;
grant select, insert, update on public.users to authenticated;

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

create or replace function public.locataire_role_id()
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.role where name = 'locataire';
$$;

revoke all on function public.locataire_role_id() from public;
grant execute on function public.locataire_role_id() to authenticated;

drop policy if exists "users_select_own_or_admin" on public.users;
create policy "users_select_own_or_admin" on public.users
for select
using (
  auth.uid() = id
  or public.current_user_is_admin()
);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
for insert
with check (
  auth.uid() = id
  and role_id = public.locataire_role_id()
);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role_id = public.current_user_role_id()
);

drop policy if exists "users_admin_update" on public.users;
create policy "users_admin_update" on public.users
for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());
