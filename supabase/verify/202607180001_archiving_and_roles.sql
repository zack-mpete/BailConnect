-- Read-only verification for archive visibility and contract role restrictions.

select
  count(*) filter (where is_archived) as archived_houses,
  count(*) filter (where is_archived and status = 'Loué') as archived_rented_houses,
  count(*) filter (
    where not is_archived
      and is_valid
      and status = 'Disponible'
  ) as public_catalog_houses
from public.houses;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'can_access_house',
    'guard_rental_request_decision_owner',
    'request_contract_termination',
    'finalize_contract_termination'
  )
order by routine_name;

select
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'rental_requests_guard_owner_decision';
