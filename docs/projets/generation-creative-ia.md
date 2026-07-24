# Projet — Génération de contenu fini par l'IA (le solopreneur n'a besoin de personne)

> **Statut** : cadré, non commencé. Idée de Fathi (2026-07-23).
> **Cible** : le **solopreneur** — objectif « outil magique, plus besoin de personne ».

## Pourquoi

Entre le **brief** et le **lancement**, il y a une étape de **production** : le contenu doit être *fini* pour le canal. Pour une PME avec équipe, ce relais va vers un community manager / graphiste. Pour un **solopreneur**, il n'y a personne — donc le relais va vers **l'IA**. L'agent ne se contente plus de briefer le visuel : il le **génère**. C'est ce qui rend le produit vraiment magique pour un solo : il fait *tout*.

## Principe directeur

- Selon le canal, l'agent **finit** ou **fait générer** :
  - **Texte** (email, newsletter, pub Google texte, relance) → fini, prêt à envoyer. Déjà en grande partie construit (moteur brouillon/créatif).
  - **Visuel** (pub Meta/Insta image, post social) → **génération d'image par IA** (API OpenAI, déjà opérationnelle côté Fathi).
  - **Vidéo** → **option** branchée sur un générateur vidéo, plus tard.
- **L'agent propose, l'utilisateur valide.** Le visuel généré est une proposition, jamais publié sans accord (cohérent avec la philosophie d'autonomie).

## Ce qu'on réutilise (déjà construit)

- Moteur créatif : `lib/creative.ts` (brief agnostique canal), `lib/campaign.ts` (variantes A/B), `lib/draft.ts` (relance).
- Écran **Contenu** (`/contenu`) et **Nouvelle campagne** (modale) : points d'accroche naturels pour attacher un visuel généré.
- Couche LLM par tâche : ajouter une capacité image (API OpenAI) à côté du texte.

## Périmètre — ce qu'on ajoute

1. **Génération d'un visuel** à partir du brief créatif (écran Contenu) — 1 image proposée, régénérable.
2. **Variantes + formats par canal** (carré/portrait/story…), à partir des specs du canal.
3. **Intégration à « Nouvelle campagne »** : le créatif *fini* (texte + visuel) attaché à la proposition — prêt à lancer.
4. **(Backlog) Vidéo** via générateur, en option.

## Contraintes & honnêteté

- **Charte / marque** : le visuel doit respecter l'identité (couleurs, ton) → s'appuyer sur la mémoire enrichie (cf. projet Onboarding IA). Qualité à surveiller.
- **Coûts API image/vidéo** : à cadrer (par génération, plafonds), surtout en multi-client.
- **Droits / mentions** : visuels générés = attention aux marques, visages, contenus sensibles.
- **Validation humaine** obligatoire avant toute publication.

## Roadmap (étapes)

1. **1 visuel depuis le brief** (Contenu) — proposition + régénérer + valider.
2. **Variantes & formats par canal**.
3. **Créatif fini attaché à « Nouvelle campagne »** (texte + visuel) → prêt à lancer.
4. **(Backlog) Vidéo** via générateur.

## Porte / critère de succès

Un solopreneur peut, depuis un objectif, obtenir un **créatif fini (texte + visuel)** qu'il valide et pourrait publier — **sans faire appel à personne**. Le seul geste manuel restant : valider (et, tant que le lancement réel n'est pas branché, publier lui-même ou via le futur lancement API).

## Questions ouvertes

- Quelle API image par défaut (OpenAI) et quels garde-fous de coût ?
- Génère-t-on le visuel **à la demande** (bouton) ou **automatiquement** avec le brief ?
- Formats : lesquels prioriser (Meta feed/story, LinkedIn) ?

## Suivi (journal des sessions)

- **2026-07-23** — Idée cadrée avec Fathi (solopreneur, OpenAI images OK, vidéo en option plus tard), document créé. Rien codé. À reprendre à froid.
