# Rapport de test du pack local caméra

## Tests exécutés ici

Commande :

```bash
cd /mnt/data/applicationmalette_camera_local_pack
python3 tests/static_integration_tests.py
```

Résultat :

```text
OK - static integration tests passed.
Note - Qt/qmake/mpv runtime build must still be tested on your local machine.
```

## Ce qui a été vérifié automatiquement

- `applicationmalette.pro` référence bien `camerawidget.cpp`.
- `applicationmalette.pro` référence bien `camerawidget.h`.
- Aucune dépendance `libVLC` n'est présente dans le pack.
- `CameraWidget` expose l'API attendue par `DashboardWindow` :
  - `setTitle()`
  - `title()`
  - `setStreamUrl()`
  - `streamUrl()`
  - `play()`
  - `stop()`
  - `reloadFrame()`
  - `currentFrame()`
  - `closeButton()`
  - `editButton()`
  - `reloadButton()`
  - `snapshotButton()`
- Le backend vidéo utilise `QProcess` + `mpv`.
- Le flux RTSP est forcé en TCP.
- `mpv` est intégré dans le widget natif via `--wid`.
- Le flux local par défaut est `rtsp://127.0.0.1:8554/rascam`.
- `DashboardWindow` crée désormais la caméra dans `m_sensorContainer`.
- L'ancien bloc `new CameraWidget(this)` hors layout a été supprimé.
- L'URL dynamique caméra après scan utilise `/rascam` et non `/cam`.

## Test non exécuté ici

Compilation Qt complète non exécutée dans cet environnement, car `qmake`, Qt Widgets et `mpv` ne sont pas installés dans le conteneur.

À faire sur ta machine :

```bash
qmake applicationmalette.pro
make -j$(nproc)
```

ou via Qt Creator :

```text
Build > Run qmake
Build > Rebuild Project
```
