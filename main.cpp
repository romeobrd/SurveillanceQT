#include "dashboardwindow.h"

#include <QApplication>

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationDisplayName(QStringLiteral("Système de Surveillance"));

    DashboardWindow window;
    window.show();

    return app.exec();
}
