#pragma once

#include "databasemanager.h"

#include <QDialog>
#include <QApplication>
#include <QScreen>

class QLineEdit;
class QLabel;
class QPushButton;
class QComboBox;

class AuthenticationDialog : public QDialog {
    Q_OBJECT

public:
    explicit AuthenticationDialog(DatabaseManager *dbManager, QWidget *parent = nullptr);

    User authenticatedUser() const;

protected:
    void paintEvent(QPaintEvent *event) override;

private slots:
    void onLoginClicked();
    void onCancelClicked();
    void onInputChanged();

private:
    void setupUi();
    void showError(const QString &message);
    void clearError();
    void updateUserInfo(const QString &username);

    DatabaseManager *m_dbManager;
    QLineEdit *m_usernameEdit;
    QLineEdit *m_passwordEdit;
    QPushButton *m_loginButton;
    QPushButton *m_cancelButton;
    QLabel *m_errorLabel;
    QLabel *m_roleLabel;
    QLabel *m_infoLabel;

    User m_authenticatedUser;
};
