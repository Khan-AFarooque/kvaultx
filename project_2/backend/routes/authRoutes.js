const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
    signup,
    getCaptcha,
    login,
    refreshToken,
    logout,
    forgotPassword,
    resetPassword,
    setupMFA,
    getLoginQr,
    verifyMFA,
    disableMFA,
    webauthnRegisterChallenge,
    webauthnRegisterVerify,
    webauthnLoginChallenge,
    webauthnLoginVerify,
    passkeySessionLogin,
    getSessions,
    revokeSession,
    getProfile,
    getSettings,
    updateSettings,
    reportAndBlockAccount,
    changePassword
} = require("../controllers/authController");

// Public auth routes
router.post("/signup", signup);
router.get("/captcha", getCaptcha);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/mfa/login-qr", getLoginQr);
router.get("/report-block", reportAndBlockAccount);
router.post("/report-block", reportAndBlockAccount);

// WebAuthn Public login routes
router.post("/webauthn/login-challenge", webauthnLoginChallenge);
router.post("/webauthn/login-verify", webauthnLoginVerify);
router.post("/passkey-session", passkeySessionLogin);

// Protected auth routes
router.post("/change-password", authMiddleware, changePassword);
router.post("/mfa/setup", authMiddleware, setupMFA);
router.post("/mfa/verify", authMiddleware, verifyMFA);
router.post("/mfa/disable", authMiddleware, disableMFA);

router.post("/webauthn/register-challenge", authMiddleware, webauthnRegisterChallenge);
router.post("/webauthn/register/challenge", authMiddleware, webauthnRegisterChallenge);
router.post("/webauthn/register-verify", authMiddleware, webauthnRegisterVerify);
router.post("/webauthn/register/verify", authMiddleware, webauthnRegisterVerify);

router.get("/sessions", authMiddleware, getSessions);
router.delete("/sessions/:id", authMiddleware, revokeSession);
router.get("/profile", authMiddleware, getProfile);
router.get("/settings", authMiddleware, getSettings);
router.post("/settings", authMiddleware, updateSettings);

module.exports = router;