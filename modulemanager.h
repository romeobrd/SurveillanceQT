#pragma once

#include <QDialog>
#include <QVector>

class QListWidget;
class QPushButton;
class QLabel;

struct ModuleInfo {
    int id;
    QString name;
    QString type;
    QString ipAddress;
    bool enabled;
};

class ModuleManager : public QDialog {
    Q_OBJECT

public:
    explicit ModuleManager(QWidget *parent = nullptr);

    QVector<ModuleInfo> modules() const;

private slots:
    void onAddModule();
    void onEditModule();
    void onDeleteModule();
    void onModuleSelectionChanged();
    void onMoveUp();
    void onMoveDown();

private:
    void setupUi();
    void refreshModuleList();
    void loadModules();
    void saveModules();
    QString getModuleIcon(const QString &type) const;
    QString formatModuleText(const ModuleInfo &module) const;

    QListWidget *m_moduleList;
    QPushButton *m_addButton;
    QPushButton *m_editButton;
    QPushButton *m_deleteButton;
    QPushButton *m_moveUpButton;
    QPushButton *m_moveDownButton;

    QVector<ModuleInfo> m_modules;
    int m_nextId;
};
