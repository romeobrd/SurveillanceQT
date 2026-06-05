#include "raspberrymanager.h"

#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QCoreApplication>
#include <QDir>
#include <QDateTime>

RaspberryManager::RaspberryManager(QObject *parent)
    : QObject(parent)
{
    m_brokerConfig.host = QStringLiteral("200.26.16.200");
    m_brokerConfig.port = 1883;
    m_brokerConfig.protocol = QStringLiteral("mqtt");

    m_appConfig.autoConnectOnStartup = true;
    m_appConfig.reconnectIntervalMs = 5000;
    m_appConfig.heartbeatIntervalMs = 30000;
    m_appConfig.logLevel = QStringLiteral("info");
}

bool RaspberryManager::loadConfiguration(const QString &filePath)
{
    QString path = filePath.isEmpty() ? defaultConfigPath() : filePath;
    m_configFilePath = path;

    QFile file(path);
    if (!file.exists()) {
        emit configurationError(QStringLiteral("Configuration file not found: %1").arg(path));
        return false;
    }

    if (!file.open(QIODevice::ReadOnly)) {
        emit configurationError(QStringLiteral("Cannot open configuration file: %1").arg(file.errorString()));
        return false;
    }

    QByteArray data = file.readAll();
    file.close();

    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (doc.isNull() || !doc.isObject()) {
        emit configurationError(QStringLiteral("Invalid JSON configuration"));
        return false;
    }

    parseJson(doc);
    emit configurationLoaded();
    return true;
}

bool RaspberryManager::saveConfiguration(const QString &filePath)
{
    QString path = filePath.isEmpty() ? m_configFilePath : filePath;
    if (path.isEmpty()) {
        path = defaultConfigPath();
    }

    QDir dir = QFileInfo(path).dir();
    if (!dir.exists()) {
        dir.mkpath(".");
    }

    QFile file(path);
    if (!file.open(QIODevice::WriteOnly)) {
        return false;
    }

    QJsonDocument doc = toJson();
    file.write(doc.toJson(QJsonDocument::Indented));
    file.close();
    return true;
}

QVector<RaspberryNode> RaspberryManager::nodes() const
{
    return m_nodes;
}

RaspberryNode RaspberryManager::nodeById(const QString &id) const
{
    for (const auto &node : m_nodes) {
        if (node.id == id) {
            return node;
        }
    }
    return RaspberryNode();
}

RaspberryNode RaspberryManager::nodeByIp(const QString &ip) const
{
    for (const auto &node : m_nodes) {
        if (node.ipAddress == ip) {
            return node;
        }
    }
    return RaspberryNode();
}

BrokerConfig RaspberryManager::brokerConfig() const
{
    return m_brokerConfig;
}

AppConfig RaspberryManager::appConfig() const
{
    return m_appConfig;
}

void RaspberryManager::addNode(const RaspberryNode &node)
{
    m_nodes.append(node);
}

void RaspberryManager::updateNode(const QString &id, const RaspberryNode &node)
{
    for (int i = 0; i < m_nodes.size(); ++i) {
        if (m_nodes[i].id == id) {
            m_nodes[i] = node;
            return;
        }
    }
}

void RaspberryManager::removeNode(const QString &id)
{
    for (int i = 0; i < m_nodes.size(); ++i) {
        if (m_nodes[i].id == id) {
            m_nodes.removeAt(i);
            return;
        }
    }
}

void RaspberryManager::setNodeOnline(const QString &id, bool online)
{
    for (auto &node : m_nodes) {
        if (node.id == id) {
            bool changed = (node.isOnline != online);
            node.isOnline = online;
            node.lastSeen = QDateTime::currentDateTime().toSecsSinceEpoch();
            if (changed) {
                emit nodeStatusChanged(id, online);
            }
            return;
        }
    }
}

QString RaspberryManager::defaultConfigPath()
{
    return QCoreApplication::applicationDirPath() + QStringLiteral("/config/raspberry_nodes.json");
}

SensorType RaspberryManager::sensorTypeFromString(const QString &type)
{
    if (type == QStringLiteral("temperature_dht22")) return SensorType::Temperature_DHT22;
    if (type == QStringLiteral("humidity_dht22")) return SensorType::Humidity_DHT22;
    if (type == QStringLiteral("smoke_mq2")) return SensorType::Smoke_MQ2;
    if (type == QStringLiteral("air_quality_pim480")) return SensorType::AirQuality_PIM480;
    if (type == QStringLiteral("voc_pim480")) return SensorType::VOC_PIM480;
    if (type == QStringLiteral("camera")) return SensorType::Camera;
    return SensorType::Unknown;
}

QString RaspberryManager::sensorTypeToString(SensorType type)
{
    switch (type) {
    case SensorType::Temperature_DHT22: return QStringLiteral("temperature_dht22");
    case SensorType::Humidity_DHT22: return QStringLiteral("humidity_dht22");
    case SensorType::Smoke_MQ2: return QStringLiteral("smoke_mq2");
    case SensorType::AirQuality_PIM480: return QStringLiteral("air_quality_pim480");
    case SensorType::VOC_PIM480: return QStringLiteral("voc_pim480");
    case SensorType::Camera: return QStringLiteral("camera");
    default: return QStringLiteral("unknown");
    }
}

void RaspberryManager::parseJson(const QJsonDocument &doc)
{
    QJsonObject root = doc.object();

    if (root.contains(QStringLiteral("broker"))) {
        QJsonObject brokerObj = root[QStringLiteral("broker")].toObject();
        m_brokerConfig.host = brokerObj[QStringLiteral("host")].toString(m_brokerConfig.host);
        m_brokerConfig.port = brokerObj[QStringLiteral("port")].toInt(m_brokerConfig.port);
        m_brokerConfig.protocol = brokerObj[QStringLiteral("protocol")].toString(m_brokerConfig.protocol);
        m_brokerConfig.username = brokerObj[QStringLiteral("username")].toString();
        m_brokerConfig.password = brokerObj[QStringLiteral("password")].toString();
    }

    if (root.contains(QStringLiteral("application"))) {
        QJsonObject appObj = root[QStringLiteral("application")].toObject();
        m_appConfig.autoConnectOnStartup = appObj[QStringLiteral("auto_connect_on_startup")].toBool(true);
        m_appConfig.reconnectIntervalMs = appObj[QStringLiteral("reconnect_interval_ms")].toInt(5000);
        m_appConfig.heartbeatIntervalMs = appObj[QStringLiteral("heartbeat_interval_ms")].toInt(30000);
        m_appConfig.logLevel = appObj[QStringLiteral("log_level")].toString(QStringLiteral("info"));
    }

    m_nodes.clear();
    if (root.contains(QStringLiteral("raspberry_nodes"))) {
        QJsonArray nodesArray = root[QStringLiteral("raspberry_nodes")].toArray();
        for (const auto &value : nodesArray) {
            m_nodes.append(parseNode(value.toObject()));
        }
    }
}

QJsonDocument RaspberryManager::toJson() const
{
    QJsonObject root;

    QJsonObject brokerObj;
    brokerObj[QStringLiteral("host")] = m_brokerConfig.host;
    brokerObj[QStringLiteral("port")] = m_brokerConfig.port;
    brokerObj[QStringLiteral("protocol")] = m_brokerConfig.protocol;
    brokerObj[QStringLiteral("username")] = m_brokerConfig.username;
    brokerObj[QStringLiteral("password")] = m_brokerConfig.password;
    root[QStringLiteral("broker")] = brokerObj;

    QJsonObject appObj;
    appObj[QStringLiteral("auto_connect_on_startup")] = m_appConfig.autoConnectOnStartup;
    appObj[QStringLiteral("reconnect_interval_ms")] = m_appConfig.reconnectIntervalMs;
    appObj[QStringLiteral("heartbeat_interval_ms")] = m_appConfig.heartbeatIntervalMs;
    appObj[QStringLiteral("log_level")] = m_appConfig.logLevel;
    root[QStringLiteral("application")] = appObj;

    QJsonArray nodesArray;
    for (const auto &node : m_nodes) {
        nodesArray.append(nodeToJson(node));
    }
    root[QStringLiteral("raspberry_nodes")] = nodesArray;

    return QJsonDocument(root);
}

RaspberryNode RaspberryManager::parseNode(const QJsonObject &obj)
{
    RaspberryNode node;
    node.id = obj[QStringLiteral("id")].toString();
    node.name = obj[QStringLiteral("name")].toString();
    node.ipAddress = obj[QStringLiteral("ip_address")].toString();
    node.macAddress = obj[QStringLiteral("mac_address")].toString();
    node.description = obj[QStringLiteral("description")].toString();
    node.isOnline = false;
    node.lastSeen = 0;

    if (obj.contains(QStringLiteral("sensors"))) {
        QJsonArray sensorsArray = obj[QStringLiteral("sensors")].toArray();
        for (const auto &value : sensorsArray) {
            node.sensors.append(parseSensor(value.toObject()));
        }
    }

    node.extraConfig = obj;
    return node;
}

SensorInfo RaspberryManager::parseSensor(const QJsonObject &obj)
{
    SensorInfo sensor;
    sensor.id = obj[QStringLiteral("id")].toString();
    sensor.name = obj[QStringLiteral("name")].toString();
    sensor.type = sensorTypeFromString(obj[QStringLiteral("type")].toString());
    sensor.topic = obj[QStringLiteral("topic")].toString();
    sensor.unit = obj[QStringLiteral("unit")].toString();
    sensor.warningThreshold = obj[QStringLiteral("warning_threshold")].toInt(0);
    sensor.alarmThreshold = obj[QStringLiteral("alarm_threshold")].toInt(0);
    sensor.extraConfig = obj;
    return sensor;
}

QJsonObject RaspberryManager::nodeToJson(const RaspberryNode &node) const
{
    QJsonObject obj;
    obj[QStringLiteral("id")] = node.id;
    obj[QStringLiteral("name")] = node.name;
    obj[QStringLiteral("ip_address")] = node.ipAddress;
    obj[QStringLiteral("mac_address")] = node.macAddress;
    obj[QStringLiteral("description")] = node.description;

    QJsonArray sensorsArray;
    for (const auto &sensor : node.sensors) {
        sensorsArray.append(sensorToJson(sensor));
    }
    obj[QStringLiteral("sensors")] = sensorsArray;

    return obj;
}

QJsonObject RaspberryManager::sensorToJson(const SensorInfo &sensor) const
{
    QJsonObject obj;
    obj[QStringLiteral("id")] = sensor.id;
    obj[QStringLiteral("name")] = sensor.name;
    obj[QStringLiteral("type")] = sensorTypeToString(sensor.type);
    obj[QStringLiteral("topic")] = sensor.topic;
    obj[QStringLiteral("unit")] = sensor.unit;
    obj[QStringLiteral("warning_threshold")] = sensor.warningThreshold;
    obj[QStringLiteral("alarm_threshold")] = sensor.alarmThreshold;
    return obj;
}

QString SensorInfo::getTypeString() const
{
    switch (type) {
    case SensorType::Temperature_DHT22: return QStringLiteral("Température DHT22");
    case SensorType::Humidity_DHT22: return QStringLiteral("Humidité DHT22");
    case SensorType::Smoke_MQ2: return QStringLiteral("Fumée MQ-2");
    case SensorType::AirQuality_PIM480: return QStringLiteral("CO2 PIM480");
    case SensorType::VOC_PIM480: return QStringLiteral("VOC PIM480");
    case SensorType::Camera: return QStringLiteral("Caméra");
    default: return QStringLiteral("Inconnu");
    }
}

QString SensorInfo::getIcon() const
{
    switch (type) {
    case SensorType::Temperature_DHT22: return QStringLiteral("🌡️");
    case SensorType::Humidity_DHT22: return QStringLiteral("💧");
    case SensorType::Smoke_MQ2: return QStringLiteral("🔥");
    case SensorType::AirQuality_PIM480: return QStringLiteral("🌫️");
    case SensorType::VOC_PIM480: return QStringLiteral("💨");
    case SensorType::Camera: return QStringLiteral("📹");
    default: return QStringLiteral("📟");
    }
}
