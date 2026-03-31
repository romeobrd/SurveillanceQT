#include "widgeteditor.h"

#include <QFormLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QComboBox>
#include <QSpinBox>
#include <QPushButton>
#include <QDialogButtonBox>

WidgetEditor::WidgetEditor(const WidgetConfig &config, QWidget *parent)
    : QDialog(parent)
    , m_originalConfig(config)
{
    setWindowTitle(QStringLiteral("✏️ Éditer le Widget"));
    setMinimumWidth(400);
    setupUi();

    m_nameEdit->setText(config.name);
    m_typeCombo->setCurrentText(config.type);
    m_warningSpin->setValue(config.warningThreshold);
    m_alarmSpin->setValue(config.alarmThreshold);
    m_unitEdit->setText(config.unit);
}

void WidgetEditor::setupUi()
{
    setStyleSheet(
        "QDialog { background: #1a1a2e; }"
        "QLabel { color: #eee; font-size: 13px; }"
        "QLineEdit, QComboBox, QSpinBox {"
        "  background: #16213e; color: #eee; border: 1px solid #2d3a5c;"
        "  border-radius: 6px; padding: 8px; font-size: 13px;"
        "}"
        "QPushButton {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #4a90d9, stop:1 #357abd);"
        "  color: white; border: none; border-radius: 6px; padding: 10px 20px;"
        "  font-size: 13px; font-weight: 600;"
        "}"
        "QPushButton:hover { background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #5aa0e9, stop:1 #458acd); }"
        "QPushButton#secondary {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #6c757d, stop:1 #5a6268);"
        "}"
        );

    auto *layout = new QVBoxLayout(this);
    layout->setSpacing(15);
    layout->setContentsMargins(20, 20, 20, 20);

    auto *header = new QLabel(QStringLiteral("Personnaliser le widget"), this);
    header->setStyleSheet("font-size: 18px; font-weight: 700; color: #4a90d9;");
    layout->addWidget(header);

    auto *formLayout = new QFormLayout();
    formLayout->setSpacing(12);

    m_nameEdit = new QLineEdit(this);
    m_nameEdit->setPlaceholderText(QStringLiteral("Nom du widget"));
    formLayout->addRow(QStringLiteral("Nom:"), m_nameEdit);

    m_typeCombo = new QComboBox(this);
    m_typeCombo->addItems({
        QStringLiteral("Fumée MQ-2"),
        QStringLiteral("Température DHT22"),
        QStringLiteral("Humidité DHT22"),
        QStringLiteral("CO2 PIM480"),
        QStringLiteral("VOC PIM480"),
        QStringLiteral("Caméra"),
        QStringLiteral("Radiation")
    });
    formLayout->addRow(QStringLiteral("Type:"), m_typeCombo);

    m_warningSpin = new QSpinBox(this);
    m_warningSpin->setRange(0, 9999);
    m_warningSpin->setSuffix(QStringLiteral(" (seuil avertissement)"));
    formLayout->addRow(QStringLiteral("Seuil Warning:"), m_warningSpin);

    m_alarmSpin = new QSpinBox(this);
    m_alarmSpin->setRange(0, 9999);
    m_alarmSpin->setSuffix(QStringLiteral(" (seuil alarme)"));
    formLayout->addRow(QStringLiteral("Seuil Alarme:"), m_alarmSpin);

    m_unitEdit = new QLineEdit(this);
    m_unitEdit->setPlaceholderText(QStringLiteral("°C, %, ppm, etc."));
    formLayout->addRow(QStringLiteral("Unité:"), m_unitEdit);

    layout->addLayout(formLayout);
    layout->addStretch();

    auto *buttonBox = new QDialogButtonBox(QDialogButtonBox::Save | QDialogButtonBox::Cancel, this);
    buttonBox->button(QDialogButtonBox::Save)->setText(QStringLiteral("💾 Enregistrer"));
    buttonBox->button(QDialogButtonBox::Cancel)->setText(QStringLiteral("❌ Annuler"));

    connect(buttonBox, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(buttonBox, &QDialogButtonBox::rejected, this, &QDialog::reject);

    layout->addWidget(buttonBox);
}

WidgetConfig WidgetEditor::getConfig() const
{
    WidgetConfig config = m_originalConfig;
    config.name = m_nameEdit->text();
    config.type = m_typeCombo->currentText();
    config.warningThreshold = m_warningSpin->value();
    config.alarmThreshold = m_alarmSpin->value();
    config.unit = m_unitEdit->text();
    return config;
}
