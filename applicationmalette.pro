QT += widgets network

CONFIG += c++17
TEMPLATE = app
TARGET = SystemeSurveillanceQt

SOURCES += \
    $$PWD/main.cpp \
    $$PWD/arpscanner.cpp \
    $$PWD/dashboardwindow.cpp \
    $$PWD/loginwidget.cpp \
    $$PWD/modulemanager.cpp \
    $$PWD/networkscannerdialog.cpp \
    $$PWD/raspberrymanager.cpp \
    $$PWD/smokesensorwidget.cpp \
    $$PWD/camerawidget.cpp \
    $$PWD/temperaturewidget.cpp \
    $$PWD/widgeteditor.cpp

HEADERS += \
    $$PWD/arpscanner.h \
    $$PWD/dashboardwindow.h \
    $$PWD/loginwidget.h \
    $$PWD/modulemanager.h \
    $$PWD/networkscannerdialog.h \
    $$PWD/raspberrymanager.h \
    $$PWD/smokesensorwidget.h \
    $$PWD/camerawidget.h \
    $$PWD/temperaturewidget.h \
    $$PWD/widgeteditor.h

INCLUDEPATH += $$PWD

DISTFILES += \
    $$PWD/assets/server_room.jpg
