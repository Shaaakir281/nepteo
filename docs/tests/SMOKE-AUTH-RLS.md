# Smoke authentifié — Supabase, rôles et RLS

Ce smoke vérifie directement Supabase avec le client public déjà utilisé par
Nepteo. Il ne démarre pas l'application, n'envoie aucun email, ne lance aucune
recherche IA et n'appelle aucun connecteur.

## Ce qu'il vérifie

1. authentification d'un compte dédié par email et mot de passe ;
2. lecture de son membership, qui doit porter le rôle `lecture` ;
3. lecture de sa propre organisation ;
4. invisibilité d'une autre organisation connue ;
5. en mode complet, refus RLS d'un `insert` dans `company_memory`.

Le mode complet crée au maximum une ligne éphémère portant un UUID généré par le
script. La tentative est faite avec le JWT du rôle `lecture`. Le service role
sert uniquement à vérifier les préconditions et à supprimer cet UUID exact dans
un bloc `finally`.

Ce smoke couvre la frontière **Supabase/RLS directe** ; il n'appelle pas les
Server Actions de l'application. Le gate rôles complet associe donc ce smoke à
`npm test`, dont `tests/company-memory-rls.test.mjs` verrouille le contrôle
`canEdit` de l'onboarding enrichi. Un parcours applicatif authentifié reste à
faire lors de la recette commanditaire.

## Préparer les fixtures

Utiliser uniquement un projet Supabase de développement ou de recette.

- Créer un utilisateur dédié avec un mot de passe et un email déjà confirmé.
- Créer son organisation avec un nom commençant exactement par `E2E_RLS_`.
- Lui attribuer uniquement le rôle `lecture`.
- Créer une seconde organisation dont cet utilisateur n'est pas membre.
- Conserver les deux UUID. Ne pas utiliser l'UUID d'un client réel.

Le script ne crée ni utilisateur, ni organisation, ni membership. Ces fixtures
restent sous le contrôle explicite de l'opérateur.

## Variables d'environnement

Les deux variables publiques et le service role peuvent rester dans
`.env.local`, qui est ignoré par Git et chargé automatiquement par la commande
npm. Les identifiants de smoke doivent rester locaux ou dans le coffre de
secrets de la CI :

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # mode complet seulement
RLS_SMOKE_EMAIL=...
RLS_SMOKE_PASSWORD=...
RLS_SMOKE_OWN_ORG_ID=...
RLS_SMOKE_OTHER_ORG_ID=...
```

Ne jamais ajouter ces valeurs dans `.env.example`, un document ou un commit.

## Exécution

Lecture seule — authentification, membership et isolement, sans aucune écriture :

```powershell
npm run smoke:rls -- --read-only
```

Ce mode indique explicitement que la règle d'écriture reste non vérifiée.

Smoke complet — uniquement avec les fixtures dédiées décrites plus haut :

```powershell
$env:RLS_SMOKE_WRITE_PROBE = "I_ACKNOWLEDGE_E2E_FIXTURE_WRITE"
npm run smoke:rls
Remove-Item Env:RLS_SMOKE_WRITE_PROBE
```

La commande complète n'est verte que si l'écriture reçoit le code PostgreSQL
`42501` et si l'UUID de test est absent après le nettoyage. Un autre type
d'erreur est considéré comme non concluant, pas comme une preuve de sécurité.

## État attendu avec les migrations actuelles

La migration initiale `0001_init.sql` autorisait les écritures de
`company_memory` à tous les membres. La migration corrective
`0014_company_memory_service_writes.sql` retire cette policy et ne conserve que
la lecture pour les membres ; les écritures applicatives passent alors par les
Server Actions autorisées.

Le smoke complet doit donc être vert uniquement après application de toutes les
migrations, notamment `0014`. S'il signale que le rôle `lecture` a pu insérer la
fixture, vérifier d'abord l'état des migrations de l'environnement. Ne jamais
affaiblir l'assertion pour obtenir du vert.

## Sécurité du script

- sans `--read-only` ou phrase d'acquittement exacte, aucune requête n'est faite ;
- la sonde d'écriture refuse toute organisation sans préfixe `E2E_RLS_` ;
- l'autre organisation doit réellement exister en mode complet ;
- aucun appel LLM, OAuth, cron, email ou campagne n'est présent ;
- le script n'affiche ni mot de passe, ni clé, ni jeton ;
- le nettoyage filtre simultanément sur l'UUID généré et l'organisation attendue.
