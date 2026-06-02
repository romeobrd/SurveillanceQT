#include "databasemanager.h"
#include "camerawidget.h"

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

    // Create tables if they don't exist
    if (!createTables()) {
        return false;
    }
    createDefaultUsers();
    
    m_initialized = true;
    return true;
}

bool DatabaseManager::isInitialized() const
{
    return m_initialized;
}

bool DatabaseManager::openDatabase()
{
    // Try MySQL Connection first (WAMP)
    m_db = QSqlDatabase::addDatabase("QMYSQL", "surveillance");
    m_db.setHostName("localhost");
    m_db.setPort(3306);
    m_db.setDatabaseName("surveillance_db");
    m_db.setUserName("root");
    m_db.setPassword("");

    if (m_db.open()) {
        qDebug() << "DatabaseManager: Connected to MySQL";
        return true;
    }

    // MySQL failed, try SQLite as fallback
    qDebug() << "DatabaseManager: MySQL failed, trying SQLite fallback";
    
    m_db.close();
    m_db = QSqlDatabase::addDatabase("QSQLITE", "surveillance");
    
    // Use a file in the application directory
    QString dbPath = QCoreApplication::applicationDirPath() + "/surveillance.db";
    m_db.setDatabaseName(dbPath);

    if (!m_db.open()) {
        emit databaseError(QStringLiteral("Cannot open database: %1")
                           .arg(m_db.lastError().text()));
        return false;
    }

    qDebug() << "DatabaseManager: Connected to SQLite at" << dbPath;
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
    QSqlQuery query(m_db);

    // Users table (SQLite syntax - works with SQLite fallback)
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
        qDebug() << "DatabaseManager: Failed to create users table:" << query.lastError().text();
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
        qDebug() << "DatabaseManager: Failed to create audit_log table:" << query.lastError().text();
        emit databaseError(query.lastError().text());
        return false;
    }

    // Sensors table
    success = query.exec(
        "CREATE TABLE IF NOT EXISTS sensors ("
        "id TEXT PRIMARY KEY,"
        "name TEXT NOT NULL,"
        "ip_address TEXT,"
        "type TEXT NOT NULL,"
        "topic TEXT,"
        "last_value REAL,"
        "last_update DATETIME,"
        "is_online INTEGER DEFAULT 0"
        ")"
    );

    if (!success) {
        qDebug() << "DatabaseManager: Failed to create sensors table:" << query.lastError().text();
        emit databaseError(query.lastError().text());
        return false;
    }

    // Sensor readings history table
    success = query.exec(
        "CREATE TABLE IF NOT EXISTS sensor_readings ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "sensor_id TEXT NOT NULL,"
        "temperature REAL,"
        "humidity REAL,"
        "smoke_level INTEGER,"
        "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,"
        "FOREIGN KEY (sensor_id) REFERENCES sensors(id)"
        ")"
    );

    if (!success) {
        qDebug() << "DatabaseManager: Failed to create sensor_readings table:" << query.lastError().text();
        emit databaseError(query.lastError().text());
        return false;
    }

    qDebug() << "DatabaseManager: Tables created successfully";
    return true;
}

void DatabaseManager::createDefaultUsers()
{
    QSqlQuery checkQuery(m_db);
    checkQuery.exec("SELECT COUNT(*) FROM users");
    if (checkQuery.next() && checkQuery.value(0).toInt() > 0) {
        qDebug() << "DatabaseManager: Users already exist, skipping default creation";
        return; // Users already exist
    }

    qDebug() << "DatabaseManager: Creating default users...";

    // Admin user - tous les droits
    if (createUser("admin", "admin123", UserRole::Admin,
               "Administrateur", "admin@surveillance.local")) {
        qDebug() << "DatabaseManager: Created admin user";
    }

    // Operator user - droits moyens
    if (createUser("operateur", "operateur123", UserRole::Operator,
               "Opérateur", "operateur@surveillance.local")) {
        qDebug() << "DatabaseManager: Created operateur user";
    }

    // Viewer user - lecture seule
    if (createUser("visiteur", "visiteur123", UserRole::Viewer,
               "Visiteur", "visiteur@surveillance.local")) {
        qDebug() << "DatabaseManager: Created visiteur user";
    }

    // Register default sensors (topics match raspberry_nodes.json + publisher scripts)
    registerSensor("rpi-001", "Raspberry 1 Temperature", "200.26.16.10", "temperature", "rpi-001/sensors/temperature");
    registerSensor("rpi-002", "Raspberry 2 Camera",      "200.26.16.20", "camera",      "rpi-002/camera/stream");
    registerSensor("rpi-003", "Raspberry 3 Smoke",       "200.26.16.30", "smoke",       "rpi-003/sensors/smoke");
    registerSensor("rpi-004", "Raspberry 4 Display",     "200.26.16.40", "display",     "");

    qDebug() << "DatabaseManager: Default users and sensors created";
}

bool DatabaseManager::createUser(const QString &username, const QString &password,
                                  UserRole role, const QString &fullName,
                                  const QString &email)
{
    QSqlQuery query(m_db);
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
    QSqlQuery query(m_db);
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
    QSqlQuery query(m_db);
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
    QSqlQuery query(m_db);
    query.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = :username");
    query.bindValue(":username", username);
    return query.exec();
}

bool DatabaseManager::changePassword(const QString &username, const QString &oldPassword,
                                      const QString &newPassword)
{
    // Verify old password
    QSqlQuery query(m_db);
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
    QSqlQuery query(m_db);
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
    QSqlQuery query(m_db);
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

// Sensor management methods
bool DatabaseManager::registerSensor(const QString &id, const QString &name, const QString &ip,
                                      const QString &type, const QString &topic)
{
    QSqlQuery query(m_db);
    query.prepare("INSERT OR REPLACE INTO sensors (id, name, ip_address, type, topic, is_online) "
                  "VALUES (:id, :name, :ip, :type, :topic, 1)");
    query.bindValue(":id", id);
    query.bindValue(":name", name);
    query.bindValue(":ip", ip);
    query.bindValue(":type", type);
    query.bindValue(":topic", topic);

    if (!query.exec()) {
        qDebug() << "DatabaseManager: Failed to register sensor:" << query.lastError().text();
        return false;
    }

    qDebug() << "DatabaseManager: Registered sensor" << id << name;
    return true;
}

bool DatabaseManager::updateSensorValue(const QString &id, double value)
{
    QSqlQuery query(m_db);
    query.prepare("UPDATE sensors SET last_value = :value, last_update = CURRENT_TIMESTAMP, "
                  "is_online = 1 WHERE id = :id");
    query.bindValue(":value", value);
    query.bindValue(":id", id);

    if (!query.exec()) {
        qDebug() << "DatabaseManager: Failed to update sensor value:" << query.lastError().text();
        return false;
    }

    return true;
}

bool DatabaseManager::setSensorOnline(const QString &id, bool online)
{
    QSqlQuery query(m_db);
    query.prepare("UPDATE sensors SET is_online = :online WHERE id = :id");
    query.bindValue(":online", online ? 1 : 0);
    query.bindValue(":id", id);

    return query.exec();
}

QVector<Sensor> DatabaseManager::getAllSensors()
{
    QVector<Sensor> sensors;
    QSqlQuery query(m_db);
    query.exec("SELECT id, name, ip_address, type, topic, last_value, last_update, is_online FROM sensors");

    while (query.next()) {
        Sensor s;
        s.id = query.value(0).toString();
        s.name = query.value(1).toString();
        s.ipAddress = query.value(2).toString();
        s.type = query.value(3).toString();
        s.topic = query.value(4).toString();
        s.lastValue = query.value(5).toDouble();
        s.lastUpdate = query.value(6).toDateTime();
        s.isOnline = query.value(7).toInt() == 1;
        sensors.append(s);
    }

    return sensors;
}

Sensor DatabaseManager::getSensor(const QString &id)
{
    Sensor s;
    QSqlQuery query(m_db);
    query.prepare("SELECT id, name, ip_address, type, topic, last_value, last_update, is_online "
                  "FROM sensors WHERE id = :id");
    query.bindValue(":id", id);

    if (query.exec() && query.next()) {
        s.id = query.value(0).toString();
        s.name = query.value(1).toString();
        s.ipAddress = query.value(2).toString();
        s.type = query.value(3).toString();
        s.topic = query.value(4).toString();
        s.lastValue = query.value(5).toDouble();
        s.lastUpdate = query.value(6).toDateTime();
        s.isOnline = query.value(7).toInt() == 1;
    }

    return s;
}

// Sensor readings history methods
bool DatabaseManager::saveTemperatureReading(const QString &sensorId, double temperature, double humidity)
{
    QSqlQuery query(m_db);
    query.prepare("INSERT INTO sensor_readings (sensor_id, temperature, humidity) "
                  "VALUES (:sensor_id, :temperature, :humidity)");
    query.bindValue(":sensor_id", sensorId);
    query.bindValue(":temperature", temperature);
    query.bindValue(":humidity", humidity);

    if (!query.exec()) {
        qDebug() << "DatabaseManager: Failed to save temperature reading:" << query.lastError().text();
        return false;
    }

    // Also update the sensors table
    updateSensorValue(sensorId, temperature);
    return true;
}

bool DatabaseManager::saveSmokeReading(const QString &sensorId, int smokeLevel)
{
    QSqlQuery query(m_db);
    query.prepare("INSERT INTO sensor_readings (sensor_id, smoke_level) "
                  "VALUES (:sensor_id, :smoke_level)");
    query.bindValue(":sensor_id", sensorId);
    query.bindValue(":smoke_level", smokeLevel);

    if (!query.exec()) {
        qDebug() << "DatabaseManager: Failed to save smoke reading:" << query.lastError().text();
        return false;
    }

    // Also update the sensors table
    updateSensorValue(sensorId, smokeLevel);
    return true;
}

QVector<QPair<QDateTime, double>> DatabaseManager::getTemperatureHistory(const QString &sensorId, int hours)
{
    QVector<QPair<QDateTime, double>> history;
    QSqlQuery query(m_db);
    query.prepare("SELECT timestamp, temperature FROM sensor_readings "
                  "WHERE sensor_id = :sensor_id AND temperature IS NOT NULL "
                  "AND timestamp >= datetime('now', :hours) "
                  "ORDER BY timestamp ASC");
    query.bindValue(":sensor_id", sensorId);
    query.bindValue(":hours", QString("-%1 hours").arg(hours));

    if (query.exec()) {
        while (query.next()) {
            history.append(qMakePair(query.value(0).toDateTime(), query.value(1).toDouble()));
        }
    }

    return history;
}

QVector<QPair<QDateTime, int>> DatabaseManager::getSmokeHistory(const QString &sensorId, int hours)
{
    QVector<QPair<QDateTime, int>> history;
    QSqlQuery query(m_db);
    query.prepare("SELECT timestamp, smoke_level FROM sensor_readings "
                  "WHERE sensor_id = :sensor_id AND smoke_level IS NOT NULL "
                  "AND timestamp >= datetime('now', :hours) "
                  "ORDER BY timestamp ASC");
    query.bindValue(":sensor_id", sensorId);
    query.bindValue(":hours", QString("-%1 hours").arg(hours));

    if (query.exec()) {
        while (query.next()) {
            history.append(qMakePair(query.value(0).toDateTime(), query.value(1).toInt()));
        }
    }

    return history;
}

// Latest sensor data methods
double DatabaseManager::getLatestTemperature(const QString &sensorId)
{
    QSqlQuery query(m_db);
    query.prepare("SELECT temperature FROM sensor_readings "
                  "WHERE sensor_id = :sensor_id AND temperature IS NOT NULL "
                  "ORDER BY timestamp DESC LIMIT 1");
    query.bindValue(":sensor_id", sensorId);

    if (query.exec() && query.next()) {
        return query.value(0).toDouble();
    }
    return -999.0; // Error value
}

double DatabaseManager::getLatestHumidity(const QString &sensorId)
{
    QSqlQuery query(m_db);
    query.prepare("SELECT humidity FROM sensor_readings "
                  "WHERE sensor_id = :sensor_id AND humidity IS NOT NULL "
                  "ORDER BY timestamp DESC LIMIT 1");
    query.bindValue(":sensor_id", sensorId);

    if (query.exec() && query.next()) {
        return query.value(0).toDouble();
    }
    return -999.0; // Error value
}

int DatabaseManager::getLatestSmokeLevel(const QString &sensorId)
{
    QSqlQuery query(m_db);
    query.prepare("SELECT smoke_level FROM sensor_readings "
                  "WHERE sensor_id = :sensor_id AND smoke_level IS NOT NULL "
                  "ORDER BY timestamp DESC LIMIT 1");
    query.bindValue(":sensor_id", sensorId);

    if (query.exec() && query.next()) {
        return query.value(0).toInt();
    }
    return -1; // Error value
}

QDateTime DatabaseManager::getLastUpdateTime(const QString &sensorId)
{
    QSqlQuery query(m_db);
    query.prepare("SELECT timestamp FROM sensor_readings "
                  "WHERE sensor_id = :sensor_id "
                  "ORDER BY timestamp DESC LIMIT 1");
    query.bindValue(":sensor_id", sensorId);

    if (query.exec() && query.next()) {
        return query.value(0).toDateTime();
    }
    return QDateTime();
}
