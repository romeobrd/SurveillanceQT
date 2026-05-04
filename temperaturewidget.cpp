#include "temperaturewidget.h"

#include <QHBoxLayout>
#include <QLabel>
#include <QPainter>
#include <QPainterPath>
#include <QPushButton>
#include <QRandomGenerator>
#include <QStringList>
#include <QTimer>
#include <QVBoxLayout>

#include <algorithm>

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

class TemperatureChartWidget : public QWidget
{
public:
    explicit TemperatureChartWidget(QWidget *parent = nullptr)
        : QWidget(parent)
        , m_axisFont(QStringLiteral("Sans Serif"), 9, QFont::Medium)
    {
        setMinimumHeight(80);
        setAttribute(Qt::WA_OpaquePaintEvent);  // Avoid bg clear on every paint
    }

    void setValues(const QVector<double> &values)
    {
        m_values = values;
        update();
    }

protected:
    void resizeEvent(QResizeEvent *event) override
    {
        QWidget::resizeEvent(event);
        update();  // Forcer le redessin quand on redimensionne
    }
    void paintEvent(QPaintEvent *) override
    {
        const QVector<double> values = m_values.isEmpty()
        ? QVector<double>{ 31, 32, 36, 37, 35, 34, 33, 36, 38, 37, 39, 41 }
        : m_values;

        QPainter p(this);
        p.setRenderHint(QPainter::Antialiasing, true);

        const QRectF plotRect = rect().adjusted(38, 18, -20, -34);

        // Fill background to avoid transparency compositing overhead
        p.fillRect(rect(), QColor(31, 49, 92));

        QLinearGradient zoneGradient(plotRect.topLeft(), plotRect.bottomLeft());
        zoneGradient.setColorAt(0.0, QColor(195, 107, 29, 50));
        zoneGradient.setColorAt(0.45, QColor(171, 102, 42, 65));
        zoneGradient.setColorAt(1.0, QColor(82, 112, 165, 35));
        p.fillRect(plotRect, zoneGradient);

        p.setPen(QPen(QColor(197, 208, 231, 50), 1, Qt::DashLine));
        for (int i = 0; i < 4; ++i) {
            const qreal y = plotRect.top() + i * plotRect.height() / 3.0;
            p.drawLine(QPointF(plotRect.left(), y), QPointF(plotRect.right(), y));
        }

        p.setPen(QPen(QColor(255, 130, 64, 3), 3));
        const qreal thresholdY = plotRect.bottom() - ((58.0 - 20.0) / 45.0) * plotRect.height();
        p.drawLine(QPointF(plotRect.left(), thresholdY), QPointF(plotRect.right(), thresholdY));

        const int vSize = values.size();
        const qreal plotW = plotRect.width();
        const qreal plotH = plotRect.height();
        const qreal plotL = plotRect.left();
        const qreal plotB = plotRect.bottom();
        const int denom = qMax(1, vSize - 1);

        QVector<QPointF> points;
        points.reserve(vSize);
        for (int i = 0; i < vSize; ++i) {
            const qreal x = plotL + (plotW * i) / denom;
            const qreal y = plotB - ((values[i] - 20.0) / 45.0) * plotH;
            points.push_back(QPointF(x, y));
        }

        if (!points.isEmpty()) {
            QPainterPath path;
            path.moveTo(points.front());
            for (int i = 1; i < points.size(); ++i) {
                path.lineTo(points[i]);
            }

            p.setPen(QPen(QColor(255, 164, 74, 55), 10, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin));
            p.drawPath(path);
            p.setPen(QPen(QColor(255, 164, 74), 4, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin));
            p.drawPath(path);
        }

        p.setPen(QColor(226, 234, 250));
        p.setFont(m_axisFont);

        static const int yValues[] = { 20, 30, 45, 60 };
        for (int value : yValues) {
            const qreal y = plotB - ((value - 20.0) / 45.0) * plotH;
            p.drawText(QRectF(4, y - 10, 30, 20),
                       Qt::AlignRight | Qt::AlignVCenter,
                       QString::number(value));
        }

        static const QString xLabels[] = {
            QStringLiteral("16:40"), QStringLiteral("16:25"),
            QStringLiteral("16:30"), QStringLiteral("16:35"),
            QStringLiteral("16:50"), QStringLiteral("16:55")
        };
        const int xLabelCount = 6;
        const int xDenom = qMax(1, xLabelCount - 1);
        for (int i = 0; i < xLabelCount; ++i) {
            const qreal x = plotL + i * plotW / xDenom;
            p.drawText(QRectF(x - 22, plotRect.bottom() + 8, 48, 18),
                       Qt::AlignHCenter | Qt::AlignTop,
                       xLabels[i]);
        }

        p.setPen(QPen(QColor(220, 229, 250, 75), 1));
        p.drawLine(QPointF(plotRect.left(), plotRect.bottom()), QPointF(plotRect.right(), plotRect.bottom()));
        p.drawLine(QPointF(plotRect.right(), plotRect.top()), QPointF(plotRect.right(), plotRect.bottom()));
        p.drawLine(QPointF(plotRect.right() - 6, plotRect.bottom() - 4), QPointF(plotRect.right(), plotRect.bottom()));
        p.drawLine(QPointF(plotRect.right() - 6, plotRect.bottom() + 4), QPointF(plotRect.right(), plotRect.bottom()));
    }

private:
    QVector<double> m_values;
    QFont m_axisFont;
};

} // namespace

TemperatureWidget::TemperatureWidget(QWidget *parent)
    : QFrame(parent)
    , m_editButton(nullptr)
    , m_closeButton(nullptr)
    , m_stateLabel(nullptr)
    , m_liveIndicator(nullptr)
    , m_chart(nullptr)
    , m_timer(new QTimer(this))
    , m_values({
          31, 32, 36, 37, 35, 34, 33, 36, 38, 37, 39, 41,
          40, 39, 38, 37, 36, 35, 38, 41, 43, 45, 44, 42,
          40, 39, 38, 37, 36, 38, 41, 43, 46, 48, 50, 47,
          45, 44, 43, 42, 40, 39, 38, 40, 42, 45, 47, 49,
          46, 44, 43, 45, 48, 50, 47, 45, 44, 46, 49, 51
      })
    , m_currentValue(static_cast<int>(m_values.isEmpty() ? 0 : m_values.last()))
    , m_peakValue(static_cast<int>(m_values.isEmpty() ? 0 : *std::max_element(m_values.begin(), m_values.end())))
    , m_severity(Warning)
    , m_warningThreshold(35)
    , m_alarmThreshold(45)
    , m_liveMode(false)
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

    auto *headerLayout = new QHBoxLayout;
    headerLayout->setContentsMargins(0, 0, 0, 0);
    headerLayout->setSpacing(8);

    m_titleLabel = new QLabel(QStringLiteral("Historique Température"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));

    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();

    m_editButton = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);

    auto *subHeaderLayout = new QHBoxLayout;
    subHeaderLayout->setContentsMargins(0, 0, 0, 0);

    auto *subTitle = new QLabel(QStringLiteral("Température (°C)"), this);
    subTitle->setObjectName(QStringLiteral("subtitle"));

    m_stateLabel = new QLabel(this);
    m_stateLabel->setAlignment(Qt::AlignCenter);
    m_stateLabel->setFixedWidth(130);

    m_liveIndicator = new QLabel(QStringLiteral("● SIMULATION"), this);
    m_liveIndicator->setStyleSheet(
        "QLabel { color: #7ec8e3; font-size: 10px; font-weight: 700; }"
        );

    subHeaderLayout->addWidget(subTitle);
    subHeaderLayout->addWidget(m_liveIndicator);
    subHeaderLayout->addStretch();
    subHeaderLayout->addWidget(m_stateLabel);

    auto *chart = new TemperatureChartWidget(this);
    m_chart = chart;
    chart->setMinimumHeight(100);

    mainLayout->addLayout(headerLayout);
    mainLayout->addLayout(subHeaderLayout);
    mainLayout->addWidget(chart, 1);  // Le 1 fait que le chart prend tout l'espace disponible

    QObject::connect(m_timer, &QTimer::timeout, this, [this]() {
        simulateStep();
    });
    m_timer->start(1500);

    refreshUi();
}

QPushButton *TemperatureWidget::editButton() const
{
    return m_editButton;
}

QPushButton *TemperatureWidget::closeButton() const
{
    return m_closeButton;
}

QString TemperatureWidget::currentSummary() const
{
    QString stateText = QStringLiteral("Normal");
    if (m_severity == Warning)
        stateText = QStringLiteral("Avertissement");
    else if (m_severity == Alarm)
        stateText = QStringLiteral("Alerte");

    return QStringLiteral(
               "Valeur actuelle: %1 °C\n"
               "Pic détecté: %2 °C\n"
               "Seuil avertissement: %3 °C\n"
               "Seuil critique: %4 °C\n"
               "État actuel: %5")
        .arg(m_currentValue)
        .arg(m_peakValue)
        .arg(m_warningThreshold)
        .arg(m_alarmThreshold)
        .arg(stateText);
}

int TemperatureWidget::currentValue() const
{
    return m_currentValue;
}

TemperatureWidget::Severity TemperatureWidget::severity() const
{
    return m_severity;
}

void TemperatureWidget::simulateStep()
{
    int delta = QRandomGenerator::global()->bounded(-3, 5);

    if (QRandomGenerator::global()->bounded(100) < 10) {
        delta += QRandomGenerator::global()->bounded(4, 10);
    }

    m_currentValue += delta;
    m_currentValue = qBound(24, m_currentValue, 65);

    m_peakValue = qMax(m_peakValue, m_currentValue);

    m_values.push_back(m_currentValue);
    while (m_values.size() > 60) {
        m_values.removeFirst();
    }

    if (m_currentValue >= m_alarmThreshold) {
        setSeverity(Alarm);
    } else if (m_currentValue >= m_warningThreshold) {
        setSeverity(Warning);
    } else {
        setSeverity(Normal);
    }

    refreshUi();
}

void TemperatureWidget::resetSensor()
{
    m_currentValue = 32;
    m_peakValue = m_currentValue;
    m_values.fill(m_currentValue, 60);
    setSeverity(Normal);
    refreshUi();
}

void TemperatureWidget::refreshUi()
{
    if (m_chart) {
        auto *chart = static_cast<TemperatureChartWidget *>(m_chart);
        chart->setValues(m_values);
    }

    if (!m_stateLabel) {
        return;
    }

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

void TemperatureWidget::setSeverity(TemperatureWidget::Severity severity)
{
    m_severity = severity;
}

void TemperatureWidget::setTitle(const QString &title)
{
    if (m_titleLabel) {
        m_titleLabel->setText(title);
    }
}

void TemperatureWidget::setResizable(bool enabled)
{
    // Pour l'instant, cette méthode ne fait rien
    // Le redimensionnement sera implémenté différemment
    Q_UNUSED(enabled)
}

void TemperatureWidget::updateValue(double value, const QString &unit)
{
    Q_UNUSED(unit)

    if (!m_liveMode) {
        setLiveMode(true);
    }

    m_currentValue = static_cast<int>(qBound(0.0, value, 100.0));
    m_peakValue = qMax(m_peakValue, m_currentValue);

    m_values.push_back(m_currentValue);
    while (m_values.size() > 60) {
        m_values.removeFirst();
    }

    if (m_currentValue >= m_alarmThreshold) {
        setSeverity(Alarm);
    } else if (m_currentValue >= m_warningThreshold) {
        setSeverity(Warning);
    } else {
        setSeverity(Normal);
    }

    refreshUi();
}

void TemperatureWidget::setLiveMode(bool live)
{
    m_liveMode = live;
    if (m_liveMode) {
        m_timer->stop();
        if (m_liveIndicator) {
            m_liveIndicator->setText(QStringLiteral("● LIVE MQTT"));
            m_liveIndicator->setStyleSheet(
                "QLabel { color: #40d080; font-size: 10px; font-weight: 700; }"
                );
        }
    } else {
        m_timer->start(1500);
        if (m_liveIndicator) {
            m_liveIndicator->setText(QStringLiteral("● SIMULATION"));
            m_liveIndicator->setStyleSheet(
                "QLabel { color: #7ec8e3; font-size: 10px; font-weight: 700; }"
                );
        }
    }
}

bool TemperatureWidget::isLiveMode() const
{
    return m_liveMode;
}

void TemperatureWidget::setThresholds(int warning, int alarm)
{
    m_warningThreshold = warning;
    m_alarmThreshold = alarm;
}
