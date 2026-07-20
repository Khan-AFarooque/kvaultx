const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        // Restrict server selection timeout to 5 seconds to avoid long hangs
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000
        });

        console.log("✅ MongoDB Connected");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        console.warn("⚠️ Warning: Server is running but database is offline. Check your internet connection or Whitelist your IP in MongoDB Atlas.");
    }
};

module.exports = connectDB;