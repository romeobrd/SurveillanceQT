#include "dashboardwindow.h"

#include <QApplication>
#include <QSslConfiguration>

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationDisplayName(QStringLiteral("Système de Surveillance"));

    // Disable SSL certificate verification globally (self-signed broker CA)
    QSslConfiguration sslConfig = QSslConfiguration::defaultConfiguration();
    sslConfig.setPeerVerifyMode(QSslSocket::VerifyNone);
    QSslConfiguration::setDefaultConfiguration(sslConfig);

    DashboardWindow window;
    window.show();

    return app.exec();
}
