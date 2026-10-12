# Hébergement dans l'Union européenne

> **MODÈLE — à faire valider par un juriste ou un DPO.** Ce document est un point de départ rédigé à partir du fonctionnement réel de l'application ; il ne constitue pas un avis juridique. Les passages entre crochets [ ] sont à compléter par l'entreprise utilisatrice (responsable de traitement).

L'application est conçue pour être hébergée en UE sans service tiers : un serveur Node.js, une base PostgreSQL 16, un planificateur (cron) pour la purge nocturne.

## Exigences

- Serveur et base de données situés dans l'UE, chez un hébergeur lié par un contrat de sous-traitance (art. 28) — [à choisir].
- HTTPS obligatoire (l'application envoie HSTS en production). Définir `AUTH_URL` sur l'adresse publique.
- Sauvegardes chiffrées, conservées dans l'UE, durée alignée sur les durées de conservation (une sauvegarde peut contenir des données déjà purgées : prévoir une rotation courte, par exemple 30 jours).
- Accès à la base restreint ; secrets (`AUTH_SECRET`, `CRON_SECRET`, mot de passe de la base) uniquement dans l'environnement du serveur, jamais dans le dépôt.

## Purge nocturne

Planifier `npm run purge` (ou un appel POST à `/api/cron/purge` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`) chaque nuit. Voir `deploy/purge.cron`.

## Fichiers d'exemple

Le dossier `deploy/` contient un Dockerfile, un docker-compose de production et une tâche cron d'exemple. **Ils n'ont pas été testés** dans l'environnement de développement : à valider avant tout usage réel.
