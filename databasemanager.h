#pragma once

#include <QDateTime>
#include <QObject>
#include <QSqlDatabase>
#include <QString>
#include <QVector>

/** Rôles des utilisateurs, du plus au moins privilégié. */
enum class UserRole {
    Admin,      // tous les droits
    Operator,   // droits moyens (modifier les widgets)
    Viewer      // lecture seule
};

/** Utilisateur tel que stocké dans la table `users`. */
struct User {
    int id = 0;
    QString username;
    UserRole role = UserRole::Viewer;
    QString fullName;
    QString email;
    bool isActive = false;
    QDateTime lastLogin;
    QDateTime createdAt;

    QString getRoleString() const;
    bool canEditWidgets() const;
};

/** Capteur tel que stocké dans la table `sensors`. */
struct Sensor {
    QString id;
    QString name;
    QString ipAddress;
    QString type;      // "temperature", "smoke", "camera", ...
    QString topic;     // topic MQTT sur lequel le capteur publie
    double lastValue = 0.0;
    QDateTime lastUpdate;
    bool isOnline = false;
};

/**
 * DatabaseManager — accès à la base MySQL du système de surveillance.
 *
 * Responsabilités :
 *   - connexion à la base et création des tables si besoin ;
 *   - authentification des utilisateurs (mot de passe haché en SHA-256) ;
 *   - enregistrement des capteurs et de leurs mesures (historique) ;
 *   - lecture des dernières mesures pour l'affichage du dashboard ;
 *   - journal d'audit (connexions, échecs d'authentification...).
 */
class DatabaseManager : public QObject {
    Q_OBJECT

public:
    explicit DatabaseManager(QObject *parent = nullptr);
    ~DatabaseManager() override;

    bool initialize();
    bool isInitialized() const;

    // === UTILISATEURS ===
    bool createUser(const QString &username, const QString &password,
                    UserRole role, const QString &fullName = QString(),
                    const QString &email = QString());
    bool authenticateUser(const QString &username, const QString &password);

    // === CAPTEURS ===
    bool registerSensor(const QString &id, const QString &name, const QString &ip,
                        const QString &type, const QString &topic);
    QVector<Sensor> getAllSensors();

    // === HISTORIQUE DES MESURES ===
    bool saveTemperatureReading(const QString &sensorId, double temperature, double humidity);
    bool saveSmokeReading(const QString &sensorId, int smokeLevel);
    bool saveGasReading(const QString &sensorId, int eco2Ppm, int tvocPpb, bool smokeDetected);

    // === DERNIÈRES MESURES (pour l'affichage) ===
    double getLatestTemperature(const QString &sensorId);   // -999 si aucune
    double getLatestHumidity(const QString &sensorId);      // -999 si aucune
    int getLatestSmokeLevel(const QString &sensorId);       // -1 si aucune

signals:
    void userAuthenticated(const User &user);
    void authenticationFailed(const QString &reason);
    void databaseError(const QString &error);

private:
    bool openDatabase();
    void closeDatabase();
    bool createTables();
    void createDefaultUsers();
    bool updateLastLogin(const QString &username);
    bool updateSensorValue(const QString &id, double value);
    bool logAction(const QString &username, const QString &action,
                   const QString &details = QString());
    static QString hashPassword(const QString &password);
    static QString roleToString(UserRole role);
    static UserRole stringToRole(const QString &role);

    QSqlDatabase m_db;
    bool m_initialized;
};
