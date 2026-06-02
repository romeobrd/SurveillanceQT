# -*- coding: utf-8 -*-
"""
Generate all PNG diagrams needed for the Word report.
Output folder: scripts/diagrams/
"""

import os
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
from matplotlib.lines import Line2D

OUT = r"c:\Users\moreo\Documents\applicationmalette\scripts\diagrams"
os.makedirs(OUT, exist_ok=True)

NAVY   = "#1F4E79"
BLUE   = "#5B9BD5"
ORANGE = "#ED7D31"
GREEN  = "#70AD47"
GREY   = "#A6A6A6"
LIGHT  = "#DEEBF7"
YELLOW = "#FFD966"
RED    = "#C00000"
WHITE  = "#FFFFFF"

# ---------- helpers ----------
def box(ax, x, y, w, h, label, color=BLUE, txt_color=WHITE, fs=10, rounded=True):
    style = "round,pad=0.02,rounding_size=0.15" if rounded else "square,pad=0.02"
    p = FancyBboxPatch((x, y), w, h, boxstyle=style,
                       linewidth=1.4, edgecolor=NAVY, facecolor=color)
    ax.add_patch(p)
    ax.text(x + w/2, y + h/2, label, ha="center", va="center",
            color=txt_color, fontsize=fs, weight="bold", wrap=True)

def arrow(ax, x1, y1, x2, y2, label=None, color=NAVY, style="-|>", offset=(0, 0.15)):
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle=style, mutation_scale=14,
                        color=color, linewidth=1.5)
    ax.add_patch(a)
    if label:
        ax.text((x1 + x2)/2 + offset[0], (y1 + y2)/2 + offset[1],
                label, ha="center", va="center", fontsize=8,
                color=NAVY, style="italic",
                bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.85))

def setup(ax, title, xlim, ylim):
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, fontsize=13, weight="bold", color=NAVY, pad=10)

def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print("OK ->", path)

# =====================================================
# 1. ARCHITECTURE GLOBALE
# =====================================================
fig, ax = plt.subplots(figsize=(11, 6.5))
setup(ax, "Figure 1 — Architecture globale du systeme", (0, 22), (0, 13))

# Edge layer
box(ax, 0.5, 9.5, 4, 2.5,
    "Capteurs\n(MQ-2, DHT22,\nCamera RTSP)", color=ORANGE)
box(ax, 6, 9.5, 4, 2.5,
    "Raspberry Pi\n(rpi-001 ... rpi-004)\nPython acquisition", color=GREEN)

# Network layer
box(ax, 11.5, 9.5, 4.5, 2.5,
    "Broker MQTT\nMosquitto\nTLS port 8883", color=NAVY)

# Backend
box(ax, 11.5, 4.5, 4.5, 2.5,
    "Pont MQTT -> MySQL\nmqtt_to_mysql.py", color=BLUE)
box(ax, 17, 4.5, 4.5, 2.5,
    "Base MySQL\nsurveillance_db\n(WAMP)", color=NAVY)

# Client
box(ax, 17, 9.5, 4.5, 2.5,
    "Application Qt 6\nDashboardWindow", color=BLUE)

# Bottom labels
box(ax, 0.5, 0.8, 21, 1.8,
    "Reseau 200.26.16.0/24  -  Broker: 200.26.16.180  -  Detection ARP automatique",
    color=LIGHT, txt_color=NAVY, fs=10)

# Arrows
arrow(ax, 4.5, 10.7, 6, 10.7, "SPI / GPIO")
arrow(ax, 10, 10.7, 11.5, 10.7, "MQTT/TLS\nJSON")
arrow(ax, 16, 10.7, 17, 10.7, "MQTT subscribe")
arrow(ax, 13.7, 9.5, 13.7, 7, "subscribe", offset=(0.7, 0))
arrow(ax, 16, 5.7, 17, 5.7, "INSERT")
arrow(ax, 19.2, 7, 19.2, 9.5, "SELECT\n(historique)", offset=(1.0, 0))

save(fig, "01_architecture_globale.png")

# =====================================================
# 2. MCD - Modele Conceptuel de Donnees
# =====================================================
fig, ax = plt.subplots(figsize=(12, 8))
setup(ax, "Figure 2 — Modele Conceptuel de Donnees (MCD)", (0, 24), (0, 16))

# Entities
def entity(ax, x, y, w, h, name, attrs):
    box(ax, x, y + h - 0.9, w, 0.9, name, color=NAVY, fs=11)
    r = Rectangle((x, y), w, h - 0.9, linewidth=1.3,
                  edgecolor=NAVY, facecolor=LIGHT)
    ax.add_patch(r)
    txt = "\n".join(attrs)
    ax.text(x + 0.2, y + h - 1.1, txt, ha="left", va="top",
            fontsize=8.5, color=NAVY)

def assoc(ax, x, y, w, h, label):
    # diamond approximated by rotated rect
    diamond = mpatches.FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.4",
        linewidth=1.3, edgecolor=NAVY, facecolor=YELLOW)
    ax.add_patch(diamond)
    ax.text(x + w/2, y + h/2, label, ha="center", va="center",
            fontsize=9, weight="bold", color=NAVY)

entity(ax, 0.5, 11, 5, 4.5, "USER",
       ["#id (PK)", "username", "password (SHA-256)", "role", "full_name", "email", "is_active"])

entity(ax, 9, 13, 5, 2.5, "AUDIT_LOG",
       ["#id (PK)", "action", "details", "ip_address", "timestamp"])

entity(ax, 18, 13, 5, 2.5, "SYSTEM_CONFIG",
       ["#id (PK)", "config_key", "config_value", "updated_at"])

entity(ax, 0.5, 4, 5, 4.5, "RASPBERRY_NODE",
       ["#id (PK)", "node_id", "name", "ip_address", "mac_address", "location", "is_online"])

entity(ax, 9, 4, 5, 4.5, "SENSOR",
       ["#id (PK)", "sensor_id", "name", "type", "unit", "warning_threshold", "alarm_threshold"])

entity(ax, 18, 4, 5, 4.5, "SENSOR_DATA",
       ["#id (PK, BIGINT)", "value", "raw_value", "status", "recorded_at"])

# Associations (diamonds)
assoc(ax, 6, 13.5, 2.7, 1.5, "Effectue")
assoc(ax, 15, 13.5, 2.7, 1.5, "Maintient")
assoc(ax, 6, 5.7, 2.7, 1.5, "Heberge")
assoc(ax, 15, 5.7, 2.7, 1.5, "Produit")

# Lines + cardinalities
def card(ax, x1, y1, x2, y2, c1, c2):
    ax.plot([x1, x2], [y1, y2], color=NAVY, linewidth=1.2)
    ax.text(x1, y1 - 0.3, c1, fontsize=8, color=RED, weight="bold")
    ax.text(x2, y2 - 0.3, c2, fontsize=8, color=RED, weight="bold")

card(ax, 5.5, 14, 6, 14.2, "1,n", "1,1")
card(ax, 8.7, 14.2, 9, 14.2, "", "")
card(ax, 5.5, 13, 15, 14.2, "", "")  # invisible-ish
card(ax, 14, 14.2, 15, 14.2, "1,n", "0,1")
card(ax, 17.7, 14.2, 18, 14.2, "", "")
card(ax, 5.5, 6.5, 6, 6.5, "1,n", "1,1")
card(ax, 8.7, 6.5, 9, 6.5, "", "")
card(ax, 14, 6.5, 15, 6.5, "1,n", "1,1")
card(ax, 17.7, 6.5, 18, 6.5, "", "")

# Connect USER vertically to its two associations
ax.plot([3, 3, 6], [11, 14.2, 14.2], color=NAVY, linewidth=1.2)
ax.plot([3, 3, 15], [11, 14.2, 14.2], color=NAVY, linewidth=1.2)

save(fig, "02_mcd.png")

# =====================================================
# 3. MLD - Modele Logique de Donnees (relational)
# =====================================================
fig, ax = plt.subplots(figsize=(12, 8))
setup(ax, "Figure 3 — Modele Logique de Donnees (MLD)", (0, 24), (0, 16))

def table(ax, x, y, w, h, name, rows):
    box(ax, x, y + h - 0.8, w, 0.8, name, color=NAVY, fs=10)
    r = Rectangle((x, y), w, h - 0.8, linewidth=1.2,
                  edgecolor=NAVY, facecolor=WHITE)
    ax.add_patch(r)
    for i, (label, kind) in enumerate(rows):
        col = RED if kind == "PK" else (ORANGE if kind == "FK" else NAVY)
        prefix = {"PK": "PK ", "FK": "FK ", "": "    "}[kind]
        ax.text(x + 0.15, y + h - 1 - i*0.45,
                prefix + label, ha="left", va="top",
                fontsize=8.5, color=col,
                weight=("bold" if kind in ("PK", "FK") else "normal"))

table(ax, 0.5, 10, 5.5, 5.5, "users", [
    ("id", "PK"),
    ("username UNIQUE", ""),
    ("password (hash)", ""),
    ("role ENUM", ""),
    ("full_name", ""),
    ("email", ""),
    ("is_active", ""),
    ("last_login", ""),
])

table(ax, 7, 10, 5.5, 5.5, "audit_log", [
    ("id", "PK"),
    ("username", "FK"),
    ("action", ""),
    ("details", ""),
    ("ip_address", ""),
    ("timestamp", ""),
])

table(ax, 13.5, 10, 5.5, 5.5, "system_config", [
    ("id", "PK"),
    ("config_key UNIQUE", ""),
    ("config_value", ""),
    ("description", ""),
    ("updated_at", ""),
    ("updated_by", "FK"),
])

table(ax, 0.5, 1.5, 5.5, 6.5, "raspberry_nodes", [
    ("id", "PK"),
    ("node_id UNIQUE", ""),
    ("name", ""),
    ("ip_address", ""),
    ("mac_address", ""),
    ("location", ""),
    ("is_online", ""),
    ("last_seen", ""),
])

table(ax, 7, 1.5, 5.5, 6.5, "sensors", [
    ("id", "PK"),
    ("sensor_id UNIQUE", ""),
    ("node_id", "FK"),
    ("name", ""),
    ("type ENUM", ""),
    ("unit", ""),
    ("warning_threshold", ""),
    ("alarm_threshold", ""),
])

table(ax, 13.5, 1.5, 5.5, 6.5, "sensor_data", [
    ("id BIGINT", "PK"),
    ("sensor_id", "FK"),
    ("value", ""),
    ("raw_value", ""),
    ("status ENUM", ""),
    ("recorded_at", ""),
])

# Relations
arrow(ax, 6, 12.5, 7, 12.5, "1..n")             # users -> audit_log
arrow(ax, 13.5, 11, 6, 14, "0..n", offset=(0, 0.5))  # users -> system_config (updated_by)
arrow(ax, 6, 4.5, 7, 4.5, "1..n")               # raspberry_nodes -> sensors
arrow(ax, 12.5, 4.5, 13.5, 4.5, "1..n")         # sensors -> sensor_data

save(fig, "03_mld.png")

# =====================================================
# 4. SEQUENCE DIAGRAM - Smoke sensor data flow
# =====================================================
fig, ax = plt.subplots(figsize=(11, 8))
setup(ax, "Figure 4 — Diagramme de sequence : acquisition fumee temps reel",
      (0, 22), (0, 16))

actors = [
    (2,  "MQ-2", ORANGE),
    (6,  "Raspberry Pi\n(rpi-001)", GREEN),
    (10, "Broker MQTT\n(Mosquitto)", NAVY),
    (14, "App Qt\nMqttClient", BLUE),
    (18, "SmokeSensor\nWidget", BLUE),
]

for x, name, color in actors:
    box(ax, x - 1.4, 14, 2.8, 1.2, name, color=color, fs=9)
    ax.plot([x, x], [1, 14], linestyle="--", color=GREY, linewidth=1)

def msg(ax, x1, x2, y, label, color=NAVY, dashed=False):
    style = "->|" if not dashed else "->|"
    a = FancyArrowPatch((x1, y), (x2, y), arrowstyle="-|>",
                        mutation_scale=12, color=color,
                        linestyle=("--" if dashed else "-"),
                        linewidth=1.4)
    ax.add_patch(a)
    ax.text((x1 + x2)/2, y + 0.25, label, ha="center", va="bottom",
            fontsize=8.5, color=NAVY,
            bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none"))

msg(ax, 2, 6, 13, "1. Mesure SPI (0..1023)")
msg(ax, 6, 6, 12, "2. Conversion -> ppm")
msg(ax, 6, 10, 11, "3. PUBLISH sensors/smoke/rpi-001\n   {\"value\": 37, \"unit\": \"ppm\"}")
msg(ax, 10, 14, 10, "4. forward (MQTT QoS 1)")
msg(ax, 14, 18, 9, "5. signal newSensorValue(int)")
msg(ax, 18, 18, 8, "6. updateFromMqtt(37)")
msg(ax, 18, 18, 7, "7. updateChart() + refresh UI")
msg(ax, 18, 14, 6, "8. ACK affichage", dashed=True)
msg(ax, 14, 10, 5, "9. (heartbeat / keepalive 60s)", dashed=True)

ax.text(11, 1.7, "Frequence : 1 mesure / seconde — Historique : 30 points",
        ha="center", fontsize=9, color=NAVY,
        bbox=dict(boxstyle="round,pad=0.3", fc=LIGHT, ec=NAVY))

save(fig, "04_sequence_smoke.png")

# =====================================================
# 5. USE CASE DIAGRAM - RBAC
# =====================================================
fig, ax = plt.subplots(figsize=(11, 8))
setup(ax, "Figure 5 — Diagramme de cas d'utilisation (RBAC)",
      (0, 22), (0, 14))

# system boundary
sys_rect = Rectangle((6.5, 1), 11, 12, linewidth=1.5,
                     edgecolor=NAVY, facecolor="none", linestyle="-")
ax.add_patch(sys_rect)
ax.text(12, 13.3, "Application Mallette de Surveillance",
        ha="center", fontsize=11, weight="bold", color=NAVY)

# Actors (stick figures via text)
def actor(ax, x, y, label, color=NAVY):
    ax.plot(x, y + 0.6, marker="o", markersize=18,
            markerfacecolor=color, markeredgecolor=NAVY)
    ax.plot([x, x], [y + 0.45, y - 0.4], color=NAVY, linewidth=2)
    ax.plot([x - 0.5, x + 0.5], [y, y + 0.2], color=NAVY, linewidth=2)
    ax.plot([x - 0.4, x], [y - 1.1, y - 0.4], color=NAVY, linewidth=2)
    ax.plot([x + 0.4, x], [y - 1.1, y - 0.4], color=NAVY, linewidth=2)
    ax.text(x, y - 1.6, label, ha="center", fontsize=10,
            weight="bold", color=color)

actor(ax, 2.5, 11, "Administrateur", color=RED)
actor(ax, 2.5, 7,  "Operateur", color=ORANGE)
actor(ax, 2.5, 3,  "Visiteur", color=GREEN)

# Use cases (ellipses)
def uc(ax, x, y, label, color=LIGHT):
    e = mpatches.Ellipse((x, y), 4, 1.1, linewidth=1.3,
                         edgecolor=NAVY, facecolor=color)
    ax.add_patch(e)
    ax.text(x, y, label, ha="center", va="center",
            fontsize=9, color=NAVY)
    return (x, y)

u1 = uc(ax, 9.5, 12, "Se connecter")
u2 = uc(ax, 14.5, 12, "Visualiser capteurs")
u3 = uc(ax, 9.5, 10, "Ajouter / supprimer module")
u4 = uc(ax, 14.5, 10, "Editer module / seuils")
u5 = uc(ax, 9.5, 8, "Consulter historique")
u6 = uc(ax, 14.5, 8, "Consulter audit log")
u7 = uc(ax, 9.5, 6, "Gerer utilisateurs")
u8 = uc(ax, 14.5, 6, "Modifier configuration")
u9 = uc(ax, 12, 4, "Purger donnees (>90j)")

def link(ax, x1, y1, x2, y2):
    ax.plot([x1, x2], [y1, y2], color=NAVY, linewidth=1)

# Admin -> all
for u in [u1, u2, u3, u4, u5, u6, u7, u8, u9]:
    link(ax, 3, 11, u[0] - 1.9, u[1])

# Operator -> connect, view, add/remove, edit, history
for u in [u1, u2, u3, u4, u5]:
    link(ax, 3, 7, u[0] - 1.9, u[1])

# Viewer -> connect, view, history
for u in [u1, u2, u5]:
    link(ax, 3, 3, u[0] - 1.9, u[1])

save(fig, "05_use_case_rbac.png")

# =====================================================
# 6. CLASS DIAGRAM - main Qt classes
# =====================================================
fig, ax = plt.subplots(figsize=(13, 9))
setup(ax, "Figure 6 — Diagramme de classes (extrait simplifie)",
      (0, 26), (0, 18))

def klass(ax, x, y, w, h, name, attrs, methods):
    box(ax, x, y + h - 0.8, w, 0.8, name, color=NAVY, fs=10)
    r1 = Rectangle((x, y + h - 0.8 - len(attrs)*0.4 - 0.2), w,
                   len(attrs)*0.4 + 0.2, linewidth=1.2,
                   edgecolor=NAVY, facecolor=LIGHT)
    ax.add_patch(r1)
    for i, a in enumerate(attrs):
        ax.text(x + 0.15, y + h - 1 - i*0.4, a,
                ha="left", va="top", fontsize=8, color=NAVY)
    base = y + h - 0.8 - len(attrs)*0.4 - 0.2
    r2 = Rectangle((x, base - len(methods)*0.4 - 0.2), w,
                   len(methods)*0.4 + 0.2, linewidth=1.2,
                   edgecolor=NAVY, facecolor=WHITE)
    ax.add_patch(r2)
    for i, m in enumerate(methods):
        ax.text(x + 0.15, base - 0.2 - i*0.4, m,
                ha="left", va="top", fontsize=8, color=NAVY)

klass(ax, 9, 13, 7, 4.5, "DashboardWindow",
      ["- m_modules : QList<ModuleInfo>",
       "- m_mqttClient : MqttClient*",
       "- m_dbManager  : DatabaseManager*"],
      ["+ openModuleManager()",
       "+ onSensorValueReceived()",
       "+ addWidget(type, name)",
       "+ removeWidget(id)"])

klass(ax, 0.5, 13, 7, 4.5, "ModuleManager",
      ["- m_modules : QList<ModuleInfo>"],
      ["+ addModule()",
       "+ editModule(id)",
       "+ removeModule(id)",
       "signal moduleAdded()",
       "signal moduleRemoved()"])

klass(ax, 18, 13, 7, 4.5, "MqttClient",
      ["- m_client : QMqttClient*",
       "- m_sslConfig : QSslConfiguration"],
      ["+ connectToBroker()",
       "+ subscribe(topic)",
       "signal newSensorValue(id, val)"])

klass(ax, 0.5, 6, 7, 5, "WidgetEditor",
      ["- m_info : ModuleInfo"],
      ["+ setModule(info)",
       "+ saveChanges()",
       "+ exec() : int"])

klass(ax, 9, 6, 7, 5, "SmokeSensorWidget",
      ["- m_historyValues : QVector<int>",
       "- m_warningThreshold : int = 50",
       "- m_alarmThreshold   : int = 100",
       "- m_realTimeMode : bool"],
      ["+ updateFromMqtt(int)",
       "+ simulateStep()",
       "+ severity() : Severity",
       "- updateChart()"])

klass(ax, 18, 6, 7, 5, "DatabaseManager",
      ["- m_db : QSqlDatabase"],
      ["+ openConnection()",
       "+ authenticateUser(u, p)",
       "+ fetchHistory(sensorId, n)",
       "+ logAudit(action, details)"])

klass(ax, 9, 0.5, 7, 4, "TemperatureWidget / CameraWidget",
      ["(meme structure)",
       "thresholds, RTSP url..."],
      ["+ updateFromMqtt(...)",
       "+ severity()"])

# Relations
arrow(ax, 9, 15.2, 7.5, 15.2, "ouvre")
arrow(ax, 16, 15.2, 18, 15.2, "abonnement")
arrow(ax, 12.5, 13, 12.5, 11, "agrege")
arrow(ax, 19, 13, 19, 11, "lit")
arrow(ax, 5, 13, 5, 11, "edite")
arrow(ax, 12.5, 6, 12.5, 4.5, "instancie")

save(fig, "06_class_diagram.png")

# =====================================================
# 7. DEPLOYMENT DIAGRAM
# =====================================================
fig, ax = plt.subplots(figsize=(12, 7))
setup(ax, "Figure 7 — Diagramme de deploiement",
      (0, 24), (0, 14))

# Node 1 - Raspberry Pis
box(ax, 0.5, 7, 7, 5.5, "", color=LIGHT, txt_color=NAVY)
ax.text(4, 12, "<<device>> Raspberry Pi", ha="center",
        fontsize=10, weight="bold", color=NAVY)
box(ax, 1, 9, 6, 1.2, "Raspbian OS", color=GREY, fs=9)
box(ax, 1, 7.5, 6, 1.2, "Python acquisition + paho-mqtt", color=GREEN, fs=9)

# Node 2 - Broker server
box(ax, 8.5, 7, 7, 5.5, "", color=LIGHT, txt_color=NAVY)
ax.text(12, 12, "<<server>> Broker (200.26.16.180)",
        ha="center", fontsize=10, weight="bold", color=NAVY)
box(ax, 9, 10, 6, 1.2, "Linux Ubuntu", color=GREY, fs=9)
box(ax, 9, 8.5, 6, 1.2, "Mosquitto (TLS 8883)", color=NAVY, fs=9)
box(ax, 9, 7, 6, 1.2, "mqtt_to_mysql.py", color=BLUE, fs=9)

# Node 3 - WAMP server
box(ax, 16.5, 7, 7, 5.5, "", color=LIGHT, txt_color=NAVY)
ax.text(20, 12, "<<server>> WAMP", ha="center",
        fontsize=10, weight="bold", color=NAVY)
box(ax, 17, 10, 6, 1.2, "Windows Server", color=GREY, fs=9)
box(ax, 17, 8.5, 6, 1.2, "MariaDB / MySQL", color=NAVY, fs=9)
box(ax, 17, 7, 6, 1.2, "surveillance_db", color=BLUE, fs=9)

# Node 4 - Workstation (client)
box(ax, 6, 0.5, 12, 4.5, "", color=LIGHT, txt_color=NAVY)
ax.text(12, 4.5, "<<workstation>> Poste utilisateur (Windows)",
        ha="center", fontsize=10, weight="bold", color=NAVY)
box(ax, 6.5, 2.5, 11, 1.2, "Qt 6 runtime + qsqlmysql.dll", color=GREY, fs=9)
box(ax, 6.5, 1, 11, 1.2, "Application Mallette de Surveillance",
    color=BLUE, fs=9)

# Communications
arrow(ax, 7.5, 8.5, 8.5, 8.5, "MQTT/TLS\n8883")
arrow(ax, 15.5, 8.5, 16.5, 8.5, "JDBC/MySQL\n3306")
arrow(ax, 12, 7, 12, 5, "MQTT subscribe + SELECT")
arrow(ax, 12, 5, 12, 7, "", offset=(0, 0))

save(fig, "07_deployment.png")

# =====================================================
# 8. ACTIVITY DIAGRAM - Add / Remove module
# =====================================================
fig, ax = plt.subplots(figsize=(8, 12))
setup(ax, "Figure 8 — Diagramme d'activite : ajout / suppression de module",
      (0, 12), (0, 22))

# Start
ax.plot(6, 21, marker="o", markersize=14,
        markerfacecolor=NAVY, markeredgecolor=NAVY)
ax.text(6, 21.7, "Debut", ha="center", fontsize=9, weight="bold", color=NAVY)

def act(ax, x, y, w, h, label, color=BLUE):
    box(ax, x - w/2, y - h/2, w, h, label, color=color, fs=9)

def deci(ax, x, y, w, h, label):
    # diamond
    diamond = mpatches.Polygon(
        [[x, y + h/2], [x + w/2, y], [x, y - h/2], [x - w/2, y]],
        closed=True, linewidth=1.3, edgecolor=NAVY, facecolor=YELLOW)
    ax.add_patch(diamond)
    ax.text(x, y, label, ha="center", va="center",
            fontsize=9, weight="bold", color=NAVY)

def aarrow(ax, x1, y1, x2, y2, label=None):
    arrow(ax, x1, y1, x2, y2, label=label)

act(ax, 6, 19, 5, 1, "Clic bouton parametres (cog)")
aarrow(ax, 6, 20.5, 6, 19.5)
act(ax, 6, 17, 5, 1, "Ouvrir ModuleManager (QDialog)")
aarrow(ax, 6, 18.5, 6, 17.5)

deci(ax, 6, 14.5, 4, 2, "Action ?")
aarrow(ax, 6, 16.5, 6, 15.5)

act(ax, 2, 12, 3.5, 1, "Ajouter", color=GREEN)
act(ax, 6, 12, 3.5, 1, "Editer",  color=ORANGE)
act(ax, 10, 12, 3.5, 1, "Supprimer", color=RED)

aarrow(ax, 4, 14, 2, 12.5)
aarrow(ax, 6, 13.5, 6, 12.5)
aarrow(ax, 8, 14, 10, 12.5)

act(ax, 2, 10, 3.5, 1, "Choisir type")
act(ax, 6, 10, 3.5, 1, "WidgetEditor")
act(ax, 10, 10, 3.5, 1, "Confirmation ?")

aarrow(ax, 2, 11.5, 2, 10.5)
aarrow(ax, 6, 11.5, 6, 10.5)
aarrow(ax, 10, 11.5, 10, 10.5)

act(ax, 2, 8, 3.5, 1, "Instancier widget")
act(ax, 6, 8, 3.5, 1, "Mettre a jour info")
act(ax, 10, 8, 3.5, 1, "Detruire widget")

aarrow(ax, 2, 9.5, 2, 8.5)
aarrow(ax, 6, 9.5, 6, 8.5)
aarrow(ax, 10, 9.5, 10, 8.5)

act(ax, 6, 5.5, 6, 1, "Mettre a jour DashboardWindow", color=NAVY)
aarrow(ax, 2, 7.5, 5, 6)
aarrow(ax, 6, 7.5, 6, 6)
aarrow(ax, 10, 7.5, 7, 6)

act(ax, 6, 3.5, 6, 1, "Journaliser dans audit_log", color=ORANGE)
aarrow(ax, 6, 5, 6, 4)

# End
ax.plot(6, 2, marker="o", markersize=14,
        markerfacecolor=WHITE, markeredgecolor=NAVY)
ax.plot(6, 2, marker="o", markersize=8,
        markerfacecolor=NAVY, markeredgecolor=NAVY)
ax.text(6, 1.3, "Fin", ha="center", fontsize=9, weight="bold", color=NAVY)
aarrow(ax, 6, 3, 6, 2.4)

save(fig, "08_activity_module.png")

print("\nAll diagrams generated in:", OUT)
