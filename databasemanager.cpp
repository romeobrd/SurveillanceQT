#include "databasemanager.h"

#include <QCryptographicHash>
#include <QDebug>
#include <QSqlError>
#include <QSqlQuery>

namespace {
// Paramètres de connexion à la base MySQL du projet.
const QString kConnectionName = QStringLiteral("surveillance");
const QString kDbHost         = QStringLiteral("200.26.16.168");
const int     kDbPort         = 3306;
const QString kDbName         = QStringLiteral("surveillance_db");
const QString kDbUser         = QStringLiteral("surveillance_user");
const QString kDbPassword     = QStringLiteral("Mot2PassefgazhtkM:--_fort(tybrther)");
} // namespace

// =====================================================================
//  CONSTRUCTION / INITIALISATION
// =====================================================================
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
    if (m_initialized)
        return true;

    if (!openDatabase())
        return false;

    if (!createTables())
        return false;

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
    qDebug() << "DatabaseManager: drivers SQL disponibles =" << QSqlDatabase::drivers();

    // Si une connexion du même nom existe déjà (ré-initialisation),
    // on la supprime avant d'en recréer une.
    if (QSqlDatabase::contains(kConnectionName))
        QSqlDatabase::removeDatabase(kConnectionName);

    if (!QSqlDatabase::isDriverAvailable(QStringLiteral("QMYSQL"))) {
        qWarning() << "DatabaseManager: driver QMYSQL indisponible";
        emit databaseError(QStringLiteral("Driver MySQL (QMYSQL) indisponible"));
        return false;
    }

    m_db = QSqlDatabase::addDatabase(QStringLiteral("QMYSQL"), kConnectionName);
    m_db.setHostName(kDbHost);
    m_db.setPort(kDbPort);
    m_db.setDatabaseName(kDbName);
    m_db.setUserName(kDbUser);
    m_db.setPassword(kDbPassword);
    m_db.setConnectOptions(QStringLiteral("MYSQL_OPT_SSL_MODE=SSL_MODE_DISABLED"));

    if (!m_db.open()) {
        qWarning() << "DatabaseManager: échec de connexion MySQL:"
                   << m_db.lastError().text();
        emit databaseError(m_db.lastError().text());
        m_db.close();
        QSqlDatabase::removeDatabase(kConnectionName);
        return false;
    }

    qDebug() << "DatabaseManager: connecté à MySQL"
             << kDbHost << ":" << kDbPort << "/" << kDbName;
    return true;
}

void DatabaseManager::closeDatabase()
{
    if (m_db.isOpen())
        m_db.close();
}

// =====================================================================
//  CRÉATION DES TABLES
// =====================================================================
bool DatabaseManager::createTables()
{
    QSqlQuery query(m_db);

    // ---- Table users : comptes et rôles ----
    const QString sqlUsers = QStringLiteral(
        "CREATE TABLE IF NOT EXISTS users ("
        "id INT AUTO_INCREMENT PRIMARY KEY,"
        "username VARCHAR(50) NOT NULL UNIQUE,"
        "password VARCHAR(255) NOT NULL,"
        "role VARCHAR(20) NOT NULL DEFAULT 'viewer',"
        "full_name VARCHAR(100),"
        "email VARCHAR(100),"
        "is_active TINYINT(1) DEFAULT 1,"
        "last_login DATETIME NULL,"
        "created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    if (!query.exec(sqlUsers)) {
        qWarning() << "DatabaseManager: échec création table users:" << query.lastError().text();
        emit databaseError(query.lastError().text());
        return false;
    }

    // ---- Table audit_log : journal des actions ----
    const QString sqlAudit = QStringLiteral(
        "CREATE TABLE IF NOT EXISTS audit_log ("
        "id INT AUTO_INCREMENT PRIMARY KEY,"
        "username VARCHAR(50) NOT NULL,"
        "action VARCHAR(100) NOT NULL,"
        "details TEXT,"
        "timestamp DATETIME DEFAULT CURRENT_TIMESTAMP"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    if (!query.exec(sqlAudit)) {
        qWarning() << "DatabaseManager: échec création table audit_log:" << query.lastError().text();
        emit databaseError(query.lastError().text());
        return false;
    }

    // ---- Table sensors : registre des capteurs ----
    // NOTE : les noms de colonnes sont entre accents graves car
    // `last_value` est un mot réservé de MySQL 8+ (fonction fenêtre).
    const QString sqlSensors = QStringLiteral(
        "CREATE TABLE IF NOT EXISTS `sensors` ("
        "`id` VARCHAR(50) PRIMARY KEY,"
        "`name` VARCHAR(100) NOT NULL,"
        "`ip_address` VARCHAR(45),"
        "`type` VARCHAR(30) NOT NULL,"
        "`topic` VARCHAR(255),"
        "`last_value` DOUBLE,"
        "`last_update` DATETIME NULL,"
        "`warning_threshold` INT NULL,"
        "`alarm_threshold` INT NULL,"
        "`is_online` TINYINT(1) DEFAULT 0"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    if (!query.exec(sqlSensors)) {
        // Non bloquant : cette table est un simple registre d'appareils,
        // l'historique des mesures fonctionne sans elle.
        qWarning() << "DatabaseManager: création table sensors impossible (on continue):"
                   << query.lastError().text();
    }

    // Migration : ajout des colonnes de seuils sur les anciennes tables
    // (erreurs normales et ignorées si les colonnes existent déjà).
    query.exec(QStringLiteral("ALTER TABLE `sensors` ADD COLUMN `warning_threshold` INT NULL"));
    query.exec(QStringLiteral("ALTER TABLE `sensors` ADD COLUMN `alarm_threshold` INT NULL"));

    // ---- Table sensor_readings : historique des mesures ----
    const QString sqlReadings = QStringLiteral(
        "CREATE TABLE IF NOT EXISTS `sensor_readings` ("
        "`id` BIGINT AUTO_INCREMENT PRIMARY KEY,"
        "`sensor_id` VARCHAR(50) NOT NULL,"
        "`temperature` DOUBLE NULL,"
        "`humidity` DOUBLE NULL,"
        "`smoke_level` INT NULL,"
        "`eco2_ppm` INT NULL,"
        "`tvoc_ppb` INT NULL,"
        "`smoke_detected` TINYINT(1) NULL,"
        "`timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,"
        "INDEX idx_sensor_ts (`sensor_id`, `timestamp`)"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    if (!query.exec(sqlReadings)) {
        qWarning() << "DatabaseManager: échec création table sensor_readings:" << query.lastError().text();
        emit databaseError(query.lastError().text());
        return false;
    }

    // Migration : ajout des colonnes gaz sur les anciennes tables.
    // Les erreurs sont normales (et ignorées) si les colonnes existent déjà.
    query.exec(QStringLiteral("ALTER TABLE `sensor_readings` ADD COLUMN `eco2_ppm` INT NULL"));
    query.exec(QStringLiteral("ALTER TABLE `sensor_readings` ADD COLUMN `tvoc_ppb` INT NULL"));
    query.exec(QStringLiteral("ALTER TABLE `sensor_readings` ADD COLUMN `smoke_detected` TINYINT(1) NULL"));

    qDebug() << "DatabaseManager: tables prêtes";
    return true;
}

// =====================================================================
//  DONNÉES PAR DÉFAUT (premier lancement)
// =====================================================================
void DatabaseManager::createDefaultUsers()
{
    // Si des utilisateurs existent déjà, ne rien refaire.
    QSqlQuery checkQuery(m_db);
    checkQuery.exec(QStringLiteral("SELECT COUNT(*) FROM users"));
    if (checkQuery.next() && checkQuery.value(0).toInt() > 0) {
        qDebug() << "DatabaseManager: utilisateurs déjà présents, rien à créer";
        return;
    }

    qDebug() << "DatabaseManager: création des utilisateurs par défaut...";

    createUser(QStringLiteral("admin"), QStringLiteral("admin123"), UserRole::Admin,
               QStringLiteral("Administrateur"), QStringLiteral("admin@surveillance.local"));
    createUser(QStringLiteral("operateur"), QStringLiteral("operateur123"), UserRole::Operator,
               QStringLiteral("Opérateur"), QStringLiteral("operateur@surveillance.local"));
    createUser(QStringLiteral("visiteur"), QStringLiteral("visiteur123"), UserRole::Viewer,
               QStringLiteral("Visiteur"), QStringLiteral("visiteur@surveillance.local"));

    // Capteurs par défaut (topics alignés sur les scripts des Raspberry Pi)
    registerSensor(QStringLiteral("rpi-001"), QStringLiteral("Raspberry 1 Temperature"),
                   QStringLiteral("200.26.16.10"), QStringLiteral("temperature"),
                   QStringLiteral("rpi-001/sensors/temperature"));
    registerSensor(QStringLiteral("rpi-003"), QStringLiteral("Raspberry 3 Smoke"),
                   QStringLiteral("200.26.16.30"), QStringLiteral("smoke"),
                   QStringLiteral("rpi-003/sensors/smoke"));
    registerSensor(QStringLiteral("rpi-004"), QStringLiteral("Raspberry 4 Display"),
                   QStringLiteral("200.26.16.40"), QStringLiteral("display"),
                   QString());

    qDebug() << "DatabaseManager: utilisateurs et capteurs par défaut créés";
}

// =====================================================================
//  GESTION DES UTILISATEURS
// =====================================================================
bool DatabaseManager::createUser(const QString &username, const QString &password,
                                 UserRole role, const QString &fullName,
                                 const QString &email)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO users (username, password, role, full_name, email) "
        "VALUES (:username, :password, :role, :full_name, :email)"));
    query.bindValue(QStringLiteral(":username"), username);
    query.bindValue(QStringLiteral(":password"), hashPassword(password));
    query.bindValue(QStringLiteral(":role"), roleToString(role));
    query.bindValue(QStringLiteral(":full_name"), fullName);
    query.bindValue(QStringLiteral(":email"), email);

    if (!query.exec()) {
        emit databaseError(query.lastError().text());
        return false;
    }
    return true;
}

bool DatabaseManager::authenticateUser(const QString &username, const QString &password)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT * FROM users WHERE username = :username AND is_active = 1"));
    query.bindValue(QStringLiteral(":username"), username);

    if (!query.exec()) {
        emit databaseError(query.lastError().text());
        emit authenticationFailed(QStringLiteral("Erreur de base de données"));
        return false;
    }

    if (!query.next()) {
        emit authenticationFailed(QStringLiteral("Utilisateur inconnu ou désactivé"));
        return false;
    }

    // Comparaison des hachés : le mot de passe en clair n'est jamais stocké.
    const QString storedHash = query.value(QStringLiteral("password")).toString();
    if (storedHash != hashPassword(password)) {
        emit authenticationFailed(QStringLiteral("Mot de passe incorrect"));
        logAction(username, QStringLiteral("AUTH_FAILED"), QStringLiteral("Mot de passe incorrect"));
        return false;
    }

    User user;
    user.id        = query.value(QStringLiteral("id")).toInt();
    user.username  = query.value(QStringLiteral("username")).toString();
    user.role      = stringToRole(query.value(QStringLiteral("role")).toString());
    user.fullName  = query.value(QStringLiteral("full_name")).toString();
    user.email     = query.value(QStringLiteral("email")).toString();
    user.isActive  = query.value(QStringLiteral("is_active")).toBool();
    user.lastLogin = query.value(QStringLiteral("last_login")).toDateTime();
    user.createdAt = query.value(QStringLiteral("created_at")).toDateTime();

    updateLastLogin(username);
    logAction(username, QStringLiteral("LOGIN"), QStringLiteral("Connexion réussie"));

    emit userAuthenticated(user);
    return true;
}

bool DatabaseManager::updateLastLogin(const QString &username)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = :username"));
    query.bindValue(QStringLiteral(":username"), username);
    return query.exec();
}

bool DatabaseManager::logAction(const QString &username, const QString &action,
                                const QString &details)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO audit_log (username, action, details) "
        "VALUES (:username, :action, :details)"));
    query.bindValue(QStringLiteral(":username"), username);
    query.bindValue(QStringLiteral(":action"), action);
    query.bindValue(QStringLiteral(":details"), details);
    return query.exec();
}

// =====================================================================
//  GESTION DES CAPTEURS
// =====================================================================
bool DatabaseManager::registerSensor(const QString &id, const QString &name, const QString &ip,
                                     const QString &type, const QString &topic)
{
    // REPLACE INTO : insère le capteur, ou l'écrase s'il existe déjà.
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "REPLACE INTO sensors (id, name, ip_address, type, topic, is_online) "
        "VALUES (:id, :name, :ip, :type, :topic, 1)"));
    query.bindValue(QStringLiteral(":id"), id);
    query.bindValue(QStringLiteral(":name"), name);
    query.bindValue(QStringLiteral(":ip"), ip);
    query.bindValue(QStringLiteral(":type"), type);
    query.bindValue(QStringLiteral(":topic"), topic);

    if (!query.exec()) {
        qWarning() << "DatabaseManager: échec enregistrement capteur:" << query.lastError().text();
        return false;
    }

    qDebug() << "DatabaseManager: capteur enregistré" << id << name;
    return true;
}

bool DatabaseManager::updateSensorValue(const QString &id, double value)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "UPDATE sensors SET last_value = :value, last_update = CURRENT_TIMESTAMP, "
        "is_online = 1 WHERE id = :id"));
    query.bindValue(QStringLiteral(":value"), value);
    query.bindValue(QStringLiteral(":id"), id);

    if (!query.exec()) {
        qWarning() << "DatabaseManager: échec mise à jour capteur:" << query.lastError().text();
        return false;
    }
    return true;
}

QVector<Sensor> DatabaseManager::getAllSensors()
{
    QVector<Sensor> sensors;
    QSqlQuery query(m_db);
    query.exec(QStringLiteral(
        "SELECT id, name, ip_address, type, topic, last_value, last_update, is_online "
        "FROM sensors"));

    while (query.next()) {
        Sensor s;
        s.id         = query.value(0).toString();
        s.name       = query.value(1).toString();
        s.ipAddress  = query.value(2).toString();
        s.type       = query.value(3).toString();
        s.topic      = query.value(4).toString();
        s.lastValue  = query.value(5).toDouble();
        s.lastUpdate = query.value(6).toDateTime();
        s.isOnline   = query.value(7).toInt() == 1;
        sensors.append(s);
    }

    return sensors;
}

// =====================================================================
//  SEUILS D'ALARME
// =====================================================================
bool DatabaseManager::saveSensorThresholds(const QString &id, int warningThreshold, int alarmThreshold)
{
    // Le capteur doit avoir une ligne dans le registre : on vérifie
    // d'abord son existence pour choisir entre UPDATE et INSERT.
    QSqlQuery check(m_db);
    check.prepare(QStringLiteral("SELECT COUNT(*) FROM sensors WHERE id = :id"));
    check.bindValue(QStringLiteral(":id"), id);
    if (!check.exec() || !check.next()) {
        qWarning() << "DatabaseManager: échec lecture du registre des capteurs:"
                   << check.lastError().text();
        return false;
    }

    QSqlQuery query(m_db);
    if (check.value(0).toInt() > 0) {
        query.prepare(QStringLiteral(
            "UPDATE sensors SET warning_threshold = :warning, alarm_threshold = :alarm "
            "WHERE id = :id"));
    } else {
        query.prepare(QStringLiteral(
            "INSERT INTO sensors (id, name, type, warning_threshold, alarm_threshold) "
            "VALUES (:id, :id, 'unknown', :warning, :alarm)"));
    }
    query.bindValue(QStringLiteral(":warning"), warningThreshold);
    query.bindValue(QStringLiteral(":alarm"), alarmThreshold);
    query.bindValue(QStringLiteral(":id"), id);

    if (!query.exec()) {
        qWarning() << "DatabaseManager: échec sauvegarde des seuils:" << query.lastError().text();
        return false;
    }

    qDebug() << "DatabaseManager: seuils enregistrés pour" << id
             << "- avertissement:" << warningThreshold << "- alarme:" << alarmThreshold;
    return true;
}

bool DatabaseManager::getSensorThresholds(const QString &id, int &warningThreshold, int &alarmThreshold)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT warning_threshold, alarm_threshold FROM sensors WHERE id = :id"));
    query.bindValue(QStringLiteral(":id"), id);

    if (!query.exec() || !query.next())
        return false;

    // Colonnes NULL = aucun seuil enregistré pour ce capteur.
    if (query.value(0).isNull() || query.value(1).isNull())
        return false;

    warningThreshold = query.value(0).toInt();
    alarmThreshold   = query.value(1).toInt();
    return true;
}

// =====================================================================
//  HISTORIQUE DES MESURES
// =====================================================================
bool DatabaseManager::saveTemperatureReading(const QString &sensorId, double temperature, double humidity)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO sensor_readings (sensor_id, temperature, humidity) "
        "VALUES (:sensor_id, :temperature, :humidity)"));
    query.bindValue(QStringLiteral(":sensor_id"), sensorId);
    query.bindValue(QStringLiteral(":temperature"), temperature);
    query.bindValue(QStringLiteral(":humidity"), humidity);

    if (!query.exec()) {
        qWarning() << "DatabaseManager: échec sauvegarde température:" << query.lastError().text();
        return false;
    }

    // On met aussi à jour la "dernière valeur" du registre des capteurs.
    updateSensorValue(sensorId, temperature);
    return true;
}

bool DatabaseManager::saveSmokeReading(const QString &sensorId, int smokeLevel)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO sensor_readings (sensor_id, smoke_level) "
        "VALUES (:sensor_id, :smoke_level)"));
    query.bindValue(QStringLiteral(":sensor_id"), sensorId);
    query.bindValue(QStringLiteral(":smoke_level"), smokeLevel);

    if (!query.exec()) {
        qWarning() << "DatabaseManager: échec sauvegarde fumée:" << query.lastError().text();
        return false;
    }

    updateSensorValue(sensorId, smokeLevel);
    return true;
}

bool DatabaseManager::saveGasReading(const QString &sensorId, int eco2Ppm, int tvocPpb, bool smokeDetected)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO sensor_readings (sensor_id, eco2_ppm, tvoc_ppb, smoke_detected) "
        "VALUES (:sensor_id, :eco2_ppm, :tvoc_ppb, :smoke_detected)"));
    query.bindValue(QStringLiteral(":sensor_id"), sensorId);
    query.bindValue(QStringLiteral(":eco2_ppm"), eco2Ppm);
    query.bindValue(QStringLiteral(":tvoc_ppb"), tvocPpb);
    query.bindValue(QStringLiteral(":smoke_detected"), smokeDetected ? 1 : 0);

    if (!query.exec()) {
        qWarning() << "DatabaseManager: échec sauvegarde gaz:" << query.lastError().text();
        return false;
    }

    // L'eCO2 sert de valeur principale dans le registre des capteurs.
    updateSensorValue(sensorId, eco2Ppm);
    return true;
}

// =====================================================================
//  DERNIÈRES MESURES (pour l'affichage du dashboard)
// =====================================================================
double DatabaseManager::getLatestTemperature(const QString &sensorId)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT temperature FROM sensor_readings "
        "WHERE sensor_id = :sensor_id AND temperature IS NOT NULL "
        "ORDER BY timestamp DESC LIMIT 1"));
    query.bindValue(QStringLiteral(":sensor_id"), sensorId);

    if (query.exec() && query.next())
        return query.value(0).toDouble();
    return -999.0;  // valeur d'erreur : aucune mesure
}

double DatabaseManager::getLatestHumidity(const QString &sensorId)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT humidity FROM sensor_readings "
        "WHERE sensor_id = :sensor_id AND humidity IS NOT NULL "
        "ORDER BY timestamp DESC LIMIT 1"));
    query.bindValue(QStringLiteral(":sensor_id"), sensorId);

    if (query.exec() && query.next())
        return query.value(0).toDouble();
    return -999.0;  // valeur d'erreur : aucune mesure
}

int DatabaseManager::getLatestSmokeLevel(const QString &sensorId)
{
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT smoke_level FROM sensor_readings "
        "WHERE sensor_id = :sensor_id AND smoke_level IS NOT NULL "
        "ORDER BY timestamp DESC LIMIT 1"));
    query.bindValue(QStringLiteral(":sensor_id"), sensorId);

    if (query.exec() && query.next())
        return query.value(0).toInt();
    return -1;  // valeur d'erreur : aucune mesure
}

// =====================================================================
//  HELPERS
// =====================================================================
QString DatabaseManager::hashPassword(const QString &password)
{
    return QString::fromLatin1(
        QCryptographicHash::hash(password.toUtf8(), QCryptographicHash::Sha256).toHex());
}

QString DatabaseManager::roleToString(UserRole role)
{
    switch (role) {
    case UserRole::Admin:    return QStringLiteral("admin");
    case UserRole::Operator: return QStringLiteral("operator");
    case UserRole::Viewer:   return QStringLiteral("viewer");
    }
    return QStringLiteral("viewer");
}

UserRole DatabaseManager::stringToRole(const QString &role)
{
    if (role == QLatin1String("admin"))    return UserRole::Admin;
    if (role == QLatin1String("operator")) return UserRole::Operator;
    return UserRole::Viewer;
}

// =====================================================================
//  MÉTHODES DE LA STRUCTURE User
// =====================================================================
QString User::getRoleString() const
{
    switch (role) {
    case UserRole::Admin:    return QStringLiteral("Administrateur");
    case UserRole::Operator: return QStringLiteral("Opérateur");
    case UserRole::Viewer:   return QStringLiteral("Visiteur");
    }
    return QStringLiteral("Inconnu");
}

bool User::canEditWidgets() const
{
    return role == UserRole::Admin || role == UserRole::Operator;
}
