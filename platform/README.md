# Spacora

Plateforme de gestion d'entreprise avec carte 3D des locaux. Voir `SPEC.md` (produit) et `CLAUDE.md` (règles de travail).

## Démarrage (moins de 10 minutes)

Prérequis : Node.js 22+, Docker (ou un PostgreSQL 16 local).

```bash
cp .env.example .env              # puis renseigner AUTH_SECRET : openssl rand -base64 32
docker compose up -d              # PostgreSQL 16 (bases gestion_dev et gestion_test)
npm install                       # installe les dépendances et génère le client Prisma
npm run setup                     # applique les migrations et charge la démonstration (~5 s)
npm run dev                       # http://localhost:3000
```

Sans Docker : créer deux bases PostgreSQL (`gestion_dev`, `gestion_test`) et ajuster `DATABASE_URL` / `DATABASE_URL_TEST` dans `.env`.

### Comptes de test (données 100 % fictives, seed de développement uniquement)

Mot de passe commun : `Demo-Password-2026!` (rappelé sur la page de connexion en développement uniquement).

| Entreprise                  | Admin                              | Manager                              | Employé                               |
| --------------------------- | ---------------------------------- | ------------------------------------ | ------------------------------------- |
| Atelier Lumière (démo A)    | `admin@atelier-lumiere.example`    | `manager@atelier-lumiere.example`    | `employee@atelier-lumiere.example`    |
| Boulangerie Dupont (démo B) | `admin@boulangerie-dupont.example` | `manager@boulangerie-dupont.example` | `employee@boulangerie-dupont.example` |

Le seed refuse de s'exécuter en production ou sur une base non vide. Pour repartir de zéro : `npm run db:reset` (efface la base de développement).

### Ce que contient la démonstration

**Atelier Lumière** : 26 collaborateurs en 5 équipes, tous installés à un poste (16 postes restent libres), 7 articles de stock dont 3 sous le seuil, 14 pièces de matériel dont des pannes et des renouvellements, 4 projets (de 0 % à 100 %). **Boulangerie Dupont** : une seconde entreprise, invisible depuis la première (isolation multi-tenant).

### Parcours conseillé (10 minutes)

1. Connectez-vous en **manager** sur Atelier Lumière : le **tableau de bord** montre les alertes de stock, le matériel à traiter et l'avancement des projets.
2. **Carte** : repérez les épingles rouges (pièces à traiter), cliquez une pièce (fiche flottante + panneau latéral : personnes, matériel, stock, projets), tournez la vue (clic droit + glisser), choisissez un projet pour voir sa progression.
3. **Aménager** : posez un meuble, annulez / rétablissez, enregistrez une nouvelle version, restaurez l'ancienne.
4. **Collaborateurs**, **Postes**, **Stock**, **Matériel**, **Projets** : recherche, filtres, création, modification ; chaque module renvoie vers la carte.
5. Reconnectez-vous en **employé** : lecture seule, pas d'e-mails des collègues ; **Mes données** pour consulter et exporter vos données.
6. Reconnectez-vous en **admin** : **Administration** (réglages RGPD, demandes, journal d'audit).
7. Essayez `boulangerie-dupont` : aucune donnée de l'autre entreprise n'apparaît.

### Dépannage

- `P1001: Can't reach database server` : PostgreSQL n'est pas démarré (`docker compose up -d`).
- Connexion impossible / erreur d'authentification : vérifiez que `AUTH_SECRET` est renseigné dans `.env`.
- Port 3000 occupé : `npm run dev -- -p 3001`.
- `La base contient déjà des données` : le seed ne s'exécute que sur une base vide (`npm run db:reset`).

## Contrôles qualité

```bash
npm run lint
npm run typecheck
npm test                  # unitaires + intégration (PostgreSQL de test requis)
npm run test:unit         # sans base de données
npm run test:integration  # exige DATABASE_URL_TEST
npm run test:e2e          # Playwright (navigateur + base de développement semée)
npm run db:seed:e2e       # (re)crée l'entreprise « Atelier E2E », utilisée par les tests e2e destructifs
```

Les tests d'intégration vident la base `DATABASE_URL_TEST` : elle doit être différente de `DATABASE_URL`.

Les tests e2e qui enregistrent ou restaurent des cartes (`editor-save.spec.ts`) travaillent sur une entreprise dédiée, recréée avant chaque test : les entreprises de démonstration ne sont jamais modifiées.

Sans navigateur téléchargeable, Playwright peut utiliser un Chromium existant : `CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.

## Modules

Après connexion, la navigation donne accès à :

| Page            | Contenu                                                                                                    | Écriture                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Tableau de bord | collaborateurs actifs, postes occupés/libres, alertes de stock, matériel à traiter, avancement des projets | —                                                              |
| Carte           | aménagement actif lu en base, panneau de zone, barre de progression d'un projet                            | admin, manager (aperçu `?seed=` puis enregistrement explicite) |
| Collaborateurs  | recherche, filtres, tri ; équipes ; départ (poste libéré, matériel restitué)                               | admin                                                          |
| Postes          | libres/occupés, attribution                                                                                | admin, manager                                                 |
| Stock           | articles et mouvements ; quantité calculée ; alertes sous le seuil                                         | admin, manager                                                 |
| Matériel        | état, affectation, historique ; l'employé ne voit que le sien                                              | admin, manager                                                 |
| Projets         | étapes ordonnées, progression calculée                                                                     | admin, manager                                                 |

Chaque liste a recherche, filtres et tri dans l'URL (partageable) ; chaque suppression demande une confirmation ; chaque module a un lien « Voir sur la carte ».

## Carte 3D (phase 8)

- **Rendu** : Three.js (WebGL), empaqueté avec l'application (aucun script externe). Modèles générés par le code (`lib/map/models.ts`), ombres douces, socle « maquette ». La caméra et les modèles sont du code pur testé (`lib/map/camera3d.ts`, `lib/map/models.ts`) ; le moteur est dans `lib/map-renderer-3d/`.
- **Navigation** : glisser pour déplacer, molette ou pincement pour zoomer, **clic droit + glisser** (ou **Alt + glisser**) pour tourner et incliner, boutons ⟲ ⟳ ou touches **Q / E** pour tourner, **0** ou ⌂ pour recentrer, flèches pour se déplacer.
- **Données sur la carte** : indicateurs (collaborateurs, postes occupés, alertes de stock, matériel en panne) qui mènent aux modules ; **épingles rouges** sur les pièces à traiter ; **fiche flottante** de la pièce choisie (inventaire avec badges « Stock bas » / « En stock », bouton **Voir le manquant**). Les figurines représentent l'affectation d'un poste, jamais une présence réelle.
- **Performances** : objets identiques regroupés (instanciation) ; si l'ordinateur est trop lent, le moteur passe seul en qualité basse (sans ombres).
- **Couleur de la marque** : définie une seule fois dans `app/globals.css` (classes `brand-*`).
- **Objets** : survol d'un objet = info-bulle (nom ; pour un poste, son occupant ou « Poste libre ») ; clic sur un objet = sa pièce. Choisir une pièce (carte, liste, épingle) fait **voler la caméra** jusqu'à elle (instantané si le système demande de réduire les animations).
- **Projets** : la barre du bas montre les **étapes** du projet choisi (faite, en cours, à faire) et la carte éclaire les pièces où travaille son équipe.
- **Tendances** : chaque indicateur indique son évolution sur une semaine (« +3 en 7 j »), à partir d'un relevé quotidien de totaux (aucune donnée personnelle, conservé 400 jours, fait à la consultation et par la purge nocturne).

## SaaS : inscription, essai, abonnements (phase 9)

- **Site public** (`/`) : présentation, captures, tarifs ; pages **Mentions légales**, **CGU**, **CGV**, **Confidentialité** (modèles à faire valider par un juriste, informations d'éditeur à compléter entre crochets). Nom commercial : **Spacora** (modifiable dans `lib/i18n/fr.ts`, `app.name`).
- **Inscription** (`/inscription`) : l'entreprise crée son espace et son premier admin (preuve d'acceptation des CGU enregistrée : date et version), puis arrive sur la carte vide. **Essai gratuit de 14 jours** sur l'offre Pro, sans carte bancaire.
- **Offres** (`features/billing/plans.ts`, seul endroit à modifier) : Essentiel 19 € (15 collaborateurs), Pro 49 € (50), Business 99 € (150), HT / mois, deux mois offerts en annuel. Au-delà de la limite, l'ajout de collaborateurs est refusé.
- **Fin d'essai ou d'abonnement** : **lecture seule** (consultation, exports et droits RGPD restent possibles ; toute modification est refusée côté serveur). Un bandeau prévient tous les utilisateurs.
- **Paiement** : **Administration > Abonnement** redirige vers la page de paiement hébergée par **Stripe**, puis vers le portail client Stripe (factures, carte, résiliation). Aucun script Stripe dans l'application ; seuls les identifiants Stripe sont stockés. Le webhook signé `/api/stripe/webhook` synchronise l'abonnement. Variables : voir `.env.example` (`STRIPE_*`). Sans elles, le paiement est simplement désactivé.
- Les entreprises de démonstration (seed) sont en abonnement actif « Business ».
- Tester Stripe en local : `stripe listen --forward-to localhost:3000/api/stripe/webhook` (CLI Stripe), puis une carte de test `4242 4242 4242 4242`.

## Site vitrine et service : www et app

- **En local** (ou sur un seul domaine) : `http://localhost:3000` est le site vitrine ; le service est derrière **Connexion** / **Mon espace**. Un client connecté peut toujours revenir sur l'accueil.
- **En production sur deux domaines** (voir `docs/deploiement-ovh.md`, qui configure tout) : renseigner `SITE_URL` (ex. `https://www.spacora.tech`) et `AUTH_URL` (ex. `https://app.spacora.tech`), et faire pointer les deux domaines vers le même conteneur. `proxy.ts` aiguille chaque requête **avant tout affichage** : www sert l'accueil et les pages légales, et envoie connexion, inscription et service vers app ; sur app, l'accueil mène directement au tableau de bord (ou à la connexion). Les e-mails pointent vers app.

## Application installable (icône sur le bureau)

Dans Chrome ou Edge, le service propose **« Installer l'application »** (bouton en haut à droite, ou icône dans la barre d'adresse) : Spacora obtient une icône sur le bureau et dans le menu Démarrer, et s'ouvre dans sa propre fenêtre. Fiche d'application : `public/manifest.webmanifest`, icônes dans `public/icons/`. Le site vitrine n'est pas installable (seulement le service). Sur un vrai domaine, HTTPS est obligatoire pour l'installation (déjà le cas avec le déploiement prévu) ; `localhost` suffit en local.

## E-mails, import et premiers pas (phase B)

- **E-mails de service** : confirmation d'adresse à l'inscription, **mot de passe oublié** (lien valable 1 h), **invitation** des collègues (lien valable 7 jours : la personne choisit son mot de passe), rappel 3 jours avant la fin de l'essai puis avis de fin d'essai. Liens à usage unique : seule leur empreinte est stockée. Envoi par **SMTP** (Brevo conseillé, variables `SMTP_*` et `EMAIL_FROM` dans `.env.example`).
- **En développement sans SMTP** : rien ne part ; les e-mails sont écrits dans `.dev-emails/outbox.jsonl` et lisibles sur **http://localhost:3000/dev/emails** (liens cliquables).
- **Import CSV** (bouton « Importer (CSV) » sur Collaborateurs, Matériel et Stock) : modèle de fichier téléchargeable, séparateur « ; » ou « , », UTF-8 ou format Excel français. Aperçu ligne par ligne, puis import **des seules lignes valides**. Mêmes règles que les formulaires, doublons et limite de l'offre refusés, équipes manquantes créées, chaque élément créé est journalisé. 1 Mo et 2 000 lignes au maximum.
- **Premiers pas** : sur le tableau de bord de l'administrateur, six étapes cochées automatiquement d'après les données (plan, collaborateurs, postes, collègue invité, stock ou matériel, abonnement) ; masquable.

## Comptes et mots de passe

- **Administration > Comptes** (admin) : créer un compte (e-mail, rôle, collaborateur rattaché), changer un rôle, désactiver / réactiver, réinitialiser un mot de passe. **Avec les e-mails configurés**, le nouveau compte reçoit une invitation et la réinitialisation envoie un lien ; **sans e-mails**, un mot de passe provisoire est affiché **une seule fois** à l'admin, qui le transmet lui-même.
- À la connexion avec un mot de passe provisoire, seule la page **Mon compte** est accessible tant qu'il n'a pas été changé (12 caractères minimum).
- L'entreprise garde toujours au moins un administrateur actif ; un admin ne modifie pas son propre compte depuis cette page. Toutes ces actions sont journalisées.

## Stock : réapprovisionnement

**Stock > Liste de réapprovisionnement** (et le bouton « Voir le manquant » du panneau de la carte) : articles sous le seuil et quantité conseillée (retour à deux fois le seuil), avec **export CSV** pour le fournisseur (séparateur « ; », formules de tableur neutralisées).

## Mode Aménager

Sur `/carte`, les administrateurs et managers basculent de **Vue** à **Aménager** :

- **Catalogue** par catégories (postes, mobilier, équipements, structure) : glisser-déposer ou clic pour armer puis clic sur la carte. Aperçu fantôme **vert** (valide) ou **rouge** avec la raison (collision, hors pièce, trop près d'une porte, bloque un passage).
- **Gestes** : sélection (clic, Maj+clic, rectangle Maj+glisser), déplacement par glisser, **R** pour tourner, **Suppr**, **Échap**, **Ctrl+Z / Ctrl+Y**, flèches pour déplacer la sélection ou le curseur de pose, **Entrée** pour poser, Espace+glisser pour déplacer la carte.
- **Pièces** : tracer un rectangle, redimensionner (champs numériques), typer, renommer, supprimer. Les murs de contour suivent. **Murs, cloisons vitrées et portes** se posent à la main sur les arêtes.
- **Point de départ** : carte enregistrée, carte générée (seed) ou locaux vides (10 à 60 tuiles par côté).
- **Enregistrement explicite** : la carte est entièrement revalidée côté serveur (schéma, cohérence, accessibilité depuis l'entrée, taille). Si des postes attribués, du stock ou du matériel disparaissent avec une pièce ou un poste, un **dialogue de réaffectation** exige une décision pour chacun (libérer la personne ou la placer ailleurs ; détacher ou ranger ailleurs) : rien n'est perdu en silence.
- **Versions** : historique (numéro et date), ouvrir une version dans l'éditeur ou la **restaurer** (crée une nouvelle version, l'historique est conservé). Un enregistrement est refusé si quelqu'un d'autre a modifié la carte entre-temps.

La logique d'édition est du code pur dans `lib/map/edit` et `features/editor`, testée sans navigateur.

## Architecture des données

- **Multi-tenant** : aucune requête Prisma hors de `lib/db` (règle ESLint). Le code applicatif passe par `getRepositories(contexte)`, dont le contexte vient toujours de la session. Une extension Prisma impose `organizationId` à chaque lecture et écriture (liste blanche d'opérations, écritures imbriquées refusées).
- **Clés étrangères composites** `(id, organizationId)` : la base refuse elle-même qu'une ligne de l'entreprise A référence une ligne de l'entreprise B.
- **Droits** : matrice par rôle dans `lib/auth/permissions.ts`, vérifiée dans chaque dépôt de données.
- **Authentification** : Auth.js v5 (bêta), session JWT en cookie `httpOnly`, `sameSite=lax`, `secure` en production ; mots de passe argon2id ; rôle et entreprise relus en base à chaque requête ; 5 échecs verrouillent 15 minutes (compteur indexé par l'empreinte de l'e-mail, aucune IP conservée).

## Hébergement et RGPD (phase 6)

- **Mes données** (`/mes-donnees`) : chacun consulte ses données, les exporte en JSON, dépose une demande d'accès / rectification / effacement et, si l'entreprise l'active, déclare sa présence du jour (facultatif, visible de soi seul, totaux anonymes au tableau de bord, jamais historisé ni journalisé).
- **Administration** (admin) : réglages (présence, durées de conservation), suivi des demandes (dont « Exécuter l'effacement »), journal d'audit filtrable. Un collaborateur parti peut être anonymisé à la main ; sinon l'anonymisation est automatique après le délai réglé.
- **Purge nocturne** : `npm run purge`, ou `POST /api/cron/purge` avec `Authorization: Bearer $CRON_SECRET` (secret de 32 caractères minimum ; sans lui la route répond 503).
- **Sécurité navigateur** : CSP sans aucune origine externe, HSTS en production, `X-Frame-Options`, `Permissions-Policy` (géolocalisation, caméra, micro refusés). Limite connue : la CSP garde `'unsafe-inline'` pour les scripts, car le prérendu partiel (`cacheComponents`) est incompatible avec un nonce.
- **Variables** : voir `.env.example` (`AUTH_URL` et `APP_ORIGIN` en production, `CRON_SECRET`).
- **Documents** dans `docs/` (modèles à faire valider par un juriste ou un DPO) : registre des traitements, politique de confidentialité, note aux salariés, sous-traitants, procédure de réponse aux demandes, hébergement UE. **Mise en ligne** : `deploy/` (testé) et le pas à pas `docs/deploiement-ovh.md` (VPS OVH, www.spacora.tech et app.spacora.tech).
- E2E sur la version de production : `npm run build` puis `E2E_PROD=1 npx playwright test` (port 3100).

## Avancement

Phases 0 à 8 terminées (initialisation, format de carte et générateur, rendu de la carte (PixiJS, remplacé par la 3D Three.js en phase 8), base de données / authentification / isolation multi-tenant, modules de gestion et tableau de bord, mode Aménager, RGPD complet, seed de démonstration et finitions, carte 3D et données sur la carte), puis SaaS : vente en ligne (phase A) et mise en route des clients (phase B : e-mails, import CSV, premiers pas). La carte est sur `/carte` (paramètre `?seed=`).
