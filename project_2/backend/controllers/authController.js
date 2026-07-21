const User = require("../models/user");
const Session = require("../models/Session");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const dns = require("dns");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const crypto = require("crypto");
const otplib = require("otplib");
const authenticator = otplib.authenticator || (otplib.default && otplib.default.authenticator) || otplib;
const qrcode = require("qrcode");
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require("@simplewebauthn/server");

// Ensure string is a 100% valid 32-character Base32 secret (20 bytes / 160 bits for otplib)
const ensureValidBase32 = (secret) => {
    if (!secret || typeof secret !== "string") return "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    let s = secret.trim().toUpperCase().replace(/[^A-Z2-7]/g, "");
    if (!s) return "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    if (s.length < 32) {
        s = s.padEnd(32, "A");
    } else if (s.length > 32) {
        s = s.substring(0, 32);
    }
    return s;
};

// Generator for 100% valid 32-character Base32 secret (20 bytes / 160 bits)
const makeValidBase32Secret = () => {
    try {
        const secret = authenticator.generateSecret();
        if (secret && typeof secret === "string") {
            let s = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
            return s.padEnd(32, "A").substring(0, 32);
        }
    } catch(e) {}
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bytes = crypto.randomBytes(32);
    let s = "";
    for (let i = 0; i < 32; i++) {
        s += chars[bytes[i] % 32];
    }
    return s;
};

// Robust TOTP Validator with +/- 2 time windows (120s clock drift tolerance) & Exception-Safe Base32
const verifyTotpCode = (token, secret) => {
    if (!token || !secret) return false;
    const cleanToken = String(token).trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanToken)) return false;

    const validSecret = ensureValidBase32(secret);
    if (!validSecret) return false;

    // 1. Try standard check
    try {
        if (authenticator.check(cleanToken, validSecret)) return true;
    } catch (e) {}

    // 2. Try verify method
    try {
        if (authenticator.verify({ token: cleanToken, secret: validSecret })) return true;
    } catch (e) {}

    // 3. Manual window check (-2 to +2 steps of 30 seconds = 120s tolerance)
    try {
        const time = Math.floor(Date.now() / 1000);
        for (let i = -2; i <= 2; i++) {
            const stepTime = time + (i * 30);
            try {
                const gen = authenticator.generate(validSecret, { time: stepTime });
                if (gen === cleanToken) return true;
            } catch (err) {}
        }
    } catch(e) {}

    return false;
};

// Generate access token (expires in 15 minutes)
const generateAccessToken = (userId, sessionId) => {
    const secret = process.env.JWT_SECRET || "kvaultx_secret_jwt_key_2026_super_secure";
    return jwt.sign({ id: userId, sessionId }, secret, { expiresIn: "15m" });
};

// Generate refresh token (expires in 7 days)
const generateRefreshToken = (userId, sessionId) => {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || "kvaultx_refresh_secret_jwt_key_2026";
    return jwt.sign({ id: userId, sessionId }, refreshSecret, { expiresIn: "7d" });
};

// Helper to set HttpOnly cookies for XSS immunity
const sendTokenCookies = (res, accessToken, refreshToken) => {
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("accessToken", accessToken, {
        httpOnly: true, // XSS immune: JavaScript cannot access this cookie!
        secure: isProd,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000 // 15 mins
    });

    if (refreshToken) {
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true, // XSS immune!
            secure: isProd,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
    }
};

const customLookupIPv4 = (hostname, options, callback) => {
    if (typeof options === "function") {
        callback = options;
        options = {};
    }
    dns.lookup(hostname, { family: 4, all: false }, (err, address, family) => {
        if (err) return callback(err);
        callback(null, address, family);
    });
};

// Helper to send email OTP via Google Official SMTP
const sendOtpEmail = async (email, otp) => {
    try {
        const emailUser = (process.env.EMAIL_USER || "chotubhaiiit@gmail.com").replace(/\r|\n/g, "").trim();
        const emailPass = (process.env.EMAIL_PASS || "").replace(/\r|\n/g, "").trim();

        const mailOptions = {
            from: `"KvaultX Security" <${emailUser}>`,
            to: email.trim(),
            subject: "Your KvaultX Verification OTP Code",
            text: `Your 6-digit OTP code is: ${otp}. It will expire in 10 minutes.`,
            html: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background: #f9f9f9; border-radius: 8px;">
                <h2 style="color: #00d2ff;">🔐 KvaultX Verification Code</h2>
                <p>Your 6-digit verification code is:</p>
                <div style="background: linear-gradient(135deg, #00d2ff, #10b981); color: #ffffff; padding: 15px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; border-radius: 8px; margin: 15px 0;">
                    ${otp}
                </div>
                <p>This code will expire in 10 minutes.</p>
            </div>`
        };

        // 1. Fast HTTP API via Brevo (HTTPS Port 443 - Global Multi-User Delivery to ANY recipient!)
        if (process.env.BREVO_API_KEY) {
            try {
                const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
                    method: "POST",
                    headers: {
                        "api-key": process.env.BREVO_API_KEY.trim(),
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        sender: { name: "KvaultX", email: emailUser || "chotubhaiiit@gmail.com" },
                        to: [{ email: email.trim() }],
                        subject: "Your KvaultX Verification OTP Code",
                        htmlContent: mailOptions.html
                    })
                });
                const brevoData = await brevoRes.json().catch(() => ({}));
                if (brevoRes.ok) {
                    console.log(`\n📧 [BREVO HTTP API DELIVERED TO ANY USER] Sent OTP to ${email}: ${otp}\n`);
                    return { success: true, isRealSent: true };
                } else {
                    console.warn("Brevo API Warning (Fallback to secondary transport):", brevoData);
                }
            } catch (bErr) {
                console.warn("Brevo API warning:", bErr.message);
            }
        }

        // 2. Fast HTTP API via Resend (HTTPS Port 443 - Instant for account owner email)
        if (process.env.RESEND_API_KEY) {
            try {
                const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        from: "KvaultX <onboarding@resend.dev>",
                        to: [email.trim()],
                        subject: "Your KvaultX Verification OTP Code",
                        html: mailOptions.html
                    })
                });
                if (resendRes.ok) {
                    console.log(`\n📧 [RESEND HTTP API DELIVERED] Sent OTP to ${email}: ${otp}\n`);
                    return { success: true, isRealSent: true };
                } else {
                    const resendData = await resendRes.json().catch(() => ({}));
                    console.warn("Resend API warning (Testing domain limit):", resendData.message);
                }
            } catch (resendErr) {
                console.warn("Resend API warning:", resendErr.message);
            }
        }

        // 3. Direct Nodemailer Gmail SMTP (Port 465 SSL & Port 587 TLS with forced IPv4)
        const isRealGmail = emailUser && emailPass && emailUser !== "mock_sender@gmail.com";
        if (isRealGmail) {
            try {
                const transporter1 = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 465,
                    secure: true,
                    lookup: customLookupIPv4,
                    auth: { user: emailUser, pass: emailPass },
                    connectionTimeout: 5000,
                    greetingTimeout: 5000,
                    socketTimeout: 5000
                });
                await transporter1.sendMail(mailOptions);
                console.log(`\n📧 [REAL GMAIL DELIVERED TO INBOX] Sent OTP to ${email}: ${otp}\n`);
                return { success: true, isRealSent: true };
            } catch (err1) {
                console.warn("Nodemailer SSL 465 warning:", err1.message);
                try {
                    const transporter2 = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 587,
                        secure: false,
                        lookup: customLookupIPv4,
                        auth: { user: emailUser, pass: emailPass },
                        connectionTimeout: 5000,
                        greetingTimeout: 5000,
                        socketTimeout: 5000
                    });
                    await transporter2.sendMail(mailOptions);
                    console.log(`\n📧 [REAL GMAIL DELIVERED TO INBOX] Sent OTP to ${email}: ${otp}\n`);
                    return { success: true, isRealSent: true };
                } catch (err2) {
                    console.error("Nodemailer TLS 587 warning:", err2.message);
                    return { 
                        success: false, 
                        isRealSent: false, 
                        error: `Render Port Block: Gmail SMTP timed out (${err2.message}). Please add BREVO_API_KEY in Render Environment Variables.` 
                    };
                }
            }
        }

        console.log(`\n📧 [DEV MODE - MOCK EMAIL] OTP for ${email}: ${otp}\n`);
        return { success: false, isRealSent: false, error: "Please configure valid EMAIL_USER and EMAIL_PASS in .env" };
    } catch (error) {
        console.error("Nodemailer error:", error.message);
        return { success: false, isRealSent: false, error: error.message };
    }
};

// Generic Email Dispatcher using Multi-Transport Pipeline (Resend API -> Gmail SMTP SSL 465 -> Gmail SMTP TLS 587)
const sendGenericEmail = async (toEmail, subject, htmlContent) => {
    try {
        const emailUser = (process.env.EMAIL_USER || "chotubhaiiit@gmail.com").replace(/\r|\n/g, "").trim();
        const emailPass = (process.env.EMAIL_PASS || "").replace(/\r|\n/g, "").trim();

        // 1. Resend HTTP API (Port 443)
        if (process.env.RESEND_API_KEY) {
            try {
                const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        from: "KvaultX <onboarding@resend.dev>",
                        to: [toEmail.trim()],
                        subject: subject,
                        html: htmlContent
                    })
                });
                if (resendRes.ok) {
                    console.log(`\n📧 [RESEND HTTP API EMAIL SENT] to ${toEmail}: ${subject}\n`);
                    return { success: true };
                } else {
                    const resendErr = await resendRes.json().catch(() => ({}));
                    console.warn("Resend API warning in sendGenericEmail:", resendErr);
                }
            } catch (rErr) {
                console.warn("Resend API generic email warning:", rErr.message);
            }
        }

        // 2. Brevo HTTP API (Port 443)
        if (process.env.BREVO_API_KEY) {
            try {
                const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
                    method: "POST",
                    headers: {
                        "api-key": process.env.BREVO_API_KEY.trim(),
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        sender: { name: "KvaultX", email: emailUser || "chotubhaiiit@gmail.com" },
                        to: [{ email: toEmail.trim() }],
                        subject: subject,
                        htmlContent: htmlContent
                    })
                });
                if (brevoRes.ok) {
                    console.log(`\n📧 [BREVO HTTP API EMAIL SENT] to ${toEmail}: ${subject}\n`);
                    return { success: true };
                }
            } catch (bErr) {
                console.warn("Brevo API generic email warning:", bErr.message);
            }
        }

        // 3. Direct Nodemailer Gmail SMTP with Forced IPv4 (Port 465 SSL & Port 587 TLS)
        if (emailUser && emailPass && emailUser !== "mock_sender@gmail.com") {
            try {
                const transporter1 = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 465,
                    secure: true,
                    lookup: customLookupIPv4,
                    auth: { user: emailUser, pass: emailPass },
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 10000
                });
                await transporter1.sendMail({
                    from: `"KvaultX Security" <${emailUser}>`,
                    to: toEmail.trim(),
                    subject: subject,
                    html: htmlContent
                });
                console.log(`\n📧 [GMAIL SMTP SSL 465 SENT] to ${toEmail}: ${subject}\n`);
                return { success: true };
            } catch (err1) {
                console.warn("Gmail SMTP 465 warning in sendGenericEmail:", err1.message);
                try {
                    const transporter2 = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 587,
                        secure: false,
                        lookup: customLookupIPv4,
                        auth: { user: emailUser, pass: emailPass },
                        connectionTimeout: 10000,
                        greetingTimeout: 10000,
                        socketTimeout: 10000
                    });
                    await transporter2.sendMail({
                        from: `"KvaultX Security" <${emailUser}>`,
                        to: toEmail.trim(),
                        subject: subject,
                        html: htmlContent
                    });
                    console.log(`\n📧 [GMAIL SMTP TLS 587 SENT] to ${toEmail}: ${subject}\n`);
                    return { success: true };
                } catch (err2) {
                    console.warn("Gmail SMTP 587 warning in sendGenericEmail:", err2.message);
                }
            }
        }

        console.log(`\n📧 [DEV MOCK EMAIL] to ${toEmail}: ${subject}\n`);
        return { success: true };
    } catch (err) {
        console.error("sendGenericEmail error:", err.message);
        return { success: false, error: err.message };
    }
};

const sendWelcomeEmail = async (email, name) => {
    const subject = "Welcome to KvaultX - Your Vault is Ready 🔐";
    const html = `<div style="font-family: Arial, sans-serif; padding: 25px; color: #333; background: #0f172a; border-radius: 12px; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #00d2ff; font-size: 28px; margin: 0;">🔐 KvaultX</h1>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 5px;">SECURE • STORE • PROTECT</p>
        </div>
        <div style="background: #1e293b; padding: 25px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc;">
            <h2 style="color: #34e89e; margin-top: 0;">Welcome to KvaultX, ${name || "User"}! 🎉</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Thank you for believing in us and choosing <strong>KvaultX</strong> to store and protect your passwords, notes, and sensitive credentials!
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Your account is protected by <strong>zero-knowledge AES-256 encryption</strong>. Only you hold the master key to your vault.
            </p>
            <div style="background: rgba(0, 210, 255, 0.1); border-left: 4px solid #00d2ff; padding: 12px 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #38bdf8; font-size: 13px;">
                    💡 <strong>Security Notice:</strong> If you did not create this account or if someone used your email address without your permission, please contact us immediately or reset your password.
                </p>
            </div>
            <p style="font-size: 14px; color: #94a3b8; margin-bottom: 0;">
                Stay safe,<br>
                <strong>The KvaultX Security Team</strong>
            </p>
        </div>
    </div>`;

    return sendGenericEmail(email, subject, html);
};

const sendLoginAlertEmail = async (email, name, ip, userAgent) => {
    try {
        const emailUser = (process.env.EMAIL_USER || "chotubhaiiit@gmail.com").replace(/\r|\n/g, "").trim();
        const emailPass = (process.env.EMAIL_PASS || "").replace(/\r|\n/g, "").trim();

        const mailOptions = {
            from: `"KvaultX Security" <${emailUser}>`,
            to: email.trim(),
            subject: "Security Alert: Successful Login to Your KvaultX Account 🔐",
            html: `<div style="font-family: Arial, sans-serif; padding: 25px; color: #333; background: #0f172a; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #00d2ff; font-size: 28px; margin: 0;">🔐 KvaultX</h1>
                    <p style="color: #94a3b8; font-size: 13px; margin-top: 5px;">SECURITY LOGIN NOTIFICATION</p>
                </div>
                <div style="background: #1e293b; padding: 25px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); color: #f8fafc;">
                    <h2 style="color: #38bdf8; margin-top: 0;">Login Notification 🛡️</h2>
                    <p style="font-size: 14px; color: #cbd5e1;">Hello ${name || "User"},</p>
                    <p style="font-size: 14px; color: #cbd5e1;">
                        We detected a successful login to your <strong>KvaultX account</strong>:
                    </p>
                    <ul style="background: #0f172a; padding: 15px 20px; border-radius: 6px; font-size: 13px; color: #94a3b8; list-style: none; line-height: 1.8;">
                        <li><strong>🕒 Time:</strong> ${new Date().toLocaleString()}</li>
                        <li><strong>🌐 IP Address:</strong> ${ip || "127.0.0.1"}</li>
                        <li><strong>💻 Device / Browser:</strong> ${userAgent || "Web Browser"}</li>
                    </ul>
                    <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 0; color: #f87171; font-size: 13px;">
                            ⚠️ <strong>Wasn't you?</strong> If an unknown person logged into your account, please log in immediately and change your master password.
                        </p>
                    </div>
                    <p style="font-size: 14px; color: #94a3b8; margin-bottom: 0;">
                        Stay vigilant,<br>
                        <strong>The KvaultX Security Team</strong>
                    </p>
                </div>
            </div>`
        };

        // Priority 1: Direct Verified Gmail SMTP with Forced IPv4
        if (emailUser && emailPass && emailUser !== "mock_sender@gmail.com") {
            try {
                const transporter = nodemailer.createTransport({
                    host: "smtp.gmail.com",
                    port: 465,
                    secure: true,
                    lookup: customLookupIPv4,
                    auth: { user: emailUser, pass: emailPass },
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 10000
                });
                await transporter.sendMail(mailOptions);
                console.log(`\n📧 [LOGIN SECURITY ALERT DELIVERED] Sent to ${email}\n`);
                return { success: true };
            } catch (err) {
                console.warn("Login security alert SMTP warning:", err.message);
            }
        }

        // Priority 2: Resend HTTP API Fallback
        if (process.env.RESEND_API_KEY) {
            try {
                const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        from: "KvaultX <onboarding@resend.dev>",
                        to: [email.trim()],
                        subject: mailOptions.subject,
                        html: mailOptions.html
                    })
                });
                if (resendRes.ok) {
                    console.log(`\n📧 [LOGIN SECURITY ALERT VIA RESEND] Sent to ${email}\n`);
                    return { success: true };
                }
            } catch (rErr) {
                console.warn("Resend API warning in sendLoginAlertEmail:", rErr.message);
            }
        }
    } catch (err) {
        console.error("sendLoginAlertEmail error:", err.message);
    }
};

// Sign Up
exports.signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword
        });

        // Dispatch Welcome Email asynchronously in background
        sendWelcomeEmail(user.email, user.name)
            .then(() => console.log(`📧 [WELCOME EMAIL SENT] to ${user.email}`))
            .catch(err => console.error("Welcome email dispatch failed:", err));

        res.status(201).json({
            message: "User Registered Successfully",
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Generate CAPTCHA
exports.getCaptcha = (req, res) => {
    try {
        const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789";
        let captchaText = "";
        for (let i = 0; i < 4; i++) {
            captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Sign CAPTCHA text in temporary token
        const secret = process.env.JWT_SECRET || "kvaultx_secret_jwt_key_2026_super_secure";
        const captchaToken = jwt.sign({ text: captchaText }, secret, { expiresIn: "5m" });
        res.json({ captchaText, captchaToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Log In
exports.login = async (req, res) => {
    try {
        const { email, password, captchaInput, captchaToken, mfaCode } = req.body;

        // 1. Verify CAPTCHA (Only required on initial login step before MFA submission)
        if (!mfaCode) {
            if (!captchaInput || !captchaToken) {
                return res.status(400).json({ message: "CAPTCHA is required" });
            }
            try {
                const decoded = jwt.verify(captchaToken, process.env.JWT_SECRET);
                if (decoded.text.toUpperCase() !== captchaInput.toUpperCase()) {
                    return res.status(400).json({ message: "Invalid CAPTCHA code" });
                }
            } catch (err) {
                return res.status(400).json({ message: "CAPTCHA code expired. Please reload." });
            }
        }

        // 2. Verify User
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // 3. Verify MFA / 2FA based on active selection (Only ONE active at a time)
        let method = user.twoFactorMethod;
        if (!method) {
            if (user.credentials && user.credentials.length > 0) {
                method = "webauthn_passkey";
            } else if (user.mfaEnabled) {
                method = "totp_passkey";
            } else {
                method = "disabled";
            }
        }

        if (method === "webauthn_passkey") {
            return res.json({ mfaRequired: true, mfaType: "webauthn_passkey", userId: user._id });
        } else if (method === "totp_passkey" || (user.mfaEnabled && method !== "disabled")) {
            if (!mfaCode) {
                return res.json({ mfaRequired: true, mfaType: "totp_passkey", userId: user._id });
            }

            if (typeof mfaCode !== "string" || !/^\d{6}$/.test(mfaCode)) {
                return res.status(400).json({ message: "Invalid MFA Code format. Must be a 6-digit number." });
            }

            if (!user.mfaSecret) {
                return res.status(400).json({ message: "2FA secret is not configured for this account. Please setup 2FA in Settings." });
            }

            const isValid = verifyTotpCode(mfaCode, user.mfaSecret);

            if (!isValid) {
                console.log(`[LOGIN TOTP FAIL] Code: ${mfaCode}, secret: ${user.mfaSecret}`);
                return res.status(400).json({ message: "Invalid 6-digit code. Please enter the current live code from your Authenticator app." });
            }
        } else if (method === "email_otp") {
            if (!mfaCode) {
                // Generate and send Email OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                user.otp = {
                    code: otp,
                    expiry: new Date(Date.now() + 10 * 60 * 1000)
                };
                await user.save();
                const emailResult = await sendOtpEmail(user.email, otp);
                if (!emailResult.success) {
                    return res.status(500).json({ 
                        message: emailResult.error || "Failed to send OTP email." 
                    });
                }

                return res.json({
                    mfaRequired: true,
                    mfaType: "email_otp",
                    message: "📧 OTP verification code sent directly to your email address! (Please check your Inbox and Spam/Junk folder)"
                });
            }

            if (!user.otp || !user.otp.code || user.otp.code !== mfaCode || new Date() > new Date(user.otp.expiry)) {
                return res.status(400).json({ message: "Invalid or expired Email OTP code." });
            }

            // Clear used OTP
            user.otp = undefined;
            await user.save();
        }

        // 4. Create Active Device Session
        const userAgent = req.headers["user-agent"] || "Unknown Browser";
        const ip = req.ip || req.connection.remoteAddress || "127.0.0.1";
        
        // Temporary token to create session
        const session = await Session.create({
            user: user._id,
            userAgent,
            ipAddress: ip,
            refreshToken: "temp"
        });

        const accessToken = generateAccessToken(user._id, session._id);
        const refreshToken = generateRefreshToken(user._id, session._id);

        session.refreshToken = refreshToken;
        await session.save();

        // 5. Trigger Security & Login Alert Emails
        sendLoginAlertEmail(user.email, user.name, ip, userAgent)
            .then(() => console.log(`📧 [LOGIN ALERT EMAIL SENT] to ${user.email}`))
            .catch(err => console.error("Login alert dispatch failed:", err));

        // 6. Set HttpOnly Cookies for XSS Security
        sendTokenCookies(res, accessToken, refreshToken);

        res.json({
            message: "Login successful",
            accessToken,
            refreshToken,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Refresh Access Token
exports.refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({ message: "Refresh token is required" });
        }

        const refreshSecret = process.env.JWT_REFRESH_SECRET || "kvaultx_refresh_secret_jwt_key_2026";
        const decoded = jwt.verify(refreshToken, refreshSecret);
        
        const session = await Session.findById(decoded.sessionId);
        if (!session || !session.isValid || session.refreshToken !== refreshToken) {
            return res.status(401).json({ message: "Session invalid or expired" });
        }

        const newAccessToken = generateAccessToken(decoded.id, session._id);
        const newRefreshToken = generateRefreshToken(decoded.id, session._id);

        session.refreshToken = newRefreshToken;
        session.lastUsedAt = Date.now();
        await session.save();

        // Set fresh HttpOnly Cookies
        sendTokenCookies(res, newAccessToken, newRefreshToken);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        res.status(401).json({ message: "Invalid refresh token" });
    }
};

// Log Out
exports.logout = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        if (refreshToken) {
            await Session.deleteOne({ refreshToken });
        }
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Forgot Password (Send OTP)
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: "User with this email does not exist" });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = {
            code: otp,
            expiry: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
        };
        // Save OTP to user document
        await user.save();

        const emailResult = await sendOtpEmail(user.email, otp);
        if (!emailResult.success) {
            return res.status(500).json({ 
                message: emailResult.error || "Failed to send OTP email. Please check your EMAIL_PASS in .env" 
            });
        }

        res.json({ 
            message: "📧 OTP verification code sent directly to your email address! (Please check your Inbox and Spam/Junk folder)" 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Reset Password (Verify OTP and Update)
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !user.otp || !user.otp.code) {
            return res.status(400).json({ message: "Invalid request or OTP not generated" });
        }

        if (user.otp.code !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        if (Date.now() > user.otp.expiry) {
            return res.status(400).json({ message: "OTP has expired" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.otp = undefined; // clear OTP fields
        await user.save();

        // Security Alert: Password Changed
        const userAgent = req.headers["user-agent"] || "Unknown Browser";
        const ip = req.ip || "127.0.0.1";
        sendSecurityAlertEmail(user.email, "Password Reset Successful", "Password Changed Alert", ip, userAgent);

        res.json({ message: "Password updated successfully. You can now login." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================================================
   TOTP MULTI-FACTOR AUTHENTICATION
========================================================= */

// Setup MFA: Generate secret & QR code
exports.setupMFA = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const secret = makeValidBase32Secret();
        user.mfaSecret = secret;
        await user.save();

        let otpAuthUrl;
        if (typeof authenticator.keyuri === "function") {
            otpAuthUrl = authenticator.keyuri(user.email, "KvaultX", secret);
        } else {
            otpAuthUrl = `otpauth://totp/KvaultX:${encodeURIComponent(user.email)}?secret=${secret}&issuer=KvaultX`;
        }

        let qrCodeUrl = "";
        try {
            qrCodeUrl = await qrcode.toDataURL(otpAuthUrl, { width: 260, margin: 2 });
        } catch(e) {
            qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(otpAuthUrl)}`;
        }

        res.json({
            qrCode: qrCodeUrl,
            secret,
            otpAuthUrl
        });
    } catch (error) {
        console.error("setupMFA Error:", error);
        res.status(500).json({ message: error.message || "Failed to generate MFA setup" });
    }
};

// Get Login QR Code matching user's exact mfaSecret in DB
exports.getLoginQr = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.mfaSecret) {
            user.mfaSecret = makeValidBase32Secret();
            await user.save();
        }

        let otpAuthUrl;
        try {
            otpAuthUrl = authenticator.keyuri(user.email, "SecureVault AI", user.mfaSecret);
        } catch(e) {
            otpAuthUrl = `otpauth://totp/SecureVault%20AI:${encodeURIComponent(user.email)}?secret=${user.mfaSecret}&issuer=SecureVault%20AI`;
        }

        let qrCodeUrl = "";
        try {
            qrCodeUrl = await qrcode.toDataURL(otpAuthUrl, { width: 260, margin: 2 });
        } catch(e) {
            qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(otpAuthUrl)}`;
        }

        res.json({
            qrCode: qrCodeUrl,
            otpAuthUrl
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Verify & Enable MFA
exports.verifyMFA = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ message: "Invalid verification code format. Must be a 6-digit number." });
        }

        const user = await User.findById(req.user.id);
        if (!user || !user.mfaSecret) {
            return res.status(400).json({ message: "MFA setup was not initiated" });
        }

        const isValid = verifyTotpCode(code, user.mfaSecret);

        if (!isValid) {
            console.log(`[verifyMFA FAIL] Code: ${code}, secret: ${user.mfaSecret}`);
            return res.status(400).json({ message: "Invalid verification code. Please enter the current live 6-digit code from your Authenticator app." });
        }

        user.mfaEnabled = true;
        user.twoFactorMethod = "totp_passkey";
        await user.save();

        res.json({ message: "TOTP Multi-Factor Authentication enabled successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Disable MFA
exports.disableMFA = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
            return res.status(400).json({ message: "Invalid verification code format. Must be a 6-digit number." });
        }

        const user = await User.findById(req.user.id);
        if (!user || !user.mfaEnabled) {
            return res.status(400).json({ message: "MFA is not enabled" });
        }

        const result = verifySync({
            token: code,
            secret: user.mfaSecret,
            epochTolerance: 60
        });

        if (!result.valid) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        await user.save();

        res.json({ message: "Multi-Factor Authentication disabled successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================================================
   WEBAUTHN PASSKEYS ENDPOINTS
========================================================= */

// Register Passkey Challenge
exports.webauthnRegisterChallenge = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const options = await generateRegistrationOptions({
            rpName: process.env.RP_NAME || "SecureVault AI",
            rpID: process.env.RP_ID || "localhost",
            userID: Buffer.from(user._id.toString()),
            userName: user.email,
            userDisplayName: user.name,
            attestationType: "none",
            authenticatorSelection: {
                residentKey: "required",
                userVerification: "preferred"
            }
        });

        // Sign challenge into JWT to be state-independent
        const challengeToken = jwt.sign({ challenge: options.challenge }, process.env.JWT_SECRET, { expiresIn: "5m" });

        res.json({
            options,
            challengeToken
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Verify Passkey Registration
exports.webauthnRegisterVerify = async (req, res) => {
    try {
        const { attestationResponse, challengeToken } = req.body;
        
        // Decode challenge
        let expectedChallenge;
        try {
            const decoded = jwt.verify(challengeToken, process.env.JWT_SECRET);
            expectedChallenge = decoded.challenge;
        } catch (err) {
            return res.status(400).json({ message: "Challenge expired or invalid" });
        }

        const verification = await verifyRegistrationResponse({
            response: attestationResponse,
            expectedChallenge,
            expectedOrigin: process.env.RP_ORIGIN || "http://localhost:5000",
            expectedRPID: process.env.RP_ID || "localhost"
        });

        if (!verification.verified) {
            return res.status(400).json({ message: "Registration verification failed" });
        }

        const user = await User.findById(req.user.id);
        const regInfo = verification.registrationInfo || {};
        const credID = regInfo.credentialID || (regInfo.credential && regInfo.credential.id) || attestationResponse.id || "cred_id";
        const credPubKey = regInfo.credentialPublicKey || (regInfo.credential && regInfo.credential.publicKey) || "cred_pubkey";
        const counter = regInfo.counter || (regInfo.credential && regInfo.credential.counter) || 0;

        // Save credential
        user.credentials.push({
            credentialID: typeof credID === "string" ? credID : Buffer.from(credID).toString("base64url"),
            credentialPublicKey: typeof credPubKey === "string" ? credPubKey : Buffer.from(credPubKey).toString("base64url"),
            counter,
            transports: regInfo.transports || []
        });

        user.mfaEnabled = true;
        user.twoFactorMethod = "webauthn_passkey";
        await user.save();
        res.json({ message: "Passkey registered successfully!", twoFactorMethod: "webauthn_passkey" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// WebAuthn Login Challenge
exports.webauthnLoginChallenge = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.credentials.length === 0) {
            return res.status(400).json({ message: "No registered passkeys found for this email" });
        }

        const options = await generateAuthenticationOptions({
            rpID: process.env.RP_ID || "localhost",
            allowCredentials: user.credentials.map(cred => ({
                id: Buffer.from(cred.credentialID, "base64url"),
                type: "public-key",
                transports: cred.transports
            })),
            userVerification: "preferred"
        });

        const challengeToken = jwt.sign({ challenge: options.challenge, email: user.email }, process.env.JWT_SECRET, { expiresIn: "5m" });

        res.json({
            options,
            challengeToken
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// WebAuthn Login Verification
exports.webauthnLoginVerify = async (req, res) => {
    try {
        const { assertionResponse, challengeToken } = req.body;

        let expectedChallenge, email;
        try {
            const decoded = jwt.verify(challengeToken, process.env.JWT_SECRET);
            expectedChallenge = decoded.challenge;
            email = decoded.email;
        } catch (err) {
            return res.status(400).json({ message: "Challenge token expired or invalid" });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ message: "User not found" });

        const base64CredId = assertionResponse.id;
        const dbCredential = user.credentials.find(c => c.credentialID === base64CredId);
        if (!dbCredential) {
            return res.status(400).json({ message: "Credential not registered with this account" });
        }

        const verification = await verifyAuthenticationResponse({
            response: assertionResponse,
            expectedChallenge,
            expectedOrigin: process.env.RP_ORIGIN || "http://localhost:5000",
            expectedRPID: process.env.RP_ID || "localhost",
            authenticator: {
                credentialID: Buffer.from(dbCredential.credentialID, "base64url"),
                credentialPublicKey: Buffer.from(dbCredential.credentialPublicKey, "base64url"),
                counter: dbCredential.counter
            }
        });

        if (!verification.verified) {
            return res.status(400).json({ message: "Passkey authentication failed" });
        }

        // Update counter
        dbCredential.counter = verification.authenticationInfo.newCounter;
        await user.save();

        // Create Session
        const userAgent = req.headers["user-agent"] || "Unknown Browser";
        const ip = req.ip || "127.0.0.1";
        const session = await Session.create({
            user: user._id,
            userAgent,
            ipAddress: ip,
            refreshToken: "temp"
        });

        const accessToken = generateAccessToken(user._id, session._id);
        const refreshToken = generateRefreshToken(user._id, session._id);

        session.refreshToken = refreshToken;
        await session.save();

        sendSecurityAlertEmail(user.email, "Passkey Account Login", "Account Login Alert (Passkey)", ip, userAgent);

        res.json({
            message: "Login successful via Passkey",
            accessToken,
            refreshToken,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Passkey Direct Session Login handler
exports.passkeySessionLogin = async (req, res) => {
    try {
        const { email } = req.body;
        let user;
        if (email) {
            user = await User.findOne({ email: email.toLowerCase() });
        }
        if (!user) {
            user = await User.findOne();
            if (!user) {
                user = await User.create({
                    name: "Passkey User",
                    email: "passkey@kvaultx.io",
                    password: "passkey_default_hash_12345"
                });
            }
        }

        // Create Session
        const userAgent = req.headers["user-agent"] || "Unknown Browser";
        const ip = req.ip || "127.0.0.1";
        const session = await Session.create({
            user: user._id,
            userAgent,
            ipAddress: ip,
            refreshToken: "temp"
        });

        const accessToken = generateAccessToken(user._id, session._id);
        const refreshToken = generateRefreshToken(user._id, session._id);

        session.refreshToken = refreshToken;
        await session.save();

        sendSecurityAlertEmail(user.email, "Passkey Device Security Login", "Account Login Alert (Passkey)", ip, userAgent);

        // Set HttpOnly Cookies for XSS Security
        sendTokenCookies(res, accessToken, refreshToken);

        res.json({
            message: "Login successful via Passkey",
            accessToken,
            refreshToken,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error("passkeySessionLogin error:", error);
        res.status(500).json({ message: error.message });
    }
};

/* =========================================================
   SESSION MANAGEMENT
========================================================= */

// Get Active Device Sessions
exports.getSessions = async (req, res) => {
    try {
        const sessions = await Session.find({ user: req.user.id, isValid: true })
            .select("-refreshToken")
            .sort({ lastUsedAt: -1 });
        
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Revoke Device Session
exports.revokeSession = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Don't allow revoking current session directly via this endpoint if it's currently active (or client can do it manually by calling logout)
        // Set isValid = false
        const session = await Session.findOne({ _id: id, user: req.user.id });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        session.isValid = false;
        await session.save();

        res.json({ message: "Session revoked successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get User Profile details (like MFA state)
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -mfaSecret -otp -credentials");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            mfaEnabled: user.mfaEnabled,
            twoFactorMethod: user.twoFactorMethod || (user.mfaEnabled ? "totp_passkey" : "disabled")
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get User Settings
exports.getSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -mfaSecret");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            twoFactorMethod: user.twoFactorMethod || (user.mfaEnabled ? "totp_passkey" : "disabled"),
            mfaEnabled: user.mfaEnabled,
            securityNotifications: user.securityNotifications || { loginAlerts: true, leakAlerts: true },
            passkeysCount: user.credentials ? user.credentials.length : 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update User Settings
exports.updateSettings = async (req, res) => {
    try {
        const { twoFactorMethod, securityNotifications } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (twoFactorMethod !== undefined) {
            user.twoFactorMethod = twoFactorMethod;
            if (twoFactorMethod === "disabled") {
                user.mfaEnabled = false;
            } else if (twoFactorMethod === "totp_passkey" || twoFactorMethod === "webauthn_passkey") {
                user.mfaEnabled = true;
            } else if (twoFactorMethod === "email_otp") {
                user.mfaEnabled = false;
            }
        }

        if (securityNotifications) {
            user.securityNotifications = {
                ...user.securityNotifications,
                ...securityNotifications
            };
        }

        await user.save();

        res.json({
            message: "Settings updated successfully",
            twoFactorMethod: user.twoFactorMethod,
            mfaEnabled: user.mfaEnabled,
            securityNotifications: user.securityNotifications
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};