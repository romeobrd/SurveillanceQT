# Real-time Network Monitoring

<cite>
**Referenced Files in This Document**
- [arpscanner.h](file://arpscanner.h)
- [arpscanner.cpp](file://arpscanner.cpp)
- [networkscannerdialog.h](file://networkscannerdialog.h)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [dashboardwindow.h](file://dashboardwindow.h)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [databasemanager.h](file://databasemanager.h)
- [databasemanager.cpp](file://databasemanager.cpp)
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)
- [smokesensorwidget.h](file://smokesensorwidget.h)
- [temperaturewidget.h](file://temperaturewidget.h)
- [camerawidget.h](file://camerawidget.h)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the real-time network monitoring capabilities implemented in the SurveillanceQT project. It covers continuous monitoring systems, automatic scan scheduling, dynamic network topology tracking, surveillance module detection, online/offline status tracking, and RSSI monitoring for wireless devices. It also documents integration with the dashboard system, alert generation for network changes, and historical network activity logging. Finally, it provides performance optimization, resource management, and scalability recommendations for large networks, along with configuration examples and troubleshooting guidance.

## Project Structure
The monitoring system centers around a dedicated ARP-based scanner, a network scanning dialog, and a dashboard window that integrates monitoring results into the UI. Supporting infrastructure includes a database manager for audit/logging and a configuration file for Raspberry Pi nodes and MQTT broker settings. The dashboard displays connected surveillance modules and provides controls to initiate scans and manage widgets.

```mermaid
graph TB
subgraph "Monitoring Core"
AS["ArpScanner<br/>ARP + ping sweep"]
NSD["NetworkScannerDialog<br/>UI for scan and selection"]
DW["DashboardWindow<br/>Integration + status"]
end
subgraph "Persistence"
DBM["DatabaseManager<br/>Audit/log + users"]
SCHEMA["surveillance_schema.sql<br/>Tables: users, audit_log,<br/>raspberry_nodes, sensors, sensor_data, system_config"]
end
subgraph "Configuration"
CFG["raspberry_nodes.json<br/>Nodes, sensors, broker, app settings"]
end
subgraph "Widgets"
SW["SmokeSensorWidget"]
TW["TemperatureWidget"]
CW["CameraWidget"]
end
AS --> NSD
NSD --> DW
DW --> SW
DW --> TW
DW --> CW
DW --> DBM
DBM --> SCHEMA
CFG --> DW
```

**Diagram sources**
- [arpscanner.h](file://arpscanner.h)
- [arpscanner.cpp](file://arpscanner.cpp)
- [networkscannerdialog.h](file://networkscannerdialog.h)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [dashboardwindow.h](file://dashboardwindow.h)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [databasemanager.h](file://databasemanager.h)
- [databasemanager.cpp](file://databasemanager.cpp)
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)
- [smokesensorwidget.h](file://smokesensorwidget.h)
- [temperaturewidget.h](file://temperaturewidget.h)
- [camerawidget.h](file://camerawidget.h)

**Section sources**
- [arpscanner.h](file://arpscanner.h)
- [arpscanner.cpp](file://arpscanner.cpp)
- [networkscannerdialog.h](file://networkscannerdialog.h)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [dashboardwindow.h](file://dashboardwindow.h)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [databasemanager.h](file://databasemanager.h)
- [databasemanager.cpp](file://databasemanager.cpp)
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)
- [smokesensorwidget.h](file://smokesensorwidget.h)
- [temperaturewidget.h](file://temperaturewidget.h)
- [camerawidget.h](file://camerawidget.h)

## Core Components
- ArpScanner: Performs ARP table parsing and ICMP ping sweeps to discover devices, classify surveillance modules, and track online/offline status and RSSI estimates.
- NetworkScannerDialog: Provides a UI to start scans, display discovered devices, select modules, and connect them to the dashboard.
- DashboardWindow: Integrates monitoring results, shows network status, and manages widgets for smoke, temperature, and camera.
- DatabaseManager: Handles user authentication, session management, and audit logging for monitoring actions.
- Configuration: JSON defines Raspberry Pi nodes, sensors, MQTT broker, and application behavior.
- Widgets: Represent real-time sensor data and statuses on the dashboard.

Key monitoring data structures:
- NetworkDevice: Holds IP, MAC, hostname, device type, description, online flag, and RSSI.
- KnownRaspberryPi: Defines known RPi nodes for targeted discovery.
- User: Represents authenticated users with roles and permissions.

**Section sources**
- [arpscanner.h](file://arpscanner.h)
- [arpscanner.cpp](file://arpscanner.cpp)
- [networkscannerdialog.h](file://networkscannerdialog.h)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [dashboardwindow.h](file://dashboardwindow.h)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [databasemanager.h](file://databasemanager.h)
- [databasemanager.cpp](file://databasemanager.cpp)
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)

## Architecture Overview
The monitoring pipeline starts with ArpScanner performing periodic or on-demand scans. Discovered devices are classified and displayed via NetworkScannerDialog. DashboardWindow aggregates results, updates status bars, and connects widgets to monitored modules. DatabaseManager logs user actions and maintains audit trails. Configuration drives node discovery and MQTT connectivity.

```mermaid
sequenceDiagram
participant User as "User"
participant DW as "DashboardWindow"
participant NSD as "NetworkScannerDialog"
participant AS as "ArpScanner"
participant DB as "DatabaseManager"
User->>DW : Click "Scan"
DW->>NSD : Open scanner dialog
User->>NSD : Click "Start Scan"
NSD->>AS : startScanKnownDevices()
AS->>AS : pingSpecificHosts()
AS-->>NSD : deviceFound(device)
AS-->>NSD : scanFinished(devices)
NSD-->>DW : selectedDevices()
DW->>DB : logAction("SCAN_DEVICES", ...)
DW-->>User : Display connected modules and status
```

**Diagram sources**
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [arpscanner.cpp](file://arpscanner.cpp)
- [databasemanager.cpp](file://databasemanager.cpp)

## Detailed Component Analysis

### ArpScanner: Continuous Discovery and Classification
- Responsibilities:
  - Determine local subnet and IP address.
  - Perform ping sweep across 254 hosts and targeted pings for known RPi nodes.
  - Parse ARP table to extract MAC/IP pairs and derive device types.
  - Resolve hostnames and identify surveillance-related devices by MAC prefixes and hostnames.
  - Estimate RSSI for discovered devices.
  - Emit signals for scan lifecycle and discovered devices.
- Data structures:
  - NetworkDevice: core device record with online flag and RSSI.
  - KnownRaspberryPi: known node list for targeted discovery.
  - Static lists of MAC prefixes for surveillance modules.
- Behavior:
  - Uses timers to schedule scan completion after ping operations.
  - Emits progress updates and final scan results.
  - Tracks scanning state and supports stopping scans.

```mermaid
classDiagram
class ArpScanner {
+startScan(subnet)
+startScanKnownDevices()
+stopScan()
+isScanning() bool
+detectedDevices() QVector~NetworkDevice~
+surveillanceModules() QVector~NetworkDevice~
+knownRaspberryPiDevices() QVector~NetworkDevice~
+getLocalSubnet() QString
+getLocalIpAddress() QString
+getKnownRaspberryPiList() QVector~KnownRaspberryPi~
+getRaspberryPiDescriptions() QMap~QString,QString~
-parseArpTable()
-pingSweep(subnet)
-pingSpecificHosts(hosts)
-resolveHostname(ip) QString
-identifyDeviceType(mac, hostname) QString
-getMacVendor(mac) QString
-isKnownRaspberryPi(ip) bool
-getRaspberryPiInfo(ip) KnownRaspberryPi
-onScanTimeout()
-performArpScan()
<<signals>>
+scanStarted()
+scanProgress(current,total)
+deviceFound(device)
+scanFinished(devices)
+scanError(error)
+raspberryPiFound(device,knownInfo)
}
class NetworkDevice {
+QString ipAddress
+QString macAddress
+QString hostname
+QString deviceType
+QString description
+bool isOnline
+int rssi
+operator==(other) bool
}
class KnownRaspberryPi {
+QString ipAddress
+QString name
+QString description
+QString expectedType
}
ArpScanner --> NetworkDevice : "creates"
ArpScanner --> KnownRaspberryPi : "uses"
```

**Diagram sources**
- [arpscanner.h](file://arpscanner.h)
- [arpscanner.cpp](file://arpscanner.cpp)

**Section sources**
- [arpscanner.h](file://arpscanner.h)
- [arpscanner.cpp](file://arpscanner.cpp)

### NetworkScannerDialog: UI for Scanning and Selection
- Responsibilities:
  - Initialize ArpScanner and subscribe to scan signals.
  - Display discovered devices, update progress, and reflect online/offline status.
  - Allow users to select modules and connect them to the dashboard.
  - Show counts of surveillance modules and formatted device info including RSSI icons.
- Integration:
  - Uses ArpScanner’s known RPi list to pre-populate the device list.
  - Updates UI elements and enables/disables buttons based on scan state and selections.

```mermaid
sequenceDiagram
participant NSD as "NetworkScannerDialog"
participant AS as "ArpScanner"
participant UI as "QListWidget"
NSD->>AS : startScanKnownDevices()
AS-->>NSD : scanStarted()
AS-->>NSD : deviceFound(device)
NSD->>UI : addDeviceToList(device)
AS-->>NSD : scanFinished(devices)
NSD->>UI : enable selection buttons
NSD-->>NSD : selectedDevices()
```

**Diagram sources**
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [arpscanner.cpp](file://arpscanner.cpp)

**Section sources**
- [networkscannerdialog.h](file://networkscannerdialog.h)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)

### DashboardWindow: Integration and Status Display
- Responsibilities:
  - Show local IP and subnet, and number of connected surveillance modules.
  - Open NetworkScannerDialog to connect modules.
  - Manage widgets for smoke, temperature, and camera.
  - Periodically update bottom status bar with active modules and alerts.
- Integration:
  - Receives selected devices from NetworkScannerDialog and updates network status.
  - Logs actions via DatabaseManager for monitoring events.

```mermaid
flowchart TD
Start(["Open Dashboard"]) --> Init["Initialize widgets and timers"]
Init --> SetupNet["Setup network features<br/>getLocalIpAddress/getLocalSubnet"]
SetupNet --> WaitScan["Wait for user to scan"]
WaitScan --> ScanClick["User clicks Scan"]
ScanClick --> OpenDialog["Open NetworkScannerDialog"]
OpenDialog --> Selected["Receive selected devices"]
Selected --> UpdateStatus["Update network status label"]
UpdateStatus --> RunLoop["Periodic status updates"]
RunLoop --> Alerts["Alerts reflected in bottom bar"]
```

**Diagram sources**
- [dashboardwindow.cpp](file://dashboardwindow.cpp)

**Section sources**
- [dashboardwindow.h](file://dashboardwindow.h)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)

### DatabaseManager: Audit Logging and User Management
- Responsibilities:
  - Initialize database (MySQL for WAMP), create tables, and seed default users.
  - Authenticate users, track sessions, and log actions for monitoring-related activities.
  - Provide audit trail for scans and module connections.
- Schema:
  - Users, audit_log, raspberry_nodes, sensors, sensor_data, system_config.

```mermaid
erDiagram
USERS {
int id PK
string username UK
string password
enum role
string full_name
string email
boolean is_active
datetime last_login
timestamp created_at
}
AUDIT_LOG {
int id PK
string username
string action
text details
string ip_address
timestamp timestamp
}
RASPBERRY_NODES {
int id PK
string node_id UK
string name
string ip_address
string mac_address
string location
boolean is_online
datetime last_seen
timestamp created_at
}
SENSORS {
int id PK
string sensor_id UK
string node_id FK
string name
enum type
string unit
decimal warning_threshold
decimal alarm_threshold
boolean is_active
timestamp created_at
}
SENSOR_DATA {
bigint id PK
string sensor_id FK
decimal value
text raw_value
enum status
timestamp recorded_at
}
SYSTEM_CONFIG {
int id PK
string config_key UK
text config_value
string description
timestamp updated_at
string updated_by
}
USERS ||--o{ AUDIT_LOG : "logs"
RASPBERRY_NODES ||--o{ SENSORS : "contains"
SENSORS ||--o{ SENSOR_DATA : "records"
```

**Diagram sources**
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)
- [databasemanager.cpp](file://databasemanager.cpp)

**Section sources**
- [databasemanager.h](file://databasemanager.h)
- [databasemanager.cpp](file://databasemanager.cpp)
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)

### Configuration: Monitoring Settings and Node Definitions
- raspberry_nodes.json:
  - Defines network subnet/gateway, known RPi nodes, sensors with thresholds, camera stream URLs, and MQTT broker settings.
  - Application settings include auto-connect, reconnect interval, heartbeat, and log level.
- Integration:
  - DashboardWindow reads local IP/subnet for display.
  - ArpScanner uses known RPi list for targeted discovery.

**Section sources**
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [arpscanner.cpp](file://arpscanner.cpp)

## Dependency Analysis
- ArpScanner depends on OS-level commands (arp/ping) and Qt networking to discover devices.
- NetworkScannerDialog composes ArpScanner and presents results in a list with selection capability.
- DashboardWindow orchestrates UI, widgets, and monitoring integration, and logs actions.
- DatabaseManager provides persistence for users and audit logs.
- Configuration influences discovery targets and MQTT connectivity.

```mermaid
graph LR
AS["ArpScanner"] --> NSD["NetworkScannerDialog"]
NSD --> DW["DashboardWindow"]
DW --> DBM["DatabaseManager"]
DW --> CFG["raspberry_nodes.json"]
DBM --> SCHEMA["surveillance_schema.sql"]
DW --> Widgets["Widgets"]
```

**Diagram sources**
- [arpscanner.cpp](file://arpscanner.cpp)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [databasemanager.cpp](file://databasemanager.cpp)
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)

**Section sources**
- [arpscanner.cpp](file://arpscanner.cpp)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [databasemanager.cpp](file://databasemanager.cpp)
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)

## Performance Considerations
- Asynchronous scanning:
  - Uses timers and QProcess to avoid blocking the UI during ping sweeps and ARP parsing.
- Batch processing:
  - Processes ARP output in bulk and emits progress updates periodically.
- Resource management:
  - Stops timers and cleans up QProcess instances after scans.
- Scalability:
  - For large networks, consider:
    - Configurable scan intervals via system_config.
    - Parallelizing ping operations with controlled concurrency limits.
    - Indexing database tables for frequent lookups (already present).
    - Offloading heavy computations to background threads and using signals/slots for thread-safe updates.
- RSSI estimation:
  - Current implementation uses random values; replace with measured values from device APIs or RF probes for accuracy.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Unable to detect local subnet:
  - Ensure the host has an active IPv4 interface and ArpScanner::getLocalSubnet returns a valid CIDR.
- No devices found:
  - Verify ping and arp commands are available on the platform; confirm firewall rules allow ICMP and ARP responses.
- Incorrect device classification:
  - Check MAC prefix lists and hostname heuristics; update SURVEILLANCE_MAC_PREFIXES or hostname patterns as needed.
- RSSI values appear unrealistic:
  - Replace random RSSI assignment with actual measurements from device telemetry.
- Database connection failures:
  - Confirm MySQL service is running, credentials are correct, and the surveillance_db exists.
- Audit logs not recorded:
  - Ensure DatabaseManager::initialize succeeds and tables are created; check for databaseError signals.

**Section sources**
- [arpscanner.cpp](file://arpscanner.cpp)
- [databasemanager.cpp](file://databasemanager.cpp)

## Conclusion
The SurveillanceQT project implements a practical, UI-integrated real-time network monitoring solution centered on ARP-based discovery and ping sweeps. It classifies surveillance modules, tracks online/offline status, and estimates RSSI, integrating results into a dashboard with configurable widgets. Persistence and audit logging support operational oversight, while configuration files define node and broker settings. With modest enhancements—such as accurate RSSI measurement, configurable scan intervals, and improved concurrency—the system can scale effectively for larger deployments.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Monitoring Data Structures and Update Mechanisms
- NetworkDevice fields:
  - ipAddress, macAddress, hostname, deviceType, description, isOnline, rssi.
- Update mechanisms:
  - ArpScanner emits deviceFound and scanFinished signals; NetworkScannerDialog updates the list; DashboardWindow updates status and logs actions.

**Section sources**
- [arpscanner.h](file://arpscanner.h)
- [arpscanner.cpp](file://arpscanner.cpp)
- [networkscannerdialog.cpp](file://networkscannerdialog.cpp)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)

### Integration with the Broader Surveillance Monitoring System
- MQTT broker settings in configuration drive connectivity for sensors and cameras.
- Dashboard widgets consume sensor data and reflect severity levels.
- Database stores historical sensor readings and system configuration.

**Section sources**
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [database/surveillance_schema.sql](file://database/surveillance_schema.sql)

### Examples of Monitoring Configurations, Alert Thresholds, and Troubleshooting
- Example configurations:
  - raspberry_nodes.json: nodes, sensors with warning/alarm thresholds, camera stream URLs, MQTT broker host/port.
  - system_config: mqtt_broker_host, mqtt_broker_port, network_subnet, arp_scan_interval, data_retention_days.
- Threshold examples:
  - Smoke sensor: warning threshold 28%, alarm threshold 60%.
  - Temperature sensor: warning threshold 45°C, alarm threshold 58°C.
- Troubleshooting steps:
  - Validate local IP/subnet detection.
  - Confirm ARP and ping availability.
  - Review audit logs for failed scans or authentication errors.

**Section sources**
- [config/raspberry_nodes.json](file://config/raspberry_nodes.json)
- [dashboardwindow.cpp](file://dashboardwindow.cpp)
- [databasemanager.cpp](file://databasemanager.cpp)