#include "dashboardwindow.h"

#include <QApplication>
#include <QSslConfiguration>

// =====================================================================
//  POINT D'ENTRÉE DE L'APPLICATION
// =====================================================================
int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationDisplayName(QStringLiteral("Système de Surveillance"));

    // Le broker MQTT utilise une autorité de certification auto-signée :
    // on désactive globalement la vérification des certificats serveurs
    // (le chiffrement TLS et le certificat client mTLS restent actifs).
    QSslConfiguration sslConfig = QSslConfiguration::defaultConfiguration();
    sslConfig.setPeerVerifyMode(QSslSocket::VerifyNone);
    QSslConfiguration::setDefaultConfiguration(sslConfig);

    DashboardWindow window;
    window.show();

    return app.exec();
}
