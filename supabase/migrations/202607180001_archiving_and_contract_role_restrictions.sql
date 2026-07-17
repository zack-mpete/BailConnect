-- Keep publication lifecycle separate from occupation status and ensure that
-- administrators cannot alter agreements or request a participant termination.

alter table public.houses add column if not exists is_archived boolean not null default false;
alter table public.houses add column if not exists archived_at timestamptz;
alter table public.houses add column if not exists archived_by uuid;

update public.houses house
set archived_by = null
where archived_by is not null
  and not exists (
    select 1 from public.users app_user
    where app_user.id = house.archived_by
  );

do $$
begin
  alter table public.houses
    add constraint houses_archived_by_fkey
    foreign key (archived_by) references public.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

-- Legacy rows encoded archival inside the occupation enum. Convert them to
-- the dedicated flag without changing the meaning of active occupations.
update public.houses
set is_archived = true,
    archived_at = coalesce(archived_at, now()),
    status = case
      when exists (
        select 1 from public.contracts contract
        where contract.house_id = houses.id
          and contract.status in ('signe', 'resiliation_programmee')
      ) then 'Loué'::public.house_status
      when exists (
        select 1 from public.contracts contract
        where contract.house_id = houses.id
          and contract.status in ('brouillon', 'pret_a_signer')
      ) then 'Réservé'::public.house_status
      else 'Disponible'::public.house_status
    end
where status = 'Archivé';

create index if not exists houses_public_catalog_archived_idx
  on public.houses (publication_status, is_archived, status, created_at desc);

create or replace function public.can_access_house(target_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.houses house
    where house.id = target_house_id
      and (
        (
          house.publication_status = 'validee'
          and not house.is_archived
          and house.status = 'Disponible'
        )
        or house.owner_id = auth.uid()
        or public.current_user_is_admin()
        or house.current_tenant_id = auth.uid()
        or exists (
          select 1
          from public.rental_requests request
          where request.house_id = house.id
            and request.tenant_id = auth.uid()
        )
        or exists (
          select 1
          from public.contracts contract
          where contract.house_id = house.id
            and (contract.owner_id = auth.uid() or contract.tenant_id = auth.uid())
        )
      )
  );
$$;

create or replace function public.guard_house_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  public_fields_changed boolean;
begin
  if public.current_user_is_admin() then
    -- Administrators moderate and archive listings, but contract templates
    -- remain under the owning landlord/agency's responsibility.
    new.contract_duration_months := old.contract_duration_months;
    new.contract_deposit := old.contract_deposit;
    new.contract_payment_terms := old.contract_payment_terms;
    new.contract_special_terms := old.contract_special_terms;
    new.contract_title := old.contract_title;
    new.contract_body := old.contract_body;
    return new;
  end if;

  -- Archival is an administrative action. Owners cannot toggle these fields
  -- through a direct PostgREST update.
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
    new.publication_status := 'en_attente';
    new.publication_reviewed_at := null;
    new.publication_reviewed_by := null;
    new.publication_rejection_reason := null;
  else
    new.publication_status := old.publication_status;
    new.publication_reviewed_at := old.publication_reviewed_at;
    new.publication_reviewed_by := old.publication_reviewed_by;
    new.publication_rejection_reason := old.publication_rejection_reason;
  end if;

  return new;
end;
$$;

create or replace function public.guard_rental_request_decision_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  house_owner_id uuid;
begin
  if old.status = 'en_attente' and new.status in ('approuvee', 'rejetee') then
    select owner_id into house_owner_id
    from public.houses
    where id = new.house_id;

    if auth.uid() is distinct from house_owner_id then
      raise exception using
        errcode = '42501',
        message = 'Seul le bailleur ou l''agence propriétaire peut décider de cette demande.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rental_requests_guard_owner_decision on public.rental_requests;
create trigger rental_requests_guard_owner_decision
before update on public.rental_requests
for each row execute function public.guard_rental_request_decision_owner();

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
            where contract.house_id = house.id
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
              where contract.house_id = house.id
                and contract.owner_id = message_recipient_id
                and contract.tenant_id = message_sender_id
            )
            or exists (
              select 1
              from public.rental_requests request
              where request.house_id = house.id
                and request.tenant_id = message_sender_id
            )
          )
        )
      )
  );
$$;

drop policy if exists "payments_owner_insert" on public.payments;
create policy "payments_owner_insert" on public.payments
for insert with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.houses
    where houses.id = payments.house_id
      and houses.owner_id = payments.owner_id
  )
);

drop policy if exists "payments_owner_update" on public.payments;
create policy "payments_owner_update" on public.payments
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "payments_owner_delete" on public.payments;
create policy "payments_owner_delete" on public.payments
for delete using (auth.uid() = owner_id);

create or replace function public.request_contract_termination(
  target_contract_id uuid,
  effective_date date,
  reason text,
  note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
  immediate boolean;
begin
  if effective_date is null then
    raise exception using errcode = '22023', message = 'La date de resiliation est requise.';
  end if;
  if length(trim(coalesce(reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'Le motif de resiliation est requis.';
  end if;

  select * into contract_record
  from public.contracts
  where id = target_contract_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Contrat introuvable.';
  end if;
  if auth.uid() not in (contract_record.owner_id, contract_record.tenant_id) then
    raise exception using errcode = '42501', message = 'Seuls le bailleur et le locataire peuvent demander la resiliation.';
  end if;
  if contract_record.status <> 'signe' then
    raise exception using errcode = '23514', message = 'Seul un contrat signe peut etre resilie.';
  end if;

  immediate := effective_date <= current_date;

  update public.contracts
  set status = case
        when immediate then 'resilie'::public.contract_status
        else 'resiliation_programmee'::public.contract_status
      end,
      termination_effective_date = effective_date,
      termination_reason = trim(reason),
      termination_note = nullif(trim(note), ''),
      termination_requested_at = now(),
      termination_requested_by = auth.uid(),
      terminated_at = case when immediate then now() else null end,
      terminated_by = case when immediate then auth.uid() else null end
  where id = target_contract_id;

  if immediate then
    update public.houses
    set status = case when status = 'Loué' then 'Disponible'::public.house_status else status end,
        current_tenant_id = null,
        current_contract_id = null
    where id = contract_record.house_id
      and current_contract_id = contract_record.id
      and not exists (
        select 1 from public.contracts other_contract
        where other_contract.house_id = contract_record.house_id
          and other_contract.id <> contract_record.id
          and other_contract.status in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee')
      );
  end if;

  return target_contract_id;
end;
$$;

revoke all on function public.request_contract_termination(uuid, date, text, text) from public;
grant execute on function public.request_contract_termination(uuid, date, text, text) to authenticated;

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
  publication_status,
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
) on public.houses to anon;
grant select on public.houses to authenticated;
