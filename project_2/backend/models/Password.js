const mongoose = require("mongoose");

const passwordSchema = new mongoose.Schema(
{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        trim: true
    },
    password: {
        type: String, // Encrypted AES-256 ciphertext
        required: true
    },
    iv: {
        type: String, // Hex-encoded Initialization Vector
        required: true
    },
    url: {
        type: String,
        trim: true
    },
    notes: {
        type: String // Encrypted AES-256 ciphertext or optional notes
    },
    category: {
        type: String,
        default: "Uncategorized"
    },
    tags: [
        {
            type: String,
            trim: true
        }
    ],
    isFavorite: {
        type: Boolean,
        default: false
    },
    expiryDate: {
        type: Date
    },
    lastRotated: {
        type: Date,
        default: Date.now
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model("Password", passwordSchema);
