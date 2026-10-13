# Mettre Spacora en ligne sur un VPS OVH

Résultat : **https://www.spacora.tech** (site vitrine) et **https://app.spacora.tech** (le service), en HTTPS, avec sauvegarde et purge RGPD chaque nuit. Compter environ une heure la première fois.

Ce qui tourne sur le serveur (fichier `deploy/compose.yaml`) :

| Service | Rôle                                                                                     |
| ------- | ---------------------------------------------------------------------------------------- |
| `caddy` | Reçoit les visiteurs, obtient et renouvelle seul les certificats HTTPS (Let's Encrypt)   |
| `app`   | L'application Spacora (site vitrine et service ; l'aiguillage www / app est automatique) |
| `db`    | La base PostgreSQL (jamais exposée sur Internet)                                         |

Les commandes qui commencent par `PS>` se tapent dans **PowerShell sur votre PC** ; les autres se tapent **sur le serveur**, une fois connecté en SSH.

## 1. Commander le VPS

Sur ovhcloud.com : **VPS**, puis :

- au moins **4 Go de mémoire** (la construction de l'application en a besoin ; 8 Go si possible) ;
- localisation **France** (Gravelines, Roubaix ou Strasbourg) : les données restent en France ;
- système : **Ubuntu 24.04**.

OVH envoie par e-mail l'**adresse IP** du serveur et l'identifiant (`ubuntu`) avec son mot de passe.

## 2. Se connecter au serveur

```powershell
PS> ssh ubuntu@ADRESSE_IP_DU_VPS
```

Au premier lancement, répondre `yes`, puis saisir le mot de passe reçu (il ne s'affiche pas pendant la frappe). Changer ce mot de passe tout de suite avec `passwd`.

Mettre le système à jour et n'ouvrir que les ports utiles (SSH, HTTP, HTTPS) :

```sh
sudo apt update && sudo apt upgrade -y
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

## 3. Installer Docker

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

Se reconnecter (`PS> ssh ubuntu@ADRESSE_IP_DU_VPS`) puis vérifier : `docker compose version`.

## 4. Faire pointer spacora.tech vers le serveur (DNS chez OVH)

Espace client OVH → **Web Cloud** → **Noms de domaine** → **spacora.tech** → onglet **Zone DNS**.

1. Supprimer les entrées existantes de type **A**, **AAAA** et **CNAME** pour `spacora.tech`, `www.spacora.tech` (OVH en crée par défaut vers une page d'attente).
2. Ajouter trois entrées de type **A**, chacune vers l'adresse IP du VPS :

| Sous-domaine | Type | Cible     |
| ------------ | ---- | --------- |
| _(vide)_     | A    | IP_DU_VPS |
| www          | A    | IP_DU_VPS |
| app          | A    | IP_DU_VPS |

La prise en compte prend de quelques minutes à quelques heures. Vérifier depuis le PC :

```powershell
PS> nslookup app.spacora.tech
```

La réponse doit afficher l'IP du VPS. **Attendre que ce soit le cas pour les trois adresses avant l'étape 7** (sinon les certificats HTTPS ne peuvent pas être obtenus).

## 5. Récupérer le code

Le dépôt GitHub est privé : on donne au serveur une **clé de lecture seule**.

```sh
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copier la ligne affichée, puis sur GitHub : dépôt **SurveillanceQT** → **Settings** → **Deploy keys** → **Add deploy key**, coller la clé, laisser « Allow write access » **décoché**.

```sh
sudo mkdir -p /opt/spacora && sudo chown ubuntu:ubuntu /opt/spacora
git clone git@github.com:romeobrd/SurveillanceQT.git /opt/spacora
cd /opt/spacora && git checkout main
```

(Tant que la branche de travail n'est pas fusionnée dans `main`, utiliser `git checkout claude/new-session-683qai`.)

## 6. Configurer

```sh
cd /opt/spacora/platform/deploy
cp .env.example .env
openssl rand -hex 32   # à lancer trois fois : une valeur pour DB_PASSWORD, AUTH_SECRET et CRON_SECRET
nano .env
```

Dans `nano`, remplir `ACME_EMAIL` (votre e-mail, pour les alertes de certificat) et les trois secrets ; laisser les lignes SMTP vides pour l'instant (étape 9). Enregistrer avec `Ctrl+O`, `Entrée`, puis quitter avec `Ctrl+X`.

**Garder une copie de ce fichier `.env` en lieu sûr** (gestionnaire de mots de passe) : sans lui, la base ne peut pas être rouverte.

## 7. Lancer

```sh
cd /opt/spacora/platform/deploy
docker compose up -d --build
docker compose run --rm app npx prisma migrate deploy
```

La construction prend 5 à 10 minutes la première fois. Ensuite, ouvrir **https://www.spacora.tech** : le site vitrine s'affiche, et **Essai gratuit** mène à **https://app.spacora.tech/inscription**. Créer votre propre entreprise : c'est votre premier compte client.

En cas de problème : `docker compose logs -f app` (ou `caddy` pour le HTTPS). `Ctrl+C` pour quitter les journaux.

## 8. Purge nocturne et sauvegardes

```sh
crontab /opt/spacora/platform/deploy/crontab
crontab -l
```

Chaque nuit : purge RGPD à 3 h 15, sauvegarde de la base à 3 h 45 dans `deploy/backups/` (14 jours conservés). Journaux dans `deploy/logs/`.

**Copier régulièrement les sauvegardes hors du serveur** (si le VPS est perdu, elles le sont aussi) :

```powershell
PS> scp -r ubuntu@ADRESSE_IP_DU_VPS:/opt/spacora/platform/deploy/backups C:\Sauvegardes\spacora
```

Option complémentaire : la sauvegarde automatique proposée par OVH pour le VPS.

Restaurer une sauvegarde (remplace les données actuelles) :

```sh
cd /opt/spacora/platform/deploy
docker compose stop app
docker compose exec -T db dropdb -U spacora spacora
docker compose exec -T db createdb -U spacora spacora
zcat backups/spacora-AAAA-MM-JJ.sql.gz | docker compose exec -T db psql -q -U spacora -d spacora
docker compose start app
```

## 9. E-mails (Brevo)

Sans cette étape l'application fonctionne, mais aucun e-mail ne part : les comptes reçoivent un mot de passe provisoire affiché à l'administrateur.

1. Créer un compte sur brevo.com (société française, serveurs en UE).
2. **Expéditeurs, domaines** → **Domaines** → ajouter `spacora.tech`. Brevo affiche des entrées DNS (code Brevo, DKIM, DMARC) : les ajouter dans la **Zone DNS** OVH (étape 4), exactement comme indiqué, puis cliquer sur « Authentifier » dans Brevo.
3. **SMTP & API** → onglet **SMTP** → **Générer une clé SMTP**.
4. Sur le serveur, compléter `SMTP_USER` (l'identifiant affiché par Brevo) et `SMTP_PASSWORD` (la clé) dans `deploy/.env`, puis :

```sh
cd /opt/spacora/platform/deploy && docker compose up -d
```

Tester : **Mot de passe oublié** depuis https://app.spacora.tech/login avec votre adresse.

## 10. Paiements (Stripe), plus tard

Les variables `STRIPE_*` se remplissent dans `deploy/.env` (voir le `.env.example` à la racine du projet). Adresse du webhook à déclarer dans Stripe : **https://app.spacora.tech/api/stripe/webhook**. Puis `docker compose up -d`.

## Mettre à jour l'application

```sh
cd /opt/spacora && git pull
cd platform/deploy
docker compose up -d --build
docker compose run --rm app npx prisma migrate deploy
```

## Ce qui a été vérifié

L'ensemble a été testé dans un environnement isolé avec des domaines de test : construction de l'image, migrations, aiguillage www / app et redirection de `spacora.tech` vers www, inscription complète en HTTPS (cookie de session sécurisé limité à app), en-têtes de sécurité, purge, sauvegarde puis restauration. Restent propres à votre serveur : le DNS, les certificats Let's Encrypt réels et l'envoi d'e-mails par Brevo.
