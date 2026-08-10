"use client";

import { useMemo, useState } from "react";
import type { CatalogTool } from "@/lib/connectors";
import type { DemoPresentation } from "@/lib/demo/presentation-rules";
import { ConnectorCard, type ConnectorStatus } from "./connector-card";

export interface CatalogEntry {
  category: string;
  tool: CatalogTool;
  status: ConnectorStatus;
  justRequested: boolean;
}

type StateFilter = "all" | "connected" | "available";

function isConnected(status: ConnectorStatus) {
  return ["connected", "configured", "paused", "error"].includes(status);
}

export function ConnectorCatalog({
  entries,
  categories,
  canEdit,
  blockedByDemo,
  demoPresentation,
}: {
  entries: CatalogEntry[];
  categories: string[];
  canEdit: boolean;
  blockedByDemo: boolean;
  demoPresentation: DemoPresentation;
}) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [category, setCategory] = useState("all");
  const connectedCount = entries.filter((entry) => isConnected(entry.status)).length;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr-FR");
    return [...entries]
      .sort((a, b) => Number(isConnected(b.status)) - Number(isConnected(a.status)))
      .filter((entry) => !normalized || entry.tool.name.toLocaleLowerCase("fr-FR").includes(normalized))
      .filter((entry) => category === "all" || entry.category === category)
      .filter((entry) => stateFilter === "all" || (stateFilter === "connected" ? isConnected(entry.status) : !isConnected(entry.status)));
  }, [category, entries, query, stateFilter]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="min-w-52 flex-1">
          <span className="sr-only">Rechercher un connecteur</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un connecteur"
            className="w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[12.5px] text-ink outline-none focus:border-violet"
          />
        </label>
        {(["all", "connected", "available"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={stateFilter === filter}
            onClick={() => setStateFilter(filter)}
            className="rounded-full border border-line px-3 py-1.5 text-[11.5px] font-semibold text-body aria-pressed:border-violet aria-pressed:bg-tint aria-pressed:text-violet-ink"
          >
            {filter === "all" ? "Tous" : filter === "connected" ? "Branchés" : "Disponibles"}
          </button>
        ))}
        <select
          aria-label="Filtrer par catégorie"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-[10px] border border-line bg-white px-3 py-2 text-[11.5px] font-semibold text-body"
        >
          <option value="all">5 catégories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <p
        className="mb-3 w-fit text-[11.5px] font-semibold text-muted"
        title="Ce catalogue distingue les connexions réellement disponibles des intégrations proposées. « Demander l’intégration » enregistre uniquement votre intérêt : aucun accès, synchronisation ou échange de données n’est ouvert par cette action."
      >
        {connectedCount} branché{connectedCount > 1 ? "s" : ""} sur {entries.length} <span aria-hidden="true">ⓘ</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((entry) => (
          <ConnectorCard
            key={entry.tool.provider}
            tool={entry.tool}
            status={entry.status}
            canEdit={canEdit}
            blockedByDemo={blockedByDemo}
            demoPresentation={demoPresentation}
            justRequested={entry.justRequested}
          />
        ))}
      </div>
      {filtered.length === 0 && <p className="rounded-[13px] bg-tint-soft p-4 text-[12.5px] text-muted">Aucun connecteur ne correspond à ce filtre.</p>}
    </section>
  );
}
