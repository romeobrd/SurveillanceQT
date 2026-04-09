#include "resizehandle.h"

#include <QPainter>
#include <QCursor>

ResizeHandle::ResizeHandle(Position pos, QWidget *parent)
    : QWidget(parent)
    , m_position(pos)
    , m_resizing(false)
{
    setFixedSize(12, 12);
    setAttribute(Qt::WA_TransparentForMouseEvents, false);

    // Définir le curseur selon la position
    switch (pos) {
    case TopLeft:
    case BottomRight:
        setCursor(Qt::SizeFDiagCursor);
        break;
    case TopRight:
    case BottomLeft:
        setCursor(Qt::SizeBDiagCursor);
        break;
    }
}

void ResizeHandle::mousePressEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        m_resizing = true;
        m_startPos = event->globalPosition().toPoint();
        if (parentWidget()) {
            m_startSize = parentWidget()->size();
        }
        emit resizeStarted();
    }
}

void ResizeHandle::mouseMoveEvent(QMouseEvent *event)
{
    if (!m_resizing || !parentWidget()) return;

    QPoint delta = event->globalPosition().toPoint() - m_startPos;
    emit resizeMoved(delta);
}

void ResizeHandle::mouseReleaseEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton && m_resizing) {
        m_resizing = false;
        emit resizeFinished();
    }
}

void ResizeHandle::paintEvent(QPaintEvent *)
{
    QPainter p(this);
    p.setRenderHint(QPainter::Antialiasing);

    // Dessiner une poignée visible
    p.setPen(Qt::NoPen);
    p.setBrush(QColor(74, 144, 217, 180));

    QRect r = rect().adjusted(2, 2, -2, -2);

    switch (m_position) {
    case TopLeft:
        p.drawEllipse(r.center(), 4, 4);
        break;
    case TopRight:
        p.drawEllipse(r.center(), 4, 4);
        break;
    case BottomLeft:
        p.drawEllipse(r.center(), 4, 4);
        break;
    case BottomRight:
        p.drawEllipse(r.center(), 4, 4);
        break;
    }
}
