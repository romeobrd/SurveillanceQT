QT += widgets network

CONFIG += c++17
TEMPLATE = app
TARGET = SystemeSurveillanceQt

SOURCES += \
    $$PWD/main.cpp \
    $$PWD/arpscanner.cpp \
    $$PWD/dashboardwindow.cpp \
    $$PWD/loginwidget.cpp \
    $$PWD/networkscannerdialog.cpp \
    $$PWD/smokesensorwidget.cpp \
    $$PWD/camerawidget.cpp \
    $$PWD/temperaturewidget.cpp

HEADERS += \
    $$PWD/arpscanner.h \
    $$PWD/dashboardwindow.h \
    $$PWD/loginwidget.h \
    $$PWD/networkscannerdialog.h \
    $$PWD/smokesensorwidget.h \
    $$PWD/camerawidget.h \
    $$PWD/temperaturewidget.h

INCLUDEPATH += $$PWD

DISTFILES += \
    $$PWD/assets/server_room.jpg
