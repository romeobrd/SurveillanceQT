#include "mqttclient.h"

#include <QCoreApplication>
#include <QDebug>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QJsonValue>
#include <QHostAddress>

// =====================================================================
//  Construction / destruction
// =====================================================================
MqttClient::MqttClient(QObject *parent)
    : QObject(parent)
{
    m_socket = new QSslSocket(this);
    m_timer  = new QTimer(this);
    m_timer->setInterval(20'000);  // PINGREQ every 20s, keep-alive 30s

    m_clientId = QStringLiteral("admin-console-%1")
                 .arg(QCoreApplication::applicationPid());

    connect(m_socket, &QSslSocket::encrypted,
            this, &MqttClient::onSocketEncrypted);
    connect(m_socket, &QSslSocket::connected,
            this, [this]() {
                // For plain TCP only; with TLS we use 'encrypted' instead.
                if (!m_useSsl) onSocketEncrypted();
            });
    connect(m_socket, &QSslSocket::disconnected,
            this, &MqttClient::onSocketDisconnected);
    connect(m_socket, &QSslSocket::readyRead,
            this, &MqttClient::onReadyRead);
    connect(m_socket, QOverload<QAbstractSocket::SocketError>::of(&QSslSocket::errorOccurred),
            this, &MqttClient::onError);
    connect(m_socket, &QSslSocket::sslErrors,
            this, &MqttClient::onSslErrors);
    connect(m_timer, &QTimer::timeout,
            this, &MqttClient::onKeepAlive);
}

MqttClient::~MqttClient()
{
    disconnect();
}

// =====================================================================
//  TLS configuration
// =====================================================================
void MqttClient::setIgnoreSslErrors(bool ignore)
{
    m_ignoreSsl = ignore;
}

void MqttClient::setCaCertificate(const QString &certPath)
{
    QFile certFile(certPath);
    if (!certFile.open(QIODevice::ReadOnly)) {
        qWarning() << "MQTT: Cannot open CA certificate file:" << certPath;
        return;
    }
    QSslCertificate cert(&certFile, QSsl::Pem);
    certFile.close();

    if (cert.isNull()) {
        qWarning() << "MQTT: Invalid CA certificate file:" << certPath;
        return;
    }

    QSslConfiguration sslConfig = m_socket->sslConfiguration();
    sslConfig.addCaCertificate(cert);
    m_socket->setSslConfiguration(sslConfig);
    qDebug() << "MQTT: CA certificate loaded from" << certPath;
}

void MqttClient::setClientCertificate(const QString &certPath, const QString &keyPath)
{
    setClientCertificateFiles(certPath, keyPath);
}

void MqttClient::setClientCertificateFiles(const QString &certPath, const QString &keyPath)
{
    // Client certificate (PEM)
    QFile certFile(certPath);
    if (!certFile.open(QIODevice::ReadOnly)) {
        qWarning() << "MQTT: Cannot open client certificate file:" << certPath;
        return;
    }
    QSslCertificate clientCert(&certFile, QSsl::Pem);
    certFile.close();

    if (clientCert.isNull()) {
        qWarning() << "MQTT: Invalid client certificate file:" << certPath;
        return;
    }

    // Client private key (PEM, RSA, no passphrase)
    QFile keyFile(keyPath);
    if (!keyFile.open(QIODevice::ReadOnly)) {
        qWarning() << "MQTT: Cannot open client key file:" << keyPath;
        return;
    }
    QSslKey clientKey(&keyFile, QSsl::Rsa, QSsl::Pem, QSsl::PrivateKey);
    keyFile.close();

    if (clientKey.isNull()) {
        qWarning() << "MQTT: Invalid client key file:" << keyPath;
        return;
    }

    QSslConfiguration sslConfig = m_socket->sslConfiguration();
    sslConfig.setLocalCertificate(clientCert);
    sslConfig.setPrivateKey(clientKey);
    m_socket->setSslConfiguration(sslConfig);

    qDebug() << "MQTT: Client certificate and key loaded from"
             << certPath << "and" << keyPath;
}

// =====================================================================
//  Connection
// =====================================================================
void MqttClient::connectToBroker(const QString &host, quint16 port, bool useSsl,
                                 const QString &username, const QString &password)
{
    m_host         = host;
    m_port         = port;
    m_user         = username;
    m_pass         = password;
    m_useSsl       = useSsl;
    m_state        = Connecting;
    m_connectSent  = false;
    m_buffer.clear();

    qDebug() << "MQTT: Connecting to" << host << ":" << port
             << (useSsl ? "(SSL)" : "(plain)");

    if (useSsl) {
        // Force-disable ALL certificate verification
        QSslConfiguration cfg = m_socket->sslConfiguration();
        cfg.setPeerVerifyMode(QSslSocket::VerifyNone);
        cfg.setPeerVerifyDepth(0);
        m_socket->setSslConfiguration(cfg);
        m_socket->ignoreSslErrors();
        qDebug() << "MQTT: SSL peer verification DISABLED";

        m_socket->connectToHostEncrypted(host, port);
    } else {
        m_socket->connectToHost(host, port);
    }
}

void MqttClient::disconnect()
{
    if (m_timer) m_timer->stop();
    if (m_socket && m_socket->state() != QAbstractSocket::UnconnectedState) {
        // MQTT DISCONNECT packet (type 14, no payload)
        const char pkt[] = { char(0xE0), 0x00 };
        m_socket->write(pkt, sizeof(pkt));
        m_socket->flush();
        m_socket->disconnectFromHost();
    }
    m_state = Disconnected;
}

// =====================================================================
//  Pub / Sub
// =====================================================================
void MqttClient::subscribe(const QString &topic)
{
    if (m_state != Connected) {
        if (!m_pendingSubscriptions.contains(topic))
            m_pendingSubscriptions.append(topic);
        qDebug() << "MQTT: subscription queued ->" << topic;
        return;
    }
    sendSubscribe(topic);
}

void MqttClient::publish(const QString &topic, const QString &message)
{
    if (m_state != Connected) {
        qWarning() << "MQTT: cannot publish, not connected";
        return;
    }

    const QByteArray topicBytes = encodeString(topic);
    const QByteArray payload    = message.toUtf8();

    QByteArray var;
    var.append(topicBytes);
    var.append(payload);

    QByteArray pkt;
    pkt.append(char(0x30));               // PUBLISH, QoS 0
    pkt.append(encodeRemainingLength(var.size()));
    pkt.append(var);

    m_socket->write(pkt);
    m_socket->flush();
}

// =====================================================================
//  Slots
// =====================================================================
void MqttClient::onSocketEncrypted()
{
    qDebug() << "MQTT: socket encrypted, sending CONNECT";
    if (!m_connectSent) {
        sendConnect();
        m_connectSent = true;
    }
}

void MqttClient::onSocketDisconnected()
{
    qDebug() << "MQTT: socket disconnected";
    m_state = Disconnected;
    if (m_timer) m_timer->stop();
    emit disconnected();
}

void MqttClient::onError(QAbstractSocket::SocketError err)
{
    Q_UNUSED(err)
    const QString msg = m_socket ? m_socket->errorString() : QStringLiteral("socket error");
    // Ignore all SSL-related errors when using self-signed certs
    if (m_ignoreSsl || m_useSsl) {
        if (msg.contains(QStringLiteral("self-signed"), Qt::CaseInsensitive) ||
            msg.contains(QStringLiteral("untrusted"), Qt::CaseInsensitive) ||
            msg.contains(QStringLiteral("certificate"), Qt::CaseInsensitive)) {
            qDebug() << "MQTT: Suppressing SSL error:" << msg;
            return;
        }
    }
    qWarning() << "MQTT: socket error ->" << msg;
    m_state = Error;
    emit error(msg);
}

void MqttClient::onSslErrors(const QList<QSslError> &errors)
{
    QStringList list;
    for (const auto &e : errors) list << e.errorString();
    qWarning() << "MQTT: SSL errors ->" << list;
    // ALWAYS ignore SSL errors for this self-signed broker
    if (m_socket) {
        qDebug() << "MQTT: Force-ignoring all SSL errors";
        m_socket->ignoreSslErrors();
    }
}

void MqttClient::onKeepAlive()
{
    if (m_state == Connected) sendPing();
}

void MqttClient::onReadyRead()
{
    m_buffer.append(m_socket->readAll());
    processData();
}

// =====================================================================
//  MQTT framing
// =====================================================================
QByteArray MqttClient::encodeRemainingLength(int len)
{
    QByteArray out;
    do {
        char b = char(len % 128);
        len /= 128;
        if (len > 0) b |= char(0x80);
        out.append(b);
    } while (len > 0);
    return out;
}

QByteArray MqttClient::encodeString(const QString &s)
{
    const QByteArray utf8 = s.toUtf8();
    QByteArray out;
    out.append(char((utf8.size() >> 8) & 0xFF));
    out.append(char(utf8.size() & 0xFF));
    out.append(utf8);
    return out;
}

void MqttClient::sendConnect()
{
    QByteArray var;
    // Protocol Name "MQTT"
    var.append(encodeString(QStringLiteral("MQTT")));
    var.append(char(0x04));   // Protocol level 4 (MQTT 3.1.1)

    quint8 flags = 0x02;      // Clean session
    if (!m_user.isEmpty()) flags |= 0x80;
    if (!m_pass.isEmpty()) flags |= 0x40;
    var.append(char(flags));

    // Keep-alive 30 seconds
    var.append(char(0x00));
    var.append(char(30));

    // Client ID
    var.append(encodeString(m_clientId));
    if (!m_user.isEmpty()) var.append(encodeString(m_user));
    if (!m_pass.isEmpty()) var.append(encodeString(m_pass));

    QByteArray pkt;
    pkt.append(char(0x10));   // CONNECT
    pkt.append(encodeRemainingLength(var.size()));
    pkt.append(var);

    m_socket->write(pkt);
    m_socket->flush();
}

void MqttClient::sendSubscribe(const QString &topic)
{
    const int packetId = m_packetId++;

    QByteArray var;
    var.append(char((packetId >> 8) & 0xFF));
    var.append(char(packetId & 0xFF));
    var.append(encodeString(topic));
    var.append(char(0x01));                 // QoS 1

    QByteArray pkt;
    pkt.append(char(0x82));                 // SUBSCRIBE
    pkt.append(encodeRemainingLength(var.size()));
    pkt.append(var);

    m_socket->write(pkt);
    m_socket->flush();
    qDebug() << "MQTT: subscribed to" << topic;
}

void MqttClient::sendPing()
{
    const char pkt[] = { char(0xC0), 0x00 };  // PINGREQ
    m_socket->write(pkt, sizeof(pkt));
    m_socket->flush();
}

QString MqttClient::readString(const QByteArray &data, int &pos)
{
    if (pos + 2 > data.size()) return QString();
    int len = (static_cast<unsigned char>(data[pos]) << 8) |
              static_cast<unsigned char>(data[pos + 1]);
    pos += 2;
    if (pos + len > data.size()) return QString();
    QString s = QString::fromUtf8(data.mid(pos, len));
    pos += len;
    return s;
}

void MqttClient::processData()
{
    while (m_buffer.size() >= 2) {
        const quint8 header = static_cast<quint8>(m_buffer[0]);
        const quint8 type   = (header >> 4) & 0x0F;

        // Decode Remaining Length (variable byte int)
        int multiplier = 1;
        int remaining  = 0;
        int idx        = 1;
        bool ok        = false;
        while (idx < m_buffer.size() && idx < 5) {
            const quint8 b = static_cast<quint8>(m_buffer[idx]);
            remaining += (b & 0x7F) * multiplier;
            ++idx;
            if ((b & 0x80) == 0) { ok = true; break; }
            multiplier *= 128;
        }
        if (!ok) return;                  // need more bytes

        const int totalLen = idx + remaining;
        if (m_buffer.size() < totalLen) return;

        const QByteArray data = m_buffer.mid(idx, remaining);
        m_buffer.remove(0, totalLen);

        if (type == 2) {                  // CONNACK
            qDebug() << "MQTT: CONNACK received";
            m_state = Connected;
            m_timer->start();
            emit connected();

            // Replay queued subscriptions
            for (const QString &t : std::as_const(m_pendingSubscriptions)) {
                sendSubscribe(t);
            }
            m_pendingSubscriptions.clear();
        }
        else if (type == 3) {             // PUBLISH
            int p = 0;
            const QString topic   = readString(data, p);
            const QString payload = QString::fromUtf8(data.mid(p));

            qDebug() << "MQTT: Message on" << topic << ":" << payload;
            emit rawDataReceived(topic, payload);

            // JSON decode
            QJsonParseError err;
            const auto doc = QJsonDocument::fromJson(payload.toUtf8(), &err);
            if (err.error == QJsonParseError::NoError && doc.isObject()) {
                const QJsonObject obj = doc.object();

                auto idOf = [&]() -> QString {
                    if (obj.contains("sensor_id")) return obj.value("sensor_id").toString();
                    if (obj.contains("id"))        return obj.value("id").toString();
                    return topic.section('/', -1);
                };

                if (obj.contains("temperature") || obj.contains("temp") || obj.contains("t")
                    || obj.contains("temperature_c") || obj.contains("temperature_f")) {
                    double t = 0.0;
                    if (obj.contains("temperature_c"))      t = obj.value("temperature_c").toDouble();
                    else if (obj.contains("temperature"))   t = obj.value("temperature").toDouble();
                    else if (obj.contains("temp"))          t = obj.value("temp").toDouble();
                    else if (obj.contains("t"))             t = obj.value("t").toDouble();
                    else if (obj.contains("temperature_f")) t = (obj.value("temperature_f").toDouble() - 32.0) * 5.0 / 9.0;

                    const double h = obj.value("humidity").toDouble(
                                     obj.value("hum").toDouble(
                                     obj.value("h").toDouble(-1.0)));
                    const QString id = idOf();
                    qDebug() << "MQTT: -> temperature" << t << "humidity" << h << "id" << id;
                    emit temperatureReceived(t, h, id);
                }
                else if (obj.contains("eco2_ppm") || obj.contains("tvoc_ppb")
                         || obj.contains("smoke_detected")) {
                    const int eco2     = obj.value("eco2_ppm").toInt(0);
                    const int tvoc     = obj.value("tvoc_ppb").toInt(0);
                    const bool det     = obj.value("smoke_detected").toBool(false);
                    const QString id   = idOf();
                    qDebug() << "MQTT: -> gas eCO2" << eco2 << "ppm  TVOC" << tvoc
                             << "ppb  detected:" << det << " id:" << id;
                    emit gasDataReceived(eco2, tvoc, det, id);
                    // NOTE: do NOT emit legacy smokeReceived here — the eCO2 value
                    // would be compared to the smoke threshold (60) and mistakenly
                    // flagged as smoke. Detection comes from the explicit boolean.
                }
                else if (obj.contains("smoke") || obj.contains("gas")
                         || obj.contains("level") || obj.contains("value")) {
                    const int v = obj.value("smoke").toInt(
                                  obj.value("gas").toInt(
                                  obj.value("level").toInt(
                                  obj.value("value").toInt(0))));
                    const QString id = idOf();
                    qDebug() << "MQTT: -> smoke" << v << "id" << id;
                    emit smokeReceived(v, id);
                }
            }
        }
        else if (type == 9)  qDebug() << "MQTT: SUBACK received";
        else if (type == 13) qDebug() << "MQTT: PINGRESP";
    }
}
