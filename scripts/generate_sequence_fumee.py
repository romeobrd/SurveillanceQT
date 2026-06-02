# -*- coding: utf-8 -*-
"""
Generate a sequence diagram (PNG) for the fumee.py script.
Shows interactions between Flying-Fish, PIM480/SGP30, Raspberry Pi, and Console.
"""

import os
import matplotlib.pyplot as plt
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
PURPLE = "#7030A0"

def box(ax, x, y, w, h, label, color=BLUE, txt_color=WHITE, fs=9, rounded=True):
    style = "round,pad=0.02,rounding_size=0.15" if rounded else "square,pad=0.02"
    p = FancyBboxPatch((x, y), w, h, boxstyle=style,
                       linewidth=1.4, edgecolor=NAVY, facecolor=color)
    ax.add_patch(p)
    ax.text(x + w/2, y + h/2, label, ha="center", va="center",
            color=txt_color, fontsize=fs, weight="bold", wrap=True)

def msg(ax, x1, x2, y, label, color=NAVY, dashed=False):
    a = FancyArrowPatch((x1, y), (x2, y), arrowstyle="-|>",
                        mutation_scale=12, color=color,
                        linestyle=("--" if dashed else "-"),
                        linewidth=1.4)
    ax.add_patch(a)
    mid_x = (x1 + x2) / 2
    ax.text(mid_x, y + 0.3, label, ha="center", va="bottom",
            fontsize=8, color=NAVY,
            bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.9))

def self_msg(ax, x, y, label, color=NAVY):
    """Self-call arrow (small loop to right)"""
    offset = 1.2
    ax.annotate("", xy=(x, y - 0.3), xytext=(x, y),
                arrowprops=dict(arrowstyle="-|>", color=color,
                                connectionstyle="arc3,rad=-0.5",
                                lw=1.3))
    ax.text(x + 1.5, y - 0.15, label, ha="left", va="center",
            fontsize=8, color=NAVY,
            bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.9))

# ===== FIGURE SETUP =====
fig, ax = plt.subplots(figsize=(14, 11))
ax.set_xlim(0, 28)
ax.set_ylim(0, 24)
ax.set_aspect("equal")
ax.axis("off")
ax.set_title("Diagramme de sequence — fumee.py\n(PIM480 / SGP30 + Flying-Fish)",
             fontsize=13, weight="bold", color=NAVY, pad=12)

# ===== ACTORS (lifelines) =====
actors = [
    (3,   "Script\nfumee.py", GREEN),
    (8,   "Bus I2C\n(SCL/SDA)", GREY),
    (13,  "PIM480\nSGP30", ORANGE),
    (18,  "GPIO17", PURPLE),
    (23,  "Flying-Fish\n(DO)", RED),
]

top_y = 22
bottom_y = 2

for x, name, color in actors:
    box(ax, x - 1.6, top_y, 3.2, 1.3, name, color=color, fs=8.5)
    ax.plot([x, x], [bottom_y, top_y], linestyle="--", color=GREY, linewidth=0.8)

# ===== CONSOLE on far right =====
console_x = 27
box(ax, console_x - 1.4, top_y, 2.8, 1.3, "Console\n(stdout)", NAVY, fs=8.5)
ax.plot([console_x, console_x], [bottom_y, top_y], linestyle="--", color=GREY, linewidth=0.8)

# ===== INITIALIZATION PHASE =====
y = 21
# Frame
init_rect = Rectangle((1, 14.5), 26.5, 7, linewidth=1.2,
                       edgecolor=NAVY, facecolor="none", linestyle="-")
ax.add_patch(init_rect)
ax.text(1.3, 21.2, "init", fontsize=8, weight="bold", color=NAVY,
        bbox=dict(boxstyle="round,pad=0.15", fc=LIGHT, ec=NAVY))

msg(ax, 3, 8, 20.5, "1. busio.I2C(SCL, SDA)")
msg(ax, 8, 13, 19.8, "2. Adafruit_SGP30(i2c)")
msg(ax, 13, 8, 19.1, "3. instance SGP30", dashed=True)
msg(ax, 3, 13, 18.4, "4. sgp30.iaq_init()")
msg(ax, 3, console_x, 17.6, "5. print(\"Initialisation PIM480...\")")
msg(ax, 3, 18, 16.8, "6. DigitalInOut(D17) direction=INPUT")
msg(ax, 18, 23, 16.1, "7. configure pin entree")
msg(ax, 3, console_x, 15.3, "8. print(\"Lecture des capteurs...\")")

# ===== LOOP PHASE =====
loop_rect = Rectangle((1, 2.5), 26.5, 12, linewidth=1.5,
                       edgecolor=GREEN, facecolor="none", linestyle="-")
ax.add_patch(loop_rect)
ax.text(1.3, 14.2, "loop [while True, every 1s]", fontsize=8, weight="bold", color=GREEN,
        bbox=dict(boxstyle="round,pad=0.15", fc="#E2EFDA", ec=GREEN))

msg(ax, 3, 13, 13.2, "9. sgp30.eCO2")
msg(ax, 13, 3, 12.5, "10. eco2_ppm (ex: 850)", dashed=True)
msg(ax, 3, 13, 11.8, "11. sgp30.TVOC")
msg(ax, 13, 3, 11.1, "12. tvoc_ppb (ex: 35)", dashed=True)
msg(ax, 3, 18, 10.2, "13. fumee.value")
msg(ax, 18, 23, 9.5, "14. lecture DO")
msg(ax, 23, 18, 8.8, "15. True/False", dashed=True)
msg(ax, 18, 3, 8.1, "16. etat (True/False)", dashed=True)

# Alt fragment
alt_rect = Rectangle((2, 5.8), 25, 2, linewidth=1, linestyle="--",
                      edgecolor=ORANGE, facecolor="none")
ax.add_patch(alt_rect)
ax.text(2.3, 7.5, "alt", fontsize=7.5, weight="bold", color=ORANGE,
        bbox=dict(boxstyle="round,pad=0.12", fc="#FFF2CC", ec=ORANGE))
ax.text(5.5, 7.5, "[value == False]", fontsize=7.5, color=ORANGE)
ax.text(5.5, 6.3, "[value == True]", fontsize=7.5, color=ORANGE)
ax.plot([2, 27], [6.8, 6.8], linestyle="--", color=ORANGE, linewidth=0.8)
ax.text(14, 7.2, "etat = \"FUMEE / GAZ DETECTE\"", fontsize=8, color=RED)
ax.text(14, 6, "etat = \"Pas de fumee detectee\"", fontsize=8, color=GREEN)

msg(ax, 3, console_x, 5, "17. print(eco2, tvoc, etat)")

# sleep
ax.text(3, 3.8, "18. time.sleep(1)", fontsize=8, color=NAVY,
        bbox=dict(boxstyle="round,pad=0.2", fc=LIGHT, ec=NAVY))
# arrow back to self
ax.annotate("", xy=(3.3, 3.2), xytext=(3.3, 3.6),
            arrowprops=dict(arrowstyle="-|>", color=NAVY,
                            connectionstyle="arc3,rad=-0.4", lw=1.2))

# ===== SAVE =====
path = os.path.join(OUT, "09_sequence_fumee_py.png")
fig.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
plt.close(fig)
print("OK ->", path)
