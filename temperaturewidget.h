#pragma once

#include <QFrame>
#include <QVector>

class QLabel;
class QPushButton;
class QTimer;
class QWidget;

class TemperatureWidget : public QFrame
{
    Q_OBJECT
public:
    enum Severity {
        Normal,
        Warning,
        Alarm
    };

    explicit TemperatureWidget(QWidget *parent = nullptr);

    QPushButton *editButton() const;
    QPushButton *closeButton() const;

    QString currentSummary() const;
    int currentValue() const;
    Severity severity() const;

    void simulateStep();
    void resetSensor();
    void setTitle(const QString &title);
    void setResizable(bool enabled);

    // Real-time MQTT data methods
    void setRealTimeMode(bool enabled);
    void setHumidity(double humidity);
    double humidity() const { return m_humidity; }
    void updateFromMqtt(double temperature, double humidity);

private:
    void refreshUi();
    void setSeverity(Severity severity);

    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QLabel *m_titleLabel;
    QLabel *m_stateLabel;
    QLabel *m_valueLabel;
    QWidget *m_chart;
    QTimer *m_timer;

    QVector<double> m_values;
    int m_currentValue;
    int m_peakValue;
    Severity m_severity;
    int m_warningThreshold;
    int m_alarmThreshold;

    // Real-time mode
    bool m_realTimeMode;
    double m_humidity;
private slots:
    void addtemperature (double value);
};

