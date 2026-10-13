# CLAUDE.md — Règles de travail sur ce projet

La spécification complète du produit est dans `SPEC.md`. Lis-la avant toute tâche.

## Méthode

- Avant chaque phase : présente un plan court (fichiers touchés, choix techniques, risques) et attends ma validation.
- Travaille phase par phase selon le §10 de `SPEC.md`. Ne commence pas la phase suivante sans validation.
- En cas d'ambiguïté ou de conflit avec la spec, pose la question au lieu de supposer.
- N'ajoute aucune fonctionnalité hors spec sans me le proposer d'abord.
- Fin de phase : `lint`, `typecheck` et tests au vert, puis résumé (fait / reste à faire / points ouverts).
- Commits petits et explicites, en français, un sujet par commit.

## Code

- TypeScript `strict`, pas de `any` sauf justification en commentaire.
- La logique de carte (`/lib/map`) est du code pur, sans dépendance à PixiJS ni au DOM, et testée unitairement.
- Aucune requête Prisma en dehors de `/lib/db` : toujours passer par la couche d'accès multi-tenant.
- Droits vérifiés côté serveur pour chaque action.
- Toute entrée validée avec zod.
- Composants petits et réutilisables, textes d'interface centralisés.
- Commentaires en français, noms de variables et de fonctions en anglais.

## RGPD — à vérifier à chaque modification

- Jamais de suivi de localisation ou de présence historisée.
- Jamais de nouveau champ de donnée personnelle sans me demander.
- Toute lecture, modification ou export de données personnelles passe par le journal d'audit.
- Aucun script, police ou traceur tiers.
