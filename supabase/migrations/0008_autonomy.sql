-- Niveau d'autonomie de l'agent, par organisation (Phase 3).
-- 'suggest'  : l'agent propose seulement — aucune exécution, même validée.
-- 'prepare'  : l'agent prépare les actions validées (mode sûr, aucun envoi) — défaut.
-- (Extensible plus tard : exécution directe des actions réversibles.)

alter table organizations
  add column if not exists autonomy_level text not null default 'prepare'
    check (autonomy_level in ('suggest', 'prepare'));
