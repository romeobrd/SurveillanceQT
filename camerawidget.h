#pragma once

#include <QString>
#include <QWidget>

class QLabel;
class QProcess;
class QPushButton;
class QResizeEvent;
class QShowEvent;


// Widget qui affiche le flux vidéo RTSP d'une caméra en incrustant le
// lecteur externe mpv dans une surface native (option mpv --wid).
class CameraWidget : public QWidget
{
    Q_OBJECT

public:
    explicit CameraWidget(QWidget *parent = nullptr);
    ~CameraWidget() override;

    void setTitle(const QString &title);
    void setStreamUrl(const QString &url);

    void play();
    void stop();
    void reloadFrame();

    // Boutons récupérés par le dashboard pour partager le même style.
    QPushButton *closeButton() const;
    QPushButton *editButton() const;

protected:
    void showEvent(QShowEvent *event) override;
    void resizeEvent(QResizeEvent *event) override;

private:
    void buildUi();
    void scheduleStart(int delayMs = 250);
    void startWhenReady();
    void startMpv();
    bool isEmbeddingReady() const;

    QString m_title;
    QString m_streamUrl;
    QString m_mpvExecutable;

    QLabel      *m_titleLabel;
    QWidget     *m_videoSurface;   // surface native passée à mpv
    QPushButton *m_closeButton;
    QPushButton *m_editButton;
    QPushButton *m_reloadButton;
    QProcess    *m_mpvProcess;

    bool m_playRequested;   // l'utilisateur veut voir le flux
    int  m_startAttempts;   // tentatives de démarrage en attendant l'affichage Qt
};
