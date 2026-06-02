# -*- coding: utf-8 -*-
"""
Generate UML class diagrams for the smoke sensor (Flying-Fish) and the
CO2/VOC sensor (PIM480 / SGP30) sub-systems.

Output:
  - scripts/diagrams/10_class_diagram_smoke.png
  - scripts/diagrams/11_class_diagram_co2.png
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


def klass(ax, x, y, w, name, attrs, methods,
          header_color=NAVY, attrs_color=LIGHT, fs=8.5):
    """Draw a UML class with name / attributes / methods compartments."""
    head_h = 0.9
    attr_h = max(0.4, 0.4 * len(attrs) + 0.3)
    meth_h = max(0.4, 0.4 * len(methods) + 0.3)
    total_h = head_h + attr_h + meth_h

    # name compartment
    p = FancyBboxPatch((x, y + total_h - head_h), w, head_h,
                       boxstyle="round,pad=0.02,rounding_size=0.05",
                       linewidth=1.3, edgecolor=NAVY, facecolor=header_color)
    ax.add_patch(p)
    ax.text(x + w / 2, y + total_h - head_h / 2, name,
            ha="center", va="center",
            color=WHITE, fontsize=fs + 1, weight="bold")

    # attributes compartment
    r = Rectangle((x, y + meth_h), w, attr_h,
                  linewidth=1.2, edgecolor=NAVY, facecolor=attrs_color)
    ax.add_patch(r)
    for i, a in enumerate(attrs):
        ax.text(x + 0.15, y + meth_h + attr_h - 0.25 - i * 0.4,
                a, ha="left", va="top", fontsize=fs, color=NAVY)

    # methods compartment
    r2 = Rectangle((x, y), w, meth_h,
                   linewidth=1.2, edgecolor=NAVY, facecolor=WHITE)
    ax.add_patch(r2)
    for i, m in enumerate(methods):
        ax.text(x + 0.15, y + meth_h - 0.25 - i * 0.4,
                m, ha="left", va="top", fontsize=fs, color=NAVY)

    return (x, y, w, total_h)


def link(ax, x1, y1, x2, y2, label=None, style="-|>", color=NAVY, dashed=False):
    # Map UML-style relations to matplotlib arrowstyles
    style_map = {
        "-|>": "-|>",   # inheritance / dependency arrow
        "->":  "->",
        "-o":  "-|>",   # composition (we use a simple arrow; label clarifies)
    }
    arrow_style = style_map.get(style, "-|>")
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle=arrow_style, mutation_scale=14,
                        color=color, linewidth=1.4,
                        linestyle=("--" if dashed else "-"))
    ax.add_patch(a)
    if label:
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.2, label,
                ha="center", va="center", fontsize=8, color=NAVY,
                style="italic",
                bbox=dict(boxstyle="round,pad=0.2",
                          fc="white", ec="none", alpha=0.9))


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
# 1. CLASS DIAGRAM - SMOKE SENSOR (Flying-Fish)
# =====================================================
fig, ax = plt.subplots(figsize=(14, 11))
setup(ax, "Diagramme de classes — Capteur de fumée (Flying-Fish)",
      (0, 28), (0, 20))

# QFrame (Qt parent) - placed at top, smaller
klass(ax, 10, 17.5, 8, "QFrame  «Qt»",
      ["(classe Qt de base)"],
      ["+ setStyleSheet(qss)"],
      header_color=GREY)

# SmokeSensorWidget (main class) - moved down to leave room
klass(ax, 10, 6, 8, "SmokeSensorWidget",
      ["- m_titleLabel : QLabel*",
       "- m_iconLabel : QLabel*",
       "- m_stateLabel : QLabel*",
       "- m_detailLabel : QLabel*",
       "- m_chartWidget : QWidget*",
       "- m_timer : QTimer*",
       "- m_historyValues : QVector<int>",
       "- m_smokeDetected : bool",
       "- m_detectionCount : int",
       "- m_severity : Severity",
       "- m_realTimeMode : bool"],
      ["+ SmokeSensorWidget(parent)",
       "+ updateFromMqttDetection(detected: bool)",
       "+ updateFromMqtt(smokeLevel: int)   «legacy»",
       "+ setRealTimeMode(enabled: bool)",
       "+ simulateStep()",
       "+ resetSensor()",
       "+ setTitle(title: QString)",
       "+ isSmokeDetected() : bool",
       "+ severity() : Severity",
       "- refreshUi()  - updateChart()"],
      header_color=NAVY)

# Severity enum (left)
klass(ax, 0.5, 13, 7, "«enumeration»\nSeverity",
      ["Normal", "Warning", "Alarm"],
      [],
      header_color=ORANGE)

# SmokeChartWidget (right top)
klass(ax, 20, 13, 7, "SmokeChartWidget",
      ["- m_values : QVector<int>"],
      ["+ setValues(values)",
       "# paintEvent(event)"],
      header_color=BLUE)

# MqttClient (left bottom)
klass(ax, 0.5, 5, 8, "MqttClient",
      ["- m_socket : QSslSocket*",
       "- m_state : State",
       "- m_useSsl : bool"],
      ["+ connectToBroker(host, port, ssl)",
       "+ subscribe(topic)",
       "signal smokeReceived(level, id)"],
      header_color=GREEN)

# DashboardWindow (right bottom)
klass(ax, 20, 5, 7, "DashboardWindow",
      ["- m_modules : QList<...>"],
      ["+ addWidget(type, name)",
       "+ onSensorValueReceived()"],
      header_color=PURPLE)

# SensorFactory (bottom centered)
klass(ax, 10, 0.3, 8, "SensorFactory",
      ["(static)"],
      ["+ createSmokeSensor(parent, name) : SmokeSensorWidget*",
       "+ defaultWarningThreshold(type) : int",
       "+ defaultAlarmThreshold(type) : int"],
      header_color=ORANGE)

# Inheritance: SmokeSensorWidget -> QFrame
link(ax, 14, 14, 14, 17.5, label="hérite", style="-|>")

# Severity (used by SmokeSensorWidget)
link(ax, 7.5, 14.5, 10, 13, label="utilise", style="->", dashed=True)

# Aggregation: contains SmokeChartWidget
link(ax, 18, 11, 20, 14, label="contient", style="->")

# MqttClient -> SmokeSensorWidget (signal/slot)
link(ax, 8.5, 7, 10, 8,
     label="signal smokeReceived\n→ updateFromMqttDetection",
     style="->", dashed=True)

# DashboardWindow -> SmokeSensorWidget (composition)
link(ax, 20, 7, 18, 8, label="affiche", style="->")

# SensorFactory -> SmokeSensorWidget (creates)
link(ax, 14, 4, 14, 6, label="crée", style="->", dashed=True)

save(fig, "10_class_diagram_smoke.png")


# =====================================================
# 2. CLASS DIAGRAM - CO2 / VOC SENSOR (PIM480 / SGP30)
# =====================================================
fig, ax = plt.subplots(figsize=(14, 11))
setup(ax, "Diagramme de classes — Capteur CO2 / COV (PIM480 / SGP30)",
      (0, 28), (0, 20))

# QFrame parent
klass(ax, 10, 17.5, 8, "QFrame  «Qt»",
      ["(classe Qt de base)"],
      ["+ setStyleSheet(qss)"],
      header_color=GREY)

# GasSensorWidget (CO2/VOC)
klass(ax, 10, 5, 8, "GasSensorWidget",
      ["- m_titleLabel : QLabel*",
       "- m_valueLabel : QLabel*",
       "- m_unitLabel : QLabel*",
       "- m_stateLabel : QLabel*",
       "- m_chartWidget : QWidget*",
       "- m_timer : QTimer*",
       "- m_historyValues : QVector<int>",
       "- m_currentValue : int",
       "- m_unit : QString  (ppm / ppb)",
       "- m_kind : GasKind  (CO2 / VOC)",
       "- m_warningThreshold : int",
       "- m_alarmThreshold : int",
       "- m_realTimeMode : bool"],
      ["+ GasSensorWidget(kind, parent)",
       "+ updateFromMqtt(value: int)",
       "+ setRealTimeMode(enabled: bool)",
       "+ setThresholds(warn, alarm)",
       "+ simulateStep()",
       "+ resetSensor()",
       "+ severity() : Severity",
       "- refreshUi()  - updateChart()"],
      header_color=NAVY)

# Severity (shared enum)
klass(ax, 0.5, 14, 7, "«enumeration»\nSeverity",
      ["Normal", "Warning", "Alarm"],
      [],
      header_color=ORANGE)

# GasKind enum
klass(ax, 0.5, 9.5, 7, "«enumeration»\nGasKind",
      ["CO2  (ppm)", "VOC  (ppb)"],
      [],
      header_color=YELLOW)

# GasChartWidget
klass(ax, 20, 13, 7, "GasChartWidget",
      ["- m_values : QVector<int>",
       "- m_warn : int",
       "- m_alarm : int"],
      ["+ setValues(values)",
       "+ setThresholds(w, a)",
       "# paintEvent(event)"],
      header_color=BLUE)

# MqttClient
klass(ax, 0.5, 4, 8, "MqttClient",
      ["- m_socket : QSslSocket*",
       "- m_state : State"],
      ["+ subscribe(\"…/co2\")",
       "+ subscribe(\"…/voc\")",
       "signal rawDataReceived(topic, payload)"],
      header_color=GREEN)

# DashboardWindow
klass(ax, 20, 5, 7, "DashboardWindow",
      ["- m_modules : QList<...>"],
      ["+ addWidget(type, name)",
       "+ onSensorValueReceived()"],
      header_color=PURPLE)

# SensorFactory
klass(ax, 10, 0.3, 8, "SensorFactory",
      ["(static)"],
      ["+ createGasSensor(parent, kind, name) : GasSensorWidget*",
       "+ defaultWarningThreshold(type) : int",
       "+ defaultAlarmThreshold(type) : int"],
      header_color=ORANGE)

# Inheritance
link(ax, 14, 13, 14, 17.5, label="hérite", style="-|>")

# uses enums
link(ax, 7.5, 15.5, 10, 12.5, label="utilise", style="->", dashed=True)
link(ax, 7.5, 11, 10, 9, label="utilise", style="->", dashed=True)

# composition with chart
link(ax, 18, 10, 20, 14, label="contient", style="->")

# Mqtt → widget
link(ax, 8.5, 6, 10, 7,
     label="rawDataReceived\n→ updateFromMqtt",
     style="->", dashed=True)

# Dashboard → widget
link(ax, 20, 7, 18, 7,
     label="affiche\n(2 instances : CO2 + VOC)", style="->")

# Factory → widget
link(ax, 14, 4, 14, 5, label="crée", style="->", dashed=True)

save(fig, "11_class_diagram_co2.png")

print("\nAll class diagrams generated in:", OUT)
