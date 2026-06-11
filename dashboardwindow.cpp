#include "dashboardwindow.h"

#include "addsensordialog.h"
#include "camerawidget.h"
#include "databaseviewerwidget.h"
#include "modulemanager.h"
#include "mqttclient.h"
#include "networkscannerdialog.h"
#include "sensorfactory.h"
#include "smokesensorwidget.h"
#include "temperaturewidget.h"
#include "widgeteditor.h"

#include <QDebug>
#include <QDialog>
#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QMenu>
#include <QMessageBox>
#include <QMouseEvent>
#include <QPushButton>
#include <QShowEvent>
#include <QTabWidget>
#include <QTimer>
#include <QVBoxLayout>

namespace {

// === CONFIGURATION MQTT ===
// Adresse du broker Mosquitto (mTLS sur le port 8883).
const QString kBrokerHost = QStringLiteral("200.26.16.180");
constexpr quint16 kBrokerPort = 8883;

// Identifiants par défaut des capteurs quand le message MQTT n'en donne pas.
const QString kDefaultTempSensorId  = QStringLiteral("rpi-001");
const QString kDefaultSmokeSensorId = QStringLiteral("rpi-003");

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

} // namespace

// =====================================================================
//  CONSTRUCTION DE LA FENÊTRE
// =====================================================================
DashboardWindow::DashboardWindow(QWidget *parent)
    : QWidget(parent)
    , m_smokeWidget(nullptr)
    , m_temperatureWidget(nullptr)
    , m_cameraWidget(nullptr)
    , m_sensorContainer(nullptr)
    , m_userStatusLabel(new QLabel(QStringLiteral("Non connecté"), this))
    , m_activeValueLabel(nullptr)
    , m_alarmValueLabel(nullptr)
    , m_warningValueLabel(nullptr)
    , m_defaultValueLabel(nullptr)
    , m_networkStatusLabel(nullptr)
    , m_scanNetworkButton(nullptr)
    , m_statusTimer(new QTimer(this))
    , m_dataRefreshTimer(nullptr)
    , m_dragging(false)
    , m_dbManager(nullptr)
    , m_lockOverlay(nullptr)
    , m_isAuthenticated(false)
    , m_dbViewer(nullptr)
    , m_mqttClient(nullptr)
{
    setWindowFlags(Qt::FramelessWindowHint | Qt::Window);
    resize(800, 600);

    // --- Feuille de style globale de la fenêtre ---
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
        );

    // --- Structure générale : chrome > rootPanel > (titre, corps, bas) ---
    auto *chromeLayout = new QVBoxLayout(this);
    chromeLayout->setContentsMargins(12, 12, 12, 12);
    chromeLayout->setSpacing(0);

    auto *chrome = new QWidget(this);
    chrome->setObjectName(QStringLiteral("chrome"));
    auto *chromeInner = new QVBoxLayout(chrome);
    chromeInner->setContentsMargins(14, 10, 14, 12);
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
    bodyLayout->setContentsMargins(12, 10, 12, 6);
    bodyLayout->setSpacing(8);

    // Conteneur des capteurs : positionnement absolu pour permettre le
    // glisser-déposer. Le dashboard démarre vide — les widgets sont créés
    // quand l'utilisateur scanne le réseau et connecte les Raspberry Pi.
    m_sensorContainer = new QWidget(bodyArea);
    m_sensorContainer->setObjectName(QStringLiteral("sensorContainer"));

    // Deux onglets : les capteurs et la visionneuse d'historique BDD.
    auto *tabs = new QTabWidget(bodyArea);
    tabs->setObjectName(QStringLiteral("dashboardTabs"));
    tabs->setStyleSheet(
        "QTabWidget#dashboardTabs::pane {"
        "  border: 1px solid rgba(173, 191, 233, 0.18);"
        "  border-radius: 8px;"
        "  background: rgba(16, 29, 59, 0.32);"
        "  top: -1px;"
        "}"
        "QTabWidget#dashboardTabs QTabBar::tab {"
        "  background: rgba(7, 18, 41, 0.40);"
        "  color: #c8d6f0;"
        "  padding: 8px 18px;"
        "  border: 1px solid rgba(173, 191, 233, 0.18);"
        "  border-bottom: none;"
        "  border-top-left-radius: 8px;"
        "  border-top-right-radius: 8px;"
        "  font-weight: 600;"
        "  margin-right: 2px;"
        "}"
        "QTabWidget#dashboardTabs QTabBar::tab:selected {"
        "  background: rgba(45, 108, 223, 0.65);"
        "  color: #ffffff;"
        "}"
        "QTabWidget#dashboardTabs QTabBar::tab:hover {"
        "  background: rgba(45, 108, 223, 0.35);"
        "}"
        );
    tabs->addTab(m_sensorContainer, tr("Capteurs"));

    m_dbViewer = new DatabaseViewerWidget(tabs);
    tabs->addTab(m_dbViewer, tr("Historique BDD"));

    auto *contentLayout = new QHBoxLayout;
    contentLayout->setContentsMargins(0, 0, 0, 0);
    contentLayout->addWidget(tabs, 1);
    bodyLayout->addLayout(contentLayout, 1);

    rootLayout->addWidget(bodyArea, 1);
    rootLayout->addWidget(createBottomBar());

    chromeInner->addWidget(rootPanel, 1);
    chromeLayout->addWidget(chrome, 1);

    // --- Mise en place des sous-systèmes ---
    connect(m_statusTimer, &QTimer::timeout,
            this, &DashboardWindow::updateBottomStatus);
    m_statusTimer->start(1200);

    setupNetworkFeatures();
    setupAuthentication();

    // Premier chargement de l'historique (la connexion SQL existe désormais)
    if (m_dbViewer)
        m_dbViewer->refresh();

    setupMqtt();             // prépare le client (connexion différée au scan)
    setupDataRefreshTimer(); // relit la BDD toutes les 2 secondes
    updateBottomStatus();

    // L'écran de verrouillage doit rester au-dessus de tout.
    if (m_lockOverlay) {
        m_lockOverlay->setGeometry(0, 0, width(), height());
        m_lockOverlay->raise();
    }
}

// =====================================================================
//  GESTION DE L'INTERFACE : BARRE DE TITRE
// =====================================================================
QWidget *DashboardWindow::createTitleBar()
{
    auto *titleBar = new QWidget(this);
    titleBar->setObjectName(QStringLiteral("titleBar"));
    titleBar->setFixedHeight(54);

    auto *layout = new QHBoxLayout(titleBar);
    layout->setContentsMargins(18, 0, 14, 0);
    layout->setSpacing(12);

    // Bouton "✦" : réaffiche les widgets capteurs fermés.
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

    auto *minButton   = createWindowButton(QStringLiteral("−"), titleBar);
    auto *maxButton   = createWindowButton(QStringLiteral("□"), titleBar);
    auto *closeButton = createWindowButton(QStringLiteral("×"), titleBar, true);

    connect(backButton, &QPushButton::clicked, this, [this]() {
        if (m_smokeWidget)       m_smokeWidget->show();
        if (m_cameraWidget)      m_cameraWidget->show();
        if (m_temperatureWidget) m_temperatureWidget->show();
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

// =====================================================================
//  GESTION DE L'INTERFACE : BARRE D'ÉTAT DU BAS
// =====================================================================
QWidget *DashboardWindow::createBottomBar()
{
    auto *bottomBar = new QFrame(this);
    bottomBar->setObjectName(QStringLiteral("bottomBar"));
    bottomBar->setFixedHeight(42);

    auto *layout = new QHBoxLayout(bottomBar);
    layout->setContentsMargins(18, 0, 18, 0);
    layout->setSpacing(10);

    // --- Compteurs de capteurs (actifs / alarmes / avertissements) ---
    auto *activeLabel = new QLabel(QStringLiteral("▼  Capteurs Actifs:"), bottomBar);
    activeLabel->setStyleSheet("font-size:16px;");

    m_activeValueLabel = new QLabel(QStringLiteral("0"), bottomBar);
    m_activeValueLabel->setStyleSheet("font-size:16px;font-weight:800;color:#ffd76a;");

    auto makePipe = [bottomBar]() {
        auto *pipe = new QLabel(QStringLiteral("|"), bottomBar);
        pipe->setStyleSheet("color:rgba(255,255,255,0.45);font-size:18px;");
        return pipe;
    };

    m_alarmValueLabel = new QLabel(QStringLiteral("0  Alarme"), bottomBar);
    m_alarmValueLabel->setStyleSheet("color:#ff626f;font-size:16px;font-weight:700;");

    m_warningValueLabel = new QLabel(QStringLiteral("0  Avertissements"), bottomBar);
    m_warningValueLabel->setStyleSheet("color:#ffb130;font-size:16px;font-weight:700;");

    m_defaultValueLabel = new QLabel(QStringLiteral("0  Défaut"), bottomBar);
    m_defaultValueLabel->setStyleSheet("color:#a6d94d;font-size:16px;font-weight:700;");

    // --- Bouton réglages (gestion des modules) ---
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

    // --- État réseau + bouton de scan ---
    m_userStatusLabel->setStyleSheet("font-size:16px;");
    auto *account = new QLabel(QStringLiteral("◌"), bottomBar);
    account->setStyleSheet("font-size:18px;");

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

    // --- Bouton d'ajout d'un capteur ---
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

    // --- Bouton de redimensionnement rapide des modules ---
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
        // Menu contextuel avec des tailles prédéfinies pour les 3 widgets.
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

        auto *smallAction  = menu.addAction(QStringLiteral("🔹 Petit (1x1)"));
        auto *mediumAction = menu.addAction(QStringLiteral("🔸 Moyen (2x1)"));
        auto *largeAction  = menu.addAction(QStringLiteral("🔶 Grand (2x2)"));
        menu.addSeparator();
        auto *autoAction   = menu.addAction(QStringLiteral("⚙ Auto (défaut)"));

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
            resetWidgetSize(m_smokeWidget);
            resetWidgetSize(m_temperatureWidget);
            resetWidgetSize(m_cameraWidget);
        });

        menu.exec(resizeButton->mapToGlobal(QPoint(0, -menu.sizeHint().height())));
    });

    // --- Assemblage de la barre ---
    layout->addWidget(activeLabel);
    layout->addWidget(m_activeValueLabel);
    layout->addWidget(makePipe());
    layout->addWidget(m_alarmValueLabel);
    layout->addWidget(makePipe());
    layout->addWidget(m_warningValueLabel);
    layout->addWidget(makePipe());
    layout->addWidget(m_defaultValueLabel);
    layout->addWidget(makePipe());
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

void DashboardWindow::updateBottomStatus()
{
    // Recompte les capteurs visibles et leurs niveaux d'alerte.
    int activeCount = 0;
    int alarms = 0;
    int warnings = 0;
    const int defaults = 0;

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

    if (m_cameraWidget && m_cameraWidget->isVisible())
        ++activeCount;

    if (m_activeValueLabel)
        m_activeValueLabel->setText(QString::number(activeCount));
    if (m_alarmValueLabel)
        m_alarmValueLabel->setText(QStringLiteral("%1  Alarme").arg(alarms));
    if (m_warningValueLabel)
        m_warningValueLabel->setText(QStringLiteral("%1  Avertissements").arg(warnings));
    if (m_defaultValueLabel)
        m_defaultValueLabel->setText(QStringLiteral("%1  Défaut").arg(defaults));
}

// =====================================================================
//  DÉPLACEMENT DE LA FENÊTRE SANS BORDURE
// =====================================================================
void DashboardWindow::mousePressEvent(QMouseEvent *event)
{
    // Un clic gauche dans la zone haute (barre de titre) déclenche le
    // déplacement de la fenêtre.
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

void DashboardWindow::resizeEvent(QResizeEvent *event)
{
    QWidget::resizeEvent(event);
    // L'écran de verrouillage doit toujours couvrir toute la fenêtre.
    if (m_lockOverlay)
        m_lockOverlay->setGeometry(0, 0, width(), height());
}

void DashboardWindow::showEvent(QShowEvent *event)
{
    QWidget::showEvent(event);
    // Tant que personne n'est authentifié, le verrouillage reste affiché.
    if (m_lockOverlay && !m_isAuthenticated) {
        m_lockOverlay->setGeometry(0, 0, width(), height());
        m_lockOverlay->show();
        m_lockOverlay->raise();
        m_lockOverlay->activateWindow();
    }
}

// =====================================================================
//  RÉSEAU : SCAN ET CONNEXION DES RASPBERRY PI
// =====================================================================
void DashboardWindow::setupNetworkFeatures()
{
    const QString localIp = ArpScanner::getLocalIpAddress();
    const QString subnet  = ArpScanner::getLocalSubnet();

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
    if (dialog.exec() == QDialog::Accepted)
        onDevicesConnected(dialog.selectedDevices());
}

void DashboardWindow::onDevicesConnected(const QVector<NetworkDevice> &devices)
{
    m_connectedDevices = devices;

    QStringList deviceNames;
    const int xOffset = 15;
    int yOffset = 15;

    // Pour chaque Raspberry Pi connecté, on crée le widget correspondant
    // à son type de capteur, on le positionne et on branche ses boutons.
    for (const auto &device : devices) {
        deviceNames.append(QStringLiteral("%1 (%2)")
                               .arg(device.ipAddress, device.deviceType));

        QWidget *newWidget = nullptr;
        const QString cleanType = device.deviceType.trimmed();

        if (cleanType.contains(QStringLiteral("Temperature"), Qt::CaseInsensitive) ||
            cleanType.contains(QStringLiteral("DHT"), Qt::CaseInsensitive)) {

            auto *tempWidget = new TemperatureWidget(m_sensorContainer);
            tempWidget->move(xOffset, yOffset);
            tempWidget->resize(260, 180);
            yOffset += 195;

            m_temperatureWidget = tempWidget;
            newWidget = tempWidget;

            connect(tempWidget->closeButton(), &QPushButton::clicked,
                    this, [this, tempWidget]() {
                        tempWidget->hide();
                        updateBottomStatus();
                    });
            connect(tempWidget->editButton(), &QPushButton::clicked,
                    this, &DashboardWindow::onTempWidgetEdit);
        }
        else if (cleanType.contains(QStringLiteral("Smoke"), Qt::CaseInsensitive) ||
                 cleanType.contains(QStringLiteral("MQ-2"), Qt::CaseInsensitive) ||
                 cleanType.contains(QStringLiteral("Fumée"), Qt::CaseInsensitive) ||
                 cleanType.contains(QStringLiteral("AirQuality"), Qt::CaseInsensitive)) {

            auto *smokeWidget = new SmokeSensorWidget(m_sensorContainer);
            smokeWidget->move(xOffset, yOffset);
            smokeWidget->resize(260, 180);
            yOffset += 195;

            m_smokeWidget = smokeWidget;
            newWidget = smokeWidget;

            connect(smokeWidget->closeButton(), &QPushButton::clicked,
                    this, [this, smokeWidget]() {
                        smokeWidget->hide();
                        updateBottomStatus();
                    });
            connect(smokeWidget->editButton(), &QPushButton::clicked,
                    this, &DashboardWindow::onSmokeWidgetEdit);
        }
        else if (cleanType.contains(QStringLiteral("Camera"), Qt::CaseInsensitive) ||
                 cleanType.contains(QStringLiteral("Cam"), Qt::CaseInsensitive)) {

            auto *camWidget = new CameraWidget(m_sensorContainer);
            camWidget->move(295, 15);
            camWidget->resize(320, 240);
            camWidget->setStreamUrl(QStringLiteral("rtsp://%1:8554/cam").arg(device.ipAddress));

            m_cameraWidget = camWidget;
            newWidget = camWidget;

            connect(camWidget->closeButton(), &QPushButton::clicked,
                    this, [this, camWidget]() {
                        camWidget->hide();
                        updateBottomStatus();
                    });
            connect(camWidget->editButton(), &QPushButton::clicked,
                    this, &DashboardWindow::onCameraWidgetEdit);
        }

        if (newWidget) {
            enableWidgetDragging(newWidget);
            newWidget->show();
        }
    }

    if (!devices.isEmpty()) {
        QMessageBox::information(this,
                                 QStringLiteral("Modules Connectés"),
                                 QStringLiteral("%1 module(s) connecté(s):\n\n%2")
                                     .arg(devices.size())
                                     .arg(deviceNames.join(QStringLiteral("\n"))));

        updateConnectedDevicesStatus();
        updateBottomStatus();

        // Les widgets existent : on peut se connecter au broker MQTT.
        if (m_mqttClient && !m_mqttClient->isConnected()) {
            qDebug() << "MQTT: connexion à" << kBrokerHost << ":" << kBrokerPort;
            m_mqttClient->connectToBroker(kBrokerHost, kBrokerPort, true);
        }
    }
}

void DashboardWindow::updateConnectedDevicesStatus()
{
    if (!m_networkStatusLabel)
        return;

    const int moduleCount = m_connectedDevices.size();
    const QString localIp = ArpScanner::getLocalIpAddress();
    const QString subnet  = ArpScanner::getLocalSubnet();

    if (moduleCount > 0) {
        m_networkStatusLabel->setText(
            QStringLiteral(" %1 | %2 |  %3 module(s)")
                .arg(localIp, subnet).arg(moduleCount));
    } else {
        m_networkStatusLabel->setText(
            QStringLiteral(" %1 | %2").arg(localIp, subnet));
    }
}

// =====================================================================
//  ÉDITION DES WIDGETS CAPTEURS
// =====================================================================
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
        const WidgetConfig newConfig = editor.getConfig();
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
        const WidgetConfig newConfig = editor.getConfig();
        m_temperatureWidget->setTitle(newConfig.name);
        QMessageBox::information(this,
                                 QStringLiteral("Widget modifié"),
                                 QStringLiteral("Nouveau nom: %1\nType: %2")
                                     .arg(newConfig.name, newConfig.type));
    }
}

void DashboardWindow::onCameraWidgetEdit()
{
    // Éditeur en mode caméra : pas de seuils d'alarme ni d'unité.
    WidgetConfig config;
    config.id = QStringLiteral("cam-001");
    config.name = m_cameraWidget->windowTitle().isEmpty()
                      ? QStringLiteral("Caméra Salle Serveur")
                      : m_cameraWidget->windowTitle();
    config.type = QStringLiteral("Caméra");
    config.warningThreshold = 0;
    config.alarmThreshold = 0;
    config.unit = QString();

    WidgetEditor editor(config, this, /*cameraMode=*/true);
    if (editor.exec() == QDialog::Accepted) {
        const WidgetConfig newConfig = editor.getConfig();
        m_cameraWidget->setTitle(newConfig.name);
        QMessageBox::information(this,
                                 QStringLiteral("Caméra modifiée"),
                                 QStringLiteral("Nouveau nom: %1")
                                     .arg(newConfig.name));
    }
}

void DashboardWindow::openModuleManager()
{
    ModuleManager manager(this);
    manager.exec();
}

// =====================================================================
//  AJOUT MANUEL DE CAPTEURS (bouton ➕)
// =====================================================================
void DashboardWindow::onAddSensor()
{
    AddSensorDialog dialog(this);
    if (dialog.exec() != QDialog::Accepted)
        return;

    const SensorConfig config = dialog.getSensorConfig();

    QWidget *newWidget = nullptr;

    // Branche le bouton ✎ d'un capteur dynamique sur l'éditeur de widget.
    auto connectEditButton = [this, config](QPushButton *editBtn, auto *sensorWidget) {
        connect(editBtn, &QPushButton::clicked, this, [this, config, sensorWidget]() {
            WidgetConfig wc;
            wc.id = config.id;
            wc.name = config.name;
            wc.type = SensorFactory::sensorTypeToString(config.type);
            wc.warningThreshold = config.warningThreshold;
            wc.alarmThreshold = config.alarmThreshold;
            wc.unit = config.unit;

            WidgetEditor editor(wc, this);
            if (editor.exec() == QDialog::Accepted)
                sensorWidget->setTitle(editor.getConfig().name);
        });
    };

    // Branche le bouton ✕ d'un capteur dynamique (masquer le widget).
    auto connectCloseButton = [this](QPushButton *closeBtn, QWidget *sensorWidget) {
        connect(closeBtn, &QPushButton::clicked, this, [this, sensorWidget]() {
            sensorWidget->hide();
            updateBottomStatus();
        });
    };

    switch (config.type) {
    case SensorType::Smoke: {
        auto *widget = SensorFactory::createSmokeSensor(this, config.name);
        connectEditButton(widget->editButton(), widget);
        connectCloseButton(widget->closeButton(), widget);
        newWidget = widget;
        break;
    }
    case SensorType::Temperature: {
        auto *widget = SensorFactory::createTemperatureSensor(this, config.name);
        connectEditButton(widget->editButton(), widget);
        connectCloseButton(widget->closeButton(), widget);
        newWidget = widget;
        break;
    }
    case SensorType::Camera: {
        auto *widget = SensorFactory::createCamera(this, config.name);
        connectCloseButton(widget->closeButton(), widget);
        newWidget = widget;
        break;
    }
    default:
        QMessageBox::warning(this, QStringLiteral("Non supporté"),
                             QStringLiteral("Ce type de capteur n'est pas encore supporté."));
        return;
    }

    addSensorToGrid(newWidget);

    QMessageBox::information(this, QStringLiteral("Capteur ajouté"),
                             QStringLiteral("Le capteur '%1' a été ajouté au dashboard.")
                                 .arg(config.name));
}

void DashboardWindow::addSensorToGrid(QWidget *widget)
{
    if (!m_sensorContainer || !widget)
        return;

    // Positionnement automatique : 3 widgets par ligne.
    const int x = 20 + (m_dynamicSensors.size() % 3) * 370;
    const int y = 20 + (m_dynamicSensors.size() / 3) * 270;

    widget->setParent(m_sensorContainer);
    widget->move(x, y);
    widget->resize(350, 250);

    enableWidgetDragging(widget);
    m_dynamicSensors.append(widget);

    widget->show();
}

// =====================================================================
//  TAILLE ET DÉPLACEMENT DES WIDGETS CAPTEURS
// =====================================================================
void DashboardWindow::setWidgetSize(QWidget *widget, const QSize &size)
{
    if (!widget)
        return;

    // Taille figée : minimum = maximum.
    widget->setMinimumSize(size);
    widget->setMaximumSize(size);

    if (m_sensorContainer)
        m_sensorContainer->adjustSize();
}

void DashboardWindow::resetWidgetSize(QWidget *widget)
{
    if (!widget)
        return;

    // Retour au dimensionnement automatique.
    widget->setMinimumSize(0, 0);
    widget->setMaximumSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX);

    if (m_sensorContainer)
        m_sensorContainer->adjustSize();
}

void DashboardWindow::enableWidgetDragging(QWidget *widget)
{
    if (!widget)
        return;

    // L'event filter (ci-dessous) intercepte les clics sur le widget pour
    // gérer le glisser-déposer et le redimensionnement par les coins.
    widget->installEventFilter(this);
    widget->setCursor(Qt::OpenHandCursor);
}

bool DashboardWindow::eventFilter(QObject *watched, QEvent *event)
{
    // Variables statiques : un seul widget peut être déplacé ou
    // redimensionné à la fois, on mémorise lequel et depuis où.
    static QWidget *draggedWidget = nullptr;
    static QWidget *resizedWidget = nullptr;
    static int resizeCorner = 0; // 1=bas-droit, 2=bas-gauche, 3=haut-droit, 4=haut-gauche
    static QPoint dragStartPos;
    static QPoint widgetStartPos;
    static QSize widgetStartSize;

    // On ne traite que nos widgets capteurs.
    QWidget *widget = qobject_cast<QWidget *>(watched);
    if (!widget || (widget != m_smokeWidget && widget != m_temperatureWidget &&
                    widget != m_cameraWidget && !m_dynamicSensors.contains(widget))) {
        return QWidget::eventFilter(watched, event);
    }

    switch (event->type()) {
    case QEvent::MouseButtonPress: {
        auto *mouseEvent = static_cast<QMouseEvent *>(event);
        if (mouseEvent->button() == Qt::LeftButton) {
            const QPoint pos = mouseEvent->pos();
            const int w = widget->width();
            const int h = widget->height();

            // Zone de 15 px près de chaque bord = poignée de redimensionnement
            const bool nearRight  = pos.x() >= w - 15;
            const bool nearLeft   = pos.x() <= 15;
            const bool nearBottom = pos.y() >= h - 15;
            const bool nearTop    = pos.y() <= 15;

            if (nearRight && nearBottom) {
                resizedWidget = widget;
                resizeCorner = 1;
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeFDiagCursor);
                return true;
            } else if (nearLeft && nearBottom) {
                resizedWidget = widget;
                resizeCorner = 2;
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartPos = widget->pos();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeBDiagCursor);
                return true;
            } else if (nearRight && nearTop) {
                resizedWidget = widget;
                resizeCorner = 3;
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartPos = widget->pos();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeBDiagCursor);
                return true;
            } else if (nearLeft && nearTop) {
                resizedWidget = widget;
                resizeCorner = 4;
                dragStartPos = mouseEvent->globalPosition().toPoint();
                widgetStartPos = widget->pos();
                widgetStartSize = widget->size();
                widget->setCursor(Qt::SizeFDiagCursor);
                return true;
            }
            // Clic dans la zone haute (40 px) = déplacement du widget
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
        auto *mouseEvent = static_cast<QMouseEvent *>(event);
        const QPoint pos = mouseEvent->pos();
        const int w = widget->width();
        const int h = widget->height();

        // Adapter le curseur à la zone survolée
        if (draggedWidget != widget && resizedWidget != widget) {
            const bool nearRight  = pos.x() >= w - 15;
            const bool nearLeft   = pos.x() <= 15;
            const bool nearBottom = pos.y() >= h - 15;
            const bool nearTop    = pos.y() <= 15;

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

        // --- Déplacement en cours ---
        if (draggedWidget == widget) {
            const QPoint delta = mouseEvent->globalPosition().toPoint() - dragStartPos;
            QPoint newPos = widgetStartPos + delta;

            // Rester dans les limites du conteneur
            if (m_sensorContainer) {
                newPos.setX(qMax(0, qMin(newPos.x(),
                                         m_sensorContainer->width() - widget->width())));
                newPos.setY(qMax(0, qMin(newPos.y(),
                                         m_sensorContainer->height() - widget->height())));
            }

            widget->move(newPos);
            return true;
        }

        // --- Redimensionnement en cours ---
        if (resizedWidget == widget) {
            const QPoint delta = mouseEvent->globalPosition().toPoint() - dragStartPos;
            int newW = widgetStartSize.width();
            int newH = widgetStartSize.height();
            int newX = widgetStartPos.x();
            int newY = widgetStartPos.y();

            switch (resizeCorner) {
            case 1: // bas-droit
                newW = widgetStartSize.width() + delta.x();
                newH = widgetStartSize.height() + delta.y();
                break;
            case 2: // bas-gauche
                newW = widgetStartSize.width() - delta.x();
                newH = widgetStartSize.height() + delta.y();
                newX = widgetStartPos.x() + delta.x();
                break;
            case 3: // haut-droit
                newW = widgetStartSize.width() + delta.x();
                newH = widgetStartSize.height() - delta.y();
                newY = widgetStartPos.y() + delta.y();
                break;
            case 4: // haut-gauche
                newW = widgetStartSize.width() - delta.x();
                newH = widgetStartSize.height() - delta.y();
                newX = widgetStartPos.x() + delta.x();
                newY = widgetStartPos.y() + delta.y();
                break;
            }

            // Taille minimale puis maximale (limites du conteneur)
            newW = qMax(200, newW);
            newH = qMax(150, newH);
            if (m_sensorContainer) {
                newW = qMin(m_sensorContainer->width() - newX, newW);
                newH = qMin(m_sensorContainer->height() - newY, newH);
            }

            widget->resize(newW, newH);
            if (resizeCorner >= 2)
                widget->move(newX, newY);
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

// =====================================================================
//  AUTHENTIFICATION ET ÉCRAN DE VERROUILLAGE
// =====================================================================
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

    createLockOverlay();
    setWidgetsEnabled(false);

    QTimer::singleShot(100, this, &DashboardWindow::showLoginDialog);
}

void DashboardWindow::createLockOverlay()
{
    // Voile sombre couvrant tout le dashboard, avec la carte de connexion
    // au centre. Il est affiché tant que personne n'est authentifié.
    m_lockOverlay = new QWidget(this);
    m_lockOverlay->setObjectName(QStringLiteral("lockOverlay"));
    m_lockOverlay->setAttribute(Qt::WA_StyledBackground, true);
    m_lockOverlay->setAutoFillBackground(true);
    m_lockOverlay->setFocusPolicy(Qt::StrongFocus);
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

    // --- Carte de connexion ---
    auto *card = new QFrame(m_lockOverlay);
    card->setObjectName(QStringLiteral("loginCard"));
    card->setFixedWidth(400);

    auto *cardLayout = new QVBoxLayout(card);
    cardLayout->setContentsMargins(40, 38, 40, 34);
    cardLayout->setSpacing(16);

    auto *lockIcon = new QLabel(QStringLiteral("🔒"), card);
    lockIcon->setStyleSheet("font-size: 40px;");
    lockIcon->setAlignment(Qt::AlignCenter);
    cardLayout->addWidget(lockIcon);

    auto *titleLbl = new QLabel(QStringLiteral("Système de Surveillance"), card);
    titleLbl->setStyleSheet("font-size: 20px; font-weight: 700; color: #4a90d9;");
    titleLbl->setAlignment(Qt::AlignCenter);
    cardLayout->addWidget(titleLbl);

    auto *subLbl = new QLabel(QStringLiteral("Authentification requise"), card);
    subLbl->setStyleSheet("font-size: 12px; color: #3a5070; margin-bottom: 6px;");
    subLbl->setAlignment(Qt::AlignCenter);
    cardLayout->addWidget(subLbl);

    auto *sep = new QFrame(card);
    sep->setFrameShape(QFrame::HLine);
    sep->setStyleSheet("background: #2d3f6a; max-height: 1px; border: none;");
    cardLayout->addWidget(sep);

    // Zone d'erreur (masquée tant qu'il n'y a pas d'échec de connexion)
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

    // Champs identifiant / mot de passe
    auto *userLbl = new QLabel(QStringLiteral("Identifiant"), card);
    userLbl->setStyleSheet("font-size: 12px; font-weight: 600; color: #7ec8e3;");
    cardLayout->addWidget(userLbl);

    auto *usernameEdit = new QLineEdit(card);
    usernameEdit->setPlaceholderText(QStringLiteral("admin · operateur · visiteur"));
    usernameEdit->setFixedHeight(42);
    cardLayout->addWidget(usernameEdit);

    auto *passLbl = new QLabel(QStringLiteral("Mot de passe"), card);
    passLbl->setStyleSheet("font-size: 12px; font-weight: 600; color: #7ec8e3;");
    cardLayout->addWidget(passLbl);

    auto *passwordEdit = new QLineEdit(card);
    passwordEdit->setEchoMode(QLineEdit::Password);
    passwordEdit->setPlaceholderText(QStringLiteral("Votre mot de passe…"));
    passwordEdit->setFixedHeight(42);
    cardLayout->addWidget(passwordEdit);

    cardLayout->addSpacing(4);

    auto *loginBtn = new QPushButton(QStringLiteral("Se connecter"), card);
    loginBtn->setObjectName(QStringLiteral("loginBtn"));
    loginBtn->setFixedHeight(46);
    loginBtn->setEnabled(false);
    cardLayout->addWidget(loginBtn);

    auto *quitBtn = new QPushButton(QStringLiteral("Quitter l'application"), card);
    quitBtn->setObjectName(QStringLiteral("quitBtn"));
    quitBtn->setFixedHeight(38);
    cardLayout->addWidget(quitBtn);

    overlayLayout->addWidget(card);

    // --- Connexions ---
    // Le bouton "Se connecter" n'est actif que si les deux champs sont remplis.
    auto updateLoginButton = [loginBtn, usernameEdit, passwordEdit]() {
        loginBtn->setEnabled(
            !usernameEdit->text().trimmed().isEmpty() &&
            !passwordEdit->text().isEmpty());
    };
    connect(usernameEdit, &QLineEdit::textChanged, loginBtn, updateLoginButton);
    connect(passwordEdit, &QLineEdit::textChanged, loginBtn, updateLoginButton);

    auto doLogin = [this, usernameEdit, passwordEdit, errorLabel]() {
        errorLabel->hide();

        // Connexion "à usage unique" : si l'authentification échoue,
        // le message d'erreur s'affiche, puis la connexion se détruit.
        connect(m_dbManager, &DatabaseManager::authenticationFailed,
                errorLabel, [errorLabel](const QString &msg) {
                    errorLabel->setText(QStringLiteral("⚠  %1").arg(msg));
                    errorLabel->show();
                }, Qt::SingleShotConnection);

        m_dbManager->authenticateUser(usernameEdit->text().trimmed(),
                                      passwordEdit->text());
    };

    connect(loginBtn, &QPushButton::clicked, this, doLogin);
    connect(passwordEdit, &QLineEdit::returnPressed, this, doLogin);
    connect(quitBtn, &QPushButton::clicked, this, &DashboardWindow::close);

    m_lockOverlay->setGeometry(0, 0, width(), height());
    m_lockOverlay->show();
    m_lockOverlay->raise();
    m_lockOverlay->ensurePolished();
}

void DashboardWindow::showLoginDialog()
{
    if (m_lockOverlay) {
        m_lockOverlay->setGeometry(0, 0, width(), height());
        m_lockOverlay->show();
        m_lockOverlay->raise();
        m_lockOverlay->activateWindow();
        m_lockOverlay->repaint();
    }
}

void DashboardWindow::onUserAuthenticated(const User &user)
{
    m_currentUser = user;
    m_isAuthenticated = true;

    m_userStatusLabel->setText(QStringLiteral("%1 (%2)")
                                   .arg(user.username, user.getRoleString()));

    updateUIBasedOnRole();
    setWidgetsEnabled(true);

    if (m_lockOverlay)
        m_lockOverlay->hide();

    QMessageBox::information(this,
                             QStringLiteral("Bienvenue"),
                             QStringLiteral("Connecté en tant que %1\nRôle: %2")
                                 .arg(user.fullName.isEmpty() ? user.username : user.fullName,
                                      user.getRoleString()));
}

void DashboardWindow::updateUIBasedOnRole()
{
    if (!m_isAuthenticated)
        return;

    // Seuls Admin et Opérateur peuvent éditer les widgets.
    const bool canEdit = m_currentUser.canEditWidgets();

    if (m_smokeWidget)
        m_smokeWidget->editButton()->setVisible(canEdit);
    if (m_temperatureWidget)
        m_temperatureWidget->editButton()->setVisible(canEdit);
    if (m_cameraWidget)
        m_cameraWidget->editButton()->setVisible(canEdit);
}

void DashboardWindow::setWidgetsEnabled(bool enabled)
{
    if (m_smokeWidget)
        m_smokeWidget->setEnabled(enabled);
    if (m_temperatureWidget)
        m_temperatureWidget->setEnabled(enabled);
    if (m_cameraWidget)
        m_cameraWidget->setEnabled(enabled);
    if (m_scanNetworkButton)
        m_scanNetworkButton->setEnabled(enabled);
    for (auto *sensor : std::as_const(m_dynamicSensors)) {
        if (sensor)
            sensor->setEnabled(enabled);
    }
}

// =====================================================================
//  CONFIGURATION MQTT (certificats + connexions de signaux)
// =====================================================================
void DashboardWindow::setupMqtt()
{
    if (m_mqttClient)
        return;

    m_mqttClient = new MqttClient(this);

    // Chargement des certificats mTLS depuis le dossier du dépôt.
    const QString certDir = MqttClient::findCertificateDirectory();
    qDebug() << "MQTT: dossier des certificats:" << certDir;

    m_mqttClient->setCaCertificate(certDir + QStringLiteral("ca.crt"));
    m_mqttClient->setClientCertificate(certDir + QStringLiteral("admin-console.crt"),
                                       certDir + QStringLiteral("admin-console.key"));

    // Tout ce que le client MQTT décode est relié ici au dashboard.
    connect(m_mqttClient, &MqttClient::connected,
            this, &DashboardWindow::onMqttConnected);
    connect(m_mqttClient, &MqttClient::disconnected,
            this, &DashboardWindow::onMqttDisconnected);
    connect(m_mqttClient, &MqttClient::error,
            this, &DashboardWindow::onMqttError);
    connect(m_mqttClient, &MqttClient::temperatureReceived,
            this, &DashboardWindow::onMqttTemperatureReceived);
    connect(m_mqttClient, &MqttClient::smokeReceived,
            this, &DashboardWindow::onMqttSmokeReceived);
    connect(m_mqttClient, &MqttClient::gasDataReceived,
            this, &DashboardWindow::onMqttGasReceived);
}

void DashboardWindow::onMqttConnected()
{
    qDebug() << "MQTT: connecté au broker";

    // Abonnement aux topics des capteurs enregistrés en base...
    const QVector<Sensor> sensors = m_dbManager->getAllSensors();
    for (const Sensor &sensor : sensors) {
        if (!sensor.topic.isEmpty()) {
            m_mqttClient->subscribe(sensor.topic);
            qDebug() << "MQTT: abonné au capteur" << sensor.id
                     << "(" << sensor.type << ") sur le topic:" << sensor.topic;
        }
    }

    // ... et aux topics connus des 3 Raspberry Pi (au cas où la base
    // ne contiendrait pas encore les capteurs).
    m_mqttClient->subscribe(QStringLiteral("rpi-001/sensors/temperature"));
    m_mqttClient->subscribe(QStringLiteral("rpi-002/sensors/camera"));
    m_mqttClient->subscribe(QStringLiteral("rpi-003/sensors/smoke"));

    if (m_networkStatusLabel)
        m_networkStatusLabel->setText(m_networkStatusLabel->text() + QStringLiteral(" | MQTT ✓"));
}

void DashboardWindow::onMqttDisconnected()
{
    qDebug() << "MQTT: déconnecté du broker";

    if (m_networkStatusLabel) {
        QString text = m_networkStatusLabel->text();
        text.remove(QStringLiteral(" | MQTT ✓"));
        m_networkStatusLabel->setText(text + QStringLiteral(" | MQTT ✗"));
    }
}

void DashboardWindow::onMqttError(const QString &error)
{
    qWarning() << "MQTT: erreur:" << error;

    if (m_networkStatusLabel) {
        QString text = m_networkStatusLabel->text();
        text.remove(QStringLiteral(" | MQTT ✓"));
        m_networkStatusLabel->setText(text + QStringLiteral(" | MQTT ✗"));
    }
}

// =====================================================================
//  RÉCEPTION DES DONNÉES CAPTEURS (MQTT -> BDD + affichage)
// =====================================================================
void DashboardWindow::onMqttTemperatureReceived(double temperature, double humidity, const QString &sensorId)
{
    qDebug() << "MQTT: température reçue:" << temperature << "°C, humidité:"
             << humidity << "%, capteur:" << sensorId;

    const QString sid = sensorId.isEmpty() ? kDefaultTempSensorId : sensorId;

    // 1. Sauvegarde dans l'historique BDD
    if (m_dbManager)
        m_dbManager->saveTemperatureReading(sid, temperature, humidity);

    // 2. Mise à jour de l'affichage
    if (m_temperatureWidget)
        m_temperatureWidget->updateFromMqtt(temperature, humidity);
}

void DashboardWindow::onMqttSmokeReceived(int smokeLevel, const QString &sensorId)
{
    qDebug() << "MQTT: niveau de fumée reçu:" << smokeLevel << ", capteur:" << sensorId;

    const QString sid = sensorId.isEmpty() ? kDefaultSmokeSensorId : sensorId;

    if (m_dbManager)
        m_dbManager->saveSmokeReading(sid, smokeLevel);

    if (m_smokeWidget)
        m_smokeWidget->updateFromMqtt(smokeLevel);
}

void DashboardWindow::onMqttGasReceived(int eco2Ppm, int tvocPpb, bool smokeDetected, const QString &sensorId)
{
    qDebug() << "MQTT: gaz reçu: eCO2" << eco2Ppm << "ppm, TVOC" << tvocPpb
             << "ppb, fumée:" << smokeDetected << ", capteur:" << sensorId;

    const QString sid = sensorId.isEmpty() ? kDefaultSmokeSensorId : sensorId;

    if (m_dbManager)
        m_dbManager->saveGasReading(sid, eco2Ppm, tvocPpb, smokeDetected);

    if (m_smokeWidget)
        m_smokeWidget->updateFromGasData(eco2Ppm, tvocPpb, smokeDetected);
}

// =====================================================================
//  RAFRAÎCHISSEMENT DEPUIS LA BASE DE DONNÉES
// =====================================================================
void DashboardWindow::setupDataRefreshTimer()
{
    // Relit les dernières mesures stockées en base toutes les 2 secondes :
    // utile quand les données sont insérées par un autre client MQTT.
    m_dataRefreshTimer = new QTimer(this);
    connect(m_dataRefreshTimer, &QTimer::timeout,
            this, &DashboardWindow::refreshFromDatabase);
    m_dataRefreshTimer->start(2000);
}

void DashboardWindow::refreshFromDatabase()
{
    if (!m_dbManager || !m_dbManager->isInitialized())
        return;

    // Dernière température connue (getLatestTemperature renvoie -999
    // s'il n'y a aucune mesure).
    const double temp     = m_dbManager->getLatestTemperature(kDefaultTempSensorId);
    const double humidity = m_dbManager->getLatestHumidity(kDefaultTempSensorId);
    if (temp > -100 && m_temperatureWidget)
        m_temperatureWidget->updateFromMqtt(temp, humidity);

    // Dernier niveau de fumée connu (-1 = aucune mesure).
    const int smoke = m_dbManager->getLatestSmokeLevel(kDefaultSmokeSensorId);
    if (smoke >= 0 && m_smokeWidget)
        m_smokeWidget->updateFromMqtt(smoke);
}
