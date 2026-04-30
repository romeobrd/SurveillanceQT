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
    Severity severity() const;

    void simulateStep();
    void resetSensor();
    void setTitle(const QString &title);
    void updateValue(double value, const QString &unit);

    void setResizable(bool enabled);

private:
    void refreshUi();
    void setSeverity(Severity severity);

    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QLabel *m_titleLabel;
    QLabel *m_stateLabel;
    QWidget *m_chart;
    QTimer *m_timer;

    QVector<double> m_values;
    int m_currentValue;
    int m_peakValue;
    Severity m_severity;
    int m_warningThreshold;
    int m_alarmThreshold;
};
