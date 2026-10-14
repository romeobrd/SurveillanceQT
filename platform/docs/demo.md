# Démo Spacora : du site à l'application Windows

Ce que montre la démo, sur un seul PC Windows :

1. **Le site** : présentation de Spacora → « Créer mon compte ».
2. **L'espace client** : choix d'une offre (19 €, 49 € ou 99 €) → paiement.
3. **Le téléchargement** de `Spacora-Setup.exe`, réservé aux abonnés.
4. **L'application** : installation, activation avec le compte client, création de l'entreprise, carte 3D. Les données restent sur le PC.

Le site tourne sur votre PC (`npm run demo:site`) ; l'application, elle, est un vrai programme Windows. Plus tard, le site sera en ligne sur spacora.tech et rien d'autre ne changera.

Les commandes `PS>` se tapent dans **PowerShell**.

---

## Une seule fois : préparer le PC

```powershell
PS> cd C:\Users\moreo\SurveillanceQT\platform
PS> git pull
PS> npm install
PS> npx prisma migrate deploy
```

## 1. Lancer le site

```powershell
PS> cd C:\Users\moreo\SurveillanceQT\platform
PS> npm run demo:site
```

Attendre le message `Ready`, **laisser cette fenêtre ouverte**, puis ouvrir **http://localhost:3000** dans Chrome ou Edge.

> Si vous étiez déjà connecté avec un compte de démonstration (admin@atelier-lumiere…), cliquez d'abord sur « Se déconnecter » ou utilisez une fenêtre de navigation privée.

## 2. Créer un compte client et payer

1. Sur l'accueil, cliquer sur **« Créer mon compte »**.
2. Remplir le formulaire (entreprise, prénom, nom, e-mail, mot de passe de 12 caractères minimum), cocher les CGU, **« Créer mon compte »**.
3. Vous arrivez dans **« Mon espace client »** : aucun abonnement, téléchargement verrouillé.
4. Sur l'offre **Pro**, cliquer sur **« Choisir Pro (paiement simulé) »**.
   L'abonnement devient actif et le bouton **« Télécharger Spacora (.exe) »** apparaît.

> Paiement par carte (vrai écran Stripe, en mode test) : voir l'annexe en bas de page. Sans clés Stripe, le paiement est simulé : idéal pour une démo.

## 3. Télécharger et installer l'application

1. Cliquer sur **« Télécharger Spacora (.exe) »** : `Spacora-Setup.exe` se télécharge (environ 150 Mo).
2. Lancer le fichier. Windows affiche **« Windows a protégé votre ordinateur »** (l'installateur n'est pas encore signé) : cliquer sur **« Informations complémentaires »**, puis **« Exécuter quand même »**.
3. Suivre l'installation. Une icône **Spacora** apparaît sur le bureau et dans le menu Démarrer.

## 4. Activer l'application

1. Ouvrir **Spacora** depuis le bureau. Au premier lancement, la base de données se prépare sur le PC (environ 30 secondes).
2. L'écran **« Activer Spacora »** s'affiche.
3. Cliquer sur **« Paramètres avancés »** et remplacer l'adresse par **`http://localhost:3000`** (le site de la démo tourne sur votre PC ; une fois en ligne, l'adresse par défaut sera la bonne).
4. Saisir l'**e-mail et le mot de passe du compte client** créé à l'étape 2 → **« Activer Spacora »**.

## 5. Créer l'entreprise et utiliser Spacora

1. L'écran **« Créer votre entreprise »** est prérempli avec le compte client. Choisir le **mot de passe de connexion à Spacora** sur ce PC → **« Créer et ouvrir Spacora »**.
2. La carte est vide : cliquer sur **« Générer de nouveaux locaux »**, puis **Aménager**, ajouter des collaborateurs (ou un fichier CSV), attribuer des postes, gérer le stock…
3. Fermer puis rouvrir Spacora : tout est conservé. On se reconnecte avec l'e-mail et le mot de passe choisis à l'étape 5.1.

**Menu Fichier** : _Sauvegarder les données…_ (copie de sécurité dans un dossier de votre choix), _Restaurer une sauvegarde…_, _Ouvrir le dossier des données_.

## Ce que la démo prouve

| Point                                   | Comment le montrer                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Le site et l'application sont séparés   | Le site est dans le navigateur ; l'application est un programme Windows, sans accueil ni tarifs |
| Il faut payer pour télécharger          | Avant paiement, le téléchargement est verrouillé dans l'espace client                           |
| Il faut payer pour activer              | Un compte sans abonnement payé est refusé à l'écran « Activer Spacora »                         |
| Les données restent chez le client      | Dossier des données (menu Fichier) ; Spacora fonctionne même site arrêté pendant 14 jours       |
| Abonnement arrêté = application bloquée | Au contrôle suivant (toutes les 12 h), l'application renvoie à l'activation avec un message     |

## Si quelque chose ne va pas

- **« Impossible de joindre le serveur Spacora »** à l'activation : la fenêtre `npm run demo:site` doit rester ouverte, et l'adresse des paramètres avancés doit être `http://localhost:3000`.
- **« Aucun abonnement actif »** : retourner dans l'espace client et payer une offre ; seul l'administrateur du compte client peut activer.
- **Spacora ne démarre pas** : le journal est dans `%APPDATA%\Spacora\spacora.log` (taper ce chemin dans l'Explorateur de fichiers) ; me l'envoyer.
- **Recommencer la démo de zéro** : désinstaller Spacora (Paramètres Windows → Applications), puis supprimer le dossier `%APPDATA%\Spacora`.

---

## Annexe : paiement par carte avec Stripe (mode test, facultatif)

1. Créer un compte gratuit sur **stripe.com** et rester en **mode test** (interrupteur « Mode test » en haut).
2. **Catalogue de produits** → créer 3 produits (Essentiel, Pro, Business), chacun avec un prix **mensuel** récurrent (19, 49, 99 €) et un prix **annuel** (190, 490, 990 €). Noter les identifiants `price_…`.
3. **Développeurs → Clés API** : copier la **clé secrète** `sk_test_…`.
4. Installer la **Stripe CLI** (stripe.com/docs/stripe-cli), puis dans une 2e fenêtre PowerShell :
   ```powershell
   PS> stripe login
   PS> stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Elle affiche un secret `whsec_…`.
5. Ajouter dans `platform\.env` :
   ```
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   STRIPE_PRICE_ESSENTIEL_MONTH="price_..."
   STRIPE_PRICE_ESSENTIEL_YEAR="price_..."
   STRIPE_PRICE_PRO_MONTH="price_..."
   STRIPE_PRICE_PRO_YEAR="price_..."
   STRIPE_PRICE_BUSINESS_MONTH="price_..."
   STRIPE_PRICE_BUSINESS_YEAR="price_..."
   ```
6. Relancer `npm run demo:site`. Avant de payer par carte, confirmer l'adresse e-mail du compte client : le lien est visible sur **http://localhost:3000/dev/emails**.
7. Dans l'espace client, **« Choisir Pro »** ouvre la page de paiement Stripe : carte de test **4242 4242 4242 4242**, date future, code 123. De retour dans l'espace client, l'abonnement est actif (quelques secondes, le temps que Stripe prévienne le site).
