#include "camerawidget.h"

#include <QDebug>
#include <QGuiApplication>
#include <QHBoxLayout>
#include <QLabel>
#include <QProcess>
#include <QPushButton>
#include <QResizeEvent>
#include <QShowEvent>
#include <QStandardPaths>
#include <QStyle>
#include <QTimer>
#include <QVBoxLayout>

namespace {

constexpr const char *kForcedLocalRtspUrl = "rtsp://127.0.0.1:8554/rascam";



QPushButton *makeCameraToolButton(const QString &text, QWidget *parent)
{
    auto *button = new QPushButton(text, parent);
    button->setFixedSize(28, 28);
    button->setFocusPolicy(Qt::NoFocus);
    button->setCursor(Qt::PointingHandCursor);
    button->setStyleSheet(
        "QPushButton {"
        "  color:#eef4ff;"
        "  background:rgba(117,140,188,0.18);"
        "  border:1px solid rgba(169,191,235,0.14);"
        "  border-radius:6px;"
        "  font-size:14px;"
        "  font-weight:700;"
        "}"
        "QPushButton:hover { background:rgba(126,200,227,0.32); }"
        "QPushButton:pressed { background:rgba(126,200,227,0.44); }"
    );
    return button;
}

// mpv écrit ses messages sur la sortie standard : on repère les erreurs
// par mots-clés pour les afficher dans la barre d'état du widget.
bool looksLikeMpvError(const QString &text)
{
    const QString lower = text.toLower();
    return lower.contains(QStringLiteral("error"))
        || lower.contains(QStringLiteral("failed"))
        || lower.contains(QStringLiteral("refused"))
        || lower.contains(QStringLiteral("timed out"))
        || lower.contains(QStringLiteral("no video"))
        || lower.contains(QStringLiteral("invalid"));
}

} // namespace

// =====================================================================
//  CONSTRUCTION / DESTRUCTION
// =====================================================================
CameraWidget::CameraWidget(QWidget *parent)
    : QWidget(parent)
    , m_title(QStringLiteral("Caméra"))
    , m_streamUrl(QString::fromLatin1(kForcedLocalRtspUrl))
    , m_titleLabel(nullptr)
    , m_statusLabel(nullptr)
    , m_videoSurface(nullptr)
    , m_closeButton(nullptr)
    , m_editButton(nullptr)
    , m_reloadButton(nullptr)
    , m_mpvProcess(new QProcess(this))
    , m_playRequested(false)
    , m_stopping(false)
    , m_startAttempts(0)
{
    buildUi();

    m_mpvProcess->setProcessChannelMode(QProcess::MergedChannels);

    connect(m_mpvProcess, &QProcess::started, this, [this]() {
        setStatus(QStringLiteral("Flux lancé · %1").arg(m_streamUrl));
    });

    connect(m_mpvProcess, &QProcess::readyReadStandardOutput, this, [this]() {
        const QString output = QString::fromLocal8Bit(m_mpvProcess->readAllStandardOutput()).trimmed();
        if (output.isEmpty())
            return;

        qDebug().noquote() << "[mpv]" << output;

        if (looksLikeMpvError(output))
            setStatus(output.left(180), true);
    });

    connect(m_mpvProcess, &QProcess::errorOccurred, this, [this](QProcess::ProcessError) {
        setStatus(QStringLiteral("Erreur mpv : %1").arg(m_mpvProcess->errorString()), true);
    });

    connect(m_mpvProcess, &QProcess::finished,
            this, [this](int exitCode, QProcess::ExitStatus exitStatus) {
        if (m_stopping) {
            setStatus(QStringLiteral("Flux arrêté"));
            return;
        }
        if (exitStatus == QProcess::CrashExit) {
            setStatus(QStringLiteral("mpv a crashé"), true);
            return;
        }
        if (exitCode != 0) {
            setStatus(QStringLiteral("mpv s'est arrêté avec le code %1 "
                                     "(voir la sortie d'application pour le détail).").arg(exitCode), true);
            return;
        }
        setStatus(QStringLiteral("Flux arrêté"));
    });

    connect(m_reloadButton, &QPushButton::clicked, this, &CameraWidget::reloadFrame);
}

CameraWidget::~CameraWidget()
{
    stop();
}

// =====================================================================
//  CONSTRUCTION DE L'INTERFACE
// =====================================================================
void CameraWidget::buildUi()
{
    setObjectName(QStringLiteral("cameraWidget"));
    setMinimumSize(260, 190);
    setAttribute(Qt::WA_StyledBackground, true);
    setWindowTitle(m_title);

    setStyleSheet(
        "QWidget#cameraWidget {"
        "  background:rgba(31,49,92,0.88);"
        "  border:1px solid rgba(142,165,215,0.14);"
        "  border-radius:16px;"
        "}"
        "QLabel#cameraTitle {"
        "  color:#edf4ff;"
        "  font-size:17px;"
        "  font-weight:800;"
        "}"
        "QLabel#cameraStatus {"
        "  color:#9fb5dc;"
        "  font-size:12px;"
        "}"
        "QLabel#cameraStatus[error=\"true\"] {"
        "  color:#ffb4b4;"
        "}"
        "QWidget#cameraSurface {"
        "  background:#05070d;"
        "  border-radius:10px;"
        "  border:1px solid rgba(255,255,255,0.08);"
        "}"
    );

    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(12, 10, 12, 12);
    root->setSpacing(8);

    // --- Barre de titre du widget (titre + boutons d'action) ---
    auto *header = new QHBoxLayout;
    header->setContentsMargins(0, 0, 0, 0);
    header->setSpacing(6);

    m_titleLabel = new QLabel(m_title, this);
    m_titleLabel->setObjectName(QStringLiteral("cameraTitle"));

    m_reloadButton = makeCameraToolButton(QStringLiteral("↻"), this);
    m_editButton   = makeCameraToolButton(QStringLiteral("✎"), this);
    m_closeButton  = makeCameraToolButton(QStringLiteral("✕"), this);

    header->addWidget(m_titleLabel);
    header->addStretch();
    header->addWidget(m_reloadButton);
    header->addWidget(m_editButton);
    header->addWidget(m_closeButton);
    root->addLayout(header);

    // --- Surface vidéo : un widget NATIF dont l'identifiant de fenêtre
    //     (winId) est transmis à mpv via --wid pour qu'il dessine dedans ---
    m_videoSurface = new QWidget(this);
    m_videoSurface->setObjectName(QStringLiteral("cameraSurface"));
    m_videoSurface->setAttribute(Qt::WA_NativeWindow, true);
    m_videoSurface->setAttribute(Qt::WA_DontCreateNativeAncestors, false);
    m_videoSurface->setAutoFillBackground(true);
    m_videoSurface->setMinimumHeight(120);
    m_videoSurface->winId(); // force la création du handle natif
    root->addWidget(m_videoSurface, 1);

    // --- Barre d'état (messages d'information / erreurs mpv) ---
    m_statusLabel = new QLabel(QStringLiteral("Flux en attente"), this);
    m_statusLabel->setObjectName(QStringLiteral("cameraStatus"));
    m_statusLabel->setTextInteractionFlags(Qt::TextSelectableByMouse);
    root->addWidget(m_statusLabel);
}

// =====================================================================
//  ACCESSEURS
// =====================================================================
void CameraWidget::setTitle(const QString &title)
{
    m_title = title.trimmed().isEmpty() ? QStringLiteral("Caméra") : title.trimmed();
    setWindowTitle(m_title);

    if (m_titleLabel)
        m_titleLabel->setText(m_title);
}

void CameraWidget::setStreamUrl(const QString &url)
{
    // L'URL passée par le dashboard (issue du scan réseau) est ignorée :
    // le flux arrive toujours en local (voir kForcedLocalRtspUrl).
    Q_UNUSED(url)

    m_streamUrl = QString::fromLatin1(kForcedLocalRtspUrl);
    setStatus(QStringLiteral("Prêt · %1").arg(m_streamUrl));
}

QPushButton *CameraWidget::closeButton() const
{
    return m_closeButton;
}

QPushButton *CameraWidget::editButton() const
{
    return m_editButton;
}

// =====================================================================
//  PILOTAGE DU LECTEUR MPV
// =====================================================================
bool CameraWidget::ensureMpvAvailable()
{
    // mpv doit être installé et présent dans le PATH.
    m_mpvExecutable = QStandardPaths::findExecutable(QStringLiteral("mpv"));

    if (m_mpvExecutable.isEmpty()) {
        setStatus(QStringLiteral("mpv introuvable. Installe-le avec : sudo apt install mpv"), true);
        return false;
    }
    return true;
}

bool CameraWidget::isEmbeddingReady() const
{
    // mpv ne peut être incrusté que si la surface vidéo est réellement
    // affichée à l'écran avec une taille raisonnable.
    if (!m_videoSurface)
        return false;
    if (!window() || !window()->isVisible())
        return false;
    if (!m_videoSurface->isVisible())
        return false;
    if (m_videoSurface->width() < 80 || m_videoSurface->height() < 60)
        return false;
    return true;
}

void CameraWidget::play()
{
    if (m_streamUrl.isEmpty()) {
        setStatus(QStringLiteral("Impossible de lancer : URL RTSP vide"), true);
        return;
    }

    if (!ensureMpvAvailable())
        return;

    if (!m_videoSurface) {
        setStatus(QStringLiteral("Surface vidéo indisponible"), true);
        return;
    }

    // Sécurité : si malgré le forçage en début de programme Qt tourne en
    // Wayland, l'incrustation --wid est impossible.
    const QString platform = QGuiApplication::platformName().toLower();
    if (platform.contains(QStringLiteral("wayland"))) {
        setStatus(QStringLiteral("Qt tourne en Wayland : lance l'IHM avec "
                                 "QT_QPA_PLATFORM=xcb pour utiliser mpv --wid."), true);
        return;
    }

    if (m_mpvProcess->state() != QProcess::NotRunning)
        stop();

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
    if (!m_playRequested)
        return;

    // On attend (30 essais max, 200 ms d'intervalle) que la surface
    // vidéo soit visible et dimensionnée avant de lancer mpv.
    if (!isEmbeddingReady()) {
        ++m_startAttempts;
        if (m_startAttempts <= 30) {
            setStatus(QStringLiteral("Attente de l'affichage Qt avant lancement mpv…"));
            scheduleStart(200);
            return;
        }
        setStatus(QStringLiteral("Surface vidéo pas prête : widget non visible ou taille invalide."), true);
        return;
    }

    if (!m_videoSurface->testAttribute(Qt::WA_WState_Created))
        m_videoSurface->winId();

    QTimer::singleShot(80, this, &CameraWidget::startMpv);
}

void CameraWidget::startMpv()
{
    if (!m_playRequested)
        return;
    if (m_mpvProcess->state() != QProcess::NotRunning)
        return;

    const QString windowId = QString::number(static_cast<qulonglong>(m_videoSurface->winId()));

    QStringList args;
    args << QStringLiteral("--no-config");
    args << QStringLiteral("--no-terminal");
    args << QStringLiteral("--no-osc");
    args << QStringLiteral("--no-border");
    args << QStringLiteral("--force-window=immediate");
    args << QStringLiteral("--demuxer-lavf-o=rtsp_transport=tcp");
    args << QStringLiteral("--wid=%1").arg(windowId);
    // Sortie vidéo X11 sans décodage matériel : c'est la combinaison
    // validée en test sur les Raspberry Pi / PC Linux du projet.
    args << QStringLiteral("--vo=x11");
    args << QStringLiteral("--hwdec=no");
    args << m_streamUrl;

    m_stopping = false;
    setStatus(QStringLiteral("Connexion au flux…"));
    qDebug() << "[CameraWidget] plateforme" << QGuiApplication::platformName();
    qDebug() << "[CameraWidget] wid" << windowId << "surface" << m_videoSurface->size();
    qDebug() << "[CameraWidget] lancement" << m_mpvExecutable << args;
    m_mpvProcess->start(m_mpvExecutable, args);
}

void CameraWidget::stop()
{
    m_playRequested = false;

    if (!m_mpvProcess || m_mpvProcess->state() == QProcess::NotRunning)
        return;

    // Arrêt poli (terminate) puis forcé (kill) si mpv ne répond pas.
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

// =====================================================================
//  ÉVÉNEMENTS QT
// =====================================================================
void CameraWidget::showEvent(QShowEvent *event)
{
    QWidget::showEvent(event);
    if (m_videoSurface)
        m_videoSurface->winId();

    // Démarrage automatique du flux dès que le widget devient visible :
    // le dashboard n'a pas besoin d'appeler play() lui-même.
    if (m_mpvProcess->state() == QProcess::NotRunning && !m_playRequested) {
        QTimer::singleShot(500, this, &CameraWidget::play);
    } else if (m_playRequested && m_mpvProcess->state() == QProcess::NotRunning) {
        scheduleStart(250);
    }
}

void CameraWidget::resizeEvent(QResizeEvent *event)
{
    QWidget::resizeEvent(event);

    if (m_playRequested && m_mpvProcess->state() == QProcess::NotRunning)
        scheduleStart(250);
}

void CameraWidget::setStatus(const QString &text, bool error)
{
    if (!m_statusLabel)
        return;

    // La propriété dynamique "error" pilote la couleur via la feuille de
    // style ; il faut re-polir le widget pour que le changement s'applique.
    m_statusLabel->setText(text);
    m_statusLabel->setProperty("error", error);
    m_statusLabel->style()->unpolish(m_statusLabel);
    m_statusLabel->style()->polish(m_statusLabel);
}
