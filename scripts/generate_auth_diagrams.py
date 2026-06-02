# -*- coding: utf-8 -*-
"""
Generate UML diagrams for the Qt Authentication System (RBAC):

  - Use case diagram          -> 18_usecase_authentication.png
  - Sequence: login flow      -> 19_sequence_login.png
  - Sequence: permission check-> 20_sequence_permission_check.png

Roles modelled: Admin, Operator, Viewer.
Source of truth: databasemanager.cpp (authenticateUser, hasPermission).
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
LILAC  = "#E4D4F0"


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
# Use-case helpers
# =========================================================
def actor(ax, x, y, name, color=NAVY):
    head = Circle((x, y + 0.45), 0.18, fill=False, lw=1.6, color=color)
    ax.add_patch(head)
    ax.plot([x, x], [y + 0.27, y - 0.30], color=color, lw=1.6)
    ax.plot([x - 0.30, x + 0.30], [y + 0.05, y + 0.05], color=color, lw=1.6)
    ax.plot([x, x - 0.25], [y - 0.30, y - 0.70], color=color, lw=1.6)
    ax.plot([x, x + 0.25], [y - 0.30, y - 0.70], color=color, lw=1.6)
    ax.text(x, y - 0.95, name, ha="center", va="top",
            fontsize=10, weight="bold", color=color)


def usecase(ax, x, y, w, h, text, color=BLUE):
    e = Ellipse((x, y), w, h, facecolor=LIGHT, edgecolor=color, lw=1.5)
    ax.add_patch(e)
    ax.text(x, y, text, ha="center", va="center",
            fontsize=8.8, color=NAVY, weight="bold")


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
# 1. USE CASE DIAGRAM - AUTH & RBAC
# =========================================================
fig, ax = plt.subplots(figsize=(17, 11))
setup(ax, "Diagramme de cas d'utilisation — Authentification & contrôle d'accès",
      (0, 22), (0, 12))

# System boundary
boundary = FancyBboxPatch((4.5, 0.5), 13.0, 11.0,
                          boxstyle="round,pad=0.05,rounding_size=0.1",
                          linewidth=1.5, edgecolor=NAVY, facecolor="#F7FBFF")
ax.add_patch(boundary)
ax.text(11.0, 11.15, "Application Mallette de Surveillance",
        ha="center", va="center", fontsize=11,
        weight="bold", color=NAVY)

# Actors (left = humans, right = system)
actor(ax, 1.8, 9.5, "Visiteur",     color=NAVY)
actor(ax, 1.8, 5.7, "Opérateur",    color=BLUE)
actor(ax, 1.8, 1.9, "Administrateur", color=PURPLE)
actor(ax, 20.3, 5.7, "Base de\ndonnées (users)", color=GREEN)

# Generalisation: Admin -> Operator -> Viewer
link(ax, 1.8, 2.9, 1.8, 4.7, label="hérite", style="-|>", color=PURPLE)
link(ax, 1.8, 6.7, 1.8, 8.5, label="hérite", style="-|>", color=BLUE)

# Use cases - left column (always available)
usecase(ax, 8.0, 10.2, 4.6, 1.0, "S'authentifier",                color=NAVY)
usecase(ax, 8.0, 8.6,  4.6, 1.0, "Consulter capteurs\n(view_sensors)", color=GREEN)

# Use cases - operator-level
usecase(ax, 8.0, 6.9,  4.6, 1.0, "Ajouter / supprimer\nun module",   color=BLUE)
usecase(ax, 8.0, 5.3,  4.6, 1.0, "Modifier les seuils",              color=BLUE)
usecase(ax, 8.0, 3.7,  4.6, 1.0, "Scanner le réseau",                color=BLUE)

# Use cases - admin-only (red)
usecase(ax, 8.0, 2.0,  4.6, 1.0, "Gérer les utilisateurs\n(manage_users)", color=RED)
usecase(ax, 8.0, 0.9,  4.6, 0.9, "Configurer le système\n(configure_system)", color=RED)

# Extension use case: hashage / vérif
usecase(ax, 14.5, 10.2, 3.4, 0.9, "Hacher (SHA-256)\net comparer",   color=ORANGE)
usecase(ax, 14.5, 8.6,  3.4, 0.9, "Charger rôle\nde l'utilisateur", color=ORANGE)
usecase(ax, 14.5, 5.3,  3.4, 0.9, "Vérifier permission\nhasPermission()", color=ORANGE)
usecase(ax, 14.5, 2.0,  3.4, 0.9, "Griser / verrouiller\nles boutons UI",  color=ORANGE)

# Actor links
# Viewer -> auth + view
link(ax, 2.2, 9.5, 5.7, 10.2)
link(ax, 2.2, 9.5, 5.7, 8.6)

# Operator -> add modules / thresholds / scanner (and inherits viewer's)
link(ax, 2.2, 5.7, 5.7, 6.9)
link(ax, 2.2, 5.7, 5.7, 5.3)
link(ax, 2.2, 5.7, 5.7, 3.7)

# Admin -> manage users / config (and inherits operator's)
link(ax, 2.2, 1.9, 5.7, 2.0)
link(ax, 2.2, 1.9, 5.7, 0.9)

# DB participation
link(ax, 19.9, 5.7, 16.2, 8.6)   # load role
link(ax, 19.9, 5.7, 16.2, 10.2)  # check credentials

# include relations (dashed)
def include_link(ax, x1, y1, x2, y2, label="«include»"):
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle="->", mutation_scale=12,
                        color=NAVY, linewidth=1.1, linestyle="--")
    ax.add_patch(a)
    ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 0.30, label,
            ha="center", va="center", fontsize=7.8,
            style="italic", color=NAVY,
            bbox=dict(boxstyle="round,pad=0.15",
                      fc="white", ec="none", alpha=0.95))

include_link(ax, 10.30, 10.2, 12.80, 10.2)   # auth -> hash
include_link(ax, 10.30, 8.6,  12.80, 8.6)    # view -> load role
include_link(ax, 10.30, 6.9,  12.80, 5.3)    # add module -> hasPermission
include_link(ax, 10.30, 3.7,  12.80, 5.3)    # scanner -> hasPermission
include_link(ax, 10.30, 2.0,  12.80, 2.0)    # manage users -> grey UI

save(fig, "18_usecase_authentication.png")


# =========================================================
# Sequence helpers
# =========================================================
def lifeline(ax, x, top, bottom, name, color=NAVY, width=3.4):
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
# 2. SEQUENCE DIAGRAM - LOGIN FLOW
# =========================================================
fig, ax = plt.subplots(figsize=(17, 12))
setup(ax, "Diagramme de séquence — Authentification (login) avec rôles",
      (0, 31), (0, 19))

xs = {
    "user":  2.5,
    "ovr":   7.0,
    "main":  12.0,
    "dbm":   17.0,
    "db":    22.0,
    "dash":  27.5,
}
top, bot = 18.0, 0.5

lifeline(ax, xs["user"], top, bot, ": Utilisateur",          color=NAVY,   width=3.6)
lifeline(ax, xs["ovr"],  top, bot, ": LoginWidget\n(overlay)", color=PURPLE, width=4.0)
lifeline(ax, xs["main"], top, bot, ": MainWindow",           color=BLUE,   width=3.6)
lifeline(ax, xs["dbm"],  top, bot, ": DatabaseManager",      color=ORANGE, width=3.6)
lifeline(ax, xs["db"],   top, bot, ": users (SQLite/MySQL)", color=GREEN,  width=3.8)
lifeline(ax, xs["dash"], top, bot, ": DashboardWindow",      color=NAVY,   width=3.6)

y = 16.5
msg(ax, xs["user"], xs["ovr"], y, "1. saisir username + password")
y -= 0.7
msg(ax, xs["user"], xs["ovr"], y, "2. clic 'Se connecter'")
activation(ax, xs["ovr"], y + 0.2, y - 9.5)

y -= 0.9
msg(ax, xs["ovr"], xs["main"], y, "3. signal loginRequested(u, p)")
y -= 0.7
msg(ax, xs["main"], xs["dbm"], y, "4. authenticateUser(u, p)")
activation(ax, xs["dbm"], y + 0.2, y - 5.3)

y -= 0.7
msg(ax, xs["dbm"], xs["db"], y,
    "5. SELECT * FROM users\nWHERE username=:u AND is_active=1")
y -= 0.9
msg(ax, xs["db"], xs["dbm"], y, "6. row { id, hash, role }", dashed=True)

y -= 0.8
msg(ax, xs["dbm"], xs["dbm"], y - 0.1, "")  # placeholder for self-call
ax.text(xs["dbm"] + 0.20, y - 0.10,
        "7. hashPassword(p) == row.hash ?",
        fontsize=8.4, color=NAVY, va="center", style="italic")

# alt: success / failure
y -= 0.6
frag_top = y
y_alt_bottom = y - 5.5
fragment(ax, xs["dbm"] - 0.6, xs["dash"] + 1.0,
         frag_top, y_alt_bottom,
         "résultat de la vérification", kind="alt")

# [credentials valid]
y -= 0.4
ax.text(xs["dbm"] - 0.4, y, "[hash valide]",
        fontsize=8.5, weight="bold", style="italic", color=NAVY)
y -= 0.55
msg(ax, xs["dbm"], xs["dbm"], y,
    "8. m_currentUser = User(role)")
y -= 0.7
msg(ax, xs["dbm"], xs["main"], y,
    "9. true", dashed=True, color=GREEN)
y -= 0.7
msg(ax, xs["main"], xs["dash"], y,
    "10. afficher dashboard + applyRolePolicy(user.role)")
y -= 0.7
msg(ax, xs["main"], xs["ovr"], y,
    "11. close()  (overlay retiré)", color=GREEN)

# branch separator
y -= 0.45
ax.plot([xs["dbm"] - 0.6, xs["dash"] + 1.0], [y, y],
        color=NAVY, lw=1.0, linestyle="--")

# [credentials invalid]
y -= 0.45
ax.text(xs["dbm"] - 0.4, y, "[hash invalide / utilisateur inactif]",
        fontsize=8.5, weight="bold", style="italic", color=NAVY)
y -= 0.55
msg(ax, xs["dbm"], xs["main"], y,
    "8'. false", dashed=True, color=RED)
y -= 0.7
msg(ax, xs["main"], xs["ovr"], y,
    "9'. showError(\"Identifiants invalides\")",
    color=RED)
y -= 0.7
msg(ax, xs["ovr"], xs["user"], y,
    "10'. message d'erreur affiché", dashed=True, color=RED)

save(fig, "19_sequence_login.png")


# =========================================================
# 3. SEQUENCE DIAGRAM - PERMISSION CHECK (RBAC)
# =========================================================
fig, ax = plt.subplots(figsize=(17, 11))
setup(ax, "Diagramme de séquence — Vérification de permission (RBAC)",
      (0, 28), (0, 17))

xs2 = {
    "user":  2.5,
    "dash":  7.0,
    "btn":   11.5,
    "dbm":   16.0,
    "usr":   20.5,
    "ui":    25.0,
}
top, bot = 16.0, 0.5

lifeline(ax, xs2["user"], top, bot, ": Utilisateur",       color=NAVY,   width=3.6)
lifeline(ax, xs2["dash"], top, bot, ": DashboardWindow",   color=PURPLE, width=3.8)
lifeline(ax, xs2["btn"],  top, bot, ": Action / Bouton",   color=BLUE,   width=3.6)
lifeline(ax, xs2["dbm"],  top, bot, ": DatabaseManager",   color=ORANGE, width=3.6)
lifeline(ax, xs2["usr"],  top, bot, ": User\n(struct)",    color=GREEN,  width=3.6)
lifeline(ax, xs2["ui"],   top, bot, ": OverlayLock /\n  QGraphicsEffect", color=NAVY, width=4.0)

y = 14.5
msg(ax, xs2["dash"], xs2["dbm"], y, "1. getCurrentUser()")
y -= 0.7
msg(ax, xs2["dbm"], xs2["dash"], y, "2. User user", dashed=True)

# applyRolePolicy
y -= 0.9
msg(ax, xs2["dash"], xs2["usr"], y, "3. user.hasPermission(\"manage_users\")")
activation(ax, xs2["usr"], y + 0.2, y - 6.0)

# alt: role-based decision
y -= 0.7
frag_top = y
fragment(ax, xs2["usr"] - 0.6, xs2["ui"] + 1.2,
         frag_top, y - 5.4,
         "rôle de l'utilisateur", kind="alt")

# Admin
y -= 0.4
ax.text(xs2["usr"] - 0.4, y, "[role == Admin]",
        fontsize=8.5, weight="bold", style="italic", color=PURPLE)
y -= 0.55
msg(ax, xs2["usr"], xs2["dash"], y, "4. true", dashed=True, color=GREEN)
y -= 0.7
msg(ax, xs2["dash"], xs2["btn"], y, "5. setEnabled(true)", color=GREEN)
y -= 0.6
msg(ax, xs2["dash"], xs2["ui"], y,  "6. removeOverlay()", color=GREEN)

# Operator
y -= 0.4
ax.plot([xs2["usr"] - 0.6, xs2["ui"] + 1.2], [y + 0.2, y + 0.2],
        color=NAVY, lw=1.0, linestyle="--")
ax.text(xs2["usr"] - 0.4, y, "[role == Operator]",
        fontsize=8.5, weight="bold", style="italic", color=BLUE)
y -= 0.55
msg(ax, xs2["usr"], xs2["dash"], y,
    "4'. (perm != manage_users && perm != configure_system)",
    dashed=True, color=BLUE)
y -= 0.7
msg(ax, xs2["dash"], xs2["btn"], y,
    "5'. setEnabled selon résultat", color=BLUE)

# Viewer
y -= 0.4
ax.plot([xs2["usr"] - 0.6, xs2["ui"] + 1.2], [y + 0.2, y + 0.2],
        color=NAVY, lw=1.0, linestyle="--")
ax.text(xs2["usr"] - 0.4, y, "[role == Viewer]",
        fontsize=8.5, weight="bold", style="italic", color=RED)
y -= 0.55
msg(ax, xs2["usr"], xs2["dash"], y,
    "4''. perm == \"view_sensors\" ?", dashed=True, color=RED)
y -= 0.7
msg(ax, xs2["dash"], xs2["btn"], y,
    "5''. setEnabled(false)", color=RED)
y -= 0.6
msg(ax, xs2["dash"], xs2["ui"], y,
    "6''. installOverlayLock()  (UI grisée)", color=RED)

# user clicks anyway
y -= 0.9
msg(ax, xs2["user"], xs2["btn"], y,
    "7. clic sur un bouton verrouillé")
y -= 0.7
msg(ax, xs2["btn"], xs2["user"], y,
    "8. ignoré (overlay capture l'événement)", dashed=True, color=GREY)

save(fig, "20_sequence_permission_check.png")

print("\nAll authentication diagrams generated in:", OUT)
