# -*- coding: utf-8 -*-
"""
Generate UML diagrams for the "Add / Remove modules" feature:
  - Use case diagram   -> 12_usecase_modules.png
  - Sequence: ADD      -> 13_sequence_add_module.png
  - Sequence: DELETE   -> 14_sequence_delete_module.png
"""

import os
import matplotlib.pyplot as plt
from matplotlib.patches import (
    FancyBboxPatch, FancyArrowPatch, Rectangle,
    Ellipse, Circle
)

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


# =========================================================
# Helpers for use-case diagram
# =========================================================
def actor(ax, x, y, name, color=NAVY):
    """Draw a stick-figure actor + label."""
    head = Circle((x, y + 0.45), 0.18, fill=False, lw=1.6, color=color)
    ax.add_patch(head)
    ax.plot([x, x], [y + 0.27, y - 0.30], color=color, lw=1.6)          # body
    ax.plot([x - 0.30, x + 0.30], [y + 0.05, y + 0.05], color=color, lw=1.6)  # arms
    ax.plot([x, x - 0.25], [y - 0.30, y - 0.70], color=color, lw=1.6)   # leg
    ax.plot([x, x + 0.25], [y - 0.30, y - 0.70], color=color, lw=1.6)   # leg
    ax.text(x, y - 0.95, name, ha="center", va="top",
            fontsize=10, weight="bold", color=color)


def usecase(ax, x, y, w, h, text, color=BLUE):
    e = Ellipse((x, y), w, h, facecolor=LIGHT, edgecolor=color, lw=1.5)
    ax.add_patch(e)
    ax.text(x, y, text, ha="center", va="center",
            fontsize=9, color=NAVY, weight="bold")


def link(ax, x1, y1, x2, y2, label=None, dashed=False,
         style="-", color=NAVY):
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle=style, mutation_scale=12,
                        color=color, linewidth=1.2,
                        linestyle=("--" if dashed else "-"))
    ax.add_patch(a)
    if label:
        ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.10, label,
                ha="center", va="center", fontsize=8,
                style="italic", color=NAVY,
                bbox=dict(boxstyle="round,pad=0.18",
                          fc="white", ec="none", alpha=0.95))


# =========================================================
# 1. USE CASE DIAGRAM
# =========================================================
fig, ax = plt.subplots(figsize=(15, 10))
setup(ax, "Diagramme de cas d'utilisation — Gestion des modules",
      (0, 19), (0, 11))

# System boundary
boundary = FancyBboxPatch((4, 0.5), 10, 10,
                          boxstyle="round,pad=0.05,rounding_size=0.1",
                          linewidth=1.5, edgecolor=NAVY, facecolor="#F7FBFF")
ax.add_patch(boundary)
ax.text(9.0, 10.15, "Application Mallette de Surveillance",
        ha="center", va="center", fontsize=11,
        weight="bold", color=NAVY)

# Actors
actor(ax, 1.6, 8.0, "Utilisateur\nAuthentifié", color=NAVY)
actor(ax, 1.6, 3.0, "Administrateur", color=PURPLE)
actor(ax, 17.4, 5.5, "Base de\ndonnées", color=GREEN)

# Main use cases (column 1 of system box)
usecase(ax, 8.5, 8.8, 4.5, 1.0, "S'authentifier")
usecase(ax, 8.5, 7.2, 4.5, 1.0, "Consulter la liste\ndes modules")
usecase(ax, 8.5, 5.6, 4.5, 1.0, "Ajouter un module", color=GREEN)
usecase(ax, 8.5, 4.0, 4.5, 1.0, "Modifier un module")
usecase(ax, 8.5, 2.4, 4.5, 1.0, "Supprimer un module", color=RED)
usecase(ax, 8.5, 0.95, 4.5, 0.9, "Réorganiser (↑ / ↓)")

# Secondary / extension use cases (column 2)
usecase(ax, 13.0, 7.2, 2.4, 0.85, "Scanner réseau\n(ARP)", color=ORANGE)
usecase(ax, 13.0, 5.6, 2.4, 0.85, "Choisir le type\nde capteur", color=ORANGE)
usecase(ax, 13.0, 2.4, 2.4, 0.85, "Confirmer la\nsuppression", color=ORANGE)

# Actor → use case links
link(ax, 2.0, 8.0, 6.3, 8.8)             # User -> Auth
link(ax, 2.0, 8.0, 6.3, 7.2)             # User -> List
link(ax, 2.0, 3.0, 6.3, 5.6)             # Admin -> Add
link(ax, 2.0, 3.0, 6.3, 4.0)             # Admin -> Edit
link(ax, 2.0, 3.0, 6.3, 2.4)             # Admin -> Delete
link(ax, 2.0, 3.0, 6.3, 0.95)            # Admin -> Reorder

# DB actor link (to "Ajouter un module" — persistance)
link(ax, 14.2, 5.6, 16.8, 5.6)

# include relations (label placed between source and target with vertical offset)
def include_link(ax, x1, y, x2, label_y_off=0.55):
    a = FancyArrowPatch((x1, y), (x2, y),
                        arrowstyle="->", mutation_scale=12,
                        color=NAVY, linewidth=1.2, linestyle="--")
    ax.add_patch(a)
    ax.text((x1 + x2) / 2, y + label_y_off, "«include»",
            ha="center", va="center", fontsize=8,
            style="italic", color=NAVY,
            bbox=dict(boxstyle="round,pad=0.18",
                      fc="white", ec="none", alpha=0.95))

include_link(ax, 10.75, 7.2, 11.8)
include_link(ax, 10.75, 5.6, 11.8)
include_link(ax, 10.75, 2.4, 11.8)

# Generalization Admin -> User (admin "is a" user)
link(ax, 1.6, 4.0, 1.6, 7.0, label="généralisation",
     style="-|>", dashed=False, color=PURPLE)

save(fig, "12_usecase_modules.png")


# =========================================================
# Helpers for sequence diagrams
# =========================================================
def lifeline(ax, x, top, bottom, name, color=NAVY, width=3.4):
    """Draw an actor/object header + dashed lifeline."""
    box = FancyBboxPatch((x - width / 2, top - 0.55), width, 0.55,
                         boxstyle="round,pad=0.02,rounding_size=0.05",
                         linewidth=1.3, edgecolor=NAVY, facecolor=color)
    ax.add_patch(box)
    ax.text(x, top - 0.28, name, ha="center", va="center",
            color=WHITE, fontsize=9, weight="bold")
    ax.plot([x, x], [top - 0.55, bottom], linestyle=(0, (4, 3)),
            color=GREY, lw=1)


def activation(ax, x, y_top, y_bottom, color=BLUE):
    r = Rectangle((x - 0.12, y_bottom), 0.24, y_top - y_bottom,
                  facecolor=color, edgecolor=NAVY, lw=0.8, alpha=0.85)
    ax.add_patch(r)


def msg(ax, x1, x2, y, label, dashed=False, color=NAVY):
    a = FancyArrowPatch((x1, y), (x2, y),
                        arrowstyle="->", mutation_scale=12,
                        color=color, linewidth=1.3,
                        linestyle=("--" if dashed else "-"))
    ax.add_patch(a)
    mid = (x1 + x2) / 2
    ax.text(mid, y + 0.10, label, ha="center", va="bottom",
            fontsize=8.5, color=NAVY,
            bbox=dict(boxstyle="round,pad=0.18",
                      fc="white", ec="none", alpha=0.95))


def selfmsg(ax, x, y, label, color=NAVY):
    ax.plot([x, x + 0.7, x + 0.7, x], [y, y, y - 0.25, y - 0.25],
            color=color, lw=1.2)
    a = FancyArrowPatch((x + 0.2, y - 0.25), (x, y - 0.25),
                        arrowstyle="->", mutation_scale=10,
                        color=color, linewidth=1.2)
    ax.add_patch(a)
    ax.text(x + 0.85, y - 0.12, label, ha="left", va="center",
            fontsize=8.5, color=NAVY)


def fragment(ax, x1, x2, y_top, y_bottom, label, kind="alt"):
    r = Rectangle((x1, y_bottom), x2 - x1, y_top - y_bottom,
                  facecolor="none", edgecolor=NAVY, lw=1.2,
                  linestyle="--")
    ax.add_patch(r)
    tag = FancyBboxPatch((x1, y_top - 0.45), 1.2, 0.45,
                         boxstyle="round,pad=0.02,rounding_size=0.04",
                         facecolor=YELLOW, edgecolor=NAVY, lw=1.0)
    ax.add_patch(tag)
    ax.text(x1 + 0.6, y_top - 0.22, kind,
            ha="center", va="center", fontsize=8.5, weight="bold")
    ax.text(x1 + 1.4, y_top - 0.22, label,
            ha="left", va="center", fontsize=8.5,
            style="italic", color=NAVY)


# =========================================================
# 2. SEQUENCE DIAGRAM - ADD MODULE
# =========================================================
fig, ax = plt.subplots(figsize=(17, 11))
setup(ax, "Diagramme de séquence — Ajout d'un module",
      (0, 31), (0, 18))

# Lifelines
xs = {
    "user":   2.5,
    "dash":   7.0,
    "mgr":   11.5,
    "dlg":   16.0,
    "fact":  20.0,
    "wid":   24.0,
    "db":    28.0,
}
top, bot = 17.0, 0.5

lifeline(ax, xs["user"], top, bot, ": Utilisateur",          color=NAVY,   width=3.6)
lifeline(ax, xs["dash"], top, bot, ": DashboardWindow",      color=PURPLE, width=3.8)
lifeline(ax, xs["mgr"],  top, bot, ": ModuleManager",        color=NAVY,   width=3.6)
lifeline(ax, xs["dlg"],  top, bot, ": AddSensorDialog",      color=BLUE,   width=3.6)
lifeline(ax, xs["fact"], top, bot, ": SensorFactory",        color=ORANGE, width=3.6)
lifeline(ax, xs["wid"],  top, bot, ": SmokeSensor /\n  GasSensorWidget", color=NAVY, width=3.8)
lifeline(ax, xs["db"],   top, bot, ": Database (MySQL)",     color=GREEN,  width=3.6)

# Sequence
y = 15.5
msg(ax, xs["user"], xs["dash"], y, "1. clic 'Gérer modules'")
y -= 0.7
msg(ax, xs["dash"], xs["mgr"], y, "2. exec()")
activation(ax, xs["mgr"], y + 0.2, y - 6.0)

y -= 0.7
msg(ax, xs["mgr"], xs["db"], y, "3. loadModules()")
y -= 0.7
msg(ax, xs["db"], xs["mgr"], y, "4. liste des modules", dashed=True)

y -= 0.9
msg(ax, xs["user"], xs["mgr"], y, "5. clic 'Ajouter'")
y -= 0.7
msg(ax, xs["mgr"], xs["dlg"], y, "6. new + exec()")
activation(ax, xs["dlg"], y + 0.2, y - 2.6)

y -= 0.7
msg(ax, xs["user"], xs["dlg"], y, "7. saisir nom + type capteur")
y -= 0.7
msg(ax, xs["user"], xs["dlg"], y, "8. clic 'Valider'")
y -= 0.7
msg(ax, xs["dlg"], xs["mgr"], y, "9. SensorConfig", dashed=True)

# Factory + widget creation
y -= 0.9
msg(ax, xs["mgr"], xs["fact"], y, "10. createSmokeSensor() /\ncreateGasSensor()")
activation(ax, xs["fact"], y + 0.2, y - 0.7)
y -= 0.7
msg(ax, xs["fact"], xs["wid"], y, "11. new Widget(parent)")
y -= 0.7
msg(ax, xs["fact"], xs["mgr"], y, "12. retour widget*", dashed=True)

# Persistence
y -= 0.9
msg(ax, xs["mgr"], xs["db"], y, "13. INSERT INTO modules")
y -= 0.7
msg(ax, xs["db"], xs["mgr"], y, "14. id généré", dashed=True)

# Display in dashboard
y -= 0.9
msg(ax, xs["mgr"], xs["dash"], y, "15. signal moduleAdded(widget*)")
y -= 0.7
msg(ax, xs["dash"], xs["wid"], y, "16. addWidget() au layout")
y -= 0.7
msg(ax, xs["dash"], xs["user"], y, "17. widget visible", dashed=True)

save(fig, "13_sequence_add_module.png")


# =========================================================
# 3. SEQUENCE DIAGRAM - DELETE MODULE
# =========================================================
fig, ax = plt.subplots(figsize=(15, 10))
setup(ax, "Diagramme de séquence — Suppression d'un module",
      (0, 27), (0, 14))

xs2 = {
    "user":  2.5,
    "dash":  7.0,
    "mgr":  12.0,
    "msg":  16.5,
    "wid":  20.5,
    "db":   24.5,
}
top, bot = 13.0, 0.5

lifeline(ax, xs2["user"], top, bot, ": Utilisateur",        color=NAVY,   width=3.6)
lifeline(ax, xs2["dash"], top, bot, ": DashboardWindow",    color=PURPLE, width=3.8)
lifeline(ax, xs2["mgr"],  top, bot, ": ModuleManager",      color=NAVY,   width=3.6)
lifeline(ax, xs2["msg"],  top, bot, ": QMessageBox",        color=ORANGE, width=3.4)
lifeline(ax, xs2["wid"],  top, bot, ": SensorWidget",       color=BLUE,   width=3.4)
lifeline(ax, xs2["db"],   top, bot, ": Database (MySQL)",   color=GREEN,  width=3.6)

y = 11.5
msg(ax, xs2["user"], xs2["mgr"], y, "1. sélectionne un module")
y -= 0.7
msg(ax, xs2["user"], xs2["mgr"], y, "2. clic 'Supprimer'")
activation(ax, xs2["mgr"], y + 0.2, y - 7.0)

y -= 0.9
msg(ax, xs2["mgr"], xs2["msg"], y, "3. question(\"Confirmer la suppression ?\")")
y -= 0.7
msg(ax, xs2["msg"], xs2["user"], y, "4. boîte de dialogue", dashed=True)

y -= 0.7
msg(ax, xs2["user"], xs2["msg"], y, "5. réponse [Yes / No]")
y -= 0.7
msg(ax, xs2["msg"], xs2["mgr"], y, "6. réponse", dashed=True)

# alt fragment around branches
frag_top = y - 0.2
y -= 0.5
fragment(ax, xs2["mgr"] - 0.6, xs2["db"] + 1.0,
         frag_top, y - 4.6,
         "réponse de l'utilisateur", kind="alt")

# YES branch
y -= 0.4
ax.text(xs2["mgr"] - 0.4, y, "[Yes] — confirmé",
        fontsize=8.5, weight="bold", style="italic", color=NAVY)
y -= 0.55
msg(ax, xs2["mgr"], xs2["db"], y, "7. DELETE FROM modules WHERE id = ?")
y -= 0.6
msg(ax, xs2["db"], xs2["mgr"], y, "8. OK", dashed=True)
y -= 0.6
msg(ax, xs2["mgr"], xs2["wid"], y, "9. deleteLater()")
y -= 0.6
msg(ax, xs2["mgr"], xs2["dash"], y, "10. signal moduleRemoved(id)")
y -= 0.6
msg(ax, xs2["dash"], xs2["user"], y,
    "11. liste rafraîchie / widget retiré", dashed=True)

# Branch separator
y -= 0.35
ax.plot([xs2["mgr"] - 0.6, xs2["db"] + 1.0], [y, y],
        color=NAVY, lw=1.0, linestyle="--")
y -= 0.4
ax.text(xs2["mgr"] - 0.4, y, "[No] — annulé",
        fontsize=8.5, weight="bold", style="italic", color=NAVY)
y -= 0.55
msg(ax, xs2["mgr"], xs2["user"], y,
    "7'. aucune action (boîte fermée)", dashed=True)

save(fig, "14_sequence_delete_module.png")

print("\nAll module diagrams generated in:", OUT)
