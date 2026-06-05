#include "modulemanager.h"

#include "widgeteditor.h"

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QListWidget>
#include <QPushButton>
#include <QMessageBox>
#include <QInputDialog>
#include <QComboBox>
#include <QLineEdit>
#include <QFormLayout>
#include <QDialogButtonBox>

ModuleManager::ModuleManager(QWidget *parent)
    : QDialog(parent)
    , m_moduleList(nullptr)
    , m_addButton(nullptr)
    , m_editButton(nullptr)
    , m_deleteButton(nullptr)
    , m_moveUpButton(nullptr)
    , m_moveDownButton(nullptr)
    , m_nextId(1)
{
    setWindowTitle(QStringLiteral("⚙️ Gestion des Modules"));
    setMinimumSize(600, 500);
    setupUi();
    loadModules();
}

void ModuleManager::setupUi()
{
    setStyleSheet(
        "QDialog { background: #1a1a2e; }"
        "QLabel { color: #eee; font-size: 13px; }"
        "QListWidget {"
        "  background: #16213e; border: 1px solid #2d3a5c; border-radius: 8px;"
        "  color: #eee; font-size: 14px; padding: 10px;"
        "}"
        "QListWidget::item { padding: 12px; border-bottom: 1px solid #2d3a5c; }"
        "QListWidget::item:selected { background: #4a90d9; }"
        "QPushButton {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #4a90d9, stop:1 #357abd);"
        "  color: white; border: none; border-radius: 6px; padding: 10px 15px;"
        "  font-size: 13px; font-weight: 600; min-width: 100px;"
        "}"
        "QPushButton:hover { background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #5aa0e9, stop:1 #458acd); }"
        "QPushButton:disabled { background: #555; color: #888; }"
        "QPushButton#danger {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #e74c3c, stop:1 #c0392b);"
        "}"
        "QPushButton#danger:hover {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #ff6b6b, stop:1 #e74c3c);"
        "}"
        "QPushButton#secondary {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #6c757d, stop:1 #5a6268);"
        "}"
        );

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setSpacing(15);
    mainLayout->setContentsMargins(20, 20, 20, 20);

    auto *headerLabel = new QLabel(QStringLiteral("⚙️ Gestion des Modules de Surveillance"), this);
    headerLabel->setStyleSheet("font-size: 20px; font-weight: 700; color: #4a90d9; margin-bottom: 10px;");
    mainLayout->addWidget(headerLabel);

    auto *descLabel = new QLabel(
        QStringLiteral("Ajoutez, modifiez ou supprimez les modules connectés à votre système."),
        this);
    descLabel->setStyleSheet("color: #aaa; margin-bottom: 10px;");
    mainLayout->addWidget(descLabel);

    auto *contentLayout = new QHBoxLayout();

    m_moduleList = new QListWidget(this);
    m_moduleList->setSelectionMode(QAbstractItemView::SingleSelection);
    connect(m_moduleList, &QListWidget::itemSelectionChanged,
            this, &ModuleManager::onModuleSelectionChanged);
    contentLayout->addWidget(m_moduleList, 1);

    auto *buttonLayout = new QVBoxLayout();
    buttonLayout->setSpacing(10);

    m_addButton = new QPushButton(QStringLiteral("➕ Ajouter"), this);
    connect(m_addButton, &QPushButton::clicked, this, &ModuleManager::onAddModule);
    buttonLayout->addWidget(m_addButton);

    m_editButton = new QPushButton(QStringLiteral("✏️ Modifier"), this);
    m_editButton->setEnabled(false);
    connect(m_editButton, &QPushButton::clicked, this, &ModuleManager::onEditModule);
    buttonLayout->addWidget(m_editButton);

    m_deleteButton = new QPushButton(QStringLiteral("🗑️ Supprimer"), this);
    m_deleteButton->setObjectName(QStringLiteral("danger"));
    m_deleteButton->setEnabled(false);
    connect(m_deleteButton, &QPushButton::clicked, this, &ModuleManager::onDeleteModule);
    buttonLayout->addWidget(m_deleteButton);

    buttonLayout->addSpacing(20);

    m_moveUpButton = new QPushButton(QStringLiteral("⬆️ Monter"), this);
    m_moveUpButton->setObjectName(QStringLiteral("secondary"));
    m_moveUpButton->setEnabled(false);
    connect(m_moveUpButton, &QPushButton::clicked, this, &ModuleManager::onMoveUp);
    buttonLayout->addWidget(m_moveUpButton);

    m_moveDownButton = new QPushButton(QStringLiteral("⬇️ Descendre"), this);
    m_moveDownButton->setObjectName(QStringLiteral("secondary"));
    m_moveDownButton->setEnabled(false);
    connect(m_moveDownButton, &QPushButton::clicked, this, &ModuleManager::onMoveDown);
    buttonLayout->addWidget(m_moveDownButton);

    buttonLayout->addStretch();

    contentLayout->addLayout(buttonLayout);
    mainLayout->addLayout(contentLayout, 1);

    auto *closeButton = new QPushButton(QStringLiteral("Fermer"), this);
    closeButton->setObjectName(QStringLiteral("secondary"));
    connect(closeButton, &QPushButton::clicked, this, &QDialog::accept);
    mainLayout->addWidget(closeButton, 0, Qt::AlignRight);
}

void ModuleManager::loadModules()
{
    m_modules.clear();

    m_modules.append({ 1, QStringLiteral("Capteur Fumée Principal"), QStringLiteral("Fumée MQ-2"),
                       QStringLiteral("200.26.16.30"), true });
    m_modules.append({ 2, QStringLiteral("Température Salle Serveur"), QStringLiteral("Température DHT22"),
                       QStringLiteral("200.26.16.10"), true });
    m_modules.append({ 3, QStringLiteral("Caméra Surveillance"), QStringLiteral("Caméra"),
                       QStringLiteral("200.26.16.20"), true });
    m_modules.append({ 4, QStringLiteral("Qualité d'Air"), QStringLiteral("CO2 PIM480"),
                       QStringLiteral("200.26.16.30"), true });

    m_nextId = 5;
    refreshModuleList();
}

void ModuleManager::saveModules()
{
}

void ModuleManager::refreshModuleList()
{
    m_moduleList->clear();
    for (const auto &module : m_modules) {
        auto *item = new QListWidgetItem(formatModuleText(module));
        item->setData(Qt::UserRole, module.id);
        if (!module.enabled) {
            item->setForeground(QColor(150, 150, 150));
        }
        m_moduleList->addItem(item);
    }
}

QString ModuleManager::formatModuleText(const ModuleInfo &module) const
{
    QString status = module.enabled ? QStringLiteral("✅") : QStringLiteral("⏸️");
    QString icon = getModuleIcon(module.type);
    return QStringLiteral("%1 %2 %3 | %4 | %5")
           .arg(status, icon, module.name, module.type, module.ipAddress);
}

QString ModuleManager::getModuleIcon(const QString &type) const
{
    if (type.contains(QStringLiteral("Fumée"))) return QStringLiteral("🔥");
    if (type.contains(QStringLiteral("Température"))) return QStringLiteral("🌡️");
    if (type.contains(QStringLiteral("Humidité"))) return QStringLiteral("💧");
    if (type.contains(QStringLiteral("CO2")) || type.contains(QStringLiteral("Air"))) return QStringLiteral("🌫️");
    if (type.contains(QStringLiteral("VOC"))) return QStringLiteral("💨");
    if (type.contains(QStringLiteral("Caméra"))) return QStringLiteral("📹");
    if (type.contains(QStringLiteral("Radiation"))) return QStringLiteral("☢️");
    return QStringLiteral("📟");
}

void ModuleManager::onAddModule()
{
    QDialog dialog(this);
    dialog.setWindowTitle(QStringLiteral("➕ Ajouter un Module"));
    dialog.setMinimumWidth(350);

    auto *layout = new QVBoxLayout(&dialog);

    auto *formLayout = new QFormLayout();

    auto *nameEdit = new QLineEdit(&dialog);
    nameEdit->setPlaceholderText(QStringLiteral("Nom du module"));
    formLayout->addRow(QStringLiteral("Nom:"), nameEdit);

    auto *typeCombo = new QComboBox(&dialog);
    typeCombo->addItems({
        QStringLiteral("Fumée MQ-2"),
        QStringLiteral("Température DHT22"),
        QStringLiteral("Humidité DHT22"),
        QStringLiteral("CO2 PIM480"),
        QStringLiteral("VOC PIM480"),
        QStringLiteral("Caméra"),
        QStringLiteral("Radiation")
    });
    formLayout->addRow(QStringLiteral("Type:"), typeCombo);

    auto *ipEdit = new QLineEdit(&dialog);
    ipEdit->setPlaceholderText(QStringLiteral("200.26.16.XX"));
    formLayout->addRow(QStringLiteral("IP:"), ipEdit);

    layout->addLayout(formLayout);

    auto *buttonBox = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, &dialog);
    connect(buttonBox, &QDialogButtonBox::accepted, &dialog, &QDialog::accept);
    connect(buttonBox, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    layout->addWidget(buttonBox);

    if (dialog.exec() == QDialog::Accepted && !nameEdit->text().isEmpty()) {
        ModuleInfo newModule;
        newModule.id = m_nextId++;
        newModule.name = nameEdit->text();
        newModule.type = typeCombo->currentText();
        newModule.ipAddress = ipEdit->text().isEmpty() ? QStringLiteral("Non configuré") : ipEdit->text();
        newModule.enabled = true;

        m_modules.append(newModule);
        refreshModuleList();
    }
}

void ModuleManager::onEditModule()
{
    int currentRow = m_moduleList->currentRow();
    if (currentRow < 0 || currentRow >= m_modules.size()) return;

    ModuleInfo &module = m_modules[currentRow];

    QDialog dialog(this);
    dialog.setWindowTitle(QStringLiteral("✏️ Modifier le Module"));
    dialog.setMinimumWidth(350);

    auto *layout = new QVBoxLayout(&dialog);

    auto *formLayout = new QFormLayout();

    auto *nameEdit = new QLineEdit(module.name, &dialog);
    formLayout->addRow(QStringLiteral("Nom:"), nameEdit);

    auto *typeCombo = new QComboBox(&dialog);
    typeCombo->addItems({
        QStringLiteral("Fumée MQ-2"),
        QStringLiteral("Température DHT22"),
        QStringLiteral("Humidité DHT22"),
        QStringLiteral("CO2 PIM480"),
        QStringLiteral("VOC PIM480"),
        QStringLiteral("Caméra"),
        QStringLiteral("Radiation")
    });
    typeCombo->setCurrentText(module.type);
    formLayout->addRow(QStringLiteral("Type:"), typeCombo);

    auto *ipEdit = new QLineEdit(module.ipAddress, &dialog);
    formLayout->addRow(QStringLiteral("IP:"), ipEdit);

    layout->addLayout(formLayout);

    auto *buttonBox = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, &dialog);
    connect(buttonBox, &QDialogButtonBox::accepted, &dialog, &QDialog::accept);
    connect(buttonBox, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    layout->addWidget(buttonBox);

    if (dialog.exec() == QDialog::Accepted) {
        module.name = nameEdit->text();
        module.type = typeCombo->currentText();
        module.ipAddress = ipEdit->text();
        refreshModuleList();
    }
}

void ModuleManager::onDeleteModule()
{
    int currentRow = m_moduleList->currentRow();
    if (currentRow < 0 || currentRow >= m_modules.size()) return;

    const ModuleInfo &module = m_modules[currentRow];

    auto reply = QMessageBox::question(this,
                                       QStringLiteral("Supprimer le module"),
                                       QStringLiteral("Êtes-vous sûr de vouloir supprimer '%1' ?")
                                       .arg(module.name),
                                       QMessageBox::Yes | QMessageBox::No);

    if (reply == QMessageBox::Yes) {
        m_modules.removeAt(currentRow);
        refreshModuleList();
    }
}

void ModuleManager::onModuleSelectionChanged()
{
    bool hasSelection = m_moduleList->currentRow() >= 0;
    m_editButton->setEnabled(hasSelection);
    m_deleteButton->setEnabled(hasSelection);
    m_moveUpButton->setEnabled(hasSelection && m_moduleList->currentRow() > 0);
    m_moveDownButton->setEnabled(hasSelection && m_moduleList->currentRow() < m_moduleList->count() - 1);
}

void ModuleManager::onMoveUp()
{
    int currentRow = m_moduleList->currentRow();
    if (currentRow > 0) {
        m_modules.swapItemsAt(currentRow, currentRow - 1);
        refreshModuleList();
        m_moduleList->setCurrentRow(currentRow - 1);
    }
}

void ModuleManager::onMoveDown()
{
    int currentRow = m_moduleList->currentRow();
    if (currentRow < m_modules.size() - 1) {
        m_modules.swapItemsAt(currentRow, currentRow + 1);
        refreshModuleList();
        m_moduleList->setCurrentRow(currentRow + 1);
    }
}

QVector<ModuleInfo> ModuleManager::modules() const
{
    return m_modules;
}
