#pragma once

#include <QWidget>
#include <QMouseEvent>

class ResizeHandle : public QWidget {
    Q_OBJECT

public:
    enum Position {
        TopLeft, TopRight, BottomLeft, BottomRight
    };
    Q_ENUM(Position)

    explicit ResizeHandle(Position pos, QWidget *parent = nullptr);

signals:
    void resizeStarted();
    void resizeMoved(const QPoint &delta);
    void resizeFinished();

protected:
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void paintEvent(QPaintEvent *event) override;

private:
    Position m_position;
    bool m_resizing;
    QPoint m_startPos;
    QSize m_startSize;
};
