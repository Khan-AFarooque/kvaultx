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

// Robust URL Mapping to fix front-end page referencing bugs and broken navigation
app.get(["/styles.css", "/pages/styles.css"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/styles.css"));
});
app.get(["/auth.css", "/pages/auth.css"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/auth.css"));
});
app.get(["/dashboard.css", "/pages/dashboard.css"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/dashboard.css"));
});
app.get(["/login.css", "/pages/login.css"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/login.css"));
});
app.get(["/signup.css", "/pages/signup.css"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/css/signup.css"));
});

// Front-end Page Routes (Support both root /... and /pages/... URLs)
app.get(["/login.html", "/pages/login.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});
app.get(["/signup.html", "/pages/signup.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/signup.html"));
});
app.get(["/dashboard.html", "/pages/dashboard.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html"));
});
app.get(["/profile.html", "/pages/profile.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/profile.html"));
});
app.get(["/settings.html", "/pages/settings.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/settings.html"));
});
app.get(["/add-password.html", "/pages/add-password.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/add-password.html"));
});
app.get(["/terms.html", "/pages/terms.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/terms.html"));
});
app.get(["/privacy.html", "/pages/privacy.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/privacy.html"));
});
app.get(["/report-login.html", "/pages/report-login.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/report-login.html"));
});
app.get(["/forgot.html", "/pages/forgot.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/forgot.html"));
});

// Dedicated dashboard/pages script mapping
app.get("/pages/script.js", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/script.js"));
});

app.use("/pages/assets", express.static(path.join(__dirname, "../frontend/assets")));
app.use("/assets", express.static(path.join(__dirname, "../frontend/assets")));

app.get("/robots.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.sendFile(path.join(__dirname, "../frontend/robots.txt"));
});
app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml");
    res.sendFile(path.join(__dirname, "../frontend/sitemap.xml"));
});

// Serve direct main dashboard page on root URL
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html"));
});

module.exports = app;