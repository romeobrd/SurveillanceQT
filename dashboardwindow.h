#pragma once

#include "arpscanner.h"
#include "databasemanager.h"

#include <QPoint>
#include <QWidget>

class QLabel;
class QMouseEvent;
class QPushButton;
class QTimer;
class CameraWidget;
class DatabaseViewerWidget;
class MqttClient;
class SmokeSensorWidget;
class TemperatureWidget;

/**
 * DashboardWindow — fenêtre principale du système de surveillance.
 *
 * Rôles :
 *   - construire l'interface (barre de titre, onglets, barre d'état) ;
 *   - gérer l'authentification (écran de verrouillage au démarrage) ;
 *   - créer les widgets capteurs après le scan réseau des Raspberry Pi ;
 *   - relier les données MQTT aux widgets et à la base de données ;
 *   - permettre le déplacement / redimensionnement des widgets capteurs.
 */
class DashboardWindow : public QWidget
{
    Q_OBJECT

public:
    explicit DashboardWindow(QWidget *parent = nullptr);

protected:
    // Fenêtre sans bordure : déplacement en glissant la barre de titre
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void resizeEvent(QResizeEvent *event) override;
    void showEvent(QShowEvent *event) override;
    // Déplacement / redimensionnement des widgets capteurs à la souris
    bool eventFilter(QObject *watched, QEvent *event) override;

private slots:
    // === RÉSEAU ===
    void openNetworkScanner();
    void onDevicesConnected(const QVector<NetworkDevice> &devices);

    // === WIDGETS CAPTEURS ===
    void onSmokeWidgetEdit();
    void onTempWidgetEdit();
    void onCameraWidgetEdit();
    void openModuleManager();

    // === AUTHENTIFICATION ===
    void onUserAuthenticated(const User &user);
    void showLoginDialog();

    // === MQTT ===
    void onMqttConnected();
    void onMqttDisconnected();
    void onMqttError(const QString &error);
    void onMqttTemperatureReceived(double temperature, double humidity, const QString &sensorId);
    void onMqttSmokeReceived(int smokeLevel, const QString &sensorId);
    void onMqttGasReceived(int eco2Ppm, int tvocPpb, bool smokeDetected, const QString &sensorId);

    // === BASE DE DONNÉES ===
    void refreshFromDatabase();

private:
    // Construction de l'interface
    QWidget *createTitleBar();
    QWidget *createBottomBar();
    void updateBottomStatus();
    void updateConnectedDevicesStatus();

    // Mise en place des sous-systèmes
    void setupNetworkFeatures();
    void setupAuthentication();
    void createLockOverlay();
    void setupMqtt();
    void setupDataRefreshTimer();

    // Droits et verrouillage
    void updateUIBasedOnRole();
    void setWidgetsEnabled(bool enabled);

    // Gestion des widgets capteurs
    void enableWidgetDragging(QWidget *widget);

    // --- Widgets capteurs (créés après le scan réseau) ---
    SmokeSensorWidget *m_smokeWidget;
    TemperatureWidget *m_temperatureWidget;
    CameraWidget      *m_cameraWidget;
    QWidget           *m_sensorContainer;   // conteneur à positionnement libre

    // --- Barre d'état du bas ---
    QLabel *m_userStatusLabel;
    QLabel *m_activeValueLabel;
    QLabel *m_alarmValueLabel;
    QLabel *m_warningValueLabel;
    QLabel *m_defaultValueLabel;
    QLabel *m_networkStatusLabel;
    QPushButton *m_scanNetworkButton;

    // --- Timers ---
    QTimer *m_statusTimer;        // rafraîchit la barre d'état
    QTimer *m_dataRefreshTimer;   // relit la base de données

    // --- Déplacement de la fenêtre sans bordure ---
    bool   m_dragging;
    QPoint m_dragOffset;

    QVector<NetworkDevice> m_connectedDevices;

    // --- Authentification ---
    DatabaseManager *m_dbManager;
    User     m_currentUser;
    QWidget *m_lockOverlay;       // écran de verrouillage (login)
    bool     m_isAuthenticated;

    // --- Onglet "Historique BDD" ---
    DatabaseViewerWidget *m_dbViewer;

    // --- Client MQTT ---
    MqttClient *m_mqttClient;
};
