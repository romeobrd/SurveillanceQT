#pragma once

#include <QWidget>

class QComboBox;
class QLabel;
class QPushButton;
class QTableWidget;

/**
 * DatabaseViewerWidget — visionneuse (lecture seule) de l'historique.
 *
 * Affiche les dernières lignes de la table `sensor_readings`
 * (date, capteur, température, humidité, fumée, eCO2, TVOC, détection)
 * avec un filtre par type de mesure et un choix du nombre de lignes.
 *
 * La table est lue via la connexion SQL nommée "surveillance", créée par
 * le DatabaseManager au démarrage : ce widget n'a donc besoin d'aucune
 * autre dépendance.
 */
class DatabaseViewerWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DatabaseViewerWidget(QWidget *parent = nullptr);

public slots:
    /** Recharge la table depuis la base de données. */
    void refresh();

private slots:
    void onLimitChanged();
    void onFilterChanged();

private:
    void buildUi();
    void applyStyle();

    QTableWidget *m_table;
    QPushButton  *m_refreshButton;
    QLabel       *m_statusLabel;
    QComboBox    *m_limitCombo;
    QComboBox    *m_filterCombo;
    int           m_rowLimit;
    QString       m_filter;   // "all" | "temperature" | "smoke" | "gas"
};
