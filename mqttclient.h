#pragma once

#include <QObject>
#include <QAbstractSocket>
#include <QTcpSocket>
#include <QTimer>
#include <QHash>

class MqttClient : public QObject
{
    Q_OBJECT

public:
    explicit MqttClient(QObject *parent = nullptr);

    void connectToHost(const QString &host, quint16 port = 1883);
    void disconnectFromHost();

    bool isConnected() const;

    void subscribe(const QString &topic, quint8 qos = 0);
    void unsubscribe(const QString &topic);

    void setKeepAlive(int seconds);
    void setClientId(const QString &clientId);
    void setAutoReconnect(bool enabled);
    void setUseTls(bool useTls);
    void setIgnoreSslErrors(bool ignore);

signals:
    void connectedToBroker();
    void disconnectedFromBroker();
    void messageReceived(const QString &topic, const QByteArray &payload);
    void errorOccurred(const QString &error);

private slots:
    void onSocketConnected();
    void onSocketDisconnected();
    void onSocketReadyRead();
    void onSocketError(QAbstractSocket::SocketError socketError);
    void onSocketEncrypted();
    void sendPing();
    void tryReconnect();

private:
    void sendConnect();
    void sendSubscribe(const QString &topic, quint8 qos);
    void sendUnsubscribe(const QString &topic);
    void sendPingReq();
    void sendPingResp();
    void processPacket(quint8 packetType, const QByteArray &data);

    QByteArray encodeVariableLength(int length) const;
    int decodeVariableLength(const QByteArray &data, int &bytesConsumed) const;
    quint16 readUint16(const QByteArray &data, int offset) const;

    QAbstractSocket *m_socket;
    QTimer *m_pingTimer;
    QTimer *m_reconnectTimer;

    QString m_host;
    quint16 m_port;
    QString m_clientId;
    int m_keepAliveSeconds;
    bool m_autoReconnect;
    bool m_useTls;
    bool m_ignoreSslErrors;
    bool m_expectingPingResp;
    int m_reconnectAttempts;
    QString m_lastErrorString;

    quint16 m_nextPacketId;
    QByteArray m_readBuffer;
    QHash<QString, quint8> m_subscriptions;
};
