#include "mqttclient.h"

#include <QHostAddress>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSslSocket>
#include <QSslError>

MqttClient::MqttClient(QObject *parent)
    : QObject(parent)
    , m_socket(nullptr)
    , m_pingTimer(new QTimer(this))
    , m_reconnectTimer(new QTimer(this))
    , m_port(1883)
    , m_keepAliveSeconds(60)
    , m_autoReconnect(true)
    , m_useTls(false)
    , m_ignoreSslErrors(false)
    , m_expectingPingResp(false)
    , m_reconnectAttempts(0)
    , m_nextPacketId(1)
{
    connect(m_pingTimer, &QTimer::timeout, this, &MqttClient::sendPing);
    connect(m_reconnectTimer, &QTimer::timeout, this, &MqttClient::tryReconnect);

    m_reconnectTimer->setSingleShot(true);
}

void MqttClient::setUseTls(bool useTls)
{
    m_useTls = useTls;
}

void MqttClient::setIgnoreSslErrors(bool ignore)
{
    m_ignoreSslErrors = ignore;
}

void MqttClient::connectToHost(const QString &host, quint16 port)
{
    m_host = host;
    m_port = port;

    if (m_clientId.isEmpty()) {
        m_clientId = QStringLiteral("surveillanceqt_%1").arg(QDateTime::currentDateTime().toMSecsSinceEpoch());
    }

    if (!m_socket) {
        if (m_useTls) {
            QSslSocket *sslSocket = new QSslSocket(this);
            if (m_ignoreSslErrors) {
                connect(sslSocket, &QSslSocket::sslErrors, sslSocket, [sslSocket](const QList<QSslError> &) {
                    sslSocket->ignoreSslErrors();
                });
            }
            m_socket = sslSocket;
        } else {
            m_socket = new QTcpSocket(this);
        }

        connect(m_socket, &QAbstractSocket::connected, this, &MqttClient::onSocketConnected);
        connect(m_socket, &QAbstractSocket::disconnected, this, &MqttClient::onSocketDisconnected);
        connect(m_socket, &QAbstractSocket::readyRead, this, &MqttClient::onSocketReadyRead);
        connect(m_socket, QOverload<QAbstractSocket::SocketError>::of(&QAbstractSocket::errorOccurred),
                this, &MqttClient::onSocketError);

        if (QSslSocket *sslSocket = qobject_cast<QSslSocket*>(m_socket)) {
            connect(sslSocket, &QSslSocket::encrypted, this, &MqttClient::onSocketEncrypted);
        }
    }

    if (QSslSocket *sslSocket = qobject_cast<QSslSocket*>(m_socket)) {
        sslSocket->connectToHostEncrypted(host, port);
    } else {
        m_socket->connectToHost(host, port);
    }
}

void MqttClient::disconnectFromHost()
{
    m_autoReconnect = false;
    m_reconnectTimer->stop();
    m_pingTimer->stop();

    if (m_socket && m_socket->state() == QAbstractSocket::ConnectedState) {
        // Send DISCONNECT
        QByteArray disconnect;
        disconnect.append(static_cast<char>(0xE0));
        disconnect.append(static_cast<char>(0x00));
        m_socket->write(disconnect);
        m_socket->flush();
    }

    if (m_socket) {
        m_socket->disconnectFromHost();
    }
}

bool MqttClient::isConnected() const
{
    return m_socket && m_socket->state() == QAbstractSocket::ConnectedState;
}

void MqttClient::subscribe(const QString &topic, quint8 qos)
{
    m_subscriptions[topic] = qos;

    if (isConnected()) {
        sendSubscribe(topic, qos);
    }
}

void MqttClient::unsubscribe(const QString &topic)
{
    m_subscriptions.remove(topic);

    if (isConnected()) {
        sendUnsubscribe(topic);
    }
}

void MqttClient::setKeepAlive(int seconds)
{
    m_keepAliveSeconds = seconds;
}

void MqttClient::setClientId(const QString &clientId)
{
    m_clientId = clientId;
}

void MqttClient::setAutoReconnect(bool enabled)
{
    m_autoReconnect = enabled;
}

void MqttClient::onSocketConnected()
{
    if (!m_useTls) {
        sendConnect();
    }
}

void MqttClient::onSocketEncrypted()
{
    sendConnect();
}

void MqttClient::onSocketDisconnected()
{
    m_pingTimer->stop();
    emit disconnectedFromBroker();

    if (m_autoReconnect) {
        m_reconnectAttempts++;
        int delayMs = qMin(5000 * m_reconnectAttempts, 30000);
        m_reconnectTimer->start(delayMs);
    }
}

void MqttClient::onSocketReadyRead()
{
    m_readBuffer.append(m_socket->readAll());

    while (!m_readBuffer.isEmpty()) {
        if (m_readBuffer.size() < 2) {
            break; // Need more data
        }

        quint8 packetType = static_cast<quint8>(m_readBuffer.at(0));
        int headerBytes = 1;
        int remainingLength = decodeVariableLength(m_readBuffer, headerBytes);

        if (remainingLength < 0) {
            break; // Need more data to decode length
        }

        int totalPacketSize = headerBytes + remainingLength;
        if (m_readBuffer.size() < totalPacketSize) {
            break; // Need more data
        }

        QByteArray packetData = m_readBuffer.mid(headerBytes, remainingLength);
        m_readBuffer.remove(0, totalPacketSize);

        processPacket(packetType, packetData);
    }
}

void MqttClient::onSocketError(QAbstractSocket::SocketError socketError)
{
    Q_UNUSED(socketError)
    QString err = m_socket->errorString();
    if (err != m_lastErrorString || m_reconnectAttempts <= 1) {
        m_lastErrorString = err;
        emit errorOccurred(err);
    }
}

void MqttClient::sendPing()
{
    if (m_expectingPingResp) {
        // Broker didn't respond to previous ping, disconnect and reconnect
        if (m_socket) {
            m_socket->disconnectFromHost();
        }
        return;
    }

    sendPingReq();
    m_expectingPingResp = true;
}

void MqttClient::tryReconnect()
{
    if (!m_autoReconnect || isConnected() || !m_socket) {
        return;
    }

    if (QSslSocket *sslSocket = qobject_cast<QSslSocket*>(m_socket)) {
        sslSocket->connectToHostEncrypted(m_host, m_port);
    } else {
        m_socket->connectToHost(m_host, m_port);
    }
}

void MqttClient::sendConnect()
{
    QByteArray variableHeader;
    // Protocol name
    variableHeader.append(static_cast<char>(0x00));
    variableHeader.append(static_cast<char>(0x04));
    variableHeader.append("MQTT");
    // Protocol level (3.1.1)
    variableHeader.append(static_cast<char>(0x04));
    // Connect flags: clean session
    variableHeader.append(static_cast<char>(0x02));
    // Keep alive
    variableHeader.append(static_cast<char>(m_keepAliveSeconds >> 8));
    variableHeader.append(static_cast<char>(m_keepAliveSeconds & 0xFF));

    QByteArray payload;
    QByteArray clientIdBytes = m_clientId.toUtf8();
    payload.append(static_cast<char>(clientIdBytes.size() >> 8));
    payload.append(static_cast<char>(clientIdBytes.size() & 0xFF));
    payload.append(clientIdBytes);

    QByteArray packet;
    packet.append(static_cast<char>(0x10)); // CONNECT
    packet.append(encodeVariableLength(variableHeader.size() + payload.size()));
    packet.append(variableHeader);
    packet.append(payload);

    m_socket->write(packet);
}

void MqttClient::sendSubscribe(const QString &topic, quint8 qos)
{
    QByteArray payload;
    QByteArray topicBytes = topic.toUtf8();
    payload.append(static_cast<char>(topicBytes.size() >> 8));
    payload.append(static_cast<char>(topicBytes.size() & 0xFF));
    payload.append(topicBytes);
    payload.append(static_cast<char>(qos));

    QByteArray variableHeader;
    variableHeader.append(static_cast<char>(m_nextPacketId >> 8));
    variableHeader.append(static_cast<char>(m_nextPacketId & 0xFF));
    m_nextPacketId++;
    if (m_nextPacketId == 0) {
        m_nextPacketId = 1;
    }

    QByteArray packet;
    packet.append(static_cast<char>(0x82)); // SUBSCRIBE
    packet.append(encodeVariableLength(variableHeader.size() + payload.size()));
    packet.append(variableHeader);
    packet.append(payload);

    m_socket->write(packet);
}

void MqttClient::sendUnsubscribe(const QString &topic)
{
    QByteArray payload;
    QByteArray topicBytes = topic.toUtf8();
    payload.append(static_cast<char>(topicBytes.size() >> 8));
    payload.append(static_cast<char>(topicBytes.size() & 0xFF));
    payload.append(topicBytes);

    QByteArray variableHeader;
    variableHeader.append(static_cast<char>(m_nextPacketId >> 8));
    variableHeader.append(static_cast<char>(m_nextPacketId & 0xFF));
    m_nextPacketId++;
    if (m_nextPacketId == 0) {
        m_nextPacketId = 1;
    }

    QByteArray packet;
    packet.append(static_cast<char>(0xA2)); // UNSUBSCRIBE
    packet.append(encodeVariableLength(variableHeader.size() + payload.size()));
    packet.append(variableHeader);
    packet.append(payload);

    m_socket->write(packet);
}

void MqttClient::sendPingReq()
{
    QByteArray packet;
    packet.append(static_cast<char>(0xC0));
    packet.append(static_cast<char>(0x00));
    m_socket->write(packet);
}

void MqttClient::sendPingResp()
{
    QByteArray packet;
    packet.append(static_cast<char>(0xD0));
    packet.append(static_cast<char>(0x00));
    m_socket->write(packet);
}

void MqttClient::processPacket(quint8 packetType, const QByteArray &data)
{
    quint8 type = (packetType >> 4) & 0x0F;

    switch (type) {
    case 2: { // CONNACK
        if (data.size() >= 2) {
            quint8 returnCode = static_cast<quint8>(data.at(1));
            if (returnCode == 0) {
                m_reconnectAttempts = 0;
                m_lastErrorString.clear();
                m_pingTimer->start(m_keepAliveSeconds * 1000);
                emit connectedToBroker();

                // Resubscribe to all topics
                for (auto it = m_subscriptions.begin(); it != m_subscriptions.end(); ++it) {
                    sendSubscribe(it.key(), it.value());
                }
            } else {
                emit errorOccurred(QStringLiteral("MQTT connection refused: %1").arg(returnCode));
                m_socket->disconnectFromHost();
            }
        }
        break;
    }
    case 3: { // PUBLISH
        int index = 0;
        quint16 topicLength = readUint16(data, index);
        index += 2;

        if (data.size() < index + topicLength) {
            break;
        }

        QString topic = QString::fromUtf8(data.mid(index, topicLength));
        index += topicLength;

        quint8 qos = (packetType >> 1) & 0x03;
        if (qos > 0) {
            // Skip packet ID
            index += 2;
        }

        QByteArray payload = data.mid(index);
        emit messageReceived(topic, payload);
        break;
    }
    case 9: // SUBACK
        // Subscription acknowledged, nothing special to do
        break;
    case 13: // PINGRESP
        m_expectingPingResp = false;
        break;
    default:
        break;
    }
}

QByteArray MqttClient::encodeVariableLength(int length) const
{
    QByteArray result;
    do {
        quint8 byte = length % 128;
        length /= 128;
        if (length > 0) {
            byte |= 0x80;
        }
        result.append(static_cast<char>(byte));
    } while (length > 0);
    return result;
}

int MqttClient::decodeVariableLength(const QByteArray &data, int &bytesConsumed) const
{
    int multiplier = 1;
    int value = 0;
    bytesConsumed = 1;

    while (true) {
        if (bytesConsumed >= data.size()) {
            return -1; // Need more data
        }

        quint8 byte = static_cast<quint8>(data.at(bytesConsumed));
        value += (byte & 0x7F) * multiplier;
        multiplier *= 128;
        bytesConsumed++;

        if ((byte & 0x80) == 0) {
            break;
        }

        if (multiplier > 128 * 128 * 128) {
            return -1; // Malformed
        }
    }

    return value;
}

quint16 MqttClient::readUint16(const QByteArray &data, int offset) const
{
    if (data.size() < offset + 2) {
        return 0;
    }
    return (static_cast<quint8>(data.at(offset)) << 8) |
           static_cast<quint8>(data.at(offset + 1));
}
