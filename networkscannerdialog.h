#pragma once

#include "arpscanner.h"

#include <QDialog>
#include <QTimer>

class QListWidget;
class QListWidgetItem;
class QProgressBar;
class QPushButton;
class QLabel;

class NetworkScannerDialog : public QDialog {
    Q_OBJECT

public:
    explicit NetworkScannerDialog(QWidget *parent = nullptr);
    ~NetworkScannerDialog();

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
    void updateStatusLabel();

private:
    void setupUi();
    void displayKnownRaspberryPiList();
    void updateRaspberryPiInList(const NetworkDevice &device);
    void addDeviceToList(const NetworkDevice &device);
    QString formatDeviceInfo(const NetworkDevice &device) const;
    QString getSignalIcon(int rssi) const;

    ArpScanner *m_arpScanner;
    QListWidget *m_deviceList;
    QProgressBar *m_progressBar;
    QPushButton *m_scanButton;
    QPushButton *m_connectButton;
    QPushButton *m_selectAllButton;
    QPushButton *m_deselectAllButton;
    QLabel *m_statusLabel;
    QLabel *m_subnetLabel;

    QVector<NetworkDevice> m_detectedDevices;
    QVector<NetworkDevice> m_selectedDevices;
    int m_surveillanceModuleCount;
};
