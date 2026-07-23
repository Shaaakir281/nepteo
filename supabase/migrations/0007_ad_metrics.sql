-- Statistiques de campagnes payantes (lecture seule) — Meta Ads d'abord, en
-- données de démo (fictives), même patron que les connecteurs de lecture.
-- L'API réelle (Meta Insights) écrira les mêmes lignes. Métriques orientées
-- vente/revenu (conversions, revenu → ROAS/CAC), pas de vanité.

create table ad_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,               -- 'meta_ads' | 'google_ads' | …
  campaign_id text not null,
  campaign_name text not null,
  date date not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(12,2) not null default 0,       -- €
  conversions integer not null default 0,
  revenue numeric(12,2) not null default 0,     -- €
  synced_at timestamptz not null default now(),
  unique (organization_id, provider, campaign_id, date) -- idempotence du sync
);

create index ad_metrics_org_idx on ad_metrics (organization_id, provider, date desc);

alter table ad_metrics enable row level security;
create policy ad_metrics_select on ad_metrics
  for select using (is_member(organization_id));
-- Écritures : service role uniquement (sync/seed côté serveur, journalisé).
