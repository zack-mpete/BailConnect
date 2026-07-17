-- Advanced per-house contract management and current occupant tracking.

alter table public.houses add column if not exists current_tenant_id uuid;
alter table public.houses add column if not exists current_contract_id uuid;
alter table public.houses add column if not exists contract_title text;
alter table public.houses add column if not exists contract_body text;

do $$
begin
  alter table public.houses
    add constraint houses_current_tenant_id_fkey foreign key (current_tenant_id) references public.users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.houses
    add constraint houses_current_contract_id_fkey foreign key (current_contract_id) references public.contracts(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists houses_current_tenant_idx on public.houses (current_tenant_id);
create index if not exists houses_current_contract_idx on public.houses (current_contract_id);

update public.houses
set
  current_tenant_id = latest.tenant_id,
  current_contract_id = latest.id,
  status = case when houses.status = 'Disponible' then 'Loué'::house_status else houses.status end
from (
  select distinct on (house_id)
    id,
    house_id,
    tenant_id
  from public.contracts
  where status in ('pret_a_signer', 'signe')
     or (agreed_by_owner_at is not null and agreed_by_tenant_at is not null)
  order by house_id, created_at desc
) latest
where houses.id = latest.house_id
  and houses.current_tenant_id is null;
