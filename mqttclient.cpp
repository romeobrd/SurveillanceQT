#include "mqttclient.h"

#include <QCoreApplication>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QSslCertificate>
#include <QSslConfiguration>
#include <QSslKey>

// =====================================================================
//  CONSTRUCTION / DESTRUCTION
// =====================================================================
MqttClient::MqttClient(QObject *parent)
    : QObject(parent)
{
    m_socket = new QSslSocket(this);
    m_timer  = new QTimer(this);
    m_timer->setInterval(20'000);  // PINGREQ toutes les 20 s (keep-alive 30 s)

    // Identifiant client unique : un broker rejette deux clients de même ID.
    m_clientId = QStringLiteral("admin-console-%1")
                 .arg(QCoreApplication::applicationPid());

    connect(m_socket, &QSslSocket::encrypted,
            this, &MqttClient::onSocketEncrypted);
    connect(m_socket, &QSslSocket::connected, this, [this]() {
        // En TCP simple seulement ; en TLS on attend le signal 'encrypted'.
        if (!m_useSsl)
            onSocketEncrypted();
    });
    connect(m_socket, &QSslSocket::disconnected,
            this, &MqttClient::onSocketDisconnected);
    connect(m_socket, &QSslSocket::readyRead,
            this, &MqttClient::onReadyRead);
    connect(m_socket, &QSslSocket::errorOccurred,
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
//  CERTIFICATS SSL/TLS
// =====================================================================
QString MqttClient::findCertificateDirectory()
{
    // Les 3 fichiers nécessaires au mTLS doivent être présents ensemble.
    auto certsExistIn = [](const QString &path) -> bool {
        return QFileInfo::exists(path + QStringLiteral("/ca.crt"))
            && QFileInfo::exists(path + QStringLiteral("/admin-console.crt"))
            && QFileInfo::exists(path + QStringLiteral("/admin-console.key"));
    };

    // On remonte l'arborescence (12 niveaux max) depuis l'exécutable puis
    // depuis le dossier courant, en testant chaque dossier et son
    // sous-dossier "certs/".
    const QStringList startPaths = {
        QCoreApplication::applicationDirPath(),
        QDir::currentPath()
    };

    for (const QString &startPath : startPaths) {
        QDir dir(startPath);
        for (int depth = 0; depth < 12; ++depth) {
            const QString abs = dir.absolutePath();
            if (certsExistIn(abs))
                return abs + QStringLiteral("/");
            if (certsExistIn(abs + QStringLiteral("/certs")))
                return abs + QStringLiteral("/certs/");
            if (!dir.cdUp())
                break;
        }
    }

    qWarning() << "MQTT: certificats introuvables, repli sur applicationDirPath";
    return QCoreApplication::applicationDirPath() + QStringLiteral("/");
}

void MqttClient::setCaCertificate(const QString &certPath)
{
    QFile certFile(certPath);
    if (!certFile.open(QIODevice::ReadOnly)) {
        qWarning() << "MQTT: impossible d'ouvrir le certificat CA:" << certPath;
        return;
    }
    QSslCertificate cert(&certFile, QSsl::Pem);
    certFile.close();

    if (cert.isNull()) {
        qWarning() << "MQTT: certificat CA invalide:" << certPath;
        return;
    }

    QSslConfiguration sslConfig = m_socket->sslConfiguration();
    sslConfig.addCaCertificate(cert);
    m_socket->setSslConfiguration(sslConfig);
    qDebug() << "MQTT: certificat CA chargé depuis" << certPath;
}

void MqttClient::setClientCertificate(const QString &certPath, const QString &keyPath)
{
    // --- Certificat client (PEM) ---
    QFile certFile(certPath);
    if (!certFile.open(QIODevice::ReadOnly)) {
        qWarning() << "MQTT: impossible d'ouvrir le certificat client:" << certPath;
        return;
    }
    QSslCertificate clientCert(&certFile, QSsl::Pem);
    certFile.close();

    if (clientCert.isNull()) {
        qWarning() << "MQTT: certificat client invalide:" << certPath;
        return;
    }

    // --- Clé privée client (PEM, RSA, sans mot de passe) ---
    QFile keyFile(keyPath);
    if (!keyFile.open(QIODevice::ReadOnly)) {
        qWarning() << "MQTT: impossible d'ouvrir la clé client:" << keyPath;
        return;
    }
    QSslKey clientKey(&keyFile, QSsl::Rsa, QSsl::Pem, QSsl::PrivateKey);
    keyFile.close();

    if (clientKey.isNull()) {
        qWarning() << "MQTT: clé client invalide:" << keyPath;
        return;
    }

    QSslConfiguration sslConfig = m_socket->sslConfiguration();
    sslConfig.setLocalCertificate(clientCert);
    sslConfig.setPrivateKey(clientKey);
    m_socket->setSslConfiguration(sslConfig);

    qDebug() << "MQTT: certificat et clé client chargés depuis"
             << certPath << "et" << keyPath;
}

// =====================================================================
//  CONNEXION
// =====================================================================
void MqttClient::connectToBroker(const QString &host, quint16 port, bool useSsl,
                                 const QString &username, const QString &password)
{
    m_host        = host;
    m_port        = port;
    m_user        = username;
    m_pass        = password;
    m_useSsl      = useSsl;
    m_state       = Connecting;
    m_connectSent = false;
    m_buffer.clear();

    qDebug() << "MQTT: connexion à" << host << ":" << port
             << (useSsl ? "(SSL)" : "(sans SSL)");

    if (useSsl) {
        // Le broker utilise un certificat auto-signé : on désactive la
        // vérification du pair (le chiffrement TLS reste actif, et le
        // certificat client est quand même présenté au broker pour le mTLS).
        QSslConfiguration cfg = m_socket->sslConfiguration();
        cfg.setPeerVerifyMode(QSslSocket::VerifyNone);
        cfg.setPeerVerifyDepth(0);
        m_socket->setSslConfiguration(cfg);
        m_socket->ignoreSslErrors();
        qDebug() << "MQTT: vérification du certificat serveur DÉSACTIVÉE";

        m_socket->connectToHostEncrypted(host, port);
    } else {
        m_socket->connectToHost(host, port);
    }
}

void MqttClient::disconnect()
{
    if (m_timer)
        m_timer->stop();
    if (m_socket && m_socket->state() != QAbstractSocket::UnconnectedState) {
        // Trame MQTT DISCONNECT (type 14, sans payload)
        const char pkt[] = { char(0xE0), 0x00 };
        m_socket->write(pkt, sizeof(pkt));
        m_socket->flush();
        m_socket->disconnectFromHost();
    }
    m_state = Disconnected;
}

// =====================================================================
//  PUB / SUB
// =====================================================================
void MqttClient::subscribe(const QString &topic)
{
    if (m_state != Connected) {
        // Pas encore connecté : on mémorise l'abonnement pour plus tard.
        if (!m_pendingSubscriptions.contains(topic))
            m_pendingSubscriptions.append(topic);
        qDebug() << "MQTT: abonnement mis en attente ->" << topic;
        return;
    }
    sendSubscribe(topic);
}

void MqttClient::publish(const QString &topic, const QString &message)
{
    if (m_state != Connected) {
        qWarning() << "MQTT: publication impossible, non connecté";
        return;
    }

    QByteArray var;
    var.append(encodeString(topic));
    var.append(message.toUtf8());

    QByteArray pkt;
    pkt.append(char(0x30));               // PUBLISH, QoS 0
    pkt.append(encodeRemainingLength(var.size()));
    pkt.append(var);

    m_socket->write(pkt);
    m_socket->flush();
}

// =====================================================================
//  SLOTS RÉSEAU
// =====================================================================
void MqttClient::onSocketEncrypted()
{
    qDebug() << "MQTT: socket chiffré, envoi du CONNECT";
    if (!m_connectSent) {
        sendConnect();
        m_connectSent = true;
    }
}

void MqttClient::onSocketDisconnected()
{
    qDebug() << "MQTT: socket déconnecté";
    m_state = Disconnected;
    if (m_timer)
        m_timer->stop();
    emit disconnected();
}

void MqttClient::onError(QAbstractSocket::SocketError err)
{
    Q_UNUSED(err)
    const QString msg = m_socket ? m_socket->errorString()
                                 : QStringLiteral("erreur socket");

    // Avec un certificat auto-signé, Qt remonte des erreurs "certificate"
    // qui ne sont pas bloquantes : on les ignore volontairement.
    if (m_useSsl) {
        if (msg.contains(QStringLiteral("self-signed"), Qt::CaseInsensitive) ||
            msg.contains(QStringLiteral("untrusted"), Qt::CaseInsensitive) ||
            msg.contains(QStringLiteral("certificate"), Qt::CaseInsensitive)) {
            qDebug() << "MQTT: erreur SSL ignorée:" << msg;
            return;
        }
    }
    qWarning() << "MQTT: erreur socket ->" << msg;
    m_state = Error;
    emit error(msg);
}

void MqttClient::onSslErrors(const QList<QSslError> &errors)
{
    QStringList list;
    for (const auto &e : errors)
        list << e.errorString();
    qWarning() << "MQTT: erreurs SSL ->" << list;

    // Broker auto-signé : on ignore TOUJOURS ces erreurs pour permettre
    // la poursuite du handshake TLS.
    if (m_socket) {
        qDebug() << "MQTT: erreurs SSL forcées à ignorées";
        m_socket->ignoreSslErrors();
    }
}

void MqttClient::onKeepAlive()
{
    if (m_state == Connected)
        sendPing();
}

void MqttClient::onReadyRead()
{
    m_buffer.append(m_socket->readAll());
    processData();
}

// =====================================================================
//  ENCODAGE DES TRAMES MQTT (protocole 3.1.1)
// =====================================================================
QByteArray MqttClient::encodeRemainingLength(int len)
{
    // "Remaining Length" : entier encodé sur 1 à 4 octets, 7 bits utiles
    // par octet, bit de poids fort = "il reste des octets".
    QByteArray out;
    do {
        char b = char(len % 128);
        len /= 128;
        if (len > 0)
            b |= char(0x80);
        out.append(b);
    } while (len > 0);
    return out;
}

QByteArray MqttClient::encodeString(const QString &s)
{
    // Chaîne MQTT : 2 octets de longueur (big-endian) puis l'UTF-8.
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
    var.append(encodeString(QStringLiteral("MQTT")));
    var.append(char(0x04));   // Niveau de protocole 4 = MQTT 3.1.1

    quint8 flags = 0x02;      // Clean session
    if (!m_user.isEmpty()) flags |= 0x80;
    if (!m_pass.isEmpty()) flags |= 0x40;
    var.append(char(flags));

    // Keep-alive annoncé au broker : 30 secondes
    var.append(char(0x00));
    var.append(char(30));

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
    qDebug() << "MQTT: abonné à" << topic;
}

void MqttClient::sendPing()
{
    const char pkt[] = { char(0xC0), 0x00 };  // PINGREQ
    m_socket->write(pkt, sizeof(pkt));
    m_socket->flush();
}

QString MqttClient::readString(const QByteArray &data, int &pos)
{
    if (pos + 2 > data.size())
        return QString();
    const int len = (static_cast<unsigned char>(data[pos]) << 8) |
                    static_cast<unsigned char>(data[pos + 1]);
    pos += 2;
    if (pos + len > data.size())
        return QString();
    const QString s = QString::fromUtf8(data.mid(pos, len));
    pos += len;
    return s;
}

// =====================================================================
//  DÉCODAGE DES TRAMES REÇUES
// =====================================================================
void MqttClient::processData()
{
    // Une trame MQTT = 1 octet d'en-tête + "Remaining Length" + données.
    // On boucle tant que le tampon contient au moins une trame complète.
    while (m_buffer.size() >= 2) {
        const quint8 header = static_cast<quint8>(m_buffer[0]);
        const quint8 type   = (header >> 4) & 0x0F;

        // Décodage du "Remaining Length" (entier à longueur variable)
        int  multiplier = 1;
        int  remaining  = 0;
        int  idx        = 1;
        bool lengthOk   = false;
        while (idx < m_buffer.size() && idx < 5) {
            const quint8 b = static_cast<quint8>(m_buffer[idx]);
            remaining += (b & 0x7F) * multiplier;
            ++idx;
            if ((b & 0x80) == 0) { lengthOk = true; break; }
            multiplier *= 128;
        }
        if (!lengthOk)
            return;                       // longueur incomplète : attendre

        const int totalLen = idx + remaining;
        if (m_buffer.size() < totalLen)
            return;                       // trame incomplète : attendre

        const QByteArray data = m_buffer.mid(idx, remaining);
        m_buffer.remove(0, totalLen);

        if (type == 2) {                  // CONNACK : connexion acceptée
            qDebug() << "MQTT: CONNACK reçu";
            m_state = Connected;
            m_timer->start();
            emit connected();

            // Rejouer les abonnements demandés avant la connexion
            for (const QString &t : std::as_const(m_pendingSubscriptions))
                sendSubscribe(t);
            m_pendingSubscriptions.clear();
        }
        else if (type == 3) {             // PUBLISH : message d'un capteur
            handlePublish(data);
        }
        else if (type == 9) {
            qDebug() << "MQTT: SUBACK reçu";
        }
        else if (type == 13) {
            qDebug() << "MQTT: PINGRESP";
        }
    }
}

void MqttClient::handlePublish(const QByteArray &data)
{
    int pos = 0;
    const QString topic   = readString(data, pos);
    const QString payload = QString::fromUtf8(data.mid(pos));

    qDebug() << "MQTT: message sur" << topic << ":" << payload;

    // Les capteurs publient du JSON ; on le décode pour émettre des
    // signaux typés que le dashboard n'a plus qu'à connecter.
    QJsonParseError err;
    const auto doc = QJsonDocument::fromJson(payload.toUtf8(), &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject())
        return;

    const QJsonObject obj = doc.object();

    // Identifiant du capteur : champ JSON ou dernier segment du topic.
    auto idOf = [&]() -> QString {
        if (obj.contains("sensor_id")) return obj.value("sensor_id").toString();
        if (obj.contains("id"))        return obj.value("id").toString();
        return topic.section('/', -1);
    };

    // --- Température / humidité (plusieurs noms de champs possibles) ---
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
        qDebug() << "MQTT: -> température" << t << "humidité" << h << "id" << id;
        emit temperatureReceived(t, h, id);
    }
    // --- Qualité d'air (capteur gaz : eCO2 / TVOC / détection fumée) ---
    else if (obj.contains("eco2_ppm") || obj.contains("tvoc_ppb")
             || obj.contains("smoke_detected")) {
        const int  eco2 = obj.value("eco2_ppm").toInt(0);
        const int  tvoc = obj.value("tvoc_ppb").toInt(0);
        const bool det  = obj.value("smoke_detected").toBool(false);
        const QString id = idOf();
        qDebug() << "MQTT: -> gaz eCO2" << eco2 << "ppm  TVOC" << tvoc
                 << "ppb  détecté:" << det << " id:" << id;
        emit gasDataReceived(eco2, tvoc, det, id);
        // ATTENTION : ne pas émettre smokeReceived ici — la valeur eCO2
        // serait comparée au seuil fumée et faussement signalée comme une
        // détection. La détection vient du booléen explicite.
    }
    // --- Niveau de fumée "classique" (valeur numérique) ---
    else if (obj.contains("smoke") || obj.contains("gas")
             || obj.contains("level") || obj.contains("value")) {
        const int v = obj.value("smoke").toInt(
                      obj.value("gas").toInt(
                      obj.value("level").toInt(
                      obj.value("value").toInt(0))));
        const QString id = idOf();
        qDebug() << "MQTT: -> fumée" << v << "id" << id;
        emit smokeReceived(v, id);
    }
}
