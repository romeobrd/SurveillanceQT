#pragma once

#include <QObject>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QVector>
#include <QString>

enum class SensorType {
    Temperature_DHT22,
    Humidity_DHT22,
    Smoke_MQ2,
    AirQuality_PIM480,
    VOC_PIM480,
    Camera,
    Unknown
};

struct SensorInfo {
    QString id;
    QString name;
    SensorType type;
    QString topic;
    QString unit;
    int warningThreshold;
    int alarmThreshold;
    QJsonObject extraConfig;

    QString getTypeString() const;
    QString getIcon() const;
};

struct RaspberryNode {
    QString id;
    QString name;
    QString ipAddress;
    QString macAddress;
    QString description;
    QVector<SensorInfo> sensors;
    QJsonObject extraConfig;
    bool isOnline;
    qint64 lastSeen;

    bool hasSensors() const { return !sensors.isEmpty(); }
};

struct BrokerConfig {
    QString host;
    int port;
    QString protocol;
    QString username;
    QString password;
};

struct AppConfig {
    bool autoConnectOnStartup;
    int reconnectIntervalMs;
    int heartbeatIntervalMs;
    QString logLevel;
};

class RaspberryManager : public QObject {
    Q_OBJECT

public:
    explicit RaspberryManager(QObject *parent = nullptr);

    bool loadConfiguration(const QString &filePath = QString());
    bool saveConfiguration(const QString &filePath = QString());

    QVector<RaspberryNode> nodes() const;
    RaspberryNode nodeById(const QString &id) const;
    RaspberryNode nodeByIp(const QString &ip) const;

    BrokerConfig brokerConfig() const;
    AppConfig appConfig() const;

    void addNode(const RaspberryNode &node);
    void updateNode(const QString &id, const RaspberryNode &node);
    void removeNode(const QString &id);

    void setNodeOnline(const QString &id, bool online);

    static QString defaultConfigPath();
    static SensorType sensorTypeFromString(const QString &type);
    static QString sensorTypeToString(SensorType type);

signals:
    void configurationLoaded();
    void configurationError(const QString &error);
    void nodeStatusChanged(const QString &nodeId, bool online);

private:
    QVector<RaspberryNode> m_nodes;
    BrokerConfig m_brokerConfig;
    AppConfig m_appConfig;
    QString m_configFilePath;

    void parseJson(const QJsonDocument &doc);
    QJsonDocument toJson() const;
    RaspberryNode parseNode(const QJsonObject &obj);
    SensorInfo parseSensor(const QJsonObject &obj);
    QJsonObject nodeToJson(const RaspberryNode &node) const;
    QJsonObject sensorToJson(const SensorInfo &sensor) const;
};
