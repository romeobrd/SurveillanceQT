#include "dashboardwindow.h"

#include <QApplication>
#include <QSurfaceFormat>

#ifdef Q_OS_LINUX
#include <QDBusConnection>
#endif

int main(int argc, char *argv[])
{
    // ── Platform-specific rendering setup ──────────────────────────────────
#ifdef Q_OS_LINUX
    // Force hardware-accelerated rendering on Linux
    // Without this, Qt may fall back to software rendering which is very slow
    qputenv("QT_XCB_FORCE_SOFTWARE_OPENGL", "0");

    // Use the 'egl' platform if available (Wayland/X11 hybrid)
    // Falls back to xcb automatically if egl is not available
    if (qEnvironmentVariableIsEmpty("QT_QPA_PLATFORM")) {
        qputenv("QT_QPA_PLATFORM", "xcb");
    }

    // Enable GPU-sync to reduce tearing and improve responsiveness
    qputenv("QT_XCB_FORCE_SOFTWARE_VULKAN", "0");
#endif

    // Request OpenGL support for QPainter hardware acceleration
    QSurfaceFormat format;
    format.setDepthBufferSize(24);
    format.setSamples(4);  // 4x MSAA for smoother antialiasing
    format.setSwapInterval(1);  // VSync = 1 for smooth rendering
    QSurfaceFormat::setDefaultFormat(format);

    QApplication app(argc, argv);
    app.setApplicationDisplayName(QStringLiteral("Système de Surveillance"));

    DashboardWindow window;
    window.show();

    return app.exec();
}
