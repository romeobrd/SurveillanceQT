#include "temperaturewidget.h"

#include <QDebug>
#include <QHBoxLayout>
#include <QLabel>
#include <QPainter>
#include <QPainterPath>
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

// Courbe de température : échelle fixe de 20 à 65 °C, ligne de seuil
// d'alarme à 58 °C, tracé orange avec effet de halo.
class TemperatureChartWidget : public QWidget
{
public:
    explicit TemperatureChartWidget(QWidget *parent = nullptr)
        : QWidget(parent)
    {
        setMinimumHeight(80);
    }

    void setValues(const QVector<double> &values)
    {
        m_values = values;
        update();   // demande un redessin
    }

protected:
    void resizeEvent(QResizeEvent *event) override
    {
        QWidget::resizeEvent(event);
        update();   // redessiner quand le widget change de taille
    }

    void paintEvent(QPaintEvent *) override
    {
        QPainter p(this);
        p.setRenderHint(QPainter::Antialiasing, true);

        const QRectF plotRect = rect().adjusted(38, 18, -20, -34);

        // Fond en dégradé (chaud en haut, froid en bas)
        QLinearGradient zoneGradient(plotRect.topLeft(), plotRect.bottomLeft());
        zoneGradient.setColorAt(0.0, QColor(195, 107, 29, 50));
        zoneGradient.setColorAt(0.45, QColor(171, 102, 42, 65));
        zoneGradient.setColorAt(1.0, QColor(82, 112, 165, 35));
        p.fillRect(plotRect, zoneGradient);

        // Lignes horizontales de repère
        p.setPen(QPen(QColor(197, 208, 231, 50), 1, Qt::DashLine));
        for (int i = 0; i < 4; ++i) {
            const qreal y = plotRect.top() + i * plotRect.height() / 3.0;
            p.drawLine(QPointF(plotRect.left(), y), QPointF(plotRect.right(), y));
        }

        // Ligne du seuil d'alarme (58 °C)
        p.setPen(QPen(QColor(255, 130, 64, 3), 3));
        const qreal thresholdY = plotRect.bottom() - ((58.0 - 20.0) / 45.0) * plotRect.height();
        p.drawLine(QPointF(plotRect.left(), thresholdY), QPointF(plotRect.right(), thresholdY));

        // Conversion valeur -> position dans le graphique
        // (échelle : 20 °C en bas, 65 °C en haut)
        const QVector<double> &values = m_values;
        auto valueToPoint = [&](int index, double value) {
            const qreal x = plotRect.left() + (plotRect.width() * index) / qMax(1, values.size() - 1);
            const qreal y = plotRect.bottom() - ((value - 20.0) / 45.0) * plotRect.height();
            return QPointF(x, y);
        };

        QVector<QPointF> points;
        points.reserve(values.size());
        for (int i = 0; i < values.size(); ++i)
            points.push_back(valueToPoint(i, values[i]));

        // Tracé de la courbe : un trait large translucide (halo) puis le
        // trait principal par-dessus.
        if (!points.isEmpty()) {
            QPainterPath path;
            path.moveTo(points.front());
            for (int i = 1; i < points.size(); ++i)
                path.lineTo(points[i]);

            p.setPen(QPen(QColor(255, 164, 74, 55), 10, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin));
            p.drawPath(path);
            p.setPen(QPen(QColor(255, 164, 74), 4, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin));
            p.drawPath(path);
        }

        // Graduations de l'axe vertical (°C)
        p.setPen(QColor(226, 234, 250));
        p.setFont(QFont(QStringLiteral("Segoe UI"), 9, QFont::Medium));

        const QList<int> yValues { 20, 30, 45, 60 };
        for (int value : yValues) {
            const qreal y = plotRect.bottom() - ((value - 20.0) / 45.0) * plotRect.height();
            p.drawText(QRectF(4, y - 10, 30, 20),
                       Qt::AlignRight | Qt::AlignVCenter,
                       QString::number(value));
        }

        // Axes
        p.setPen(QPen(QColor(220, 229, 250, 75), 1));
        p.drawLine(QPointF(plotRect.left(), plotRect.bottom()), QPointF(plotRect.right(), plotRect.bottom()));
        p.drawLine(QPointF(plotRect.right(), plotRect.top()), QPointF(plotRect.right(), plotRect.bottom()));
        p.drawLine(QPointF(plotRect.right() - 6, plotRect.bottom() - 4), QPointF(plotRect.right(), plotRect.bottom()));
        p.drawLine(QPointF(plotRect.right() - 6, plotRect.bottom() + 4), QPointF(plotRect.right(), plotRect.bottom()));
    }

private:
    QVector<double> m_values;
};

} // namespace

// =====================================================================
//  CONSTRUCTION DE L'INTERFACE
// =====================================================================
TemperatureWidget::TemperatureWidget(QWidget *parent)
    : QFrame(parent)
    , m_editButton(nullptr)
    , m_closeButton(nullptr)
    , m_titleLabel(nullptr)
    , m_stateLabel(nullptr)
    , m_valueLabel(nullptr)
    , m_chart(nullptr)
    , m_severity(Normal)
    , m_warningThreshold(45)
    , m_alarmThreshold(58)
{
    setObjectName(QStringLiteral("panelTemperature"));
    setStyleSheet(
        "QFrame#panelTemperature {"
        "  background: rgba(31, 49, 92, 0.88);"
        "  border: 1px solid rgba(142, 165, 215, 0.12);"
        "  border-radius: 16px;"
        "}"
        "QLabel { color: #eff4ff; }"
        "QLabel#title { font-size: 20px; font-weight: 700; }"
        "QLabel#subtitle { font-size: 13px; color: #d6e1ff; }"
        );

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(16, 12, 16, 14);
    mainLayout->setSpacing(8);

    // --- En-tête : titre + boutons éditer / fermer ---
    auto *headerLayout = new QHBoxLayout;
    headerLayout->setContentsMargins(0, 0, 0, 0);
    headerLayout->setSpacing(8);

    m_titleLabel = new QLabel(QStringLiteral("Historique Température"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));

    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();

    m_editButton  = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);

    // --- Sous-en-tête : valeur courante + badge d'état ---
    auto *subHeaderLayout = new QHBoxLayout;
    subHeaderLayout->setContentsMargins(0, 0, 0, 0);

    auto *subTitle = new QLabel(QStringLiteral("Température (°C)"), this);
    subTitle->setObjectName(QStringLiteral("subtitle"));

    m_valueLabel = new QLabel(QStringLiteral("-- °C"), this);
    m_valueLabel->setStyleSheet(
        "QLabel {"
        "  color: #ffae5c;"
        "  font-size: 22px;"
        "  font-weight: 700;"
        "}"
    );

    m_stateLabel = new QLabel(this);
    m_stateLabel->setAlignment(Qt::AlignCenter);
    m_stateLabel->setFixedWidth(130);

    subHeaderLayout->addWidget(subTitle);
    subHeaderLayout->addSpacing(12);
    subHeaderLayout->addWidget(m_valueLabel);
    subHeaderLayout->addStretch();
    subHeaderLayout->addWidget(m_stateLabel);

    // --- Courbe d'historique ---
    auto *chart = new TemperatureChartWidget(this);
    m_chart = chart;
    chart->setMinimumHeight(100);

    mainLayout->addLayout(headerLayout);
    mainLayout->addLayout(subHeaderLayout);
    mainLayout->addWidget(chart, 1);   // le graphique prend l'espace restant

    refreshUi();
}

// =====================================================================
//  ACCESSEURS
// =====================================================================
QPushButton *TemperatureWidget::editButton() const
{
    return m_editButton;
}

QPushButton *TemperatureWidget::closeButton() const
{
    return m_closeButton;
}

TemperatureWidget::Severity TemperatureWidget::severity() const
{
    return m_severity;
}

void TemperatureWidget::setTitle(const QString &title)
{
    if (m_titleLabel)
        m_titleLabel->setText(title);
}

// =====================================================================
//  SEUILS D'ALARME
// =====================================================================
void TemperatureWidget::setThresholds(int warningThreshold, int alarmThreshold)
{
    m_warningThreshold = warningThreshold;
    m_alarmThreshold   = alarmThreshold;

    // Réévalue tout de suite la dernière mesure avec les nouveaux seuils :
    // l'alarme se déclenche (ou s'éteint) sans attendre la mesure suivante.
    if (!m_values.isEmpty()) {
        updateSeverity(m_values.last());
        refreshUi();
    }
}

void TemperatureWidget::updateSeverity(double temperature)
{
    // C'est ICI que la mesure est comparée aux seuils.
    if (temperature >= m_alarmThreshold)
        m_severity = Alarm;
    else if (temperature >= m_warningThreshold)
        m_severity = Warning;
    else
        m_severity = Normal;
}

// =====================================================================
//  MISE À JOUR DEPUIS LES DONNÉES MQTT
// =====================================================================
void TemperatureWidget::updateFromMqtt(double temperature, double humidity)
{
    // Historique limité aux 60 dernières mesures
    m_values.push_back(temperature);
    while (m_values.size() > 60)
        m_values.removeFirst();

    // État selon les seuils d'avertissement et d'alarme
    updateSeverity(temperature);

    // Valeur affichée avec une décimale
    if (m_valueLabel)
        m_valueLabel->setText(QString::number(temperature, 'f', 1) + QStringLiteral(" °C"));

    refreshUi();
    qDebug() << "TemperatureWidget: mise à jour MQTT" << temperature << humidity;
}

// =====================================================================
//  RAFRAÎCHISSEMENT DE L'AFFICHAGE
// =====================================================================
void TemperatureWidget::refreshUi()
{
    if (m_chart)
        static_cast<TemperatureChartWidget *>(m_chart)->setValues(m_values);

    if (!m_stateLabel)
        return;

    QString text;
    QString background;

    switch (m_severity) {
    case Normal:
        text = QStringLiteral("Normal");
        background = QStringLiteral("#55b56a");
        break;
    case Warning:
        text = QStringLiteral("Avertissement");
        background = QStringLiteral("#ff9c3d");
        break;
    case Alarm:
        text = QStringLiteral("Alerte");
        background = QStringLiteral("#ff5a67");
        break;
    }

    m_stateLabel->setText(text);
    m_stateLabel->setStyleSheet(QString(
                                    "QLabel {"
                                    "  background: %1;"
                                    "  color: white;"
                                    "  border-radius: 4px;"
                                    "  padding: 8px 16px;"
                                    "  font-size: 14px;"
                                    "  font-weight: 700;"
                                    "}"
                                    ).arg(background));
}
