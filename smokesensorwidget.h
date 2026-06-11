#pragma once

#include <QFrame>
#include <QVector>

class QLabel;
class QPushButton;

/**
 * SmokeSensorWidget — panneau "Détecteur de Fumée" du dashboard.
 *
 * Affiche l'état du capteur Flying-Fish (détection binaire), les mesures
 * de qualité d'air eCO2/TVOC, et un historique des 30 dernières mesures
 * sous forme de barres (rouge = fumée détectée, vert = air sain).
 */
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

    // Boutons exposés pour que le dashboard puisse s'y connecter
    QPushButton *editButton() const;
    QPushButton *closeButton() const;

    QString currentSummary() const;
    Severity severity() const;
    void setTitle(const QString &title);

    // === SEUILS D'ALARME ===
    // Le seuil d'alarme convertit le niveau numérique en détection ;
    // modifiables via l'éditeur de widget (et rechargés depuis la base
    // au démarrage).
    void setThresholds(int warningThreshold, int alarmThreshold);
    int warningThreshold() const { return m_warningThreshold; }
    int alarmThreshold() const { return m_alarmThreshold; }

    // === MISE À JOUR DEPUIS LES DONNÉES MQTT ===
    void updateFromMqtt(int smokeLevel);              // niveau numérique (ppm)
    void updateFromMqttDetection(bool detected);      // détection binaire
    void updateFromGasData(int eco2Ppm, int tvocPpb, bool detected);

private:
    void refreshUi();
    void updateChart();

    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QLabel  *m_titleLabel;
    QLabel  *m_iconLabel;
    QLabel  *m_stateLabel;
    QLabel  *m_detailLabel;
    QLabel  *m_ppmLabel;      // affichage eCO2 / TVOC
    QWidget *m_chartWidget;

    QVector<int> m_historyValues;   // 0 = pas de fumée, 1 = fumée
    bool m_smokeDetected;
    int  m_detectionCount;
    Severity m_severity;
    int  m_warningThreshold;        // mémorisé pour l'éditeur de widget
    int  m_alarmThreshold;          // seuil pour le niveau numérique (ppm)
    int  m_lastLevel;               // dernière mesure numérique (-1 = aucune)
};
