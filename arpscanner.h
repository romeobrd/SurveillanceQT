#pragma once

#include <QHostAddress>
#include <QObject>
#include <QString>
#include <QTimer>
#include <QVector>

struct NetworkDevice {
    QString ipAddress;
    QString macAddress;
    QString hostname;
    QString deviceType;
    bool isOnline;
    int rssi;

    bool operator==(const NetworkDevice &other) const {
        return macAddress == other.macAddress;
    }
};

class ArpScanner : public QObject {
    Q_OBJECT

public:
    explicit ArpScanner(QObject *parent = nullptr);
    ~ArpScanner();

    void startScan(const QString &subnet = QString());
    void stopScan();
    bool isScanning() const;

    QVector<NetworkDevice> detectedDevices() const;
    QVector<NetworkDevice> surveillanceModules() const;

    static QString getLocalSubnet();
    static QString getLocalIpAddress();

signals:
    void scanStarted();
    void scanProgress(int current, int total);
    void deviceFound(const NetworkDevice &device);
    void scanFinished(const QVector<NetworkDevice> &devices);
    void scanError(const QString &error);

private slots:
    void onScanTimeout();
    void performArpScan();

private:
    void parseArpTable();
    void pingSweep(const QString &subnet);
    QString resolveHostname(const QString &ipAddress);
    QString identifyDeviceType(const QString &macAddress, const QString &hostname);
    QString getMacVendor(const QString &macAddress);

    QTimer *m_scanTimer;
    QTimer *m_progressTimer;
    QVector<NetworkDevice> m_devices;
    QString m_currentSubnet;
    int m_currentProgress;
    int m_totalHosts;
    bool m_isScanning;

    static const QVector<QString> SURVEILLANCE_MAC_PREFIXES;
};
