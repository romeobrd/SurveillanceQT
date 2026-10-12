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
npm run test:e2e          # Playwright (nécessite un navigateur et la base de développement semée)
```

Les tests d'intégration vident la base `DATABASE_URL_TEST` : elle doit être différente de `DATABASE_URL`.

Sans navigateur téléchargeable, Playwright peut utiliser un Chromium existant : `CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.

## Architecture des données

- **Multi-tenant** : aucune requête Prisma hors de `lib/db` (règle ESLint). Le code applicatif passe par `getRepositories(contexte)`, dont le contexte vient toujours de la session. Une extension Prisma impose `organizationId` à chaque lecture et écriture (liste blanche d'opérations, écritures imbriquées refusées).
- **Clés étrangères composites** `(id, organizationId)` : la base refuse elle-même qu'une ligne de l'entreprise A référence une ligne de l'entreprise B.
- **Droits** : matrice par rôle dans `lib/auth/permissions.ts`, vérifiée dans chaque dépôt de données.
- **Authentification** : Auth.js v5 (bêta), session JWT en cookie `httpOnly`, `sameSite=lax`, `secure` en production ; mots de passe argon2id ; rôle et entreprise relus en base à chaque requête ; 5 échecs verrouillent 15 minutes (compteur indexé par l'empreinte de l'e-mail, aucune IP conservée).

## Hébergement et RGPD

Hébergement prévu dans l'Union européenne (à documenter à la phase 7). Aucun traceur, police ou script tiers.

## Avancement

Phases 0 à 3 terminées (initialisation, format de carte et générateur, rendu PixiJS, base de données / authentification / isolation multi-tenant). La carte est sur `/carte` (paramètre `?seed=`).
