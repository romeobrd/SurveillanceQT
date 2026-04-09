#include "addsensordialog.h"

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QPushButton>
#include <QDialogButtonBox>
#include <QDateTime>

AddSensorDialog::AddSensorDialog(QWidget *parent)
    : QDialog(parent)
    , m_sensorList(nullptr)
    , m_nameEdit(nullptr)
    , m_selectedType(SensorType::Smoke)
{
    setWindowTitle(QStringLiteral("➕ Ajouter un capteur"));
    setFixedSize(450, 400);
    setupUi();
}

void AddSensorDialog::setupUi()
{
    setStyleSheet(
        "QDialog { background: #1a1a2e; }"
        "QLabel { color: #eee; font-size: 13px; }"
        "QLineEdit {"
        "  background: #16213e; color: #eee; border: 1px solid #2d3a5c;"
        "  border-radius: 6px; padding: 8px; font-size: 13px;"
        "}"
        "QListWidget {"
        "  background: #16213e; color: #eee; border: 1px solid #2d3a5c;"
        "  border-radius: 8px; padding: 5px; font-size: 14px;"
        "}"
        "QListWidget::item { padding: 10px; border-radius: 5px; }"
        "QListWidget::item:selected { background: #4a90d9; }"
        "QListWidget::item:hover { background: rgba(74, 144, 217, 0.3); }"
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

    // Header
    auto *header = new QLabel(QStringLiteral("Ajouter un nouveau capteur"), this);
    header->setStyleSheet("font-size: 18px; font-weight: 700; color: #4a90d9;");
    layout->addWidget(header);

    // Type selection
    auto *typeLabel = new QLabel(QStringLiteral("Type de capteur :"), this);
    layout->addWidget(typeLabel);

    m_sensorList = new QListWidget(this);
    m_sensorList->setIconSize(QSize(32, 32));

    // Add sensor types with icons
    auto *smokeItem = new QListWidgetItem(SensorFactory::sensorTypeToIcon(SensorType::Smoke) + QStringLiteral("  Fumée MQ-2"));
    smokeItem->setData(Qt::UserRole, static_cast<int>(SensorType::Smoke));
    m_sensorList->addItem(smokeItem);

    auto *tempItem = new QListWidgetItem(SensorFactory::sensorTypeToIcon(SensorType::Temperature) + QStringLiteral("  Température DHT22"));
    tempItem->setData(Qt::UserRole, static_cast<int>(SensorType::Temperature));
    m_sensorList->addItem(tempItem);

    auto *humItem = new QListWidgetItem(SensorFactory::sensorTypeToIcon(SensorType::Humidity) + QStringLiteral("  Humidité DHT22"));
    humItem->setData(Qt::UserRole, static_cast<int>(SensorType::Humidity));
    m_sensorList->addItem(humItem);

    auto *co2Item = new QListWidgetItem(SensorFactory::sensorTypeToIcon(SensorType::CO2) + QStringLiteral("  CO2 PIM480"));
    co2Item->setData(Qt::UserRole, static_cast<int>(SensorType::CO2));
    m_sensorList->addItem(co2Item);

    auto *vocItem = new QListWidgetItem(SensorFactory::sensorTypeToIcon(SensorType::VOC) + QStringLiteral("  VOC PIM480"));
    vocItem->setData(Qt::UserRole, static_cast<int>(SensorType::VOC));
    m_sensorList->addItem(vocItem);

    auto *camItem = new QListWidgetItem(SensorFactory::sensorTypeToIcon(SensorType::Camera) + QStringLiteral("  Caméra"));
    camItem->setData(Qt::UserRole, static_cast<int>(SensorType::Camera));
    m_sensorList->addItem(camItem);

    m_sensorList->setCurrentRow(0);
    connect(m_sensorList, &QListWidget::currentRowChanged, this, &AddSensorDialog::onSensorTypeSelected);
    layout->addWidget(m_sensorList);

    // Name input
    auto *nameLabel = new QLabel(QStringLiteral("Nom du capteur :"), this);
    layout->addWidget(nameLabel);

    m_nameEdit = new QLineEdit(this);
    m_nameEdit->setPlaceholderText(SensorFactory::defaultName(SensorType::Smoke));
    layout->addWidget(m_nameEdit);

    layout->addStretch();

    // Buttons
    auto *buttonBox = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    buttonBox->button(QDialogButtonBox::Ok)->setText(QStringLiteral("➕ Ajouter"));
    buttonBox->button(QDialogButtonBox::Cancel)->setText(QStringLiteral("❌ Annuler"));
    buttonBox->button(QDialogButtonBox::Cancel)->setObjectName(QStringLiteral("secondary"));

    connect(buttonBox, &QDialogButtonBox::accepted, this, &AddSensorDialog::onAccept);
    connect(buttonBox, &QDialogButtonBox::rejected, this, &QDialog::reject);

    layout->addWidget(buttonBox);
}

void AddSensorDialog::onSensorTypeSelected()
{
    auto *item = m_sensorList->currentItem();
    if (!item) return;

    m_selectedType = static_cast<SensorType>(item->data(Qt::UserRole).toInt());
    m_nameEdit->setPlaceholderText(SensorFactory::defaultName(m_selectedType));
}

void AddSensorDialog::onAccept()
{
    if (m_nameEdit->text().trimmed().isEmpty()) {
        m_nameEdit->setText(SensorFactory::defaultName(m_selectedType));
    }
    accept();
}

SensorConfig AddSensorDialog::getSensorConfig() const
{
    SensorConfig config;
    config.type = m_selectedType;
    config.name = m_nameEdit->text().trimmed();
    if (config.name.isEmpty()) {
        config.name = SensorFactory::defaultName(m_selectedType);
    }
    config.unit = SensorFactory::defaultUnit(m_selectedType);
    config.warningThreshold = SensorFactory::defaultWarningThreshold(m_selectedType);
    config.alarmThreshold = SensorFactory::defaultAlarmThreshold(m_selectedType);
    config.id = QStringLiteral("sensor-%1").arg(QDateTime::currentDateTime().toString(QStringLiteral("yyyyMMdd-hhmmss")));
    return config;
}
