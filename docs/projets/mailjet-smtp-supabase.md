# Mailjet → Supabase Auth — rétablir les inscriptions externes

> **Statut au 10 août 2026** : le SMTP personnalisé, la Site URL, la Redirect URL
> et le modèle français sont actifs. Un nouvel email français a toutefois révélé
> un défaut applicatif post-callback : `0000023` redirigeait vers l'origine interne
> Azure. La PR #33 et `nepteo-prod--0000024` imposent désormais l'origine publique
> `APP_URL`; les smokes négatifs sont verts. La fermeture complète reste
> conditionnée à un email neuf reçu puis cliqué une seule fois avec succès.
> Aucun secret SMTP ne doit être écrit dans ce dépôt ou envoyé dans une
> conversation.

## Résultat attendu

Un testeur externe crée son compte sur `https://nepteo.bogasolution.com`, reçoit
un email de confirmation expédié par Mailjet, clique le lien, revient sur Nepteo
et peut commencer la prise en main.

Ce canal est réservé aux emails **transactionnels d'authentification**. Il ne
crée aucune campagne et ne doit pas être réutilisé pour de futurs envois
marketing supervisés.

## État constaté

- La capture du 10 août montre l'expéditeur personnalisé
  `Nepteo <no-reply@auth.bogasolution.com>` : le SMTP personnalisé est actif.
- Le tableau Supabase a été contrôlé le 10 août : Site URL
  `https://nepteo.bogasolution.com` et unique Redirect URL
  `https://nepteo.bogasolution.com/auth/confirm`.
- Le modèle « Confirm signup » français est publié dans Supabase ; sa source de
  référence est `supabase/templates/confirm-signup.html` et conserve
  impérativement `{{ .ConfirmationURL }}`.
- Un nouvel email français livré par l'expéditeur personnalisé a reproduit
  `0.0.0.0`. La cause n'était donc pas seulement un ancien `redirect_to` :
  `/auth/confirm` reconstruisait ses sorties depuis `request.url`, dont l'origine
  derrière Azure était `https://0.0.0.0:3000`.
- La PR #33 utilise `APP_URL` pour toutes les sorties du callback. Sur la révision
  `0000024`, les variantes sans paramètre, `token_hash&type=email`,
  `token_hash&type=signup` et `code=invalid` répondent toutes 307 vers le domaine
  public ; `/api/health` et `/api/ready` répondent 200.
- Un jeton déjà consommé ou expiré, ou un message portant un ancien `redirect_to`,
  exige toujours un nouvel envoi. Ce cas est distinct du défaut applicatif corrigé.
- La zone DNS de `bogasolution.com` est gérée chez OVH
  (`dns200.anycast.me` / `ns200.anycast.me`).
- Le domaine racine possède déjà un SPF OVH :
  `v=spf1 include:mx.ovh.com ~all`.
- Le sous-domaine `auth` publie le SPF Mailjet et
  `mailjet._domainkey.auth.bogasolution.com` publie une clé DKIM ; leur statut
  dans Mailjet reste à confirmer avant de fermer la recette.
- Aucun DMARC n'est publié pour `_dmarc.auth.bogasolution.com`.

Le domaine d'authentification retenu est **`auth.bogasolution.com`**, avec
**`no-reply@auth.bogasolution.com`** comme expéditeur. Cette séparation protège
le courrier OVH du domaine racine et la réputation des futures campagnes.

## Parcours guidé

### 1. Créer ou ouvrir le compte Mailjet

1. Se connecter à Mailjet.
2. Aller dans **Account settings → Senders & Domains**.
3. Choisir **Add a domain or sender address → Add domain**.
4. Saisir exactement `auth.bogasolution.com`.
5. Conserver l'écran affichant les enregistrements DNS demandés.

Ne pas utiliser `bogasolution.com` comme domaine d'envoi Auth : son SPF OVH est
déjà en service.

### 2. Ajouter les enregistrements dans OVH

Dans **OVHcloud → Web Cloud → Noms de domaine → bogasolution.com → Zone DNS** :

1. Ajouter le TXT de validation de domaine fourni par Mailjet.
2. Ajouter le SPF demandé pour le sous-domaine `auth`.
3. Ajouter le DKIM fourni par Mailjet, généralement sous
   `mailjet._domainkey.auth` ; recopier **la valeur exacte du tableau de bord**.
4. Ajouter un DMARC d'observation sur `_dmarc.auth` :
   `v=DMARC1; p=none;`.

Ne jamais créer un second SPF au niveau `@` et ne pas remplacer
`v=spf1 include:mx.ovh.com ~all`. Les valeurs exactes de validation et DKIM sont
propres au compte Mailjet et ne doivent pas être devinées.

### 3. Attendre la validation Mailjet

Dans **SPF/DKIM Authentication**, relancer la vérification jusqu'à obtenir :

- domaine actif ;
- SPF validé ;
- DKIM validé.

La propagation DNS peut demander quelques minutes et, exceptionnellement,
jusqu'à 48 heures.

### 4. Relever les paramètres SMTP Mailjet

Dans **Account settings → SMTP and SEND API settings** :

| Champ Supabase | Valeur Mailjet |
|---|---|
| Host | `in-v3.mailjet.com` |
| Port | `587` |
| Username | API Key Mailjet |
| Password | Secret Key Mailjet |
| Sender email | `no-reply@auth.bogasolution.com` |
| Sender name | `Nepteo` |

Le port 587 utilise TLS. La Secret Key n'est affichée qu'à sa création : la
copier directement vers Supabase, sans la consigner ailleurs.

### 5. Activer le SMTP dans Supabase

Dans le projet `hrqnzorapjnosjphftur` :

1. Aller dans **Authentication → Emails → SMTP Settings**.
2. Activer **Custom SMTP**.
3. Saisir les six valeurs du tableau précédent.
4. Enregistrer.
5. Conserver **Confirm Email** activé.
6. Vérifier dans **URL Configuration** :
   - Site URL : `https://nepteo.bogasolution.com` ;
   - Redirect URL : `https://nepteo.bogasolution.com/auth/confirm`.
7. Dans **Emails → Templates → Confirm signup**, utiliser le sujet
   `Confirme ton adresse email — Nepteo` et le corps versionné dans
   `supabase/templates/confirm-signup.html`.

### 6. Recette externe

1. Utiliser une adresse neuve qui n'appartient pas à l'équipe Supabase.
2. Créer un compte depuis `/signup`.
3. Vérifier la boîte principale puis les spams.
4. Contrôler dans Mailjet que le message est `delivered`.
5. Tant que le compte est non confirmé, tester **Renvoyer le lien de
   confirmation** et conserver uniquement le message le plus récent.
6. Cliquer ce lien une seule fois et vérifier la confirmation, la création de
   session et le retour authentifié vers Nepteo sur le domaine public.
7. En cas d'échec, lire d'abord les journaux Auth Supabase puis l'événement
   Mailjet correspondant.

## Critères de fermeture

- Mailjet affiche domaine, SPF et DKIM valides.
- Supabase utilise le SMTP personnalisé sans désactiver la confirmation email.
- Une adresse externe reçoit le premier email et un renvoi.
- Le lien confirme réellement le compte et ouvre Nepteo.
- Aucun en-tête `Location` émis par `/auth/confirm` ne contient `0.0.0.0`.
- Les erreurs de cadence ou de SMTP sont affichées honnêtement.
- Aucun secret Mailjet n'est présent dans Git, les journaux ou les captures.

## Références

- [Mailjet — Quick Start](https://documentation.mailjet.com/hc/en-us/articles/37251169295003--Quick-Start-with-Mailjet)
- [Mailjet — paramètres SMTP](https://documentation.mailjet.com/hc/en-us/articles/360043229473-How-can-I-configure-my-SMTP-parameters)
- [Supabase — Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase JavaScript — resend](https://supabase.com/docs/reference/javascript/auth-resend)
