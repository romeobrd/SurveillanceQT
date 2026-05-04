#include "sensorfactory.h"

#include "smokesensorwidget.h"
#include "temperaturewidget.h"
#include "camerawidget.h"

QString SensorFactory::sensorTypeToString(WidgetSensorType type)
{
    switch (type) {
    case WidgetSensorType::Smoke: return QStringLiteral("Fumée MQ-2");
    case WidgetSensorType::Temperature: return QStringLiteral("Température DHT22");
    case WidgetSensorType::Humidity: return QStringLiteral("Humidité DHT22");
    case WidgetSensorType::CO2: return QStringLiteral("CO2 PIM480");
    case WidgetSensorType::VOC: return QStringLiteral("VOC PIM480");
    case WidgetSensorType::Camera: return QStringLiteral("Caméra");
    default: return QStringLiteral("Inconnu");
    }
}

QString SensorFactory::sensorTypeToIcon(WidgetSensorType type)
{
    switch (type) {
    case WidgetSensorType::Smoke: return QStringLiteral("🔥");
    case WidgetSensorType::Temperature: return QStringLiteral("🌡️");
    case WidgetSensorType::Humidity: return QStringLiteral("💧");
    case WidgetSensorType::CO2: return QStringLiteral("☁️");
    case WidgetSensorType::VOC: return QStringLiteral("🌫️");
    case WidgetSensorType::Camera: return QStringLiteral("📷");
    default: return QStringLiteral("📟");
    }
}

QString SensorFactory::defaultName(WidgetSensorType type)
{
    switch (type) {
    case WidgetSensorType::Smoke: return QStringLiteral("Nouveau capteur fumée");
    case WidgetSensorType::Temperature: return QStringLiteral("Nouveau capteur température");
    case WidgetSensorType::Humidity: return QStringLiteral("Nouveau capteur humidité");
    case WidgetSensorType::CO2: return QStringLiteral("Nouveau capteur CO2");
    case WidgetSensorType::VOC: return QStringLiteral("Nouveau capteur VOC");
    case WidgetSensorType::Camera: return QStringLiteral("Nouvelle caméra");
    default: return QStringLiteral("Nouveau capteur");
    }
}

QString SensorFactory::defaultUnit(WidgetSensorType type)
{
    switch (type) {
    case WidgetSensorType::Smoke: return QStringLiteral("%");
    case WidgetSensorType::Temperature: return QStringLiteral("°C");
    case WidgetSensorType::Humidity: return QStringLiteral("%");
    case WidgetSensorType::CO2: return QStringLiteral("ppm");
    case WidgetSensorType::VOC: return QStringLiteral("ppb");
    case WidgetSensorType::Camera: return QStringLiteral("");
    default: return QStringLiteral("");
    }
}

int SensorFactory::defaultWarningThreshold(WidgetSensorType type)
{
    switch (type) {
    case WidgetSensorType::Smoke: return 28;
    case WidgetSensorType::Temperature: return 35;
    case WidgetSensorType::Humidity: return 70;
    case WidgetSensorType::CO2: return 1000;
    case WidgetSensorType::VOC: return 500;
    default: return 0;
    }
}

int SensorFactory::defaultAlarmThreshold(WidgetSensorType type)
{
    switch (type) {
    case WidgetSensorType::Smoke: return 60;
    case WidgetSensorType::Temperature: return 45;
    case WidgetSensorType::Humidity: return 85;
    case WidgetSensorType::CO2: return 2000;
    case WidgetSensorType::VOC: return 1000;
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
