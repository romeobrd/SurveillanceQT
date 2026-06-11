#pragma once

#include <QString>
#include <QWidget>

class QLabel;
class QProcess;
class QPushButton;
class QResizeEvent;
class QShowEvent;

/**
 * CameraWidget — affichage du flux RTSP de la caméra de surveillance.
 *
 * La vidéo est lue par le lecteur externe "mpv", dont la fenêtre est
 * incrustée dans le widget grâce à l'option --wid (nécessite X11 :
 * le code force la plateforme Qt "xcb" si l'on est sous Wayland).
 */
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

    // Boutons exposés pour que le dashboard puisse s'y connecter
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
    void setStatus(const QString &text, bool error = false);
    bool ensureMpvAvailable();
    bool isEmbeddingReady() const;

    QString m_title;
    QString m_streamUrl;
    QString m_mpvExecutable;

    QLabel      *m_titleLabel;
    QLabel      *m_statusLabel;
    QWidget     *m_videoSurface;   // surface native dans laquelle mpv dessine
    QPushButton *m_closeButton;
    QPushButton *m_editButton;
    QPushButton *m_reloadButton;
    QProcess    *m_mpvProcess;

    bool m_playRequested;   // l'utilisateur veut voir le flux
    bool m_stopping;        // arrêt volontaire en cours (pas une erreur)
    int  m_startAttempts;   // tentatives en attendant que la surface soit prête
};
