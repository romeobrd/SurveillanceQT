#include "camerawidget.h"

#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QMediaPlayer>
#include <QPixmap>
#include <QPushButton>
#include <QProcess>
#include <QRandomGenerator>
#include <QTimer>
#include <QUrl>
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

} // namespace

CameraWidget::CameraWidget(QWidget *parent)
    : QFrame(parent)
    , m_player(new QMediaPlayer(this))
    , m_videoWidget(nullptr)
    , m_statusLabel(nullptr)
    , m_titleLabel(nullptr)
    , m_editButton(nullptr)
    , m_closeButton(nullptr)
    , m_reloadButton(nullptr)
    , m_snapshotButton(nullptr)
    , m_fullscreenButton(nullptr)
    , m_recordButton(nullptr)
    , m_isRecording(false)
    , m_streamActive(false)
    , m_streamUrl(QStringLiteral("http://200.26.16.180:8888/rascam/index.m3u8"))
    , m_reconnectTimer(new QTimer(this))
    , m_reconnectAttempts(0)
    , m_externalPlayer(nullptr)
    , m_useExternalPlayer(false)
    , m_consecutiveErrors(0)
{
    setObjectName(QStringLiteral("panelCamera"));
    setStyleSheet(
        "QFrame#panelCamera {"
        "  background: rgba(31, 49, 92, 0.88);"
        "  border: 1px solid rgba(142, 165, 215, 0.12);"
        "  border-radius: 16px;"
        "}"
        "QLabel { color: #eff4ff; }"
        "QLabel#title { font-size: 18px; font-weight: 700; }"
        );

    // On Linux, check if GStreamer has HLS support; if not, use external player
#ifdef Q_OS_LINUX
    if (!checkGstreamerHlsSupport()) {
        m_useExternalPlayer = true;
        setStatus(QStringLiteral("⚠ GStreamer HLS manquant — mode externe"), QStringLiteral("#f0c040"));
    }
#endif

    m_reconnectTimer->setSingleShot(true);
    connect(m_reconnectTimer, &QTimer::timeout, this, &CameraWidget::onReconnectTimer);

    connect(m_player, &QMediaPlayer::mediaStatusChanged, this, &CameraWidget::onPlayerStatusChanged);
    connect(m_player, &QMediaPlayer::errorOccurred, this, [this](QMediaPlayer::Error, const QString &) {
        onPlayerError();
    });

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(16, 12, 16, 16);
    mainLayout->setSpacing(8);

    // ── Header ──────────────────────────────────────────────────────────────
    auto *headerLayout = new QHBoxLayout;
    m_titleLabel = new QLabel(QStringLiteral("Caméra Salle Serveur"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));
    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();

    m_editButton  = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);
    mainLayout->addLayout(headerLayout);

    // ── Status label ────────────────────────────────────────────────────────
    m_statusLabel = new QLabel(QStringLiteral("⏸ Arrêté"), this);
    m_statusLabel->setAlignment(Qt::AlignCenter);
    m_statusLabel->setStyleSheet(
        "QLabel {"
        "  color: #9caac4;"
        "  font-size: 12px;"
        "  padding: 2px 6px;"
        "  border-radius: 4px;"
        "  background: rgba(255,255,255,0.04);"
        "}"
        );
    mainLayout->addWidget(m_statusLabel);

    // ── Video widget ─────────────────────────────────────────────────────────
    m_videoWidget = new QVideoWidget(this);
    m_videoWidget->setMinimumHeight(150);
    m_videoWidget->setStyleSheet(QStringLiteral("background: #111827; border-radius: 8px;"));
    m_player->setVideoOutput(m_videoWidget);
    mainLayout->addWidget(m_videoWidget, 1);

    // ── Overlay control bar ──────────────────────────────────────────────────
    auto *bottomLayout = new QHBoxLayout;
    bottomLayout->setContentsMargins(4, 0, 4, 0);

    m_reloadButton = createOverlayButton(QStringLiteral("↺"), this);
    m_reloadButton->setToolTip(QStringLiteral("Recharger le flux"));
    bottomLayout->addWidget(m_reloadButton, 0, Qt::AlignLeft);
    bottomLayout->addStretch();

    auto *rightControls = new QHBoxLayout;
    rightControls->setSpacing(6);

    m_recordButton = createOverlayButton(QStringLiteral("●"), this);
    m_recordButton->setStyleSheet(
        "QPushButton {"
        "  color: #ff4444;"
        "  background: rgba(20, 28, 47, 0.75);"
        "  border: 1px solid rgba(189, 205, 239, 0.10);"
        "  border-radius: 5px;"
        "  font-size: 12px;"
        "  font-weight: 700;"
        "}"
        "QPushButton:hover { background: rgba(41, 58, 92, 0.88); }"
        "QPushButton:checked { color: #ff0000; background: rgba(255,0,0,0.2); }"
        );
    m_recordButton->setCheckable(true);
    m_snapshotButton   = createOverlayButton(QStringLiteral("◉"), this);
    m_fullscreenButton = createOverlayButton(QStringLiteral("⇲"), this);

    rightControls->addWidget(m_recordButton);
    rightControls->addWidget(m_snapshotButton);
    rightControls->addWidget(m_fullscreenButton);
    bottomLayout->addLayout(rightControls);
    mainLayout->addLayout(bottomLayout);

    // ── Start / Stop buttons ─────────────────────────────────────────────────
    auto *ctrlLayout = new QHBoxLayout;
    ctrlLayout->setSpacing(8);

    auto *startBtn = new QPushButton(QStringLiteral("▶ Start"), this);
    startBtn->setStyleSheet(
        "QPushButton {"
        "  color: #a8ffb0;"
        "  background: rgba(0,200,80,0.15);"
        "  border: 1px solid rgba(0,200,80,0.3);"
        "  border-radius: 6px;"
        "  padding: 4px 14px;"
        "  font-weight: 700;"
        "}"
        "QPushButton:hover { background: rgba(0,200,80,0.25); }"
        );
    auto *stopBtn = new QPushButton(QStringLiteral("■ Stop"), this);
    stopBtn->setStyleSheet(
        "QPushButton {"
        "  color: #ffaaaa;"
        "  background: rgba(200,50,50,0.15);"
        "  border: 1px solid rgba(200,50,50,0.3);"
        "  border-radius: 6px;"
        "  padding: 4px 14px;"
        "  font-weight: 700;"
        "}"
        "QPushButton:hover { background: rgba(200,50,50,0.25); }"
        );

    connect(startBtn,       &QPushButton::clicked, this, &CameraWidget::startStream);
    connect(stopBtn,        &QPushButton::clicked, this, &CameraWidget::stopStream);
    connect(m_reloadButton, &QPushButton::clicked, this, &CameraWidget::startStream);

    ctrlLayout->addStretch();
    ctrlLayout->addWidget(startBtn);
    ctrlLayout->addWidget(stopBtn);
    ctrlLayout->addStretch();
    mainLayout->addLayout(ctrlLayout);

    // Auto-start stream when widget is ready
    QTimer::singleShot(500, this, &CameraWidget::startStream);
}

// ── Stream control ────────────────────────────────────────────────────────────

void CameraWidget::setStreamUrl(const QString &url)
{
    m_streamUrl = url;
}

QString CameraWidget::streamUrl() const
{
    return m_streamUrl;
}

void CameraWidget::startStream()
{
    if (m_streamUrl.isEmpty()) {
        setStatus(QStringLiteral("❌ URL non définie"), QStringLiteral("#ff6666"));
        return;
    }

    m_streamActive = true;
    m_reconnectTimer->stop();
    setStatus(QStringLiteral("⏳ Connexion…"), QStringLiteral("#f0c040"));

    // On Linux with missing GStreamer HLS, use external player fallback
    if (m_useExternalPlayer) {
        tryExternalPlayer();
        return;
    }

    m_player->setSource(QUrl(m_streamUrl));
    m_player->play();
}

void CameraWidget::stopStream()
{
    m_streamActive = false;
    m_reconnectAttempts = 0;
    m_consecutiveErrors = 0;
    m_reconnectTimer->stop();

    // Stop external player if running
    if (m_externalPlayer) {
        m_externalPlayer->terminate();
        m_externalPlayer->waitForFinished(3000);
        if (m_externalPlayer->state() != QProcess::NotRunning) {
            m_externalPlayer->kill();
        }
    }

    m_player->stop();
    m_player->setSource(QUrl());
    setStatus(QStringLiteral("⏸ Arrêté"), QStringLiteral("#9caac4"));
}

void CameraWidget::onPlayerStatusChanged()
{
    if (!m_player) {
        return;
    }

    switch (m_player->mediaStatus()) {
    case QMediaPlayer::LoadingMedia:
        setStatus(QStringLiteral("⏳ Chargement…"), QStringLiteral("#f0c040"));
        break;
    case QMediaPlayer::BufferingMedia:
        setStatus(QStringLiteral("⏳ Buffering…"), QStringLiteral("#f0c040"));
        break;
    case QMediaPlayer::BufferedMedia:
    case QMediaPlayer::LoadedMedia:
        m_reconnectAttempts = 0;
        setStatus(QStringLiteral("✔ Connecté — ") + m_streamUrl, QStringLiteral("#40d080"));
        break;
    case QMediaPlayer::EndOfMedia:
    case QMediaPlayer::InvalidMedia:
        if (m_streamActive) {
            m_reconnectAttempts++;
            int delayMs = qMin(5000 * m_reconnectAttempts, 30000);
            setStatus(QStringLiteral("↺ Reconnexion dans %1s…").arg(delayMs / 1000),
                      QStringLiteral("#f0c040"));
            m_reconnectTimer->start(delayMs);
        }
        break;
    default:
        break;
    }
}

void CameraWidget::onPlayerError()
{
    if (!m_streamActive || !m_player) {
        return;
    }

    m_consecutiveErrors++;
    QString errorMsg = m_player->errorString();

    setStatus(QStringLiteral("❌ ") + errorMsg, QStringLiteral("#ff6666"));
    emit streamError(errorMsg);

    // On Linux, if GStreamer fails repeatedly, switch to external player
#ifdef Q_OS_LINUX
    if (m_consecutiveErrors >= 3 && !m_useExternalPlayer) {
        m_useExternalPlayer = true;
        setStatus(QStringLiteral("↺ Bascule vers lecteur externe…"), QStringLiteral("#f0c040"));
        tryExternalPlayer();
        return;
    }
#endif

    m_reconnectAttempts++;
    int delayMs = qMin(5000 * m_reconnectAttempts, 30000);
    m_reconnectTimer->start(delayMs);
}

void CameraWidget::onReconnectTimer()
{
    if (!m_streamActive) {
        return;
    }
    setStatus(QStringLiteral("↺ Reconnexion #%1…").arg(m_reconnectAttempts),
              QStringLiteral("#f0c040"));
    m_player->setSource(QUrl(m_streamUrl));
    m_player->play();
}

void CameraWidget::setStatus(const QString &text, const QString &color)
{
    if (!m_statusLabel) {
        return;
    }
    m_statusLabel->setText(text);
    m_statusLabel->setStyleSheet(
        QStringLiteral(
            "QLabel {"
            "  color: %1;"
            "  font-size: 12px;"
            "  padding: 2px 6px;"
            "  border-radius: 4px;"
            "  background: rgba(255,255,255,0.04);"
            "}"
            ).arg(color)
        );
}

// ── Legacy API ────────────────────────────────────────────────────────────────

QPixmap CameraWidget::currentFrame() const
{
    return QPixmap();
}

bool CameraWidget::reloadFrame()
{
    startStream();
    return true;
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

// ── Accessors ─────────────────────────────────────────────────────────────────

QPushButton *CameraWidget::editButton()       const { return m_editButton;      }
QPushButton *CameraWidget::closeButton()      const { return m_closeButton;     }
QPushButton *CameraWidget::reloadButton()     const { return m_reloadButton;    }
QPushButton *CameraWidget::snapshotButton()   const { return m_snapshotButton;  }
QPushButton *CameraWidget::fullscreenButton() const { return m_fullscreenButton;}
QPushButton *CameraWidget::recordButton()     const { return m_recordButton;    }
bool         CameraWidget::isRecording()      const { return m_isRecording;     }

// ── Linux GStreamer HLS detection ────────────────────────────────────────────

bool CameraWidget::checkGstreamerHlsSupport() const
{
#ifdef Q_OS_LINUX
    // Check if gst-plugins-bad is installed by looking for the hlsdemux element
    QProcess gstCheck;
    gstCheck.start(QStringLiteral("gst-inspect-1.0"),
                   QStringList{QStringLiteral("hlsdemux")});
    gstCheck.waitForFinished(5000);
    if (gstCheck.exitCode() != 0) {
        return false;  // hlsdemux not found
    }

    // Also check for the adaptive demuxer used by playbin
    gstCheck.start(QStringLiteral("gst-inspect-1.0"),
                   QStringList{QStringLiteral("adaptivedemux2")});
    gstCheck.waitForFinished(5000);
    if (gstCheck.exitCode() != 0) {
        // Try the older name
        gstCheck.start(QStringLiteral("gst-inspect-1.0"),
                       QStringList{QStringLiteral("adaptivedemux")});
        gstCheck.waitForFinished(5000);
        if (gstCheck.exitCode() != 0) {
            return false;
        }
    }

    return true;
#else
    return true;  // Non-Linux platforms use their native media backends
#endif
}

// ── External player fallback (Linux) ─────────────────────────────────────────

void CameraWidget::tryExternalPlayer()
{
    // Stop any existing external player
    if (m_externalPlayer) {
        m_externalPlayer->terminate();
        m_externalPlayer->waitForFinished(2000);
        if (m_externalPlayer->state() != QProcess::NotRunning) {
            m_externalPlayer->kill();
        }
        m_externalPlayer->deleteLater();
        m_externalPlayer = nullptr;
    }

    // Try to find an available external player
    static const QStringList players = {
        QStringLiteral("vlc"),
        QStringLiteral("ffplay"),
        QStringLiteral("mpv")
    };

    QString foundPlayer;
    for (const QString &player : players) {
        QProcess whichCheck;
        whichCheck.start(QStringLiteral("which"), QStringList{player});
        whichCheck.waitForFinished(3000);
        if (whichCheck.exitCode() == 0) {
            foundPlayer = player;
            break;
        }
    }

    if (foundPlayer.isEmpty()) {
        QString msg = QStringLiteral("❌ Aucun lecteur externe trouvé (vlc, ffplay, mpv). "
                                     "Installez: sudo apt install vlc ou sudo apt install ffmpeg");
        setStatus(msg, QStringLiteral("#ff6666"));
        emit streamError(msg);

        // Also show GStreamer hint
        m_reconnectAttempts++;
        int delayMs = qMin(5000 * m_reconnectAttempts, 30000);
        m_reconnectTimer->start(delayMs);
        return;
    }

    m_externalPlayer = new QProcess(this);
    connect(m_externalPlayer, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, &CameraWidget::onExternalPlayerFinished);
    connect(m_externalPlayer, &QProcess::errorOccurred,
            this, &CameraWidget::onExternalPlayerError);

    QStringList args;
    if (foundPlayer == QStringLiteral("vlc")) {
        args << QStringLiteral("--no-video-title") << QStringLiteral("--play-and-exit")
             << m_streamUrl;
    } else if (foundPlayer == QStringLiteral("ffplay")) {
        args << QStringLiteral("-fflags") << QStringLiteral("nobuffer")
             << QStringLiteral("-flags") << QStringLiteral("low_delay")
             << QStringLiteral("-i") << m_streamUrl
             << QStringLiteral("-window_title") << QStringLiteral("Surveillance Camera");
    } else if (foundPlayer == QStringLiteral("mpv")) {
        args << QStringLiteral("--profile=low-latency") << m_streamUrl;
    }

    m_externalPlayer->start(foundPlayer, args);
    setStatus(QStringLiteral("✔ Lecteur externe: ") + foundPlayer, QStringLiteral("#40d080"));
}

void CameraWidget::onExternalPlayerFinished(int exitCode, QProcess::ExitStatus status)
{
    Q_UNUSED(status)

    if (!m_streamActive) {
        return;
    }

    if (exitCode != 0) {
        setStatus(QStringLiteral("❌ Lecteur externe terminé avec erreur (code %1)").arg(exitCode),
                  QStringLiteral("#ff6666"));
    }

    // Auto-reconnect if stream was active
    m_reconnectAttempts++;
    int delayMs = qMin(5000 * m_reconnectAttempts, 30000);
    m_reconnectTimer->start(delayMs);
}

void CameraWidget::onExternalPlayerError(QProcess::ProcessError error)
{
    if (!m_streamActive) {
        return;
    }

    QString errMsg;
    switch (error) {
    case QProcess::FailedToStart:
        errMsg = QStringLiteral("Impossible de lancer le lecteur externe");
        break;
    case QProcess::Crashed:
        errMsg = QStringLiteral("Le lecteur externe a planté");
        break;
    default:
        errMsg = QStringLiteral("Erreur lecteur externe");
        break;
    }

    setStatus(QStringLiteral("❌ ") + errMsg, QStringLiteral("#ff6666"));
    emit streamError(errMsg);

    m_reconnectAttempts++;
    int delayMs = qMin(5000 * m_reconnectAttempts, 30000);
    m_reconnectTimer->start(delayMs);
}
