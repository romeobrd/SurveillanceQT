#include "smokesensorwidget.h"

#include <QHBoxLayout>
#include <QLabel>
#include <QPainter>
#include <QPushButton>
#include <QVBoxLayout>

namespace {

QPushButton *createToolButton(const QString &text, QWidget *parent)
{
    auto *button = new QPushButton(text, parent);
    button->setFixedSize(28, 28);
    button->setStyleSheet(
        "QPushButton {"
        "  color: #eef3ff;"
        "  background: rgba(117, 140, 188, 0.18);"
        "  border: 1px solid rgba(169, 191, 235, 0.12);"
        "  border-radius: 6px;"
        "  font-size: 15px;"
        "  font-weight: 700;"
        "}"
        "QPushButton:hover { background: rgba(130, 154, 208, 0.28); }"
        );
    return button;
}

// Historique des détections : barre rouge quand de la fumée a été
// détectée, petite barre verte sinon.
class SmokeChartWidget : public QWidget
{
public:
    explicit SmokeChartWidget(QWidget *parent = nullptr)
        : QWidget(parent)
    {
        setMinimumHeight(100);
    }

    void setValues(const QVector<int> &values)
    {
        m_values = values;
        update();   // demande un redessin
    }

protected:
    void paintEvent(QPaintEvent *) override
    {
        QPainter p(this);
        p.setRenderHint(QPainter::Antialiasing, true);

        const QRectF plotRect = rect().adjusted(38, 10, -10, -30);

        // Fond en dégradé : vert apaisant en bas, rouge alerte en haut
        QLinearGradient zoneGradient(plotRect.topLeft(), plotRect.bottomLeft());
        zoneGradient.setColorAt(0.0, QColor(133, 28, 52, 55));
        zoneGradient.setColorAt(0.5, QColor(171, 80, 44, 55));
        zoneGradient.setColorAt(1.0, QColor(111, 146, 78, 55));
        p.fillRect(plotRect, zoneGradient);

        // Ligne médiane (séparation "sain" / "fumée")
        p.setPen(QPen(QColor(197, 208, 231, 80), 1, Qt::DashLine));
        const qreal midY = plotRect.center().y();
        p.drawLine(QPointF(plotRect.left(), midY), QPointF(plotRect.right(), midY));

        if (m_values.isEmpty()) {
            p.setPen(QColor(226, 234, 250, 160));
            p.setFont(QFont(QStringLiteral("Segoe UI"), 9));
            p.drawText(plotRect, Qt::AlignCenter,
                       QStringLiteral("En attente de mesures..."));
            return;
        }

        // Une barre par mesure : 0 (pas de fumée) ou 1 (fumée détectée)
        const int   n    = m_values.size();
        const qreal barW = plotRect.width() / qMax(1, n);

        for (int i = 0; i < n; ++i) {
            const bool  detected = (m_values[i] >= 1);
            const qreal x = plotRect.left() + i * barW;
            const qreal h = detected ? plotRect.height() : plotRect.height() * 0.12;
            const qreal y = plotRect.bottom() - h;

            const QColor barColor = detected ? QColor(255, 90, 71, 220)
                                             : QColor(46, 213, 115, 160);
            p.setBrush(barColor);
            p.setPen(Qt::NoPen);
            p.drawRoundedRect(QRectF(x + barW * 0.15, y, barW * 0.7, h), 2, 2);
        }

        // Légendes de l'axe vertical
        p.setPen(QColor(226, 234, 250));
        p.setFont(QFont(QStringLiteral("Segoe UI"), 8));
        p.drawText(QRectF(2, plotRect.top() - 8, 34, 16),
                   Qt::AlignRight | Qt::AlignVCenter,
                   QStringLiteral("Fumée"));
        p.drawText(QRectF(2, plotRect.bottom() - 8, 34, 16),
                   Qt::AlignRight | Qt::AlignVCenter,
                   QStringLiteral("Sain"));

        // Légende de l'axe horizontal
        p.drawText(QRectF(plotRect.left(), plotRect.bottom() + 5,
                          plotRect.width(), 20),
                   Qt::AlignCenter,
                   QStringLiteral("Historique des détections"));
    }

private:
    QVector<int> m_values;
};

} // namespace

// =====================================================================
//  CONSTRUCTION DE L'INTERFACE
// =====================================================================
SmokeSensorWidget::SmokeSensorWidget(QWidget *parent)
    : QFrame(parent)
    , m_editButton(nullptr)
    , m_closeButton(nullptr)
    , m_titleLabel(nullptr)
    , m_iconLabel(nullptr)
    , m_stateLabel(nullptr)
    , m_detailLabel(nullptr)
    , m_ppmLabel(nullptr)
    , m_chartWidget(nullptr)
    , m_smokeDetected(false)
    , m_detectionCount(0)
    , m_severity(Normal)
    , m_alarmThreshold(60)
{
    setObjectName(QStringLiteral("panelSmoke"));
    setStyleSheet(
        "QFrame#panelSmoke {"
        "  background: rgba(31, 49, 92, 0.88);"
        "  border: 1px solid rgba(142, 165, 215, 0.12);"
        "  border-radius: 16px;"
        "}"
        "QLabel { color: #eff4ff; }"
        "QLabel#title { font-size: 20px; font-weight: 700; }"
        "QLabel#subtitle { font-size: 13px; color: #d6e1ff; }"
        "QLabel#icon { font-size: 56px; }"
        "QLabel#state { font-size: 22px; font-weight: 700; }"
        "QLabel#detail { font-size: 12px; color: #c4d1ee; }"
        );

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(16, 12, 16, 14);
    mainLayout->setSpacing(8);

    // --- En-tête : titre + boutons éditer / fermer ---
    auto *headerLayout = new QHBoxLayout;
    headerLayout->setContentsMargins(0, 0, 0, 0);
    headerLayout->setSpacing(8);

    m_titleLabel = new QLabel(QStringLiteral("Détecteur de Fumée"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));

    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();

    m_editButton  = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);

    auto *subTitle = new QLabel(QStringLiteral("Capteur Flying-Fish — sortie numérique"), this);
    subTitle->setObjectName(QStringLiteral("subtitle"));

    // --- Zone d'état : icône + texte ("AIR SAIN" / "FUMÉE DÉTECTÉE") ---
    auto *statusLayout = new QHBoxLayout;
    statusLayout->setSpacing(14);

    m_iconLabel = new QLabel(this);
    m_iconLabel->setObjectName(QStringLiteral("icon"));
    m_iconLabel->setAlignment(Qt::AlignCenter);
    m_iconLabel->setMinimumWidth(72);

    auto *textCol = new QVBoxLayout;
    textCol->setSpacing(2);
    m_stateLabel = new QLabel(this);
    m_stateLabel->setObjectName(QStringLiteral("state"));
    m_stateLabel->setAlignment(Qt::AlignLeft | Qt::AlignVCenter);

    m_detailLabel = new QLabel(this);
    m_detailLabel->setObjectName(QStringLiteral("detail"));
    m_detailLabel->setAlignment(Qt::AlignLeft | Qt::AlignVCenter);

    textCol->addStretch();
    textCol->addWidget(m_stateLabel);
    textCol->addWidget(m_detailLabel);
    textCol->addStretch();

    statusLayout->addStretch();
    statusLayout->addWidget(m_iconLabel);
    statusLayout->addLayout(textCol);
    statusLayout->addStretch();

    // --- Graphique d'historique ---
    auto *chart = new SmokeChartWidget(this);
    m_chartWidget = chart;
    chart->setMinimumHeight(120);

    // --- Affichage eCO2 / TVOC ---
    m_ppmLabel = new QLabel(QStringLiteral("eCO₂: -- ppm    TVOC: -- ppb"), this);
    m_ppmLabel->setStyleSheet(
        "QLabel {"
        "  color: #ffd166;"
        "  font-size: 14px;"
        "  font-weight: 600;"
        "  padding: 4px 0;"
        "}"
    );
    m_ppmLabel->setAlignment(Qt::AlignCenter);

    mainLayout->addLayout(headerLayout);
    mainLayout->addWidget(subTitle);
    mainLayout->addLayout(statusLayout);
    mainLayout->addWidget(m_ppmLabel);
    mainLayout->addWidget(chart, 1);

    // Historique initial : 30 mesures "pas de fumée"
    for (int i = 0; i < 30; ++i)
        m_historyValues.append(0);
    updateChart();

    refreshUi();
}

// =====================================================================
//  ACCESSEURS
// =====================================================================
QPushButton *SmokeSensorWidget::editButton() const
{
    return m_editButton;
}

QPushButton *SmokeSensorWidget::closeButton() const
{
    return m_closeButton;
}

QString SmokeSensorWidget::currentSummary() const
{
    return m_smokeDetected
            ? QStringLiteral("Fumée: DÉTECTÉE")
            : QStringLiteral("Fumée: aucune");
}

SmokeSensorWidget::Severity SmokeSensorWidget::severity() const
{
    return m_severity;
}

void SmokeSensorWidget::setTitle(const QString &title)
{
    if (m_titleLabel)
        m_titleLabel->setText(title);
}

// =====================================================================
//  MISE À JOUR DEPUIS LES DONNÉES MQTT
// =====================================================================
void SmokeSensorWidget::updateFromGasData(int eco2Ppm, int tvocPpb, bool detected)
{
    // Données complètes du capteur de gaz : on affiche les mesures
    // eCO2/TVOC puis on traite la détection binaire.
    if (m_ppmLabel) {
        m_ppmLabel->setText(QStringLiteral("eCO₂: %1 ppm    TVOC: %2 ppb")
                                .arg(eco2Ppm).arg(tvocPpb));
    }

    updateFromMqttDetection(detected);
}

void SmokeSensorWidget::updateFromMqtt(int smokeLevel)
{
    // Niveau numérique (ppm) : converti en détection binaire en le
    // comparant au seuil d'alarme.
    updateFromMqttDetection(smokeLevel >= m_alarmThreshold);
}

void SmokeSensorWidget::updateFromMqttDetection(bool detected)
{
    m_smokeDetected = detected;
    if (detected)
        ++m_detectionCount;

    // On garde les 30 dernières mesures pour le graphique.
    m_historyValues.append(detected ? 1 : 0);
    if (m_historyValues.size() > 30)
        m_historyValues.removeFirst();

    updateChart();
    refreshUi();
}

// =====================================================================
//  RAFRAÎCHISSEMENT DE L'AFFICHAGE
// =====================================================================
void SmokeSensorWidget::updateChart()
{
    if (m_chartWidget)
        static_cast<SmokeChartWidget *>(m_chartWidget)->setValues(m_historyValues);
}

void SmokeSensorWidget::refreshUi()
{
    QString iconText;
    QString stateText;
    QString stateStyle;
    QString detailText;

    if (m_smokeDetected) {
        m_severity = Alarm;
        iconText   = QStringLiteral("Détection de fumée");
        stateText  = QStringLiteral("FUMÉE DÉTECTÉE");
        stateStyle = "QLabel#state { color: #ff4757; }";
        detailText = QStringLiteral("Alerte ! %1 détection(s) au total")
                       .arg(m_detectionCount);
    } else {
        m_severity = Normal;
        iconText   = QStringLiteral("normal");
        stateText  = QStringLiteral("AIR SAIN");
        stateStyle = "QLabel#state { color: #2ed573; }";
        detailText = (m_detectionCount == 0)
                ? QStringLiteral("Aucune détection")
                : QStringLiteral("Dernier état : OK   |   %1 détection(s) historique(s)")
                    .arg(m_detectionCount);
    }

    if (m_iconLabel)
        m_iconLabel->setText(iconText);
    if (m_stateLabel) {
        m_stateLabel->setText(stateText);
        m_stateLabel->setStyleSheet(stateStyle);
    }
    if (m_detailLabel)
        m_detailLabel->setText(detailText);
}
