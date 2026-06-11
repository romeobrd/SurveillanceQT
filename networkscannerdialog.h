#pragma once

#include "arpscanner.h"

#include <QDialog>

class QLabel;
class QListWidget;
class QListWidgetItem;
class QProgressBar;
class QPushButton;

/**
 * NetworkScannerDialog — boîte de dialogue de détection des Raspberry Pi.
 *
 * Affiche la liste des 4 Raspberry Pi connus, lance le scan (ArpScanner)
 * et met à jour leur état en ligne / hors ligne. Les appareils en ligne
 * sont automatiquement cochés et connectés à la fin du scan.
 */
class NetworkScannerDialog : public QDialog {
    Q_OBJECT

public:
    explicit NetworkScannerDialog(QWidget *parent = nullptr);

    /** Appareils sélectionnés par l'utilisateur (après accept()). */
    QVector<NetworkDevice> selectedDevices() const;

private slots:
    void onScanClicked();
    void onConnectClicked();
    void onDeviceFound(const NetworkDevice &device);
    void onScanProgress(int current, int total);
    void onScanFinished(const QVector<NetworkDevice> &devices);
    void onScanError(const QString &error);
    void onDeviceItemChanged(QListWidgetItem *item);
    void onSelectAllClicked();
    void onDeselectAllClicked();

private:
    void setupUi();
    void displayKnownRaspberryPiList();
    void updateRaspberryPiInList(const NetworkDevice &device);
    void updateStatusLabel();

    ArpScanner   *m_arpScanner;
    QListWidget  *m_deviceList;
    QProgressBar *m_progressBar;
    QPushButton  *m_scanButton;
    QPushButton  *m_connectButton;
    QPushButton  *m_selectAllButton;
    QPushButton  *m_deselectAllButton;
    QLabel       *m_statusLabel;
    QLabel       *m_subnetLabel;

    QVector<NetworkDevice> m_detectedDevices;
    QVector<NetworkDevice> m_selectedDevices;
};
