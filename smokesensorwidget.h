#pragma once

#include <QFrame>
#include <QVector>

class QLabel;
class QPushButton;
class QTimer;
class QWidget;

class SmokeSensorWidget : public QFrame
{
    Q_OBJECT
public:
    enum Severity {
        Normal,
        Warning,
        Alarm
    };

    explicit SmokeSensorWidget(QWidget *parent = nullptr);

    QPushButton *editButton() const;
    QPushButton *closeButton() const;

    QString currentSummary() const;
    int currentValue() const;
    bool isSmokeDetected() const;
    Severity severity() const;

    void simulateStep();
    void resetSensor();
    void setTitle(const QString &title);
    void setResizable(bool enabled);

    // Real-time MQTT data methods
    void setRealTimeMode(bool enabled);
    void updateFromMqtt(int smokeLevel);          // legacy ppm path
    void updateFromMqttDetection(bool detected);  // Flying-Fish digital path
    void updateFromGasData(int eco2_ppm, int tvoc_ppb, bool detected);

private:
    void refreshUi();
    void setSeverity(Severity severity);
    void updateChart();

    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QLabel *m_titleLabel;
    QLabel *m_iconLabel;
    QLabel *m_stateLabel;
    QLabel *m_detailLabel;
    QLabel *m_ppmLabel;
    QWidget *m_chartWidget;
    QTimer *m_timer;

    QVector<int> m_historyValues;     // 0 = no smoke, 1 = smoke
    int m_currentValue;               // legacy ppm (kept for compat)
    int m_peakValue;
    int m_eco2Ppm;
    int m_tvocPpb;
    bool m_smokeDetected;
    int m_detectionCount;
    Severity m_severity;
    int m_warningThreshold;
    int m_alarmThreshold;

    // Real-time mode
    bool m_realTimeMode;
};
