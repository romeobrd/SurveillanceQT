#include "sensorfactory.h"

#include "smokesensorwidget.h"
#include "temperaturewidget.h"
#include "camerawidget.h"

QString SensorFactory::sensorTypeToString(SensorType type)
{
    switch (type) {
    case SensorType::Smoke: return QStringLiteral("Fumée MQ-2");
    case SensorType::Temperature: return QStringLiteral("Température DHT22");
    case SensorType::Humidity: return QStringLiteral("Humidité DHT22");
    case SensorType::CO2: return QStringLiteral("CO2 PIM480");
    case SensorType::VOC: return QStringLiteral("VOC PIM480");
    case SensorType::Camera: return QStringLiteral("Caméra");
    default: return QStringLiteral("Inconnu");
    }
}

QString SensorFactory::sensorTypeToIcon(SensorType type)
{
    switch (type) {
    case SensorType::Smoke: return QStringLiteral("🔥");
    case SensorType::Temperature: return QStringLiteral("🌡️");
    case SensorType::Humidity: return QStringLiteral("💧");
    case SensorType::CO2: return QStringLiteral("☁️");
    case SensorType::VOC: return QStringLiteral("🌫️");
    case SensorType::Camera: return QStringLiteral("📷");
    default: return QStringLiteral("📟");
    }
}

QString SensorFactory::defaultName(SensorType type)
{
    switch (type) {
    case SensorType::Smoke: return QStringLiteral("Nouveau capteur fumée");
    case SensorType::Temperature: return QStringLiteral("Nouveau capteur température");
    case SensorType::Humidity: return QStringLiteral("Nouveau capteur humidité");
    case SensorType::CO2: return QStringLiteral("Nouveau capteur CO2");
    case SensorType::VOC: return QStringLiteral("Nouveau capteur VOC");
    case SensorType::Camera: return QStringLiteral("Nouvelle caméra");
    default: return QStringLiteral("Nouveau capteur");
    }
}

QString SensorFactory::defaultUnit(SensorType type)
{
    switch (type) {
    case SensorType::Smoke: return QStringLiteral("%");
    case SensorType::Temperature: return QStringLiteral("°C");
    case SensorType::Humidity: return QStringLiteral("%");
    case SensorType::CO2: return QStringLiteral("ppm");
    case SensorType::VOC: return QStringLiteral("ppb");
    case SensorType::Camera: return QStringLiteral("");
    default: return QStringLiteral("");
    }
}

int SensorFactory::defaultWarningThreshold(SensorType type)
{
    switch (type) {
    case SensorType::Smoke: return 28;
    case SensorType::Temperature: return 35;
    case SensorType::Humidity: return 70;
    case SensorType::CO2: return 1000;
    case SensorType::VOC: return 500;
    default: return 0;
    }
}

int SensorFactory::defaultAlarmThreshold(SensorType type)
{
    switch (type) {
    case SensorType::Smoke: return 60;
    case SensorType::Temperature: return 45;
    case SensorType::Humidity: return 85;
    case SensorType::CO2: return 2000;
    case SensorType::VOC: return 1000;
    default: return 0;
    }
}

SmokeSensorWidget* SensorFactory::createSmokeSensor(QWidget *parent, const QString &name)
{
    auto *widget = new SmokeSensorWidget(parent);
    widget->setTitle(name);
    return widget;
}

TemperatureWidget* SensorFactory::createTemperatureSensor(QWidget *parent, const QString &name)
{
    auto *widget = new TemperatureWidget(parent);
    widget->setTitle(name);
    return widget;
}

CameraWidget* SensorFactory::createCamera(QWidget *parent, const QString &name)
{
    auto *widget = new CameraWidget(parent);
    widget->setTitle(name);
    return widget;
}
