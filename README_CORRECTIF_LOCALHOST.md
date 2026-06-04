# Correctif caméra Qt : forcer le flux RTSP local

Ce correctif force le widget caméra à lire :

```txt
rtsp://127.0.0.1:8554/rascam
```

Pourquoi : ton Docker/tunnel local reçoit déjà l'image du Raspberry sur `127.0.0.1:8554`. L'IHM ne doit donc pas générer une URL dynamique avec l'IP détectée du module.

## Fichiers à copier pour tester en local

Copie ces fichiers à la racine de ton projet Qt, là où se trouve `applicationmalette.pro` :

```txt
camerawidget.h
camerawidget.cpp
dashboardwindow.cpp
```

Tu gardes ton `dashboardwindow.h` actuel.

## Test avant lancement Qt

```bash
mpv --no-config --vo=x11 --hwdec=no --demuxer-lavf-o=rtsp_transport=tcp rtsp://127.0.0.1:8554/rascam
```

Si cette commande affiche la caméra, le flux est bon.

## Dans Qt Creator

1. `Build > Run qmake`
2. `Build > Clean Project`
3. `Build > Rebuild Project`
4. `Run`

## Zone corrigée

Dans `dashboardwindow.cpp`, la partie caméra dynamique n'utilise plus :

```cpp
QString rtspUrl = QStringLiteral("rtsp://%1:8554/rascam").arg(device.ipAddress);
camWidget->setStreamUrl(rtspUrl);
```

Elle utilise maintenant :

```cpp
camWidget->setStreamUrl(QStringLiteral("rtsp://127.0.0.1:8554/rascam"));
```
