#include "camerawidget.h"

#include <QCoreApplication>
#include <QFileInfo>
#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QMediaPlayer>
#include <QPixmap>
#include <QPushButton>
#include <QStackedLayout>
#include <QStackedWidget>
#include <QVBoxLayout>
#include <QVideoWidget>

namespace {

QPushButton *createToolButton(const QString &text, QWidget *parent)
{
    auto *button = new QPushButton(text, parent);
    button->setFixedSize(28, 28);
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
        if (candidate.startsWith(QLatin1String(":/"))) {
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
    , m_editButton(nullptr)
    , m_closeButton(nullptr)
    , m_reloadButton(nullptr)
    , m_snapshotButton(nullptr)
    , m_fullscreenButton(nullptr)
    , m_recordButton(nullptr)
    , m_isRecording(false)
    , m_mediaPlayer(nullptr)
    , m_videoWidget(nullptr)
    , m_streamUrl(QStringLiteral("rtsp://200.26.16.20:8554/cam"))
{
    setObjectName(QStringLiteral("panelCamera"));
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

    // Header
    auto *headerLayout = new QHBoxLayout;
    headerLayout->setContentsMargins(0, 0, 0, 0);
    headerLayout->setSpacing(8);

    m_titleLabel = new QLabel(QStringLiteral("Caméra Salle Serveur"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));

    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();

    m_editButton = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);

    mainLayout->addLayout(headerLayout);

    // Video/Image display
    auto *stack = new QStackedWidget(this);
    stack->setMinimumSize(320, 180);

    // Static image fallback
    m_imageLabel = new QLabel(this);
    m_imageLabel->setPixmap(loadCameraPixmap().scaled(640, 360, Qt::KeepAspectRatio, Qt::SmoothTransformation));
    m_imageLabel->setAlignment(Qt::AlignCenter);
    m_imageLabel->setStyleSheet("background: #0d1529; border-radius: 8px;");
    stack->addWidget(m_imageLabel);

    // Video widget for RTSP
    m_videoWidget = new QVideoWidget(this);
    m_videoWidget->setStyleSheet("background: #0d1529; border-radius: 8px;");
    stack->addWidget(m_videoWidget);

    // Media player
    m_mediaPlayer = new QMediaPlayer(this);
    m_mediaPlayer->setVideoOutput(m_videoWidget);

    mainLayout->addWidget(stack, 1);

    // Controls
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

    // Connect buttons
    connect(m_reloadButton, &QPushButton::clicked, this, [this, stack]() {
        if (m_mediaPlayer->playbackState() == QMediaPlayer::PlayingState) {
            m_mediaPlayer->stop();
            stack->setCurrentIndex(0);
        } else {
            play();
            stack->setCurrentIndex(1);
        }
    });

    connect(m_recordButton, &QPushButton::clicked, this, [this]() {
        m_isRecording = !m_isRecording;
        m_recordButton->setText(m_isRecording ? QStringLiteral("■") : QStringLiteral("●"));
    });
}

CameraWidget::~CameraWidget()
{
    if (m_mediaPlayer) {
        m_mediaPlayer->stop();
    }
}

QPushButton *CameraWidget::editButton() const
{
    return m_editButton;
}

QPushButton *CameraWidget::closeButton() const
{
    return m_closeButton;
}

QPushButton *CameraWidget::reloadButton() const
{
    return m_reloadButton;
}

QPushButton *CameraWidget::snapshotButton() const
{
    return m_snapshotButton;
}

QPushButton *CameraWidget::fullscreenButton() const
{
    return m_fullscreenButton;
}

QPushButton *CameraWidget::recordButton() const
{
    return m_recordButton;
}

QPixmap CameraWidget::currentFrame() const
{
    return m_imageLabel->pixmap().copy();
}

bool CameraWidget::reloadFrame()
{
    m_imageLabel->setPixmap(loadCameraPixmap().scaled(
        m_imageLabel->size(), Qt::KeepAspectRatio, Qt::SmoothTransformation));
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
    Q_UNUSED(enabled)
}

void CameraWidget::setStreamUrl(const QString &url)
{
    m_streamUrl = url;
}

void CameraWidget::play()
{
    if (m_mediaPlayer && !m_streamUrl.isEmpty()) {
        m_mediaPlayer->setSource(QUrl(m_streamUrl));
        m_mediaPlayer->play();
    }
}

void CameraWidget::stop()
{
    if (m_mediaPlayer) {
        m_mediaPlayer->stop();
    }
}
