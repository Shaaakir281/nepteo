-- C8 — Le temps dans la relance.
-- Date du dernier contact connue dans la source. Nullable : en l'absence de
-- colonne mappée, le comportement historique reste strictement inchangé.
alter table prospects
  add column if not exists last_contact_at date;
