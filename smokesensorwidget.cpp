#include "smokesensorwidget.h"

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

class SmokeChartWidget : public QWidget
{
public:
    explicit SmokeChartWidget(QWidget *parent = nullptr)
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
        ? QVector<double>{ 20, 24, 18, 21, 27, 33, 29, 41, 36, 48, 31, 26 }
        : m_values;

        QPainter p(this);
        p.setRenderHint(QPainter::Antialiasing, true);

        const QRectF plotRect = rect().adjusted(38, 18, -20, -34);

        // Fill background to avoid transparency compositing overhead
        p.fillRect(rect(), QColor(31, 49, 92));

        QLinearGradient zoneGradient(plotRect.topLeft(), plotRect.bottomLeft());
        zoneGradient.setColorAt(0.0, QColor(133, 28, 52, 55));
        zoneGradient.setColorAt(0.42, QColor(171, 80, 44, 70));
        zoneGradient.setColorAt(1.0, QColor(111, 146, 78, 55));
        p.fillRect(plotRect, zoneGradient);

        p.setPen(QPen(QColor(197, 208, 231, 50), 1, Qt::DashLine));
        for (int i = 0; i < 5; ++i) {
            const qreal y = plotRect.top() + i * plotRect.height() / 4.0;
            p.drawLine(QPointF(plotRect.left(), y), QPointF(plotRect.right(), y));
        }

        p.setPen(QPen(QColor(246, 66, 86), 3));
        const qreal thresholdY = plotRect.bottom() - (60.0 / 80.0) * plotRect.height();
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
            const qreal y = plotB - (values[i] / 80.0) * plotH;
            points.push_back(QPointF(x, y));
        }

        if (!points.isEmpty()) {
            QPainterPath glowPath;
            glowPath.moveTo(points.front());
            for (int i = 1; i < points.size(); ++i) {
                glowPath.lineTo(points[i]);
            }

            p.setPen(QPen(QColor(255, 204, 82, 55), 10, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin));
            p.drawPath(glowPath);

            for (int i = 1; i < points.size(); ++i) {
                const QColor segmentColor =
                    (values[i] >= 28.0 || values[i - 1] >= 28.0)
                        ? QColor(255, 90, 71)
                        : QColor(255, 196, 72);

                p.setPen(QPen(segmentColor, 4, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin));
                p.drawLine(points[i - 1], points[i]);
            }
        }

        p.setPen(QColor(226, 234, 250));
        p.setFont(m_axisFont);

        static const int yValues[] = { 0, 20, 40, 60, 80 };
        for (int value : yValues) {
            const qreal y = plotB - (value / 80.0) * plotH;
            p.drawText(QRectF(2, y - 10, 28, 20),
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

SmokeSensorWidget::SmokeSensorWidget(QWidget *parent)
    : QFrame(parent)
    , m_editButton(nullptr)
    , m_closeButton(nullptr)
    , m_stateLabel(nullptr)
    , m_liveIndicator(nullptr)
    , m_chart(nullptr)
    , m_timer(new QTimer(this))
    , m_values({
          34, 36, 22, 18, 17, 14, 17, 20, 23, 19, 18, 24,
          28, 22, 18, 19, 16, 31, 27, 35, 42, 47, 44, 39,
          40, 43, 52, 61, 63, 56, 42, 36, 31, 39, 49, 43,
          34, 30, 27, 23, 22, 24, 29, 18, 14, 15, 18, 17,
          16, 19, 22, 17, 21, 31, 28, 22, 24, 27, 28
      })
    , m_currentValue(static_cast<int>(m_values.isEmpty() ? 0 : m_values.last()))
    , m_peakValue(static_cast<int>(m_values.isEmpty() ? 0 : *std::max_element(m_values.begin(), m_values.end())))
    , m_severity(Warning)
    , m_warningThreshold(300)
    , m_alarmThreshold(500)
    , m_liveMode(false)
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
        );

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(16, 12, 16, 14);
    mainLayout->setSpacing(8);

    auto *headerLayout = new QHBoxLayout;
    headerLayout->setContentsMargins(0, 0, 0, 0);
    headerLayout->setSpacing(8);

    m_titleLabel = new QLabel(QStringLiteral("Niveau de Fumée"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));

    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();

    m_editButton = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);

    auto *subHeaderLayout = new QHBoxLayout;
    subHeaderLayout->setContentsMargins(0, 0, 0, 0);

    auto *subTitle = new QLabel(QStringLiteral("Concentration de Fumée (%)"), this);
    subTitle->setObjectName(QStringLiteral("subtitle"));

    m_stateLabel = new QLabel(this);
    m_stateLabel->setObjectName(QStringLiteral("state"));
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

    auto *chart = new SmokeChartWidget(this);
    m_chart = chart;
    chart->setMinimumHeight(100);

    mainLayout->addLayout(headerLayout);
    mainLayout->addLayout(subHeaderLayout);
    mainLayout->addWidget(chart, 1);  // Le 1 fait que le chart prend tout l'espace disponible

    QObject::connect(m_timer, &QTimer::timeout, this, [this]() {
        simulateStep();
    });
    m_timer->start(1300);

    refreshUi();
}

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
    QString stateText = QStringLiteral("Normal");
    if (m_severity == Warning)
        stateText = QStringLiteral("Avertissement");
    else if (m_severity == Alarm)
        stateText = QStringLiteral("Alerte");

    return QStringLiteral(
               "Valeur actuelle: %1 %%\n"
               "Pic détecté: %2 %%\n"
               "Seuil avertissement: %3 %%\n"
               "Seuil critique: %4 %%\n"
               "État actuel: %5")
        .arg(m_currentValue)
        .arg(m_peakValue)
        .arg(m_warningThreshold)
        .arg(m_alarmThreshold)
        .arg(stateText);
}

int SmokeSensorWidget::currentValue() const
{
    return m_currentValue;
}

SmokeSensorWidget::Severity SmokeSensorWidget::severity() const
{
    return m_severity;
}

void SmokeSensorWidget::simulateStep()
{
    int delta = QRandomGenerator::global()->bounded(-7, 10);

    if (QRandomGenerator::global()->bounded(100) < 12) {
        delta += QRandomGenerator::global()->bounded(10, 24);
    }

    m_currentValue += delta;
    m_currentValue = qBound(5, m_currentValue, 80);

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

void SmokeSensorWidget::resetSensor()
{
    m_currentValue = 12;
    m_peakValue = m_currentValue;
    m_values.fill(m_currentValue, 60);
    setSeverity(Normal);
    refreshUi();
}

void SmokeSensorWidget::refreshUi()
{
    if (m_chart) {
        auto *chart = static_cast<SmokeChartWidget *>(m_chart);
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

void SmokeSensorWidget::setSeverity(SmokeSensorWidget::Severity severity)
{
    m_severity = severity;
}

void SmokeSensorWidget::setTitle(const QString &title)
{
    if (m_titleLabel) {
        m_titleLabel->setText(title);
    }
}

void SmokeSensorWidget::setResizable(bool enabled)
{
    // Pour l'instant, cette méthode ne fait rien
    // Le redimensionnement sera implémenté différemment
    Q_UNUSED(enabled)
}

void SmokeSensorWidget::updateValue(double value, const QString &unit)
{
    Q_UNUSED(unit)

    if (!m_liveMode) {
        setLiveMode(true);
    }

    m_currentValue = static_cast<int>(qBound(0.0, value, 1000.0));
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

void SmokeSensorWidget::setLiveMode(bool live)
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
        m_timer->start(1300);
        if (m_liveIndicator) {
            m_liveIndicator->setText(QStringLiteral("● SIMULATION"));
            m_liveIndicator->setStyleSheet(
                "QLabel { color: #7ec8e3; font-size: 10px; font-weight: 700; }"
                );
        }
    }
}

bool SmokeSensorWidget::isLiveMode() const
{
    return m_liveMode;
}

void SmokeSensorWidget::setThresholds(int warning, int alarm)
{
    m_warningThreshold = warning;
    m_alarmThreshold = alarm;
}
