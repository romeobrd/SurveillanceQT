#pragma once

#include <QObject>
#include <QSslSocket>
#include <QSslError>
#include <QTimer>
#include <QByteArray>
#include <QString>
#include <QStringList>

/**
 * MqttClient — client MQTT 3.1.1 minimal construit sur QSslSocket.
 *
 * C'est la classe qui centralise TOUT ce qui touche au MQTT :
 *   - connexion TCP simple (port 1883) ou TLS / mTLS (port 8883) ;
 *   - chargement des certificats (CA + certificat client + clé privée) ;
 *   - SUBSCRIBE / PUBLISH et keep-alive (PINGREQ) ;
 *   - décodage des payloads JSON des capteurs, retransmis sous forme
 *     de signaux Qt faciles à connecter (temperatureReceived, etc.).
 */
class MqttClient : public QObject
{
    Q_OBJECT

public:
    enum State { Disconnected, Connecting, Connected, Error };

    explicit MqttClient(QObject *parent = nullptr);
    ~MqttClient() override;

    // === CONNEXION ===
    void connectToBroker(const QString &host, quint16 port = 8883,
                         bool useSsl = true,
                         const QString &username = QString(),
                         const QString &password = QString());
    void disconnect();
    bool isConnected() const { return m_state == Connected; }

    // === PUB / SUB ===
    void subscribe(const QString &topic);
    void publish(const QString &topic, const QString &message);

    // === CERTIFICATS SSL/TLS ===
    void setCaCertificate(const QString &certPath);
    void setClientCertificate(const QString &certPath, const QString &keyPath);

    // Cherche le dossier qui contient les 3 fichiers de certificats
    // (ca.crt, admin-console.crt, admin-console.key). Remonte l'arborescence
    // depuis l'exécutable et le dossier courant, en testant aussi "certs/".
    static QString findCertificateDirectory();

signals:
    void connected();
    void disconnected();
    void error(const QString &message);

    // Données capteurs décodées depuis les payloads JSON
    void temperatureReceived(double temp, double humidity, const QString &sensorId);
    void smokeReceived(int level, const QString &sensorId);
    void gasDataReceived(int eco2Ppm, int tvocPpb, bool smokeDetected, const QString &sensorId);

private slots:
    void onSocketEncrypted();
    void onSocketDisconnected();
    void onReadyRead();
    void onError(QAbstractSocket::SocketError err);
    void onSslErrors(const QList<QSslError> &errors);
    void onKeepAlive();

private:
    // Construction / décodage des trames MQTT
    void sendConnect();
    void sendSubscribe(const QString &topic);
    void sendPing();
    void processData();
    void handlePublish(const QByteArray &data);
    static QString readString(const QByteArray &data, int &pos);
    static QByteArray encodeRemainingLength(int len);
    static QByteArray encodeString(const QString &s);

    QSslSocket *m_socket = nullptr;
    QTimer     *m_timer  = nullptr;   // keep-alive (PINGREQ)
    QByteArray  m_buffer;             // octets reçus en attente de décodage
    QString     m_host;
    quint16     m_port  = 8883;
    QString     m_user;
    QString     m_pass;
    QString     m_clientId;
    State       m_state = Disconnected;
    int         m_packetId    = 1;
    bool        m_connectSent = false;
    bool        m_useSsl      = true;

    // Abonnements demandés avant la réception du CONNACK : ils sont mis
    // en file d'attente puis rejoués dès que la connexion est confirmée.
    QStringList m_pendingSubscriptions;
};
