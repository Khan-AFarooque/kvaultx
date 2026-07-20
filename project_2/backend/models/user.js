const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    // Email OTP for Forgot Password
    otp: {
        code: { type: String },
        expiry: { type: Date }
    },

    // Multi-Factor Authentication (TOTP)
    mfaEnabled: {
        type: Boolean,
        default: false
    },
    mfaSecret: {
        type: String
    },

    // Two-Factor Authentication Preference
    twoFactorMethod: {
        type: String,
        enum: ["disabled", "totp_passkey", "webauthn_passkey", "email_otp"],
        default: "disabled"
    },

    // Security Notification Preferences
    securityNotifications: {
        loginAlerts: { type: Boolean, default: true },
        leakAlerts: { type: Boolean, default: true }
    },

    // WebAuthn Credentials (Passkeys)
    credentials: [
        {
            credentialID: { type: String, required: true },
            credentialPublicKey: { type: String, required: true }, // Base64url encoded
            counter: { type: Number, default: 0 },
            transports: [{ type: String }]
        }
    ]
},
{
    timestamps: true
}
);

module.exports = mongoose.model("User", userSchema);