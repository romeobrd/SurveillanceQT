#include "databasemanager.h"

#include <QSqlError>
#include <QSqlRecord>
#include <QCryptographicHash>
#include <QCoreApplication>
#include <QDir>
#include <QDebug>

DatabaseManager::DatabaseManager(QObject *parent)
    : QObject(parent)
    , m_initialized(false)
{
}

DatabaseManager::~DatabaseManager()
{
    closeDatabase();
}

bool DatabaseManager::initialize()
{
    if (m_initialized) {
        return true;
    }

    if (!openDatabase()) {
        return false;
    }

    // For MySQL, tables are created by the SQL script
    // Only create tables for SQLite
    if (m_db.driverName() == "QSQLITE") {
        if (!createTables()) {
            return false;
        }
        createDefaultUsers();
    }
    m_initialized = true;
    return true;
}

bool DatabaseManager::isInitialized() const
{
    return m_initialized;
}

bool DatabaseManager::openDatabase()
{
    // MySQL Connection for WAMP
    m_db = QSqlDatabase::addDatabase("QMYSQL");
    m_db.setHostName("localhost");
    m_db.setPort(3306);
    m_db.setDatabaseName("surveillance_db");
    m_db.setUserName("root");      // Default WAMP user
    m_db.setPassword("");          // Default WAMP has no password

    if (!m_db.open()) {
        emit databaseError(QStringLiteral("Erreur MySQL: %1")
                           .arg(m_db.lastError().text()));
        return false;
    }

    return true;
}

void DatabaseManager::closeDatabase()
{
    if (m_db.isOpen()) {
        m_db.close();
    }
}

bool DatabaseManager::createTables()
{
    QSqlQuery query;

    // Users table
    bool success = query.exec(
        "CREATE TABLE IF NOT EXISTS users ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "username TEXT UNIQUE NOT NULL,"
        "password TEXT NOT NULL,"
        "role TEXT NOT NULL DEFAULT 'viewer',"
        "full_name TEXT,"
        "email TEXT,"
        "is_active INTEGER DEFAULT 1,"
        "last_login DATETIME,"
        "created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
        ")"
    );

    if (!success) {
        emit databaseError(query.lastError().text());
        return false;
    }

    // Audit log table
    success = query.exec(
        "CREATE TABLE IF NOT EXISTS audit_log ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "username TEXT NOT NULL,"
        "action TEXT NOT NULL,"
        "details TEXT,"
        "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP"
        ")"
    );

    if (!success) {
        emit databaseError(query.lastError().text());
        return false;
    }

    return true;
}

void DatabaseManager::createDefaultUsers()
{
    QSqlQuery checkQuery("SELECT COUNT(*) FROM users");
    if (checkQuery.next() && checkQuery.value(0).toInt() > 0) {
        return; // Users already exist
    }

    // Admin user - tous les droits
    createUser("admin", "admin123", UserRole::Admin,
               "Administrateur", "admin@surveillance.local");

    // Operator user - droits moyens
    createUser("operateur", "operateur123", UserRole::Operator,
               "Opérateur", "operateur@surveillance.local");

    // Viewer user - lecture seule
    createUser("visiteur", "visiteur123", UserRole::Viewer,
               "Visiteur", "visiteur@surveillance.local");
}

bool DatabaseManager::createUser(const QString &username, const QString &password,
                                  UserRole role, const QString &fullName,
                                  const QString &email)
{
    QSqlQuery query;
    query.prepare("INSERT INTO users (username, password, role, full_name, email) "
                  "VALUES (:username, :password, :role, :full_name, :email)");
    query.bindValue(":username", username);
    query.bindValue(":password", hashPassword(password));
    query.bindValue(":role", roleToString(role));
    query.bindValue(":full_name", fullName);
    query.bindValue(":email", email);

    if (!query.exec()) {
        emit databaseError(query.lastError().text());
        return false;
    }

    return true;
}

bool DatabaseManager::authenticateUser(const QString &username, const QString &password)
{
    QSqlQuery query;
    query.prepare("SELECT * FROM users WHERE username = :username AND is_active = 1");
    query.bindValue(":username", username);

    if (!query.exec()) {
        emit databaseError(query.lastError().text());
        emit authenticationFailed("Erreur de base de données");
        return false;
    }

    if (!query.next()) {
        emit authenticationFailed("Utilisateur inconnu ou désactivé");
        return false;
    }

    QString storedHash = query.value("password").toString();
    if (storedHash != hashPassword(password)) {
        emit authenticationFailed("Mot de passe incorrect");
        logAction(username, "AUTH_FAILED", "Mot de passe incorrect");
        return false;
    }

    User user;
    user.id = query.value("id").toInt();
    user.username = query.value("username").toString();
    user.role = stringToRole(query.value("role").toString());
    user.fullName = query.value("full_name").toString();
    user.email = query.value("email").toString();
    user.isActive = query.value("is_active").toBool();
    user.lastLogin = query.value("last_login").toDateTime();
    user.createdAt = query.value("created_at").toDateTime();

    setCurrentUser(user);
    updateLastLogin(username);
    logAction(username, "LOGIN", "Connexion réussie");

    emit userAuthenticated(user);
    return true;
}

User DatabaseManager::getUser(const QString &username)
{
    QSqlQuery query;
    query.prepare("SELECT * FROM users WHERE username = :username");
    query.bindValue(":username", username);

    if (!query.exec() || !query.next()) {
        return User();
    }

    User user;
    user.id = query.value("id").toInt();
    user.username = query.value("username").toString();
    user.role = stringToRole(query.value("role").toString());
    user.fullName = query.value("full_name").toString();
    user.email = query.value("email").toString();
    user.isActive = query.value("is_active").toBool();
    user.lastLogin = query.value("last_login").toDateTime();
    user.createdAt = query.value("created_at").toDateTime();

    return user;
}

User DatabaseManager::getCurrentUser() const
{
    return m_currentUser;
}

bool DatabaseManager::updateLastLogin(const QString &username)
{
    QSqlQuery query;
    query.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = :username");
    query.bindValue(":username", username);
    return query.exec();
}

bool DatabaseManager::changePassword(const QString &username, const QString &oldPassword,
                                      const QString &newPassword)
{
    // Verify old password
    QSqlQuery query;
    query.prepare("SELECT password FROM users WHERE username = :username");
    query.bindValue(":username", username);

    if (!query.exec() || !query.next()) {
        return false;
    }

    QString storedHash = query.value(0).toString();
    if (storedHash != hashPassword(oldPassword)) {
        return false;
    }

    // Update password
    query.prepare("UPDATE users SET password = :password WHERE username = :username");
    query.bindValue(":password", hashPassword(newPassword));
    query.bindValue(":username", username);

    return query.exec();
}

bool DatabaseManager::deactivateUser(const QString &username)
{
    QSqlQuery query;
    query.prepare("UPDATE users SET is_active = 0 WHERE username = :username");
    query.bindValue(":username", username);
    return query.exec();
}

QVector<User> DatabaseManager::getAllUsers()
{
    QVector<User> users;
    QSqlQuery query("SELECT * FROM users ORDER BY created_at");

    while (query.next()) {
        User user;
        user.id = query.value("id").toInt();
        user.username = query.value("username").toString();
        user.role = stringToRole(query.value("role").toString());
        user.fullName = query.value("full_name").toString();
        user.email = query.value("email").toString();
        user.isActive = query.value("is_active").toBool();
        user.lastLogin = query.value("last_login").toDateTime();
        user.createdAt = query.value("created_at").toDateTime();
        users.append(user);
    }

    return users;
}

void DatabaseManager::setCurrentUser(const User &user)
{
    m_currentUser = user;
}

void DatabaseManager::clearCurrentUser()
{
    if (isUserLoggedIn()) {
        logAction(m_currentUser.username, "LOGOUT", "Déconnexion");
    }
    m_currentUser = User();
    emit userLoggedOut();
}

bool DatabaseManager::isUserLoggedIn() const
{
    return !m_currentUser.username.isEmpty();
}

bool DatabaseManager::logAction(const QString &username, const QString &action,
                                 const QString &details)
{
    QSqlQuery query;
    query.prepare("INSERT INTO audit_log (username, action, details) "
                  "VALUES (:username, :action, :details)");
    query.bindValue(":username", username);
    query.bindValue(":action", action);
    query.bindValue(":details", details);
    return query.exec();
}

QString DatabaseManager::roleToString(UserRole role)
{
    switch (role) {
    case UserRole::Admin: return "admin";
    case UserRole::Operator: return "operator";
    case UserRole::Viewer: return "viewer";
    default: return "viewer";
    }
}

UserRole DatabaseManager::stringToRole(const QString &role)
{
    if (role == "admin") return UserRole::Admin;
    if (role == "operator") return UserRole::Operator;
    return UserRole::Viewer;
}

QString DatabaseManager::hashPassword(const QString &password)
{
    return QString(QCryptographicHash::hash(password.toUtf8(), QCryptographicHash::Sha256).toHex());
}

// User struct methods
bool User::hasPermission(const QString &permission) const
{
    if (role == UserRole::Admin) return true;
    if (role == UserRole::Operator) {
        return permission != "manage_users" && permission != "configure_system";
    }
    return permission == "view_sensors";
}

QString User::getRoleString() const
{
    switch (role) {
    case UserRole::Admin: return "Administrateur";
    case UserRole::Operator: return "Opérateur";
    case UserRole::Viewer: return "Visiteur";
    default: return "Inconnu";
    }
}

bool User::canEditWidgets() const
{
    return role == UserRole::Admin || role == UserRole::Operator;
}

bool User::canManageModules() const
{
    return role == UserRole::Admin;
}

bool User::canConfigureSystem() const
{
    return role == UserRole::Admin;
}

bool User::canViewSensors() const
{
    return true; // All roles can view
}
