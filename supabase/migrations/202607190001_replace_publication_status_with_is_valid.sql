-- Replace the three-state publication enum with a validation boolean.
-- Existing validated listings remain public; pending and rejected listings
-- remain private. Rejection metadata is preserved for the moderation UI.

alter table public.houses
  add column if not exists is_valid boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'houses'
      and column_name = 'publication_status'
  ) then
    execute $sql$
      update public.houses
      set is_valid = (publication_status = 'validee')
    $sql$;
  end if;
end;
$$;

drop index if exists public.houses_public_catalog_idx;
drop index if exists public.houses_public_catalog_archived_idx;
create index if not exists houses_public_catalog_validation_idx
  on public.houses (is_valid, is_archived, status, created_at desc);

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
          house.is_valid
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
    -- Validation and archival belong to administrators. Contract templates
    -- remain under the owning landlord or agency's responsibility.
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

drop trigger if exists houses_guard_moderation on public.houses;
drop trigger if exists houses_guard_validation on public.houses;
create trigger houses_guard_validation
before update on public.houses
for each row execute function public.guard_house_validation();

drop function if exists public.guard_house_moderation();
revoke all on function public.guard_house_validation() from public;

drop policy if exists "houses_public_read" on public.houses;
drop policy if exists "houses_scoped_read" on public.houses;
create policy "houses_scoped_read" on public.houses
for select using (public.can_access_house(id));

drop policy if exists "houses_owner_insert" on public.houses;
create policy "houses_owner_insert" on public.houses
for insert with check (
  auth.uid() = owner_id
  and not is_valid
  and publication_reviewed_at is null
  and publication_reviewed_by is null
  and public.current_user_role() in ('admin', 'bailleur', 'agence')
);

drop policy if exists "requests_tenant_insert" on public.rental_requests;
create policy "requests_tenant_insert" on public.rental_requests
for insert with check (
  auth.uid() = tenant_id
  and exists (
    select 1
    from public.houses
    where houses.id = rental_requests.house_id
      and houses.is_valid
      and not houses.is_archived
      and houses.status = 'Disponible'
      and houses.owner_id <> auth.uid()
  )
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
  if not house_record.is_valid
    or house_record.is_archived
    or house_record.status <> 'Disponible' then
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
    raise exception using errcode = '42501', message = 'Seul le bailleur ou l''agence proprietaire peut traiter cette demande.';
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

  if not house_record.is_valid
    or house_record.is_archived
    or house_record.status <> 'Disponible' then
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

revoke all on function public.submit_rental_request(uuid, text) from public;
revoke all on function public.respond_rental_request(uuid, text, text) from public;
grant execute on function public.submit_rental_request(uuid, text) to authenticated;
grant execute on function public.respond_rental_request(uuid, text, text) to authenticated;

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
) on public.houses to anon;
grant select on public.houses to authenticated;

alter table public.houses
  drop column if exists publication_status;

drop type if exists public.publication_status;

comment on column public.houses.is_valid is
  'True only after an administrator validates the listing.';
