#pragma once

#include <QHostAddress>
#include <QObject>
#include <QString>
#include <QTimer>
#include <QVector>
#include <QMap>

struct NetworkDevice {
    QString ipAddress;
    QString macAddress;
    QString hostname;
    QString deviceType;
    QString description;
    bool isOnline;
    int rssi;

    bool operator==(const NetworkDevice &other) const {
        return macAddress == other.macAddress;
    }
};

struct KnownRaspberryPi {
    QString ipAddress;
    QString name;
    QString description;
    QString expectedType;
};

class ArpScanner : public QObject {
    Q_OBJECT

public:
    explicit ArpScanner(QObject *parent = nullptr);
    ~ArpScanner();

    void startScan(const QString &subnet = QString());
    void startScanKnownDevices();
    void stopScan();
    bool isScanning() const;

    QVector<NetworkDevice> detectedDevices() const;
    QVector<NetworkDevice> surveillanceModules() const;
    QVector<NetworkDevice> knownRaspberryPiDevices() const;

    static QString getLocalSubnet();
    static QString getLocalIpAddress();

    static QVector<KnownRaspberryPi> getKnownRaspberryPiList();
    static QMap<QString, QString> getRaspberryPiDescriptions();

signals:
    void scanStarted();
    void scanProgress(int current, int total);
    void deviceFound(const NetworkDevice &device);
    void scanFinished(const QVector<NetworkDevice> &devices);
    void scanError(const QString &error);
    void raspberryPiFound(const NetworkDevice &device, const KnownRaspberryPi &knownInfo);

private slots:
    void onScanTimeout();
    void performArpScan();

private:
    void parseArpTable();
    void pingSweep(const QString &subnet);
    void pingSpecificHosts(const QVector<QString> &hosts);
    QString resolveHostname(const QString &ipAddress);
    QString identifyDeviceType(const QString &macAddress, const QString &hostname);
    QString getMacVendor(const QString &macAddress);
    bool isKnownRaspberryPi(const QString &ipAddress) const;
    KnownRaspberryPi getRaspberryPiInfo(const QString &ipAddress) const;

    QTimer *m_scanTimer;
    QTimer *m_progressTimer;
    QVector<NetworkDevice> m_devices;
    QString m_currentSubnet;
    int m_currentProgress;
    int m_totalHosts;
    bool m_isScanning;
    bool m_scanningKnownDevicesOnly;
    QVector<QString> m_pendingHosts;

    static const QVector<QString> SURVEILLANCE_MAC_PREFIXES;
    static const QVector<KnownRaspberryPi> KNOWN_RASPBERRY_PI;
};
