# Correctif local Qt/mpv/XCB

Ce pack sert si ton projet n’a pas de `main.cpp` accessible et que toute l’IHM est dans `dashboardwindow.cpp`.

## Fichiers à copier

Copie à la racine de ton projet Qt :

```txt
dashboardwindow.cpp
camerawidget.h
camerawidget.cpp
```

Garde ton `dashboardwindow.h`.

## Pourquoi

`mpv --wid` a besoin que Qt tourne via XCB/X11. Sous Wayland, la surface native du `QWidget` ne peut pas être utilisée correctement par mpv.

Ce `dashboardwindow.cpp` force donc :

```txt
QT_QPA_PLATFORM=xcb
```

avant la création de `QApplication`, via un initialiseur statique global.

## Test

Dans Qt Creator :

```txt
Build > Run qmake
Build > Clean Project
Build > Rebuild Project
Run
```

Puis ouvre `Application Output`. Tu dois voir dans les logs caméra :

```txt
[CameraWidget] platform "xcb"
```

Si Qt ne démarre pas et parle du plugin xcb :

```bash
sudo apt update
sudo apt install -y libxcb-cursor0 libxcb-xinerama0 libxkbcommon-x11-0 xwayland
```
