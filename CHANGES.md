# Changements appliqués

## `camerawidget.h` / `camerawidget.cpp`

Création d'un `CameraWidget` autonome basé sur `mpv` + `QProcess`.

Fonctions principales :

- titre éditable ;
- URL RTSP configurable ;
- lecture / arrêt / reload propre ;
- intégration mpv dans un `QWidget` natif via `--wid` ;
- boutons fermer, éditer, reload, capture ;
- messages d'état lisibles dans le widget ;
- nettoyage du processus `mpv` au destructeur.

## `dashboardwindow.cpp`

### Supprimé

Ancien démarrage caméra trop tôt dans le constructeur :

```cpp
m_cameraWidget = new CameraWidget(this);
m_cameraWidget->setGeometry(...);
QTimer::singleShot(2000, ... play ...);
```

Ce bloc créait la caméra hors du vrai conteneur et avant la construction du layout principal.

### Ajouté

Création propre dans `m_sensorContainer` :

```cpp
m_cameraWidget = new CameraWidget(m_sensorContainer);
m_cameraWidget->setStreamUrl("rtsp://127.0.0.1:8554/rascam");
QTimer::singleShot(500, m_cameraWidget, &CameraWidget::play);
```

### Corrigé

URL dynamique caméra après scan :

```cpp
rtsp://%1:8554/rascam
```

au lieu de :

```cpp
rtsp://%1:8554/cam
```

### Sécurisé

`onCameraWidgetEdit()` vérifie maintenant que `m_cameraWidget` existe avant de l'utiliser.

## `applicationmalette.pro`

Aucune modification obligatoire : ton `.pro` référence déjà `camerawidget.cpp` et `camerawidget.h`.

Aucune dépendance libVLC ajoutée. Le backend est `mpv`.


## Correctif localhost RTSP

- Suppression de l'URL dynamique `rtsp://%1:8554/rascam` dans la création dynamique du widget caméra.
- Le widget caméra utilise désormais toujours `rtsp://127.0.0.1:8554/rascam`, car c'est le Docker/tunnel local qui reçoit le flux du Raspberry.
- Objectif : éviter que mpv tente de lire le flux sur l'IP du module détecté et quitte avec un code d'erreur.
