/* =========================================================
   UTILS.JS
   SecureVault AI - Version 3
========================================================= */

const BASE_API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : `${window.location.origin}/api`;

/**
 * Standard fetch wrapper that handles authorization headers,
 * automatic token refreshing, and retry logic.
 */
async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_API_URL}${endpoint}`;
    
    // Always include credentials (HttpOnly cookies) for secure authentication
    options.credentials = "include";
    
    // Set headers
    options.headers = options.headers || {};
    options.headers["Content-Type"] = options.headers["Content-Type"] || "application/json";
    
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken && accessToken !== "undefined" && accessToken !== "null") {
        options.headers["Authorization"] = `Bearer ${accessToken}`;
    }

    try {
        let response = await fetch(url, options);

        // Handle Token Expired or Invalid (401 status) with smooth automatic token refresh
        if (response.status === 401) {
            const refreshToken = localStorage.getItem("refreshToken");
            if (refreshToken) {
                const refreshed = await refreshTokens();
                if (refreshed) {
                    // Retry original request with new token
                    const newAccessToken = localStorage.getItem("accessToken");
                    options.headers["Authorization"] = `Bearer ${newAccessToken}`;
                    response = await fetch(url, options);
                    return response;
                }
            }
            
            // Refresh failed or no refreshToken, logout cleanly
            localStorage.clear();
            window.location.href = "login.html";
        }

        return response;
    } catch (error) {
        console.error("API Fetch Error:", error);
        throw error;
    }
}

/**
 * Request new access & refresh tokens from server using current refresh token
 */
async function refreshTokens() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    try {
        const response = await fetch(`${BASE_API_URL}/auth/refresh-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) return false;

        const data = await response.json();
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return true;
    } catch (err) {
        console.error("Refresh tokens failed:", err);
        return false;
    }
}

/**
 * Copies text to clipboard and schedules a clear operation to prevent paste exposure.
 * @param {string} text - Text to copy
 * @param {number} durationSec - Duration in seconds before clearing clipboard
 */
function copyToClipboard(text, durationSec = 30) {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
        alert(`📋 Password copied! Clipboard will be auto-cleared in ${durationSec} seconds.`);
        
        // Setup clipboard clear timer
        setTimeout(() => {
            // Verify if the clipboard still holds the copied password before clearing
            navigator.clipboard.readText().then(currentText => {
                if (currentText === text) {
                    navigator.clipboard.writeText("");
                    console.log("Clipboard cleared automatically for security.");
                }
            }).catch(() => {
                // If permission is denied or blocked, overwrite clipboard anyway
                navigator.clipboard.writeText("");
            });
        }, durationSec * 1000);
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
}

/**
 * Converts a Base64URL string into an ArrayBuffer.
 */
function base64urlToBuffer(base64urlText) {
    let base64 = base64urlText.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
        base64 += "=";
    }
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Converts an ArrayBuffer into a Base64URL string.
 */
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Renders a beautiful floating Toast notification.
 */
function showToast(title, message) {
    const toast = document.createElement("div");
    toast.className = "custom-toast";
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-body">${message}</div>
    `;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add("show");
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// Auto-render pending toasts on page load
window.addEventListener("DOMContentLoaded", () => {
    const pending = sessionStorage.getItem("pending_toast");
    if (pending) {
        try {
            const data = JSON.parse(pending);
            showToast(data.title, data.message);
        } catch (e) {}
        sessionStorage.removeItem("pending_toast");
    }

    applyStoredTheme();

    document.querySelectorAll("#themeToggleBtn, .theme-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            toggleTheme();
        });
    });
});

/**
 * Global Theme Manager: Syncs theme across all pages & buttons
 */
function applyStoredTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
        document.body.classList.remove("dark-mode");
    } else {
        document.body.classList.add("dark-mode");
        document.body.classList.remove("light-mode");
    }
    updateThemeToggleButtons();
}

function toggleTheme() {
    if (document.body.classList.contains("light-mode")) {
        document.body.classList.remove("light-mode");
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
    } else {
        document.body.classList.remove("dark-mode");
        document.body.classList.add("light-mode");
        localStorage.setItem("theme", "light");
    }
    updateThemeToggleButtons();
}

function updateThemeToggleButtons() {
    const isLight = document.body.classList.contains("light-mode");
    const themeBtns = document.querySelectorAll("#themeToggleBtn, .theme-btn");
    themeBtns.forEach(btn => {
        btn.innerHTML = isLight ? "<span>☀️</span> Light Mode" : "<span>🌙</span> Dark Mode";
    });
}

/**
 * User Dropdown Menu Handler
 */
function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("userMenuDropdown");
    if (menu) {
        menu.classList.toggle("hidden");
    }
}

document.addEventListener("click", function(e) {
    const menu = document.getElementById("userMenuDropdown");
    const btn = document.getElementById("userMenuBtn");
    if (menu && !menu.classList.contains("hidden")) {
        if (btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add("hidden");
        }
    }
});
