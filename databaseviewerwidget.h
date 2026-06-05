#pragma once

#include <QWidget>

class QTableWidget;
class QPushButton;
class QLabel;
class QComboBox;
class DatabaseManager;

/**
 * @brief Simple read-only viewer for the sensor_readings history table.
 *
 * Displays the last N rows of the SQLite/MySQL `sensor_readings` table
 * (timestamp, sensor_id, temperature, humidity, smoke_level,
 *  eco2_ppm, tvoc_ppb, smoke_detected). Provides a refresh button
 *  and a row-count selector so the user can browse stored data
 *  directly in the dashboard without an external tool.
 */
class DatabaseViewerWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DatabaseViewerWidget(QWidget *parent = nullptr);
    explicit DatabaseViewerWidget(DatabaseManager *dbManager, QWidget *parent = nullptr);

    void setDatabaseManager(DatabaseManager *dbManager);

public slots:
    /** Reload the table from the database. */
    void refresh();

private slots:
    void onLimitChanged(int index);
    void onFilterChanged(int index);

private:
    void buildUi();
    void applyStyle();

    DatabaseManager *m_dbManager;
    QTableWidget    *m_table;
    QPushButton     *m_refreshButton;
    QLabel          *m_statusLabel;
    QComboBox       *m_limitCombo;
    QComboBox       *m_filterCombo;
    int              m_rowLimit;
    QString          m_filter;   // "all" | "temperature" | "smoke" | "gas"
};
