#pragma once

#include "arpscanner.h"
#include "databasemanager.h"
#include "sensordatabroker.h"

#include <QPoint>
#include <QWidget>

class QLabel;
class LoginWidget;
class QMouseEvent;
class QTimer;
class SmokeSensorWidget;
class TemperatureWidget;
class CameraWidget;
class QPushButton;
class DatabaseManager;

class DashboardWindow : public QWidget
{
    Q_OBJECT

public:
    explicit DashboardWindow(QWidget *parent = nullptr);

protected:
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void paintEvent(QPaintEvent *event) override;
    void resizeEvent(QResizeEvent *event) override;
    bool eventFilter(QObject *watched, QEvent *event) override;

private slots:
    void openNetworkScanner();
    void onDevicesConnected(const QVector<NetworkDevice> &devices);
    void updateConnectedDevicesStatus();
    void openModuleManager();
    void onSmokeWidgetEdit();
    void onTempWidgetEdit();
    void onCameraWidgetEdit();
    void onRadiationPanelEdit();
    void onUserAuthenticated(const User &user);
    void onUserLoggedOut();
    void showLoginDialog();
    void logout();
    void onAddSensor();

private:
    QWidget *createTitleBar();
    QWidget *createBottomBar();
    QWidget *createRadiationPanel();
    void handleLogin();
    void updateBottomStatus();
    void showCameraFullscreen();
    void setupNetworkFeatures();
    void setupMqttBroker();
    void setupWidgetEditButtons();
    void addSensorToGrid(QWidget *widget, int rowSpan = 1, int colSpan = 1);
    void setWidgetSize(QWidget *widget, const QSize &size);
    void resetWidgetSize(QWidget *widget);
    void enableWidgetDragging(QWidget *widget);
    void setupAuthentication();
    void createLockOverlay();
    void updateUIBasedOnRole();
    void setWidgetsEnabled(bool enabled);

    LoginWidget *m_loginWidget;
    SmokeSensorWidget *m_smokeWidget;
    TemperatureWidget *m_temperatureWidget;
    CameraWidget *m_cameraWidget;
    QWidget *m_radiationPanel;

    QLabel *m_userStatusLabel;
    QLabel *m_activeValueLabel;
    QLabel *m_alarmValueLabel;
    QLabel *m_warningValueLabel;
    QLabel *m_defaultValueLabel;

    QLabel *m_networkStatusLabel;
    QLabel *m_mqttStatusLabel;
    QPushButton *m_scanNetworkButton;
    QPushButton *m_logoutButton;

    QTimer *m_statusTimer;
    bool m_dragging;
    QPoint m_dragOffset;

    QVector<NetworkDevice> m_connectedDevices;

    // Dynamic sensor container (positionnement absolu)
    QWidget *m_sensorContainer;
    QVector<QWidget*> m_dynamicSensors;

    // MQTT broker
    SensorDataBroker *m_broker;

    // Authentication
    DatabaseManager *m_dbManager;
    User m_currentUser;
    QWidget *m_lockOverlay;
    bool m_isAuthenticated;
};
