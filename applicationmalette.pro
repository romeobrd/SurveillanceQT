# =====================================================================
#  Système de Surveillance — application Qt (cible : Linux uniquement)
# =====================================================================

QT      += widgets network sql
CONFIG  += c++17
TEMPLATE = app
TARGET   = SystemeSurveillanceQt

SOURCES += \
    $$PWD/main.cpp \
    $$PWD/addsensordialog.cpp \
    $$PWD/arpscanner.cpp \
    $$PWD/camerawidget.cpp \
    $$PWD/dashboardwindow.cpp \
    $$PWD/databasemanager.cpp \
    $$PWD/databaseviewerwidget.cpp \
    $$PWD/modulemanager.cpp \
    $$PWD/mqttclient.cpp \
    $$PWD/networkscannerdialog.cpp \
    $$PWD/sensorfactory.cpp \
    $$PWD/smokesensorwidget.cpp \
    $$PWD/temperaturewidget.cpp \
    $$PWD/widgeteditor.cpp

HEADERS += \
    $$PWD/addsensordialog.h \
    $$PWD/arpscanner.h \
    $$PWD/camerawidget.h \
    $$PWD/dashboardwindow.h \
    $$PWD/databasemanager.h \
    $$PWD/databaseviewerwidget.h \
    $$PWD/modulemanager.h \
    $$PWD/mqttclient.h \
    $$PWD/networkscannerdialog.h \
    $$PWD/sensorfactory.h \
    $$PWD/smokesensorwidget.h \
    $$PWD/temperaturewidget.h \
    $$PWD/widgeteditor.h

INCLUDEPATH += $$PWD
