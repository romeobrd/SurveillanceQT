#include "networkscannerdialog.h"

#include <QHBoxLayout>
#include <QGroupBox>
#include <QLabel>
#include <QListWidget>
#include <QMessageBox>
#include <QProgressBar>
#include <QPushButton>
#include <QVBoxLayout>

// =====================================================================
//  CONSTRUCTION
// =====================================================================
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
{
    setWindowTitle(QStringLiteral("Scanner Réseau - Raspberry Pi Dédiés"));
    setMinimumSize(600, 450);
    setupUi();

    // Le scanner remonte ses résultats par signaux.
    connect(m_arpScanner, &ArpScanner::deviceFound,
            this, &NetworkScannerDialog::onDeviceFound);
    connect(m_arpScanner, &ArpScanner::scanProgress,
            this, &NetworkScannerDialog::onScanProgress);
    connect(m_arpScanner, &ArpScanner::scanFinished,
            this, &NetworkScannerDialog::onScanFinished);
    connect(m_arpScanner, &ArpScanner::scanError,
            this, &NetworkScannerDialog::onScanError);

    m_subnetLabel->setText(QStringLiteral("Réseau privé: 200.26.16.0/24 | Gateway: 200.26.16.200"));

    displayKnownRaspberryPiList();
}

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
        );

    // --- En-tête explicatif ---
    auto *headerLabel = new QLabel(QStringLiteral("Scanner les modules de surveillance sur le réseau"), this);
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

    // --- Barre de progression + bouton de scan ---
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

    // --- Liste des appareils détectés ---
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

    // --- Boutons bas de page : annuler / connecter ---
    auto *buttonLayout = new QHBoxLayout();
    buttonLayout->addStretch();

    auto *cancelButton = new QPushButton(QStringLiteral("Annuler"), this);
    cancelButton->setObjectName(QStringLiteral("secondary"));
    cancelButton->setCursor(Qt::PointingHandCursor);
    connect(cancelButton, &QPushButton::clicked, this, &QDialog::reject);
    buttonLayout->addWidget(cancelButton);

    m_connectButton = new QPushButton(QStringLiteral(" Connecter les modules sélectionnés"), this);
    m_connectButton->setEnabled(false);
    m_connectButton->setCursor(Qt::PointingHandCursor);
    m_connectButton->setMinimumWidth(250);
    connect(m_connectButton, &QPushButton::clicked, this, &NetworkScannerDialog::onConnectClicked);
    buttonLayout->addWidget(m_connectButton);

    mainLayout->addLayout(buttonLayout);
}

// =====================================================================
//  GESTION DE LA LISTE DES APPAREILS
// =====================================================================
void NetworkScannerDialog::displayKnownRaspberryPiList()
{
    // Avant le scan, on affiche les 4 Raspberry Pi connus en grisé.
    const auto knownRpi = ArpScanner::getKnownRaspberryPiList();

    for (const auto &rpi : knownRpi) {
        auto *item = new QListWidgetItem();
        item->setText(QStringLiteral(" %1 | %2 | En attente de scan...")
                      .arg(rpi.name, rpi.ipAddress));
        item->setData(Qt::UserRole, rpi.ipAddress);
        item->setFlags(item->flags() | Qt::ItemIsUserCheckable);
        item->setCheckState(Qt::Unchecked);
        item->setForeground(QColor(150, 150, 150));

        m_deviceList->addItem(item);
    }
}

void NetworkScannerDialog::updateRaspberryPiInList(const NetworkDevice &device)
{
    // Retrouve la ligne du Raspberry Pi par son IP et met à jour son état.
    for (int i = 0; i < m_deviceList->count(); ++i) {
        QListWidgetItem *item = m_deviceList->item(i);
        if (item->data(Qt::UserRole).toString() != device.ipAddress)
            continue;

        const QString statusIcon = device.isOnline ? QStringLiteral("✅") : QStringLiteral("❌");
        const QString statusText = device.isOnline ? QStringLiteral("En ligne") : QStringLiteral("Hors ligne");

        item->setText(QStringLiteral("%1 %2 | %3 | %4 | %5")
                      .arg(statusIcon, device.hostname, device.ipAddress,
                           device.deviceType, statusText));

        if (device.isOnline) {
            item->setForeground(QColor(100, 255, 100));
            item->setCheckState(Qt::Checked);
        } else {
            item->setForeground(QColor(255, 100, 100));
            item->setCheckState(Qt::Unchecked);
        }
        return;
    }
}

void NetworkScannerDialog::updateStatusLabel()
{
    const int total = m_detectedDevices.size();

    if (total == 0) {
        m_statusLabel->setText(QStringLiteral("Aucun appareil détecté"));
        m_statusLabel->setStyleSheet("color: #aaa; font-style: italic;");
    } else {
        m_statusLabel->setText(QStringLiteral("✓ %1 module(s) de surveillance détecté(s)")
                               .arg(total));
        m_statusLabel->setStyleSheet("color: #2ecc71; font-weight: 600;");
    }
}

// =====================================================================
//  SLOTS DU SCAN
// =====================================================================
void NetworkScannerDialog::onScanClicked()
{
    // Deuxième clic pendant un scan = arrêt du scan.
    if (m_arpScanner->isScanning()) {
        m_arpScanner->stopScan();
        m_scanButton->setText(QStringLiteral("▶ Scanner les Raspberry Pi"));
        return;
    }

    // Remise à zéro de l'interface avant un nouveau scan
    m_deviceList->clear();
    m_detectedDevices.clear();
    m_selectedDevices.clear();
    m_progressBar->setValue(0);
    m_connectButton->setEnabled(false);
    m_selectAllButton->setEnabled(false);
    m_deselectAllButton->setEnabled(false);

    m_scanButton->setText(QStringLiteral("Arrêter"));
    m_statusLabel->setText(QStringLiteral("Scan des Raspberry Pi en cours..."));
    m_statusLabel->setStyleSheet("color: #f39c12; font-weight: 600;");

    displayKnownRaspberryPiList();
    m_arpScanner->startScanKnownDevices();
}

void NetworkScannerDialog::onDeviceFound(const NetworkDevice &device)
{
    if (!m_detectedDevices.contains(device)) {
        m_detectedDevices.append(device);
        updateRaspberryPiInList(device);
    }
}

void NetworkScannerDialog::onScanProgress(int current, int total)
{
    if (total > 0) {
        const int percentage = (current * 100) / total;
        m_progressBar->setValue(percentage);
        m_progressBar->setFormat(QStringLiteral("%1/%2 hôtes scannés (%3%)")
                                 .arg(current).arg(total).arg(percentage));
    }
}

void NetworkScannerDialog::onScanFinished(const QVector<NetworkDevice> &devices)
{
    m_scanButton->setText(QStringLiteral("▶ Re-scanner les Raspberry Pi"));
    m_progressBar->setValue(100);

    updateStatusLabel();

    m_selectAllButton->setEnabled(m_deviceList->count() > 0);
    m_deselectAllButton->setEnabled(m_deviceList->count() > 0);

    int onlineCount = 0;
    for (const auto &device : devices) {
        if (device.isOnline)
            onlineCount++;
    }

    // Connexion automatique : si des appareils sont en ligne, on les coche
    // tous et on valide directement la boîte de dialogue.
    if (onlineCount > 0) {
        QMessageBox::information(this,
                                 QStringLiteral("Scan terminé"),
                                 QStringLiteral("%1 Raspberry Pi détecté(s) sur 4\n"
                                                "%2 en ligne - Connexion automatique en cours...")
                                 .arg(devices.size()).arg(onlineCount));

        m_selectedDevices.clear();
        for (int i = 0; i < m_deviceList->count(); ++i) {
            QListWidgetItem *item = m_deviceList->item(i);
            const QString itemIp = item->data(Qt::UserRole).toString();

            for (const auto &device : devices) {
                if (device.ipAddress == itemIp && device.isOnline) {
                    item->setCheckState(Qt::Checked);
                    m_selectedDevices.append(device);
                    break;
                }
            }
        }

        accept();
    }
}

void NetworkScannerDialog::onScanError(const QString &error)
{
    m_scanButton->setText(QStringLiteral("▶ Lancer le scan"));
    m_statusLabel->setText(QStringLiteral("Erreur: %1").arg(error));
    m_statusLabel->setStyleSheet("color: #e74c3c; font-weight: 600;");
    QMessageBox::critical(this, QStringLiteral("Erreur de scan"), error);
}

// =====================================================================
//  SLOTS DE SÉLECTION
// =====================================================================
void NetworkScannerDialog::onDeviceItemChanged(QListWidgetItem *item)
{
    Q_UNUSED(item)

    // Le bouton "Connecter" reflète le nombre d'appareils cochés.
    int selectedCount = 0;
    for (int i = 0; i < m_deviceList->count(); ++i) {
        if (m_deviceList->item(i)->checkState() == Qt::Checked)
            selectedCount++;
    }

    m_connectButton->setEnabled(selectedCount > 0);
    if (selectedCount > 0) {
        m_connectButton->setText(QStringLiteral(" Connecter %1 module(s)").arg(selectedCount));
    } else {
        m_connectButton->setText(QStringLiteral("Connecter les modules sélectionnés"));
    }
}

void NetworkScannerDialog::onSelectAllClicked()
{
    for (int i = 0; i < m_deviceList->count(); ++i)
        m_deviceList->item(i)->setCheckState(Qt::Checked);
}

void NetworkScannerDialog::onDeselectAllClicked()
{
    for (int i = 0; i < m_deviceList->count(); ++i)
        m_deviceList->item(i)->setCheckState(Qt::Unchecked);
}

void NetworkScannerDialog::onConnectClicked()
{
    // Construit la liste des appareils cochés à partir de leurs IP.
    m_selectedDevices.clear();

    for (int i = 0; i < m_deviceList->count(); ++i) {
        QListWidgetItem *item = m_deviceList->item(i);
        if (item->checkState() != Qt::Checked)
            continue;

        const QString deviceIp = item->data(Qt::UserRole).toString();
        for (const auto &device : m_detectedDevices) {
            if (device.ipAddress == deviceIp) {
                m_selectedDevices.append(device);
                break;
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

QVector<NetworkDevice> NetworkScannerDialog::selectedDevices() const
{
    return m_selectedDevices;
}
