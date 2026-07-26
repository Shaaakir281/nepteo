import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const initialSchema = await readFile(
  new URL("../supabase/migrations/0001_init.sql", import.meta.url),
  "utf8",
);
const executionSchema = await readFile(
  new URL("../supabase/migrations/0006_execution.sql", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/0011_drop_journal_action_fk.sql",
    import.meta.url,
  ),
  "utf8",
);

test("B2 removes only the journal action foreign key", () => {
  assert.match(
    initialSchema,
    /action_id uuid references actions\(id\) on delete set null/i,
  );
  assert.match(
    executionSchema,
    /action_id uuid not null references actions\(id\) on delete cascade/i,
  );
  assert.match(
    migration,
    /alter table public\.journal\s+drop constraint if exists journal_action_id_fkey/i,
  );

  assert.doesNotMatch(migration, /\b(?:drop|disable)\s+trigger\b/i);
  assert.doesNotMatch(migration, /\bforbid_journal_mutation\b/i);
  assert.doesNotMatch(migration, /\boutbox_messages\b/i);
  assert.doesNotMatch(migration, /\bdrop\s+column\b/i);
  assert.doesNotMatch(migration, /\bcreate\s+table\b/i);
});
