-- =====================================================
-- Base de données Système de Surveillance
-- Pour WAMP (MySQL/MariaDB)
-- =====================================================

-- Créer la base de données
CREATE DATABASE IF NOT EXISTS surveillance_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE surveillance_db;

-- =====================================================
-- Suppression dans l'ordre inverse des dépendances
-- (utile pour réinitialiser proprement le schéma)
-- =====================================================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS sensor_data;
DROP TABLE IF EXISTS sensors;
DROP TABLE IF EXISTS raspberry_nodes;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- Table: users
-- =====================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,  -- SHA256 hash
    role ENUM('admin', 'operator', 'viewer') NOT NULL DEFAULT 'viewer',
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: audit_log
--   FK -> users(username) : trace des actions par utilisateur
-- =====================================================
CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_user
        FOREIGN KEY (username) REFERENCES users(username)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_username (username),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: system_config
--   FK -> users(username) : utilisateur ayant fait la dernière modif
-- =====================================================
CREATE TABLE system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(50) NOT NULL UNIQUE,
    config_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),

    CONSTRAINT fk_config_user
        FOREIGN KEY (updated_by) REFERENCES users(username)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: raspberry_nodes
-- =====================================================
CREATE TABLE raspberry_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(15) NOT NULL,
    mac_address VARCHAR(17),
    location VARCHAR(100),
    is_online TINYINT(1) NOT NULL DEFAULT 0,
    last_seen DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_ip (ip_address),
    INDEX idx_online (is_online)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: sensors
--   FK -> raspberry_nodes(node_id)
-- =====================================================
CREATE TABLE sensors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(20) NOT NULL UNIQUE,
    node_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('smoke', 'temperature', 'humidity', 'co2', 'voc', 'camera', 'radiation') NOT NULL,
    unit VARCHAR(20),
    warning_threshold DECIMAL(10,2),
    alarm_threshold DECIMAL(10,2),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sensor_node
        FOREIGN KEY (node_id) REFERENCES raspberry_nodes(node_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    INDEX idx_node (node_id),
    INDEX idx_type (type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: sensor_data
--   FK -> sensors(sensor_id)
--   NOTE: pas de partitionnement ici car MySQL interdit
--         les FOREIGN KEY sur les tables partitionnées.
--         Pour la rétention, utiliser un EVENT (voir bas).
-- =====================================================
CREATE TABLE sensor_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(20) NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    raw_value TEXT,
    status ENUM('normal', 'warning', 'alarm', 'error') NOT NULL DEFAULT 'normal',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_data_sensor
        FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    INDEX idx_sensor (sensor_id),
    INDEX idx_recorded (recorded_at),
    INDEX idx_status (status),
    INDEX idx_sensor_recorded (sensor_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Données par défaut
-- =====================================================

-- Utilisateurs par défaut (mots de passe: SHA256)
-- admin / admin123
-- operateur / operateur123
-- visiteur / visiteur123
INSERT INTO users (username, password, role, full_name, email, is_active) VALUES
('admin',     '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin',    'Administrateur', 'admin@surveillance.local',     1),
('operateur', '5f4dcc3b5aa765d61d8327deb882cf992c2e1e4f8b3c3e8d3d9a7c6b5e4f3d2a1', 'operator', 'Opérateur',      'operateur@surveillance.local', 1),
('visiteur',  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'viewer',   'Visiteur',       'visiteur@surveillance.local',  1);

-- Configuration système par défaut
INSERT INTO system_config (config_key, config_value, description, updated_by) VALUES
('mqtt_broker_host',       '200.26.16.200',     'Adresse du broker MQTT',                          'admin'),
('mqtt_broker_port',       '8883',              'Port du broker MQTT (TLS)',                       'admin'),
('network_subnet',         '200.26.16.0/24',    'Sous-réseau des Raspberry Pi',                    'admin'),
('arp_scan_interval',      '30',                'Intervalle de scan ARP en secondes',              'admin'),
('data_retention_days',    '90',                'Nombre de jours de rétention des données',        'admin'),
('alert_email_enabled',    '0',                 'Activer les alertes par email',                   'admin'),
('alert_email_recipients', '',                  'Destinataires des alertes email',                 'admin');

-- Nodes Raspberry Pi par défaut
INSERT INTO raspberry_nodes (node_id, name, ip_address, location) VALUES
('rpi-001', 'Raspberry Pi Température', '200.26.16.10', 'Salle serveur'),
('rpi-002', 'Raspberry Pi Caméra',      '200.26.16.20', 'Entrée principale'),
('rpi-003', 'Raspberry Pi Qualité Air', '200.26.16.30', 'Salle serveur'),
('rpi-004', 'Raspberry Pi Affichage',   '200.26.16.40', 'Poste de garde');

-- Capteurs par défaut
INSERT INTO sensors (sensor_id, node_id, name, type, unit, warning_threshold, alarm_threshold) VALUES
('smoke-001', 'rpi-001', 'Détecteur Fumée MQ-2',       'smoke',       'ppm', 50.00,   100.00),
('temp-001',  'rpi-001', 'Capteur Température DHT22',  'temperature', '°C',  35.00,   45.00),
('hum-001',   'rpi-001', 'Capteur Humidité DHT22',     'humidity',    '%',   70.00,   85.00),
('co2-001',   'rpi-003', 'Capteur CO2 SGP30',          'co2',         'ppm', 1000.00, 2000.00),
('voc-001',   'rpi-003', 'Capteur VOC SGP30',          'voc',         'ppb', 500.00,  1000.00),
('cam-001',   'rpi-002', 'Caméra Surveillance PIM480', 'camera',      NULL,  NULL,    NULL);

-- =====================================================
-- Rétention des données capteurs (remplace le partitionnement)
-- Active le scheduler puis crée un EVENT qui purge les
-- données plus vieilles que `data_retention_days`.
-- =====================================================
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS ev_purge_sensor_data;

DELIMITER $$
CREATE EVENT ev_purge_sensor_data
ON SCHEDULE EVERY 1 DAY
STARTS (CURRENT_DATE + INTERVAL 1 DAY)
DO
BEGIN
    DECLARE retention INT DEFAULT 90;

    SELECT CAST(config_value AS UNSIGNED)
      INTO retention
      FROM system_config
     WHERE config_key = 'data_retention_days'
     LIMIT 1;

    DELETE FROM sensor_data
     WHERE recorded_at < (NOW() - INTERVAL retention DAY);
END$$
DELIMITER ;

-- =====================================================
-- Vues utiles
-- =====================================================

-- Dernière mesure de chaque capteur
CREATE OR REPLACE VIEW v_latest_sensor_value AS
SELECT  s.sensor_id,
        s.name              AS sensor_name,
        s.type              AS sensor_type,
        s.unit,
        n.node_id,
        n.name              AS node_name,
        n.location,
        d.value,
        d.status,
        d.recorded_at
FROM    sensors s
JOIN    raspberry_nodes n ON n.node_id = s.node_id
LEFT JOIN sensor_data d
        ON d.sensor_id = s.sensor_id
       AND d.recorded_at = (
             SELECT MAX(recorded_at)
               FROM sensor_data
              WHERE sensor_id = s.sensor_id
       )
WHERE   s.is_active = 1;

-- Capteurs actuellement en alarme
CREATE OR REPLACE VIEW v_active_alarms AS
SELECT  s.sensor_id,
        s.name AS sensor_name,
        n.node_id,
        n.name AS node_name,
        d.value,
        d.status,
        d.recorded_at
FROM    sensor_data d
JOIN    sensors s         ON s.sensor_id = d.sensor_id
JOIN    raspberry_nodes n ON n.node_id   = s.node_id
WHERE   d.status IN ('warning', 'alarm')
  AND   d.recorded_at = (
            SELECT MAX(recorded_at)
              FROM sensor_data
             WHERE sensor_id = s.sensor_id
        );
