#include "dashboardwindow.h"

#include "camerawidget.h"
#include "loginwidget.h"
#include "smokesensorwidget.h"
#include "temperaturewidget.h"

#include <QDialog>
#include <QFileDialog>
#include <QFrame>
#include <QGridLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QMessageBox>
#include <QMouseEvent>
#include <QPixmap>
#include <QPushButton>
#include <QTimer>
#include <QVBoxLayout>

namespace {

QPushButton *createWindowButton(const QString &text, QWidget *parent, bool danger = false)
{
    auto *button = new QPushButton(text, parent);
    button->setFixedSize(28, 28);
    const QString normalBg = danger ? QStringLiteral("rgba(255, 97, 97, 0.18)")
                                    : QStringLiteral("transparent");
    const QString hoverBg = danger ? QStringLiteral("rgba(255, 97, 97, 0.35)")
                                   : QStringLiteral("rgba(116, 144, 204, 0.18)");
    button->setStyleSheet(QString(
                              "QPushButton {"
                              "  color: #f4f8ff;"
                              "  font-size: 22px;"
                              "  font-weight: 500;"
                              "  border: none;"
                              "  border-radius: 6px;"
                              "  background: %1;"
                              "}"
                              "QPushButton:hover { background: %2; }"
                              ).arg(normalBg, hoverBg));
    return button;
}

QLabel *createStatusBubble(const QString &text, const QString &color)
{
    auto *label = new QLabel(text);
    label->setStyleSheet(QString(
                             "QLabel {"
                             "  color: white;"
                             "  background: %1;"
                             "  border-radius: 10px;"
                             "  padding: 6px 12px;"
                             "  font-size: 15px;"
                             "  font-weight: 700;"
                             "}"
                             ).arg(color));
    return label;
}

} // namespace

DashboardWindow::DashboardWindow(QWidget *parent)
    : QWidget(parent)
    , m_loginWidget(new LoginWidget(this))
    , m_smokeWidget(new SmokeSensorWidget(this))
    , m_temperatureWidget(new TemperatureWidget(this))
    , m_cameraWidget(new CameraWidget(this))
    , m_radiationPanel(nullptr)
    , m_userStatusLabel(new QLabel(QStringLiteral("admin"), this))
    , m_activeValueLabel(nullptr)
    , m_alarmValueLabel(nullptr)
    , m_warningValueLabel(nullptr)
    , m_defaultValueLabel(nullptr)
    , m_statusTimer(new QTimer(this))
    , m_dragging(false)
{
    setWindowFlags(Qt::FramelessWindowHint | Qt::Window);
    resize(1420, 900);

    setStyleSheet(
        "DashboardWindow, QWidget {"
        "  font-family: 'Segoe UI', 'Arial';"
        "}"
        "QWidget#chrome {"
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #2952a3, stop:0.4 #254a97, stop:1 #3467be);"
        "}"
        "QWidget#rootPanel {"
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #14366d, stop:0.4 #17396c, stop:1 #1b4177);"
        "  border: 1px solid rgba(170, 195, 245, 0.18);"
        "  border-radius: 18px;"
        "}"
        "QWidget#bodyArea {"
        "  background: rgba(16, 29, 59, 0.32);"
        "}"
        "QWidget#titleBar {"
        "  background: rgba(7, 18, 41, 0.32);"
        "  border-top-left-radius: 18px;"
        "  border-top-right-radius: 18px;"
        "}"
        "QFrame#bottomBar {"
        "  background: rgba(12, 25, 50, 0.28);"
        "  border-top: 1px solid rgba(173, 191, 233, 0.12);"
        "  border-bottom-left-radius: 18px;"
        "  border-bottom-right-radius: 18px;"
        "}"
        "QLabel#mainTitle {"
        "  color: #eef4ff;"
        "  font-size: 23px;"
        "  font-weight: 800;"
        "}"
        "QLabel { color: #edf4ff; }"
        "QFrame#statusPanel {"
        "  background: rgba(31, 49, 92, 0.88);"
        "  border: 1px solid rgba(142, 165, 215, 0.12);"
        "  border-radius: 16px;"
        "}"
        );

    auto *chromeLayout = new QVBoxLayout(this);
    chromeLayout->setContentsMargins(24, 24, 24, 24);
    chromeLayout->setSpacing(0);

    auto *chrome = new QWidget(this);
    chrome->setObjectName(QStringLiteral("chrome"));
    auto *chromeInner = new QVBoxLayout(chrome);
    chromeInner->setContentsMargins(28, 20, 28, 26);
    chromeInner->setSpacing(0);

    auto *rootPanel = new QWidget(chrome);
    rootPanel->setObjectName(QStringLiteral("rootPanel"));
    auto *rootLayout = new QVBoxLayout(rootPanel);
    rootLayout->setContentsMargins(0, 0, 0, 0);
    rootLayout->setSpacing(0);

    rootLayout->addWidget(createTitleBar());

    auto *bodyArea = new QWidget(rootPanel);
    bodyArea->setObjectName(QStringLiteral("bodyArea"));
    auto *bodyLayout = new QVBoxLayout(bodyArea);
    bodyLayout->setContentsMargins(24, 18, 24, 10);
    bodyLayout->setSpacing(14);

    auto *contentLayout = new QHBoxLayout;
    contentLayout->setContentsMargins(0, 0, 0, 0);
    contentLayout->setSpacing(18);

    contentLayout->addWidget(m_loginWidget, 0, Qt::AlignTop);

    auto *rightColumn = new QWidget(bodyArea);
    auto *grid = new QGridLayout(rightColumn);
    grid->setContentsMargins(0, 0, 0, 0);
    grid->setHorizontalSpacing(18);
    grid->setVerticalSpacing(18);

    m_radiationPanel = createRadiationPanel();

    grid->addWidget(m_smokeWidget, 0, 0, 1, 7);
    grid->addWidget(m_cameraWidget, 0, 7, 1, 6);
    grid->addWidget(m_temperatureWidget, 1, 0, 1, 7);
    grid->addWidget(m_radiationPanel, 1, 7, 1, 6);
    grid->setColumnStretch(0, 1);
    grid->setColumnStretch(7, 1);
    grid->setRowStretch(0, 1);
    grid->setRowStretch(1, 1);

    contentLayout->addWidget(rightColumn, 1);
    bodyLayout->addLayout(contentLayout, 1);

    rootLayout->addWidget(bodyArea, 1);
    rootLayout->addWidget(createBottomBar());

    chromeInner->addWidget(rootPanel, 1);
    chromeLayout->addWidget(chrome, 1);

    connect(m_loginWidget->loginButton(), &QPushButton::clicked, this, [this]() {
        handleLogin();
    });

    connect(m_smokeWidget->editButton(), &QPushButton::clicked, this, [this]() {
        QMessageBox::information(this, QStringLiteral("Capteur Fumée"), m_smokeWidget->currentSummary());
    });
    connect(m_smokeWidget->closeButton(), &QPushButton::clicked, this, [this]() {
        m_smokeWidget->hide();
        updateBottomStatus();
    });

    connect(m_temperatureWidget->editButton(), &QPushButton::clicked, this, [this]() {
        QMessageBox::information(this, QStringLiteral("Température"), m_temperatureWidget->currentSummary());
    });
    connect(m_temperatureWidget->closeButton(), &QPushButton::clicked, this, [this]() {
        m_temperatureWidget->hide();
        updateBottomStatus();
    });

    connect(m_cameraWidget->editButton(), &QPushButton::clicked, this, [this]() {
        QMessageBox::information(this, QStringLiteral("Caméra"), QStringLiteral("Paramètres caméra bientôt disponibles."));
    });
    connect(m_cameraWidget->closeButton(), &QPushButton::clicked, this, [this]() {
        m_cameraWidget->hide();
        updateBottomStatus();
    });
    connect(m_cameraWidget->reloadButton(), &QPushButton::clicked, this, [this]() {
        if (!m_cameraWidget->reloadFrame()) {
            QMessageBox::warning(this, QStringLiteral("Caméra"), QStringLiteral("Impossible de recharger l'image."));
        }
    });
    connect(m_cameraWidget->snapshotButton(), &QPushButton::clicked, this, [this]() {
        const QPixmap frame = m_cameraWidget->currentFrame();
        if (frame.isNull()) {
            QMessageBox::warning(this, QStringLiteral("Caméra"), QStringLiteral("Aucune image à capturer."));
            return;
        }

        const QString fileName = QFileDialog::getSaveFileName(
            this,
            QStringLiteral("Enregistrer une capture"),
            QStringLiteral("capture_camera.png"),
            QStringLiteral("Images (*.png *.jpg *.jpeg)"));

        if (fileName.isEmpty()) {
            return;
        }

        if (!frame.save(fileName)) {
            QMessageBox::warning(this, QStringLiteral("Caméra"), QStringLiteral("Échec de l'enregistrement."));
        }
    });
    connect(m_cameraWidget->fullscreenButton(), &QPushButton::clicked, this, [this]() {
        showCameraFullscreen();
    });

    connect(m_statusTimer, &QTimer::timeout, this, [this]() {
        updateBottomStatus();
    });
    m_statusTimer->start(1200);

    updateBottomStatus();
}

QWidget *DashboardWindow::createTitleBar()
{
    auto *titleBar = new QWidget(this);
    titleBar->setObjectName(QStringLiteral("titleBar"));
    titleBar->setFixedHeight(54);

    auto *layout = new QHBoxLayout(titleBar);
    layout->setContentsMargins(18, 0, 14, 0);
    layout->setSpacing(12);

    auto *backButton = new QPushButton(QStringLiteral("✦"), titleBar);
    backButton->setFixedSize(44, 32);
    backButton->setStyleSheet(
        "QPushButton {"
        "  background: rgba(221, 233, 255, 0.72);"
        "  color: #2f4f88;"
        "  border-radius: 16px;"
        "  border: 1px solid rgba(255,255,255,0.24);"
        "  font-size: 16px;"
        "  font-weight: 900;"
        "}"
        );

    auto *title = new QLabel(QStringLiteral("Système de Surveillance"), titleBar);
    title->setObjectName(QStringLiteral("mainTitle"));
    title->setAlignment(Qt::AlignCenter);

    auto *minButton = createWindowButton(QStringLiteral("−"), titleBar);
    auto *maxButton = createWindowButton(QStringLiteral("□"), titleBar);
    auto *closeButton = createWindowButton(QStringLiteral("×"), titleBar, true);

    connect(backButton, &QPushButton::clicked, this, [this]() {
        if (m_smokeWidget) m_smokeWidget->show();
        if (m_cameraWidget) m_cameraWidget->show();
        if (m_temperatureWidget) m_temperatureWidget->show();
        if (m_radiationPanel) m_radiationPanel->show();
        updateBottomStatus();
    });

    connect(minButton, &QPushButton::clicked, this, &QWidget::showMinimized);
    connect(maxButton, &QPushButton::clicked, this, [this]() {
        isMaximized() ? showNormal() : showMaximized();
    });
    connect(closeButton, &QPushButton::clicked, this, &QWidget::close);

    layout->addWidget(backButton, 0, Qt::AlignLeft | Qt::AlignVCenter);
    layout->addStretch();
    layout->addWidget(title, 0, Qt::AlignCenter);
    layout->addStretch();
    layout->addWidget(minButton);
    layout->addWidget(maxButton);
    layout->addWidget(closeButton);

    return titleBar;
}

QWidget *DashboardWindow::createRadiationPanel()
{
    auto *panel = new QFrame(this);
    panel->setObjectName(QStringLiteral("statusPanel"));

    auto *layout = new QVBoxLayout(panel);
    layout->setContentsMargins(16, 12, 16, 14);
    layout->setSpacing(10);

    auto *header = new QHBoxLayout;
    auto *title = new QLabel(QStringLiteral("Niveau de Radiation"), panel);
    title->setStyleSheet("font-size:20px;font-weight:700;color:#edf4ff;");
    header->addWidget(title);
    header->addStretch();

    auto *editBtn = new QPushButton(QStringLiteral("✎"), panel);
    editBtn->setFixedSize(28, 28);
    auto *closeBtn = new QPushButton(QStringLiteral("✕"), panel);
    closeBtn->setFixedSize(28, 28);

    const QString buttonStyle =
        "QPushButton { color:#eef3ff; background:rgba(117,140,188,0.18); border:1px solid rgba(169,191,235,0.12); border-radius:6px; font-size:15px; font-weight:700; }";

    editBtn->setStyleSheet(buttonStyle);
    closeBtn->setStyleSheet(buttonStyle);
    header->addWidget(editBtn);
    header->addWidget(closeBtn);
    layout->addLayout(header);

    auto *valueRow = new QHBoxLayout;
    auto *value = new QLabel(QStringLiteral("1.2 μSv/h"), panel);
    value->setStyleSheet("font-size:28px;font-weight:300;color:#fff6eb;");
    auto *warning = createStatusBubble(QStringLiteral("⚠ Avertissement"), QStringLiteral("rgba(240, 135, 35, 0.92)"));
    valueRow->addWidget(value);
    valueRow->addStretch();
    valueRow->addWidget(warning);
    layout->addLayout(valueRow);

    auto *chart = new QLabel(panel);
    chart->setMinimumHeight(120);
    chart->setStyleSheet(
        "QLabel {"
        "  border-radius: 10px;"
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 rgba(203,117,38,0.62), stop:1 rgba(25,37,69,0.15));"
        "  border: 1px solid rgba(255,255,255,0.06);"
        "}"
        );
    layout->addWidget(chart);

    auto *legend = new QVBoxLayout;
    legend->setSpacing(8);
    auto makeLegendLine = [panel](const QString &dot, const QString &text, const QString &color) {
        auto *label = new QLabel(dot + QStringLiteral("  ") + text, panel);
        label->setStyleSheet(QString("font-size:15px;color:%1;").arg(color));
        return label;
    };
    legend->addWidget(makeLegendLine(QStringLiteral("🟢"), QStringLiteral("< 1 μSv/h : Normal"), QStringLiteral("#ffe7b8")));
    legend->addWidget(makeLegendLine(QStringLiteral("🟠"), QStringLiteral("1-3 μSv/h : Avertissement"), QStringLiteral("#ffe7b8")));
    legend->addWidget(makeLegendLine(QStringLiteral("🔴"), QStringLiteral("> 3 μSv/h : Alarme"), QStringLiteral("#ffe7b8")));
    legend->addStretch();
    layout->addLayout(legend);

    connect(editBtn, &QPushButton::clicked, this, [this]() {
        QMessageBox::information(this, QStringLiteral("Radiation"), QStringLiteral("Paramètres radiation bientôt disponibles."));
    });
    connect(closeBtn, &QPushButton::clicked, this, [this, panel]() {
        panel->hide();
        updateBottomStatus();
    });

    return panel;
}

QWidget *DashboardWindow::createBottomBar()
{
    auto *bottomBar = new QFrame(this);
    bottomBar->setObjectName(QStringLiteral("bottomBar"));
    bottomBar->setFixedHeight(50);

    auto *layout = new QHBoxLayout(bottomBar);
    layout->setContentsMargins(18, 0, 18, 0);
    layout->setSpacing(10);

    auto *activeLabel = new QLabel(QStringLiteral("▼  Capteurs Actifs:"), bottomBar);
    activeLabel->setStyleSheet("font-size:16px;");

    m_activeValueLabel = new QLabel(QStringLiteral("0"), bottomBar);
    m_activeValueLabel->setStyleSheet("font-size:16px;font-weight:800;color:#ffd76a;");

    auto *pipe1 = new QLabel(QStringLiteral("|"), bottomBar);
    pipe1->setStyleSheet("color:rgba(255,255,255,0.45);font-size:18px;");

    m_alarmValueLabel = new QLabel(QStringLiteral("0  Alarme"), bottomBar);
    m_alarmValueLabel->setStyleSheet("color:#ff626f;font-size:16px;font-weight:700;");

    auto *pipe2 = new QLabel(QStringLiteral("|"), bottomBar);
    pipe2->setStyleSheet("color:rgba(255,255,255,0.45);font-size:18px;");

    m_warningValueLabel = new QLabel(QStringLiteral("0  Avertissements"), bottomBar);
    m_warningValueLabel->setStyleSheet("color:#ffb130;font-size:16px;font-weight:700;");

    auto *pipe3 = new QLabel(QStringLiteral("|"), bottomBar);
    pipe3->setStyleSheet("color:rgba(255,255,255,0.45);font-size:18px;");

    m_defaultValueLabel = new QLabel(QStringLiteral("0  Défaut"), bottomBar);
    m_defaultValueLabel->setStyleSheet("color:#a6d94d;font-size:16px;font-weight:700;");

    auto *userIcon = new QLabel(QStringLiteral("⚙"), bottomBar);
    userIcon->setStyleSheet("font-size:18px;");
    m_userStatusLabel->setStyleSheet("font-size:16px;");
    auto *account = new QLabel(QStringLiteral("◌"), bottomBar);
    account->setStyleSheet("font-size:18px;");

    layout->addWidget(activeLabel);
    layout->addWidget(m_activeValueLabel);
    layout->addWidget(pipe1);
    layout->addWidget(m_alarmValueLabel);
    layout->addWidget(pipe2);
    layout->addWidget(m_warningValueLabel);
    layout->addWidget(pipe3);
    layout->addWidget(m_defaultValueLabel);
    layout->addStretch();
    layout->addWidget(userIcon);
    layout->addWidget(m_userStatusLabel);
    layout->addWidget(account);

    return bottomBar;
}

void DashboardWindow::handleLogin()
{
    const QString user = m_loginWidget->username().trimmed().isEmpty()
    ? QStringLiteral("admin")
    : m_loginWidget->username().trimmed();

    m_userStatusLabel->setText(user);

    QMessageBox::information(this,
                             QStringLiteral("Connexion"),
                             QStringLiteral("Connexion réussie pour l'utilisateur : %1").arg(user));
}

void DashboardWindow::updateBottomStatus()
{
    int activeCount = 0;
    int alarms = 0;
    int warnings = 0;
    int defaults = 0;

    if (m_smokeWidget && m_smokeWidget->isVisible()) {
        ++activeCount;
        if (m_smokeWidget->severity() == SmokeSensorWidget::Alarm)
            ++alarms;
        else if (m_smokeWidget->severity() == SmokeSensorWidget::Warning)
            ++warnings;
    }

    if (m_temperatureWidget && m_temperatureWidget->isVisible()) {
        ++activeCount;
        if (m_temperatureWidget->severity() == TemperatureWidget::Alarm)
            ++alarms;
        else if (m_temperatureWidget->severity() == TemperatureWidget::Warning)
            ++warnings;
    }

    if (m_cameraWidget && m_cameraWidget->isVisible()) {
        ++activeCount;
    }

    if (m_radiationPanel && m_radiationPanel->isVisible()) {
        ++activeCount;
        ++warnings;
    }

    if (m_activeValueLabel)
        m_activeValueLabel->setText(QString::number(activeCount));
    if (m_alarmValueLabel)
        m_alarmValueLabel->setText(QStringLiteral("%1  Alarme").arg(alarms));
    if (m_warningValueLabel)
        m_warningValueLabel->setText(QStringLiteral("%1  Avertissements").arg(warnings));
    if (m_defaultValueLabel)
        m_defaultValueLabel->setText(QStringLiteral("%1  Défaut").arg(defaults));
}

void DashboardWindow::showCameraFullscreen()
{
    if (!m_cameraWidget) {
        return;
    }

    const QPixmap frame = m_cameraWidget->currentFrame();
    if (frame.isNull()) {
        QMessageBox::warning(this, QStringLiteral("Caméra"), QStringLiteral("Aucune image disponible."));
        return;
    }

    auto *dialog = new QDialog(this);
    dialog->setWindowTitle(QStringLiteral("Caméra - Plein écran"));
    dialog->resize(1200, 800);

    auto *layout = new QVBoxLayout(dialog);
    auto *label = new QLabel(dialog);
    label->setAlignment(Qt::AlignCenter);
    label->setPixmap(frame.scaled(1600, 900, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    layout->addWidget(label);

    dialog->exec();
}

void DashboardWindow::mousePressEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton && event->position().y() <= 90.0) {
        m_dragging = true;
        m_dragOffset = event->globalPosition().toPoint() - frameGeometry().topLeft();
        event->accept();
        return;
    }
    QWidget::mousePressEvent(event);
}

void DashboardWindow::mouseMoveEvent(QMouseEvent *event)
{
    if (m_dragging && (event->buttons() & Qt::LeftButton) && !isMaximized()) {
        move(event->globalPosition().toPoint() - m_dragOffset);
        event->accept();
        return;
    }
    QWidget::mouseMoveEvent(event);
}

void DashboardWindow::mouseReleaseEvent(QMouseEvent *event)
{
    m_dragging = false;
    QWidget::mouseReleaseEvent(event);
}
