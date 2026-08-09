# Projet — Génération de contenu fini par l'IA (le solopreneur n'a besoin de personne)

> **Statut** : la PR [#29](https://github.com/Shaaakir281/nepteo/pull/29) est fusionnée et déployée dans `nepteo-prod--0000022` ; campagne → Story/Post versionné → validation atomique a été recetté en production sur une organisation E2E dédiée, sans lancement ni publication fournisseur (2026-08-09).
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
- Couche LLM par tâche : la capacité image OpenAI est ajoutée à côté du texte, exclusivement côté serveur.

## Périmètre — ce qu'on ajoute

1. **Génération d'un visuel** à partir du brief créatif (écran Contenu) — 1 image proposée, régénérable.
2. **Variantes + formats par canal** (carré/portrait/story…), à partir des specs du canal.
3. **Intégration à « Nouvelle campagne »** : le créatif *fini* (texte + visuel) attaché à la proposition — prêt à lancer.
4. **(Backlog) Vidéo** via générateur, en option.

## Contraintes & honnêteté

- **Charte / marque** : le visuel doit respecter l'identité (couleurs, ton) → s'appuyer sur la mémoire enrichie (cf. projet Onboarding IA). Qualité à surveiller.
- **Coûts API image/vidéo** : les images sont bornées par des quotas applicatifs ; le suivi de dépense et le futur fournisseur vidéo restent à cadrer, surtout en multi-client.
- **Droits / mentions** : visuels générés = attention aux marques, visages, contenus sensibles.
- **Validation humaine** obligatoire avant toute publication.

## Roadmap (étapes)

1. **Fait — 1 visuel depuis le brief** (Contenu) — proposition + régénérer + valider.
2. **Partiel — versions et formats Story/carré/paysage faits** ; variantes créatives sémantiques et conversationnelles encore à construire.
3. **Fait — créatif fini attaché à « Nouvelle campagne »** (texte + visuel), avec validation commune.
4. **(Backlog) Vidéo** via générateur.

## Porte / critère de succès

Un solopreneur peut, depuis un objectif, obtenir un **créatif fini (texte + visuel)** qu'il valide et pourrait publier — **sans faire appel à personne**. Le seul geste manuel restant : valider (et, tant que le lancement réel n'est pas branché, publier lui-même ou via le futur lancement API).

## Décisions implémentées

- **Déclenchement à la demande** : aucun appel image automatique lors de la création d'une campagne.
- **Fournisseur par défaut** : OpenAI `gpt-image-2`, exclusivement côté serveur.
- **Formats** : Story 9:16 recommandée pour Meta ; carré et paysage disponibles.
- **Point de départ** : une campagne récente est sélectionnée et préremplit message et format ; la création libre reste possible mais secondaire.
- **Coûts bornés** : réservation avant appel payant, vingt tentatives par organisation/jour ; cinq réservations actives ou réussies bornent les versions d'une campagne, tandis qu'un échec libère sa place de campagne sans effacer son coût quotidien.

## Coordination avec les connecteurs

CONN-0, CONN-1 et META-READ sont déjà fusionnés dans `main` et ne créent aucune migration après `0027`. Ils réutilisent `connectors`, `journal`, `ad_metrics` et `connectors.config` sans toucher aux tables créatives. `0028_creative_assets.sql` est appliquée sur le projet Supabase lié, désormais vérifié à la version 28 avec ses tables, son bucket privé et ses cinq RPC.

L'intégration Git a été rejouée sur les versions CAMP-0/1/2 et Connecteurs, puis fusionnée dans `main` par la PR #29. Les ajouts de journal, de variables d'environnement, de readiness et d'écrans Campagnes sont cumulés dans la révision de production `nepteo-prod--0000022`. Le numéro `0028` est désormais verrouillé par son application sur le projet lié ; toute nouvelle migration commence à `0029` ou au numéro supérieur présent dans `main`.

Les assets créatifs ne prouvent pas encore la performance d'une publicité : ils n'alimentent ni `ad_metrics` ni l'audit créatif Meta et ne sont publiés chez aucun fournisseur.

## Suivi (journal des sessions)

- **2026-07-23** — Idée cadrée avec Fathi (solopreneur, OpenAI images OK, vidéo en option plus tard), document créé. Rien codé. À reprendre à froid.
- **2026-08-09** — Studio visuel livré sur `/contenu` : une campagne récente est sélectionnée par défaut, son message et le format recommandé sont préremplis (Story pour Meta, paysage ailleurs), avec accès direct depuis la création et la validation de campagne. La génération `gpt-image-2`, l’aperçu avec texte net côté application, le téléchargement et le journal rattaché à l’action campagne sont prêts. Les variantes conversationnelles restent à faire.
- **2026-08-09** — Persistance ajoutée : bucket privé, métadonnées versionnées et paginées, sélection d’une version, miniature dans la validation et approbation atomique campagne + visuel quand une version est déjà retenue. Une campagne approuvée sans visuel peut encore en créer puis en valider un explicitement. L'appel OpenAI ne garde pas le verrou organisation ; le chemin pending et le cron permettent de nettoyer un upload abandonné après claim SQL sous verrou, relecture d'absence d'asset et confirmation par token. Quotas réservés avant l’appel payant : 20 tentatives par organisation/jour pour le coût, 5 réservations actives ou réussies par campagne pour les versions ; un échec libère la place de campagne. Smoke test réel `gpt-image-2` réussi en 32,4 s (JPEG Story valide). Le Supabase lié est vérifié à 28 après application de `0028_creative_assets.sql` : tables, bucket privé et cinq RPC sont visibles.
- **2026-08-09 — recette de production** : la révision `nepteo-prod--0000022` a généré une Story JPEG `1008×1792` de 146 743 octets avec `gpt-image-2` en environ 35 secondes, puis l'a rechargée depuis une URL signée privée, sélectionnée et validée avec sa campagne. Les refus JWT d'écriture directe sur les assets et de lecture directe du bucket ont été observés ; aucun outbox, lancement, métrique Ads ou appel fournisseur Ads/email n'a été créé. L'objet Storage, l'asset, la requête, l'action/campagne et l'acteur synthétiques du run ont ensuite été supprimés. L'organisation-coquille et le journal append-only sont conservés ; l'acteur CSV dédié a été reprovisionné et son smoke officiel est repassé au schéma 28. Restent à éprouver : concurrence multi-session, isolation inter-tenant, chemins d'échec Storage/pending et OAuth/lecture Meta réels.
