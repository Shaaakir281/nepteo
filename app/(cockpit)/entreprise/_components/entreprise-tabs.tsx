import Link from "next/link";

/**
 * Onglets de « Mon entreprise » — Identité · Connecteurs · Agent.
 *
 * Ces trois écrans étaient trois entrées de navigation ; ils répondent à une
 * seule question (« ce que Nepteo sait et ce qu'il a le droit de faire »), d'où
 * le regroupement. Les anciennes URLs `/connecteurs` et `/agent` redirigent
 * vers l'onglet correspondant : aucun lien existant ne casse.
 *
 * Composant SERVEUR : l'onglet actif vient de `?onglet=`, pas d'un état client.
 */

export const TABS = [
  { id: "identite", label: "Identité", href: "/entreprise" },
  { id: "connecteurs", label: "Connecteurs", href: "/entreprise?onglet=connecteurs" },
  { id: "agent", label: "Agent", href: "/entreprise?onglet=agent" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** Onglet demandé, ou « Identité » par défaut (valeur inconnue = défaut). */
export function resolveTab(value: string | undefined): TabId {
  const found = TABS.find((t) => t.id === value);
  return found ? found.id : "identite";
}

export function EntrepriseTabs({ active }: { active: TabId }) {
  return (
    <div className="mb-5 flex gap-1 border-b border-line-soft">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px rounded-t-[10px] border-b-2 px-3.5 py-2 text-[13.5px] transition ${
              on
                ? "border-violet font-semibold text-violet-ink"
                : "border-transparent font-medium text-muted hover:bg-tint-soft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
