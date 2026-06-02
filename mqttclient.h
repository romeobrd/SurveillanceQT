#pragma once

#include <QObject>
#include <QSslSocket>
#include <QSslConfiguration>
#include <QSslCertificate>
#include <QSslKey>
#include <QSslError>
#include <QTimer>
#include <QByteArray>
#include <QString>
#include <QStringList>

/**
 * MqttClient — minimal MQTT 3.1.1 client running on top of QSslSocket.
 *
 * Supports:
 *   - Plain TCP (port 1883) and TLS / mTLS (port 8883).
 *   - CA-only TLS or full mTLS (CA + client cert + client key).
 *   - SUBSCRIBE / PUBLISH (QoS 0/1) and PINGREQ keep-alive.
 *   - JSON payload decoding into temperatureReceived / smokeReceived signals.
 */
class MqttClient : public QObject
{
    Q_OBJECT

public:
    enum State { Disconnected, Connecting, Connected, Error };

    explicit MqttClient(QObject *parent = nullptr);
    ~MqttClient() override;

    // ---------------- Connection ----------------
    void connectToBroker(const QString &host, quint16 port = 8883,
                         bool useSsl = true,
                         const QString &username = QString(),
                         const QString &password = QString());
    void disconnect();

    // ---------------- Pub / Sub ----------------
    void subscribe(const QString &topic);
    void publish(const QString &topic, const QString &message);

    // ---------------- TLS configuration ----------------
    void setIgnoreSslErrors(bool ignore);
    void setCaCertificate(const QString &certPath);
    void setClientCertificate(const QString &certPath, const QString &keyPath);
    void setClientCertificateFiles(const QString &certPath, const QString &keyPath);

    State state() const { return m_state; }
    bool isConnected() const { return m_state == Connected; }

signals:
    void connected();
    void disconnected();
    void error(const QString &message);
    void sslErrors(const QStringList &errors);

    // High-level sensor data decoded from JSON payloads
    void temperatureReceived(double temp, double humidity, const QString &sensorId);
    void smokeReceived(int level, const QString &sensorId);
    void gasDataReceived(int eco2_ppm, int tvoc_ppb, bool smokeDetected, const QString &sensorId);
    void rawDataReceived(const QString &topic, const QString &payload);

private slots:
    void onSocketEncrypted();
    void onSocketDisconnected();
    void onReadyRead();
    void onError(QAbstractSocket::SocketError err);
    void onSslErrors(const QList<QSslError> &errors);
    void onKeepAlive();

private:
    void   sendConnect();
    void   sendSubscribe(const QString &topic);
    void   sendPing();
    void   processData();
    QString readString(const QByteArray &data, int &pos);
    static QByteArray encodeRemainingLength(int len);
    static QByteArray encodeString(const QString &s);

    QSslSocket *m_socket = nullptr;
    QTimer     *m_timer  = nullptr;
    QByteArray  m_buffer;
    QString     m_host;
    quint16     m_port  = 8883;
    QString     m_user;
    QString     m_pass;
    QString     m_clientId;
    State       m_state = Disconnected;
    int         m_packetId    = 1;
    bool        m_ignoreSsl   = false;
    bool        m_connectSent = false;
    bool        m_useSsl      = true;

    // Pending subscriptions issued before CONNACK
    QStringList m_pendingSubscriptions;
};
