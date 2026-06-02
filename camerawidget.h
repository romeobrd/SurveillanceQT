#pragma once

#include <QFrame>
#include <QPixmap>
#include <QUrl>

class QLabel;
class QPushButton;
class QMediaPlayer;
class QVideoWidget;

class CameraWidget : public QFrame
{
    Q_OBJECT
public:
    explicit CameraWidget(QWidget *parent = nullptr);
    ~CameraWidget();

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
    void setStreamUrl(const QString &url);
    void play();
    void stop();

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

    // Media player for RTSP stream
    QMediaPlayer *m_mediaPlayer;
    QVideoWidget *m_videoWidget;
    QString m_streamUrl;
};
