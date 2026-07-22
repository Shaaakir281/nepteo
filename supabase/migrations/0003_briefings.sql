-- Briefing hebdomadaire en langage naturel (Phase 2, lecture seule / insight).
-- Un seul briefing courant par organisation (rafraîchi à chaque analyse).

create table briefings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  content text not null,               -- résumé en langage naturel
  stats jsonb not null default '{}'::jsonb, -- chiffres réels ayant servi au résumé
  created_at timestamptz not null default now()
);

alter table briefings enable row level security;
create policy briefings_select on briefings for select using (is_member(organization_id));
-- Écritures : service role uniquement (généré côté serveur, à l'analyse).
