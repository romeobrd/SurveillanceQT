#pragma once

#include <QFrame>
#include <QMouseEvent>

class QPushButton;

class ResizableContainer : public QFrame {
    Q_OBJECT

public:
    explicit ResizableContainer(QWidget *contentWidget, QWidget *parent = nullptr);

    void setResizable(bool enabled);
    void setMinSize(const QSize &size);
    void setMaxSize(const QSize &size);

protected:
    void resizeEvent(QResizeEvent *event) override;
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;

private:
    void updateResizeHandles();
    void updateCursor(const QPoint &pos);

    QWidget *m_contentWidget;
    QPushButton *m_resizeHandle;

    bool m_resizable;
    bool m_resizing;
    QPoint m_resizeStartPos;
    QSize m_resizeStartSize;
    QSize m_minSize;
    QSize m_maxSize;
};
