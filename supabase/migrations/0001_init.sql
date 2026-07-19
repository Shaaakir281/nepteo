-- Nepteo — schéma initial (Phase 1)
-- Multi-tenant : 1 organization = 1 client. RLS partout.

create extension if not exists "pgcrypto";

-- ============ Organisations & membres ============

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  activity text,
  created_at timestamptz not null default now()
);

create table memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','marketing','commercial','direction','lecture')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ============ Mémoire entreprise ============

create table company_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  section text not null, -- ex: 'offres', 'cibles', 'ton', 'objectifs', 'observations'
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, section)
);

-- ============ Connecteurs ============
-- credentials chiffrés applicativement (CONNECTOR_TOKEN_ENCRYPTION_KEY),
-- jamais stockés en clair.

create table connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('crm','analytics','ads','email','payments','files')),
  provider text not null, -- ex: 'hubspot', 'ga4', 'meta_ads', 'stripe'
  status text not null default 'disconnected' check (status in ('connected','disconnected','error')),
  encrypted_credentials text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, provider)
);

-- ============ Actions (centre de validation) ============

create table actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null,               -- ex: 'send_followup_email'
  title text not null,
  finding text not null,            -- constat
  rationale text not null,          -- raison
  data_sources text[] not null default '{}',
  expected_impact text,
  confidence numeric(3,2) check (confidence between 0 and 1),
  risk text not null default 'low' check (risk in ('low','medium','high')),
  status text not null default 'proposed'
    check (status in ('proposed','approved','rejected','postponed','executed','failed')),
  idempotency_key text unique,      -- posé avant toute exécution externe
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz
);

create index actions_org_status_idx on actions (organization_id, status, created_at desc);

-- ============ Journal (append-only) ============

create table journal (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  action_id uuid references actions(id) on delete set null,
  event text not null,              -- ex: 'action_proposed', 'execution_started'
  actor text not null check (actor in ('agent','user')),
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index journal_org_idx on journal (organization_id, created_at desc);

-- Append-only : ni update ni delete, même pour les rôles applicatifs.
create or replace function forbid_journal_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'journal is append-only';
end $$;

create trigger journal_no_update before update or delete on journal
  for each row execute function forbid_journal_mutation();

-- ============ RLS ============

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table company_memory enable row level security;
alter table connectors enable row level security;
alter table actions enable row level security;
alter table journal enable row level security;

-- Helper : l'utilisateur est-il membre de l'organisation ?
create or replace function is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where organization_id = org and user_id = auth.uid()
  );
$$;

create policy org_select on organizations for select using (is_member(id));
create policy memberships_select on memberships for select using (is_member(organization_id));
create policy memory_all on company_memory for all
  using (is_member(organization_id)) with check (is_member(organization_id));
create policy connectors_select on connectors for select using (is_member(organization_id));
create policy actions_select on actions for select using (is_member(organization_id));
create policy journal_select on journal for select using (is_member(organization_id));

-- Écritures sensibles (connectors, actions, journal, organizations) :
-- via service role côté serveur uniquement — les garde-fous vivent dans l'app,
-- les policies d'écriture fines seront ajoutées avec l'auth en Phase 1.
