const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Database connection check middleware
app.use((req, res, next) => {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1 && req.path.startsWith("/api/")) {
        return res.status(503).json({
            message: "Database is offline. Please check your internet connection or verify your MongoDB Atlas Whitelist settings."
        });
    }
    next();
});

// Routes
const authRoutes = require("./routes/authRoutes");
const passwordRoutes = require("./routes/passwordRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/vault", passwordRoutes);

// Static Web Assets Mapping
// Serve front-end folder static assets
app.use(express.static(path.join(__dirname, "../frontend")));

// Robust URL Mapping to fix front-end page referencing bugs (href="styles.css" inside subfolders)
app.get("/pages/styles.css", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/styles.css"));
});
app.get("/pages/auth.css", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/auth.css"));
});
app.get("/pages/dashboard.css", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/dashboard.css"));
});
app.get("/styles.css", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/styles.css"));
});
app.get("/login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});
app.get("/signup.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/signup.html"));
});
app.get("/dashboard.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html"));
});
app.get("/profile.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/profile.html"));
});
app.get("/settings.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/settings.html"));
});
app.get("/pages/forgot.html", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/forgot.html"));
});
app.use("/pages/assets", express.static(path.join(__dirname, "../frontend/assets")));

app.get("/robots.txt", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/robots.txt"));
});
app.get("/sitemap.xml", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/sitemap.xml"));
});

// Redirect root to login page
app.get("/", (req, res) => {
    res.redirect("/pages/login.html");
});

module.exports = app;