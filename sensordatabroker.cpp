#include "sensordatabroker.h"

#include "raspberrymanager.h"

#include <QDateTime>
#include <QJsonObject>
#include <QJsonDocument>
#include <QDebug>

SensorDataBroker::SensorDataBroker(QObject *parent)
    : QObject(parent)
    , m_config(new RaspberryManager(this))
{
}

bool SensorDataBroker::loadConfiguration(const QString &filePath)
{
    QString path = filePath.isEmpty() ? RaspberryManager::defaultConfigPath() : filePath;

    if (!m_config->loadConfiguration(path)) {
        emit errorOccurred(QStringLiteral("Failed to load configuration from %1").arg(path));
        return false;
    }

    m_topicMap.clear();
    m_topicToNodeId.clear();

    for (const RaspberryNode &node : m_config->nodes()) {
        for (const SensorInfo &sensor : node.sensors) {
            if (sensor.topic.isEmpty()) {
                continue;
            }

            SensorTopicInfo info;
            info.sensorId = sensor.id;
            info.sensorName = sensor.name;
            info.sensorTypeString = RaspberryManager::sensorTypeToString(sensor.type);
            info.unit = sensor.unit;
            info.warningThreshold = sensor.warningThreshold;
            info.alarmThreshold = sensor.alarmThreshold;
            info.nodeId = node.id;

            m_topicMap.insert(sensor.topic, info);
            m_topicToNodeId.insert(sensor.topic, node.id);
        }
    }

    return true;
}

void SensorDataBroker::start()
{
    int globalPort = m_config->brokerConfig().port;
    if (globalPort <= 0) globalPort = 8883;

    for (const RaspberryNode &node : m_config->nodes()) {
        if (node.ipAddress.isEmpty()) {
            continue;
        }

        // Collect topics for this node
        QStringList nodeTopics;
        for (auto it = m_topicToNodeId.begin(); it != m_topicToNodeId.end(); ++it) {
            if (it.value() == node.id) {
                nodeTopics.append(it.key());
            }
        }
        if (nodeTopics.isEmpty()) {
            continue;
        }

        MqttClient *client = new MqttClient(this);
        QString nodeId = node.id;
        QString nodeIp = node.ipAddress;

        connect(client, &MqttClient::connectedToBroker, this, [this, client, nodeId, nodeTopics]() {
            emit connected();
            emit nodeStatusChanged(nodeId, true);
            for (const QString &topic : nodeTopics) {
                client->subscribe(topic, 0);
            }
        });

        connect(client, &MqttClient::disconnectedFromBroker, this, [this, nodeId]() {
            emit disconnected();
            emit nodeStatusChanged(nodeId, false);
        });

        connect(client, &MqttClient::messageReceived, this, [this](const QString &topic, const QByteArray &payload) {
            onNodeMessageReceived(topic, payload);
        });

        connect(client, &MqttClient::errorOccurred, this, [this, nodeId](const QString &error) {
            emit errorOccurred(QStringLiteral("[%1] %2").arg(nodeId, error));
        });

        client->setClientId(QStringLiteral("surveillanceqt_%1_%2")
                            .arg(nodeId)
                            .arg(QDateTime::currentDateTime().toMSecsSinceEpoch()));
        client->setKeepAlive(60);
        client->setAutoReconnect(true);
        // TLS is disabled by default. Enable by setting "protocol": "mqtts" in broker config.
        bool useTls = (QString::compare(m_config->brokerConfig().protocol, QStringLiteral("mqtts"), Qt::CaseInsensitive) == 0);
        client->setUseTls(useTls);
        client->setIgnoreSslErrors(true);
        client->connectToHost(nodeIp, static_cast<quint16>(globalPort));

        m_nodeClients.insert(nodeId, client);
    }

    if (m_nodeClients.isEmpty()) {
        emit errorOccurred(QStringLiteral("No nodes with sensors configured"));
    }
}

void SensorDataBroker::stop()
{
    for (MqttClient *client : m_nodeClients) {
        client->disconnectFromHost();
        client->deleteLater();
    }
    m_nodeClients.clear();
}

bool SensorDataBroker::isConnected() const
{
    for (MqttClient *client : m_nodeClients) {
        if (client->isConnected()) {
            return true;
        }
    }
    return false;
}

QStringList SensorDataBroker::connectedNodes() const
{
    QStringList list;
    for (auto it = m_nodeClients.begin(); it != m_nodeClients.end(); ++it) {
        if (it.value()->isConnected()) {
            list.append(it.key());
        }
    }
    return list;
}

SensorTopicInfo SensorDataBroker::sensorInfoForTopic(const QString &topic) const
{
    return m_topicMap.value(topic);
}

void SensorDataBroker::onNodeMessageReceived(const QString &topic, const QByteArray &payload)
{
    if (!m_topicMap.contains(topic)) {
        return;
    }

    SensorTopicInfo info = m_topicMap.value(topic);
    double value = parsePayload(payload, info.sensorTypeString);

    if (qIsNaN(value)) {
        qWarning() << "Failed to parse payload for topic" << topic << ":" << payload;
        return;
    }

    emit sensorValueUpdated(info.sensorId, info.sensorName, info.sensorTypeString, value, info.unit);
}

double SensorDataBroker::parsePayload(const QByteArray &payload, const QString &sensorType) const
{
    QString payloadStr = QString::fromUtf8(payload).trimmed();

    if (payloadStr.isEmpty()) {
        return qQNaN();
    }

    // Try JSON first
    QJsonDocument doc = QJsonDocument::fromJson(payload);
    if (!doc.isNull() && doc.isObject()) {
        QJsonObject obj = doc.object();

        // Look for "value" key first
        if (obj.contains(QStringLiteral("value"))) {
            QJsonValue val = obj.value(QStringLiteral("value"));
            if (val.isDouble()) {
                return val.toDouble();
            } else if (val.isString()) {
                bool ok;
                double d = val.toString().toDouble(&ok);
                if (ok) return d;
            }
        }

        // Look for type-specific keys
        QStringList possibleKeys;
        if (sensorType.contains(QStringLiteral("temperature"), Qt::CaseInsensitive)) {
            possibleKeys << QStringLiteral("temperature") << QStringLiteral("temp");
        } else if (sensorType.contains(QStringLiteral("humidity"), Qt::CaseInsensitive)) {
            possibleKeys << QStringLiteral("humidity") << QStringLiteral("humidite") << QStringLiteral("hum");
        } else if (sensorType.contains(QStringLiteral("smoke"), Qt::CaseInsensitive) || sensorType.contains(QStringLiteral("fumee"), Qt::CaseInsensitive)) {
            possibleKeys << QStringLiteral("smoke") << QStringLiteral("fumee") << QStringLiteral("ppm");
        } else if (sensorType.contains(QStringLiteral("co2"), Qt::CaseInsensitive) || sensorType.contains(QStringLiteral("air"), Qt::CaseInsensitive)) {
            possibleKeys << QStringLiteral("co2") << QStringLiteral("air_quality") << QStringLiteral("quality");
        } else if (sensorType.contains(QStringLiteral("voc"), Qt::CaseInsensitive)) {
            possibleKeys << QStringLiteral("voc") << QStringLiteral("tvoc");
        }

        for (const QString &key : possibleKeys) {
            if (obj.contains(key)) {
                QJsonValue val = obj.value(key);
                if (val.isDouble()) {
                    return val.toDouble();
                } else if (val.isString()) {
                    bool ok;
                    double d = val.toString().toDouble(&ok);
                    if (ok) return d;
                }
            }
        }
    }

    // Fallback to plain text
    bool ok;
    double value = payloadStr.toDouble(&ok);
    if (ok) {
        return value;
    }

    return qQNaN();
}
