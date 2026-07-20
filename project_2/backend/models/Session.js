const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    userAgent: {
        type: String,
        default: "Unknown"
    },
    ipAddress: {
        type: String,
        default: "Unknown"
    },
    refreshToken: {
        type: String,
        required: true
    },
    isValid: {
        type: Boolean,
        default: true
    },
    lastUsedAt: {
        type: Date,
        default: Date.now
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model("Session", sessionSchema);
