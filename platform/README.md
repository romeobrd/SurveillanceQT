# Gestion d'entreprise

Plateforme de gestion d'entreprise avec carte isométrique des locaux. Voir `SPEC.md` (produit) et `CLAUDE.md` (règles de travail).

## Démarrage

```bash
npm install
npm run dev        # http://localhost:3000
```

## Contrôles qualité

```bash
npm run lint
npm run typecheck
npm test           # Vitest
npm run test:e2e   # Playwright (nécessite un navigateur)
```

## Hébergement et RGPD

Hébergement prévu dans l'Union européenne (à documenter à la phase 7). Aucun traceur, police ou script tiers.

## Avancement

Phases 0 (initialisation), 1 (format de carte et générateur) et 2 (rendu PixiJS, interactions, panneau latéral) terminées. La carte est sur `/carte` (paramètre `?seed=`).

## Tests e2e

`npm run test:e2e` lance Playwright. Sans navigateur téléchargeable, indiquer un Chromium existant : `CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.
