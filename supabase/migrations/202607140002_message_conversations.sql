-- Secures classic one-to-one conversations without adding a conversation entity.
-- A conversation is derived from house_id + the two participant ids.

do $$
begin
  alter table public.messages
    add constraint messages_body_length_check
    check (char_length(btrim(body)) between 1 and 2000) not valid;
exception
  when duplicate_object then null;
end $$;

create index if not exists messages_conversation_created_idx
  on public.messages (house_id, sender_id, recipient_id, created_at desc);

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
          house.owner_id = message_recipient_id
          and house.owner_id <> message_sender_id
        )
        or
        (
          house.owner_id = message_sender_id
          and (
            exists (
              select 1
              from public.contracts contract
              where contract.house_id = message_house_id
                and contract.owner_id = message_sender_id
                and contract.tenant_id = message_recipient_id
            )
            or exists (
              select 1
              from public.messages previous_message
              where previous_message.house_id = message_house_id
                and previous_message.sender_id = message_recipient_id
                and previous_message.recipient_id = message_sender_id
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_send_house_message(uuid, uuid, uuid) from public;
grant execute on function public.can_send_house_message(uuid, uuid, uuid) to authenticated;

create or replace function public.mark_messages_read(
  target_house_id uuid,
  other_user_id uuid default null
)
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

drop policy if exists "messages_sender_insert" on public.messages;
create policy "messages_sender_insert" on public.messages
for insert
with check (
  auth.uid() = sender_id
  and auth.uid() <> recipient_id
  and public.can_send_house_message(house_id, sender_id, recipient_id)
);

-- Read receipts use mark_messages_read; message content remains immutable.
drop policy if exists "messages_recipient_update" on public.messages;
