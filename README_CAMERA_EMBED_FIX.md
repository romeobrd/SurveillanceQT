# Correctif caméra embarquée mpv / Qt

## Problème corrigé

Le flux `rtsp://127.0.0.1:8554/rascam` fonctionne quand le widget caméra est lancé seul, mais reste noir une fois intégré dans l'IHM.

La cause la plus probable n'est plus l'URL RTSP : elle est bien forcée en `127.0.0.1`.
Le problème vient de l'embedding mpv dans Qt : `mpv --wid=<id>` doit recevoir un handle natif X11 stable. Si le process est lancé trop tôt, pendant la construction du dashboard, mpv démarre mais n'affiche rien.

Ce pack corrige :

- lancement mpv différé jusqu'au `showEvent()` du dashboard ;
- attente active jusqu'à ce que la surface vidéo Qt soit visible et ait une taille valide ;
- suppression des options mpv risquées `--profile=low-latency` et `--cache=no` ;
- logs mpv visibles dans `Application Output` ;
- blocage explicite si Qt tourne sous Wayland au lieu de XCB ;
- arrêt propre de mpv quand on ferme/cache le widget ;
- prévention des doubles widgets caméra/doubles process mpv lors du scan réseau ;
- URL RTSP forcée : `rtsp://127.0.0.1:8554/rascam`.

## Fichiers à copier à la racine du projet

Copie uniquement :

```txt
camerawidget.h
camerawidget.cpp
dashboardwindow.cpp
```

Garde ton `dashboardwindow.h` actuel.

## Procédure locale

Depuis le dossier de ton projet :

```bash
cp dashboardwindow.cpp dashboardwindow.cpp.bak
cp camerawidget.cpp camerawidget.cpp.bak 2>/dev/null || true
cp camerawidget.h camerawidget.h.bak 2>/dev/null || true
```

Puis copie les 3 fichiers du pack à la racine du projet.

Dans Qt Creator :

```txt
Build > Run qmake
Build > Clean Project
Build > Rebuild Project
Run
```

## Test obligatoire avant l'IHM

Sur la machine qui lance l'IHM :

```bash
mpv --no-config --vo=x11 --hwdec=no --demuxer-lavf-o=rtsp_transport=tcp rtsp://127.0.0.1:8554/rascam
```

Si ça marche ici, le Docker/tunnel est bon.

## Test Wayland/X11

```bash
echo $XDG_SESSION_TYPE
```

Si ça répond `wayland`, lance l'IHM comme ça :

```bash
QT_QPA_PLATFORM=xcb ./applicationmalette
```

Dans Qt Creator :

```txt
Projects > Run > Run Environment > Add
QT_QPA_PLATFORM=xcb
```

## Debug

Regarde l'onglet Qt Creator :

```txt
Application Output
```

Tu dois voir :

```txt
[CameraWidget] platform "xcb"
[CameraWidget] wid "..."
[CameraWidget] start "mpv" (...)
```

Si mpv sort une erreur, elle sera affichée aussi.
