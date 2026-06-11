#pragma once

#include <QObject>
#include <QString>
#include <QTcpSocket>
#include <QTimer>
#include <QVector>

/** Appareil détecté sur le réseau. */
struct NetworkDevice {
    QString ipAddress;
    QString macAddress;
    QString hostname;
    QString deviceType;
    bool    isOnline = false;

    // Deux appareils sont identiques s'ils ont la même IP.
    bool operator==(const NetworkDevice &other) const {
        return ipAddress == other.ipAddress;
    }
};

/** Raspberry Pi connu du système (adresse fixe sur le réseau privé). */
struct KnownRaspberryPi {
    QString ipAddress;
    QString name;
    QString description;
    QString expectedType;
};

/**
 * ArpScanner — détection des Raspberry Pi du système de surveillance.
 *
 * Les 4 Raspberry Pi ont des adresses IP fixes connues. Le scan combine
 * deux méthodes pour vérifier leur présence :
 *   1. un ping système (commande "ping" de Linux) ;
 *   2. en secours, une tentative de connexion TCP sur le port MQTT (8883).
 */
class ArpScanner : public QObject {
    Q_OBJECT

public:
    explicit ArpScanner(QObject *parent = nullptr);
    ~ArpScanner() override;

    void startScanKnownDevices();
    void stopScan();
    bool isScanning() const;

    static QVector<KnownRaspberryPi> getKnownRaspberryPiList();
    static QString getLocalSubnet();
    static QString getLocalIpAddress();

signals:
    void scanProgress(int current, int total);
    void deviceFound(const NetworkDevice &device);
    void scanFinished(const QVector<NetworkDevice> &devices);
    void scanError(const QString &error);

private slots:
    void onScanTimeout();

private:
    void pingHosts(const QVector<QString> &hosts);
    void checkTcpConnect(const QString &ip, quint16 port);
    void addFoundDevice(const QString &ip, const QString &macInfo);
    static KnownRaspberryPi getRaspberryPiInfo(const QString &ipAddress);

    QTimer *m_scanTimer;       // limite la durée totale du scan
    QTimer *m_progressTimer;   // émet régulièrement la progression
    QVector<NetworkDevice>  m_devices;
    QVector<QTcpSocket *>   m_tcpSockets;
    int  m_currentProgress = 0;
    int  m_totalHosts      = 0;
    bool m_isScanning      = false;

    static const QVector<KnownRaspberryPi> KNOWN_RASPBERRY_PI;
};
