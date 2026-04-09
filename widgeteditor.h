#pragma once

#include <QDialog>

class QLineEdit;
class QComboBox;
class QSpinBox;
class QLabel;

struct WidgetConfig {
    QString id;
    QString name;
    QString type;
    int warningThreshold;
    int alarmThreshold;
    QString unit;
    bool enabled;
};

class WidgetEditor : public QDialog {
    Q_OBJECT

public:
    explicit WidgetEditor(const WidgetConfig &config, QWidget *parent = nullptr, bool cameraMode = false);

    WidgetConfig getConfig() const;

private:
    void setupUi();

    QLineEdit *m_nameEdit;
    QComboBox *m_typeCombo;
    QSpinBox *m_warningSpin;
    QSpinBox *m_alarmSpin;
    QLineEdit *m_unitEdit;
    QWidget *m_thresholdGroup;

    WidgetConfig m_originalConfig;
    bool m_cameraMode;
};
