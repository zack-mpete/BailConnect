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

alter type contract_status add value if not exists 'resiliation_programmee';
alter type contract_status add value if not exists 'resilie';

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
  is_valid boolean not null default false,
  publication_reviewed_at timestamptz,
  publication_reviewed_by uuid,
  publication_rejection_reason text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by uuid,
  current_tenant_id uuid,
  current_contract_id uuid,
  image_url text,
  features text[] default '{}',
  contract_duration_months int not null default 12,
  contract_deposit numeric(12,2),
  contract_payment_terms text,
  contract_special_terms text,
  contract_title text,
  contract_body text,
  created_at timestamptz not null default now()
);

alter table houses add column if not exists district text;
alter table houses add column if not exists address text;
alter table houses add column if not exists latitude double precision;
alter table houses add column if not exists longitude double precision;
alter table houses add column if not exists current_tenant_id uuid;
alter table houses add column if not exists current_contract_id uuid;
alter table houses add column if not exists is_valid boolean not null default false;
alter table houses add column if not exists publication_reviewed_at timestamptz;
alter table houses add column if not exists publication_reviewed_by uuid;
alter table houses add column if not exists publication_rejection_reason text;
alter table houses add column if not exists is_archived boolean not null default false;
alter table houses add column if not exists archived_at timestamptz;
alter table houses add column if not exists archived_by uuid;
alter table houses add column if not exists contract_duration_months int not null default 12;
alter table houses add column if not exists contract_deposit numeric(12,2);
alter table houses add column if not exists contract_payment_terms text;
alter table houses add column if not exists contract_special_terms text;
alter table houses add column if not exists contract_title text;
alter table houses add column if not exists contract_body text;

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
alter table rental_requests add column if not exists decided_at timestamptz;
alter table rental_requests add column if not exists decided_by uuid;
alter table rental_requests add column if not exists decision_reason text;
alter table rental_requests add column if not exists cancelled_at timestamptz;

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
  contract_title text,
  contract_body text,
  contract_deposit numeric(12,2),
  contract_payment_terms text,
  contract_special_terms text,
  termination_effective_date date,
  termination_reason text,
  termination_note text,
  termination_requested_at timestamptz,
  termination_requested_by uuid,
  terminated_at timestamptz,
  terminated_by uuid,
  created_at timestamptz not null default now()
);

alter table contracts add column if not exists agreed_by_owner_at timestamptz;
alter table contracts add column if not exists agreed_by_tenant_at timestamptz;
alter table contracts add column if not exists signed_by_owner_at timestamptz;
alter table contracts add column if not exists signed_by_tenant_at timestamptz;
alter table contracts add column if not exists contract_request_id uuid references rental_requests(id);
alter table contracts add column if not exists contract_title text;
alter table contracts add column if not exists contract_body text;
alter table contracts add column if not exists contract_deposit numeric(12,2);
alter table contracts add column if not exists contract_payment_terms text;
alter table contracts add column if not exists contract_special_terms text;
alter table contracts add column if not exists termination_effective_date date;
alter table contracts add column if not exists termination_reason text;
alter table contracts add column if not exists termination_note text;
alter table contracts add column if not exists termination_requested_at timestamptz;
alter table contracts add column if not exists termination_requested_by uuid;
alter table contracts add column if not exists terminated_at timestamptz;
alter table contracts add column if not exists terminated_by uuid;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references houses(id) on delete cascade,
  contract_id uuid references contracts(id) on delete set null,
  owner_id uuid not null references users(id) on delete cascade,
  tenant_id uuid references users(id) on delete set null,
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

create index if not exists payments_house_paid_idx on payments (house_id, paid_at desc);
create index if not exists payments_owner_paid_idx on payments (owner_id, paid_at desc);
create index if not exists payments_tenant_paid_idx on payments (tenant_id, paid_at desc);
create index if not exists payments_contract_idx on payments (contract_id);

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

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references houses(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_no_self_message check (sender_id <> recipient_id),
  constraint messages_body_length_check check (char_length(btrim(body)) between 1 and 2000)
);

alter table messages add column if not exists house_id uuid;
alter table messages add column if not exists sender_id uuid;
alter table messages add column if not exists recipient_id uuid;
alter table messages add column if not exists body text;
alter table messages add column if not exists read_at timestamptz;
alter table messages add column if not exists created_at timestamptz not null default now();

do $$
begin
  alter table messages
    add constraint messages_body_length_check
    check (char_length(btrim(body)) between 1 and 2000) not valid;
exception
  when duplicate_object then null;
end $$;

create index if not exists messages_house_created_idx on messages (house_id, created_at);
create index if not exists messages_recipient_unread_idx on messages (recipient_id, read_at) where read_at is null;
create index if not exists messages_conversation_created_idx on messages (house_id, sender_id, recipient_id, created_at desc);

create or replace function public.can_send_house_message(
  message_house_id uuid,
  message_sender_id uuid,
  message_recipient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.houses house
    where house.id = message_house_id
      and (
        (
          house.owner_id = message_sender_id
          and exists (
            select 1
            from public.contracts contract
            where contract.house_id = message_house_id
              and contract.owner_id = message_sender_id
              and contract.tenant_id = message_recipient_id
          )
        )
        or
        (
          house.owner_id = message_recipient_id
          and (
            exists (
              select 1
              from public.contracts contract
              where contract.house_id = message_house_id
                and contract.owner_id = message_recipient_id
                and contract.tenant_id = message_sender_id
            )
            or exists (
              select 1
              from public.rental_requests request
              where request.house_id = message_house_id
                and request.tenant_id = message_sender_id
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_send_house_message(uuid, uuid, uuid) from public;
grant execute on function public.can_send_house_message(uuid, uuid, uuid) to authenticated;

create or replace function public.mark_messages_read(target_house_id uuid, other_user_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.messages
  set read_at = now()
  where house_id = target_house_id
    and recipient_id = auth.uid()
    and read_at is null
    and (other_user_id is null or sender_id = other_user_id);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_messages_read(uuid, uuid) from public;
grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;

alter table notifications add column if not exists user_id uuid;
alter table notifications add column if not exists actor_id uuid;
alter table notifications add column if not exists type text;
alter table notifications add column if not exists title text;
alter table notifications add column if not exists body text;
alter table notifications add column if not exists url text;
alter table notifications add column if not exists read_at timestamptz;
alter table notifications add column if not exists metadata jsonb not null default '{}';
alter table notifications add column if not exists created_at timestamptz not null default now();
update notifications set metadata = '{}' where metadata is null;

create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id, read_at) where read_at is null;

do $$
begin
  alter table houses
    add constraint houses_owner_id_fkey foreign key (owner_id) references users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table houses
    add constraint houses_current_tenant_id_fkey foreign key (current_tenant_id) references users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table houses
    add constraint houses_archived_by_fkey foreign key (archived_by) references users(id) on delete set null;
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
  alter table houses
    add constraint houses_current_contract_id_fkey foreign key (current_contract_id) references contracts(id) on delete set null;
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
  alter table payments
    add constraint payments_owner_id_fkey foreign key (owner_id) references users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table payments
    add constraint payments_tenant_id_fkey foreign key (tenant_id) references users(id) on delete set null;
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

do $$
begin
  alter table notifications
    add constraint notifications_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table notifications
    add constraint notifications_actor_id_fkey foreign key (actor_id) references users(id) on delete set null;
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
alter table payments enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications enable row level security;
alter table messages enable row level security;

drop policy if exists "role_public_read" on role;
create policy "role_public_read" on role for select using (true);

drop policy if exists "users_public_read" on users;
create policy "users_public_read" on users for select using (true);
revoke select on users from anon;
grant select (id, full_name) on users to anon;
grant select on users to authenticated;
revoke select on houses from anon;
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
  is_valid,
  is_archived,
  image_url,
  features,
  contract_duration_months,
  contract_deposit,
  contract_payment_terms,
  contract_special_terms,
  contract_title,
  contract_body,
  created_at
) on houses to anon;
grant select on houses to authenticated;
drop policy if exists "users_insert_own" on users;
create policy "users_insert_own" on users for insert with check (
  auth.uid() = id
  and role_id = (select id from role where name = 'locataire')
);

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

drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users for update
using (auth.uid() = id)
with check (auth.uid() = id and role_id = public.current_user_role_id());
drop policy if exists "users_admin_update" on users;
create policy "users_admin_update" on users for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create or replace function public.guard_house_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  public_fields_changed boolean;
begin
  if public.current_user_is_admin() then
    new.contract_duration_months := old.contract_duration_months;
    new.contract_deposit := old.contract_deposit;
    new.contract_payment_terms := old.contract_payment_terms;
    new.contract_special_terms := old.contract_special_terms;
    new.contract_title := old.contract_title;
    new.contract_body := old.contract_body;
    return new;
  end if;

  new.is_valid := old.is_valid;
  new.is_archived := old.is_archived;
  new.archived_at := old.archived_at;
  new.archived_by := old.archived_by;

  public_fields_changed :=
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.city is distinct from old.city
    or new.commune is distinct from old.commune
    or new.district is distinct from old.district
    or new.address is distinct from old.address
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.price is distinct from old.price
    or new.rooms is distinct from old.rooms
    or new.type is distinct from old.type
    or new.image_url is distinct from old.image_url
    or new.features is distinct from old.features;

  if public_fields_changed then
    new.is_valid := false;
    new.publication_reviewed_at := null;
    new.publication_reviewed_by := null;
    new.publication_rejection_reason := null;
  else
    new.publication_reviewed_at := old.publication_reviewed_at;
    new.publication_reviewed_by := old.publication_reviewed_by;
    new.publication_rejection_reason := old.publication_rejection_reason;
  end if;

  return new;
end;
$$;

drop trigger if exists houses_guard_validation on houses;
create trigger houses_guard_validation
before update on houses
for each row execute function public.guard_house_validation();

drop policy if exists "houses_public_read" on houses;
create policy "houses_public_read" on houses for select using (
  (is_valid and not is_archived and status = 'Disponible')
  or auth.uid() = owner_id
  or auth.uid() = current_tenant_id
  or public.current_user_is_admin()
);
drop policy if exists "houses_owner_insert" on houses;
create policy "houses_owner_insert" on houses for insert with check (
  auth.uid() = owner_id
  and not is_valid
  and publication_reviewed_at is null
  and publication_reviewed_by is null
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
drop policy if exists "contracts_participants_update" on contracts;
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

drop policy if exists "payments_participants_read" on payments;
create policy "payments_participants_read" on payments for select using (
  auth.uid() = owner_id
  or auth.uid() = tenant_id
  or public.current_user_is_admin()
);
drop policy if exists "payments_owner_insert" on payments;
create policy "payments_owner_insert" on payments for insert with check (
  auth.uid() = owner_id
  and exists (
    select 1 from houses
    where houses.id = payments.house_id
      and houses.owner_id = payments.owner_id
  )
  and (
    payments.contract_id is null
    or exists (
      select 1 from contracts
      where contracts.id = payments.contract_id
        and contracts.house_id = payments.house_id
        and contracts.owner_id = payments.owner_id
        and contracts.tenant_id = payments.tenant_id
    )
  )
);
drop policy if exists "payments_owner_update" on payments;
create policy "payments_owner_update" on payments for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
drop policy if exists "payments_owner_delete" on payments;
create policy "payments_owner_delete" on payments for delete
using (auth.uid() = owner_id);

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
drop policy if exists "notifications_actor_insert" on notifications;
create policy "notifications_actor_insert" on notifications for insert with check (auth.uid() = user_id or auth.uid() = actor_id);

drop policy if exists "messages_participants_read" on messages;
create policy "messages_participants_read" on messages for select using (
  auth.uid() = sender_id or auth.uid() = recipient_id
);
drop policy if exists "messages_sender_insert" on messages;
create policy "messages_sender_insert" on messages for insert with check (
  auth.uid() = sender_id
  and auth.uid() <> recipient_id
  and public.can_send_house_message(house_id, sender_id, recipient_id)
);
drop policy if exists "messages_recipient_update" on messages;

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
