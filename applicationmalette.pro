# =====================================================================
#  Système de Surveillance — application Qt (cible : Linux uniquement)
# =====================================================================

QT      += widgets network sql
CONFIG  += c++17
TEMPLATE = app
TARGET   = SystemeSurveillanceQt

# Contournement d'un bug de GCC 13 : la passe d'optimisation "tree-pre"
# (active à partir de -O2) plante (internal compiler error). On désactive
# uniquement cette passe ; le reste des optimisations -O2 reste actif.
QMAKE_CXXFLAGS += -fno-tree-pre

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
