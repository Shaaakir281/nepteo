-- Phase 3 — colonne vertébrale d'exécution (mode sûr : préparation, pas d'envoi).
-- Non négociables : idempotence + journal AVANT toute exécution, garde-fous serveur,
-- bouton d'arrêt. L'envoi externe réel (SMTP) viendra brancher outbox_messages.

-- Bouton d'arrêt au niveau de l'organisation : bloque toute exécution.
alter table organizations
  add column if not exists execution_paused boolean not null default false;

-- Boîte d'envoi : un message préparé par destinataire. En mode sûr, statut
-- 'prepared' (enregistré, PAS envoyé). L'étape SMTP passera à 'sent'/'failed'.
create table outbox_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  action_id uuid not null references actions(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'prepared'
    check (status in ('prepared','sent','failed')),
  idempotency_key text unique,      -- posé avant préparation : pas de double
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index outbox_org_idx on outbox_messages (organization_id, created_at desc);

alter table outbox_messages enable row level security;
create policy outbox_select on outbox_messages
  for select using (is_member(organization_id));
-- Écritures : service role uniquement (exécution côté serveur, journalisée).
