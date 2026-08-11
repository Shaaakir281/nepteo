import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { journalEventLabel } from "../lib/journal.ts";

const source = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const files = {
  prospects: source("../app/(cockpit)/prospects/page.tsx"),
  board: source("../app/(cockpit)/prospects/_components/prospects-board.tsx"),
  prospectFilters: source("../app/(cockpit)/prospects/_components/prospect-filters.tsx"),
  countSummary: source("../app/(cockpit)/prospects/_components/prospect-count-summary.tsx"),
  journal: source("../app/(cockpit)/journal/page.tsx"),
  journalRow: source("../app/(cockpit)/journal/_components/journal-row.tsx"),
  outbox: source("../app/(cockpit)/journal/_components/prepared-outbox.tsx"),
  nav: source("../app/(cockpit)/_components/nav.tsx"),
};

test("UX-7 — les types du journal ont un libellé français et un repli fidèle", () => {
  assert.equal(journalEventLabel("action_approved"), "Action validée");
  assert.equal(journalEventLabel("campaign_waiting"), "Campagne mise en attente");
  assert.equal(journalEventLabel("future_event_type"), "future_event_type");
});

test("UX-7 — Prospects met les chiffres avant l'explication et garde l'aide accessible", () => {
  assert.match(files.prospects, /<ProspectCountSummary[\s\S]*total=\{prospectCohort\.dedupedCount\}[\s\S]*relaunchable=\{actionablePriorityCount\}/);
  assert.match(files.countSummary, /Deux comptages, deux usages/);
  assert.match(files.countSummary, /tabIndex=\{0\}/);
  assert.match(files.countSummary, /peer-hover:visible[\s\S]*peer-focus:visible/);
  assert.match(files.countSummary, /calc\(100vw-4rem\)/);
  assert.match(files.prospects, /Aucun board,[\s\S]*total ou taux partiel/);
});

test("UX-7 — les filtres Prospects réutilisent les cohortes serveur", () => {
  assert.match(files.prospectFilters, /Tous/);
  assert.match(files.prospectFilters, /Relançables/);
  assert.match(files.prospectFilters, /Dormants/);
  assert.doesNotMatch(files.prospectFilters, /use client/);
  assert.match(files.prospects, /actionableIds\.has\(prospect\.id\)/);
  assert.match(files.prospects, /selectDormantProspects\(prospectCohort\.canonicalRows, today, 30\)/);
});

test("UX-7 — chaque prospect tient sur une ligne avant son détail", () => {
  assert.match(files.board, /<details[\s\S]*<summary[\s\S]*contactDelay\(prospect, today\)[\s\S]*<\/summary>/);
  assert.match(files.board, /title=\{prospect\.company/);
  assert.doesNotMatch(files.board, /Dernier contact/);
});

test("UX-7 — Journal filtre les acteurs en un clic et replie le type", () => {
  assert.match(files.journal, /Filtrer le journal par acteur/);
  assert.match(files.journal, /href=\{journalHref\(\{ actor: filter\.value, event \}\)\}/);
  assert.match(files.journal, /<details[\s\S]*Filtrer par type d&apos;événement/);
  assert.doesNotMatch(files.journal, />\s*Filtrer\s*</);
});

test("UX-7 — chaque événement conserve type technique et payload dans son détail", () => {
  assert.match(files.journalRow, /journalEventLabel\(entry\.event\)/);
  assert.match(files.journalRow, /Type technique[\s\S]*entry\.event/);
  assert.match(files.journalRow, /JSON\.stringify\(entry\.payload \?\? \{\}, null, 2\)/);
  assert.match(files.journalRow, /Charge utile/);
});

test("UX-7 — Envois préparés est replié avec compteur et garantie", () => {
  assert.match(files.outbox, /<details/);
  assert.match(files.outbox, /Envois préparés/);
  assert.match(files.outbox, /preparedCount \?\? 0/);
  assert.match(files.outbox, /la préparation n&apos;est pas un envoi/);
});

test("UX-7 — rôle commercial exclu, pagination et journal complet préservés", () => {
  assert.match(files.journal, /membership\.role === "commercial"\) redirect\("\/"\)/);
  assert.match(files.nav, /label: "Journal"[\s\S]*requiresFinancialAccess: true/);
  assert.match(files.journal, /\.range\(\(page - 1\) \* PAGE_SIZE, page \* PAGE_SIZE - 1\)/);
  assert.match(files.journal, /days\.map[\s\S]*day\.items\.map/);
  assert.match(files.journal, /Rien n&apos;est effacé de ce journal/);
});

test("UX-7 — tous les composants touchés restent sous 250 lignes", () => {
  for (const [name, content] of Object.entries(files)) {
    assert.ok(content.split(/\r?\n/).length < 250, `${name} dépasse 249 lignes`);
  }
});
