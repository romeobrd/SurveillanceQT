#include "authenticationdialog.h"

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QPushButton>
#include <QFrame>
#include <QPainter>
#include <QMessageBox>
#include <QApplication>
#include <QScreen>

AuthenticationDialog::AuthenticationDialog(DatabaseManager *dbManager, QWidget *parent)
    : QDialog(parent)
    , m_dbManager(dbManager)
    , m_usernameEdit(nullptr)
    , m_passwordEdit(nullptr)
    , m_loginButton(nullptr)
    , m_cancelButton(nullptr)
    , m_errorLabel(nullptr)
    , m_roleLabel(nullptr)
    , m_infoLabel(nullptr)
{
    setWindowTitle(QStringLiteral("Authentification"));
    setFixedSize(480, 520);
    // Frameless dialog centered on screen
    setWindowFlags(Qt::Window | Qt::FramelessWindowHint);
    setAttribute(Qt::WA_TranslucentBackground);

    setupUi();

    // Center on screen
    QRect screenGeometry = QApplication::primaryScreen()->geometry();
    move((screenGeometry.width() - width()) / 2,
         (screenGeometry.height() - height()) / 2);

    // Connect to database signals
    connect(m_dbManager, &DatabaseManager::authenticationFailed,
            this, &AuthenticationDialog::showError);
}

void AuthenticationDialog::setupUi()
{
    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setSpacing(0);
    mainLayout->setContentsMargins(0, 0, 0, 0);

    // Container with rounded corners
    auto *container = new QFrame(this);
    container->setObjectName(QStringLiteral("container"));
    container->setStyleSheet(
        "QFrame#container {"
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #1a1a2e, stop:1 #16213e);"
        "  border-radius: 16px;"
        "  border: 1px solid #2d3a5c;"
        "}"
        "QLabel { color: #eee; font-size: 14px; background: transparent; }"
        "QLineEdit {"
        "  background: #0f1628; color: #eee; border: 2px solid #2d3a5c;"
        "  border-radius: 8px; padding: 10px 14px; font-size: 14px;"
        "}"
        "QLineEdit:focus { border-color: #4a90d9; }"
        "QPushButton {"
        "  background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #4a90d9, stop:1 #357abd);"
        "  color: white; border: none; border-radius: 8px; padding: 11px 24px;"
        "  font-size: 14px; font-weight: 600; min-width: 140px;"
        "}"
        "QPushButton:hover { background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #5aa0e9, stop:1 #458acd); }"
        "QPushButton:pressed { background: #357abd; }"
        "QPushButton:disabled { background: #2a3550; color: #556; border: 1px solid #2d3a5c; }"
        "QPushButton#cancelBtn {"
        "  background: transparent; color: #888; border: 1px solid #2d3a5c;"
        "  min-width: 100px;"
        "}"
        "QPushButton#cancelBtn:hover { background: rgba(255,255,255,0.05); color: #aaa; }"
        );

    auto *containerLayout = new QVBoxLayout(container);
    containerLayout->setSpacing(18);
    containerLayout->setContentsMargins(40, 40, 40, 36);

    // ── Lock icon + Title ──────────────────────────────
    auto *lockIcon = new QLabel(QStringLiteral("🔒"), container);
    lockIcon->setStyleSheet("font-size: 48px; background: transparent;");
    lockIcon->setAlignment(Qt::AlignCenter);
    containerLayout->addWidget(lockIcon);

    auto *headerLabel = new QLabel(QStringLiteral("Système de Surveillance"), container);
    headerLabel->setStyleSheet("font-size: 22px; font-weight: 700; color: #4a90d9; background: transparent;");
    headerLabel->setAlignment(Qt::AlignCenter);
    containerLayout->addWidget(headerLabel);

    auto *subHeader = new QLabel(QStringLiteral("Authentification requise"), container);
    subHeader->setStyleSheet("font-size: 13px; color: #556; background: transparent;");
    subHeader->setAlignment(Qt::AlignCenter);
    containerLayout->addWidget(subHeader);

    // ── Separator ──────────────────────────────────────
    auto *sep = new QFrame(container);
    sep->setFrameShape(QFrame::HLine);
    sep->setStyleSheet("background: #2d3a5c; max-height: 1px; border: none;");
    containerLayout->addWidget(sep);

    // ── Error label ────────────────────────────────────
    m_errorLabel = new QLabel(container);
    m_errorLabel->setStyleSheet(
        "color: #e74c3c; font-size: 13px; padding: 8px 12px;"
        "background: rgba(231,76,60,0.12); border-radius: 6px;"
        "border: 1px solid rgba(231,76,60,0.3);");
    m_errorLabel->setAlignment(Qt::AlignCenter);
    m_errorLabel->setWordWrap(true);
    m_errorLabel->hide();
    containerLayout->addWidget(m_errorLabel);

    // ── Username ────────────────────────────────────────
    auto *userLabel = new QLabel(QStringLiteral("Nom d'utilisateur"), container);
    userLabel->setStyleSheet("font-size: 13px; color: #7ec8e3; font-weight: 600; background: transparent;");
    containerLayout->addWidget(userLabel);

    m_usernameEdit = new QLineEdit(container);
    m_usernameEdit->setPlaceholderText(QStringLiteral("Entrez votre identifiant…"));
    m_usernameEdit->setFixedHeight(42);
    connect(m_usernameEdit, &QLineEdit::textChanged, this, &AuthenticationDialog::onInputChanged);
    connect(m_usernameEdit, &QLineEdit::textChanged, this, &AuthenticationDialog::updateUserInfo);
    containerLayout->addWidget(m_usernameEdit);

    // ── Password ────────────────────────────────────────
    auto *passLabel = new QLabel(QStringLiteral("Mot de passe"), container);
    passLabel->setStyleSheet("font-size: 13px; color: #7ec8e3; font-weight: 600; background: transparent;");
    containerLayout->addWidget(passLabel);

    m_passwordEdit = new QLineEdit(container);
    m_passwordEdit->setEchoMode(QLineEdit::Password);
    m_passwordEdit->setPlaceholderText(QStringLiteral("Entrez votre mot de passe…"));
    m_passwordEdit->setFixedHeight(42);
    connect(m_passwordEdit, &QLineEdit::textChanged, this, &AuthenticationDialog::onInputChanged);
    connect(m_passwordEdit, &QLineEdit::returnPressed, this, &AuthenticationDialog::onLoginClicked);
    containerLayout->addWidget(m_passwordEdit);

    // ── Role hint ────────────────────────────────────────
    m_roleLabel = new QLabel(container);
    m_roleLabel->setStyleSheet("color: #4a90d9; font-size: 12px; font-style: italic; background: transparent;");
    m_roleLabel->hide();
    containerLayout->addWidget(m_roleLabel);

    // ── Buttons ──────────────────────────────────────────
    containerLayout->addSpacing(4);
    auto *buttonLayout = new QHBoxLayout();
    buttonLayout->setSpacing(12);

    m_cancelButton = new QPushButton(QStringLiteral("Quitter"), container);
    m_cancelButton->setObjectName(QStringLiteral("cancelBtn"));
    m_cancelButton->setFixedHeight(42);
    connect(m_cancelButton, &QPushButton::clicked, this, &AuthenticationDialog::onCancelClicked);
    buttonLayout->addWidget(m_cancelButton);

    m_loginButton = new QPushButton(QStringLiteral("Se connecter"), container);
    m_loginButton->setEnabled(false);
    m_loginButton->setFixedHeight(42);
    connect(m_loginButton, &QPushButton::clicked, this, &AuthenticationDialog::onLoginClicked);
    buttonLayout->addWidget(m_loginButton);

    containerLayout->addLayout(buttonLayout);

    // ── Default accounts info ────────────────────────────
    m_infoLabel = new QLabel(
        QStringLiteral("Comptes par défaut   |   admin · operateur · visiteur"),
        container);
    m_infoLabel->setStyleSheet(
        "color: #3a4c6e; font-size: 11px; background: transparent;");
    m_infoLabel->setAlignment(Qt::AlignCenter);
    containerLayout->addWidget(m_infoLabel);

    mainLayout->addWidget(container);
}

void AuthenticationDialog::onLoginClicked()
{
    clearError();

    QString username = m_usernameEdit->text().trimmed();
    QString password = m_passwordEdit->text();

    if (username.isEmpty() || password.isEmpty()) {
        showError(QStringLiteral("Veuillez remplir tous les champs"));
        return;
    }

    if (m_dbManager->authenticateUser(username, password)) {
        m_authenticatedUser = m_dbManager->getCurrentUser();
        accept();
    }
}

void AuthenticationDialog::onCancelClicked()
{
    reject();
}

void AuthenticationDialog::onInputChanged()
{
    bool hasInput = !m_usernameEdit->text().trimmed().isEmpty() &&
                    !m_passwordEdit->text().isEmpty();
    m_loginButton->setEnabled(hasInput);
    clearError();
}

void AuthenticationDialog::showError(const QString &message)
{
    m_errorLabel->setText(QStringLiteral("⚠  %1").arg(message));
    m_errorLabel->show();
}

void AuthenticationDialog::clearError()
{
    m_errorLabel->hide();
}

void AuthenticationDialog::updateUserInfo(const QString &username)
{
    if (username.isEmpty()) {
        m_roleLabel->hide();
        return;
    }

    User user = m_dbManager->getUser(username);
    if (!user.username.isEmpty()) {
        m_roleLabel->setText(QStringLiteral("  Rôle détecté : %1").arg(user.getRoleString()));
        m_roleLabel->show();
    } else {
        m_roleLabel->hide();
    }
}

User AuthenticationDialog::authenticatedUser() const
{
    return m_authenticatedUser;
}

void AuthenticationDialog::paintEvent(QPaintEvent *event)
{
    Q_UNUSED(event)
    // Transparent background for rounded corners effect
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.fillRect(rect(), Qt::transparent);
}
