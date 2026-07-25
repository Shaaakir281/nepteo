# Prompt — audit contradictoire du plan de simplification

> À coller tel quel dans une nouvelle conversation, avec un modèle plus puissant et un accès au dépôt `C:\dev\agent_marketing`.

---

Tu es un directeur technique et produit expérimenté, appelé pour un **audit contradictoire**. Un plan de simplification a été rédigé par un autre agent ; ton rôle n'est pas de l'améliorer poliment mais de le **juger**, y compris en le rejetant si c'est justifié. Je préfère un désaccord argumenté à un accord de confort. Si tu es d'accord, dis-le en une ligne et passe à ce qui compte.

## Le contexte

**Nepteo** : copilote marketing IA pour solopreneurs et très petites équipes. L'agent comprend l'activité, lit les données, **propose** des actions argumentées, et n'exécute que ce qui est validé. Next.js 16 (App Router, TypeScript strict), Supabase (Postgres + RLS, EU), Vercel AI SDK multi-fournisseurs, 130 tests `node:test`.

Le produit se situe volontairement **entre l'outil de marketeur expert et l'outil grand public**. La cible a une culture marketing basique à intermédiaire : à l'aise avec « prospect », « relance », « funnel » ; pas avec le jargon de plateforme.

Le fondateur vient de dire : « ça a l'air excellent mais je trouve ça légèrement compliqué ». D'où ce plan.

## À lire avant de juger

Dans l'ordre :

1. `CLAUDE.md` — positionnement, philosophie d'autonomie, non négociables, conventions.
2. `docs/projets/simplification.md` — **le plan à auditer**.
3. `docs/SUIVI.md` — les entrées du 2026-07-25 (quatre sessions le même jour : onboarding enrichi, recherche web Perplexity, kit de démonstration, historique de campagnes + diagnostic). C'est là qu'on voit *comment* la complexité s'est accumulée.
4. `docs/DECISIONS.md` — les arbitrages déjà pris, notamment sur l'argent, le RGPD et la recherche web.
5. Le code, au moins : `app/(cockpit)/_components/sidebar.tsx` (navigation), `app/(cockpit)/page.tsx`, `app/(cockpit)/plan/page.tsx`, `app/(cockpit)/agent/page.tsx`, `lib/memory.ts`, `lib/plan.ts`, `lib/diagnostic.ts`, `lib/demo/`, `lib/ads/`.

Chiffres constatés : 9 entrées de navigation, 14 pages, 8 sections de mémoire, 47 fichiers dans `lib/` (149 exports), 10 migrations.

## La thèse à mettre à l'épreuve

Le plan repose sur quatre affirmations. Traite-les comme des hypothèses, pas comme des acquis.

1. **« La cause principale est que l'agent propose à trois endroits »** (Aujourd'hui, Plan du mois, Contenu). Est-ce le vrai coupable, ou un symptôme d'autre chose — par exemple un périmètre fonctionnel trop large pour ce stade ?
2. **« Il faut distinguer complexité essentielle et complexité accidentelle »** — journal, idempotence, garde-fous serveur seraient intouchables. Est-ce vrai, ou est-ce une façon commode de protéger le travail déjà fait ? Existe-t-il une version plus simple de ces mécanismes qui tienne la même promesse ?
3. **L'ordre proposé (1 → 2 → 5 → 6 → 3 → 4)** part du moins risqué. Est-ce le bon ordre, ou faut-il au contraire trancher la structure d'abord, quitte à jeter du travail récent ?
4. **Les lots 3 et 4 devraient attendre le retour du pilote (Charly).** Prudence utile, ou procrastination déguisée ?

## Ce que j'attends en sortie

**1. Verdict par lot.** Pour chacun des six lots : **valider / amender / rejeter**, avec la raison en deux ou trois phrases. Sois précis sur ce que tu amendes.

**2. Ce que le plan rate.** Les simplifications évidentes qu'il ne voit pas, et — plus important — les endroits où **simplifier serait une erreur** parce que la complexité y porte la valeur.

**3. Ta propre hiérarchie.** Si tu ne devais garder que **trois** actions, lesquelles, et pourquoi celles-là. Classe par rapport gain/effort, pas par élégance.

**4. Le risque le plus sous-estimé.** Dans le plan, ou dans le projet tel que tu le vois après lecture du code.

**5. La question de fond.** Le vrai problème est-il la complexité de l'interface, ou le fait que le produit essaie de faire trop de choses à ce stade ? Si c'est le second cas, dis ce que tu couperais — nommément, sans ménagement.

## Contraintes

- **N'écris pas de code et ne modifie aucun fichier.** C'est un audit, la mise en œuvre viendra après.
- Tiens compte du calendrier : une **démonstration à un associé (Charly)** est imminente, sur trois scénarios d'entreprises fictives. Ce qui casserait cette démonstration doit être signalé comme tel.
- Ne recommande pas de changer de stack ni de refaire l'existant : juge ce qui est là.
- Le produit est en français, la cible n'est pas technique. Une simplification qui rend le code élégant mais l'usage plus obscur est un mauvais échange — dis-le si tu en vois une.
- Sois concret. « Réduire le couplage » ne m'aide pas ; « fusionner X et Y parce que Z » m'aide.

## Format

Va à l'essentiel. Pas de résumé de ce que tu as lu, pas de préambule. Commence par ton verdict global en trois lignes maximum, puis les cinq sections ci-dessus. Si tu penses que le plan est globalement juste, dis-le franchement et concentre-toi sur les amendements — je ne cherche pas une critique pour la forme.
