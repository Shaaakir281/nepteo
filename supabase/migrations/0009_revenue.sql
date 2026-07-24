-- Revenu réel (lecture seule) — connecteur paiements (Stripe…) en données de démo
-- d'abord, même patron que les autres connecteurs. La métrique qui compte
-- vraiment (vente/revenu), pour prioriser les actions par ROI et non par vanité.

create table revenue_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source text not null,               -- 'stripe' | …
  external_id text not null,
  label text,                         -- produit / description
  amount numeric(12,2) not null default 0, -- €
  occurred_on date not null,
  synced_at timestamptz not null default now(),
  unique (organization_id, source, external_id) -- idempotence du sync
);

create index revenue_org_idx on revenue_events (organization_id, occurred_on desc);

alter table revenue_events enable row level security;
create policy revenue_select on revenue_events
  for select using (is_member(organization_id));
-- Écritures : service role uniquement (sync/seed côté serveur, journalisé).
