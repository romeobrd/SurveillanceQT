# -*- coding: utf-8 -*-
"""
Generate a VISUAL (schematic) broker architecture diagram:
  - 16_broker_schema.png

Shows physical devices (Pi, broker server, computer, DB cylinder),
TLS shield, topic pills and publish/subscribe flow.
"""

import os
import math
import matplotlib.pyplot as plt
from matplotlib.patches import (
    FancyBboxPatch, FancyArrowPatch, Rectangle, Circle,
    Polygon, Wedge, Ellipse
)

OUT = r"c:\Users\moreo\Documents\applicationmalette\scripts\diagrams"
os.makedirs(OUT, exist_ok=True)

# Palette
NAVY   = "#1F4E79"
BLUE   = "#5B9BD5"
LIGHTB = "#DEEBF7"
ORANGE = "#ED7D31"
GREEN  = "#70AD47"
LIGHTG = "#E2F0D9"
GREY   = "#A6A6A6"
YELLOW = "#FFD966"
RED    = "#C00000"
PINK   = "#F4CCCC"
WHITE  = "#FFFFFF"
PURPLE = "#7030A0"
LILAC  = "#E4D4F0"
TEAL   = "#2E8B8B"
DARKBG = "#2C3E50"


# ---------- SHAPE HELPERS ----------
def server_rack(ax, x, y, w=4.0, h=4.6, label="Broker", sub=""):
    """Draw a server rack with status LEDs."""
    # outer body
    body = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.04,rounding_size=0.18",
                          linewidth=2, edgecolor=NAVY, facecolor=DARKBG)
    ax.add_patch(body)
    # rack slots
    slot_h = 0.55
    n = int((h - 0.6) / slot_h)
    for i in range(n):
        sy = y + 0.3 + i * slot_h
        slot = Rectangle((x + 0.25, sy), w - 0.5, slot_h - 0.12,
                         facecolor="#34495E", edgecolor="#1B2631", lw=0.8)
        ax.add_patch(slot)
        # leds
        for k, c in enumerate([GREEN, GREEN, ORANGE]):
            led = Circle((x + 0.55 + k * 0.25, sy + (slot_h - 0.12) / 2),
                         0.07, facecolor=c, edgecolor="black", lw=0.4)
            ax.add_patch(led)
        # mock vents
        for j in range(6):
            v = Rectangle((x + 1.5 + j * 0.30, sy + 0.10),
                          0.18, slot_h - 0.32,
                          facecolor="#1B2631", edgecolor="none")
            ax.add_patch(v)
    # label band
    band = Rectangle((x, y + h), w, 0.55,
                     facecolor=NAVY, edgecolor=NAVY)
    ax.add_patch(band)
    ax.text(x + w / 2, y + h + 0.27, label,
            ha="center", va="center", color=WHITE,
            fontsize=11, weight="bold")
    if sub:
        ax.text(x + w / 2, y - 0.30, sub,
                ha="center", va="top", color=NAVY,
                fontsize=9, style="italic")


def raspberry_pi(ax, x, y, w=2.2, h=1.4, color=GREEN, label="Pi"):
    """Stylised Raspberry Pi card."""
    pcb = FancyBboxPatch((x, y), w, h,
                         boxstyle="round,pad=0.02,rounding_size=0.08",
                         linewidth=1.2, edgecolor=NAVY, facecolor=color)
    ax.add_patch(pcb)
    # SoC chip
    chip = Rectangle((x + w * 0.30, y + h * 0.30), w * 0.40, h * 0.40,
                     facecolor="#1B2631", edgecolor="black", lw=0.6)
    ax.add_patch(chip)
    # GPIO pins (top edge)
    for i in range(10):
        pin = Rectangle((x + 0.20 + i * (w - 0.4) / 10, y + h - 0.10),
                        (w - 0.4) / 10 * 0.6, 0.08,
                        facecolor=YELLOW, edgecolor="black", lw=0.3)
        ax.add_patch(pin)
    # USB ports (right edge)
    for i in range(2):
        u = Rectangle((x + w - 0.18, y + 0.15 + i * 0.45),
                      0.20, 0.30,
                      facecolor=GREY, edgecolor="black", lw=0.4)
        ax.add_patch(u)
    ax.text(x + w / 2, y - 0.18, label, ha="center", va="top",
            fontsize=9, weight="bold", color=NAVY)


def sensor_chip(ax, x, y, name, kind="generic", color=ORANGE):
    """Small sensor-module card."""
    w, h = 1.7, 0.75
    box = FancyBboxPatch((x, y), w, h,
                         boxstyle="round,pad=0.02,rounding_size=0.05",
                         linewidth=1.0, edgecolor=NAVY, facecolor=color)
    ax.add_patch(box)
    # kind-specific tiny pictogram
    cx, cy = x + 0.32, y + h / 2
    if kind == "smoke":
        # 3 wavy lines
        for i in range(3):
            ax.plot([cx - 0.18, cx + 0.18],
                    [cy - 0.15 + i * 0.15, cy - 0.15 + i * 0.15],
                    color=WHITE, lw=1.3)
    elif kind == "co2":
        ax.text(cx, cy, "CO₂", ha="center", va="center",
                fontsize=7, weight="bold", color=WHITE)
    elif kind == "temp":
        # thermometer
        ax.plot([cx, cx], [cy - 0.20, cy + 0.18], color=WHITE, lw=1.5)
        ax.add_patch(Circle((cx, cy - 0.22), 0.08,
                            facecolor=WHITE, edgecolor=WHITE))
    ax.text(x + w * 0.62, y + h / 2, name,
            ha="center", va="center", color=WHITE,
            fontsize=8, weight="bold")


def computer(ax, x, y, w=4.2, h=2.6, label="Application Qt"):
    """Computer monitor + base."""
    # screen
    scr = FancyBboxPatch((x, y + 0.6), w, h - 0.6,
                         boxstyle="round,pad=0.02,rounding_size=0.08",
                         linewidth=1.5, edgecolor=NAVY, facecolor=DARKBG)
    ax.add_patch(scr)
    inner = Rectangle((x + 0.15, y + 0.75), w - 0.30, h - 0.90,
                      facecolor="#0F1B2A", edgecolor="none")
    ax.add_patch(inner)
    # mock dashboard widgets on screen
    ax.add_patch(Rectangle((x + 0.30, y + h - 0.65), 1.2, 0.55,
                           facecolor=BLUE, edgecolor="none"))
    ax.add_patch(Rectangle((x + 1.65, y + h - 0.65), 1.2, 0.55,
                           facecolor=GREEN, edgecolor="none"))
    ax.add_patch(Rectangle((x + 3.00, y + h - 0.65), 1.0, 0.55,
                           facecolor=RED,   edgecolor="none"))
    # mini chart line
    xs = [x + 0.30 + i * 0.30 for i in range(13)]
    ys = [y + 1.10 + 0.12 * math.sin(i * 0.9) for i in range(13)]
    ax.plot(xs, ys, color=YELLOW, lw=1.4)
    # base
    base = Polygon([(x + w * 0.35, y + 0.6),
                    (x + w * 0.65, y + 0.6),
                    (x + w * 0.55, y + 0.05),
                    (x + w * 0.45, y + 0.05)],
                   closed=True, facecolor=GREY, edgecolor=NAVY, lw=1.0)
    ax.add_patch(base)
    foot = Rectangle((x + w * 0.30, y), w * 0.40, 0.12,
                     facecolor=GREY, edgecolor=NAVY, lw=1.0)
    ax.add_patch(foot)
    ax.text(x + w / 2, y - 0.30, label, ha="center", va="top",
            fontsize=10, weight="bold", color=NAVY)


def database_cylinder(ax, x, y, w=3.2, h=2.4, label="MySQL\nsurveillance_db"):
    rx = w / 2
    ry = 0.32
    # body
    ax.add_patch(Rectangle((x - rx, y), w, h - ry,
                           facecolor=TEAL, edgecolor=NAVY, lw=1.4))
    # bottom ellipse
    ax.add_patch(Ellipse((x, y), w, ry * 2,
                         facecolor=TEAL, edgecolor=NAVY, lw=1.4))
    # top ellipse
    ax.add_patch(Ellipse((x, y + h - ry), w, ry * 2,
                         facecolor="#3FA8A8", edgecolor=NAVY, lw=1.4))
    # rings
    for i in range(1, 4):
        ax.add_patch(Ellipse((x, y + h - ry - i * 0.55), w, ry * 2,
                             facecolor="none", edgecolor=NAVY, lw=0.7))
    ax.text(x, y - 0.45, label, ha="center", va="top",
            fontsize=9, weight="bold", color=NAVY)


def shield_lock(ax, x, y, scale=1.0, label="TLS\nmTLS"):
    """Shield with padlock body."""
    s = scale
    pts = [
        (x, y + 0.9 * s),
        (x + 0.65 * s, y + 0.7 * s),
        (x + 0.65 * s, y - 0.10 * s),
        (x, y - 0.85 * s),
        (x - 0.65 * s, y - 0.10 * s),
        (x - 0.65 * s, y + 0.7 * s),
    ]
    ax.add_patch(Polygon(pts, closed=True, facecolor=YELLOW,
                         edgecolor=NAVY, lw=1.8))
    # padlock
    ax.add_patch(Rectangle((x - 0.20 * s, y - 0.35 * s),
                           0.40 * s, 0.40 * s,
                           facecolor=NAVY, edgecolor=NAVY))
    ax.add_patch(Wedge((x, y + 0.02 * s), 0.20 * s, 0, 180,
                       width=0.07 * s, facecolor=NAVY, edgecolor=NAVY))
    ax.text(x, y - 0.65 * s, label, ha="center", va="top",
            fontsize=8.5, weight="bold", color=NAVY)


def topic_pill(ax, x, y, text, color=BLUE, fc=None):
    box = FancyBboxPatch((x - 1.55, y - 0.25), 3.1, 0.5,
                         boxstyle="round,pad=0.04,rounding_size=0.25",
                         linewidth=1.2, edgecolor=color,
                         facecolor=(fc or "white"))
    ax.add_patch(box)
    ax.text(x, y, text, ha="center", va="center",
            fontsize=8.5, weight="bold", color=color, family="monospace")


def flow_arrow(ax, x1, y1, x2, y2, color=NAVY, lw=2.4, dashed=False):
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle="-|>", mutation_scale=22,
                        color=color, linewidth=lw,
                        linestyle=("--" if dashed else "-"),
                        shrinkA=4, shrinkB=4)
    ax.add_patch(a)


# =========================================================
# DIAGRAM
# =========================================================
fig, ax = plt.subplots(figsize=(17, 10))
ax.set_xlim(0, 28)
ax.set_ylim(0, 16)
ax.set_aspect("equal")
ax.axis("off")
ax.set_title("Architecture du broker MQTT — Schéma global",
             fontsize=14, weight="bold", color=NAVY, pad=12)

# subtle background gradient: top sky, bottom grey-ish
ax.add_patch(Rectangle((0, 0), 28, 16,
                       facecolor="#F7FBFF", edgecolor="none", zorder=-2))

# ---------- LEFT : 3 SENSORS WITH PIS ----------
# rpi-001 Temperature
raspberry_pi(ax, 1.0, 12.6, color=LIGHTG, label="Raspberry Pi  rpi-001")
sensor_chip(ax, 0.7, 14.4, "DHT22", kind="temp", color=GREEN)

# rpi-002 CO2
raspberry_pi(ax, 1.0, 8.4,  color=LILAC, label="Raspberry Pi  rpi-002")
sensor_chip(ax, 0.7, 10.2, "PIM480", kind="co2", color=PURPLE)

# rpi-003 Smoke
raspberry_pi(ax, 1.0, 4.2,  color=PINK, label="Raspberry Pi  rpi-003")
sensor_chip(ax, 0.7, 6.0,  "Flying-Fish", kind="smoke", color=RED)

# ---------- CENTER : MOSQUITTO BROKER ----------
server_rack(ax, 11.5, 6.0, w=4.5, h=5.0,
            label="Broker  Mosquitto",
            sub="200.26.16.180   port 8883 (TLS)")

# Shield over the broker
shield_lock(ax, 13.75, 13.5, scale=0.85)

# ---------- RIGHT : APPLICATION + DATABASE ----------
computer(ax, 22.0, 11.0, w=4.5, h=3.0, label="Application Qt  (MqttClient)")
database_cylinder(ax, 24.0, 4.0, w=3.0, h=3.5,
                  label="MySQL  surveillance_db")

# Bridge box
bridge = FancyBboxPatch((19.5, 7.7), 6.5, 1.6,
                        boxstyle="round,pad=0.04,rounding_size=0.10",
                        linewidth=1.4, edgecolor=NAVY, facecolor=ORANGE)
ax.add_patch(bridge)
ax.text(22.75, 8.85, "Pont MQTT → MySQL",
        ha="center", va="center", color=WHITE,
        fontsize=10, weight="bold")
ax.text(22.75, 8.20, "mqtt_to_mysql.py  (paho-mqtt)",
        ha="center", va="center", color=WHITE,
        fontsize=8.5, style="italic")

# ---------- TOPIC PILLS  (left → broker)  ----------
topic_pill(ax, 7.0, 13.4, "PUB  sensors/temperature", color=GREEN, fc=LIGHTG)
topic_pill(ax, 7.0,  9.2, "PUB  sensors/co2 + /voc",  color=PURPLE, fc=LILAC)
topic_pill(ax, 7.0,  5.0, "PUB  sensors/smoke",       color=RED,    fc=PINK)

# ---------- ARROWS  Pi → broker  ----------
flow_arrow(ax, 3.3, 13.3, 11.5,  9.4, color=GREEN)
flow_arrow(ax, 3.3,  9.1, 11.5,  8.5, color=PURPLE)
flow_arrow(ax, 3.3,  4.9, 11.5,  7.3, color=RED)

# ---------- TOPIC PILL : broker → Qt app ----------
topic_pill(ax, 18.7, 12.0, "SUB  sensors/#  (Qt)", color=BLUE, fc=LIGHTB)
flow_arrow(ax, 16.0, 10.0, 22.0, 12.0, color=BLUE)

# ---------- TOPIC PILL : broker → bridge ----------
topic_pill(ax, 18.7, 9.45, "SUB  sensors/# rpi-00X/#",
           color=ORANGE, fc="#FCE4D2")
flow_arrow(ax, 16.0, 8.5, 19.5, 8.5, color=ORANGE)

# ---------- bridge → DB ----------
flow_arrow(ax, 22.5, 7.7, 23.0, 6.7, color=TEAL, lw=2.6)
ax.text(20.0, 6.0, "INSERT INTO\ntemperature_readings\nsmoke_readings , …",
        ha="left", va="center", fontsize=8, color=TEAL,
        bbox=dict(boxstyle="round,pad=0.18", fc="white",
                  ec=TEAL, lw=0.8))

# ---------- CERTIFICATE BANNER ----------
cert = FancyBboxPatch((0.5, 0.4), 27.0, 2.6,
                      boxstyle="round,pad=0.04,rounding_size=0.12",
                      linewidth=1.4, edgecolor=NAVY, facecolor="#FFF8E1")
ax.add_patch(cert)
ax.text(1.0, 2.6, "Chaîne de certificats (PKI) — mTLS",
        ha="left", va="center", fontsize=11, weight="bold", color=NAVY)

# 4 cert tiles inside the banner
def cert_tile(ax, x, y, title, sub, color):
    w, h = 6.0, 1.4
    t = FancyBboxPatch((x, y), w, h,
                       boxstyle="round,pad=0.02,rounding_size=0.06",
                       linewidth=1.0, edgecolor=color, facecolor="white")
    ax.add_patch(t)
    # mini cert ribbon
    ax.add_patch(Circle((x + 0.45, y + h / 2), 0.30,
                        facecolor=color, edgecolor=NAVY, lw=0.8))
    ax.add_patch(Polygon([(x + 0.30, y + 0.50),
                          (x + 0.60, y + 0.50),
                          (x + 0.45, y + 0.10)],
                         closed=True, facecolor=color, edgecolor=NAVY, lw=0.6))
    ax.text(x + 0.95, y + h - 0.40, title,
            ha="left", va="center", fontsize=9, weight="bold", color=NAVY)
    ax.text(x + 0.95, y + 0.40, sub,
            ha="left", va="center", fontsize=8, color=NAVY,
            family="monospace")

cert_tile(ax, 0.9,  0.7,  "CA (autorité)",
          "ca.crt   →  signe tous les certs",     YELLOW)
cert_tile(ax, 7.3,  0.7,  "Broker",
          "server.crt + server.key",              NAVY)
cert_tile(ax, 13.7, 0.7,  "Raspberry Pi  (mTLS)",
          "client_rpi-XXX.crt / .key",            GREEN)
cert_tile(ax, 20.5, 0.7,  "Application Qt  (mTLS)",
          "client_qt.crt / .key  +  ca.crt",      BLUE)

# Caption
ax.text(14.0, 15.2,
        "Les capteurs PUBLIENT vers le broker, qui DIFFUSE aux abonnés "
        "(application Qt + pont MySQL).  Tout transite en TLS sur 8883.",
        ha="center", va="center", fontsize=10, color=NAVY, style="italic")

path = os.path.join(OUT, "16_broker_schema.png")
fig.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
plt.close(fig)
print("OK ->", path)
