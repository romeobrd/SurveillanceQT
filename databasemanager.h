#pragma once

#include <QObject>
#include <QString>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QDateTime>
#include <QPair>
#include <QVector>

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

struct Sensor {
    QString id;
    QString name;
    QString ipAddress;
    QString type;  // "temperature", "smoke", "camera"
    QString topic;
    double lastValue;
    QDateTime lastUpdate;
    bool isOnline;
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

    // Sensor management
    bool registerSensor(const QString &id, const QString &name, const QString &ip,
                        const QString &type, const QString &topic);
    bool updateSensorValue(const QString &id, double value);
    bool setSensorOnline(const QString &id, bool online);
    QVector<Sensor> getAllSensors();
    Sensor getSensor(const QString &id);

    // Sensor readings history
    bool saveTemperatureReading(const QString &sensorId, double temperature, double humidity);
    bool saveSmokeReading(const QString &sensorId, int smokeLevel);
    bool saveGasReading(const QString &sensorId, int eco2Ppm, int tvocPpb, bool smokeDetected);
    QVector<QPair<QDateTime, double>> getTemperatureHistory(const QString &sensorId, int hours = 24);
    QVector<QPair<QDateTime, int>> getSmokeHistory(const QString &sensorId, int hours = 24);

    // Latest sensor data (for display)
    double getLatestTemperature(const QString &sensorId);
    double getLatestHumidity(const QString &sensorId);
    int getLatestSmokeLevel(const QString &sensorId);
    QDateTime getLastUpdateTime(const QString &sensorId);

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
