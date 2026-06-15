#pragma once

#include <QString>
#include <QWidget>

class QLabel;
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
    void setStreamUrl(const QString &url);

    void play();
    void stop();
    void reloadFrame();

    // Bouton recuperer du dashboard pour avoir le meme style
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
    QWidget     *m_videoSurface;   // natif a mvp
    QPushButton *m_closeButton;
    QPushButton *m_editButton;
    QPushButton *m_reloadButton;
    QProcess    *m_mpvProcess;

    bool m_playRequested;   // Pour voir le flux
    bool m_stopping;        // Arret volontaire -> pas d'ereur
    int  m_startAttempts;   // tentative de démaragge
};
