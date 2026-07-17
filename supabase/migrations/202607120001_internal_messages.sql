-- Internal messaging between a tenant and the owner of a house.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_no_self_message check (sender_id <> recipient_id)
);

alter table public.messages add column if not exists house_id uuid;
alter table public.messages add column if not exists sender_id uuid;
alter table public.messages add column if not exists recipient_id uuid;
alter table public.messages add column if not exists body text;
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages add column if not exists created_at timestamptz not null default now();

do $$
begin
  alter table public.messages
    add constraint messages_house_id_fkey foreign key (house_id) references public.houses(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_sender_id_fkey foreign key (sender_id) references public.users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_recipient_id_fkey foreign key (recipient_id) references public.users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.messages
    add constraint messages_no_self_message check (sender_id <> recipient_id);
exception
  when duplicate_object then null;
end $$;

create index if not exists messages_house_created_idx on public.messages (house_id, created_at);
create index if not exists messages_recipient_unread_idx on public.messages (recipient_id, read_at) where read_at is null;

alter table public.messages enable row level security;

drop policy if exists "messages_participants_read" on public.messages;
create policy "messages_participants_read" on public.messages
for select
using (
  auth.uid() = sender_id
  or auth.uid() = recipient_id
);

drop policy if exists "messages_sender_insert" on public.messages;
create policy "messages_sender_insert" on public.messages
for insert
with check (
  auth.uid() = sender_id
  and auth.uid() <> recipient_id
  and exists (
    select 1
    from public.houses
    where houses.id = messages.house_id
      and (
        houses.owner_id = messages.recipient_id
        or houses.owner_id = auth.uid()
      )
  )
);

drop policy if exists "messages_recipient_update" on public.messages;
create policy "messages_recipient_update" on public.messages
for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);
