/**
 * Conseil créatif — parties pures (aucun import `@/`, testable node:test).
 * Produit un brief créatif AGNOSTIQUE DU CANAL (pub, newsletter, réseaux…),
 * exploitable ensuite par un humain ou une IA de génération. Le repli déterministe
 * garantit un brief correct sans LLM. « Ce qui marche dans le secteur » = bonnes
 * pratiques générales (connaissance du modèle), pas une veille temps réel.
 */

export const CREATIVE_CHANNELS = ["indifferent", "pub", "newsletter", "social"] as const;
export type CreativeChannel = (typeof CREATIVE_CHANNELS)[number];

export const CHANNEL_LABELS: Record<CreativeChannel, string> = {
  indifferent: "Indifférent",
  pub: "Publicité (Meta, Google…)",
  newsletter: "Newsletter / email",
  social: "Réseaux sociaux",
};

export interface CreativeSeed {
  objectif: string;
  canal: CreativeChannel;
  activite: string; // secteur / activité
  offre: string; // produit ou offre mis en avant
  cibles: string; // à qui on s'adresse
  ton: string; // ton de marque
}

const clean = (s: string) => s.trim();

/** Brief créatif de repli, déterministe. Structure claire, prête à transmettre. */
export function templateCreativeBrief(seed: CreativeSeed): string {
  const objectif = clean(seed.objectif) || "faire connaître l'offre";
  const activite = clean(seed.activite);
  const offre = clean(seed.offre) || activite || "votre offre";
  const cibles = clean(seed.cibles);
  const ton = clean(seed.ton) || "clair, chaleureux, direct";
  const canal = CHANNEL_LABELS[seed.canal];

  const lines: string[] = [
    `Objectif : ${objectif}.`,
    `Produit / offre mis en avant : ${offre}.`,
    cibles ? `Cible : ${cibles}.` : `Cible : à préciser.`,
    `Canal visé : ${canal}.`,
    `Ton : ${ton}.`,
    ``,
    `Angles créatifs recommandés :`,
    `- Le bénéfice concret : ce que le client gagne, tout de suite.`,
    `- La preuve : un résultat, un chiffre, un témoignage crédible.`,
    `- L'objection levée : répondre au frein principal à l'achat.`,
    ``,
    `Ce qui marche souvent dans ce secteur${activite ? ` (${activite})` : ""} :`,
    `- Un message simple, une seule promesse par création.`,
    `- Un visuel qui montre le produit en situation réelle.`,
    `- Un appel à l'action explicite et une offre limitée dans le temps.`,
    `(Bonnes pratiques générales du secteur — à confirmer avec vos données réelles.)`,
    ``,
    `Accroches possibles :`,
    `- « ${offre} : ${objectif} sans y passer vos soirées. »`,
    `- « Et si ${objectif.toLowerCase()} devenait simple ? »`,
    ``,
    `Message clé : en une phrase, pourquoi choisir ${offre} maintenant.`,
    `Appel à l'action : proposer une étape simple (essai, prise de contact, achat).`,
    ``,
    `Prêt à transmettre à un créateur (pub, réseaux, newsletter) ou à une IA de génération.`,
  ];
  return lines.join("\n");
}
