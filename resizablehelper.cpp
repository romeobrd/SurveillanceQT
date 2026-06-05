#include "resizablehelper.h"

#include <QVBoxLayout>
#include <QPushButton>
#include <QMouseEvent>

ResizableContainer::ResizableContainer(QWidget *contentWidget, QWidget *parent)
    : QFrame(parent)
    , m_contentWidget(contentWidget)
    , m_resizeHandle(nullptr)
    , m_resizable(false)
    , m_resizing(false)
    , m_minSize(200, 150)
    , m_maxSize(800, 600)
{
    setFrameStyle(QFrame::NoFrame);
    setAttribute(Qt::WA_TransparentForMouseEvents, false);

    auto *layout = new QVBoxLayout(this);
    layout->setContentsMargins(0, 0, 0, 0);
    layout->setSpacing(0);

    if (m_contentWidget) {
        layout->addWidget(m_contentWidget);
    }

    // Créer une poignée de redimensionnement
    m_resizeHandle = new QPushButton(this);
    m_resizeHandle->setFixedSize(16, 16);
    m_resizeHandle->setCursor(Qt::SizeFDiagCursor);
    m_resizeHandle->setStyleSheet(
        "QPushButton {"
        "  background: rgba(74, 144, 217, 0.8);"
        "  border: 1px solid rgba(255, 255, 255, 0.5);"
        "  border-radius: 3px;"
        "}"
        "QPushButton:hover {"
        "  background: rgba(100, 170, 255, 1.0);"
        "}"
    );
    m_resizeHandle->hide();

    setResizable(false);
}

void ResizableContainer::setResizable(bool enabled)
{
    m_resizable = enabled;
    if (enabled) {
        m_resizeHandle->show();
        m_resizeHandle->raise();
        updateResizeHandles();
        setCursor(Qt::ArrowCursor);
    } else {
        m_resizeHandle->hide();
        setCursor(Qt::ArrowCursor);
    }
}

void ResizableContainer::setMinSize(const QSize &size)
{
    m_minSize = size;
}

void ResizableContainer::setMaxSize(const QSize &size)
{
    m_maxSize = size;
}

void ResizableContainer::resizeEvent(QResizeEvent *event)
{
    QFrame::resizeEvent(event);
    updateResizeHandles();
}

void ResizableContainer::updateResizeHandles()
{
    if (m_resizeHandle && m_resizeHandle->isVisible()) {
        m_resizeHandle->move(width() - 18, height() - 18);
    }
}

void ResizableContainer::mousePressEvent(QMouseEvent *event)
{
    if (!m_resizable) {
        QFrame::mousePressEvent(event);
        return;
    }

    // Vérifier si on clique sur la zone de redimensionnement (coin inférieur droit)
    QRect resizeArea(width() - 20, height() - 20, 20, 20);
    if (resizeArea.contains(event->pos())) {
        m_resizing = true;
        m_resizeStartPos = event->globalPosition().toPoint();
        m_resizeStartSize = size();
        event->accept();
        return;
    }

    QFrame::mousePressEvent(event);
}

void ResizableContainer::mouseMoveEvent(QMouseEvent *event)
{
    if (!m_resizable) {
        QFrame::mousePressEvent(event);
        return;
    }

    if (m_resizing) {
        QPoint delta = event->globalPosition().toPoint() - m_resizeStartPos;
        int newWidth = m_resizeStartSize.width() + delta.x();
        int newHeight = m_resizeStartSize.height() + delta.y();

        // Appliquer les limites
        newWidth = qBound(m_minSize.width(), newWidth, m_maxSize.width());
        newHeight = qBound(m_minSize.height(), newHeight, m_maxSize.height());

        setFixedSize(newWidth, newHeight);
        event->accept();
        return;
    }

    // Mettre à jour le curseur selon la position
    updateCursor(event->pos());

    QFrame::mouseMoveEvent(event);
}

void ResizableContainer::mouseReleaseEvent(QMouseEvent *event)
{
    if (m_resizing) {
        m_resizing = false;
        event->accept();
        return;
    }

    QFrame::mouseReleaseEvent(event);
}

void ResizableContainer::updateCursor(const QPoint &pos)
{
    QRect resizeArea(width() - 20, height() - 20, 20, 20);
    if (resizeArea.contains(pos)) {
        setCursor(Qt::SizeFDiagCursor);
    } else {
        setCursor(Qt::ArrowCursor);
    }
}
