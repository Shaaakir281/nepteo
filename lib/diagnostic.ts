/**
 * Diagnostic de départ — parties pures (aucun import, testable node:test).
 *
 * Étape 3 du chantier « onboarding enrichi » : à partir de la SEULE identité de
 * l'entreprise, avant tout connecteur, l'agent dit par où commencer — deux ou
 * trois canaux, pourquoi, et le premier geste concret.
 *
 * Deux règles de conduite :
 * - **Trois canaux maximum.** Un solopreneur qui reçoit six pistes n'en suit
 *   aucune. Le bornage est une décision produit, pas une limite technique.
 * - **Dire aussi quoi ÉVITER.** C'est souvent le conseil le plus utile, et c'est
 *   ce qu'aucun outil ne dit parce que ça ne vend pas de fonctionnalité.
 */

export interface DiagnosticInput {
  activityType: string;
  audience: string;
  zone: string;
  /** Offre principale (nom d'offre, sinon activité) — sert à formuler concrètement. */
  offre: string;
  objectifs: string[];
  /** Canaux déjà déclarés par l'utilisateur. */
  canauxActuels: string[];
  /** Communication publique constatée (section mémoire `presence`). */
  presence: string[];
}

export interface ChannelAdvice {
  channel: string;
  why: string;
  firstStep: string;
  effort: "Faible" | "Moyen" | "Élevé";
  cost: string;
  /** L'utilisateur le fait déjà : on le confirme au lieu de le lui apprendre. */
  alreadyDoing: boolean;
}

export interface StarterDiagnostic {
  intro: string;
  channels: ChannelAdvice[];
  /** Ce qu'il vaut mieux ne PAS faire tout de suite, avec la raison. */
  avoid: string[];
  /** Trois gestes pour la première semaine. */
  firstWeek: string[];
  /** Sur quoi ce diagnostic s'appuie — l'utilisateur doit pouvoir le contester. */
  basis: string;
}

export const MAX_CHANNELS = 3;

type Profile = "b2c_local" | "b2b" | "ecommerce" | "saas" | "generic";

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Profil marketing déduit de l'activité et de la clientèle. */
export function detectProfile(input: DiagnosticInput): Profile {
  const activity = fold(input.activityType);
  const audience = fold(input.audience);

  if (activity.includes("commerce")) return "ecommerce";
  if (activity.includes("saas") || activity.includes("application")) return "saas";
  if (audience.includes("entreprise")) return "b2b";
  if (audience.includes("particulier") && input.zone.trim()) return "b2c_local";
  if (audience.includes("particulier")) return "ecommerce";
  return "generic";
}

/** Un canal est-il déjà en place, d'après les déclarations ou les constats ? */
function isAlready(input: DiagnosticInput, keywords: string[]): boolean {
  const haystack = [...input.canauxActuels, ...input.presence].map(fold).join(" | ");
  return keywords.some((k) => haystack.includes(fold(k)));
}

function channelsFor(profile: Profile, input: DiagnosticInput): ChannelAdvice[] {
  const offre = input.offre.trim() || "votre offre";
  const zone = input.zone.trim();

  if (profile === "b2c_local") {
    return [
      {
        channel: "Fiche Google et avis clients",
        why: `Vos clients cherchent « ${offre} ${zone ? `+ ${zone}` : "près de chez moi"} » au moment où ils en ont besoin. Une fiche complète et des avis récents décident à votre place, sans rien dépenser.`,
        firstStep: "Complétez votre fiche (photos, horaires, prestations) et demandez un avis à vos trois derniers clients satisfaits.",
        effort: "Faible",
        cost: "Gratuit",
        alreadyDoing: isAlready(input, ["google"]),
      },
      {
        channel: "Google en recherche locale",
        why: "Vous ne payez que des gens qui cherchent déjà ce que vous vendez — pas une audience à convaincre. C'est le canal le plus rentable quand la demande existe localement.",
        firstStep: `Une seule campagne, sur votre zone, avec les mots exacts de vos clients (« ${offre} »), 10 €/jour pour commencer.`,
        effort: "Moyen",
        cost: "~150 €/mois pour tester",
        alreadyDoing: isAlready(input, ["publicite", "google ads", "annonces google"]),
      },
      {
        channel: "Recommandations, mais organisées",
        why: "C'est déjà votre premier canal, sauf qu'il est laissé au hasard. Le rendre systématique coûte zéro euro et double souvent son rendement.",
        firstStep: "À chaque chantier terminé, un message type qui remercie et demande explicitement de parler de vous.",
        effort: "Faible",
        cost: "Gratuit",
        alreadyDoing: isAlready(input, ["recommandation"]),
      },
    ];
  }

  if (profile === "b2b") {
    return [
      {
        channel: "Prospection directe et ciblée",
        why: "Votre cible se compte en dizaines, pas en dizaines de milliers. À cette échelle, un message personnalisé bien envoyé bat n'importe quelle publicité.",
        firstStep: `Listez 30 entreprises qui ressemblent à vos meilleurs clients, puis contactez-en cinq par semaine avec un angle propre à chacune.`,
        effort: "Élevé",
        cost: "Gratuit (votre temps)",
        alreadyDoing: isAlready(input, ["prospection", "email"]),
      },
      {
        channel: "Recommandations et réseau",
        why: "En B2B, la confiance se transfère. Une introduction par un client vaut vingt appels à froid, et raccourcit un cycle de vente déjà long.",
        firstStep: "Demandez à vos deux meilleurs clients s'ils connaissent une entreprise dans la même situation qu'eux avant de travailler avec vous.",
        effort: "Faible",
        cost: "Gratuit",
        alreadyDoing: isAlready(input, ["recommandation", "evenement", "salon"]),
      },
      {
        channel: "LinkedIn — en contenu d'abord",
        why: `Publier ce que vous savez sur ${offre} vous rend crédible auprès de gens que vous n'avez pas encore contactés. La publicité LinkedIn, elle, est chère : à garder pour plus tard.`,
        firstStep: "Une publication par semaine qui raconte un cas client concret, chiffres et ratés compris.",
        effort: "Moyen",
        cost: "Gratuit en organique",
        alreadyDoing: isAlready(input, ["linkedin", "reseaux sociaux"]),
      },
    ];
  }

  if (profile === "ecommerce") {
    return [
      {
        channel: "Retargeting avant prospection",
        why: "Les gens qui ont déjà vu vos produits convertissent plusieurs fois mieux que des inconnus. Commencer par eux rend tout le reste rentable.",
        firstStep: "Installez le suivi sur votre boutique, puis une seule campagne vers les visiteurs des 30 derniers jours.",
        effort: "Moyen",
        cost: "~100 €/mois pour tester",
        alreadyDoing: isAlready(input, ["retargeting", "publicite"]),
      },
      {
        channel: "Email et abonnement",
        why: "C'est le seul canal que vous possédez : aucun algorithme ne peut vous en couper l'accès, et la deuxième vente n'y coûte presque rien.",
        firstStep: `Une séquence de trois emails après la première commande, qui raconte ${offre} au lieu de la vendre.`,
        effort: "Moyen",
        cost: "Quasi gratuit",
        alreadyDoing: isAlready(input, ["email", "newsletter"]),
      },
      {
        channel: "Google Shopping",
        why: "Capte les gens qui cherchent déjà un produit comme le vôtre, avec le prix affiché. Intention d'achat élevée, concurrence lisible.",
        firstStep: "Publiez votre catalogue et laissez tourner deux semaines avant de toucher aux enchères.",
        effort: "Moyen",
        cost: "~150 €/mois pour tester",
        alreadyDoing: isAlready(input, ["google", "shopping"]),
      },
    ];
  }

  if (profile === "saas") {
    return [
      {
        channel: "Contenu sur le problème, pas sur le produit",
        why: `Vos futurs clients cherchent une solution à leur problème, pas « ${offre} ». Se placer sur leurs questions attire des gens déjà convaincus qu'ils ont besoin d'aide.`,
        firstStep: "Écrivez les cinq questions que vos utilisateurs posent avant de s'inscrire, puis répondez-y sérieusement, une par semaine.",
        effort: "Élevé",
        cost: "Gratuit (votre temps)",
        alreadyDoing: isAlready(input, ["contenu", "blog", "google"]),
      },
      {
        channel: "Activation des essais",
        why: "Le trou n'est presque jamais l'acquisition : ce sont les inscrits qui n'arrivent jamais au moment où votre outil devient utile.",
        firstStep: "Identifiez le geste qui déclenche le déclic, puis écrivez deux emails qui n'ont que ce but.",
        effort: "Moyen",
        cost: "Quasi gratuit",
        alreadyDoing: isAlready(input, ["email", "newsletter"]),
      },
      {
        channel: "Prospection ciblée",
        why: "Tant que le volume est faible, parler directement à vingt prospects vous apprend plus que n'importe quel tableau de bord.",
        firstStep: "Vingt entreprises qui ressemblent à vos trois meilleurs utilisateurs, contactées une par une.",
        effort: "Élevé",
        cost: "Gratuit (votre temps)",
        alreadyDoing: isAlready(input, ["prospection"]),
      },
    ];
  }

  return [
    {
      channel: "Recommandations, mais organisées",
      why: "Sans données ni budget, c'est le canal le moins risqué : vos clients actuels sont votre meilleur argument.",
      firstStep: "Demandez à vos trois derniers clients satisfaits de parler de vous, avec un message que vous réutiliserez.",
      effort: "Faible",
      cost: "Gratuit",
      alreadyDoing: isAlready(input, ["recommandation"]),
    },
    {
      channel: "Une présence trouvable",
      why: `Il faut qu'on puisse vérifier que vous existez et comprendre ${offre} en trente secondes. C'est le préalable à tout le reste.`,
      firstStep: "Une page qui dit ce que vous vendez, à qui, à quel prix, et comment vous joindre.",
      effort: "Moyen",
      cost: "Faible",
      alreadyDoing: isAlready(input, ["google", "reseaux sociaux"]),
    },
  ];
}

function avoidFor(profile: Profile): string[] {
  if (profile === "b2b") {
    return [
      "La publicité de notoriété au large : votre cible est trop étroite pour être payée à l'affichage, vous financeriez surtout des gens qui n'achèteront jamais.",
      "Les envois de masse : sur une liste de quelques dizaines d'entreprises, un message générique vous grille pour longtemps.",
    ];
  }
  if (profile === "b2c_local") {
    return [
      "La publicité de notoriété sur les réseaux : elle génère des vues, rarement des devis. Préférez l'intention de recherche tant que la demande existe.",
      "Élargir votre zone avant d'avoir saturé la vôtre : le déplacement mange la marge.",
    ];
  }
  if (profile === "ecommerce") {
    return [
      "Monter le budget de prospection avant d'avoir un retargeting qui convertit : vous payeriez plus cher des gens que vous perdez ensuite.",
      "Juger une campagne en moins de deux semaines : le temps d'apprentissage des plateformes rend les premiers chiffres trompeurs.",
    ];
  }
  if (profile === "saas") {
    return [
      "Acheter du trafic avant que l'inscription mène à un vrai usage : vous rempliriez un seau percé.",
      "Publier sur tous les réseaux à la fois : un seul, tenu chaque semaine, vaut mieux que quatre abandonnés.",
    ];
  }
  return [
    "Ouvrir plusieurs canaux en même temps : vous ne saurez pas lequel a marché.",
    "Payer de la publicité avant de savoir ce qui convainc vos clients actuels.",
  ];
}

function firstWeekFor(profile: Profile, input: DiagnosticInput): string[] {
  const offre = input.offre.trim() || "votre offre principale";
  const common = `Écrivez en trois phrases ce que vous vendez, à qui, et ce qui vous distingue — vous le réutiliserez partout.`;

  if (profile === "b2b") {
    return [
      common,
      "Listez 30 entreprises qui ressemblent à vos meilleurs clients.",
      "Contactez-en cinq, une par une, avec un angle propre à chacune.",
    ];
  }
  if (profile === "b2c_local") {
    return [
      common,
      "Complétez votre fiche Google : photos récentes, prestations, horaires.",
      "Demandez un avis à vos trois derniers clients satisfaits.",
    ];
  }
  if (profile === "ecommerce") {
    return [
      common,
      "Vérifiez que le suivi de conversion fonctionne sur votre boutique.",
      `Écrivez le premier email d'après-achat qui raconte ${offre}.`,
    ];
  }
  if (profile === "saas") {
    return [
      common,
      "Notez le geste précis après lequel un utilisateur reste.",
      "Listez les cinq questions posées avant l'inscription.",
    ];
  }
  return [
    common,
    "Demandez à trois clients satisfaits de parler de vous.",
    "Rendez votre offre et votre prix visibles quelque part.",
  ];
}

/**
 * Construit le diagnostic de départ. Volontairement borné à trois canaux et
 * toujours accompagné de son fondement : l'utilisateur doit pouvoir dire
 * « non, chez moi ça ne marche pas comme ça » et corriger sa mémoire.
 */
export function buildStarterDiagnostic(input: DiagnosticInput): StarterDiagnostic {
  const profile = detectProfile(input);
  const channels = channelsFor(profile, input).slice(0, MAX_CHANNELS);
  const offre = input.offre.trim();
  const zone = input.zone.trim();

  const focus = channels
    .filter((c) => !c.alreadyDoing)
    .slice(0, 2)
    .map((c) => c.channel.toLowerCase());

  const intro =
    (offre
      ? `Pour vendre ${offre}${zone ? ` sur ${zone}` : ""}, `
      : `Pour démarrer${zone ? ` sur ${zone}` : ""}, `) +
    (focus.length > 0
      ? `l'effort le plus rentable est ${focus.join(" puis ")}.`
      : `vous couvrez déjà l'essentiel : la priorité est de mieux exploiter ce qui est en place plutôt que d'ouvrir un canal de plus.`);

  const basisParts = [
    input.activityType && `activité « ${input.activityType} »`,
    input.audience && `clientèle « ${input.audience.toLowerCase()} »`,
    zone && `zone « ${zone} »`,
    input.canauxActuels.length > 0 &&
      `canaux déclarés (${input.canauxActuels.join(", ").toLowerCase()})`,
  ].filter(Boolean) as string[];

  return {
    intro,
    channels,
    avoid: avoidFor(profile),
    firstWeek: firstWeekFor(profile, input),
    basis:
      basisParts.length > 0
        ? `Établi à partir de votre ${basisParts.join(", ")}. Aucune donnée de campagne n'est encore branchée.`
        : `Complétez votre fiche entreprise pour affiner ce diagnostic.`,
  };
}
