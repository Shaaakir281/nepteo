-- Journal entries are immutable historical records. Keep action_id as the
-- recorded identifier even after the operational action has been deleted.
--
-- ON DELETE SET NULL cannot coexist with the journal_no_update trigger:
-- PostgreSQL would update journal, and the append-only trigger rejects it.
alter table public.journal
  drop constraint if exists journal_action_id_fkey;
