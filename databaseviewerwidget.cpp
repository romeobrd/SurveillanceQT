#include "databaseviewerwidget.h"

#include "databasemanager.h"

#include <QComboBox>
#include <QDebug>
#include <QHBoxLayout>
#include <QHeaderView>
#include <QLabel>
#include <QPushButton>
#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QTableWidget>
#include <QTableWidgetItem>
#include <QTimer>
#include <QVBoxLayout>
#include <QVariant>

namespace {
constexpr int kColTimestamp = 0;
constexpr int kColSensorId  = 1;
constexpr int kColTemp      = 2;
constexpr int kColHumidity  = 3;
constexpr int kColSmokeLvl  = 4;
constexpr int kColEco2      = 5;
constexpr int kColTvoc      = 6;
constexpr int kColDetected  = 7;
constexpr int kColCount     = 8;
} // namespace

DatabaseViewerWidget::DatabaseViewerWidget(QWidget *parent)
    : DatabaseViewerWidget(nullptr, parent)
{
}

DatabaseViewerWidget::DatabaseViewerWidget(DatabaseManager *dbManager, QWidget *parent)
    : QWidget(parent)
    , m_dbManager(dbManager)
    , m_table(nullptr)
    , m_refreshButton(nullptr)
    , m_statusLabel(nullptr)
    , m_limitCombo(nullptr)
    , m_filterCombo(nullptr)
    , m_rowLimit(50)
    , m_filter(QStringLiteral("all"))
{
    buildUi();
    applyStyle();

    if (m_dbManager) {
        // Defer the first load until after the widget is fully constructed
        QTimer::singleShot(0, this, &DatabaseViewerWidget::refresh);
    }
}

void DatabaseViewerWidget::setDatabaseManager(DatabaseManager *dbManager)
{
    m_dbManager = dbManager;
    refresh();
}

void DatabaseViewerWidget::buildUi()
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(12, 10, 12, 10);
    root->setSpacing(8);

    // ---------- Toolbar ----------
    auto *toolbar = new QHBoxLayout;
    toolbar->setSpacing(8);

    auto *title = new QLabel(tr("Historique des mesures (sensor_readings)"), this);
    title->setObjectName(QStringLiteral("dbViewerTitle"));
    toolbar->addWidget(title);
    toolbar->addStretch();

    auto *filterLabel = new QLabel(tr("Type :"), this);
    toolbar->addWidget(filterLabel);

    m_filterCombo = new QComboBox(this);
    m_filterCombo->addItem(tr("Tous"),         QStringLiteral("all"));
    m_filterCombo->addItem(tr("Température"),  QStringLiteral("temperature"));
    m_filterCombo->addItem(tr("Fumée"),        QStringLiteral("smoke"));
    m_filterCombo->addItem(tr("Gaz (eCO2/TVOC)"), QStringLiteral("gas"));
    toolbar->addWidget(m_filterCombo);

    auto *limitLabel = new QLabel(tr("Lignes :"), this);
    toolbar->addWidget(limitLabel);

    m_limitCombo = new QComboBox(this);
    m_limitCombo->addItem(QStringLiteral("50"),  50);
    m_limitCombo->addItem(QStringLiteral("100"), 100);
    m_limitCombo->addItem(QStringLiteral("250"), 250);
    m_limitCombo->addItem(QStringLiteral("500"), 500);
    toolbar->addWidget(m_limitCombo);

    m_refreshButton = new QPushButton(tr("Actualiser"), this);
    m_refreshButton->setObjectName(QStringLiteral("dbViewerRefresh"));
    toolbar->addWidget(m_refreshButton);

    root->addLayout(toolbar);

    // ---------- Table ----------
    m_table = new QTableWidget(this);
    m_table->setObjectName(QStringLiteral("dbViewerTable"));
    m_table->setColumnCount(kColCount);
    m_table->setHorizontalHeaderLabels({
        tr("Date / Heure"),
        tr("Capteur"),
        tr("Temp. (°C)"),
        tr("Humidité (%)"),
        tr("Fumée"),
        tr("eCO2 (ppm)"),
        tr("TVOC (ppb)"),
        tr("Détecté")
    });
    m_table->verticalHeader()->setVisible(false);
    m_table->horizontalHeader()->setStretchLastSection(true);
    m_table->horizontalHeader()->setSectionResizeMode(QHeaderView::ResizeToContents);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->setAlternatingRowColors(true);
    m_table->setSortingEnabled(false);
    root->addWidget(m_table, 1);

    // ---------- Status bar ----------
    m_statusLabel = new QLabel(tr("Prêt."), this);
    m_statusLabel->setObjectName(QStringLiteral("dbViewerStatus"));
    root->addWidget(m_statusLabel);

    // ---------- Connections ----------
    connect(m_refreshButton, &QPushButton::clicked,
            this, &DatabaseViewerWidget::refresh);
    connect(m_limitCombo, QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &DatabaseViewerWidget::onLimitChanged);
    connect(m_filterCombo, QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &DatabaseViewerWidget::onFilterChanged);
}

void DatabaseViewerWidget::applyStyle()
{
    setStyleSheet(
        "DatabaseViewerWidget {"
        "  background: rgba(16, 29, 59, 0.55);"
        "  border-radius: 12px;"
        "}"
        "QLabel { color: #edf4ff; }"
        "QLabel#dbViewerTitle {"
        "  font-size: 16px; font-weight: 700; color: #ffffff;"
        "}"
        "QLabel#dbViewerStatus {"
        "  color: #a8c0ee; font-size: 12px;"
        "}"
        "QPushButton#dbViewerRefresh {"
        "  background: #2d6cdf; color: white; border: none;"
        "  padding: 6px 14px; border-radius: 6px; font-weight: 600;"
        "}"
        "QPushButton#dbViewerRefresh:hover { background: #3b82f6; }"
        "QPushButton#dbViewerRefresh:pressed { background: #1f4fa3; }"
        "QComboBox {"
        "  background: rgba(255,255,255,0.08); color: #edf4ff;"
        "  border: 1px solid rgba(173, 191, 233, 0.25); border-radius: 4px;"
        "  padding: 4px 8px;"
        "}"
        "QTableWidget#dbViewerTable {"
        "  background: rgba(255,255,255,0.04); color: #edf4ff;"
        "  gridline-color: rgba(173, 191, 233, 0.18);"
        "  border: 1px solid rgba(173, 191, 233, 0.18);"
        "  border-radius: 6px;"
        "  alternate-background-color: rgba(255,255,255,0.06);"
        "}"
        "QTableWidget#dbViewerTable::item:selected {"
        "  background: #2d6cdf; color: white;"
        "}"
        "QHeaderView::section {"
        "  background: rgba(7, 18, 41, 0.55); color: #edf4ff;"
        "  padding: 6px; border: none;"
        "  border-right: 1px solid rgba(173, 191, 233, 0.18);"
        "  font-weight: 600;"
        "}"
    );
}

void DatabaseViewerWidget::onLimitChanged(int /*index*/)
{
    if (!m_limitCombo) return;
    m_rowLimit = m_limitCombo->currentData().toInt();
    if (m_rowLimit <= 0) m_rowLimit = 50;
    refresh();
}

void DatabaseViewerWidget::onFilterChanged(int /*index*/)
{
    if (!m_filterCombo) return;
    m_filter = m_filterCombo->currentData().toString();
    if (m_filter.isEmpty()) m_filter = QStringLiteral("all");
    refresh();
}

void DatabaseViewerWidget::refresh()
{
    if (!m_table) return;

    m_table->setRowCount(0);

    // Try to get the named connection. The DatabaseManager creates it as
    // "surveillance" once initialize() succeeds. The viewer does NOT need
    // a pointer to DatabaseManager: as long as the connection exists and
    // is open, we can query it.
    QSqlDatabase db = QSqlDatabase::database(QStringLiteral("surveillance"),
                                             /*open=*/false);

    if (!db.isValid()) {
        if (m_statusLabel) {
            m_statusLabel->setText(tr("Base de données non disponible — connectez-vous d'abord."));
        }
        qDebug() << "DatabaseViewerWidget: connection 'surveillance' is not yet registered";
        return;
    }

    if (!db.isOpen()) {
        if (!db.open()) {
            if (m_statusLabel) {
                m_statusLabel->setText(tr("Connexion fermée : %1").arg(db.lastError().text()));
            }
            qDebug() << "DatabaseViewerWidget: connection 'surveillance' is not open and reopen failed:"
                     << db.lastError().text();
            return;
        }
    }

    qDebug() << "DatabaseViewerWidget: refreshing — driver:" << db.driverName()
             << " db:" << db.databaseName()
             << " filter:" << m_filter << " limit:" << m_rowLimit;

    // Diagnostic: total rows in the table regardless of filter
    int totalRows = -1;
    {
        QSqlQuery countQuery(db);
        if (countQuery.exec(QStringLiteral("SELECT COUNT(*) FROM sensor_readings"))
            && countQuery.next()) {
            totalRows = countQuery.value(0).toInt();
        } else {
            qDebug() << "DatabaseViewerWidget: COUNT(*) failed:"
                     << countQuery.lastError().text();
        }
    }
    qDebug() << "DatabaseViewerWidget: total rows in sensor_readings =" << totalRows;

    QString sql = QStringLiteral(
        "SELECT timestamp, sensor_id, temperature, humidity, smoke_level, "
        "       eco2_ppm, tvoc_ppb, smoke_detected "
        "  FROM sensor_readings ");

    if (m_filter == QLatin1String("temperature")) {
        sql += QStringLiteral(" WHERE temperature IS NOT NULL ");
    } else if (m_filter == QLatin1String("smoke")) {
        sql += QStringLiteral(" WHERE smoke_level IS NOT NULL ");
    } else if (m_filter == QLatin1String("gas")) {
        sql += QStringLiteral(" WHERE eco2_ppm IS NOT NULL OR tvoc_ppb IS NOT NULL ");
    }

    sql += QStringLiteral(" ORDER BY timestamp DESC LIMIT :lim");

    QSqlQuery query(db);
    query.prepare(sql);
    query.bindValue(QStringLiteral(":lim"), m_rowLimit);

    if (!query.exec()) {
        const QString err = query.lastError().text();
        if (m_statusLabel) {
            m_statusLabel->setText(tr("Erreur SQL : %1").arg(err));
        }
        qWarning() << "DatabaseViewerWidget: SELECT failed:" << err;
        return;
    }

    int row = 0;
    while (query.next()) {
        m_table->insertRow(row);

        const QVariant ts        = query.value(0);
        const QString  sensorId  = query.value(1).toString();
        const QVariant temp      = query.value(2);
        const QVariant humidity  = query.value(3);
        const QVariant smokeLvl  = query.value(4);
        const QVariant eco2      = query.value(5);
        const QVariant tvoc      = query.value(6);
        const QVariant detected  = query.value(7);

        auto setCell = [&](int col, const QString &text, bool numeric = false) {
            auto *item = new QTableWidgetItem(text);
            if (numeric) {
                item->setTextAlignment(Qt::AlignRight | Qt::AlignVCenter);
            } else {
                item->setTextAlignment(Qt::AlignLeft | Qt::AlignVCenter);
            }
            m_table->setItem(row, col, item);
        };

        setCell(kColTimestamp, ts.toString());
        setCell(kColSensorId,  sensorId);
        setCell(kColTemp,      temp.isNull()     ? QStringLiteral("—")
                                                 : QString::number(temp.toDouble(), 'f', 2), true);
        setCell(kColHumidity,  humidity.isNull() ? QStringLiteral("—")
                                                 : QString::number(humidity.toDouble(), 'f', 1), true);
        setCell(kColSmokeLvl,  smokeLvl.isNull() ? QStringLiteral("—")
                                                 : QString::number(smokeLvl.toInt()), true);
        setCell(kColEco2,      eco2.isNull()     ? QStringLiteral("—")
                                                 : QString::number(eco2.toInt()), true);
        setCell(kColTvoc,      tvoc.isNull()     ? QStringLiteral("—")
                                                 : QString::number(tvoc.toInt()), true);
        setCell(kColDetected,  detected.isNull() ? QStringLiteral("—")
                                                 : (detected.toInt() ? tr("OUI") : tr("non")));

        ++row;
    }

    m_table->resizeColumnsToContents();

    qDebug() << "DatabaseViewerWidget: fetched" << row << "row(s) for filter" << m_filter;

    if (m_statusLabel) {
        const QString totalText = (totalRows >= 0)
                ? tr("total : %1").arg(totalRows)
                : tr("total : ?");
        m_statusLabel->setText(tr("%1 ligne(s) chargée(s) — filtre : %2 — limite : %3 — %4")
                               .arg(row)
                               .arg(m_filterCombo ? m_filterCombo->currentText() : tr("Tous"))
                               .arg(m_rowLimit)
                               .arg(totalText));
    }
}
