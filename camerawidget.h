#pragma once

#ifndef Q_OS_LINUX
#error "CameraWidget minimal is Linux-only. This version intentionally removes Windows support."
#endif

#include <QPixmap>
#include <QString>
#include <QWidget>

class QHideEvent;
class QProcess;
class QPushButton;
class QResizeEvent;
class QShowEvent;

class CameraWidget : public QWidget
{
    Q_OBJECT

public:
    explicit CameraWidget(QWidget *parent = nullptr);
    ~CameraWidget() override;

    void setTitle(const QString &title);
    QString title() const;

    // Compatibility method: the dashboard may pass an IP, but the real stream is local.
    // This widget always uses rtsp://127.0.0.1:8554/rascam.
    void setStreamUrl(const QString &url);
    QString streamUrl() const;

    void play();
    void stop();

    // Kept only to avoid breaking dashboard connections. No visible reload button exists.
    void reloadFrame();

    // Kept only for compatibility with existing dashboard code.
    QPixmap currentFrame() const;

    // Hidden compatibility buttons. They exist so dashboardwindow.cpp does not need changes,
    // but the UI shows only the video surface.
    QPushButton *closeButton() const;
    QPushButton *editButton() const;
    QPushButton *reloadButton() const;
    QPushButton *snapshotButton() const;

protected:
    void showEvent(QShowEvent *event) override;
    void hideEvent(QHideEvent *event) override;
    void resizeEvent(QResizeEvent *event) override;

private:
    void buildUi();
    void scheduleStart(int delayMs = 250);
    void startWhenReady();
    void startMpv();

    QString mpvExecutable() const;
    bool ensureMpvAvailable();
    bool isEmbeddingReady() const;

private:
    QString m_title;
    QString m_streamUrl;
    QString m_mpvExecutable;

    QWidget *m_videoSurface;
    QPushButton *m_closeButton;
    QPushButton *m_editButton;
    QPushButton *m_reloadButton;
    QPushButton *m_snapshotButton;
    QProcess *m_mpvProcess;

    bool m_playRequested;
    bool m_stopping;
    int m_startAttempts;
};
