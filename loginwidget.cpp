#include "loginwidget.h"

#include <QApplication>
#include <QLabel>
#include <QLineEdit>
#include <QPushButton>
#include <QStyle>
#include <QVBoxLayout>

LoginWidget::LoginWidget(QWidget *parent)
    : QFrame(parent)
    , m_usernameEdit(new QLineEdit(this))
    , m_passwordEdit(new QLineEdit(this))
    , m_loginButton(new QPushButton(QStringLiteral("Connexion"), this))
{
    setObjectName(QStringLiteral("loginPanel"));
    setFixedWidth(320);
    setStyleSheet(
        "QFrame#loginPanel {"
        "  background: rgba(27, 49, 96, 0.88);"
        "  border: 1px solid rgba(116, 143, 196, 0.22);"
        "  border-radius: 18px;"
        "}"
        "QLabel#loginHeader {"
        "  color: #edf3ff;"
        "  font-size: 26px;"
        "  font-weight: 700;"
        "  padding: 18px 10px;"
        "  background: rgba(58, 90, 157, 0.55);"
        "  border-bottom: 1px solid rgba(142, 170, 215, 0.20);"
        "  border-top-left-radius: 18px;"
        "  border-top-right-radius: 18px;"
        "}"
        "QLineEdit {"
        "  min-height: 42px;"
        "  border-radius: 8px;"
        "  border: 1px solid rgba(255,255,255,0.06);"
        "  background: rgba(20, 34, 70, 0.58);"
        "  color: white;"
        "  font-size: 16px;"
        "  padding: 0 12px;"
        "}"
        "QPushButton {"
        "  min-height: 42px;"
        "  border-radius: 8px;"
        "  color: white;"
        "  font-size: 15px;"
        "  font-weight: 600;"
        "  border: 1px solid rgba(119, 162, 255, 0.42);"
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #4f9dff, stop:1 #356fdf);"
        "}"
        "QPushButton:hover {"
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #60abff, stop:1 #4179e4);"
        "}"
        );

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);

    auto *header = new QLabel(QStringLiteral("Connexion"), this);
    header->setObjectName(QStringLiteral("loginHeader"));
    header->setAlignment(Qt::AlignCenter);
    mainLayout->addWidget(header);

    auto *content = new QWidget(this);
    auto *contentLayout = new QVBoxLayout(content);
    contentLayout->setContentsMargins(26, 28, 26, 28);
    contentLayout->setSpacing(10);

    auto *userLabel = new QLabel(QStringLiteral("Nom d'utilisateur"), this);
    userLabel->setStyleSheet("color:#dfe8ff;font-size:16px;font-weight:600;");

    auto *passLabel = new QLabel(QStringLiteral("Mot de passe"), this);
    passLabel->setStyleSheet("color:#dfe8ff;font-size:16px;font-weight:600;margin-top:8px;");

    m_usernameEdit->setText(QStringLiteral("admin"));
    m_usernameEdit->addAction(qApp->style()->standardIcon(QStyle::SP_FileIcon), QLineEdit::LeadingPosition);

    m_passwordEdit->setEchoMode(QLineEdit::Password);
    m_passwordEdit->setText(QStringLiteral("123456"));
    m_passwordEdit->addAction(qApp->style()->standardIcon(QStyle::SP_MessageBoxWarning), QLineEdit::LeadingPosition);

    contentLayout->addSpacing(4);
    contentLayout->addWidget(userLabel);
    contentLayout->addWidget(m_usernameEdit);
    contentLayout->addWidget(passLabel);
    contentLayout->addWidget(m_passwordEdit);
    contentLayout->addSpacing(12);
    contentLayout->addWidget(m_loginButton);
    contentLayout->addStretch();

    mainLayout->addWidget(content, 1);

    QObject::connect(m_usernameEdit, &QLineEdit::returnPressed, m_loginButton, &QPushButton::click);
    QObject::connect(m_passwordEdit, &QLineEdit::returnPressed, m_loginButton, &QPushButton::click);
}

QString LoginWidget::username() const
{
    return m_usernameEdit->text();
}

QString LoginWidget::password() const
{
    return m_passwordEdit->text();
}

QPushButton *LoginWidget::loginButton() const
{
    return m_loginButton;
}
