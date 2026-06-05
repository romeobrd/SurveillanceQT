#include "arpscanner.h"

#include <QProcess>
#include <QRegularExpression>
#include <QNetworkInterface>
#include <QHostInfo>
#include <QRandomGenerator>

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


ArpScanner::ArpScanner(QObject *parent)
    : QObject(parent)
    , m_scanTimer(new QTimer(this))
    , m_progressTimer(new QTimer(this))
    , m_currentProgress(0)
    , m_totalHosts(0)
    , m_isScanning(false)
    , m_scanningKnownDevicesOnly(false)
{
    m_scanTimer->setSingleShot(true);
    connect(m_scanTimer, &QTimer::timeout, this, &ArpScanner::onScanTimeout);

    m_progressTimer->setInterval(100);
    connect(m_progressTimer, &QTimer::timeout, this, [this]() {
        if (m_totalHosts > 0) {
            emit scanProgress(m_currentProgress, m_totalHosts);
        }
    });
}

ArpScanner::~ArpScanner()
{
    stopScan();
}

void ArpScanner::startScan(const QString &subnet)
{
    if (m_isScanning) {
        return;
    }

    m_isScanning = true;
    m_devices.clear();
    m_currentProgress = 0;

    m_currentSubnet = subnet.isEmpty() ? getLocalSubnet() : subnet;
    if (m_currentSubnet.isEmpty()) {
        emit scanError(QStringLiteral("Unable to determine local subnet"));
        m_isScanning = false;
        return;
    }

    emit scanStarted();
    m_progressTimer->start();

    pingSweep(m_currentSubnet);

    m_scanTimer->start(2000);
}

void ArpScanner::stopScan()
{
    m_isScanning = false;
    m_scanTimer->stop();
    m_progressTimer->stop();

    // Clean up TCP sockets
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

QVector<NetworkDevice> ArpScanner::detectedDevices() const
{
    return m_devices;
}

QVector<NetworkDevice> ArpScanner::surveillanceModules() const
{
    QVector<NetworkDevice> modules;
    for (const auto &device : m_devices) {
        if (device.deviceType.contains(QStringLiteral("Surveillance"), Qt::CaseInsensitive) ||
            device.deviceType.contains(QStringLiteral("Sensor"), Qt::CaseInsensitive) ||
            device.deviceType.contains(QStringLiteral("Camera"), Qt::CaseInsensitive)) {
            modules.append(device);
        }
    }
    return modules;
}

QVector<NetworkDevice> ArpScanner::knownRaspberryPiDevices() const
{
    QVector<NetworkDevice> raspberryDevices;
    for (const auto &device : m_devices) {
        if (isKnownRaspberryPi(device.ipAddress)) {
            raspberryDevices.append(device);
        }
    }
    return raspberryDevices;
}

void ArpScanner::startScanKnownDevices()
{
    if (m_isScanning) {
        return;
    }

    m_isScanning = true;
    m_scanningKnownDevicesOnly = true;
    m_devices.clear();
    m_currentProgress = 0;
    m_totalHosts = KNOWN_RASPBERRY_PI.size();

    emit scanStarted();
    m_progressTimer->start();

    QVector<QString> knownIps;
    for (const auto &rpi : KNOWN_RASPBERRY_PI) {
        knownIps.append(rpi.ipAddress);
    }

    qDebug() << "ArpScanner: Starting scan for" << knownIps.size() << "known Raspberry Pis";

    // Method 1: Ping
    pingSpecificHosts(knownIps);

    // Method 2: TCP check on MQTT port (8883) as fallback
    // Delay TCP check slightly to avoid race conditions
    QTimer::singleShot(500, this, [this, knownIps]() {
        for (const QString &ip : knownIps) {
            checkTcpConnect(ip, 8883);
        }
    });

    m_scanTimer->start(8000); // Increase timeout for both methods
}

QVector<KnownRaspberryPi> ArpScanner::getKnownRaspberryPiList()
{
    return KNOWN_RASPBERRY_PI;
}

QMap<QString, QString> ArpScanner::getRaspberryPiDescriptions()
{
    QMap<QString, QString> descriptions;
    for (const auto &rpi : KNOWN_RASPBERRY_PI) {
        descriptions[rpi.ipAddress] = QStringLiteral("%1 - %2").arg(rpi.name, rpi.description);
    }
    return descriptions;
}

bool ArpScanner::isKnownRaspberryPi(const QString &ipAddress) const
{
    for (const auto &rpi : KNOWN_RASPBERRY_PI) {
        if (rpi.ipAddress == ipAddress) {
            return true;
        }
    }
    return false;
}

KnownRaspberryPi ArpScanner::getRaspberryPiInfo(const QString &ipAddress) const
{
    for (const auto &rpi : KNOWN_RASPBERRY_PI) {
        if (rpi.ipAddress == ipAddress) {
            return rpi;
        }
    }
    return KnownRaspberryPi();
}

void ArpScanner::pingSpecificHosts(const QVector<QString> &hosts)
{
    m_pendingHosts = hosts;

    qDebug() << "ArpScanner: Pinging" << hosts.size() << "hosts...";

    for (const QString &ip : hosts) {
        qDebug() << "ArpScanner: Pinging" << ip;

        QProcess *pingProcess = new QProcess(this);
        pingProcess->setProperty("ip", ip);

        connect(pingProcess, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
                this, [this, pingProcess](int exitCode, QProcess::ExitStatus) {
            QString ip = pingProcess->property("ip").toString();
            pingProcess->deleteLater();

            m_currentProgress++;

            qDebug() << "ArpScanner: Ping result for" << ip << "- exit code:" << exitCode;

            if (exitCode == 0) {
                KnownRaspberryPi rpiInfo = getRaspberryPiInfo(ip);

                NetworkDevice device;
                device.ipAddress = ip;
                device.macAddress = QStringLiteral("En attente ARP...");
                device.hostname = rpiInfo.name;
                device.deviceType = QStringLiteral(" %1").arg(rpiInfo.expectedType);
                device.description = rpiInfo.description;
                device.isOnline = true;
                device.rssi = -50;

                if (!m_devices.contains(device)) {
                    m_devices.append(device);
                    emit deviceFound(device);
                    emit raspberryPiFound(device, rpiInfo);
                    qDebug() << "ArpScanner: Found device:" << ip << rpiInfo.name;
                }
            }
        });

        connect(pingProcess, &QProcess::errorOccurred,
                this, [this, pingProcess](QProcess::ProcessError err) {
            QString ip = pingProcess->property("ip").toString();
            qDebug() << "ArpScanner: Ping error for" << ip << "-" << err;
            pingProcess->deleteLater();
            m_currentProgress++;
        });

#ifdef Q_OS_WIN
        // Windows: -n count, -w timeout in ms (increase to 3000ms)
        pingProcess->start("ping", QStringList() << "-n" << "2" << "-w" << "3000" << ip);
#else
        pingProcess->start("ping", QStringList() << "-c" << "2" << "-W" << "3" << ip);
#endif
    }
}

void ArpScanner::checkTcpConnect(const QString &ip, quint16 port)
{
    qDebug() << "ArpScanner: TCP check" << ip << "port" << port;

    QTcpSocket *socket = new QTcpSocket(this);
    m_tcpSockets.append(socket);
    socket->setProperty("ip", ip);

    connect(socket, &QTcpSocket::connected, this, [this, socket]() {
        QString ip = socket->property("ip").toString();
        qDebug() << "ArpScanner: TCP connected to" << ip;

        KnownRaspberryPi rpiInfo = getRaspberryPiInfo(ip);

        NetworkDevice device;
        device.ipAddress = ip;
        device.macAddress = QStringLiteral("TCP détecté");
        device.hostname = rpiInfo.name;
        device.deviceType = QStringLiteral(" %1").arg(rpiInfo.expectedType);
        device.description = rpiInfo.description;
        device.isOnline = true;
        device.rssi = -50;

        if (!m_devices.contains(device)) {
            m_devices.append(device);
            emit deviceFound(device);
            emit raspberryPiFound(device, rpiInfo);
        }

        socket->disconnectFromHost();
    });

    connect(socket, &QTcpSocket::errorOccurred, this, [this, socket](QAbstractSocket::SocketError err) {
        Q_UNUSED(err)
        QString ip = socket->property("ip").toString();
        qDebug() << "ArpScanner: TCP error for" << ip;
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

QString ArpScanner::getLocalSubnet()
{
    QString localIp = getLocalIpAddress();
    if (localIp.isEmpty()) {
        return QString();
    }

    QStringList parts = localIp.split('.');
    if (parts.size() != 4) {
        return QString();
    }

    return QStringLiteral("%1.%2.%3.0/24").arg(parts[0]).arg(parts[1]).arg(parts[2]);
}

QString ArpScanner::getLocalIpAddress()
{
    const QList<QNetworkInterface> interfaces = QNetworkInterface::allInterfaces();

    for (const QNetworkInterface &interface : std::as_const(interfaces)) {
        if (interface.flags() & QNetworkInterface::IsUp &&
            interface.flags() & QNetworkInterface::IsRunning &&
            !(interface.flags() & QNetworkInterface::IsLoopBack)) {

            const QList<QNetworkAddressEntry> entries = interface.addressEntries();
            for (const QNetworkAddressEntry &entry : std::as_const(entries)) {
                QHostAddress ip = entry.ip();
                if (ip.protocol() == QAbstractSocket::IPv4Protocol && !ip.isLoopback()) {
                    return ip.toString();
                }
            }
        }
    }

    return QString();
}

void ArpScanner::onScanTimeout()
{
    // For known devices scan, just finish
    if (m_scanningKnownDevicesOnly) {
        m_isScanning = false;
        m_progressTimer->stop();
        emit scanProgress(m_totalHosts, m_totalHosts);
        qDebug() << "ArpScanner: Scan finished, found" << m_devices.size() << "devices";
        emit scanFinished(m_devices);
    } else {
        performArpScan();
    }
}

void ArpScanner::performArpScan()
{
    parseArpTable();

    m_isScanning = false;
    m_progressTimer->stop();

    emit scanProgress(m_totalHosts, m_totalHosts);
    emit scanFinished(m_devices);
}

void ArpScanner::parseArpTable()
{
    QProcess process;

#ifdef Q_OS_WIN
    process.start("arp", QStringList() << "-a");
#else
    process.start("arp", QStringList() << "-n");
#endif

    if (!process.waitForFinished(5000)) {
        return;
    }

    QString output = QString::fromLocal8Bit(process.readAllStandardOutput());

#ifdef Q_OS_WIN
    QRegularExpression regex(QStringLiteral("\\s*(\\d+\\.\\d+\\.\\d+\\.\\d+)\\s+([0-9a-fA-F:-]{17})\\s+"));
#else
    QRegularExpression regex(QStringLiteral("\\s*(\\d+\\.\\d+\\.\\d+\\.\\d+)\\s+.*\\s+([0-9a-fA-F:-]{17})\\s+"));
#endif

    QRegularExpressionMatchIterator it = regex.globalMatch(output);
    while (it.hasNext()) {
        QRegularExpressionMatch match = it.next();
        QString ip = match.captured(1);
        QString mac = match.captured(2).toUpper();

        mac.replace('-', ':');

        if (mac == QStringLiteral("00:00:00:00:00:00") ||
            mac == QStringLiteral("FF:FF:FF:FF:FF:FF")) {
            continue;
        }

        NetworkDevice device;
        device.ipAddress = ip;
        device.macAddress = mac;
        device.hostname = resolveHostname(ip);
        device.deviceType = identifyDeviceType(mac, device.hostname);
        device.isOnline = true;
        device.rssi = QRandomGenerator::global()->bounded(-85, -30);

        if (!m_devices.contains(device)) {
            m_devices.append(device);
            emit deviceFound(device);
        }

        m_currentProgress++;
    }
}

void ArpScanner::pingSweep(const QString &subnet)
{
    QString baseIp = subnet.left(subnet.lastIndexOf('.'));
    m_totalHosts = 254;

    for (int i = 1; i <= 254; ++i) {
        QString ip = QStringLiteral("%1.%2").arg(baseIp).arg(i);

        QProcess *pingProcess = new QProcess(this);
        pingProcess->setProperty("ip", ip);

        connect(pingProcess, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
                this, [this, pingProcess](int, QProcess::ExitStatus) {
            pingProcess->deleteLater();
            m_currentProgress++;
        });

        connect(pingProcess, &QProcess::errorOccurred,
                this, [this, pingProcess](QProcess::ProcessError) {
            pingProcess->deleteLater();
            m_currentProgress++;
        });

#ifdef Q_OS_WIN
        pingProcess->start("ping", QStringList() << "-n" << "1" << "-w" << "500" << ip);
#else
        pingProcess->start("ping", QStringList() << "-c" << "1" << "-W" << "1" << ip);
#endif
    }
}

QString ArpScanner::resolveHostname(const QString &ipAddress)
{
    QHostInfo hostInfo = QHostInfo::fromName(ipAddress);
    if (!hostInfo.hostName().isEmpty() && hostInfo.hostName() != ipAddress) {
        return hostInfo.hostName();
    }
    return QStringLiteral("Unknown");
}

QString ArpScanner::identifyDeviceType(const QString &macAddress, const QString &hostname)
{
    QString lowerHostname = hostname.toLower();
    if (lowerHostname.contains(QStringLiteral("cam")) ||
        lowerHostname.contains(QStringLiteral("camera"))) {
        return QStringLiteral("IP Camera");
    }
    if (lowerHostname.contains(QStringLiteral("sensor")) ||
        lowerHostname.contains(QStringLiteral("temp")) ||
        lowerHostname.contains(QStringLiteral("smoke"))) {
        return QStringLiteral("Sensor Module");
    }
    if (lowerHostname.contains(QStringLiteral("dvr")) ||
        lowerHostname.contains(QStringLiteral("nvr"))) {
        return QStringLiteral("DVR/NVR System");
    }

    QString vendor = getMacVendor(macAddress);
    if (!vendor.isEmpty()) {
        if (vendor.contains(QStringLiteral("Raspberry")) ||
            vendor.contains(QStringLiteral("Arduino")) ||
            vendor.contains(QStringLiteral("Espressif"))) {
            return QStringLiteral("IoT/Surveillance Device");
        }
        return vendor;
    }

    return QStringLiteral("Network Device");
}

QString ArpScanner::getMacVendor(const QString &macAddress)
{
    QHash<QString, QString> vendors;
    vendors[QStringLiteral("B8:27:EB")] = QStringLiteral("Raspberry Pi");
    vendors[QStringLiteral("DC:A6:32")] = QStringLiteral("Raspberry Pi");
    vendors[QStringLiteral("E4:5F:01")] = QStringLiteral("Raspberry Pi");
    vendors[QStringLiteral("28:CD:C1")] = QStringLiteral("Raspberry Pi");
    vendors[QStringLiteral("D8:3A:DD")] = QStringLiteral("Raspberry Pi");
    vendors[QStringLiteral("C4:5D:64")] = QStringLiteral("Raspberry Pi");
    vendors[QStringLiteral("18:C0:4D")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("24:0A:C4")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("24:B6:20")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("2C:3A:E8")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("30:AE:A4")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("3C:71:BF")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("4C:11:AE")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("54:5A:A6")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("5C:CF:7F")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("60:01:94")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("68:C6:3A")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("78:E1:03")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("7C:9A:54")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("80:7D:3A")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("84:CC:A8")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("8C:AA:B5")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("90:97:F3")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("A0:20:A6")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("A4:7B:9C")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("A4:CF:12")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("AC:0B:FB")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("AC:D0:74")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("B0:BE:76")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("B4:E6:2D")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("BC:DD:C2")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("C8:2B:96")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("CC:50:E3")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("D8:A0:1D")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("DC:4F:22")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("E0:98:06")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("E4:F0:42")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("E8:DB:84")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("EC:FA:BC")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("F0:08:D1")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("F4:CF:A2")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("F8:1A:67")] = QStringLiteral("Espressif");
    vendors[QStringLiteral("FC:F5:C4")] = QStringLiteral("Espressif");

    QString prefix = macAddress.left(8).toUpper();
    if (vendors.contains(prefix)) {
        return vendors[prefix];
    }

    return QString();
}
