#pragma once

#include <QWidget>
#include <QString>

class SmokeSensorWidget;
class TemperatureWidget;
class CameraWidget;

enum class SensorType {
    Smoke,
    Temperature,
    Humidity,
    CO2,
    VOC,
    Camera
};

struct SensorConfig {
    QString id;
    QString name;
    SensorType type;
    int warningThreshold;
    int alarmThreshold;
    QString unit;
};

class SensorFactory {
public:
    static QString sensorTypeToString(SensorType type);
    static QString sensorTypeToIcon(SensorType type);
    static QString defaultName(SensorType type);
    static QString defaultUnit(SensorType type);
    static int defaultWarningThreshold(SensorType type);
    static int defaultAlarmThreshold(SensorType type);

    static SmokeSensorWidget* createSmokeSensor(QWidget *parent, const QString &name);
    static TemperatureWidget* createTemperatureSensor(QWidget *parent, const QString &name);
    static CameraWidget* createCamera(QWidget *parent, const QString &name);
};
