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
-- Table: users
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,  -- SHA256 hash
    role ENUM('admin', 'operator', 'viewer') NOT NULL DEFAULT 'viewer',
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: audit_log
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: raspberry_nodes
-- =====================================================
CREATE TABLE IF NOT EXISTS raspberry_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(15) NOT NULL,
    mac_address VARCHAR(17),
    location VARCHAR(100),
    is_online TINYINT(1) DEFAULT 0,
    last_seen DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_ip (ip_address),
    INDEX idx_online (is_online)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: sensors
-- =====================================================
CREATE TABLE IF NOT EXISTS sensors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(20) NOT NULL UNIQUE,
    node_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('smoke', 'temperature', 'humidity', 'co2', 'voc', 'camera', 'radiation') NOT NULL,
    unit VARCHAR(20),
    warning_threshold DECIMAL(10,2),
    alarm_threshold DECIMAL(10,2),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (node_id) REFERENCES raspberry_nodes(node_id) ON DELETE CASCADE,
    INDEX idx_node (node_id),
    INDEX idx_type (type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: sensor_data
-- =====================================================
CREATE TABLE IF NOT EXISTS sensor_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sensor_id VARCHAR(20) NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    raw_value TEXT,
    status ENUM('normal', 'warning', 'alarm', 'error') DEFAULT 'normal',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_sensor (sensor_id),
    INDEX idx_recorded (recorded_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Table: system_config
-- =====================================================
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(50) NOT NULL UNIQUE,
    config_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    
    INDEX idx_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- Données par défaut
-- =====================================================

-- Utilisateurs par défaut (mots de passe: SHA256)
-- admin / admin123
-- operateur / operateur123
-- visiteur / visiteur123
INSERT INTO users (username, password, role, full_name, email, is_active) VALUES
('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 'Administrateur', 'admin@surveillance.local', 1),
('operateur', '5f4dcc3b5aa765d61d8327deb882cf992c2e1e4f8b3c3e8d3d9a7c6b5e4f3d2a1', 'operator', 'Opérateur', 'operateur@surveillance.local', 1),
('visiteur', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'viewer', 'Visiteur', 'visiteur@surveillance.local', 1);

-- Configuration système par défaut
INSERT INTO system_config (config_key, config_value, description) VALUES
('mqtt_broker_host', '200.26.16.200', 'Adresse du broker MQTT'),
('mqtt_broker_port', '1883', 'Port du broker MQTT'),
('network_subnet', '200.26.16.0/24', 'Sous-réseau des Raspberry Pi'),
('arp_scan_interval', '30', 'Intervalle de scan ARP en secondes'),
('data_retention_days', '90', 'Nombre de jours de rétention des données capteurs'),
('alert_email_enabled', '0', 'Activer les alertes par email'),
('alert_email_recipients', '', 'Destinataires des alertes email');

-- Nodes Raspberry Pi par défaut
INSERT INTO raspberry_nodes (node_id, name, ip_address, location) VALUES
('rpi-001', 'Raspberry Pi Température', '200.26.16.10', 'Salle serveur'),
('rpi-002', 'Raspberry Pi Caméra', '200.26.16.20', 'Entrée principale'),
('rpi-003', 'Raspberry Pi Qualité Air', '200.26.16.30', 'Salle serveur'),
('rpi-004', 'Raspberry Pi Affichage', '200.26.16.40', 'Poste de garde');

-- Capteurs par défaut
INSERT INTO sensors (sensor_id, node_id, name, type, unit, warning_threshold, alarm_threshold) VALUES
('smoke-001', 'rpi-001', 'Détecteur Fumée MQ-2', 'smoke', 'ppm', 50.00, 100.00),
('temp-001', 'rpi-001', 'Capteur Température DHT22', 'temperature', '°C', 35.00, 45.00),
('hum-001', 'rpi-001', 'Capteur Humidité DHT22', 'humidity', '%', 70.00, 85.00),
('co2-001', 'rpi-003', 'Capteur CO2 PIM480', 'co2', 'ppm', 1000.00, 2000.00),
('voc-001', 'rpi-003', 'Capteur VOC PIM480', 'voc', 'ppb', 500.00, 1000.00),
('cam-001', 'rpi-002', 'Caméra Surveillance', 'camera', NULL, NULL, NULL),
('rad-001', 'rpi-001', 'Détecteur Radiation', 'radiation', 'μSv/h', 3.00, 10.00);
