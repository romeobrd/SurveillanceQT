# =====================================================================
#  Système de Surveillance — application Qt (cible : Linux uniquement)
# =====================================================================

QT      += widgets network sql
CONFIG  += c++17
TEMPLATE = app
TARGET   = SystemeSurveillanceQt

# Contournement d'un bug de GCC 13 : ses passes d'optimisation -O2 plantent
# (internal compiler error dans la passe "tree-pre"). Le flag -fno-tree-pre
# seul ne suffit pas, car -O2 (placé après sur la ligne de commande) réactive
# la passe. On rétrograde donc l'optimisation de la cible Release en -O1, qui
# n'active pas cette passe.
QMAKE_CXXFLAGS_RELEASE -= -O2
QMAKE_CXXFLAGS_RELEASE += -O1

SOURCES += \
    $$PWD/main.cpp \
    $$PWD/arpscanner.cpp \
    $$PWD/camerawidget.cpp \
    $$PWD/dashboardwindow.cpp \
    $$PWD/databasemanager.cpp \
    $$PWD/databaseviewerwidget.cpp \
    $$PWD/modulemanager.cpp \
    $$PWD/mqttclient.cpp \
    $$PWD/networkscannerdialog.cpp \
    $$PWD/smokesensorwidget.cpp \
    $$PWD/temperaturewidget.cpp \
    $$PWD/widgeteditor.cpp

HEADERS += \
    $$PWD/arpscanner.h \
    $$PWD/camerawidget.h \
    $$PWD/dashboardwindow.h \
    $$PWD/databasemanager.h \
    $$PWD/databaseviewerwidget.h \
    $$PWD/modulemanager.h \
    $$PWD/mqttclient.h \
    $$PWD/networkscannerdialog.h \
    $$PWD/smokesensorwidget.h \
    $$PWD/temperaturewidget.h \
    $$PWD/widgeteditor.h

INCLUDEPATH += $$PWD
