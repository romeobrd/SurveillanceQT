#include "camerawidget.h"

#include <QCoreApplication>
#include <QFileInfo>
#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QPixmap>
#include <QPushButton>
#include <QStackedLayout>
#include <QVBoxLayout>

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
        "QLabel#viewer {"
        "  border-radius: 8px;"
        "  background: #111827;"
        "}"
        );

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(16, 12, 16, 16);
    mainLayout->setSpacing(10);

    auto *headerLayout = new QHBoxLayout;
    m_titleLabel = new QLabel(QStringLiteral("Caméra Salle Serveur"), this);
    m_titleLabel->setObjectName(QStringLiteral("title"));
    headerLayout->addWidget(m_titleLabel);
    headerLayout->addStretch();

    // Bouton édition pour modifier le nom de la caméra
    m_editButton = createToolButton(QStringLiteral("✎"), this);
    m_closeButton = createToolButton(QStringLiteral("✕"), this);
    headerLayout->addWidget(m_editButton);
    headerLayout->addWidget(m_closeButton);
    mainLayout->addLayout(headerLayout);

    auto *viewerContainer = new QWidget(this);
    viewerContainer->setMinimumHeight(150);
    auto *stack = new QStackedLayout(viewerContainer);
    stack->setStackingMode(QStackedLayout::StackAll);
    stack->setContentsMargins(0, 0, 0, 0);

    m_imageLabel = new QLabel(viewerContainer);
    m_imageLabel->setObjectName(QStringLiteral("viewer"));
    m_imageLabel->setScaledContents(true);
    m_imageLabel->setPixmap(loadCameraPixmap());

    auto *overlay = new QWidget(viewerContainer);
    overlay->setAttribute(Qt::WA_TranslucentBackground);
    auto *overlayLayout = new QVBoxLayout(overlay);
    overlayLayout->setContentsMargins(10, 10, 10, 10);
    overlayLayout->addStretch();

    auto *bottomLayout = new QHBoxLayout;
    bottomLayout->setContentsMargins(0, 0, 0, 0);
    m_reloadButton = createOverlayButton(QStringLiteral("◀"), overlay);
    bottomLayout->addWidget(m_reloadButton, 0, Qt::AlignLeft | Qt::AlignBottom);
    bottomLayout->addStretch();

    auto *rightControls = new QHBoxLayout;
    rightControls->setSpacing(6);
    m_recordButton = createOverlayButton(QStringLiteral("●"), overlay);
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
    m_snapshotButton = createOverlayButton(QStringLiteral("◉"), overlay);
    m_fullscreenButton = createOverlayButton(QStringLiteral("⇲"), overlay);
    rightControls->addWidget(m_recordButton);
    rightControls->addWidget(m_snapshotButton);
    rightControls->addWidget(m_fullscreenButton);
    bottomLayout->addLayout(rightControls);

    overlayLayout->addLayout(bottomLayout);

    stack->addWidget(m_imageLabel);
    stack->addWidget(overlay);

    mainLayout->addWidget(viewerContainer, 1);
}

QPushButton *CameraWidget::editButton() const
{
    return m_editButton;
}

QPushButton *CameraWidget::recordButton() const
{
    return m_recordButton;
}

bool CameraWidget::isRecording() const
{
    return m_isRecording;
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

QPixmap CameraWidget::currentFrame() const
{
    if (!m_imageLabel || !m_imageLabel->pixmap()) {
        return QPixmap();
    }
    return m_imageLabel->pixmap();
}

bool CameraWidget::reloadFrame()
{
    const QPixmap pixmap = loadCameraPixmap();
    if (pixmap.isNull() || !m_imageLabel) {
        return false;
    }

    m_imageLabel->setPixmap(pixmap);
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
    // Pour l'instant, cette méthode ne fait rien
    // Le redimensionnement sera implémenté différemment
    Q_UNUSED(enabled)
}
