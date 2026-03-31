#pragma once

#include <QFrame>

class QLineEdit;
class QPushButton;

class LoginWidget : public QFrame
{
public:
    explicit LoginWidget(QWidget *parent = nullptr);

    QString username() const;
    QString password() const;
    QPushButton *loginButton() const;

private:
    QLineEdit *m_usernameEdit;
    QLineEdit *m_passwordEdit;
    QPushButton *m_loginButton;
};
