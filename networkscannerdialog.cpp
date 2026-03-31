#include "networkscannerdialog.h"

#include <QCheckBox>
#include <QDialogButtonBox>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QHeaderView>
#include <QLabel>
#include <QListWidget>
#include <QMessageBox>
#include <QProgressBar>
#include <QPushButton>
#include <QSplitter>
#include <QVBoxLayout>

NetworkScannerDialog::NetworkScannerDialog(QWidget *parent)
    : QDialog(parent)
    , m_arpScanner(new ArpScanner(this))
    , m_deviceList(nullptr)
    , m_progressBar(nullptr)
    , m_scanButton(nullptr)
    , m_connectButton(nullptr)
    , m_selectAllButton(nullptr)
    , m_deselectAllButton(nullptr)
    , m_statusLabel(nullptr)
    , m_subnetLabel(nullptr)
    , m_surveillanceModuleCount(0)
{
    setWindowTitle(QStringLiteral("Scanner Réseau - Détection Automatique"));
    setMinimumSize(700, 500);
    setupUi();

    connect(m_arpScanner, &ArpScanner::deviceFound,
            this, &NetworkScannerDialog::onDeviceFound);
    connect(m_arpScanner, &ArpScanner::scanProgress,
            this, &NetworkScannerDialog::onScanProgress);
    connect(m_arpScanner, &ArpScanner::scanFinished,
            this, &NetworkScannerDialog::onScanFinished);
    connect(m_arpScanner, &ArpScanner::scanError,
            this, &NetworkScannerDialog::onScanError);

    QString subnet = ArpScanner::getLocalSubnet();
    if (!subnet.isEmpty()) {
        m_subnetLabel->setText(QStringLiteral("Sous-réseau détecté: %1").arg(subnet));
    }
}

NetworkScannerDialog::~NetworkScannerDialog() = default;

void NetworkScannerDialog::setupUi()
{
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setSpacing(15);
    mainLayout->setContentsMargins(20, 20, 20, 20);

    setStyleSheet(
        "QDialog { background: #1a1a2e; }"
        "QLabel { color: #eee; font-size: 13px; }"
        "QPushButton {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #4a90d9, stop:1 #357abd);"
        "  color: white; border: none; border-radius: 6px; padding: 10px 20px;"
        "  font-size: 13px; font-weight: 600;"
        "}"
        "QPushButton:hover { background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #5aa0e9, stop:1 #458acd); }"
        "QPushButton:disabled { background: #555; color: #888; }"
        "QPushButton#secondary {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #6c757d, stop:1 #5a6268);"
        "}"
        "QPushButton#secondary:hover {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #7d8790, stop:1 #6b7379);"
        "}"
        "QListWidget {"
        "  background: #16213e; border: 1px solid #2d3a5c; border-radius: 8px;"
        "  color: #eee; font-size: 13px; padding: 10px;"
        "}"
        "QListWidget::item { padding: 12px; border-bottom: 1px solid #2d3a5c; }"
        "QListWidget::item:selected { background: #4a90d9; }"
        "QListWidget::item:hover { background: #2d3a5c; }"
        "QProgressBar {"
        "  border: 1px solid #2d3a5c; border-radius: 4px; background: #16213e;"
        "  text-align: center; color: #eee;"
        "}"
        "QProgressBar::chunk {"
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #4a90d9, stop:1 #5aa0e9);"
        "  border-radius: 3px;"
        "}"
        "QGroupBox {"
        "  color: #4a90d9; font-weight: 600; font-size: 14px;"
        "  border: 1px solid #2d3a5c; border-radius: 8px; margin-top: 10px; padding-top: 10px;"
        "}"
        "QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 5px; }"
        "QCheckBox { color: #eee; font-size: 13px; spacing: 8px; }"
        "QCheckBox::indicator { width: 18px; height: 18px; }"
        );

    auto *headerLabel = new QLabel(QStringLiteral("🔍 Scanner les modules de surveillance sur le réseau"), this);
    headerLabel->setStyleSheet("font-size: 18px; font-weight: 700; color: #4a90d9; margin-bottom: 10px;");
    mainLayout->addWidget(headerLabel);

    auto *descLabel = new QLabel(
        QStringLiteral("Cet outil scanne votre réseau local pour détecter automatiquement "
                       "les modules de surveillance (caméras, capteurs, etc.) connectés."),
        this);
    descLabel->setWordWrap(true);
    descLabel->setStyleSheet("color: #aaa; margin-bottom: 10px;");
    mainLayout->addWidget(descLabel);

    m_subnetLabel = new QLabel(QStringLiteral("Sous-réseau: Détection..."), this);
    m_subnetLabel->setStyleSheet("color: #7ec8e3; font-weight: 600; padding: 8px; "
                                  "background: #0f3460; border-radius: 4px;");
    mainLayout->addWidget(m_subnetLabel);

    auto *progressLayout = new QHBoxLayout();
    m_progressBar = new QProgressBar(this);
    m_progressBar->setRange(0, 100);
    m_progressBar->setValue(0);
    m_progressBar->setTextVisible(true);
    m_progressBar->setFormat(QStringLiteral("%v/%m hôtes scannés"));
    m_progressBar->setMinimumHeight(25);
    progressLayout->addWidget(m_progressBar, 1);

    m_scanButton = new QPushButton(QStringLiteral("▶ Lancer le scan"), this);
    m_scanButton->setMinimumWidth(150);
    m_scanButton->setCursor(Qt::PointingHandCursor);
    connect(m_scanButton, &QPushButton::clicked, this, &NetworkScannerDialog::onScanClicked);
    progressLayout->addWidget(m_scanButton);
    mainLayout->addLayout(progressLayout);

    auto *listGroup = new QGroupBox(QStringLiteral("Appareils détectés"), this);
    auto *listLayout = new QVBoxLayout(listGroup);

    auto *listHeaderLayout = new QHBoxLayout();
    m_statusLabel = new QLabel(QStringLiteral("Aucun appareil détecté"), this);
    m_statusLabel->setStyleSheet("color: #aaa; font-style: italic;");
    listHeaderLayout->addWidget(m_statusLabel);
    listHeaderLayout->addStretch();

    m_selectAllButton = new QPushButton(QStringLiteral("Tout sélectionner"), this);
    m_selectAllButton->setObjectName(QStringLiteral("secondary"));
    m_selectAllButton->setEnabled(false);
    m_selectAllButton->setCursor(Qt::PointingHandCursor);
    connect(m_selectAllButton, &QPushButton::clicked, this, &NetworkScannerDialog::onSelectAllClicked);
    listHeaderLayout->addWidget(m_selectAllButton);

    m_deselectAllButton = new QPushButton(QStringLiteral("Tout désélectionner"), this);
    m_deselectAllButton->setObjectName(QStringLiteral("secondary"));
    m_deselectAllButton->setEnabled(false);
    m_deselectAllButton->setCursor(Qt::PointingHandCursor);
    connect(m_deselectAllButton, &QPushButton::clicked, this, &NetworkScannerDialog::onDeselectAllClicked);
    listHeaderLayout->addWidget(m_deselectAllButton);

    listLayout->addLayout(listHeaderLayout);

    m_deviceList = new QListWidget(this);
    m_deviceList->setSelectionMode(QAbstractItemView::NoSelection);
    m_deviceList->setSpacing(5);
    connect(m_deviceList, &QListWidget::itemChanged,
            this, &NetworkScannerDialog::onDeviceItemChanged);
    listLayout->addWidget(m_deviceList);

    mainLayout->addWidget(listGroup, 1);

    auto *buttonLayout = new QHBoxLayout();
    buttonLayout->addStretch();

    auto *cancelButton = new QPushButton(QStringLiteral("Annuler"), this);
    cancelButton->setObjectName(QStringLiteral("secondary"));
    cancelButton->setCursor(Qt::PointingHandCursor);
    connect(cancelButton, &QPushButton::clicked, this, &QDialog::reject);
    buttonLayout->addWidget(cancelButton);

    m_connectButton = new QPushButton(QStringLiteral("🔗 Connecter les modules sélectionnés"), this);
    m_connectButton->setEnabled(false);
    m_connectButton->setCursor(Qt::PointingHandCursor);
    m_connectButton->setMinimumWidth(250);
    connect(m_connectButton, &QPushButton::clicked, this, &NetworkScannerDialog::onConnectClicked);
    buttonLayout->addWidget(m_connectButton);

    mainLayout->addLayout(buttonLayout);
}

void NetworkScannerDialog::onScanClicked()
{
    if (m_arpScanner->isScanning()) {
        m_arpScanner->stopScan();
        m_scanButton->setText(QStringLiteral("▶ Lancer le scan"));
        m_scanButton->setStyleSheet(QString());
        return;
    }

    m_deviceList->clear();
    m_detectedDevices.clear();
    m_selectedDevices.clear();
    m_surveillanceModuleCount = 0;
    m_progressBar->setValue(0);
    m_connectButton->setEnabled(false);
    m_selectAllButton->setEnabled(false);
    m_deselectAllButton->setEnabled(false);

    m_scanButton->setText(QStringLiteral("⏹ Arrêter"));
    m_statusLabel->setText(QStringLiteral("Scan en cours..."));
    m_statusLabel->setStyleSheet("color: #f39c12; font-weight: 600;");

    m_arpScanner->startScan();
}

void NetworkScannerDialog::onConnectClicked()
{
    m_selectedDevices.clear();

    for (int i = 0; i < m_deviceList->count(); ++i) {
        QListWidgetItem *item = m_deviceList->item(i);
        if (item->checkState() == Qt::Checked) {
            int deviceIndex = item->data(Qt::UserRole).toInt();
            if (deviceIndex >= 0 && deviceIndex < m_detectedDevices.size()) {
                m_selectedDevices.append(m_detectedDevices[deviceIndex]);
            }
        }
    }

    if (m_selectedDevices.isEmpty()) {
        QMessageBox::warning(this,
                             QStringLiteral("Aucun module sélectionné"),
                             QStringLiteral("Veuillez sélectionner au moins un module à connecter."));
        return;
    }

    accept();
}

void NetworkScannerDialog::onDeviceFound(const NetworkDevice &device)
{
    if (!m_detectedDevices.contains(device)) {
        m_detectedDevices.append(device);
        addDeviceToList(device);

        if (device.deviceType.contains(QStringLiteral("Surveillance"), Qt::CaseInsensitive) ||
            device.deviceType.contains(QStringLiteral("Sensor"), Qt::CaseInsensitive) ||
            device.deviceType.contains(QStringLiteral("Camera"), Qt::CaseInsensitive)) {
            m_surveillanceModuleCount++;
        }
    }
}

void NetworkScannerDialog::onScanProgress(int current, int total)
{
    if (total > 0) {
        int percentage = (current * 100) / total;
        m_progressBar->setValue(percentage);
        m_progressBar->setFormat(QStringLiteral("%1/%2 hôtes scannés (%3%)").arg(current).arg(total).arg(percentage));
    }
}

void NetworkScannerDialog::onScanFinished(const QVector<NetworkDevice> &devices)
{
    m_scanButton->setText(QStringLiteral("▶ Relancer le scan"));
    m_progressBar->setValue(100);

    updateStatusLabel();

    m_selectAllButton->setEnabled(m_deviceList->count() > 0);
    m_deselectAllButton->setEnabled(m_deviceList->count() > 0);

    if (m_surveillanceModuleCount > 0) {
        onSelectAllClicked();
    }
}

void NetworkScannerDialog::onScanError(const QString &error)
{
    m_scanButton->setText(QStringLiteral("▶ Lancer le scan"));
    m_statusLabel->setText(QStringLiteral("Erreur: %1").arg(error));
    m_statusLabel->setStyleSheet("color: #e74c3c; font-weight: 600;");
    QMessageBox::critical(this, QStringLiteral("Erreur de scan"), error);
}

void NetworkScannerDialog::onDeviceItemChanged(QListWidgetItem *item)
{
    Q_UNUSED(item)

    int selectedCount = 0;
    for (int i = 0; i < m_deviceList->count(); ++i) {
        if (m_deviceList->item(i)->checkState() == Qt::Checked) {
            selectedCount++;
        }
    }

    m_connectButton->setEnabled(selectedCount > 0);
    if (selectedCount > 0) {
        m_connectButton->setText(QStringLiteral("🔗 Connecter %1 module(s)").arg(selectedCount));
    } else {
        m_connectButton->setText(QStringLiteral("🔗 Connecter les modules sélectionnés"));
    }
}

void NetworkScannerDialog::onSelectAllClicked()
{
    for (int i = 0; i < m_deviceList->count(); ++i) {
        QListWidgetItem *item = m_deviceList->item(i);
        item->setCheckState(Qt::Checked);
    }
}

void NetworkScannerDialog::onDeselectAllClicked()
{
    for (int i = 0; i < m_deviceList->count(); ++i) {
        QListWidgetItem *item = m_deviceList->item(i);
        item->setCheckState(Qt::Unchecked);
    }
}

void NetworkScannerDialog::updateStatusLabel()
{
    int total = m_detectedDevices.size();
    int surveillance = m_surveillanceModuleCount;

    if (total == 0) {
        m_statusLabel->setText(QStringLiteral("Aucun appareil détecté"));
        m_statusLabel->setStyleSheet("color: #aaa; font-style: italic;");
    } else if (surveillance > 0) {
        m_statusLabel->setText(QStringLiteral("✓ %1 appareil(s) détecté(s) dont %2 module(s) de surveillance")
                               .arg(total).arg(surveillance));
        m_statusLabel->setStyleSheet("color: #2ecc71; font-weight: 600;");
    } else {
        m_statusLabel->setText(QStringLiteral("%1 appareil(s) détecté(s) (aucun module de surveillance)")
                               .arg(total));
        m_statusLabel->setStyleSheet("color: #f39c12; font-weight: 600;");
    }
}

void NetworkScannerDialog::addDeviceToList(const NetworkDevice &device)
{
    auto *item = new QListWidgetItem();
    item->setText(formatDeviceInfo(device));
    item->setData(Qt::UserRole, m_detectedDevices.size() - 1);
    item->setFlags(item->flags() | Qt::ItemIsUserCheckable);

    bool isSurveillance = device.deviceType.contains(QStringLiteral("Surveillance"), Qt::CaseInsensitive) ||
                          device.deviceType.contains(QStringLiteral("Sensor"), Qt::CaseInsensitive) ||
                          device.deviceType.contains(QStringLiteral("Camera"), Qt::CaseInsensitive);

    item->setCheckState(isSurveillance ? Qt::Checked : Qt::Unchecked);

    QString icon = getSignalIcon(device.rssi);
    item->setText(QStringLiteral("%1 %2").arg(icon, formatDeviceInfo(device)));

    m_deviceList->addItem(item);
}

QString NetworkScannerDialog::formatDeviceInfo(const NetworkDevice &device) const
{
    QString info = QStringLiteral("%1 | %2 | %3").arg(device.ipAddress, device.macAddress, device.deviceType);

    if (!device.hostname.isEmpty() && device.hostname != QStringLiteral("Unknown")) {
        info += QStringLiteral(" (%1)").arg(device.hostname);
    }

    return info;
}

QString NetworkScannerDialog::getSignalIcon(int rssi) const
{
    if (rssi > -50) {
        return QStringLiteral("📶");
    } else if (rssi > -65) {
        return QStringLiteral("📶");
    } else if (rssi > -80) {
        return QStringLiteral("📶");
    } else {
        return QStringLiteral("📶");
    }
}

QVector<NetworkDevice> NetworkScannerDialog::selectedDevices() const
{
    return m_selectedDevices;
}
