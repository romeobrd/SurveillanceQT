QT += widgets

CONFIG += c++17
TEMPLATE = app
TARGET = SystemeSurveillanceQt

SOURCES += \
    $$PWD/main.cpp \
    $$PWD/dashboardwindow.cpp \
    $$PWD/loginwidget.cpp \
    $$PWD/smokesensorwidget.cpp \
    $$PWD/camerawidget.cpp \
    $$PWD/temperaturewidget.cpp

HEADERS += \
    $$PWD/dashboardwindow.h \
    $$PWD/loginwidget.h \
    $$PWD/smokesensorwidget.h \
    $$PWD/camerawidget.h \
    $$PWD/temperaturewidget.h

INCLUDEPATH += $$PWD

DISTFILES += \
    $$PWD/assets/server_room.jpg
