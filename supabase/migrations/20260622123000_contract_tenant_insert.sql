-- Allows the direct agreement flow: a tenant can create a contract for a house
-- when clicking "Je suis d'accord".

drop policy if exists "contracts_tenant_insert" on contracts;
create policy "contracts_tenant_insert" on contracts for insert with check (
  auth.uid() = tenant_id
  and exists (
    select 1
    from houses
    where houses.id = contracts.house_id
      and houses.owner_id = contracts.owner_id
      and houses.owner_id <> auth.uid()
  )
);
