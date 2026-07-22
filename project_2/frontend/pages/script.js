/* =========================================================
   DASHBOARD / PAGES SCRIPT (script.js)
   SecureVault AI - Version 3
========================================================= */

// Configuration
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 Minutes Inactivity
let inactivityTimer;

document.addEventListener("DOMContentLoaded", () => {
    // Session Verification
    const token = localStorage.getItem("accessToken");
    const isValidToken = token && token !== "undefined" && token !== "null";
    if (!isValidToken && !window.location.pathname.endsWith("login.html") && !window.location.pathname.endsWith("signup.html") && !window.location.pathname.endsWith("terms.html") && !window.location.pathname.endsWith("privacy.html")) {
        window.location.href = "/pages/login.html";
        return;
    }

    // --- Tab Switching Navigation Logic ---
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.getAttribute("data-tab");
                if (!targetTab) return;
                
                // Toggle active class on buttons
                tabButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                // Toggle visibility of contents
                tabContents.forEach(content => {
                    if (content.id === `${targetTab}Tab`) {
                        content.classList.remove("hidden-tab");
                    } else {
                        content.classList.add("hidden-tab");
                    }
                });
            });
        });
    }

    // --- Day 8: Note Area Elements ---
    const toggleActions = document.querySelector("#toggleActions");
    const actionButtons = document.querySelector("#actionButtons");
    const saveNoteBtn = document.querySelector("#saveNoteBtn");
    const showNotesBtn = document.querySelector("#showNotesBtn");
    const downloadNotesBtn = document.querySelector("#downloadNotesBtn");
    const copyNotesBtn = document.querySelector("#copyNotesBtn");
    const shareNotesBtn = document.querySelector("#shareNotesBtn");
    const noteInput = document.querySelector("#noteInput");
    const deleteAllBtn = document.querySelector("#deleteAllBtn");
    const logoutBtn = document.querySelector("#logoutBtn");
    const themeToggleBtn = document.querySelector("#themeToggleBtn");
    
    // Popup Elements
    const notesPopup = document.querySelector("#notesPopup");
    const notesDisplay = document.querySelector("#notesDisplay");
    const closePopupBtn = document.querySelector("#closePopupBtn");

    // Toggle Action Panel via Three-Dots Button
    if (toggleActions && actionButtons) {
        toggleActions.addEventListener("click", (e) => {
            e.stopPropagation();
            actionButtons.classList.toggle("hidden");
        });
        
        actionButtons.addEventListener("click", (e) => {
            e.stopPropagation();
        });
        
        // Hide panel when clicking outside
        document.addEventListener("click", () => {
            actionButtons.classList.add("hidden");
        });
    }

    // Save Note to localStorage
    if (saveNoteBtn && noteInput) {
        saveNoteBtn.addEventListener("click", () => {
            const noteContent = noteInput.value.trim();
            if (!noteContent) return alert("Note is empty.");

            let notes = JSON.parse(localStorage.getItem("secure_notes") || "[]");
            notes.push({
                content: noteContent,
                timestamp: new Date().toLocaleString()
            });
            localStorage.setItem("secure_notes", JSON.stringify(notes));
            alert("🔒 Note saved securely!");
            noteInput.value = "";
        });
    }

    // Show Notes Popup
    if (showNotesBtn && notesPopup && notesDisplay) {
        showNotesBtn.addEventListener("click", () => {
            let notes = JSON.parse(localStorage.getItem("secure_notes") || "[]");
            if (notes.length === 0) {
                notesDisplay.value = "No saved notes found.";
            } else {
                notesDisplay.value = notes.map((n, i) => `--- Note #${i + 1} (${n.timestamp}) ---\n${n.content}\n`).join("\n");
            }
            notesPopup.classList.remove("hidden");
        });
    }

    // Close Popup
    if (closePopupBtn && notesPopup) {
        closePopupBtn.addEventListener("click", () => {
            notesPopup.classList.add("hidden");
        });
    }

    // Download Notes
    if (downloadNotesBtn && noteInput) {
        downloadNotesBtn.addEventListener("click", () => {
            const content = noteInput.value || "No content to download.";
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "securevault_note.txt";
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Copy Notes
    if (copyNotesBtn && noteInput) {
        copyNotesBtn.addEventListener("click", () => {
            const content = noteInput.value;
            if (!content) return alert("Nothing to copy!");
            navigator.clipboard.writeText(content).then(() => {
                alert("📋 Note copied to clipboard!");
            });
        });
    }

    // Share Notes
    if (shareNotesBtn && noteInput) {
        shareNotesBtn.addEventListener("click", () => {
            const content = noteInput.value;
            if (!content) return alert("Nothing to share!");
            if (navigator.share) {
                navigator.share({
                    title: 'SecureVault Note',
                    text: content
                }).catch(err => console.log(err));
            } else {
                alert("Sharing not supported in this browser. Copied to clipboard instead.");
                navigator.clipboard.writeText(content);
            }
        });
    }

    // Delete All Notes
    if (deleteAllBtn && noteInput) {
        deleteAllBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to delete all saved notes? This action is irreversible.")) {
                localStorage.removeItem("secure_notes");
                noteInput.value = "";
                alert("🗑️ All notes deleted.");
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            logoutUser();
        });
    }

    // --- Day 10: Switch Theme ---
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "dark") {
        document.body.classList.add("dark-mode");
        if (themeToggleBtn) themeToggleBtn.textContent = "Switch Theme ☀️";
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            document.body.classList.toggle("dark-mode");
            let theme = "light";
            if (document.body.classList.contains("dark-mode")) {
                theme = "dark";
                themeToggleBtn.textContent = "Switch Theme ☀️";
            } else {
                themeToggleBtn.textContent = "Switch Theme 🌙";
            }
            localStorage.setItem("theme", theme);
        });
    }

    // --- Security feature: Inactivity timer (Auto-Logout) ---
    resetInactivityTimer();
    const activityEvents = ["click", "mousemove", "keypress", "scroll", "touchstart"];
    activityEvents.forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer);
    });
});

// Auto Logout Helpers
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert("🔒 Auto logout triggered due to 15 minutes of inactivity.");
        logoutUser();
    }, INACTIVITY_TIMEOUT);
}

function logoutUser() {
    const refreshToken = localStorage.getItem("refreshToken");
    
    // Call server logout
    fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
    }).catch(err => console.error("Logout request failed:", err));

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    
    window.location.href = "login.html";
}
