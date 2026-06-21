-- Schema Supabase/PostgreSQL pour LeaseHub RDC.
-- Source de verite utilisateur: public.users.

do $$
begin
  create type app_role as enum ('admin', 'bailleur', 'agence', 'locataire');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type house_status as enum ('Disponible', 'Réservé', 'Loué');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type contract_status as enum ('brouillon', 'pret_a_signer', 'signe', 'annule');
exception
  when duplicate_object then null;
end $$;

alter type house_status add value if not exists 'Archivé';

drop table if exists _users_seed;

create temp table _users_seed (
  id uuid primary key,
  role_id smallint,
  full_name text,
  email text,
  phone text,
  verified boolean,
  created_at timestamptz,
  updated_at timestamptz
) on commit drop;

do $$
declare
  users_role_type text;
begin
  if to_regclass('public.users') is not null then
    select data_type into users_role_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'role_id';

    if users_role_type in ('smallint', 'integer', 'bigint') then
      execute $seed$
        insert into _users_seed (id, role_id, full_name, email, phone, verified, created_at, updated_at)
        select id, role_id::smallint, full_name, email, phone, coalesce(verified, false), coalesce(created_at, now()), coalesce(updated_at, now())
        from public.users
        on conflict (id) do update set
          role_id = coalesce(excluded.role_id, _users_seed.role_id),
          full_name = coalesce(excluded.full_name, _users_seed.full_name),
          email = coalesce(excluded.email, _users_seed.email),
          phone = coalesce(excluded.phone, _users_seed.phone),
          verified = coalesce(excluded.verified, _users_seed.verified),
          created_at = coalesce(excluded.created_at, _users_seed.created_at),
          updated_at = coalesce(excluded.updated_at, _users_seed.updated_at)
      $seed$;
    else
      execute $seed$
        insert into _users_seed (id, role_id, full_name, email, phone, verified, created_at, updated_at)
        select id, null, full_name, email, phone, coalesce(verified, false), coalesce(created_at, now()), coalesce(updated_at, now())
        from public.users
        on conflict (id) do update set
          full_name = coalesce(excluded.full_name, _users_seed.full_name),
          email = coalesce(excluded.email, _users_seed.email),
          phone = coalesce(excluded.phone, _users_seed.phone),
          verified = coalesce(excluded.verified, _users_seed.verified),
          created_at = coalesce(excluded.created_at, _users_seed.created_at),
          updated_at = coalesce(excluded.updated_at, _users_seed.updated_at)
      $seed$;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles add column if not exists email text;
    alter table public.profiles add column if not exists phone text;
    alter table public.profiles add column if not exists verified boolean default false;
    alter table public.profiles add column if not exists created_at timestamptz default now();
    alter table public.profiles add column if not exists updated_at timestamptz default now();

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'role_id'
    ) then
      execute $seed$
        insert into _users_seed (id, role_id, full_name, email, phone, verified, created_at, updated_at)
        select
          id,
          role_id::smallint,
          full_name,
          email,
          phone,
          coalesce(verified, false),
          coalesce(created_at, now()),
          coalesce(updated_at, now())
        from public.profiles
        on conflict (id) do update set
          role_id = coalesce(excluded.role_id, _users_seed.role_id),
          full_name = coalesce(excluded.full_name, _users_seed.full_name),
          email = coalesce(excluded.email, _users_seed.email),
          phone = coalesce(excluded.phone, _users_seed.phone),
          verified = coalesce(excluded.verified, _users_seed.verified),
          created_at = coalesce(excluded.created_at, _users_seed.created_at),
          updated_at = coalesce(excluded.updated_at, _users_seed.updated_at)
      $seed$;
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'role'
    ) then
      execute $seed$
        insert into _users_seed (id, role_id, full_name, email, phone, verified, created_at, updated_at)
        select
          id,
          case role
            when 'admin' then 1
            when 'bailleur' then 2
            when 'agence' then 3
            else 4
          end,
          full_name,
          email,
          phone,
          coalesce(verified, false),
          coalesce(created_at, now()),
          now()
        from public.profiles
        on conflict (id) do update set
          role_id = coalesce(excluded.role_id, _users_seed.role_id),
          full_name = coalesce(excluded.full_name, _users_seed.full_name),
          email = coalesce(excluded.email, _users_seed.email),
          phone = coalesce(excluded.phone, _users_seed.phone),
          verified = coalesce(excluded.verified, _users_seed.verified),
          created_at = coalesce(excluded.created_at, _users_seed.created_at),
          updated_at = coalesce(excluded.updated_at, _users_seed.updated_at)
      $seed$;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.users') is not null then
    if exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = 'users'
        and pg_class.relkind in ('v', 'm')
    ) then
      drop view if exists users cascade;
    else
      drop table if exists users cascade;
    end if;
  end if;
end $$;

drop table if exists profiles cascade;
drop table if exists role cascade;

create table role (
  id smallint primary key,
  name app_role not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into role (id, name, label, description)
values
  (1, 'admin', 'Administrateur', 'Gestion globale de la plateforme'),
  (2, 'bailleur', 'Bailleur', 'Proprietaire qui publie et gere ses biens'),
  (3, 'agence', 'Agence', 'Agence immobiliere qui gere des annonces'),
  (4, 'locataire', 'Locataire', 'Utilisateur qui recherche et loue un logement')
on conflict (id) do update set
  name = excluded.name,
  label = excluded.label,
  description = excluded.description;

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id smallint not null default 4 references role(id),
  full_name text not null,
  email text unique,
  phone text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into users (id, role_id, full_name, email, phone, verified, created_at, updated_at)
select
  id,
  coalesce(role_id, 4),
  coalesce(full_name, split_part(coalesce(email, 'Utilisateur'), '@', 1), 'Utilisateur'),
  email,
  phone,
  coalesce(verified, false),
  coalesce(created_at, now()),
  coalesce(updated_at, now())
from _users_seed
on conflict (id) do update set
  role_id = excluded.role_id,
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  verified = excluded.verified,
  updated_at = now();

create table if not exists houses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  description text not null,
  city text not null,
  commune text not null,
  district text,
  address text,
  latitude double precision,
  longitude double precision,
  price numeric(12,2) not null,
  rooms int not null,
  type text not null,
  status house_status not null default 'Disponible',
  image_url text,
  features text[] default '{}',
  created_at timestamptz not null default now()
);

alter table houses add column if not exists district text;
alter table houses add column if not exists address text;
alter table houses add column if not exists latitude double precision;
alter table houses add column if not exists longitude double precision;

create table if not exists rental_requests (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references houses(id) on delete cascade,
  tenant_id uuid not null,
  message text,
  status text not null default 'en_attente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table rental_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references houses(id) on delete cascade,
  owner_id uuid not null,
  tenant_id uuid not null,
  start_date date not null,
  duration_months int not null default 12,
  rent numeric(12,2) not null,
  status contract_status not null default 'brouillon',
  seal_code text unique not null,
  agreed_by_owner_at timestamptz,
  agreed_by_tenant_at timestamptz,
  signed_by_owner_at timestamptz,
  signed_by_tenant_at timestamptz,
  contract_request_id uuid references rental_requests(id),
  created_at timestamptz not null default now()
);

alter table contracts add column if not exists agreed_by_owner_at timestamptz;
alter table contracts add column if not exists agreed_by_tenant_at timestamptz;
alter table contracts add column if not exists signed_by_owner_at timestamptz;
alter table contracts add column if not exists signed_by_tenant_at timestamptz;
alter table contracts add column if not exists contract_request_id uuid references rental_requests(id);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  url text,
  read_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

do $$
begin
  alter table houses
    add constraint houses_owner_id_fkey foreign key (owner_id) references users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table rental_requests
    add constraint rental_requests_tenant_id_fkey foreign key (tenant_id) references users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table contracts
    add constraint contracts_owner_id_fkey foreign key (owner_id) references users(id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table contracts
    add constraint contracts_tenant_id_fkey foreign key (tenant_id) references users(id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table push_subscriptions
    add constraint push_subscriptions_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'house-images',
  'house-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table role enable row level security;
alter table users enable row level security;
alter table houses enable row level security;
alter table rental_requests enable row level security;
alter table contracts enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications enable row level security;

drop policy if exists "role_public_read" on role;
create policy "role_public_read" on role for select using (true);

drop policy if exists "users_public_read" on users;
create policy "users_public_read" on users for select using (true);
drop policy if exists "users_insert_own" on users;
create policy "users_insert_own" on users for insert with check (auth.uid() = id);
drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users for update using (auth.uid() = id);
drop policy if exists "users_admin_update" on users;
create policy "users_admin_update" on users for update using (
  exists (
    select 1
    from users admin_user
    join role on role.id = admin_user.role_id
    where admin_user.id = auth.uid()
      and role.name = 'admin'
  )
);

drop policy if exists "houses_public_read" on houses;
create policy "houses_public_read" on houses for select using (true);
drop policy if exists "houses_owner_insert" on houses;
create policy "houses_owner_insert" on houses for insert with check (
  auth.uid() = owner_id
  and exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name in ('admin', 'bailleur', 'agence')
  )
);
drop policy if exists "houses_owner_update" on houses;
create policy "houses_owner_update" on houses for update using (
  auth.uid() = owner_id
  and exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name in ('admin', 'bailleur', 'agence')
  )
);
drop policy if exists "houses_admin_update" on houses;
create policy "houses_admin_update" on houses for update using (
  exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  )
);
drop policy if exists "houses_admin_delete" on houses;
create policy "houses_admin_delete" on houses for delete using (
  exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  )
);

drop policy if exists "requests_tenant_insert" on rental_requests;
create policy "requests_tenant_insert" on rental_requests for insert with check (auth.uid() = tenant_id);
drop policy if exists "requests_tenant_read" on rental_requests;
create policy "requests_tenant_read" on rental_requests for select using (
  auth.uid() = tenant_id
  or exists (
    select 1
    from houses
    where houses.id = rental_requests.house_id
      and houses.owner_id = auth.uid()
  )
);
drop policy if exists "requests_owner_update" on rental_requests;
create policy "requests_owner_update" on rental_requests for update using (
  exists (
    select 1
    from houses
    where houses.id = rental_requests.house_id
      and houses.owner_id = auth.uid()
  )
);

drop policy if exists "contracts_participants_read" on contracts;
create policy "contracts_participants_read" on contracts for select using (auth.uid() = owner_id or auth.uid() = tenant_id);
drop policy if exists "contracts_tenant_insert" on contracts;
drop policy if exists "contracts_owner_insert" on contracts;
create policy "contracts_owner_insert" on contracts for insert with check (auth.uid() = owner_id);
drop policy if exists "contracts_participants_update" on contracts;
create policy "contracts_participants_update" on contracts for update using (auth.uid() = owner_id or auth.uid() = tenant_id);
drop policy if exists "contracts_admin_read" on contracts;
create policy "contracts_admin_read" on contracts for select using (
  exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name = 'admin'
  )
);

drop policy if exists "push_subscriptions_owner_read" on push_subscriptions;
create policy "push_subscriptions_owner_read" on push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "push_subscriptions_owner_insert" on push_subscriptions;
create policy "push_subscriptions_owner_insert" on push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "push_subscriptions_owner_update" on push_subscriptions;
create policy "push_subscriptions_owner_update" on push_subscriptions for update using (auth.uid() = user_id);
drop policy if exists "push_subscriptions_owner_delete" on push_subscriptions;
create policy "push_subscriptions_owner_delete" on push_subscriptions for delete using (auth.uid() = user_id);

drop policy if exists "notifications_owner_read" on notifications;
create policy "notifications_owner_read" on notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_owner_update" on notifications;
create policy "notifications_owner_update" on notifications for update using (auth.uid() = user_id);
drop policy if exists "notifications_owner_insert" on notifications;
create policy "notifications_owner_insert" on notifications for insert with check (auth.uid() = user_id or auth.uid() = actor_id);

drop policy if exists "house_images_public_read" on storage.objects;
create policy "house_images_public_read" on storage.objects for select using (bucket_id = 'house-images');
drop policy if exists "house_images_auth_insert" on storage.objects;
create policy "house_images_auth_insert" on storage.objects for insert with check (
  bucket_id = 'house-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name in ('admin', 'bailleur', 'agence')
  )
);
drop policy if exists "house_images_owner_update" on storage.objects;
create policy "house_images_owner_update" on storage.objects for update using (
  bucket_id = 'house-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name in ('admin', 'bailleur', 'agence')
  )
);
drop policy if exists "house_images_owner_delete" on storage.objects;
create policy "house_images_owner_delete" on storage.objects for delete using (
  bucket_id = 'house-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from users
    join role on role.id = users.role_id
    where users.id = auth.uid()
      and role.name in ('admin', 'bailleur', 'agence')
  )
);
