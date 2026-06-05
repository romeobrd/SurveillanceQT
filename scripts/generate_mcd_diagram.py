# -*- coding: utf-8 -*-
"""
Generate MCD (Modèle Conceptuel de Données) diagram for surveillance_db.
Style: MERISE — entités (rectangles) + associations (ellipses) + cardinalités.
Output: 17_mcd_database.png
"""

import os
import matplotlib.pyplot as plt
from matplotlib.patches import (
    FancyBboxPatch, Ellipse, FancyArrowPatch, Rectangle
)

OUT = r"c:\Users\moreo\Documents\applicationmalette\scripts\diagrams"
os.makedirs(OUT, exist_ok=True)

# Palette
NAVY   = "#1F4E79"
BLUE   = "#5B9BD5"
LIGHTB = "#DEEBF7"
ORANGE = "#ED7D31"
LIGHTO = "#FCE4D2"
GREEN  = "#70AD47"
LIGHTG = "#E2F0D9"
PURPLE = "#7030A0"
LILAC  = "#E4D4F0"
RED    = "#C00000"
PINK   = "#F4CCCC"
YELLOW = "#FFD966"
GREY   = "#A6A6A6"
WHITE  = "#FFFFFF"


def entity(ax, x, y, w, h, name, attrs, header=NAVY, body=LIGHTB,
           pk_index=0):
    """Draw an MCD entity rectangle: header + attribute list."""
    # body
    rect = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.02,rounding_size=0.10",
                          linewidth=1.6, edgecolor=NAVY, facecolor=body)
    ax.add_patch(rect)
    # header
    head = Rectangle((x, y + h - 0.55), w, 0.55,
                     facecolor=header, edgecolor=NAVY, lw=1.2)
    ax.add_patch(head)
    ax.text(x + w / 2, y + h - 0.275, name,
            ha="center", va="center", color=WHITE,
            fontsize=10.5, weight="bold")
    # attributes
    line_h = (h - 0.65) / max(len(attrs), 1)
    for i, attr in enumerate(attrs):
        ay = y + h - 0.55 - (i + 0.5) * line_h
        is_pk = (i == pk_index)
        prefix = "# " if is_pk else "  "
        ax.text(x + 0.18, ay, prefix + attr,
                ha="left", va="center",
                fontsize=8.3,
                weight=("bold" if is_pk else "normal"),
                color=NAVY,
                family="monospace")
        # underline PK
        if is_pk:
            txt_w = w - 0.32
            ax.plot([x + 0.18, x + 0.18 + txt_w * 0.55],
                    [ay - 0.13, ay - 0.13],
                    color=NAVY, lw=0.9)


def association(ax, cx, cy, name, w=2.0, h=1.0, color=YELLOW):
    """Draw an MCD association as an ellipse."""
    e = Ellipse((cx, cy), w, h, facecolor=color, edgecolor=NAVY, lw=1.4)
    ax.add_patch(e)
    ax.text(cx, cy, name, ha="center", va="center",
            fontsize=9.2, weight="bold", color=NAVY, style="italic")


def link(ax, x1, y1, x2, y2, card):
    """Draw a leg from entity to association, with ONE cardinality near entity."""
    ax.plot([x1, x2], [y1, y2], color=NAVY, lw=1.4, zorder=1)
    # cardinality at midpoint, slightly offset perpendicular
    dx, dy = (x2 - x1), (y2 - y1)
    L = max((dx ** 2 + dy ** 2) ** 0.5, 0.001)
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux  # perpendicular
    mx = x1 + ux * (L * 0.45)
    my = y1 + uy * (L * 0.45)
    cx = mx + nx * 0.30
    cy = my + ny * 0.30
    ax.text(cx, cy, card, ha="center", va="center",
            fontsize=8.7, weight="bold", color=RED,
            bbox=dict(boxstyle="round,pad=0.10",
                      fc="white", ec=RED, lw=0.7))


# =========================================================
# DIAGRAM
# =========================================================
fig, ax = plt.subplots(figsize=(18, 12))
ax.set_xlim(0, 24)
ax.set_ylim(0, 16)
ax.set_aspect("equal")
ax.axis("off")
ax.set_title("MCD — Base de données  surveillance_db  (schéma réel phpMyAdmin)",
             fontsize=14, weight="bold", color=NAVY, pad=12)

# bg
ax.add_patch(Rectangle((0, 0), 24, 16,
                       facecolor="#F7FBFF", edgecolor="none", zorder=-2))

# -------- ENTITIES --------
# UTILISATEUR (top-left)
entity(ax, 0.6, 10.4, 4.8, 5.0, "USERS",
       ["id                int",
        "username          varchar(50)",
        "password          varchar(255)",
        "role              enum(admin,",
        "                  operator, viewer)",
        "full_name         varchar(100)",
        "email             varchar(100)",
        "is_active         tinyint(1)",
        "last_login        datetime",
        "created_at        timestamp",
        "updated_at        timestamp"],
       header=NAVY, body=LIGHTB)

# JOURNAL_AUDIT (top-center)
entity(ax, 9.5, 11.5, 5.0, 3.8, "AUDIT_LOG",
       ["id                int",
        "username          varchar(50)",
        "action            varchar(100)",
        "details           text",
        "ip_address        varchar(45)",
        "timestamp         timestamp"],
       header=ORANGE, body=LIGHTO)

# CONFIG_SYSTEME (top-right)
entity(ax, 18.0, 11.5, 5.4, 3.8, "SYSTEM_CONFIG",
       ["id                int",
        "config_key        varchar(50)",
        "config_value      text",
        "description       varchar(255)",
        "updated_at        timestamp",
        "updated_by        varchar(50)"],
       header=PURPLE, body=LILAC)

# NOEUD_RPI (middle-left)
entity(ax, 0.6, 5.0, 4.8, 4.7, "RASPBERRY_NODES",
       ["id                int",
        "node_id           varchar(20)",
        "name              varchar(100)",
        "ip_address        varchar(15)",
        "mac_address       varchar(17)",
        "location          varchar(100)",
        "is_online         tinyint(1)",
        "last_seen         datetime",
        "created_at        timestamp"],
       header=GREEN, body=LIGHTG)

# CAPTEUR (middle-center)
entity(ax, 9.3, 5.0, 5.4, 4.7, "SENSORS",
       ["id                int",
        "sensor_id         varchar(20)",
        "node_id           varchar(20)  (FK)",
        "name              varchar(100)",
        "type              enum(smoke, temp,",
        "                  humidity, co2, voc,",
        "                  camera, radiation)",
        "unit              varchar(20)",
        "warning_threshold decimal(10,2)",
        "alarm_threshold   decimal(10,2)",
        "is_active         tinyint(1)",
        "created_at        timestamp"],
       header=BLUE, body=LIGHTB)

# MESURE (middle-right)
entity(ax, 18.0, 5.0, 5.4, 4.7, "SENSOR_DATA",
       ["id                bigint",
        "sensor_id         varchar(20)  (FK)",
        "value             decimal(10,2)",
        "raw_value         text",
        "status            enum(normal,",
        "                  warning, alarm,",
        "                  error)",
        "recorded_at       timestamp"],
       header=RED, body=PINK)

# -------- ASSOCIATIONS --------
# UTILISATEUR -- effectue -- JOURNAL_AUDIT
association(ax, 7.4, 13.4, "effectue", w=2.0, h=0.9, color=YELLOW)
link(ax, 5.4, 13.4, 6.4, 13.4, "(0,n)")
link(ax, 8.4, 13.4, 9.5, 13.4, "(1,1)")

# UTILISATEUR -- modifie -- CONFIG_SYSTEME
association(ax, 16.3, 13.4, "modifie", w=2.0, h=0.9, color=YELLOW)
link(ax, 14.5, 13.4, 15.3, 13.4, "(0,n)")
link(ax, 17.3, 13.4, 18.0, 13.4, "(1,1)")

# NOEUD_RPI -- héberge -- CAPTEUR
association(ax, 7.4, 7.3, "héberge", w=2.0, h=0.9, color=YELLOW)
link(ax, 5.4, 7.3, 6.4, 7.3, "(1,n)")
link(ax, 8.4, 7.3, 9.3, 7.3, "(1,1)")

# CAPTEUR -- produit -- MESURE
association(ax, 16.3, 7.3, "produit", w=2.0, h=0.9, color=YELLOW)
link(ax, 14.7, 7.3, 15.3, 7.3, "(1,n)")
link(ax, 17.3, 7.3, 18.0, 7.3, "(1,1)")

# UTILISATEUR -- supervise -- CAPTEUR  (consultation/seuils)
association(ax, 6.0, 9.4, "supervise", w=2.2, h=0.9, color=YELLOW)
link(ax, 3.0, 10.4, 5.6, 9.7, "(0,n)")
link(ax, 7.1, 9.4, 11.0, 9.6, "(0,n)")

# -------- LEGEND / NOTES --------
legend = FancyBboxPatch((0.5, 0.5), 23.0, 4.2,
                        boxstyle="round,pad=0.04,rounding_size=0.12",
                        linewidth=1.4, edgecolor=NAVY, facecolor="#FFF8E1")
ax.add_patch(legend)
ax.text(1.0, 4.3, "Légende et règles de gestion",
        ha="left", va="center", fontsize=11, weight="bold", color=NAVY)

notes = [
    "•  #attribut souligné  :  identifiant (clé primaire)",
    "•  Cardinalités MERISE :  (min, max)  —  (0,n)=optionnel multiple   (1,n)=obligatoire multiple",
    "",
    "Règles de gestion :",
    "  R1.  Un utilisateur effectue 0 à n actions consignées dans le journal d'audit (traçabilité RGPD).",
    "  R2.  Un nœud Raspberry Pi héberge 1 à n capteurs ; un capteur appartient à exactement un nœud.",
    "  R3.  Un capteur produit 0 à n mesures horodatées ; chaque mesure provient d'un seul capteur.",
    "  R4.  Un utilisateur (admin) peut modifier 0 à n paramètres de la table CONFIG_SYSTEME.",
    "  R5.  Un utilisateur (admin/operator) supervise 0 à n capteurs (réglage des seuils, activation).",
]
for i, t in enumerate(notes):
    ax.text(1.0, 3.85 - i * 0.36, t, ha="left", va="center",
            fontsize=8.8, color=NAVY,
            family=("monospace" if "•" in t or "(" in t else "DejaVu Sans"))

path = os.path.join(OUT, "17_mcd_database.png")
fig.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
plt.close(fig)
print("OK ->", path)
