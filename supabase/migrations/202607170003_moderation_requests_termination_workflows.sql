-- Atomic workflows and RLS for publication moderation, rental requests,
-- agreements and termination. Run after 202607170002 has committed.
-- Existing active-contract conflicts are reconciled without deleting history.

-- Complete partially populated historical termination rows so the validation
-- constraint can be installed without discarding their history.
update public.contracts
set
  termination_effective_date = coalesce(termination_effective_date, start_date, current_date),
  termination_reason = case
    when length(trim(coalesce(termination_reason, ''))) >= 3 then termination_reason
    else 'Résiliation historique normalisée pendant la migration.'
  end,
  termination_requested_at = coalesce(termination_requested_at, created_at, now()),
  termination_requested_by = coalesce(termination_requested_by, owner_id),
  terminated_at = case
    when status = 'resilie' then coalesce(terminated_at, termination_effective_date::timestamptz, now())
    else terminated_at
  end,
  terminated_by = case
    when status = 'resilie' then coalesce(terminated_by, termination_requested_by, owner_id)
    else terminated_by
  end
where status in ('resiliation_programmee', 'resilie');

do $$
begin
  alter table public.contracts
    add constraint contracts_termination_fields_check
    check (
      status not in ('resiliation_programmee', 'resilie')
      or (
        termination_effective_date is not null
        and length(trim(coalesce(termination_reason, ''))) >= 3
        and termination_requested_at is not null
        and termination_requested_by is not null
      )
    );
exception
  when duplicate_object then null;
end $$;

-- Reconcile legacy conflicts without deleting contracts. The current contract
-- pointer wins first, then the most advanced and most recent contract. Other
-- active duplicates become cancelled historical records.
with ranked_active_contracts as (
  select
    contract.id,
    row_number() over (
      partition by contract.house_id
      order by
        (house.current_contract_id = contract.id) desc,
        case contract.status::text
          when 'resiliation_programmee' then 6
          when 'signe' then 5
          when 'pret_a_signer' then 4
          when 'brouillon' then 3
          else 1
        end desc,
        (contract.agreed_by_owner_at is not null)::int
          + (contract.agreed_by_tenant_at is not null)::int desc,
        contract.created_at desc nulls last,
        contract.id desc
    ) as position
  from public.contracts contract
  join public.houses house on house.id = contract.house_id
  where contract.status in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee')
)
update public.contracts contract
set status = 'annule'::public.contract_status
from ranked_active_contracts ranked
where contract.id = ranked.id
  and ranked.position > 1;

-- Remove obsolete pointers, then align each house with its remaining active
-- contract. A legacy archived occupation is preserved until the archive
-- migration converts it to the dedicated is_archived flag.
update public.houses house
set
  current_contract_id = null,
  current_tenant_id = null,
  status = case
    when house.status in ('Réservé', 'Loué') then 'Disponible'::public.house_status
    else house.status
  end
where house.current_contract_id is not null
  and not exists (
    select 1
    from public.contracts contract
    where contract.id = house.current_contract_id
      and contract.house_id = house.id
      and contract.status in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee')
  );

with remaining_active_contracts as (
  select
    contract.id,
    contract.house_id,
    contract.tenant_id,
    contract.status
  from public.contracts contract
  where contract.status in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee')
)
update public.houses house
set
  current_contract_id = contract.id,
  current_tenant_id = contract.tenant_id,
  status = case
    when house.status = 'Archivé' then house.status
    when contract.status in ('signe', 'resiliation_programmee') then 'Loué'::public.house_status
    else 'Réservé'::public.house_status
  end
from remaining_active_contracts contract
where house.id = contract.house_id;

create unique index if not exists contracts_one_active_per_house
  on public.contracts (house_id)
  where status in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee');

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

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role.name
  from public.users
  join public.role on role.id = users.role_id
  where users.id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

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

revoke all on function public.can_access_house(uuid) from public;
grant execute on function public.can_access_house(uuid) to anon, authenticated;

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
    return new;
  end if;

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

drop trigger if exists houses_guard_moderation on public.houses;
create trigger houses_guard_moderation
before update on public.houses
for each row execute function public.guard_house_moderation();

drop policy if exists "houses_public_read" on public.houses;
drop policy if exists "houses_scoped_read" on public.houses;
create policy "houses_scoped_read" on public.houses
for select using (public.can_access_house(id));

drop policy if exists "houses_owner_insert" on public.houses;
create policy "houses_owner_insert" on public.houses
for insert with check (
  auth.uid() = owner_id
  and publication_status = 'en_attente'
  and publication_reviewed_at is null
  and publication_reviewed_by is null
  and public.current_user_role() in ('admin', 'bailleur', 'agence')
);

drop policy if exists "houses_owner_update" on public.houses;
create policy "houses_owner_update" on public.houses
for update
using (
  auth.uid() = owner_id
  and public.current_user_role() in ('admin', 'bailleur', 'agence')
)
with check (
  auth.uid() = owner_id
  and public.current_user_role() in ('admin', 'bailleur', 'agence')
);

drop policy if exists "houses_admin_update" on public.houses;
create policy "houses_admin_update" on public.houses
for update
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "requests_tenant_insert" on public.rental_requests;
create policy "requests_tenant_insert" on public.rental_requests
for insert with check (
  auth.uid() = tenant_id
  and status = 'en_attente'
  and public.current_user_role() = 'locataire'
  and exists (
    select 1
    from public.houses
    where houses.id = rental_requests.house_id
      and houses.publication_status = 'validee'
      and houses.status = 'Disponible'
  )
);

drop policy if exists "requests_tenant_read" on public.rental_requests;
drop policy if exists "requests_participants_read" on public.rental_requests;
create policy "requests_participants_read" on public.rental_requests
for select using (
  auth.uid() = tenant_id
  or public.current_user_is_admin()
  or exists (
    select 1
    from public.houses
    where houses.id = rental_requests.house_id
      and houses.owner_id = auth.uid()
  )
);

drop policy if exists "requests_owner_update" on public.rental_requests;

drop policy if exists "contracts_tenant_insert" on public.contracts;
drop policy if exists "contracts_owner_insert" on public.contracts;
drop policy if exists "contracts_participants_update" on public.contracts;

drop policy if exists "contracts_participants_read" on public.contracts;
create policy "contracts_participants_read" on public.contracts
for select using (
  auth.uid() = owner_id
  or auth.uid() = tenant_id
  or public.current_user_is_admin()
);

create or replace function public.submit_rental_request(
  target_house_id uuid,
  request_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  house_record public.houses%rowtype;
  request_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Connexion requise.';
  end if;
  if public.current_user_role() <> 'locataire' then
    raise exception using errcode = '42501', message = 'Seul un locataire peut envoyer une demande.';
  end if;

  select * into house_record
  from public.houses
  where id = target_house_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Maison introuvable.';
  end if;
  if house_record.owner_id = auth.uid() then
    raise exception using errcode = '42501', message = 'Le proprietaire ne peut pas demander son propre bien.';
  end if;
  if house_record.publication_status <> 'validee' or house_record.status <> 'Disponible' then
    raise exception using errcode = '23514', message = 'Cette maison ne peut pas recevoir de demande.';
  end if;
  if exists (
    select 1 from public.rental_requests
    where house_id = target_house_id
      and tenant_id = auth.uid()
      and status = 'en_attente'
  ) then
    raise exception using errcode = '23505', message = 'Une demande est deja en attente pour cette maison.';
  end if;

  insert into public.rental_requests (house_id, tenant_id, message, status)
  values (target_house_id, auth.uid(), nullif(trim(request_message), ''), 'en_attente')
  returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.respond_rental_request(
  target_request_id uuid,
  decision text,
  reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.rental_requests%rowtype;
  house_record public.houses%rowtype;
  contract_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Connexion requise.';
  end if;
  if decision not in ('accept', 'reject') then
    raise exception using errcode = '22023', message = 'Decision invalide.';
  end if;
  if decision = 'reject' and length(trim(coalesce(reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'Le motif du refus est requis.';
  end if;

  select * into request_record
  from public.rental_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Demande introuvable.';
  end if;
  if request_record.status <> 'en_attente' then
    raise exception using errcode = '23514', message = 'Cette demande a deja ete traitee.';
  end if;

  select * into house_record
  from public.houses
  where id = request_record.house_id
  for update;

  if house_record.owner_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Seul le bailleur ou l''agence propriétaire peut traiter cette demande.';
  end if;

  if decision = 'reject' then
    update public.rental_requests
    set status = 'rejetee',
        decided_at = now(),
        decided_by = auth.uid(),
        decision_reason = trim(reason),
        updated_at = now()
    where id = target_request_id;
    return null;
  end if;

  if house_record.publication_status <> 'validee' or house_record.status <> 'Disponible' then
    raise exception using errcode = '23514', message = 'La maison n''est plus disponible.';
  end if;
  if exists (
    select 1 from public.contracts
    where house_id = house_record.id
      and status in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee')
  ) then
    raise exception using errcode = '23505', message = 'Un contrat actif existe deja pour cette maison.';
  end if;

  insert into public.contracts (
    house_id,
    owner_id,
    tenant_id,
    start_date,
    duration_months,
    rent,
    status,
    seal_code,
    contract_request_id,
    contract_title,
    contract_body,
    contract_deposit,
    contract_payment_terms,
    contract_special_terms
  )
  values (
    house_record.id,
    house_record.owner_id,
    request_record.tenant_id,
    current_date,
    house_record.contract_duration_months,
    house_record.price,
    'brouillon',
    'BAIL-' || extract(year from current_date)::text || '-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    request_record.id,
    house_record.contract_title,
    house_record.contract_body,
    house_record.contract_deposit,
    house_record.contract_payment_terms,
    house_record.contract_special_terms
  )
  returning id into contract_id;

  update public.rental_requests
  set status = 'approuvee',
      decided_at = now(),
      decided_by = auth.uid(),
      decision_reason = null,
      updated_at = now()
  where id = target_request_id;

  update public.rental_requests
  set status = 'rejetee',
      decided_at = now(),
      decided_by = auth.uid(),
      decision_reason = 'Le bien a ete reserve pour une autre demande.',
      updated_at = now()
  where house_id = house_record.id
    and id <> target_request_id
    and status = 'en_attente';

  update public.houses
  set status = 'Réservé'
  where id = house_record.id;

  return contract_id;
end;
$$;

create or replace function public.cancel_rental_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.rental_requests%rowtype;
begin
  select * into request_record
  from public.rental_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Demande introuvable.';
  end if;
  if request_record.tenant_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Cette demande ne vous appartient pas.';
  end if;
  if request_record.status <> 'en_attente' then
    raise exception using errcode = '23514', message = 'Seule une demande en attente peut etre annulee.';
  end if;

  update public.rental_requests
  set status = 'annulee',
      cancelled_at = now(),
      updated_at = now()
  where id = target_request_id;
end;
$$;

create or replace function public.record_contract_agreement(target_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
  owner_agreed_at timestamptz;
  tenant_agreed_at timestamptz;
begin
  select * into contract_record
  from public.contracts
  where id = target_contract_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Contrat introuvable.';
  end if;
  if auth.uid() not in (contract_record.owner_id, contract_record.tenant_id) then
    raise exception using errcode = '42501', message = 'Vous ne participez pas a ce contrat.';
  end if;
  if contract_record.status not in ('brouillon', 'pret_a_signer') then
    raise exception using errcode = '23514', message = 'Ce contrat ne peut plus recevoir d''accord.';
  end if;

  owner_agreed_at := contract_record.agreed_by_owner_at;
  tenant_agreed_at := contract_record.agreed_by_tenant_at;

  if auth.uid() = contract_record.owner_id then
    owner_agreed_at := coalesce(owner_agreed_at, now());
  else
    tenant_agreed_at := coalesce(tenant_agreed_at, now());
  end if;

  update public.contracts
  set agreed_by_owner_at = owner_agreed_at,
      agreed_by_tenant_at = tenant_agreed_at,
      signed_by_owner_at = case when owner_agreed_at is not null and tenant_agreed_at is not null then owner_agreed_at else signed_by_owner_at end,
      signed_by_tenant_at = case when owner_agreed_at is not null and tenant_agreed_at is not null then tenant_agreed_at else signed_by_tenant_at end,
      status = case
        when owner_agreed_at is not null and tenant_agreed_at is not null then 'signe'::public.contract_status
        else 'pret_a_signer'::public.contract_status
      end
  where id = target_contract_id;

  if owner_agreed_at is not null and tenant_agreed_at is not null then
    update public.houses
    set status = 'Loué',
        current_tenant_id = contract_record.tenant_id,
        current_contract_id = contract_record.id
    where id = contract_record.house_id;
  end if;

  return target_contract_id;
end;
$$;

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

create or replace function public.finalize_contract_termination(target_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
begin
  if not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'Acces administrateur requis.';
  end if;

  select * into contract_record
  from public.contracts
  where id = target_contract_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Contrat introuvable.';
  end if;
  if contract_record.status <> 'resiliation_programmee' then
    raise exception using errcode = '23514', message = 'Aucune resiliation programmee pour ce contrat.';
  end if;
  if contract_record.termination_effective_date > current_date then
    raise exception using errcode = '23514', message = 'La date de resiliation n''est pas encore atteinte.';
  end if;

  update public.contracts
  set status = 'resilie',
      terminated_at = now(),
      terminated_by = auth.uid()
  where id = target_contract_id;

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

  return target_contract_id;
end;
$$;

revoke all on function public.submit_rental_request(uuid, text) from public;
revoke all on function public.respond_rental_request(uuid, text, text) from public;
revoke all on function public.cancel_rental_request(uuid) from public;
revoke all on function public.record_contract_agreement(uuid) from public;
revoke all on function public.request_contract_termination(uuid, date, text, text) from public;
revoke all on function public.finalize_contract_termination(uuid) from public;

grant execute on function public.submit_rental_request(uuid, text) to authenticated;
grant execute on function public.respond_rental_request(uuid, text, text) to authenticated;
grant execute on function public.cancel_rental_request(uuid) to authenticated;
grant execute on function public.record_contract_agreement(uuid) to authenticated;
grant execute on function public.request_contract_termination(uuid, date, text, text) to authenticated;
grant execute on function public.finalize_contract_termination(uuid) to authenticated;

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
