# Mettre la base de données en ligne chez OVH

Résultat : les comptes clients, abonnements et journaux du site sont stockés dans une base **PostgreSQL chez OVH, en France**, sauvegardée automatiquement, et non plus sur votre PC. Le site (`npm run demo:site`) continue de tourner sur votre PC, mais lit et écrit dans la base en ligne.

Compter 30 minutes, plus le délai de livraison d'OVH.

> Les données saisies **dans l'application Windows** (carte, collaborateurs, stock des clients) ne sont pas concernées : elles restent sur le PC de chaque client.

## 1. Commander la base

Espace client OVH → **Web Cloud** → **Web Cloud Databases** (parfois affiché « Bases de données ») → **Commander**.

- Type de base : **PostgreSQL** (version 16 ou plus récente).
- Mémoire : la plus petite offre suffit pour commencer.
- Localisation : **France**.

OVH envoie un e-mail quand la base est prête.

## 2. Préparer la base dans l'espace client

Ouvrir la base commandée (Web Cloud → Web Cloud Databases → votre base).

1. Onglet **Informations générales** : noter le **nom d'hôte** (se termine en général par `.ovh.net`) et le **port** (un nombre à 5 chiffres). Si un **certificat** (CA) est proposé au téléchargement, le télécharger.
2. Onglet **Utilisateurs et droits** → **Ajouter un utilisateur** :
   - nom : `spacora` ;
   - mot de passe : **lettres et chiffres uniquement**, au moins 20 caractères (les symboles compliquent l'adresse de connexion). Le garder dans un gestionnaire de mots de passe.
3. Onglet **Bases de données** → **Ajouter une base de données** : nom `spacora`, utilisateur `spacora` avec les **droits administrateur**.
4. Onglet **IP autorisées** (ou « Autorisations ») → **Ajouter une adresse IP** : votre adresse IP publique (affichée sur [monip.org](https://www.monip.org)), en cochant **l'accès à la base de données**.
   Sans cette étape, la connexion depuis votre PC est refusée. Si votre box change d'adresse IP, il faudra l'ajouter à nouveau.

## 3. Brancher Spacora sur la base en ligne

Sur votre PC, ouvrir `C:\Users\moreo\SurveillanceQT\platform\.env` avec le Bloc-notes.

1. Mettre un `#` devant l'ancienne ligne `DATABASE_URL=…` (on la garde pour revenir en arrière).
2. Ajouter, en remplaçant `MOTDEPASSE`, `HOTE` et `PORT` :

```
DATABASE_URL="postgresql://spacora:MOTDEPASSE@HOTE:PORT/spacora?sslmode=require"
```

3. Si vous avez téléchargé un certificat à l'étape 2, le copier dans le dossier `platform` sous le nom `ovh-ca.pem`, et ajouter :

```
DATABASE_SSL_CA="C:/Users/moreo/SurveillanceQT/platform/ovh-ca.pem"
```

Enregistrer le fichier. La ligne `DATABASE_URL_TEST` (base des tests) ne change pas : elle reste sur votre PC.

## 4. Créer les tables

```powershell
cd C:\Users\moreo\SurveillanceQT\platform
npx prisma migrate deploy
```

Le résultat doit afficher **9 migrations** appliquées.

Facultatif, pour la démo uniquement : `npx prisma db seed` ajoute les entreprises fictives de démonstration (Atelier Lumière…). Ne pas le faire sur une base qui accueillera de vrais clients.

## 5. Vérifier

```powershell
npm run demo:site
```

Créer un compte client sur http://localhost:3000, puis, dans une 2ᵉ fenêtre PowerShell :

```powershell
cd C:\Users\moreo\SurveillanceQT\platform
npx prisma studio
```

La table **Organization** affiche l'entreprise que vous venez de créer : elle est enregistrée chez OVH.

## Si ça ne marche pas

| Message                                                              | Cause probable                                    | Solution                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| `Can't reach database server` / délai dépassé                        | Votre IP n'est pas autorisée                      | Étape 2.4                                                             |
| `password authentication failed`                                     | Mot de passe ou utilisateur incorrect dans `.env` | Étapes 2.2 et 3                                                       |
| `self-signed certificate` / `unable to verify the first certificate` | Le certificat d'OVH n'est pas renseigné           | Étape 3.3 (télécharger le certificat dans « Informations générales ») |
| `Hostname/IP does not match certificate`                             | Le nom d'hôte de l'adresse diffère du certificat  | M'envoyer le message exact                                            |

Revenir à la base locale : remettre la ligne `DATABASE_URL` d'origine (enlever le `#`) et mettre un `#` devant la nouvelle.

## Et ensuite

La base est en ligne ; pour que des clients puissent s'inscrire sans que votre PC soit allumé, la prochaine étape sera d'**héberger le site** (Spacora « site + espace client ») et de lui donner la même adresse de base.
