/**
 * Plan marketing du mois — parties pures (aucun import `@/`, testable).
 * L'agent joue le directeur marketing : à partir de ce qu'il sait déjà (funnel,
 * pubs, mémoire), il ORCHESTRE une poignée de mouvements cohérents et priorisés,
 * chacun pointant vers l'écran où agir. Aucune action créée ici (vue stratégique
 * en lecture seule) — les propositions concrètes vivent dans leurs flux existants.
 */

export interface PlanSignals {
  offre: string;
  priorityCount: number;
  noEmailCount: number;
  losingCampaigns: string[];
  bestCampaign?: { name: string; roas: number } | null;
}

export interface PlanMove {
  title: string;
  why: string;
  channel: "Publicité" | "Email" | "Contenu" | "Données";
  impact: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface MarketingPlan {
  intro: string;
  budgetIndicatif: number; // € de budget pub proposé ce mois
  moves: PlanMove[];
}

const CAMPAIGN_MONTH_BUDGET = 140; // 10 €/j × 14 j (aligné sur buildCampaignPlan)

/** Assemble le plan du mois, priorisé par levier : couper les pertes, activer
 *  les contacts chauds, acquérir, alimenter le contenu, puis nettoyer les données. */
export function buildMarketingPlan(signals: PlanSignals): MarketingPlan {
  const moves: PlanMove[] = [];
  const offre = (signals.offre ?? "").trim();

  // 1. Couper les pertes (levier immédiat, ne coûte rien).
  if (signals.losingCampaigns[0]) {
    const name = signals.losingCampaigns[0];
    moves.push({
      title: `Couper « ${name} » et réallouer le budget`,
      why: "Cette campagne coûte plus qu'elle ne rapporte — chaque jour de plus est une perte sèche.",
      channel: "Publicité",
      impact: "Budget économisé, réinjectable là où ça convertit",
      ctaLabel: "Voir dans Campagnes",
      ctaHref: "/campagnes",
    });
  }

  // 2. Réactiver les contacts prêts (fort levier, coût = temps).
  if (signals.priorityCount >= 3) {
    moves.push({
      title: `Relancer les ${signals.priorityCount} prospects prêts`,
      why: "Ils sont joignables et encore actifs : les recontacter d'abord concentre l'effort là où il peut aboutir.",
      channel: "Email",
      impact: `${signals.priorityCount} contacts réactivés`,
      ctaLabel: "Voir la relance à valider",
      ctaHref: "/",
    });
  }

  // 3. Renforcer la meilleure campagne, si elle est nettement rentable.
  if (signals.bestCampaign && signals.bestCampaign.roas >= 2) {
    moves.push({
      title: `Renforcer « ${signals.bestCampaign.name} »`,
      why: `Meilleur ROAS (${signals.bestCampaign.roas.toFixed(1)}×) : y remettre du budget amplifie ce qui marche déjà.`,
      channel: "Publicité",
      impact: "Plus de contacts au même coût unitaire",
      ctaLabel: "Voir dans Campagnes",
      ctaHref: "/campagnes",
    });
  }

  // 4. Alimenter le haut du funnel : une campagne d'acquisition.
  if (offre) {
    moves.push({
      title: `Lancer une campagne d'acquisition pour ${offre}`,
      why: "Le funnel a besoin d'entrées neuves : une campagne ciblée nourrit les relances de demain.",
      channel: "Publicité",
      impact: `~${CAMPAIGN_MONTH_BUDGET} € · 3–5 contacts estimés`,
      ctaLabel: "Nouvelle campagne",
      ctaHref: "/campagnes",
    });
  }

  // 5. Contenu : entretenir la présence.
  moves.push({
    title: offre ? `Publier un contenu qui met en avant ${offre}` : "Publier un contenu ce mois-ci",
    why: "Un contenu régulier réchauffe l'audience et donne de la matière aux campagnes.",
    channel: "Contenu",
    impact: "Audience entretenue, matière pour les pubs",
    ctaLabel: "Idées de contenu",
    ctaHref: "/contenu",
  });

  // 6. Hygiène de données, si beaucoup d'emails manquent.
  if (signals.noEmailCount >= 3) {
    moves.push({
      title: `Compléter ${signals.noEmailCount} emails manquants`,
      why: "Sans email, ces prospects sont injoignables : les compléter débloque autant de relances possibles.",
      channel: "Données",
      impact: `${signals.noEmailCount} prospects rendus joignables`,
      ctaLabel: "Voir à valider",
      ctaHref: "/",
    });
  }

  const budgetIndicatif = offre ? CAMPAIGN_MONTH_BUDGET : 0;

  // Intro stratégique, assemblée selon les leviers présents.
  const axes: string[] = [];
  if (signals.losingCampaigns[0]) axes.push("arrêter les pertes");
  if (signals.priorityCount >= 3) axes.push("réactiver les contacts chauds");
  if (offre) axes.push("alimenter le haut du funnel");
  const intro =
    axes.length > 0
      ? `Ce mois-ci, priorité : ${axes.join(", ")}.`
      : "Ce mois-ci, on entretient la présence et on prépare le terrain.";

  return { intro, budgetIndicatif, moves: moves.slice(0, 5) };
}
