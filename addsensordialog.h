#pragma once

#include "sensorfactory.h"

#include <QDialog>

class QListWidget;
class QLineEdit;

class AddSensorDialog : public QDialog {
    Q_OBJECT

public:
    explicit AddSensorDialog(QWidget *parent = nullptr);

    SensorConfig getSensorConfig() const;

private slots:
    void onSensorTypeSelected();
    void onAccept();

private:
    void setupUi();

    QListWidget *m_sensorList;
    QLineEdit *m_nameEdit;

    SensorType m_selectedType;
};
