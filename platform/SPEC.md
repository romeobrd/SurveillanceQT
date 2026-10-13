# SPEC — Plateforme de gestion d'entreprise avec carte isométrique des locaux

> Document de référence du produit. Toute décision d'implémentation doit être cohérente avec ce fichier.
> En cas d'ambiguïté ou de conflit, poser la question avant de coder.

---

## 1. Vision produit

SaaS B2B multi-entreprises destiné aux PME françaises, qui centralise la gestion opérationnelle
(collaborateurs, postes de travail, stock, parc informatique, projets) autour d'une **carte isométrique
interactive des locaux**, au style visuel "jeu vidéo" (vue type Les Sims / Habbo : vivante, colorée, lisible).

**Proposition de valeur :** remplacer plusieurs outils séparés (tableurs de stock, inventaire informatique,
plan de bureaux) par une seule interface visuelle, où chaque information est rattachée à un lieu physique.

**Différenciation :**

1. Le style isométrique "jeu", là où les concurrents affichent des plans 2D d'architecte.
2. Stock + matériel + postes + projets réunis sur la même carte.
3. Chaque entreprise **construit et modifie elle-même ses locaux** (mode Aménager).
4. Conformité RGPD dès la conception : aucun suivi des personnes.

### Hors périmètre (V1)

- Suivi de localisation des salariés en temps réel, capteurs, badges, géolocalisation : **interdit par conception**.
- Paie, congés, recrutement, comptabilité.
- Import de plans d'architecte (DWG, PDF) : prévu plus tard.
- Application mobile native (le web doit cependant être utilisable sur tablette).

---

## 2. Utilisateurs et rôles

| Rôle        | Description                                     | Droits principaux                                                                                        |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Admin**   | Dirigeant / responsable de l'entreprise cliente | Tout, y compris paramètres RGPD, rôles, suppression de l'entreprise                                      |
| **Manager** | Responsable d'équipe, office manager            | Aménager les locaux, gérer stock, matériel, projets, attribuer les postes                                |
| **Employé** | Salarié                                         | Voir la carte, l'annuaire minimal, son matériel, ses projets ; déclarer sa présence ; page "Mes données" |

Contrôle d'accès vérifié **côté serveur** à chaque requête (jamais uniquement dans l'interface).

---

## 3. Architecture technique

- **Framework :** Next.js (App Router, dernière version stable), TypeScript en mode `strict`
- **UI :** Tailwind CSS, composants accessibles (navigation clavier, contrastes, libellés ARIA)
- **Rendu de la carte :** PixiJS (WebGL), encapsulé dans un composant client isolé
- **Données :** PostgreSQL + Prisma (SQLite accepté en développement local)
- **Auth :** Auth.js, mots de passe hashés (argon2id), sessions en cookies `httpOnly`, `secure`, `sameSite=lax`
- **Validation :** zod sur toutes les entrées (formulaires, routes API, server actions)
- **Tests :** Vitest (unitaires), Playwright (parcours critiques)
- **Données de démo :** @faker-js/faker, locale `fr`
- **Langue de l'interface :** français uniquement en V1, mais textes centralisés pour permettre la traduction

### Multi-entreprise (multi-tenant)

- Chaque table métier porte un `organizationId`.
- **Toutes** les requêtes passent par une couche d'accès qui impose le filtre `organizationId` de la session.
  Aucune requête Prisma directe dans les composants ou routes.
- Test automatisé obligatoire : un utilisateur de l'entreprise A ne peut jamais lire ni modifier une donnée de l'entreprise B.

### Structure de dossiers indicative

```
/app                 routes et pages
/components          composants UI réutilisables
/features/<module>   logique par module (people, stock, assets, projects, map, privacy)
/lib/map             format de carte, générateur, projection isométrique, collisions (code pur, sans PixiJS)
/lib/map-renderer    rendu PixiJS
/lib/db              client Prisma et couche d'accès multi-tenant
/lib/auth            authentification et contrôle d'accès
/prisma              schéma et seed
/docs                documents RGPD
/tests               tests unitaires et e2e
```

---

## 4. Modèle de données (entités principales)

- **Organization** : nom, secteur, paramètres (présence activée oui/non, durées de conservation)
- **User** : email, hash du mot de passe, rôle, lien vers Person (optionnel), organizationId
- **Person** (collaborateur) : prénom, nom, email pro, intitulé de poste (métier), équipe, statut actif/parti
- **Team** : nom
- **Layout** (aménagement) : organizationId, version, données JSON (format §5), auteur, date. Une version "active" par entreprise, historique conservé.
- **Zone** : identifiant stable référencé dans le Layout, nom, type
- **Workstation** (poste de travail) : identifiant stable de l'élément sur la carte, zoneId, personId (nullable)
- **StockItem** : nom, référence, quantité, unité, seuil d'alerte, zoneId
- **StockMovement** : stockItemId, type (entrée/sortie/ajustement), quantité, motif, auteur, date
- **Asset** (matériel informatique) : type, marque, modèle, n° de série, état (en service / en panne / à renouveler / réformé), date d'achat, personId (nullable), zoneId (nullable)
- **Project** : nom, équipe, description ; **ProjectStep** : nom, ordre, statut
- **PresenceStatus** : personId, statut déclaratif, date (purgé chaque jour, voir §8)
- **AuditLog** : acteur, action, type et id de la ressource, date (sans contenu des données personnelles)
- **PrivacyRequest** : demandeur, type (accès / rectification / suppression), statut, dates

Les zones et postes de travail doivent garder des **identifiants stables** entre versions d'aménagement,
pour que le stock, le matériel et les attributions ne soient jamais perdus quand on modifie la carte.

---

## 5. Format de carte (contrat central)

Le générateur aléatoire, l'éditeur et le moteur de rendu partagent **un seul format**, défini et validé par un schéma zod dans `/lib/map`.

Contenu minimal :

- `version` du format, `width`, `height` (en tuiles), `seed` (si générée)
- `zones[]` : id, nom, type, liste de tuiles ou rectangle(s), couleur de sol
- `walls[]` et `doors[]` : positions sur les arêtes de tuiles
- `elements[]` : id, `catalogKey`, position (x, y), rotation (0/90/180/270), zoneId

Le **catalogue d'éléments** est un fichier de configuration (clé, nom affiché, catégorie, emprise en tuiles,
rotation possible, est-un-poste-de-travail, sprite/forme). Il doit pouvoir être étendu par secteur
(bureau, garage, entrepôt, commerce) sans toucher au moteur.

---

## 6. Carte isométrique

### 6.1 Génération aléatoire

- Fonction pure `generateLayout(seed, options) → Layout`, PRNG déterministe (ex. mulberry32). Même seed = même carte.
- Taille aléatoire entre 20×20 et 40×40 tuiles.
- Découpage en pièces par partition récursive (BSP), murs, portes, couloirs ; **toutes les pièces accessibles** (vérification par parcours en largeur).
- Types de zones : open space, bureau individuel, salle de réunion, cafétéria/détente, réserve/stock, salle serveur, accueil.
- Ameublement cohérent par type de zone (postes et chaises en open space, table en réunion, étagères en réserve, baies en salle serveur…), sans collision.
- Seed visible et partageable via l'URL (`?seed=`), bouton "Générer de nouveaux locaux".

### 6.2 Rendu

- Projection isométrique 2:1 ; fonctions de conversion grille ↔ écran testées unitairement.
- Tri de profondeur correct (objets et personnages occultés correctement), y compris pour les éléments de plus d'une tuile.
- Mobilier et personnages dessinés en formes géométriques simples (pas d'assets externes en V1), palette cohérente et chaleureuse.
- Personnages stylisés affichés **sur les postes attribués** : ils représentent une affectation, jamais une présence réelle.
- Interactions : zoom molette / pincement, déplacement par glisser, survol = surbrillance de la zone, clic = panneau latéral.
- Performance : 60 i/s sur une carte 40×40 meublée sur un ordinateur portable standard (culling hors écran, batching).

### 6.3 Panneau latéral de zone

Nom et type de la zone ; postes et personnes attribuées (prénom, nom, intitulé de poste) ;
matériel présent ; stock rangé (alerte visuelle sous le seuil) ; projets des équipes de la zone ; actions rapides selon le rôle.

### 6.4 Mode "Aménager" (admin et manager)

- Bascule Vue / Aménager.
- Catalogue latéral par catégories : postes de travail (bureau simple, double, îlot de 4, poste debout), mobilier, équipements, structure (mur, porte, cloison vitrée).
- Glisser-déposer avec aperçu fantôme vert (valide) / rouge (collision, hors pièce, bloque un passage).
- Rotation (touche R), déplacement, suppression, sélection multiple.
- Pièces : tracer, redimensionner, typer, renommer ; contrôle d'accessibilité avant enregistrement.
- Chaque poste de travail ajouté devient une `Workstation` attribuable.
- Annuler / rétablir (Ctrl+Z / Ctrl+Y), enregistrement explicite, historique des versions avec restauration.
- Supprimer un poste attribué ou une zone contenant du stock ou du matériel ouvre un dialogue de réaffectation : **aucune perte silencieuse de données**.
- Point de départ : carte générée, ou locaux vides de taille choisie.

---

## 7. Modules de gestion

Chaque module : liste avec recherche, filtres et tri ; création, modification, suppression avec confirmation ; lien "voir sur la carte".

- **Collaborateurs** : champs strictement listés au §4, rien de plus.
- **Postes de travail** : liste des postes, libres/occupés, attribution.
- **Stock** : mouvements tracés, quantité calculée à partir des mouvements, alertes sous le seuil.
- **Parc informatique** : affectation à une personne et/ou une zone, historique d'affectation, état.
- **Projets** : étapes ordonnées, progression calculée.
- **Tableau de bord** : collaborateurs actifs, postes occupés / disponibles, alertes de stock, matériel en panne ou à renouveler, avancement des projets ; barre de progression du projet sélectionné en bas de la carte.

---

## 8. RGPD — exigences non négociables

1. **Aucun suivi des personnes** : pas de localisation temps réel, pas de capteurs, pas d'historique de déplacements ou de présence.
2. **Présence déclarative facultative** : statut (au bureau / télétravail / absent) saisi uniquement par le salarié lui-même, désactivable au niveau de l'entreprise, **purgé automatiquement chaque nuit**, jamais historisé, jamais utilisé dans des statistiques individuelles.
3. **Minimisation** : aucune donnée sensible (santé, opinions, adresse personnelle, date de naissance, numéro de sécurité sociale, photo obligatoire). Aucun champ libre "commentaire" sur une personne.
4. **Page "Mes données"** : consultation, export JSON lisible (droits d'accès et de portabilité), demande de rectification, demande de suppression, suivi des demandes côté admin.
5. **Départ d'un collaborateur** : anonymisation de ses données personnelles ; l'historique du stock et du matériel est conservé sous forme non nominative.
6. **Durées de conservation** paramétrables par l'admin, appliquées par une tâche planifiée de purge, testée.
7. **Journal d'audit** des consultations, modifications et exports de données personnelles et des modifications d'aménagement. Le journal ne contient pas lui-même les données personnelles.
8. **Sécurité** : HTTPS, argon2id, CSRF, en-têtes de sécurité (CSP, HSTS…), limitation des tentatives de connexion, secrets uniquement en variables d'environnement, aucun secret dans le dépôt.
9. **Aucun traceur tiers** (analytics, pixels, polices ou scripts servis depuis des CDN tiers). Polices auto-hébergées.
10. **Hébergement en Union européenne**, documenté dans le README et la configuration de déploiement.
11. **Documents dans /docs** (en français, marqués "MODÈLE — à faire valider par un juriste ou un DPO") : registre des traitements, politique de confidentialité, note d'information aux salariés, liste des sous-traitants, procédure de réponse aux demandes.

---

## 9. Données de démo

Script de seed : une entreprise fictive, carte générée avec une seed fixe, 15 à 40 collaborateurs répartis en équipes
et attribués aux postes, stock avec quelques articles sous le seuil, matériel varié dont une partie en panne, 3 projets à différents stades.
Trois comptes de test (admin, manager, employé) documentés dans le README. Données 100 % fictives.

---

## 10. Plan de livraison

Chaque phase se termine par : typecheck, lint et tests au vert, démonstration de la fonctionnalité, résumé des changements et des points ouverts.

| Phase | Contenu                                                                    | Critère d'acceptation                                                                           |
| ----- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0     | Initialisation du projet, outillage, CI locale                             | `lint`, `typecheck`, `test` passent sur un projet vide                                          |
| 1     | Format de carte + générateur aléatoire (code pur)                          | Déterminisme de la seed, pièces toutes accessibles, aucune collision : testés                   |
| 2     | Rendu PixiJS + interactions + panneau latéral (données factices)           | Carte navigable, tri de profondeur correct, 60 i/s en 40×40                                     |
| 3     | Base de données, auth, rôles, isolation multi-tenant                       | Test d'isolation A/B au vert, droits vérifiés côté serveur                                      |
| 4     | Modules collaborateurs, postes, stock, matériel, projets + tableau de bord | CRUD complets, liens avec la carte                                                              |
| 5     | Mode Aménager                                                              | Ajout, déplacement, rotation, suppression, annuler/rétablir, versions, réaffectation sans perte |
| 6     | RGPD complet                                                               | Export, anonymisation, purge planifiée, journal d'audit, documents /docs : testés               |
| 7     | Seed de démo, README, finitions visuelles                                  | Une personne extérieure peut installer et tester en moins de 10 minutes                         |

---

## 11. Évolutions envisagées (ne pas développer en V1, mais ne pas bloquer)

- Catalogues sectoriels (garage : ponts élévateurs, véhicules ; entrepôt : racks ; commerce : caisses)
- Plusieurs étages et plusieurs sites par entreprise
- Import d'un plan existant comme calque de fond
- Réservation de salles et de postes
