#pragma once

#include <QPoint>
#include <QWidget>

class QLabel;
class LoginWidget;
class QMouseEvent;
class QTimer;
class SmokeSensorWidget;
class TemperatureWidget;
class CameraWidget;

class DashboardWindow : public QWidget
{
public:
    explicit DashboardWindow(QWidget *parent = nullptr);

protected:
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;

private:
    QWidget *createTitleBar();
    QWidget *createBottomBar();
    QWidget *createRadiationPanel();
    void handleLogin();
    void updateBottomStatus();
    void showCameraFullscreen();

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

    QTimer *m_statusTimer;
    bool m_dragging;
    QPoint m_dragOffset;
};
