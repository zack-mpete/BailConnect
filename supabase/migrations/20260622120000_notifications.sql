-- Adds the notification tables and policies required by the Next.js API.
-- Safe to run more than once.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions add column if not exists user_id uuid;
alter table push_subscriptions add column if not exists endpoint text;
alter table push_subscriptions add column if not exists subscription jsonb;
alter table push_subscriptions add column if not exists created_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.push_subscriptions_endpoint_key') is null then
    alter table push_subscriptions
      add constraint push_subscriptions_endpoint_key unique (endpoint);
  end if;
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

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor_id uuid,
  type text,
  title text,
  body text,
  url text,
  read_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

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

create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id, read_at) where read_at is null;
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
alter table notifications enable row level security;

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
create policy "notifications_actor_insert" on notifications for insert with check (
  auth.uid() = user_id
  or auth.uid() = actor_id
);
