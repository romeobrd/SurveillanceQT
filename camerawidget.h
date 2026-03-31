#pragma once

#include <QFrame>
#include <QPixmap>

class QLabel;
class QPushButton;

class CameraWidget : public QFrame
{
public:
    explicit CameraWidget(QWidget *parent = nullptr);

    QPushButton *editButton() const;
    QPushButton *closeButton() const;
    QPushButton *reloadButton() const;
    QPushButton *snapshotButton() const;
    QPushButton *fullscreenButton() const;

    QPixmap currentFrame() const;
    bool reloadFrame();

private:
    QLabel *m_imageLabel;
    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QPushButton *m_reloadButton;
    QPushButton *m_snapshotButton;
    QPushButton *m_fullscreenButton;
};
