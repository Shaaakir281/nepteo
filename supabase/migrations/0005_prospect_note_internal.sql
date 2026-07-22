-- Note interne Nepteo par prospect (Phase 2) — saisie DANS Nepteo, distincte de
-- la colonne `notes` mappée depuis la source. Le sync (upsert depuis la source)
-- n'écrit jamais cette colonne, donc elle n'est jamais écrasée par une resync.
-- La synchro bidirectionnelle vers la source (écriture externe) = Phase 3.

alter table prospects add column if not exists note_internal text;
