#pragma once

#include <QFrame>
#include <QTimer>
#include <QUrl>
#include <QProcess>

class QLabel;
class QPushButton;
class QMediaPlayer;
class QVideoWidget;

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

    // Stream control
    void setStreamUrl(const QString &url);
    QString streamUrl() const;
    void startStream();
    void stopStream();

    // Legacy (kept for dashboard compatibility)
    QPixmap currentFrame() const;
    bool reloadFrame();
    bool isRecording() const;
    void setTitle(const QString &title);
    void setResizable(bool enabled);

signals:
    void streamError(const QString &error);

private slots:
    void onPlayerStatusChanged();
    void onPlayerError();
    void onReconnectTimer();

private:
    void setStatus(const QString &text, const QString &color);
    void tryExternalPlayer();
    void onExternalPlayerFinished(int exitCode, QProcess::ExitStatus status);
    void onExternalPlayerError(QProcess::ProcessError error);
    bool checkGstreamerHlsSupport() const;

    QMediaPlayer   *m_player;
    QVideoWidget   *m_videoWidget;
    QLabel         *m_statusLabel;
    QLabel         *m_titleLabel;
    QPushButton    *m_editButton;
    QPushButton    *m_closeButton;
    QPushButton    *m_reloadButton;
    QPushButton    *m_snapshotButton;
    QPushButton    *m_fullscreenButton;
    QPushButton    *m_recordButton;
    bool            m_isRecording;
    bool            m_streamActive;
    QString         m_streamUrl;
    QTimer         *m_reconnectTimer;
    int             m_reconnectAttempts;
    QProcess       *m_externalPlayer;
    bool            m_useExternalPlayer;
    int             m_consecutiveErrors;
};
