"use client";

import { useEffect, useState } from "react";

/**
 * Bulle de guidage : dit quoi faire sur l'écran où l'on se trouve.
 * Refermable, et une fois fermée elle ne revient plus (mémorisé dans le
 * navigateur). Destinée au test bêta — elle disparaît d'elle-même à l'usage,
 * sans jamais bloquer l'écran.
 */

interface Tip {
  title: string;
  body: string;
  /** Ce qu'il faut regarder, pas seulement ce qu'il faut cliquer. */
  watch?: string;
}

const TIPS: Record<string, Tip> = {
  today: {
    title: "Commencez ici",
    body: "Cliquez sur « Analyser » : l'agent lit vos données, résume la situation et propose des actions. Ouvrez une proposition pour voir son raisonnement et le message déjà rédigé.",
    watch: "Chaque proposition affiche son constat, sa raison, l'impact attendu et sa confiance — rien n'est une boîte noire.",
  },
  prospects: {
    title: "Votre base, vue par l'agent",
    body: "Le kanban range vos contacts par statut. Le repère de priorité combine le statut et ce qu'on sait du contact — aucun score inventé.",
    watch: "Les fiches sans email ou sans statut sont exactement ce que l'agent propose de corriger.",
  },
  campagnes: {
    title: "Ce que rapporte chaque campagne",
    body: "Cliquez sur « Analyser mes campagnes » : l'agent repère celles qui coûtent plus qu'elles ne rapportent et propose de les couper. La proposition part dans « Aujourd'hui ».",
    watch: "Le ROAS en rouge, c'est de l'argent perdu chaque jour où la campagne tourne.",
  },
  contenu: {
    title: "L'agent propose, vous choisissez",
    body: "Pas de page blanche : les idées viennent de ce que l'agent sait déjà de vous. Cliquez sur l'une d'elles pour obtenir un brief exploitable.",
    watch: "Le brief est prêt à transmettre à un créateur ou à une IA de génération.",
  },
  plan: {
    title: "Le cap du mois",
    body: "L'agent orchestre ce qu'il sait en quelques mouvements priorisés : couper les pertes d'abord, réactiver les contacts chauds ensuite, alimenter le haut du funnel enfin.",
    watch: "Chaque mouvement renvoie vers l'écran où agir — c'est une stratégie, pas une liste de tâches.",
  },
  agent: {
    title: "Vous gardez la main",
    body: "Chargez un scénario de démonstration pour remplir le cockpit sans brancher d'outil. Le bouton d'arrêt et les plafonds s'appliquent côté serveur, jamais seulement à l'écran.",
    watch: "Passez l'autonomie sur « Proposer seulement » : une action validée refusera de s'exécuter.",
  },
  entreprise: {
    title: "La mémoire de l'agent",
    body: "Tout ce qui est ici nourrit les messages, les briefs et les recommandations. Plus c'est juste, meilleures sont les propositions.",
    watch: "La « Philosophie » est ce qui donne sa voix à l'agent — c'est le champ le plus sous-estimé.",
  },
};

export function CoachBubble({ id }: { id: keyof typeof TIPS | string }) {
  const tip = TIPS[id];
  const storageKey = `nepteo.coach.${id}`;
  // On ne rend rien au premier passage : évite un clignotement et tout
  // désaccord entre le rendu serveur et le navigateur.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) !== "done") setVisible(true);
    } catch {
      setVisible(true); // stockage indisponible : on affiche quand même
    }
  }, [storageKey]);

  if (!tip || !visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(storageKey, "done");
    } catch {
      /* sans stockage, la bulle réapparaîtra — sans conséquence */
    }
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-violet/25 bg-gradient-to-b from-[#fbfbff] to-[#f4f3fc] px-4 py-3.5">
      <span className="mt-[2px] grid h-6 w-6 flex-none place-items-center rounded-full bg-violet text-[12px] font-bold text-white">
        ?
      </span>
      <div className="flex-1">
        <h4 className="font-display text-[13px] font-semibold text-ink">
          {tip.title}
        </h4>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-body">{tip.body}</p>
        {tip.watch && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            <b className="text-ink">À observer :</b> {tip.watch}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer ce conseil"
        className="flex-none rounded-[7px] px-2 py-1 text-[12px] font-semibold text-muted transition hover:bg-white hover:text-ink"
      >
        Compris
      </button>
    </div>
  );
}
