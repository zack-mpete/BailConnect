-- Read-only verification after the two workflow migrations.

select
  count(*) filter (where publication_status = 'en_attente') as publications_en_attente,
  count(*) filter (where publication_status = 'validee') as publications_validees,
  count(*) filter (where publication_status = 'rejetee') as publications_rejetees
from public.houses;

select status, count(*)
from public.rental_requests
group by status
order by status;

select status, count(*)
from public.contracts
group by status
order by status;

select house_id, count(*) as active_contracts
from public.contracts
where status in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee')
group by house_id
having count(*) > 1;

select house_id, tenant_id, count(*) as pending_requests
from public.rental_requests
where status = 'en_attente'
group by house_id, tenant_id
having count(*) > 1;

select contract_request_id, count(*) as linked_contracts
from public.contracts
where contract_request_id is not null
group by contract_request_id
having count(*) > 1;

select
  house.id as house_id,
  house.current_contract_id,
  contract.status as current_contract_status
from public.houses house
left join public.contracts contract
  on contract.id = house.current_contract_id
 and contract.house_id = house.id
where house.current_contract_id is not null
  and (
    contract.id is null
    or contract.status not in ('brouillon', 'pret_a_signer', 'signe', 'resiliation_programmee')
  );

select
  policyname,
  tablename,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('houses', 'rental_requests', 'contracts')
order by tablename, policyname;
