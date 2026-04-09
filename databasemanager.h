#pragma once

#include <QObject>
#include <QString>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QDateTime>

enum class UserRole {
    Admin,      // Tous les droits
    Operator,   // Droits moyens (modifier certains paramètres)
    Viewer      // Lecture seule
};

struct User {
    int id;
    QString username;
    QString password;
    UserRole role;
    QString fullName;
    QString email;
    bool isActive;
    QDateTime lastLogin;
    QDateTime createdAt;

    bool hasPermission(const QString &permission) const;
    QString getRoleString() const;
    bool canEditWidgets() const;
    bool canManageModules() const;
    bool canConfigureSystem() const;
    bool canViewSensors() const;
};

class DatabaseManager : public QObject {
    Q_OBJECT

public:
    explicit DatabaseManager(QObject *parent = nullptr);
    ~DatabaseManager();

    bool initialize();
    bool isInitialized() const;

    // User management
    bool createUser(const QString &username, const QString &password,
                    UserRole role, const QString &fullName = QString(),
                    const QString &email = QString());
    bool authenticateUser(const QString &username, const QString &password);
    User getUser(const QString &username);
    User getCurrentUser() const;
    bool updateLastLogin(const QString &username);
    bool changePassword(const QString &username, const QString &oldPassword,
                        const QString &newPassword);
    bool deactivateUser(const QString &username);
    QVector<User> getAllUsers();

    // Default users initialization
    void createDefaultUsers();

    // Session management
    void setCurrentUser(const User &user);
    void clearCurrentUser();
    bool isUserLoggedIn() const;

    // Audit log
    bool logAction(const QString &username, const QString &action,
                   const QString &details = QString());

    static QString roleToString(UserRole role);
    static UserRole stringToRole(const QString &role);

signals:
    void userAuthenticated(const User &user);
    void userLoggedOut();
    void authenticationFailed(const QString &reason);
    void databaseError(const QString &error);

private:
    bool createTables();
    bool openDatabase();
    void closeDatabase();
    QString hashPassword(const QString &password);

    QSqlDatabase m_db;
    bool m_initialized;
    User m_currentUser;
};
