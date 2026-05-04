#pragma once

#include <QWidget>
#include <QString>

class SmokeSensorWidget;
class TemperatureWidget;
class CameraWidget;

enum class WidgetSensorType {
    Smoke,
    Temperature,
    Humidity,
    CO2,
    VOC,
    Camera
};

struct WidgetSensorConfig {
    QString id;
    QString name;
    WidgetSensorType type;
    int warningThreshold;
    int alarmThreshold;
    QString unit;
};

class SensorFactory {
public:
    static QString sensorTypeToString(WidgetSensorType type);
    static QString sensorTypeToIcon(WidgetSensorType type);
    static QString defaultName(WidgetSensorType type);
    static QString defaultUnit(WidgetSensorType type);
    static int defaultWarningThreshold(WidgetSensorType type);
    static int defaultAlarmThreshold(WidgetSensorType type);

    static SmokeSensorWidget* createSmokeSensor(QWidget *parent, const QString &name);
    static TemperatureWidget* createTemperatureSensor(QWidget *parent, const QString &name);
    static CameraWidget* createCamera(QWidget *parent, const QString &name);
};
