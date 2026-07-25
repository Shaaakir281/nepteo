-- Recherche web (Perplexity) — cache + traçabilité des appels facturés.
-- Une ligne par (organisation, type, sujet) : on ne paie jamais deux fois la
-- même recherche tant qu'elle est fraîche (cf. CACHE_DAYS dans research-rules).
-- Lecture par les membres (RLS), écriture par le service-role uniquement.

create table research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('company_profile', 'prospect_company')),
  subject_key text not null,
  subject_label text not null default '',
  query text not null,
  answer text not null default '',
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'ok' check (status in ('ok', 'failed')),
  created_at timestamptz not null default now(),
  unique (organization_id, kind, subject_key)
);

-- Comptage du plafond quotidien par organisation.
create index research_runs_org_created
  on research_runs (organization_id, created_at desc);

alter table research_runs enable row level security;

create policy research_runs_select on research_runs for select
  using (is_member(organization_id));
