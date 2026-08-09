export const CREATIVE_IMAGE_FORMATS = {
  story: {
    label: "Story",
    detail: "Instagram · Facebook",
    ratio: "9:16",
    size: "1008x1792",
  },
  square: {
    label: "Post carré",
    detail: "Instagram · LinkedIn",
    ratio: "1:1",
    size: "1024x1024",
  },
  landscape: {
    label: "Paysage",
    detail: "LinkedIn · publicité",
    ratio: "3:2",
    size: "1536x1024",
  },
} as const;

export type CreativeImageFormat = keyof typeof CREATIVE_IMAGE_FORMATS;

export function isCreativeImageFormat(
  value: unknown,
): value is CreativeImageFormat {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CREATIVE_IMAGE_FORMATS, value)
  );
}

export function buildCreativeImagePrompt(input: {
  objective: string;
  format: CreativeImageFormat;
  activity?: string;
  offer?: string;
  audience?: string;
  tone?: string;
  colors?: string;
}): string {
  const spec = CREATIVE_IMAGE_FORMATS[input.format];
  const brand = [
    input.activity && `activité : ${input.activity}`,
    input.offer && `offre : ${input.offer}`,
    input.audience && `public : ${input.audience}`,
    input.tone && `ton : ${input.tone}`,
    input.colors && `repères de marque : ${input.colors}`,
  ]
    .filter(Boolean)
    .join(" ; ");

  return [
    `Crée un visuel marketing premium au format ${spec.label} (${spec.ratio}).`,
    `Objectif : ${input.objective.trim()}.`,
    brand ? `Contexte de marque : ${brand}.` : "Marque : sobre, chaleureuse et crédible.",
    "Direction artistique : photographie éditoriale contemporaine, composition claire, humaine, élégante, naturelle, sans effet publicitaire générique.",
    "Réserve une zone calme et contrastée dans le tiers supérieur pour un titre ajouté ensuite par l'application, et une zone libre en bas pour un bouton.",
    "N'ajoute aucun texte, aucune lettre, aucun logo inventé, aucun filigrane et aucune interface dans l'image.",
    "Une seule idée visuelle forte, lumière naturelle, détails réalistes, rendu immédiatement publiable.",
  ].join("\n");
}

export function storyHeadline(objective: string, max = 72): string {
  const clean = objective.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
