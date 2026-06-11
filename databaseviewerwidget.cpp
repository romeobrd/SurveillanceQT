#include "databaseviewerwidget.h"

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
#include <QVBoxLayout>

namespace {
// Indices des colonnes du tableau (pour rester lisible plus bas).
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

// =====================================================================
//  CONSTRUCTION
// =====================================================================
DatabaseViewerWidget::DatabaseViewerWidget(QWidget *parent)
    : QWidget(parent)
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
}

void DatabaseViewerWidget::buildUi()
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(12, 10, 12, 10);
    root->setSpacing(8);

    // --- Barre d'outils : titre, filtre, limite, bouton actualiser ---
    auto *toolbar = new QHBoxLayout;
    toolbar->setSpacing(8);

    auto *title = new QLabel(tr("Historique des mesures (sensor_readings)"), this);
    title->setObjectName(QStringLiteral("dbViewerTitle"));
    toolbar->addWidget(title);
    toolbar->addStretch();

    toolbar->addWidget(new QLabel(tr("Type :"), this));

    m_filterCombo = new QComboBox(this);
    m_filterCombo->addItem(tr("Tous"),            QStringLiteral("all"));
    m_filterCombo->addItem(tr("Température"),     QStringLiteral("temperature"));
    m_filterCombo->addItem(tr("Fumée"),           QStringLiteral("smoke"));
    m_filterCombo->addItem(tr("Gaz (eCO2/TVOC)"), QStringLiteral("gas"));
    toolbar->addWidget(m_filterCombo);

    toolbar->addWidget(new QLabel(tr("Lignes :"), this));

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

    // --- Tableau des mesures ---
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

    // --- Barre d'état ---
    m_statusLabel = new QLabel(tr("Prêt."), this);
    m_statusLabel->setObjectName(QStringLiteral("dbViewerStatus"));
    root->addWidget(m_statusLabel);

    // --- Connexions ---
    connect(m_refreshButton, &QPushButton::clicked,
            this, &DatabaseViewerWidget::refresh);
    connect(m_limitCombo, &QComboBox::currentIndexChanged,
            this, &DatabaseViewerWidget::onLimitChanged);
    connect(m_filterCombo, &QComboBox::currentIndexChanged,
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

// =====================================================================
//  SLOTS DES FILTRES
// =====================================================================
void DatabaseViewerWidget::onLimitChanged()
{
    m_rowLimit = m_limitCombo->currentData().toInt();
    if (m_rowLimit <= 0)
        m_rowLimit = 50;
    refresh();
}

void DatabaseViewerWidget::onFilterChanged()
{
    m_filter = m_filterCombo->currentData().toString();
    if (m_filter.isEmpty())
        m_filter = QStringLiteral("all");
    refresh();
}

// =====================================================================
//  CHARGEMENT DES DONNÉES
// =====================================================================
void DatabaseViewerWidget::refresh()
{
    if (!m_table)
        return;

    m_table->setRowCount(0);

    // Connexion nommée créée par le DatabaseManager.
    QSqlDatabase db = QSqlDatabase::database(QStringLiteral("surveillance"),
                                             /*open=*/false);

    if (!db.isValid()) {
        m_statusLabel->setText(tr("Base de données non disponible — connectez-vous d'abord."));
        return;
    }

    if (!db.isOpen() && !db.open()) {
        m_statusLabel->setText(tr("Connexion fermée : %1").arg(db.lastError().text()));
        return;
    }

    // Nombre total de lignes (affiché dans la barre d'état)
    int totalRows = -1;
    QSqlQuery countQuery(db);
    if (countQuery.exec(QStringLiteral("SELECT COUNT(*) FROM sensor_readings"))
        && countQuery.next()) {
        totalRows = countQuery.value(0).toInt();
    }

    // Construction de la requête selon le filtre sélectionné
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
        m_statusLabel->setText(tr("Erreur SQL : %1").arg(err));
        qWarning() << "DatabaseViewerWidget: échec du SELECT:" << err;
        return;
    }

    // Remplissage du tableau ligne par ligne
    int row = 0;
    while (query.next()) {
        m_table->insertRow(row);

        const QVariant ts       = query.value(0);
        const QString  sensorId = query.value(1).toString();
        const QVariant temp     = query.value(2);
        const QVariant humidity = query.value(3);
        const QVariant smokeLvl = query.value(4);
        const QVariant eco2     = query.value(5);
        const QVariant tvoc     = query.value(6);
        const QVariant detected = query.value(7);

        auto setCell = [&](int col, const QString &text, bool numeric = false) {
            auto *item = new QTableWidgetItem(text);
            item->setTextAlignment(numeric ? (Qt::AlignRight | Qt::AlignVCenter)
                                           : (Qt::AlignLeft  | Qt::AlignVCenter));
            m_table->setItem(row, col, item);
        };

        // Les valeurs absentes (NULL) sont affichées avec un tiret.
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

    const QString totalText = (totalRows >= 0) ? tr("total : %1").arg(totalRows)
                                               : tr("total : ?");
    m_statusLabel->setText(tr("%1 ligne(s) chargée(s) — filtre : %2 — limite : %3 — %4")
                           .arg(row)
                           .arg(m_filterCombo->currentText())
                           .arg(m_rowLimit)
                           .arg(totalText));
}
