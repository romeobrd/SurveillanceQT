# Intégration locale du widget caméra mpv dans `applicationmalette`

## Ce que contient ce pack

```text
camerawidget.h
camerawidget.cpp
dashboardwindow.cpp
applicationmalette.pro
dashboardwindow_local_camera.patch
tests/static_integration_tests.py
tests/local_runtime_check_linux.sh
```

## Principe

Ton repo caméra actuel utilise `mpv` lancé par `QProcess`, avec intégration dans un `QWidget` via `--wid`.
Ce pack transforme cette logique en composant réutilisable : `CameraWidget`.

Le dashboard crée ensuite la caméra directement dans `m_sensorContainer` :

```text
DashboardWindow
└── m_sensorContainer
    └── CameraWidget
        └── QWidget natif vidéo utilisé par mpv --wid
```

Flux par défaut :

```text
rtsp://127.0.0.1:8554/rascam
```

## Installation sans passer par GitHub

### 1. Fais une sauvegarde locale

Dans ton dossier projet Qt :

```bash
cp dashboardwindow.cpp dashboardwindow.cpp.bak
cp camerawidget.cpp camerawidget.cpp.bak 2>/dev/null || true
cp camerawidget.h camerawidget.h.bak 2>/dev/null || true
cp applicationmalette.pro applicationmalette.pro.bak
```

Sur Windows PowerShell :

```powershell
Copy-Item .\dashboardwindow.cpp .\dashboardwindow.cpp.bak
Copy-Item .\applicationmalette.pro .\applicationmalette.pro.bak
```

### 2. Copie les fichiers du pack dans ton projet

Depuis le dossier du pack :

```bash
cp camerawidget.h /chemin/vers/ton/projet/
cp camerawidget.cpp /chemin/vers/ton/projet/
cp dashboardwindow.cpp /chemin/vers/ton/projet/
```

Sur Windows PowerShell :

```powershell
Copy-Item .\camerawidget.h C:\chemin\vers\ton\projet\ -Force
Copy-Item .\camerawidget.cpp C:\chemin\vers\ton\projet\ -Force
Copy-Item .\dashboardwindow.cpp C:\chemin\vers\ton\projet\ -Force
```

### 3. Ton `.pro` est déjà bon

Ton fichier `applicationmalette.pro` contient déjà :

```pro
SOURCES += \
    $$PWD/camerawidget.cpp

HEADERS += \
    $$PWD/camerawidget.h
```

Donc aucune dépendance VLC/libVLC à ajouter.

Le backend utilisé est `mpv`, appelé comme programme externe par `QProcess`.

### 4. Installer mpv sur la machine qui lance l'IHM

Linux / Ubuntu :

```bash
sudo apt update
sudo apt install -y mpv
```

Windows :

1. Installer `mpv`.
2. Ajouter `mpv.exe` au `PATH`, ou le mettre dans un dossier reconnu.
3. Vérifier dans PowerShell :

```powershell
mpv --version
```

## Test avant Qt

Lance le flux hors IHM :

```bash
mpv --no-config --vo=x11 --hwdec=no --demuxer-lavf-o=rtsp_transport=tcp rtsp://127.0.0.1:8554/rascam
```

Résultat attendu : la caméra s'affiche.

## Test environnement Linux

Depuis le pack :

```bash
bash tests/local_runtime_check_linux.sh
```

## Test statique du pack

Depuis le pack :

```bash
python3 tests/static_integration_tests.py
```

Résultat attendu :

```text
OK - static integration tests passed.
```

## Build propre dans Qt Creator

1. Ouvre ton projet `applicationmalette.pro`.
2. Supprime l'ancien dossier `build-*` si tu as des erreurs sales.
3. Dans Qt Creator : `Build > Run qmake`.
4. Puis : `Build > Rebuild Project`.
5. Lance l'application.

## Ce qui doit se passer

- Le widget `Caméra Salle Serveur` apparaît dans le dashboard.
- Le flux démarre automatiquement après environ 500 ms.
- Le bouton `↻` relance mpv proprement.
- Le bouton `✎` ouvre l'éditeur caméra existant.
- Le bouton `📷` tente une capture du widget.
- Le bouton `✕` masque la caméra.

## Tests fonctionnels à faire

### Test 1 : flux direct

```bash
mpv --no-config --vo=x11 --hwdec=no --demuxer-lavf-o=rtsp_transport=tcp rtsp://127.0.0.1:8554/rascam
```

Attendu : vidéo OK.

### Test 2 : lancement IHM

Lance l'IHM depuis Qt Creator.

Attendu : pas de crash, caméra visible, statut `Connexion au flux…` puis `Flux lancé`.

### Test 3 : reload

Clique sur `↻`.

Attendu : le flux redémarre sans ouvrir de fenêtre externe.

### Test 4 : fermeture IHM

Ferme l'IHM.

Attendu : aucun processus mpv zombie.

Linux :

```bash
pgrep -af mpv
```

### Test 5 : panne volontaire

Coupe le tunnel ou change l'URL.

Attendu : message d'erreur dans le widget, l'IHM ne crash pas.

## Retour arrière local

Si tu veux annuler :

```bash
mv dashboardwindow.cpp.bak dashboardwindow.cpp
mv camerawidget.cpp.bak camerawidget.cpp 2>/dev/null || true
mv camerawidget.h.bak camerawidget.h 2>/dev/null || true
mv applicationmalette.pro.bak applicationmalette.pro
```

Puis relance qmake et rebuild.
