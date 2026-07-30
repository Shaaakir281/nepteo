-- Ferme l'unique policy d'écriture directe accordée aux membres.
--
-- Toutes les écritures de company_memory passent déjà par des Server Actions
-- utilisant le service role après vérification du rôle et journalisation.
-- Les clients authentifiés gardent la lecture de leur organisation, mais aucune
-- policy INSERT/UPDATE/DELETE : PostgreSQL refuse donc ces écritures via RLS.

drop policy if exists memory_all on public.company_memory;

create policy company_memory_select
  on public.company_memory
  for select
  using (is_member(organization_id));
