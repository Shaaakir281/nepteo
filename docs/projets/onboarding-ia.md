# Projet — Onboarding enrichi par IA (identité + première expertise)

> **Statut** : cadré, non commencé. Idée de Fathi (2026-07-23).
> **Cible** : le **solopreneur** (seul, pas d'équipe).

## Pourquoi

Tout ce que l'agent décide en aval (canaux, stratégie, ton, créatifs, plan du mois) dépend de la **finesse avec laquelle il comprend l'entreprise**. L'onboarding est donc le meilleur endroit où mettre de l'intelligence : plus l'identité captée est riche, meilleures sont *toutes* les décisions ensuite. Et bien fait, c'est **le premier moment magique** — l'agent montre qu'il comprend le métier du client dès la première minute, avant même le moindre connecteur.

## Principe directeur (NON négociable)

- **Rester très simple.** L'utilisateur est un solopreneur, pas un marketeur.
- **Garder le formulaire existant** (onboarding actuel : création organisation, rôle, mémoire de base). **On n'enlève rien, on ne perd aucune information** — on ne fait qu'**ajouter** une couche.
- L'IA **assiste** la saisie (pré-remplit, propose), l'utilisateur **valide et corrige**. Rien n'est figé sans lui.

## Périmètre — ce qu'on ajoute

1. **Encart « philosophie » (texte libre)** : « décrivez votre philosophie, l'entreprise que vous attendez de cet outil, ce qui vous semble important à dire ». Capture l'**âme** que les champs structurés ratent. → nouvelle section de `company_memory` (ex. `philosophie`/`vision`).
2. **Ingestion de la page web** : l'utilisateur colle l'URL de son site → l'agent lit et **pré-remplit** l'identité (offre, ton, preuves, cibles). L'utilisateur corrige.
3. **(Optionnel) Réseaux sociaux** : comptes connectés (OAuth, comme les connecteurs) ou liens collés → matière supplémentaire pour l'identité et le ton.
4. **Synthèse d'identité + diagnostic d'expert** : à partir de tout ça, l'agent rend (a) une **identité synthétisée** (que l'utilisateur valide → devient la mémoire), et (b) une **première expertise** : *meilleurs canaux*, *stratégie marketing de départ* — **avant tout connecteur**.

## Ce qu'on réutilise (déjà construit)

- `company_memory` (sections + options) : l'identité enrichie s'y range (une section de plus).
- Moteur du **Plan du mois** (`lib/plan.ts`) : le diagnostic d'expert tourne sur les mêmes rails, nourri par l'identité au lieu des données de connecteurs.
- Couche LLM par tâche (`lib/llm.ts`) : tâches `summarize_document` (page web), `campaign_brief`/`recommend_action` (diagnostic).

## Contraintes & honnêteté

- **Texte libre + page web = facile, haute valeur.** À faire en premier.
- **Réseaux sociaux = subtil** : lire les comptes d'un tiers par API est restreint (OAuth sur *ses propres* comptes, ou lecture du public dans les limites permises ; pas de scraping contre CGU). C'est le thème « enrichissement internet » (backlog) qui trouve ici sa maison. À cadrer, pas bloquant pour une v1.
- **RGPD** : hébergement EU, consentement, données d'identité stockées comme le reste (chiffrement des tokens OAuth déjà en place).

## Roadmap (étapes, du simple au riche)

1. **Encart philosophie** — nouvelle section mémoire, ajoutée au formulaire existant. Le plus simple, valeur immédiate.
2. **Ingestion page web** — coller l'URL → lecture (`summarize_document`) → pré-remplissage de l'identité, corrigé par l'utilisateur.
3. **Diagnostic d'expert** — à partir de l'identité, l'agent propose meilleurs canaux + stratégie de départ (réutilise le moteur Plan). Premier « waouh », avant connecteurs.
4. **(Backlog) Réseaux sociaux** — OAuth comptes propres / liens publics, dans les limites CGU.

## Porte / critère de succès

Un solopreneur qui finit l'onboarding a : une **identité synthétisée** qu'il reconnaît comme juste, et un **premier plan/diagnostic** utile — sans avoir eu à réfléchir comme un marketeur, et sans avoir rien perdu de ce qu'il a saisi.

## Questions ouvertes

- Où placer l'encart et le diagnostic dans le flux d'onboarding actuel sans l'alourdir ?
- Diagnostic : combien de canaux/reco proposer pour rester digeste (2-3 max) ?
- Réseaux : commence-t-on par « coller des liens » (simple) avant l'OAuth ?

## Suivi (journal des sessions)

- **2026-07-23** — Idée cadrée avec Fathi, document créé. Rien codé. À reprendre à froid.
