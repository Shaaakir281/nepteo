-- Notes personnelles par prospect (Phase 2, lecture seule) — sert à
-- personnaliser les brouillons. Toutes les colonnes d'origine restent dans `raw` ;
-- `notes` est le champ dédié désigné via la correspondance de colonnes.

alter table prospects add column if not exists notes text;
