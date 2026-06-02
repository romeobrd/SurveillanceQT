# -*- coding: utf-8 -*-
"""
Generate broker communication diagram:
  - 15_broker_architecture.png
Shows: Raspberry Pi sensors -> MQTT broker (TLS 8883) -> MySQL bridge,
       certificates (CA + server.crt/key), and topic structure.
"""

import os
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

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
PURPLE = "#7030A0"
TEAL   = "#2E8B8B"


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


def node(ax, x, y, w, h, title, lines, header=NAVY, body=LIGHT,
         title_fs=10, body_fs=8.5):
    """Draw a labelled box with header bar + body lines."""
    head_h = 0.55
    # body
    body_box = FancyBboxPatch((x, y), w, h,
                              boxstyle="round,pad=0.02,rounding_size=0.06",
                              linewidth=1.4, edgecolor=NAVY, facecolor=body)
    ax.add_patch(body_box)
    # header
    head_box = Rectangle((x, y + h - head_h), w, head_h,
                         linewidth=0, edgecolor="none", facecolor=header)
    ax.add_patch(head_box)
    ax.text(x + w / 2, y + h - head_h / 2, title, ha="center", va="center",
            color=WHITE, fontsize=title_fs, weight="bold")
    # body lines
    for i, ln in enumerate(lines):
        ax.text(x + 0.18, y + h - head_h - 0.30 - i * 0.34, ln,
                ha="left", va="top", fontsize=body_fs, color=NAVY)


def arrow(ax, x1, y1, x2, y2, label=None, color=NAVY, dashed=False,
          lw=1.6, label_color=None, label_off=(0, 0.25)):
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle="->", mutation_scale=15,
                        color=color, linewidth=lw,
                        linestyle=("--" if dashed else "-"))
    ax.add_patch(a)
    if label:
        mx, my = (x1 + x2) / 2 + label_off[0], (y1 + y2) / 2 + label_off[1]
        ax.text(mx, my, label, ha="center", va="center",
                fontsize=8.5, weight="bold",
                color=(label_color or color),
                bbox=dict(boxstyle="round,pad=0.22",
                          fc="white", ec=color, lw=0.9, alpha=0.96))


# =========================================================
# DIAGRAM
# =========================================================
fig, ax = plt.subplots(figsize=(17, 11))
setup(ax, "Architecture du broker MQTT — Capteurs / Certificats / Topics",
      (0, 30), (0, 18))

# ---------- LEFT COLUMN : Raspberry Pi sensors ----------
# rpi-001 (temperature)
node(ax, 0.5, 13.5, 6.5, 3.6,
     "Raspberry Pi  rpi-001",
     [
        "Capteur : DHT22 (température / humidité)",
        "Script   : temperature.py  (paho-mqtt)",
        "Cert.   : ca.crt + client_rpi-001.crt/key",
        "Publie  → sensors/temperature",
        "Payload : {\"temperature\":24.3,\"humidity\":58}",
     ],
     header=GREEN)

# rpi-002 (CO2 / VOC – PIM480)
node(ax, 0.5, 8.5, 6.5, 3.6,
     "Raspberry Pi  rpi-002",
     [
        "Capteur : PIM480 / SGP30 (eCO2 + COV)",
        "Script   : co2.py  (paho-mqtt + I²C)",
        "Cert.   : ca.crt + client_rpi-002.crt/key",
        "Publie  → sensors/co2 , sensors/voc",
        "Payload : {\"co2\":612,\"voc\":85}",
     ],
     header=PURPLE)

# rpi-003 (smoke – Flying-Fish)
node(ax, 0.5, 3.5, 6.5, 3.6,
     "Raspberry Pi  rpi-003",
     [
        "Capteur : Flying-Fish (sortie numérique GPIO17)",
        "Script   : fumee.py  (paho-mqtt + RPi.GPIO)",
        "Cert.   : ca.crt + client_rpi-003.crt/key",
        "Publie  → sensors/smoke",
        "Payload : {\"smoke\":true}  /  {\"smoke\":false}",
     ],
     header=RED)

# ---------- CENTER : MQTT BROKER ----------
node(ax, 11.0, 7.0, 8.0, 8.5,
     "Broker  Mosquitto",
     [
        "Hôte   : 200.26.16.180",
        "Port TCP : 1883  (in-cleart, désactivé)",
        "Port TLS : 8883  ✓ (utilisé)",
        "",
        "Configuration :",
        "  cafile   /etc/mosquitto/ca_certificates/ca.crt",
        "  certfile /etc/mosquitto/certs/server.crt",
        "  keyfile  /etc/mosquitto/certs/server.key",
        "",
        "Authentification :",
        "  - mTLS (certificat client signé par CA)",
        "  - vérification CN  /  ACL par topic",
        "",
        "Topics gérés :",
        "  sensors/#   (tous les capteurs)",
        "  rpi-001/#   rpi-002/#   rpi-003/#",
     ],
     header=NAVY, title_fs=11)

# Lock icon (TLS) on the broker
ax.text(15.0, 16.0, "[ TLS 1.2 / 1.3  -  mTLS ]",
        ha="center", va="center", fontsize=11,
        weight="bold", color=NAVY,
        bbox=dict(boxstyle="round,pad=0.35",
                  fc=YELLOW, ec=NAVY, lw=1.4))

# ---------- RIGHT TOP : Qt application ----------
node(ax, 22.5, 11.5, 7.2, 6.0,
     "Application Qt  (MqttClient)",
     [
        "Classe  : MqttClient  (QSslSocket)",
        "Cert.   : ca.crt  (vérification serveur)",
        "Client  : client.crt / client.key (mTLS)",
        "",
        "Souscriptions :",
        "  sensors/temperature  → TemperatureWidget",
        "  sensors/smoke        → SmokeSensorWidget",
        "  sensors/co2 , /voc   → GasSensorWidget",
        "",
        "Signaux Qt :",
        "  temperatureReceived(temp,hum,id)",
        "  smokeReceived(level,id)",
        "  rawDataReceived(topic,payload)",
     ],
     header=BLUE, title_fs=10)

# ---------- RIGHT BOTTOM : MySQL bridge + DB ----------
node(ax, 22.5, 5.5, 7.2, 4.5,
     "Pont MQTT → MySQL",
     [
        "Script  : mqtt_to_mysql.py (paho-mqtt)",
        "Souscrit : sensors/# , rpi-00X/#",
        "Insère dans :",
        "  - temperature_readings",
        "  - smoke_readings",
        "  - sensor_readings (générique)",
     ],
     header=ORANGE)

node(ax, 22.5, 1.0, 7.2, 3.6,
     "Base MySQL  surveillance_db",
     [
        "Tables :",
        "  users , modules , sensors",
        "  temperature_readings , smoke_readings",
        "  alerts , audit_log",
     ],
     header=TEAL)

# ---------- ARROWS : sensors → broker (TLS publish) ----------
arrow(ax, 7.0, 15.3, 11.0, 14.0,
      label="PUBLISH  TLS:8883\nsensors/temperature",
      color=GREEN)
arrow(ax, 7.0, 10.3, 11.0, 11.5,
      label="PUBLISH  TLS:8883\nsensors/co2 , sensors/voc",
      color=PURPLE)
arrow(ax, 7.0, 5.3, 11.0, 9.0,
      label="PUBLISH  TLS:8883\nsensors/smoke",
      color=RED)

# ---------- ARROWS : broker → Qt app (subscribe) ----------
arrow(ax, 19.0, 13.0, 22.5, 14.0,
      label="SUBSCRIBE  TLS:8883\nsensors/#  (mTLS)",
      color=BLUE)

# ---------- ARROWS : broker → bridge → DB ----------
arrow(ax, 19.0, 9.0, 22.5, 7.5,
      label="SUBSCRIBE\nsensors/#  rpi-00X/#",
      color=ORANGE)
arrow(ax, 26.1, 5.5, 26.1, 4.6,
      label="INSERT INTO ...",
      color=TEAL, label_off=(1.6, 0))

# ---------- CERTIFICATE LEGEND ----------
node(ax, 0.5, 0.2, 9.5, 2.8,
     "Chaîne de certificats (PKI)",
     [
        "ca.crt           ← Autorité de certification (auto-signée)",
        "server.crt/.key  ← Identité du broker (signé par la CA)",
        "client_rpi-XXX.crt/.key  ← Identité de chaque Pi (mTLS)",
        "client_qt.crt/.key       ← Identité de l'application Qt",
     ],
     header=GREY)

# Title-arrow legend
ax.text(15.0, 0.7,
        "Toutes les communications transitent par le port 8883 chiffré (TLS).\n"
        "L'authentification mutuelle (mTLS) garantit que seuls les clients connus\n"
        "(Pi + application Qt) peuvent publier/souscrire aux topics surveillés.",
        ha="center", va="center", fontsize=9, color=NAVY,
        style="italic",
        bbox=dict(boxstyle="round,pad=0.35", fc=LIGHT, ec=NAVY, lw=1.0))

save(fig, "15_broker_architecture.png")

print("\nBroker diagram generated in:", OUT)
