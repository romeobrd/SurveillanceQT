QT += widgets network sql

# MySQL support
QT += sql

CONFIG += c++17
TEMPLATE = app
TARGET = SystemeSurveillanceQt

SOURCES += \
    $$PWD/main.cpp \
    $$PWD/addsensordialog.cpp \
    $$PWD/arpscanner.cpp \
    $$PWD/authenticationdialog.cpp \
    $$PWD/camerawidget.cpp \
    $$PWD/dashboardwindow.cpp \
    $$PWD/databasemanager.cpp \
    $$PWD/loginwidget.cpp \
    $$PWD/modulemanager.cpp \
    $$PWD/networkscannerdialog.cpp \
    $$PWD/raspberrymanager.cpp \
    $$PWD/sensorfactory.cpp \
    $$PWD/smokesensorwidget.cpp \
    $$PWD/temperaturewidget.cpp \
    $$PWD/widgeteditor.cpp

HEADERS += \
    $$PWD/addsensordialog.h \
    $$PWD/arpscanner.h \
    $$PWD/authenticationdialog.h \
    $$PWD/camerawidget.h \
    $$PWD/dashboardwindow.h \
    $$PWD/databasemanager.h \
    $$PWD/loginwidget.h \
    $$PWD/modulemanager.h \
    $$PWD/networkscannerdialog.h \
    $$PWD/raspberrymanager.h \
    $$PWD/sensorfactory.h \
    $$PWD/smokesensorwidget.h \
    $$PWD/temperaturewidget.h \
    $$PWD/widgeteditor.h

INCLUDEPATH += $$PWD

DISTFILES += \
    $$PWD/assets/server_room.jpg
