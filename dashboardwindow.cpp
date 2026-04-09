#include "dashboardwindow.h"

#include "addsensordialog.h"
#include "camerawidget.h"
#include "loginwidget.h"
#include "modulemanager.h"
#include "networkscannerdialog.h"
#include "sensorfactory.h"
#include "smokesensorwidget.h"
#include "temperaturewidget.h"
#include "widgeteditor.h"

#include <QDialog>
#include <QFileDialog>
#include <QFrame>
#include <QGridLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QMenu>
#include <QMessageBox>
#include <QMouseEvent>
#include <QNetworkInterface>
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
    , m_loginWidget(nullptr)
    , m_smokeWidget(new SmokeSensorWidget(this))
    , m_temperatureWidget(new TemperatureWidget(this))
    , m_cameraWidget(new CameraWidget(this))
    , m_radiationPanel(nullptr)
    , m_userStatusLabel(new QLabel(QStringLiteral("Non connecté"), this))
    , m_activeValueLabel(nullptr)
    , m_alarmValueLabel(nullptr)
    , m_warningValueLabel(nullptr)
    , m_defaultValueLabel(nullptr)
    , m_networkStatusLabel(nullptr)
    , m_scanNetworkButton(nullptr)
    , m_logoutButton(nullptr)
    , m_statusTimer(new QTimer(this))
    , m_dragging(false)
    , m_dbManager(nullptr)
    , m_lockOverlay(nullptr)
    , m_isAuthenticated(false)
    , m_sensorContainer(nullptr)
{
    setWindowFlags(Qt::FramelessWindowHint | Qt::Window);
    resize(800, 600);

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

    // Container pour les capteurs avec positionnement absolu
    m_sensorContainer = new QWidget(bodyArea);
    m_sensorContainer->setObjectName(QStringLiteral("sensorContainer"));

    // Capteurs fixes - positions initiales absolues
    m_smokeWidget->setParent(m_sensorContainer);
    m_smokeWidget->move(20, 20);
    m_smokeWidget->resize(350, 250);

    m_temperatureWidget->setParent(m_sensorContainer);
    m_temperatureWidget->move(20, 290);
    m_temperatureWidget->resize(350, 250);

    m_cameraWidget->setParent(m_sensorContainer);
    m_cameraWidget->move(390, 20);
    m_cameraWidget->resize(450, 520);

    // Activer le déplacement pour tous les widgets
    enableWidgetDragging(m_smokeWidget);
    enableWidgetDragging(m_temperatureWidget);
    enableWidgetDragging(m_cameraWidget);

    contentLayout->addWidget(m_sensorContainer, 1);
    bodyLayout->addLayout(contentLayout, 1);

    rootLayout->addWidget(bodyArea, 1);
    rootLayout->addWidget(createBottomBar());

    chromeInner->addWidget(rootPanel, 1);
    chromeLayout->addWidget(chrome, 1);

    setupWidgetEditButtons();

    connect(m_smokeWidget->closeButton(), &QPushButton::clicked, this, [this]() {
        m_smokeWidget->hide();
        updateBottomStatus();
    });

    connect(m_temperatureWidget->closeButton(), &QPushButton::clicked, this, [this]() {
        m_temperatureWidget->hide();
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

    setupNetworkFeatures();
    setupAuthentication();
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

    auto *settingsButton = new QPushButton(QStringLiteral("⚙"), bottomBar);
    settingsButton->setFixedSize(32, 32);
    settingsButton->setStyleSheet(
        "QPushButton {"
        "  background: rgba(126, 200, 227, 0.2);"
        "  color: #7ec8e3;"
        "  border: 1px solid rgba(126, 200, 227, 0.4);"
        "  border-radius: 16px;"
        "  font-size: 16px;"
        "}"
        "QPushButton:hover {"
        "  background: rgba(126, 200, 227, 0.4);"
        "}"
        );
    connect(settingsButton, &QPushButton::clicked,
            this, &DashboardWindow::openModuleManager);

    m_userStatusLabel->setStyleSheet("font-size:16px;");
    auto *account = new QLabel(QStringLiteral("◌"), bottomBar);
    account->setStyleSheet("font-size:18px;");

    auto *pipe4 = new QLabel(QStringLiteral("|"), bottomBar);
    pipe4->setStyleSheet("color:rgba(255,255,255,0.45);font-size:18px;");

    m_networkStatusLabel = new QLabel(QStringLiteral("Scanning..."), bottomBar);
    m_networkStatusLabel->setStyleSheet("font-size:14px;color:#7ec8e3;");

    m_scanNetworkButton = new QPushButton(QStringLiteral(" Scanner"), bottomBar);
    m_scanNetworkButton->setFixedSize(90, 28);
    m_scanNetworkButton->setStyleSheet(
        "QPushButton {"
        "  background: rgba(74, 144, 217, 0.25);"
        "  color: #7ec8e3;"
        "  border: 1px solid rgba(126, 200, 227, 0.4);"
        "  border-radius: 6px;"
        "  font-size: 12px;"
        "  font-weight: 600;"
        "}"
        "QPushButton:hover {"
        "  background: rgba(74, 144, 217, 0.4);"
        "}"
        );
    connect(m_scanNetworkButton, &QPushButton::clicked,
            this, &DashboardWindow::openNetworkScanner);

    // Bouton pour ajouter un nouveau capteur
    auto *addSensorButton = new QPushButton(QStringLiteral("➕"), bottomBar);
    addSensorButton->setFixedSize(32, 28);
    addSensorButton->setStyleSheet(
        "QPushButton {"
        "  background: rgba(76, 175, 80, 0.25);"
        "  color: #4caf50;"
        "  border: 1px solid rgba(76, 175, 80, 0.4);"
        "  border-radius: 6px;"
        "  font-size: 14px;"
        "  font-weight: 600;"
        "}"
        "QPushButton:hover {"
        "  background: rgba(76, 175, 80, 0.4);"
        "}"
        );
    connect(addSensorButton, &QPushButton::clicked,
            this, &DashboardWindow::onAddSensor);

    // Bouton pour changer la taille des modules
    auto *resizeButton = new QPushButton(QStringLiteral("📐"), bottomBar);
    resizeButton->setFixedSize(32, 28);
    resizeButton->setStyleSheet(
        "QPushButton {"
        "  background: rgba(156, 39, 176, 0.25);"
        "  color: #9c27b0;"
        "  border: 1px solid rgba(156, 39, 176, 0.4);"
        "  border-radius: 6px;"
        "  font-size: 14px;"
        "  font-weight: 600;"
        "}"
        "QPushButton:hover {"
        "  background: rgba(156, 39, 176, 0.4);"
        "}"
        );
    connect(resizeButton, &QPushButton::clicked, this, [this, resizeButton]() {
        QMenu menu(this);
        menu.setStyleSheet(
            "QMenu {"
            "  background: #1a1a2e;"
            "  border: 1px solid #2d3a5c;"
            "  border-radius: 8px;"
            "  padding: 8px;"
            "}"
            "QMenu::item {"
            "  color: #eee;"
            "  padding: 10px 20px;"
            "  border-radius: 5px;"
            "}"
            "QMenu::item:selected {"
            "  background: #4a90d9;"
            "}"
        );

        auto *smallAction = menu.addAction(QStringLiteral("🔹 Petit (1x1)"));
        auto *mediumAction = menu.addAction(QStringLiteral("🔸 Moyen (2x1)"));
        auto *largeAction = menu.addAction(QStringLiteral("🔶 Grand (2x2)"));
        menu.addSeparator();
        auto *autoAction = menu.addAction(QStringLiteral("⚙ Auto (défaut)"));

        connect(smallAction, &QAction::triggered, this, [this]() {
            setWidgetSize(m_smokeWidget, QSize(300, 200));
            setWidgetSize(m_temperatureWidget, QSize(300, 200));
            setWidgetSize(m_cameraWidget, QSize(300, 400));
        });
        connect(mediumAction, &QAction::triggered, this, [this]() {
            setWidgetSize(m_smokeWidget, QSize(450, 250));
            setWidgetSize(m_temperatureWidget, QSize(450, 250));
            setWidgetSize(m_cameraWidget, QSize(450, 500));
        });
        connect(largeAction, &QAction::triggered, this, [this]() {
            setWidgetSize(m_smokeWidget, QSize(600, 350));
            setWidgetSize(m_temperatureWidget, QSize(600, 350));
            setWidgetSize(m_cameraWidget, QSize(600, 700));
        });
        connect(autoAction, &QAction::triggered, this, [this]() {
            // Remettre en mode auto (pas de taille fixe)
            resetWidgetSize(m_smokeWidget);
            resetWidgetSize(m_temperatureWidget);
            resetWidgetSize(m_cameraWidget);
        });

        menu.exec(resizeButton->mapToGlobal(QPoint(0, -menu.sizeHint().height())));
    });

    layout->addWidget(activeLabel);
    layout->addWidget(m_activeValueLabel);
    layout->addWidget(pipe1);
    layout->addWidget(m_alarmValueLabel);
    layout->addWidget(pipe2);
    layout->addWidget(m_warningValueLabel);
    layout->addWidget(pipe3);
    layout->addWidget(m_defaultValueLabel);
    layout->addWidget(pipe4);
    layout->addWidget(m_networkStatusLabel);
    layout->addSpacing(8);
    layout->addWidget(m_scanNetworkButton);
    layout->addWidget(addSensorButton);
    layout->addWidget(resizeButton);
    layout->addStretch();
    layout->addWidget(settingsButton);
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

void DashboardWindow::setupNetworkFeatures()
{
    QString localIp = ArpScanner::getLocalIpAddress();
    QString subnet = ArpScanner::getLocalSubnet();

    if (!subnet.isEmpty()) {
        m_networkStatusLabel->setText(
            QStringLiteral("%1 | %2").arg(localIp, subnet));
    } else {
        m_networkStatusLabel->setText(QStringLiteral("Réseau non détecté"));
    }
}

void DashboardWindow::openNetworkScanner()
{
    NetworkScannerDialog dialog(this);
    if (dialog.exec() == QDialog::Accepted) {
        QVector<NetworkDevice> selectedDevices = dialog.selectedDevices();
        onDevicesConnected(selectedDevices);
    }
}

void DashboardWindow::onDevicesConnected(const QVector<NetworkDevice> &devices)
{
    m_connectedDevices = devices;

    QStringList deviceNames;
    for (const auto &device : devices) {
        deviceNames.append(QStringLiteral("%1 (%2)")
                           .arg(device.ipAddress, device.deviceType));
    }

    if (!devices.isEmpty()) {
        QMessageBox::information(this,
                                 QStringLiteral("Modules Connectés"),
                                 QStringLiteral("%1 module(s) connecté(s):\n\n%2")
                                 .arg(devices.size())
                                 .arg(deviceNames.join(QStringLiteral("\n"))));

        updateConnectedDevicesStatus();
    }
}

void DashboardWindow::updateConnectedDevicesStatus()
{
    int moduleCount = m_connectedDevices.size();

    if (m_networkStatusLabel) {
        QString localIp = ArpScanner::getLocalIpAddress();
        QString subnet = ArpScanner::getLocalSubnet();

        if (moduleCount > 0) {
            m_networkStatusLabel->setText(
                QStringLiteral(" %1 | %2 |  %3 module(s)")
                .arg(localIp, subnet).arg(moduleCount));
        } else {
            m_networkStatusLabel->setText(
                QStringLiteral(" %1 | %2").arg(localIp, subnet));
        }
    }
}

void DashboardWindow::setupWidgetEditButtons()
{
    connect(m_smokeWidget->editButton(), &QPushButton::clicked,
            this, &DashboardWindow::onSmokeWidgetEdit);

    connect(m_temperatureWidget->editButton(), &QPushButton::clicked,
            this, &DashboardWindow::onTempWidgetEdit);

    connect(m_cameraWidget->editButton(), &QPushButton::clicked,
            this, &DashboardWindow::onCameraWidgetEdit);
}

void DashboardWindow::onSmokeWidgetEdit()
{
    WidgetConfig config;
    config.id = QStringLiteral("smoke-001");
    config.name = QStringLiteral("Niveau de Fumée");
    config.type = QStringLiteral("Fumée MQ-2");
    config.warningThreshold = 28;
    config.alarmThreshold = 60;
    config.unit = QStringLiteral("%");

    WidgetEditor editor(config, this);
    if (editor.exec() == QDialog::Accepted) {
        WidgetConfig newConfig = editor.getConfig();
        m_smokeWidget->setTitle(newConfig.name);
        QMessageBox::information(this,
                                 QStringLiteral("Widget modifié"),
                                 QStringLiteral("Nouveau nom: %1\nType: %2")
                                 .arg(newConfig.name, newConfig.type));
    }
}

void DashboardWindow::onTempWidgetEdit()
{
    WidgetConfig config;
    config.id = QStringLiteral("temp-001");
    config.name = QStringLiteral("Historique Température");
    config.type = QStringLiteral("Température DHT22");
    config.warningThreshold = 45;
    config.alarmThreshold = 58;
    config.unit = QStringLiteral("°C");

    WidgetEditor editor(config, this);
    if (editor.exec() == QDialog::Accepted) {
        WidgetConfig newConfig = editor.getConfig();
        m_temperatureWidget->setTitle(newConfig.name);
        QMessageBox::information(this,
                                 QStringLiteral("Widget modifié"),
                                 QStringLiteral("Nouveau nom: %1\nType: %2")
                                 .arg(newConfig.name, newConfig.type));
    }
}

void DashboardWindow::onCameraWidgetEdit()
{
    // Éditeur spécifique pour la caméra - sans seuils d'alarme
    WidgetConfig config;
    config.id = QStringLiteral("cam-001");
    config.name = m_cameraWidget->windowTitle().isEmpty() ?
                  QStringLiteral("Caméra Salle Serveur") : m_cameraWidget->windowTitle();
    config.type = QStringLiteral("Caméra");
    config.warningThreshold = 0;  // Pas utilisé pour caméra
    config.alarmThreshold = 0;    // Pas utilisé pour caméra
    config.unit = QStringLiteral("");  // Pas d'unité

    WidgetEditor editor(config, this, true);  // true = mode caméra
    if (editor.exec() == QDialog::Accepted) {
        WidgetConfig newConfig = editor.getConfig();
        m_cameraWidget->setTitle(newConfig.name);
        QMessageBox::information(this,
                                 QStringLiteral("Caméra modifiée"),
                                 QStringLiteral("Nouveau nom: %1")
                                 .arg(newConfig.name));
    }
}

void DashboardWindow::onRadiationPanelEdit()
{
    WidgetConfig config;
    config.id = QStringLiteral("rad-001");
    config.name = QStringLiteral("Niveau de Radiation");
    config.type = QStringLiteral("Radiation");
    config.warningThreshold = 3;
    config.alarmThreshold = 10;
    config.unit = QStringLiteral("μSv/h");

    WidgetEditor editor(config, this);
    if (editor.exec() == QDialog::Accepted) {
        WidgetConfig newConfig = editor.getConfig();
        QMessageBox::information(this,
                                 QStringLiteral("Widget modifié"),
                                 QStringLiteral("Nouveau nom: %1\nType: %2")
                                 .arg(newConfig.name, newConfig.type));
    }
}

void DashboardWindow::openModuleManager()
{
    ModuleManager manager(this);
    manager.exec();
}

void DashboardWindow::onUserAuthenticated(const User &user)
{
    m_currentUser = user;
    m_isAuthenticated = true;

    m_userStatusLabel->setText(QStringLiteral("%1 (%2)")
                               .arg(user.username, user.getRoleString()));

    updateUIBasedOnRole();
    setWidgetsEnabled(true);

    if (m_lockOverlay) {
        m_lockOverlay->hide();
    }

    QMessageBox::information(this,
                             QStringLiteral("Bienvenue"),
                             QStringLiteral("Connecté en tant que %1\nRôle: %2")
                             .arg(user.fullName.isEmpty() ? user.username : user.fullName,
                                  user.getRoleString()));
}

void DashboardWindow::onUserLoggedOut()
{
    m_currentUser = User();
    m_isAuthenticated = false;

    m_userStatusLabel->setText(QStringLiteral("Non connecté"));

    setWidgetsEnabled(false);

    if (m_lockOverlay) {
        m_lockOverlay->show();
    }

    showLoginDialog();
}

void DashboardWindow::showLoginDialog()
{
    // Show the built-in lock overlay (already visible)
    if (m_lockOverlay) {
        m_lockOverlay->show();
        m_lockOverlay->raise();
    }
}

void DashboardWindow::logout()
{
    m_dbManager->clearCurrentUser();
    onUserLoggedOut();
}

void DashboardWindow::paintEvent(QPaintEvent *event)
{
    QWidget::paintEvent(event);
}

void DashboardWindow::resizeEvent(QResizeEvent *event)
{
    QWidget::resizeEvent(event);
    if (m_lockOverlay) {
        m_lockOverlay->setGeometry(rect());
    }
}

void DashboardWindow::setupAuthentication()
{
    m_dbManager = new DatabaseManager(this);
    m_isAuthenticated = false;

    if (!m_dbManager->initialize()) {
        QMessageBox::critical(this,
                              QStringLiteral("Erreur"),
                              QStringLiteral("Impossible d'initialiser la base de données"));
        close();
        return;
    }

    connect(m_dbManager, &DatabaseManager::userAuthenticated,
            this, &DashboardWindow::onUserAuthenticated);
    connect(m_dbManager, &DatabaseManager::userLoggedOut,
            this, &DashboardWindow::onUserLoggedOut);

    createLockOverlay();
    setWidgetsEnabled(false);

    QTimer::singleShot(100, this, &DashboardWindow::showLoginDialog);
}

void DashboardWindow::createLockOverlay()
{
    // Full-size overlay covering the dashboard
    m_lockOverlay = new QWidget(this);
    m_lockOverlay->setGeometry(rect());
    m_lockOverlay->setObjectName(QStringLiteral("lockOverlay"));
    m_lockOverlay->setStyleSheet(
        "QWidget#lockOverlay { background: rgba(10, 18, 40, 0.92); }"
        "QWidget#loginCard {"
        "  background: qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 #1a2744,stop:1 #131f3a);"
        "  border-radius: 18px;"
        "  border: 1px solid #2d3f6a;"
        "}"
        "QLabel { color: #cdd6f4; background: transparent; }"
        "QLineEdit {"
        "  background: #0d1529; color: #eee; border: 2px solid #2d3f6a;"
        "  border-radius: 8px; padding: 10px 14px; font-size: 14px;"
        "  selection-background-color: #4a90d9;"
        "}"
        "QLineEdit:focus { border-color: #4a90d9; }"
        "QPushButton#loginBtn {"
        "  background: qlineargradient(x1:0,y1:0,x2:0,y2:1,stop:0 #4a90d9,stop:1 #357abd);"
        "  color: white; border: none; border-radius: 9px;"
        "  padding: 12px; font-size: 15px; font-weight: 700;"
        "}"
        "QPushButton#loginBtn:hover { background: qlineargradient(x1:0,y1:0,x2:0,y2:1,stop:0 #5aa0e9,stop:1 #458acd); }"
        "QPushButton#loginBtn:disabled { background: #1e2d4a; color: #3a4f70; border: 1px solid #2d3f6a; }"
        "QPushButton#quitBtn {"
        "  background: transparent; color: #4a5a7a;"
        "  border: 1px solid #2d3f6a; border-radius: 8px; padding: 9px;"
        "  font-size: 13px;"
        "}"
        "QPushButton#quitBtn:hover { color: #e74c3c; border-color: #e74c3c; }"
    );

    auto *overlayLayout = new QVBoxLayout(m_lockOverlay);
    overlayLayout->setAlignment(Qt::AlignCenter);

    // ── Login card ──────────────────────────────────────
    auto *card = new QFrame(m_lockOverlay);
    card->setObjectName(QStringLiteral("loginCard"));
    card->setFixedWidth(400);

    auto *cardLayout = new QVBoxLayout(card);
    cardLayout->setContentsMargins(40, 38, 40, 34);
    cardLayout->setSpacing(16);

    // Lock icon
    auto *lockIcon = new QLabel(QStringLiteral("🔒"), card);
    lockIcon->setStyleSheet("font-size: 40px;");
    lockIcon->setAlignment(Qt::AlignCenter);
    cardLayout->addWidget(lockIcon);

    // Title
    auto *titleLbl = new QLabel(QStringLiteral("Système de Surveillance"), card);
    titleLbl->setStyleSheet("font-size: 20px; font-weight: 700; color: #4a90d9;");
    titleLbl->setAlignment(Qt::AlignCenter);
    cardLayout->addWidget(titleLbl);

    auto *subLbl = new QLabel(QStringLiteral("Authentification requise"), card);
    subLbl->setStyleSheet("font-size: 12px; color: #3a5070; margin-bottom: 6px;");
    subLbl->setAlignment(Qt::AlignCenter);
    cardLayout->addWidget(subLbl);

    // Separator
    auto *sep = new QFrame(card);
    sep->setFrameShape(QFrame::HLine);
    sep->setStyleSheet("background: #2d3f6a; max-height: 1px; border: none;");
    cardLayout->addWidget(sep);

    // Error label
    auto *errorLabel = new QLabel(card);
    errorLabel->setObjectName(QStringLiteral("errorLabel"));
    errorLabel->setStyleSheet(
        "color: #e74c3c; font-size: 12px; padding: 7px 12px;"
        "background: rgba(231,76,60,0.1); border-radius: 6px;"
        "border: 1px solid rgba(231,76,60,0.25);");
    errorLabel->setAlignment(Qt::AlignCenter);
    errorLabel->setWordWrap(true);
    errorLabel->hide();
    cardLayout->addWidget(errorLabel);

    // Username
    auto *userLbl = new QLabel(QStringLiteral("Identifiant"), card);
    userLbl->setStyleSheet("font-size: 12px; font-weight: 600; color: #7ec8e3;");
    cardLayout->addWidget(userLbl);

    auto *usernameEdit = new QLineEdit(card);
    usernameEdit->setObjectName(QStringLiteral("usernameEdit"));
    usernameEdit->setPlaceholderText(QStringLiteral("admin · operateur · visiteur"));
    usernameEdit->setFixedHeight(42);
    cardLayout->addWidget(usernameEdit);

    // Password
    auto *passLbl = new QLabel(QStringLiteral("Mot de passe"), card);
    passLbl->setStyleSheet("font-size: 12px; font-weight: 600; color: #7ec8e3;");
    cardLayout->addWidget(passLbl);

    auto *passwordEdit = new QLineEdit(card);
    passwordEdit->setObjectName(QStringLiteral("passwordEdit"));
    passwordEdit->setEchoMode(QLineEdit::Password);
    passwordEdit->setPlaceholderText(QStringLiteral("Votre mot de passe…"));
    passwordEdit->setFixedHeight(42);
    cardLayout->addWidget(passwordEdit);

    cardLayout->addSpacing(4);

    // Login button
    auto *loginBtn = new QPushButton(QStringLiteral("Se connecter"), card);
    loginBtn->setObjectName(QStringLiteral("loginBtn"));
    loginBtn->setFixedHeight(46);
    loginBtn->setEnabled(false);
    cardLayout->addWidget(loginBtn);

    // Quit button
    auto *quitBtn = new QPushButton(QStringLiteral("Quitter l'application"), card);
    quitBtn->setObjectName(QStringLiteral("quitBtn"));
    quitBtn->setFixedHeight(38);
    cardLayout->addWidget(quitBtn);

    overlayLayout->addWidget(card);

    // ── Connections ─────────────────────────────────────
    connect(usernameEdit, &QLineEdit::textChanged, loginBtn, [loginBtn, usernameEdit, passwordEdit](const QString &) {
        loginBtn->setEnabled(
            !usernameEdit->text().trimmed().isEmpty() &&
            !passwordEdit->text().isEmpty());
    });
    connect(passwordEdit, &QLineEdit::textChanged, loginBtn, [loginBtn, usernameEdit, passwordEdit](const QString &) {
        loginBtn->setEnabled(
            !usernameEdit->text().trimmed().isEmpty() &&
            !passwordEdit->text().isEmpty());
    });

    auto doLogin = [this, usernameEdit, passwordEdit, errorLabel]() {
        errorLabel->hide();
        QString user = usernameEdit->text().trimmed();
        QString pass = passwordEdit->text();

        connect(m_dbManager, &DatabaseManager::authenticationFailed,
                errorLabel, [errorLabel](const QString &msg) {
            errorLabel->setText(QStringLiteral("⚠  %1").arg(msg));
            errorLabel->show();
        }, Qt::SingleShotConnection);

        m_dbManager->authenticateUser(user, pass);
    };

    connect(loginBtn, &QPushButton::clicked, this, doLogin);
    connect(passwordEdit, &QLineEdit::returnPressed, this, doLogin);
    connect(quitBtn, &QPushButton::clicked, this, &DashboardWindow::close);

    m_lockOverlay->show();
    m_lockOverlay->raise();
}

void DashboardWindow::updateUIBasedOnRole()
{
    if (!m_isAuthenticated) return;

    // Enable/disable features based on role
    bool canEdit = m_currentUser.canEditWidgets();
    bool canConfigure = m_currentUser.canConfigureSystem();

    // Update edit buttons visibility
    if (m_smokeWidget) {
        m_smokeWidget->editButton()->setEnabled(canEdit);
        m_smokeWidget->editButton()->setVisible(canEdit);
    }
    if (m_temperatureWidget) {
        m_temperatureWidget->editButton()->setEnabled(canEdit);
        m_temperatureWidget->editButton()->setVisible(canEdit);
    }
    if (m_cameraWidget) {
        m_cameraWidget->editButton()->setEnabled(canEdit);
        m_cameraWidget->editButton()->setVisible(canEdit);
    }

    // Settings button only for admin
    if (m_logoutButton) {
        m_logoutButton->setEnabled(canConfigure);
    }
}

void DashboardWindow::setWidgetsEnabled(bool enabled)
{
    // Disable/enable all interactive widgets
    if (m_smokeWidget) {
        m_smokeWidget->setEnabled(enabled);
    }
    if (m_temperatureWidget) {
        m_temperatureWidget->setEnabled(enabled);
    }
    if (m_cameraWidget) {
        m_cameraWidget->setEnabled(enabled);
    }
    if (m_radiationPanel) {
        m_radiationPanel->setEnabled(enabled);
    }
    if (m_scanNetworkButton) {
        m_scanNetworkButton->setEnabled(enabled);
    }
    // Enable/disable dynamic sensors
    for (auto *sensor : m_dynamicSensors) {
        if (sensor) sensor->setEnabled(enabled);
    }
}

void DashboardWindow::addSensorToGrid(QWidget *widget, int rowSpan, int colSpan)
{
    Q_UNUSED(rowSpan)
    Q_UNUSED(colSpan)

    if (!m_sensorContainer || !widget) return;

    // Positionnement absolu - calculer une position libre
    int x = 20 + (m_dynamicSensors.size() % 3) * 370;
    int y = 20 + (m_dynamicSensors.size() / 3) * 270;

    widget->setParent(m_sensorContainer);
    widget->move(x, y);
    widget->resize(350, 250);

    // Activer le déplacement
    enableWidgetDragging(widget);

    // Ajouter à la liste des capteurs dynamiques
    m_dynamicSensors.append(widget);

    widget->show();
}

void DashboardWindow::onAddSensor()
{
    AddSensorDialog dialog(this);
    if (dialog.exec() == QDialog::Accepted) {
        SensorConfig config = dialog.getSensorConfig();

        QWidget *newWidget = nullptr;

        switch (config.type) {
        case SensorType::Smoke:
            newWidget = SensorFactory::createSmokeSensor(this, config.name);
            connect(static_cast<SmokeSensorWidget*>(newWidget)->editButton(), &QPushButton::clicked,
                    this, [this, newWidget]() {
                // TODO: Gérer l'édition des capteurs dynamiques
                QMessageBox::information(this, QStringLiteral("Info"), QStringLiteral("Édition du capteur"));
            });
            connect(static_cast<SmokeSensorWidget*>(newWidget)->closeButton(), &QPushButton::clicked,
                    this, [newWidget, this]() {
                newWidget->hide();
                updateBottomStatus();
            });
            break;

        case SensorType::Temperature:
            newWidget = SensorFactory::createTemperatureSensor(this, config.name);
            connect(static_cast<TemperatureWidget*>(newWidget)->editButton(), &QPushButton::clicked,
                    this, [this, newWidget]() {
                QMessageBox::information(this, QStringLiteral("Info"), QStringLiteral("Édition du capteur"));
            });
            connect(static_cast<TemperatureWidget*>(newWidget)->closeButton(), &QPushButton::clicked,
                    this, [newWidget, this]() {
                newWidget->hide();
                updateBottomStatus();
            });
            break;

        case SensorType::Camera:
            newWidget = SensorFactory::createCamera(this, config.name);
            connect(static_cast<CameraWidget*>(newWidget)->closeButton(), &QPushButton::clicked,
                    this, [newWidget, this]() {
                newWidget->hide();
                updateBottomStatus();
            });
            connect(static_cast<CameraWidget*>(newWidget)->reloadButton(), &QPushButton::clicked,
                    this, [newWidget]() {
                static_cast<CameraWidget*>(newWidget)->reloadFrame();
            });
            connect(static_cast<CameraWidget*>(newWidget)->snapshotButton(), &QPushButton::clicked,
                    this, [newWidget, this]() {
                const QPixmap frame = static_cast<CameraWidget*>(newWidget)->currentFrame();
                if (!frame.isNull()) {
                    const QString fileName = QFileDialog::getSaveFileName(
                        this, QStringLiteral("Enregistrer"), QStringLiteral("capture.png"),
                        QStringLiteral("Images (*.png *.jpg)"));
                    if (!fileName.isEmpty()) frame.save(fileName);
                }
            });
            break;

        default:
            QMessageBox::warning(this, QStringLiteral("Non supporté"),
                                 QStringLiteral("Ce type de capteur n'est pas encore supporté."));
            return;
        }

        if (newWidget) {
            // Ajouter le widget à la grille dynamique
            int rowSpan = (config.type == SensorType::Camera) ? 2 : 1;
            int colSpan = (config.type == SensorType::Camera) ? 1 : 1;

            addSensorToGrid(newWidget, rowSpan, colSpan);

            // Connecter le bouton d'édition pour les capteurs dynamiques
            if (config.type == SensorType::Smoke || config.type == SensorType::Temperature) {
                connect(static_cast<SmokeSensorWidget*>(newWidget)->editButton(), &QPushButton::clicked,
                        this, [this, newWidget, config]() {
                    WidgetConfig wc;
                    wc.id = config.id;
                    wc.name = static_cast<SmokeSensorWidget*>(newWidget)->currentSummary();
                    wc.type = SensorFactory::sensorTypeToString(config.type);
                    wc.warningThreshold = config.warningThreshold;
                    wc.alarmThreshold = config.alarmThreshold;
                    wc.unit = config.unit;

                    WidgetEditor editor(wc, this);
                    if (editor.exec() == QDialog::Accepted) {
                        WidgetConfig newConfig = editor.getConfig();
                        static_cast<SmokeSensorWidget*>(newWidget)->setTitle(newConfig.name);
                    }
                });
            }

            QMessageBox::information(this, QStringLiteral("Capteur ajouté"),
                                     QStringLiteral("Le capteur '%1' a été ajouté au dashboard.")
                                     .arg(config.name));
        }
    }
}

void DashboardWindow::setWidgetSize(QWidget *widget, const QSize &size)
{
    if (!widget) return;

    // Définir une taille fixe minimale et maximale
    widget->setMinimumSize(size);
    widget->setMaximumSize(size);

    // Forcer le recalcul du layout
    if (m_sensorContainer) {
        m_sensorContainer->adjustSize();
    }
}

void DashboardWindow::resetWidgetSize(QWidget *widget)
{
    if (!widget) return;

    // Remettre en mode auto
    widget->setMinimumSize(0, 0);
    widget->setMaximumSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX);

    // Forcer le recalcul du layout
    if (m_sensorContainer) {
        m_sensorContainer->adjustSize();
    }
}

void DashboardWindow::enableWidgetDragging(QWidget *widget)
{
    if (!widget) return;

    // Installer un event filter pour gérer le drag
    widget->installEventFilter(this);

    // Changer le curseur pour indiquer que c'est déplaçable
    widget->setCursor(Qt::OpenHandCursor);
}

bool DashboardWindow::eventFilter(QObject *watched, QEvent *event)
{
    static QWidget *draggedWidget = nullptr;
    static QWidget *resizedWidget = nullptr;
    static int resizeCorner = 0; // 1=bottom-right, 2=bottom-left, 3=top-right, 4=top-left
    static QPoint dragStartPos;
    static QPoint widgetStartPos;
    static QSize widgetStartSize;

    // Vérifier si c'est un de nos widgets déplaçables
    QWidget *widget = qobject_cast<QWidget*>(watched);
    if (!widget || (widget != m_smokeWidget && widget != m_temperatureWidget &&
                    widget != m_cameraWidget && !m_dynamicSensors.contains(widget))) {
        return QWidget::eventFilter(watched, event);
    }

    switch (event->type()) {
    case QEvent::MouseButtonPress: {
        auto *mouseEvent = static_cast<QMouseEvent*>(event);
        if (mouseEvent->button() == Qt::LeftButton) {
            QPoint pos = mouseEvent->pos();
            int w = widget->width();
            int h = widget->height();

            // Vérifier si on clique sur un coin de redimensionnement (15px)
            bool nearRight = pos.x() >= w - 15;
            bool nearLeft = pos.x() <= 15;
            bool nearBottom = pos.y() >= h - 15;
            bool nearTop = pos.y() <= 15;

            if (nearRight && nearBottom) {
                resizedWidget = widget;
                resizeCorner = 1; // bottom-right
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeFDiagCursor);
                return true;
            } else if (nearLeft && nearBottom) {
                resizedWidget = widget;
                resizeCorner = 2; // bottom-left
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartPos = widget->pos();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeBDiagCursor);
                return true;
            } else if (nearRight && nearTop) {
                resizedWidget = widget;
                resizeCorner = 3; // top-right
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartPos = widget->pos();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeBDiagCursor);
                return true;
            } else if (nearLeft && nearTop) {
                resizedWidget = widget;
                resizeCorner = 4; // top-left
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartPos = widget->pos();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeFDiagCursor);
                return true;
            }
            // Vérifier si on clique sur la barre de titre (haut du widget)
            else if (pos.y() < 40 && !nearLeft && !nearRight) {
                draggedWidget = widget;
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartPos = widget->pos();
                widget->setCursor(Qt::ClosedHandCursor);
                return true;
            }
        }
        break;
    }
    case QEvent::MouseMove: {
        auto *mouseEvent = static_cast<QMouseEvent*>(event);
        QPoint pos = mouseEvent->pos();
        int w = widget->width();
        int h = widget->height();

        // Mettre à jour le curseur selon la position
        if (draggedWidget != widget && resizedWidget != widget) {
            bool nearRight = pos.x() >= w - 15;
            bool nearLeft = pos.x() <= 15;
            bool nearBottom = pos.y() >= h - 15;
            bool nearTop = pos.y() <= 15;

            if ((nearRight && nearBottom) || (nearLeft && nearTop)) {
                widget->setCursor(Qt::SizeFDiagCursor);
            } else if ((nearLeft && nearBottom) || (nearRight && nearTop)) {
                widget->setCursor(Qt::SizeBDiagCursor);
            } else if (pos.y() < 40) {
                widget->setCursor(Qt::OpenHandCursor);
            } else {
                widget->setCursor(Qt::ArrowCursor);
            }
        }

        // Gérer le déplacement
        if (draggedWidget == widget) {
            QPoint delta = mouseEvent->globalPosition().toPoint() - dragStartPos;
            QPoint newPos = widgetStartPos + delta;

            // Limiter aux bornes du conteneur
            if (m_sensorContainer) {
                newPos.setX(qMax(0, qMin(newPos.x(),
                                         m_sensorContainer->width() - widget->width())));
                newPos.setY(qMax(0, qMin(newPos.y(),
                                         m_sensorContainer->height() - widget->height())));
            }

            widget->move(newPos);
            return true;
        }

        // Gérer le redimensionnement
        if (resizedWidget == widget) {
            QPoint delta = mouseEvent->globalPosition().toPoint() - dragStartPos;
            int newW = widgetStartSize.width();
            int newH = widgetStartSize.height();
            int newX = widgetStartPos.x();
            int newY = widgetStartPos.y();

            switch (resizeCorner) {
            case 1: // bottom-right
                newW = widgetStartSize.width() + delta.x();
                newH = widgetStartSize.height() + delta.y();
                break;
            case 2: // bottom-left
                newW = widgetStartSize.width() - delta.x();
                newH = widgetStartSize.height() + delta.y();
                newX = widgetStartPos.x() + delta.x();
                break;
            case 3: // top-right
                newW = widgetStartSize.width() + delta.x();
                newH = widgetStartSize.height() - delta.y();
                newY = widgetStartPos.y() + delta.y();
                break;
            case 4: // top-left
                newW = widgetStartSize.width() - delta.x();
                newH = widgetStartSize.height() - delta.y();
                newX = widgetStartPos.x() + delta.x();
                newY = widgetStartPos.y() + delta.y();
                break;
            }

            // Limites minimales
            newW = qMax(200, newW);
            newH = qMax(150, newH);

            // Limites maximales
            if (m_sensorContainer) {
                newW = qMin(m_sensorContainer->width() - newX, newW);
                newH = qMin(m_sensorContainer->height() - newY, newH);
            }

            widget->resize(newW, newH);
            if (resizeCorner >= 2) {
                widget->move(newX, newY);
            }
            return true;
        }
        break;
    }
    case QEvent::MouseButtonRelease: {
        if (draggedWidget == widget) {
            draggedWidget = nullptr;
            widget->setCursor(Qt::OpenHandCursor);
            return true;
        }
        if (resizedWidget == widget) {
            resizedWidget = nullptr;
            resizeCorner = 0;
            widget->setCursor(Qt::OpenHandCursor);
            return true;
        }
        break;
    }
    default:
        break;
    }

    return QWidget::eventFilter(watched, event);
}
