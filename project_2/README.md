# 🔐 KvaultX — Zero-Knowledge Password Vault & Security Manager

> **Live Production App:** [https://kvaultx.onrender.com](https://kvaultx.onrender.com)

KvaultX is an enterprise-grade, zero-knowledge password manager and secure credential vault built with client-side & server-side **AES-256 GCM encryption**, **Multi-Factor Authentication (TOTP & Email OTP)**, **FIDO2 Hardware Passkeys**, and an **Interactive AI Password Auditor**.

---

## ✨ Features

- 🔒 **Zero-Knowledge Encryption:** Passwords and sensitive notes are encrypted with **AES-256 GCM** before or upon storage.
- 🔑 **Multi-Factor Authentication (2FA):**
  - **Authenticator App (TOTP):** Compatible with Google Authenticator, Authy, and Microsoft Authenticator.
  - **Email OTP Verification:** High-priority 6-digit OTP delivery for step-up security.
  - **Hardware Passkeys (WebAuthn / FIDO2):** Biometrics, Windows Hello, TouchID, and YubiKey support.
- 🤖 **Interactive AI Security Advisor:** Scans vault credentials for weak or reused passwords and auto-upgrades them to 32-character high-entropy keys.
- 🎨 **Modern Dark Glassmorphism UI:** Stunning responsive interface with smooth animations, search filters, and custom category management.
- 📄 **Legal & Privacy Standards:** Complete Terms & Conditions and Privacy Policy documentation.
- 🛡️ **Zero Log Leakage:** Plaintext OTP codes and sensitive keys are redacted from server logs.

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js, MongoDB Atlas (Mongoose)
- **Security & Crypto:** Bcrypt (10 salt rounds), AES-256-GCM Crypto API, JWT (Access & Refresh tokens)
- **Authentication:** WebAuthn (`@simplewebauthn`), TOTP (`otplib`), Cookie-parser
- **Transports:** Google Apps Script Webhook, Brevo HTTP API, Resend HTTP API, Nodemailer
- **Frontend:** Modern HTML5, Vanilla CSS3 (Glassmorphism), JavaScript (ES6+)

---

## 🚀 Environment Setup (`.env`)

Create a `.env` file in the backend directory with the following variables:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/kvaultx?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key
GMAIL_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
BREVO_API_KEY=your_brevo_api_key
EMAIL_USER=your_verified_email@gmail.com
```

---

## 💻 Installation & Running Locally

1. **Clone Repository:**
   ```bash
   git clone https://github.com/Khan-AFarooque/kvaultx.git
   cd kvaultx
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Start Local Development Server:**
   ```bash
   npm start
   ```

4. **Access Local Web Application:**
   Open `http://localhost:5000` in your web browser.

---

## 🛡️ License

This project is open-source and released under the **MIT License**.
