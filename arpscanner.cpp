#include "arpscanner.h"

#include <QDebug>
#include <QHostAddress>
#include <QNetworkInterface>
#include <QProcess>

// =====================================================================
//  LISTE DES RASPBERRY PI CONNUS (adresses fixes du réseau privé)
// =====================================================================
const QVector<KnownRaspberryPi> ArpScanner::KNOWN_RASPBERRY_PI = {
    { QStringLiteral("200.26.16.10"), QStringLiteral("Raspberry 1 Température"),
      QStringLiteral("Capteurs DHT22 - Température et Humidité"), QStringLiteral("Temperature") },
    { QStringLiteral("200.26.16.20"), QStringLiteral("Raspberry 2 Caméra"),
      QStringLiteral("Caméra de surveillance"), QStringLiteral("Camera") },
    { QStringLiteral("200.26.16.30"), QStringLiteral("Raspberry 3 CO2 et Fumée"),
      QStringLiteral("Capteurs MQ-2 et PIM480 - Fumée et Qualité d'air"), QStringLiteral("AirQuality") },
    { QStringLiteral("200.26.16.40"), QStringLiteral("Raspberry 4 Visualisation"),
      QStringLiteral("Écran d'affichage local"), QStringLiteral("Display") }
};

// =====================================================================
//  CONSTRUCTION / DESTRUCTION
// =====================================================================
ArpScanner::ArpScanner(QObject *parent)
    : QObject(parent)
    , m_scanTimer(new QTimer(this))
    , m_progressTimer(new QTimer(this))
{
    m_scanTimer->setSingleShot(true);
    connect(m_scanTimer, &QTimer::timeout, this, &ArpScanner::onScanTimeout);

    // Rafraîchit la barre de progression toutes les 100 ms.
    m_progressTimer->setInterval(100);
    connect(m_progressTimer, &QTimer::timeout, this, [this]() {
        if (m_totalHosts > 0)
            emit scanProgress(m_currentProgress, m_totalHosts);
    });
}

ArpScanner::~ArpScanner()
{
    stopScan();
}

// =====================================================================
//  LANCEMENT / ARRÊT DU SCAN
// =====================================================================
void ArpScanner::startScanKnownDevices()
{
    if (m_isScanning)
        return;

    m_isScanning      = true;
    m_devices.clear();
    m_currentProgress = 0;
    m_totalHosts      = KNOWN_RASPBERRY_PI.size();

    m_progressTimer->start();

    QVector<QString> knownIps;
    for (const auto &rpi : KNOWN_RASPBERRY_PI)
        knownIps.append(rpi.ipAddress);

    qDebug() << "ArpScanner: scan de" << knownIps.size() << "Raspberry Pi connus";

    // Méthode 1 : ping de chaque adresse connue
    pingHosts(knownIps);

    // Méthode 2 (secours) : test TCP sur le port MQTT (8883), lancé avec
    // un léger délai pour ne pas concurrencer les pings.
    QTimer::singleShot(500, this, [this, knownIps]() {
        for (const QString &ip : knownIps)
            checkTcpConnect(ip, 8883);
    });

    // Fin du scan dans 8 secondes quoi qu'il arrive.
    m_scanTimer->start(8000);
}

void ArpScanner::stopScan()
{
    m_isScanning = false;
    m_scanTimer->stop();
    m_progressTimer->stop();

    // Fermer proprement les sockets TCP encore ouverts
    for (QTcpSocket *socket : std::as_const(m_tcpSockets)) {
        socket->abort();
        socket->deleteLater();
    }
    m_tcpSockets.clear();
}

bool ArpScanner::isScanning() const
{
    return m_isScanning;
}

void ArpScanner::onScanTimeout()
{
    m_isScanning = false;
    m_progressTimer->stop();
    emit scanProgress(m_totalHosts, m_totalHosts);
    qDebug() << "ArpScanner: scan terminé," << m_devices.size() << "appareil(s) trouvé(s)";
    emit scanFinished(m_devices);
}

// =====================================================================
//  MÉTHODES DE DÉTECTION (ping puis TCP)
// =====================================================================
void ArpScanner::pingHosts(const QVector<QString> &hosts)
{
    for (const QString &ip : hosts) {
        qDebug() << "ArpScanner: ping" << ip;

        auto *pingProcess = new QProcess(this);
        pingProcess->setProperty("ip", ip);

        connect(pingProcess, &QProcess::finished,
                this, [this, pingProcess](int exitCode, QProcess::ExitStatus) {
            const QString ip = pingProcess->property("ip").toString();
            pingProcess->deleteLater();
            m_currentProgress++;

            qDebug() << "ArpScanner: résultat ping" << ip << "- code:" << exitCode;

            // Code 0 = l'hôte a répondu au ping.
            if (exitCode == 0)
                addFoundDevice(ip, QStringLiteral("Ping OK"));
        });

        connect(pingProcess, &QProcess::errorOccurred,
                this, [this, pingProcess](QProcess::ProcessError err) {
            qDebug() << "ArpScanner: erreur ping pour"
                     << pingProcess->property("ip").toString() << "-" << err;
            pingProcess->deleteLater();
            m_currentProgress++;
        });

        // Commande ping de Linux : 2 essais, 3 s de timeout par essai.
        pingProcess->start(QStringLiteral("ping"),
                           { QStringLiteral("-c"), QStringLiteral("2"),
                             QStringLiteral("-W"), QStringLiteral("3"), ip });
    }
}

void ArpScanner::checkTcpConnect(const QString &ip, quint16 port)
{
    qDebug() << "ArpScanner: test TCP" << ip << "port" << port;

    auto *socket = new QTcpSocket(this);
    m_tcpSockets.append(socket);
    socket->setProperty("ip", ip);

    connect(socket, &QTcpSocket::connected, this, [this, socket]() {
        const QString ip = socket->property("ip").toString();
        qDebug() << "ArpScanner: TCP connecté à" << ip;
        addFoundDevice(ip, QStringLiteral("TCP détecté"));
        socket->disconnectFromHost();
    });

    connect(socket, &QTcpSocket::errorOccurred, this, [this, socket](QAbstractSocket::SocketError) {
        qDebug() << "ArpScanner: erreur TCP pour" << socket->property("ip").toString();
        if (m_tcpSockets.contains(socket)) {
            m_tcpSockets.removeAll(socket);
            socket->deleteLater();
        }
    });

    connect(socket, &QTcpSocket::disconnected, this, [this, socket]() {
        if (m_tcpSockets.contains(socket)) {
            m_tcpSockets.removeAll(socket);
            socket->deleteLater();
        }
    });

    socket->connectToHost(ip, port);
}

void ArpScanner::addFoundDevice(const QString &ip, const QString &macInfo)
{
    const KnownRaspberryPi rpiInfo = getRaspberryPiInfo(ip);

    NetworkDevice device;
    device.ipAddress  = ip;
    device.macAddress = macInfo;
    device.hostname   = rpiInfo.name;
    device.deviceType = QStringLiteral(" %1").arg(rpiInfo.expectedType);
    device.isOnline   = true;

    // Le même appareil peut être trouvé par le ping ET par le TCP :
    // on ne l'ajoute qu'une seule fois (comparaison par IP).
    if (!m_devices.contains(device)) {
        m_devices.append(device);
        emit deviceFound(device);
        qDebug() << "ArpScanner: appareil trouvé:" << ip << rpiInfo.name;
    }
}

// =====================================================================
//  HELPERS STATIQUES
// =====================================================================
QVector<KnownRaspberryPi> ArpScanner::getKnownRaspberryPiList()
{
    return KNOWN_RASPBERRY_PI;
}

KnownRaspberryPi ArpScanner::getRaspberryPiInfo(const QString &ipAddress)
{
    for (const auto &rpi : KNOWN_RASPBERRY_PI) {
        if (rpi.ipAddress == ipAddress)
            return rpi;
    }
    return KnownRaspberryPi();
}

QString ArpScanner::getLocalSubnet()
{
    const QString localIp = getLocalIpAddress();
    if (localIp.isEmpty())
        return QString();

    const QStringList parts = localIp.split('.');
    if (parts.size() != 4)
        return QString();

    // Sous-réseau /24 : on remplace le dernier octet par 0.
    return QStringLiteral("%1.%2.%3.0/24").arg(parts[0], parts[1], parts[2]);
}

QString ArpScanner::getLocalIpAddress()
{
    // Première adresse IPv4 d'une interface active (hors loopback).
    const QList<QNetworkInterface> interfaces = QNetworkInterface::allInterfaces();

    for (const QNetworkInterface &iface : interfaces) {
        if ((iface.flags() & QNetworkInterface::IsUp) &&
            (iface.flags() & QNetworkInterface::IsRunning) &&
            !(iface.flags() & QNetworkInterface::IsLoopBack)) {

            const QList<QNetworkAddressEntry> entries = iface.addressEntries();
            for (const QNetworkAddressEntry &entry : entries) {
                const QHostAddress ip = entry.ip();
                if (ip.protocol() == QAbstractSocket::IPv4Protocol && !ip.isLoopback())
                    return ip.toString();
            }
        }
    }

    return QString();
}
