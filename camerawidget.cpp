#include "camerawidget.h"

#include <QApplication>
#include <QByteArray>
#include <QDebug>
#include <QGuiApplication>
#include <QProcess>
#include <QPushButton>
#include <QResizeEvent>
#include <QShowEvent>
#include <QStandardPaths>
#include <QTimer>
#include <QVBoxLayout>

namespace {

constexpr const char *kForcedLocalRtspUrl = "rtsp://127.0.0.1:8554/rascam";

// mpv --wid needs an X11/XCB window id. This static guard runs before main()
// when the object file is loaded, which gives Qt a chance to select xcb.
struct ForceQtXcbForMpvEmbedding
{
    ForceQtXcbForMpvEmbedding()
    {
        const QByteArray platform = qgetenv("QT_QPA_PLATFORM").toLower();
        if (platform.isEmpty() || platform.contains("wayland")) {
            qputenv("QT_QPA_PLATFORM", QByteArray("xcb"));
        }
    }
};

const ForceQtXcbForMpvEmbedding kForceQtXcbForMpvEmbedding;

QPushButton *makeInvisibleCompatibilityButton(QWidget *parent)
{
    auto *button = new QPushButton(parent);
    button->setObjectName(QStringLiteral("cameraHiddenCompatibilityButton"));
    button->setFocusPolicy(Qt::NoFocus);
    button->setEnabled(true);
    button->setFixedSize(0, 0);
    button->setMinimumSize(0, 0);
    button->setMaximumSize(0, 0);
    button->setStyleSheet(QStringLiteral(
        "QPushButton#cameraHiddenCompatibilityButton {"
        "  border:0; padding:0; margin:0; background:transparent;"
        "}"
    ));
    button->hide();
    return button;
}

} // namespace

CameraWidget::CameraWidget(QWidget *parent)
    : QWidget(parent)
    , m_title(QStringLiteral("Caméra"))
    , m_streamUrl(QString::fromLatin1(kForcedLocalRtspUrl))
    , m_videoSurface(nullptr)
    , m_closeButton(nullptr)
    , m_editButton(nullptr)
    , m_reloadButton(nullptr)
    , m_snapshotButton(nullptr)
    , m_mpvProcess(new QProcess(this))
    , m_playRequested(false)
    , m_stopping(false)
    , m_startAttempts(0)
{
    buildUi();

    m_mpvProcess->setProcessChannelMode(QProcess::MergedChannels);

    connect(m_mpvProcess, &QProcess::readyReadStandardOutput, this, [this]() {
        const QString output = QString::fromLocal8Bit(m_mpvProcess->readAllStandardOutput()).trimmed();
        if (!output.isEmpty()) {
            qDebug().noquote() << "[mpv]" << output;
        }
    });

    connect(m_mpvProcess, &QProcess::errorOccurred, this, [this](QProcess::ProcessError) {
        qWarning().noquote() << "[CameraWidget] mpv error:" << m_mpvProcess->errorString();
    });

    connect(m_mpvProcess, qOverload<int, QProcess::ExitStatus>(&QProcess::finished),
            this, [this](int exitCode, QProcess::ExitStatus exitStatus) {
        if (!m_stopping && (exitStatus == QProcess::CrashExit || exitCode != 0)) {
            qWarning() << "[CameraWidget] mpv stopped unexpectedly. exitCode=" << exitCode
                       << "exitStatus=" << exitStatus;
        }
    });
}

CameraWidget::~CameraWidget()
{
    stop();
}

void CameraWidget::buildUi()
{
    setObjectName(QStringLiteral("cameraWidget"));
    setMinimumSize(120, 90);
    setAttribute(Qt::WA_StyledBackground, true);
    setWindowTitle(m_title);

    setStyleSheet(QStringLiteral(
        "QWidget#cameraWidget {"
        "  background:#05070d;"
        "  border:0;"
        "}"
        "QWidget#cameraSurface {"
        "  background:#05070d;"
        "  border:0;"
        "}"
    ));

    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 0, 0, 0);
    root->setSpacing(0);

    m_videoSurface = new QWidget(this);
    m_videoSurface->setObjectName(QStringLiteral("cameraSurface"));
    m_videoSurface->setAttribute(Qt::WA_NativeWindow, true);
    m_videoSurface->setAttribute(Qt::WA_DontCreateNativeAncestors, false);
    m_videoSurface->setAutoFillBackground(true);
    m_videoSurface->winId();

    root->addWidget(m_videoSurface, 1);

    m_closeButton = makeInvisibleCompatibilityButton(this);
    m_editButton = makeInvisibleCompatibilityButton(this);
    m_reloadButton = makeInvisibleCompatibilityButton(this);
    m_snapshotButton = makeInvisibleCompatibilityButton(this);
}

void CameraWidget::setTitle(const QString &title)
{
    m_title = title.trimmed().isEmpty() ? QStringLiteral("Caméra") : title.trimmed();
    setWindowTitle(m_title);
}

QString CameraWidget::title() const
{
    return m_title;
}

void CameraWidget::setStreamUrl(const QString &url)
{
    Q_UNUSED(url);
    m_streamUrl = QString::fromLatin1(kForcedLocalRtspUrl);
}

QString CameraWidget::streamUrl() const
{
    return m_streamUrl;
}

QString CameraWidget::mpvExecutable() const
{
    if (!m_mpvExecutable.isEmpty()) {
        return m_mpvExecutable;
    }

    const QString resolved = QStandardPaths::findExecutable(QStringLiteral("mpv"));
    return resolved.isEmpty() ? QStringLiteral("mpv") : resolved;
}

bool CameraWidget::ensureMpvAvailable()
{
    m_mpvExecutable = mpvExecutable();

    if (QStandardPaths::findExecutable(m_mpvExecutable).isEmpty()) {
        qWarning() << "[CameraWidget] mpv introuvable. Installe-le avec: sudo apt install mpv";
        return false;
    }

    return true;
}

bool CameraWidget::isEmbeddingReady() const
{
    return m_videoSurface
        && window()
        && window()->isVisible()
        && m_videoSurface->isVisible()
        && m_videoSurface->width() >= 80
        && m_videoSurface->height() >= 60;
}

void CameraWidget::play()
{
    if (m_streamUrl.isEmpty()) {
        qWarning() << "[CameraWidget] URL RTSP vide";
        return;
    }

    if (!ensureMpvAvailable()) {
        return;
    }

    const QString platform = QGuiApplication::platformName().toLower();
    if (platform.contains(QStringLiteral("wayland"))) {
        qWarning() << "[CameraWidget] Qt tourne en Wayland. mpv --wid nécessite xcb."
                   << "Lance avec: QT_QPA_PLATFORM=xcb ./applicationmalette";
        return;
    }

    if (m_mpvProcess->state() != QProcess::NotRunning) {
        stop();
    }

    m_playRequested = true;
    m_startAttempts = 0;
    scheduleStart(250);
}

void CameraWidget::scheduleStart(int delayMs)
{
    QTimer::singleShot(delayMs, this, &CameraWidget::startWhenReady);
}

void CameraWidget::startWhenReady()
{
    if (!m_playRequested) {
        return;
    }

    if (!isEmbeddingReady()) {
        ++m_startAttempts;
        if (m_startAttempts <= 30) {
            scheduleStart(200);
            return;
        }

        qWarning() << "[CameraWidget] Surface vidéo pas prête pour mpv --wid";
        return;
    }

    m_videoSurface->winId();
    QTimer::singleShot(80, this, &CameraWidget::startMpv);
}

void CameraWidget::startMpv()
{
    if (!m_playRequested || m_mpvProcess->state() != QProcess::NotRunning) {
        return;
    }

    const QString windowId = QString::number(static_cast<qulonglong>(m_videoSurface->winId()));

    QStringList args;
    args << QStringLiteral("--no-config");
    args << QStringLiteral("--no-terminal");
    args << QStringLiteral("--no-osc");
    args << QStringLiteral("--no-border");
    args << QStringLiteral("--force-window=immediate");
    args << QStringLiteral("--demuxer-lavf-o=rtsp_transport=tcp");
    args << QStringLiteral("--wid=%1").arg(windowId);
    args << QStringLiteral("--vo=x11");
    args << QStringLiteral("--hwdec=no");
    args << m_streamUrl;

    m_stopping = false;

    qDebug() << "[CameraWidget] platform" << QGuiApplication::platformName();
    qDebug() << "[CameraWidget] start" << m_mpvExecutable << args;

    m_mpvProcess->start(m_mpvExecutable, args);
}

void CameraWidget::stop()
{
    m_playRequested = false;

    if (!m_mpvProcess || m_mpvProcess->state() == QProcess::NotRunning) {
        return;
    }

    m_stopping = true;
    m_mpvProcess->terminate();

    if (!m_mpvProcess->waitForFinished(1200)) {
        m_mpvProcess->kill();
        m_mpvProcess->waitForFinished(1200);
    }

    m_stopping = false;
}

void CameraWidget::reloadFrame()
{
    stop();
    play();
}

QPixmap CameraWidget::currentFrame() const
{
    return m_videoSurface ? m_videoSurface->grab() : QPixmap();
}

QPushButton *CameraWidget::closeButton() const
{
    return m_closeButton;
}

QPushButton *CameraWidget::editButton() const
{
    return m_editButton;
}

QPushButton *CameraWidget::reloadButton() const
{
    return m_reloadButton;
}

QPushButton *CameraWidget::snapshotButton() const
{
    return m_snapshotButton;
}

void CameraWidget::showEvent(QShowEvent *event)
{
    QWidget::showEvent(event);

    if (m_videoSurface) {
        m_videoSurface->winId();
    }

    if (m_mpvProcess->state() == QProcess::NotRunning && !m_playRequested) {
        QTimer::singleShot(500, this, &CameraWidget::play);
    } else if (m_playRequested && m_mpvProcess->state() == QProcess::NotRunning) {
        scheduleStart(250);
    }
}

void CameraWidget::hideEvent(QHideEvent *event)
{
    stop();
    QWidget::hideEvent(event);
}

void CameraWidget::resizeEvent(QResizeEvent *event)
{
    QWidget::resizeEvent(event);

    if (m_playRequested && m_mpvProcess->state() == QProcess::NotRunning) {
        scheduleStart(250);
    }
}
