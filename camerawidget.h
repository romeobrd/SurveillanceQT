#pragma once

#include <QPixmap>
#include <QString>
#include <QWidget>

class QLabel;
class QPushButton;
class QProcess;
class QShowEvent;
class QResizeEvent;

class CameraWidget : public QWidget
{
    Q_OBJECT

public:
    explicit CameraWidget(QWidget *parent = nullptr);
    ~CameraWidget() override;

    void setTitle(const QString &title);
    QString title() const;

    void setStreamUrl(const QString &url);
    QString streamUrl() const;

    void play();
    void stop();
    void reloadFrame();
    QPixmap currentFrame() const;

    QPushButton *closeButton() const;
    QPushButton *editButton() const;
    QPushButton *reloadButton() const;
    QPushButton *snapshotButton() const;

protected:
    void showEvent(QShowEvent *event) override;
    void resizeEvent(QResizeEvent *event) override;

private:
    void buildUi();
    void scheduleStart(int delayMs = 250);
    void startWhenReady();
    void startMpv();
    void setStatus(const QString &text, bool error = false);
    bool ensureMpvAvailable();
    QString mpvExecutable() const;
    bool isEmbeddingReady() const;

private:
    QString m_title;
    QString m_streamUrl;
    QString m_mpvExecutable;

    QLabel *m_titleLabel;
    QLabel *m_statusLabel;
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
