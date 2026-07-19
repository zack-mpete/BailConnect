-- Read-only verification for the boolean listing validation migration.

select
  count(*) filter (where is_valid and not is_archived and status = 'Disponible') as public_houses,
  count(*) filter (where not is_valid and publication_rejection_reason is null) as pending_houses,
  count(*) filter (where not is_valid and publication_rejection_reason is not null) as rejected_houses,
  count(*) filter (where is_archived) as archived_houses
from public.houses;

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'houses'
  and column_name in ('is_valid', 'is_archived', 'publication_status')
order by column_name;

select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('houses', 'rental_requests')
order by tablename, policyname;
