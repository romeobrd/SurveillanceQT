#pragma once

#include <QtGlobal>

#if !defined(Q_OS_LINUX)
#error "CameraWidget is Linux-only. This minimal version intentionally removes Windows support."
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

    // Compatibility with the existing dashboard.
    // Any value passed here is ignored: the real stream is local.
    void setStreamUrl(const QString &url);
    QString streamUrl() const;

    void play();
    void stop();
    void reloadFrame();

    // Compatibility with old dashboard actions.
    QPixmap currentFrame() const;
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

    // Invisible compatibility buttons so dashboardwindow.cpp does not need changes.
    QPushButton *m_closeButton;
    QPushButton *m_editButton;
    QPushButton *m_reloadButton;
    QPushButton *m_snapshotButton;

    QProcess *m_mpvProcess;

    bool m_playRequested;
    bool m_stopping;
    int m_startAttempts;
};
