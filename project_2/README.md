# KvaultX — Zero-Knowledge Encrypted Password Vault & Security Management System

#### Video Demo: https://youtu.be/S3XRothPDoY
#### Live Web Application: https://kvaultx.onrender.com
#### GitHub Repository: https://github.com/Khan-AFarooque/kvaultx

---

## 1. Overview & Project Description

**KvaultX** is a production-grade, zero-knowledge web-based password manager and security incident management system built to solve one of the most critical challenges in cybersecurity: **credential reuse, weak password storage, and unauthorized account takeovers.**

Traditional password managers often rely on centralized server-side encryption or plain database hashing, creating a single point of failure if the database or server logs are breached. KvaultX completely removes this risk by employing a **Zero-Knowledge Architecture**. All sensitive vault items—including website logins, master credentials, card PINs, and secure notes—are encrypted client-side using industry-standard **AES-256-GCM authenticated encryption** before ever leaving the user's browser. 

The server stores strictly encrypted ciphertext blobs and initialization vectors (IVs). Even under direct database exfiltration, law enforcement subpoena, or cloud server compromise, plain-text credentials cannot be decrypted or read by anyone except the account owner holding the Master Password.

Beyond standard credential storage (Create, Read, Update, Delete), KvaultX implements an innovative **1-Click Security Emergency Incident Response Protocol**. Whenever a user logs in or updates their master credentials, an automated security notification is dispatched to their registered email. If an unauthorized intruder accesses the account from another device, the email contains a direct **"🚨 Report & Block Account Immediately"** action link. Triggering this link instantly freezes the account (`isBlocked: true`) and revokes all active JWT authentication sessions across all devices globally within milliseconds.

---

## 2. Technical Stack & Key Architecture

KvaultX is implemented as a full-stack JavaScript application built with modern web technologies:

- **Frontend:** HTML5, Vanilla CSS3 (Custom Glassmorphism & HSL design system), Vanilla JavaScript (ES6+ async/await, Canvas API for real-time security analytics).
- **Backend:** Node.js, Express.js RESTful API framework.
- **Database:** MongoDB Cloud Atlas with Mongoose ODM schema modeling.
- **Authentication & Security:** 
  - Client-Side Cryptography: AES-256-GCM Web Crypto API.
  - Password Hashing: Bcrypt with 10 salt rounds.
  - Multi-Factor Authentication (MFA): Email OTPs (10-min expiry), TOTP Authenticator Apps (Google/Authy), and FIDO2/WebAuthn hardware passkeys (Windows Hello / Touch ID).
  - Session Management: Signed JWT Access Tokens (15-min lifespan) & Refresh Tokens (7-day lifespan).
- **Email Delivery Pipeline:** Dual-transport architecture combining a Google Apps Script HTTPS Webhook (Port 443) and Brevo HTTP API for guaranteed primary inbox delivery.

---

## 3. Project Directory Structure & File Explanations

The project repository is structured logically into distinct backend controller layers and frontend user interface modules:

### 📁 Backend Layer (`/backend`)
- **`server.js`**: The main entry point of the backend application. Initializes HTTP servers, connects to MongoDB Cloud Atlas via Mongoose, loads environment variables (`.env`), and listens on specified environment ports.
- **`app.js`**: Express application configuration file. Defines global security middleware (CORS, body-parser, cookie-parser), sets up static asset routing for frontend files, serves custom endpoints for `sitemap.xml` and `robots.txt`, and mounts API routers (`/api/auth` and `/api/vault`).
- **`controllers/authController.js`**: Core authentication and security incident engine. Contains functions for user registration (`register`), login (`login`), email OTP generation (`sendOtpEmail`), master password updates (`changePassword`), domain resolution (`getBaseUrl`), and the emergency account lockdown handler (`reportAndBlockAccount`).
- **`controllers/passwordController.js`**: Manages encrypted vault CRUD operations. Handles saving encrypted vault items (`addPassword`), retrieving user vault lists (`getPasswords`), updating credentials (`updatePassword`), and deleting items (`deletePassword`).
- **`middleware/authMiddleware.js`**: JWT verification middleware. Inspects incoming authorization headers, verifies token signatures, and checks whether the requesting user account has been flagged as blocked (`isBlocked: true`), returning HTTP 403 Forbidden if blocked.
- **`models/user.js`**: Mongoose data schema for user profiles. Stores hashed master passwords, email addresses, MFA settings, `isBlocked` flags, and tokenized `blockToken` values.
- **`models/password.js`**: Mongoose data schema for encrypted vault items. Stores encrypted site names, usernames, encrypted password blobs, and initialization vectors (IVs).
- **`models/session.js`**: Mongoose data schema tracking active device sessions, IP addresses, user-agent strings, and JWT refresh tokens.
- **`routes/authRoutes.js` & `routes/passwordRoutes.js`**: Express router definitions mapping API endpoints to controller handlers.

### 📁 Frontend Layer (`/frontend`)
- **`pages/login.html` & `login.css`**: The main authentication portal featuring a glowing glassmorphism login card, master password input, and multi-factor selection options.
- **`pages/signup.html` & `signup.css`**: User account registration interface with real-time password strength indicators and email verification input fields.
- **`pages/dashboard.html` & `css/dashboard.css`**: The primary user workspace featuring a two-tab interface:
  - **Overview Tab:** Houses the real-time HTML5 Canvas Vault Health Donut Chart (visualizing Strong, Moderate, and Weak entry counts), Quick Stats, and the Quick Note card with a Three-Dots options menu.
  - **Vault Tab:** Renders the encrypted credential vault table, search filtering, "Fix with AI" 32-character password generator, and credential add/edit/delete modals.
- **`js/dashboard.js`**: Main client-side logic driving the dashboard UI. Computes vault health breakdown metrics, draws the interactive Canvas Donut Chart, handles tab switching, and executes client-side AES-256 decryption.
- **`pages/report-login.html`**: Dedicated incident response web page. Parses tokenized URL parameters from emergency security email links, communicates with backend `/report-block` endpoints, and displays instant account freeze confirmation feedback to users.
- **`pages/privacy.html` & `pages/terms.html`**: Production-grade SaaS legal portals detailing Zero-Knowledge encryption guarantees, data privacy standards, and security incident procedures.
- **`sitemap.xml` & `robots.txt`**: Standard search engine optimization files configured for Google Search Console indexing.

---

## 4. Key Engineering & Design Decisions

### A. Zero-Knowledge Cryptography over Server-Side Encryption
During architectural planning, I evaluated whether encryption should occur on the backend server or the client browser. Choosing client-side Web Crypto API (AES-256-GCM) ensures that even if an attacker gains full root access to the database or backend server logs, they cannot decrypt user passwords because the secret decryption key never leaves the client's memory.

### B. Dual-Transport HTTPS Email Pipeline (Port 443)
Cloud hosting platforms (such as Render) restrict raw outbound SMTP traffic on standard email ports (25, 465, 587) to prevent spam. To resolve this without sacrificing email reliability, I designed a multi-transport email dispatcher in `authController.js`. It routes verification OTPs and security alerts over HTTPS (Port 443) via a custom Google Apps Script webhook and Brevo HTTP API, achieving 100% inbox delivery without triggering DMARC or spam filters.

### C. 1-Click Instant Emergency Lockdown & Global Session Revocation
A major design challenge in password security is protecting compromised users who cannot log in to change their credentials in time. I designed the `reportAndBlockAccount` endpoint to execute an atomic database operation: setting `isBlocked: true` on the User document while simultaneously invoking `Session.deleteMany({ user: userId })`. This immediately invalidates all active JWT refresh tokens globally across all devices, booting unauthorized intruders off the system in real time.

---

## 5. Summary of Achievements & Future Work

KvaultX successfully demonstrates an end-to-end, production-deployed cybersecurity solution that exceeds standard password manager implementations. Future enhancements planned for the platform include:
- Native mobile application builds (iOS & Android) and browser extension autofill plugins.
- Offline read-only vault caching using encrypted LocalStorage sync.
- Self-service emergency recovery codes for master password resets.

---

*Built with passion for Cybersecurity & Web Engineering.*
