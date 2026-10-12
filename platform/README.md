# Gestion d'entreprise

Plateforme de gestion d'entreprise avec carte isométrique des locaux. Voir `SPEC.md` (produit) et `CLAUDE.md` (règles de travail).

## Démarrage

```bash
cp .env.example .env              # puis renseigner AUTH_SECRET (openssl rand -base64 32)
docker compose up -d              # PostgreSQL 16 (bases gestion_dev et gestion_test)
npm install                       # génère aussi le client Prisma
npx prisma migrate deploy         # applique les migrations à la base de développement
npm run db:seed                   # deux entreprises fictives et leurs comptes de test
npm run dev                       # http://localhost:3000
```

### Comptes de test (données 100 % fictives, seed de développement uniquement)

Mot de passe commun : `Demo-Password-2026!`

| Entreprise                  | Admin                              | Manager                              | Employé                               |
| --------------------------- | ---------------------------------- | ------------------------------------ | ------------------------------------- |
| Atelier Lumière (démo A)    | `admin@atelier-lumiere.example`    | `manager@atelier-lumiere.example`    | `employee@atelier-lumiere.example`    |
| Boulangerie Dupont (démo B) | `admin@boulangerie-dupont.example` | `manager@boulangerie-dupont.example` | `employee@boulangerie-dupont.example` |

Le seed refuse de s'exécuter en production ou sur une base non vide.

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

## Hébergement et RGPD

Hébergement prévu dans l'Union européenne (à documenter à la phase 7). Aucun traceur, police ou script tiers.

## Avancement

Phases 0 à 5 terminées (initialisation, format de carte et générateur, rendu PixiJS, base de données / authentification / isolation multi-tenant, modules de gestion et tableau de bord, mode Aménager). La carte est sur `/carte` (paramètre `?seed=`).
