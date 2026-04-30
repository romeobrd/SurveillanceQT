#pragma once

#include <QObject>
#include <QHash>
#include <QJsonDocument>

#include "mqttclient.h"

class RaspberryManager;

struct SensorTopicInfo {
    QString sensorId;
    QString sensorName;
    QString sensorTypeString;
    QString unit;
    int warningThreshold;
    int alarmThreshold;
    QString nodeId;
};

class SensorDataBroker : public QObject
{
    Q_OBJECT

public:
    explicit SensorDataBroker(QObject *parent = nullptr);

    bool loadConfiguration(const QString &filePath = QString());
    void start();
    void stop();

    bool isConnected() const;
    QStringList connectedNodes() const;

    SensorTopicInfo sensorInfoForTopic(const QString &topic) const;

signals:
    void connected();
    void disconnected();
    void sensorValueUpdated(const QString &sensorId,
                            const QString &sensorName,
                            const QString &sensorType,
                            double value,
                            const QString &unit);
    void nodeStatusChanged(const QString &nodeId, bool online);
    void errorOccurred(const QString &error);

private:
    void onNodeMessageReceived(const QString &topic, const QByteArray &payload);
    double parsePayload(const QByteArray &payload, const QString &sensorType) const;

    RaspberryManager *m_config;
    QHash<QString, SensorTopicInfo> m_topicMap;
    QHash<QString, QString> m_topicToNodeId;
    QHash<QString, MqttClient*> m_nodeClients;
};

