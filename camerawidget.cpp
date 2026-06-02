#include "camerawidget.h"

#include <QCoreApplication>
#include <QFileInfo>
#include <QHBoxLayout>
#include <QLabel>
#include <QProcess>
#include <QPushButton>
#include <QSizePolicy>
#include <QTimer>
#include <QVBoxLayout>
#include <QWidget>

namespace {

QPushButton *createToolButton(const QString &text, QWidget *parent)
{
    auto *button = new QPushButton(text, parent);
    button->setFixedSize(28, 28);
    button->setCursor(Qt::PointingHandCursor);
    button->setStyleSheet(
        "QPushButton {"
        "  color: #eef3ff;"
        "  background: rgba(117, 140, 188, 0.18);"
        "  border: 1px solid rgba(169, 191, 235, 0.12);"
        "  border-radius: 6px;"
        "  font-size: 15px;"
        "  font-weight: 700;"
        "}"
        "QPushButton:hover { background: rgba(130, 154, 208, 0.28); }"
    );
    return button;
}

QPushButton *createOverlayButton(const QString &text, QWidget *parent)
{
    auto *button = new QPushButton(text, parent);
    button->setFixedSize(34, 24);
    button->setCursor(Qt::PointingHandCursor);
    button->setStyleSheet(
        "QPushButton {"
        "  color: #eef4ff;"
        "  background: rgba(20, 28, 47, 0.75);"
        "  border: 1px solid rgba(189, 205, 239, 0.10);"
        "  border-radius: 5px;"
        "  font-size: 12px;"
        "  font-weight: 700;"
        "}"
        "QPushButton:hover { background: rgba(41, 58, 92, 0.88); }"
    );
    return button;
}

QPixmap loadCameraPixmap()
{
    const QStringList candidates {
        QStringLiteral(":/assets/server_room.jpg"),
        QCoreApplication::applicationDirPath() + QStringLiteral("/assets/server_room.jpg"),
        QCoreApplication::applicationDirPath() + QStringLiteral("/../assets/server_room.jpg"),
        QCoreApplication::applicationDirPath() + QStringLiteral("/../../assets/server_room.jpg"),
        QStringLiteral("assets/server_room.jpg")
    };

    for (const QString &candidate : candidates) {
        if (candidate.startsWith(QLatin1String(":"))) {
            QPixmap pix(candidate);
            if (!pix.isNull()) {
                return pix;
            }
            continue;
        }

        if (QFileInfo::exists(candidate)) {
            QPixmap pix(candidate);
            if (!pix.isNull()) {
                return pix;
            }
        }
    }

    QPixmap fallback(960, 540);
    fallback.fill(QColor(17, 24, 39));
    return fallback;
}

} // namespace

CameraWidget::CameraWidget(QWidget *parent)
    : QFrame(parent)
    , m_imageLabel(nullptr)
    , m_titleLabel(nullptr)
    , m_editButton(nullptr)
    , m_closeButton(nullptr)
    , m_reloadButton(nullptr)
    , m_snapshotButton(nullptr)
    , m_fullscreenButton(nullptr)
    , m_recordButton(nullptr)
    , m_videoWidget(nullptr)
    , m_mpvProcess(nullptr)
    , m_streamUrl(QStringLiteral("rtsp://127.0.0.1:8554/rascam"))
    , m_fallbackPixmap(loadCameraPixmap())
    , m_isRecording(false)
{
    setObjectName(QStringLiteral("panelCamera"));
    setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    setStyleSheet(
        "QFrame#panelCamera {"
        "  background: rgba(31, 49, 92, 0.88);"
        "  border: 1px solid rgba(142, 165, 215, 0.12);"
        "  border-radius: 16px;"
        "}"
        "QLabel { color: #eff4ff; }"
        "QLabel#title { font-size: 20px; font-weight: 700; }"
        "QLabel#subtitle { font-size: 13px; color: #d6e1ff; }"
    );

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(16, 12, 16, 14);
    mainLayout->setSpacing(8);

    auto *headerLayout = new QHBoxLayout;
    headerLayout->setContentsMargins(0, 0, 0, 0);
    headerLayout->setSpacing(8);

    m_titleLabel = new QLabel(QStringLiteral("Caméra Salle Serveur"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));

    m_editButton = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);

    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);
    mainLayout->addLayout(headerLayout);

    m_videoWidget = new QWidget(this);
    m_videoWidget->setMinimumSize(320, 180);
    m_videoWidget->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    m_videoWidget->setStyleSheet(QStringLiteral("background: #0d1529; border-radius: 8px;"));
    m_videoWidget->setAttribute(Qt::WA_NativeWindow);
    m_videoWidget->setAttribute(Qt::WA_DontCreateNativeAncestors);
    mainLayout->addWidget(m_videoWidget, 1);

    m_imageLabel = new QLabel(m_videoWidget);
    m_imageLabel->setAlignment(Qt::AlignCenter);
    m_imageLabel->setPixmap(m_fallbackPixmap.scaled(640, 360, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    m_imageLabel->setStyleSheet(QStringLiteral("background: transparent; color: #d6e1ff;"));
    m_imageLabel->setText(QStringLiteral("Flux caméra en attente"));
    m_imageLabel->setGeometry(m_videoWidget->rect());
    m_imageLabel->show();

    auto *controlsLayout = new QHBoxLayout;
    controlsLayout->setSpacing(6);

    m_reloadButton = createOverlayButton(QStringLiteral("↻"), this);
    m_snapshotButton = createOverlayButton(QStringLiteral("📷"), this);
    m_fullscreenButton = createOverlayButton(QStringLiteral("⛶"), this);
    m_recordButton = createOverlayButton(QStringLiteral("●"), this);
    m_recordButton->setStyleSheet(
        "QPushButton {"
        "  color: #ff4757;"
        "  background: rgba(20, 28, 47, 0.75);"
        "  border: 1px solid rgba(189, 205, 239, 0.10);"
        "  border-radius: 5px;"
        "  font-size: 12px;"
        "  font-weight: 700;"
        "}"
        "QPushButton:hover { background: rgba(41, 58, 92, 0.88); }"
    );

    controlsLayout->addWidget(m_reloadButton);
    controlsLayout->addWidget(m_snapshotButton);
    controlsLayout->addStretch();
    controlsLayout->addWidget(m_recordButton);
    controlsLayout->addWidget(m_fullscreenButton);
    mainLayout->addLayout(controlsLayout);

    m_mpvProcess = new QProcess(this);
    m_mpvProcess->setProcessChannelMode(QProcess::ForwardedChannels);

    connect(m_reloadButton, &QPushButton::clicked, this, &CameraWidget::reloadFrame);
    connect(m_recordButton, &QPushButton::clicked, this, &CameraWidget::toggleRecordingUi);
    connect(m_closeButton, &QPushButton::clicked, this, &CameraWidget::stop);

    connect(m_videoWidget, &QWidget::destroyed, this, &CameraWidget::stopMpv);

    QTimer::singleShot(300, this, &CameraWidget::play);
}

CameraWidget::~CameraWidget()
{
    stopMpv();
}

QPushButton *CameraWidget::editButton() const { return m_editButton; }
QPushButton *CameraWidget::closeButton() const { return m_closeButton; }
QPushButton *CameraWidget::reloadButton() const { return m_reloadButton; }
QPushButton *CameraWidget::snapshotButton() const { return m_snapshotButton; }
QPushButton *CameraWidget::fullscreenButton() const { return m_fullscreenButton; }
QPushButton *CameraWidget::recordButton() const { return m_recordButton; }

QPixmap CameraWidget::currentFrame() const
{
    return m_fallbackPixmap;
}

bool CameraWidget::reloadFrame()
{
    stopMpv();
    QTimer::singleShot(200, this, &CameraWidget::play);
    return true;
}

bool CameraWidget::isRecording() const
{
    return m_isRecording;
}

void CameraWidget::setTitle(const QString &title)
{
    if (m_titleLabel) {
        m_titleLabel->setText(title);
    }
}

void CameraWidget::setResizable(bool enabled)
{
    setSizePolicy(enabled ? QSizePolicy::Expanding : QSizePolicy::Fixed,
                  enabled ? QSizePolicy::Expanding : QSizePolicy::Fixed);
}

void CameraWidget::setStreamUrl(const QString &url)
{
    m_streamUrl = url;
}

void CameraWidget::play()
{
    startMpv();
}

void CameraWidget::stop()
{
    stopMpv();
    if (m_imageLabel) {
        m_imageLabel->setGeometry(m_videoWidget->rect());
        m_imageLabel->show();
    }
}

void CameraWidget::startMpv()
{
    if (!m_mpvProcess || !m_videoWidget || m_streamUrl.isEmpty()) {
        return;
    }

    if (m_mpvProcess->state() != QProcess::NotRunning) {
        return;
    }

    if (m_imageLabel) {
        m_imageLabel->setGeometry(m_videoWidget->rect());
        m_imageLabel->hide();
    }

    const QString windowId = QString::number(static_cast<qulonglong>(m_videoWidget->winId()));

    QStringList args;
    args << QStringLiteral("--no-terminal");
    args << QStringLiteral("--no-osc");
    args << QStringLiteral("--no-border");
    args << QStringLiteral("--force-window=yes");
    args << QStringLiteral("--profile=low-latency");
    args << QStringLiteral("--demuxer-lavf-o=rtsp_transport=tcp");
    args << QStringLiteral("--wid=%1").arg(windowId);
    args << m_streamUrl;

    m_mpvProcess->start(QStringLiteral("mpv"), args);

    if (!m_mpvProcess->waitForStarted(1500)) {
        if (m_imageLabel) {
            m_imageLabel->setText(QStringLiteral("mpv introuvable ou flux inaccessible"));
            m_imageLabel->show();
        }
    }
}

void CameraWidget::stopMpv()
{
    if (!m_mpvProcess || m_mpvProcess->state() == QProcess::NotRunning) {
        return;
    }

    m_mpvProcess->terminate();
    if (!m_mpvProcess->waitForFinished(1000)) {
        m_mpvProcess->kill();
        m_mpvProcess->waitForFinished(1000);
    }
}

void CameraWidget::toggleRecordingUi()
{
    m_isRecording = !m_isRecording;
    m_recordButton->setText(m_isRecording ? QStringLiteral("■") : QStringLiteral("●"));
}
