-- Prospects synchronisés depuis les connecteurs (lecture seule, Phase 1)

create table prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  connector_id uuid not null references connectors(id) on delete cascade,
  external_id text not null,
  name text,
  email text,
  company text,
  stage text,
  source text not null, -- 'google_sheets' | 'notion' | …
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (connector_id, external_id) -- idempotence du sync
);

create index prospects_org_idx on prospects (organization_id, synced_at desc);

alter table prospects enable row level security;
create policy prospects_select on prospects for select using (is_member(organization_id));
-- Écritures : service role uniquement (sync côté serveur, journalisé).
