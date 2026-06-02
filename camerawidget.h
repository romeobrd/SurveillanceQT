#pragma once

#include <QFrame>
#include <QPixmap>
#include <QString>

class QLabel;
class QPushButton;
class QWidget;
class QProcess;

class CameraWidget : public QFrame
{
    Q_OBJECT

public:
    explicit CameraWidget(QWidget *parent = nullptr);
    ~CameraWidget() override;

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
    void startMpv();
    void stopMpv();
    void toggleRecordingUi();

    QLabel *m_imageLabel;
    QLabel *m_titleLabel;
    QPushButton *m_editButton;
    QPushButton *m_closeButton;
    QPushButton *m_reloadButton;
    QPushButton *m_snapshotButton;
    QPushButton *m_fullscreenButton;
    QPushButton *m_recordButton;
    QWidget *m_videoWidget;
    QProcess *m_mpvProcess;

    QString m_streamUrl;
    QPixmap m_fallbackPixmap;
    bool m_isRecording;
};
