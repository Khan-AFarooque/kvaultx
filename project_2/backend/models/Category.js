const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    color: {
        type: String,
        default: "#4b79a1"
    }
},
{
    timestamps: true
}
);

// Compound unique key to avoid duplicate category names for the same user
categorySchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
