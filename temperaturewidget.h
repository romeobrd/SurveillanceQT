#pragma once

#include <QFrame>
#include <QVector>

class QLabel;
class QPushButton;

/**
 * TemperatureWidget — panneau "Historique Température" du dashboard.
 *
 * Affiche la dernière température reçue, un badge d'état
 * (Normal / Avertissement / Alerte selon les seuils) et une courbe
 * des 60 dernières mesures.
 */
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

    // Boutons exposés pour que le dashboard puisse s'y connecter
    QPushButton *editButton() const;
    QPushButton *closeButton() const;

    Severity severity() const;
    void setTitle(const QString &title);

    // === MISE À JOUR DEPUIS LES DONNÉES MQTT ===
    void updateFromMqtt(double temperature, double humidity);

private:
    void refreshUi();

    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QLabel  *m_titleLabel;
    QLabel  *m_stateLabel;   // badge Normal / Avertissement / Alerte
    QLabel  *m_valueLabel;   // valeur courante en °C
    QWidget *m_chart;

    QVector<double> m_values;   // 60 dernières températures
    Severity m_severity;
    int m_warningThreshold;
    int m_alarmThreshold;
};
