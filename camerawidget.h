#pragma once

#include <QFrame>
#include <QPixmap>

class QLabel;
class QPushButton;

class CameraWidget : public QFrame
{
    Q_OBJECT
public:
    explicit CameraWidget(QWidget *parent = nullptr);

    QPushButton *editButton() const;
    QPushButton *closeButton() const;
    QPushButton *reloadButton() const;
    QPushButton *snapshotButton() const;
    QPushButton *fullscreenButton() const;
    QPushButton *recordButton() const;

    QPixmap currentFrame() const;
    bool reloadFrame();
    bool isRecording() const;
    void setTitle(const QString &title);

    void setResizable(bool enabled);

private:
    QLabel *m_imageLabel;
    QLabel *m_titleLabel;
    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QPushButton *m_reloadButton;
    QPushButton *m_snapshotButton;
    QPushButton *m_fullscreenButton;
    QPushButton *m_recordButton;
    bool m_isRecording;
};
