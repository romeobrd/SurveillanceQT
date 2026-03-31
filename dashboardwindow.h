#pragma once

#include "arpscanner.h"

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

class DashboardWindow : public QWidget
{
    Q_OBJECT

public:
    explicit DashboardWindow(QWidget *parent = nullptr);

protected:
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;

private slots:
    void openNetworkScanner();
    void onDevicesConnected(const QVector<NetworkDevice> &devices);
    void updateConnectedDevicesStatus();
    void openModuleManager();
    void onSmokeWidgetEdit();
    void onTempWidgetEdit();
    void onCameraWidgetEdit();
    void onRadiationPanelEdit();

private:
    QWidget *createTitleBar();
    QWidget *createBottomBar();
    QWidget *createRadiationPanel();
    void handleLogin();
    void updateBottomStatus();
    void showCameraFullscreen();
    void setupNetworkFeatures();
    void setupWidgetEditButtons();

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
    QPushButton *m_scanNetworkButton;

    QTimer *m_statusTimer;
    bool m_dragging;
    QPoint m_dragOffset;

    QVector<NetworkDevice> m_connectedDevices;
};
