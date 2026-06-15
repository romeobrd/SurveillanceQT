#include "camerawidget.h"

#include <QHBoxLayout>
#include <QLabel>
#include <QProcess>
#include <QPushButton>
#include <QResizeEvent>
#include <QShowEvent>
#include <QStandardPaths>
#include <QTimer>
#include <QVBoxLayout>

namespace {

constexpr const char *kForcedLocalRtspUrl = "rtsp://127.0.0.1:8554/rascam";

/*
 *
 *ATTENTION OBLIGATOIRE -> sinon pas d'image
 *
 L'incrustation de mpv via --wid ne fonctionne qu'avec X11. Si Qt démarre
 en Wayland, on force la plateforme "xcb" AVANT la création de
 QApplication (d'où l'objet statique initialisé au chargement).
*/

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

// Fabrique un petit bouton carré (↻ ✎ ✕) avec le style de la barre de titre.
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

} // namespace

// =====================================================================
//  CONSTRUCTION / DESTRUCTION
// =====================================================================

// Construit l'interface et branche le bouton de rechargement du flux.
CameraWidget::CameraWidget(QWidget *parent)
    : QWidget(parent)
    , m_title(QStringLiteral("Caméra"))
    , m_streamUrl(QString::fromLatin1(kForcedLocalRtspUrl))
    , m_titleLabel(nullptr)
    , m_videoSurface(nullptr)
    , m_closeButton(nullptr)
    , m_editButton(nullptr)
    , m_reloadButton(nullptr)
    , m_mpvProcess(new QProcess(this))
    , m_playRequested(false)
    , m_startAttempts(0)
{
    buildUi();

    // Le bouton ↻ relance simplement le flux vidéo.
    connect(m_reloadButton, &QPushButton::clicked, this, &CameraWidget::reloadFrame);
}

// Arrête proprement mpv à la destruction du widget.
CameraWidget::~CameraWidget()
{
    stop();
}

// =====================================================================
//  CONSTRUCTION DE L'INTERFACE
// =====================================================================

// Met en place la barre de titre (titre + boutons) et la surface vidéo
// native dans laquelle mpv viendra dessiner.
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
}

/* =====================================================================
  ACCESSEURS
 =====================================================================

Change le titre affiché dans la barre du widget. -> herité du dashboard
*/
void CameraWidget::setTitle(const QString &title)
{
    m_title = title.trimmed().isEmpty() ? QStringLiteral("Caméra") : title.trimmed();
    setWindowTitle(m_title);

    if (m_titleLabel)
        m_titleLabel->setText(m_title);
}

/* L'URL passée par le dashboard est ignorée : le flux arrive toujours en

 local (voir kForcedLocalRtspUrl). par le docker
*/

void CameraWidget::setStreamUrl(const QString &url)
{
    Q_UNUSED(url)
    m_streamUrl = QString::fromLatin1(kForcedLocalRtspUrl);
}

// Donne accès au bouton de fermeture (le dashboard y branche son action). -> herité du style global
QPushButton *CameraWidget::closeButton() const
{
    return m_closeButton;
}

// Donne accès au bouton d'édition (le dashboard y branche son action). -> herité du style global
QPushButton *CameraWidget::editButton() const
{
    return m_editButton;
}

/*
=====================================================================
  PILOTAGE DU LECTEUR MPV
 =====================================================================

Indique si mpv peut être incrusté : la surface vidéo doit être
 réellement affichée à l'écran avec une taille raisonnable.

*/
bool CameraWidget::isEmbeddingReady() const
{
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

// Point d'entrée pour démarrer l'affichage du flux : localise mpv puis
// programme son lancement dès que la surface vidéo sera prête.
void CameraWidget::play()
{
    if (m_streamUrl.isEmpty())
        return;

    // mpv doit être installé et présent dans le PATH.
    m_mpvExecutable = QStandardPaths::findExecutable(QStringLiteral("mpv"));
    if (m_mpvExecutable.isEmpty())
        return;

    if (!m_videoSurface)
        return;

    if (m_mpvProcess->state() != QProcess::NotRunning)
        stop();

    m_playRequested = true;
    m_startAttempts = 0;
    scheduleStart(250);
}

// Reprogramme une tentative de lancement après le délai indiqué.
void CameraWidget::scheduleStart(int delayMs)
{
    QTimer::singleShot(delayMs, this, &CameraWidget::startWhenReady);
}


/*
 Attention obligatoire sinon problème avec le scanner ARP

 Attend (30 essais max, 200 ms d'intervalle) que la surface vidéo soit
 visible et dimensionnée, puis déclenche le lancement de mpv


*/
void CameraWidget::startWhenReady()
{
    if (!m_playRequested)
        return;

    if (!isEmbeddingReady()) {
        if (++m_startAttempts <= 30)
            scheduleStart(200);
        return;
    }

    if (!m_videoSurface->testAttribute(Qt::WA_WState_Created))
        m_videoSurface->winId();

    QTimer::singleShot(80, this, &CameraWidget::startMpv);
}

// Lance le processus mpv en lui passant l'identifiant de la surface
// vidéo (--wid) et les options validées pour le flux RTSP.
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
    // Sortie vidéo X11 sans décodage matériel

    args << QStringLiteral("--vo=x11");
    args << QStringLiteral("--hwdec=no");
    args << m_streamUrl;

    m_mpvProcess->start(m_mpvExecutable, args);
}

// Arrête le flux
void CameraWidget::stop()
{
    m_playRequested = false;

    if (!m_mpvProcess || m_mpvProcess->state() == QProcess::NotRunning)
        return;

    m_mpvProcess->terminate();
    if (!m_mpvProcess->waitForFinished(1200)) {
        m_mpvProcess->kill();
        m_mpvProcess->waitForFinished(1200);
    }
}

// Relance le flux (bouton ↻) : arrêt puis redémarrage.
void CameraWidget::reloadFrame()
{
    stop();
    play();
}

/*
=====================================================================
  ÉVÉNEMENTS QT
 =====================================================================

Démarre automatiquement le flux dès que le widget devient visible :
 le dashboard n'a pas besoin d'appeler play() lui-même.
*/

void CameraWidget::showEvent(QShowEvent *event)
{
    QWidget::showEvent(event);
    if (m_videoSurface)
        m_videoSurface->winId();

    if (m_mpvProcess->state() == QProcess::NotRunning && !m_playRequested) {
        QTimer::singleShot(500, this, &CameraWidget::play);
    } else if (m_playRequested && m_mpvProcess->state() == QProcess::NotRunning) {
        scheduleStart(250);
    }
}

// Si un lancement était en attente, le reprogramme après redimensionnement
// (la surface a alors une taille valide).
void CameraWidget::resizeEvent(QResizeEvent *event)
{
    QWidget::resizeEvent(event);

    if (m_playRequested && m_mpvProcess->state() == QProcess::NotRunning)
        scheduleStart(250);
}
