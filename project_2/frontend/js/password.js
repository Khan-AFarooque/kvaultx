/* =========================================================
   PASSWORD.JS
   SecureVault AI - Version 3
========================================================= */

// Base64url converters for WebAuthn Passkeys
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function base64urlToBuffer(base64url) {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
}

document.addEventListener("DOMContentLoaded", async () => {
    
    /* =========================================================
       ADD / EDIT PASSWORD FORM PAGE
    ========================================================= */
    const vaultForm = document.querySelector("#vaultForm");
    if (vaultForm) {
        const titleInput = document.querySelector("#vaultTitle");
        const usernameInput = document.querySelector("#vaultUsername");
        const passwordInput = document.querySelector("#vaultPassword");
        const togglePass = document.querySelector("#toggleVaultPass");
        const urlInput = document.querySelector("#vaultUrl");
        const notesInput = document.querySelector("#vaultNotes");
        const categoryInput = document.querySelector("#vaultCategory");
        const tagsInput = document.querySelector("#vaultTags");
        const expiryInput = document.querySelector("#vaultExpiry");
        const strengthText = document.querySelector("#passwordStrength");
        
        const formTitle = document.querySelector("#formTitle");
        const saveBtn = document.querySelector("#saveVaultBtn");
        const cancelBtn = document.querySelector("#cancelVaultBtn");

        // Parse query params to detect edit mode
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get("edit");

        if (editId) {
            // Edit Mode - Fetch individual detail
            formTitle.textContent = "Edit Credential";
            saveBtn.textContent = "Update Credential";
            
            try {
                const response = await apiFetch(`/vault`);
                const items = await response.json();
                const item = items.find(i => i.id === editId);
                
                if (item) {
                    titleInput.value = item.title;
                    usernameInput.value = item.username || "";
                    passwordInput.value = item.password;
                    urlInput.value = item.url || "";
                    notesInput.value = item.notes || "";
                    categoryInput.value = item.category || "Uncategorized";
                    tagsInput.value = item.tags ? item.tags.join(", ") : "";
                    if (item.expiryDate) {
                        expiryInput.value = new Date(item.expiryDate).toISOString().substring(0, 10);
                    }
                    evaluatePasswordInput();
                } else {
                    alert("Credential not found");
                    window.location.href = "dashboard.html";
                }
            } catch (err) {
                console.error("Failed to load credential", err);
            }
        }

        // Real-time strength evaluator listener
        passwordInput.addEventListener("input", evaluatePasswordInput);

        function evaluatePasswordInput() {
            const pwd = passwordInput.value;
            if (!pwd) {
                strengthText.textContent = "";
                strengthText.className = "";
                return;
            }

            let score = 0;
            if (pwd.length >= 8) score++;
            if (pwd.length >= 14) score++;
            if (/[A-Z]/.test(pwd)) score++;
            if (/[a-z]/.test(pwd)) score++;
            if (/[0-9]/.test(pwd)) score++;
            if (/[^A-Za-z0-9]/.test(pwd)) score++;

            strengthText.className = "";
            if (score <= 2 || pwd.length < 7) {
                strengthText.textContent = "❌ Strength: Weak";
                strengthText.classList.add("weak");
            } else if (score <= 4) {
                strengthText.textContent = "⚠️ Strength: Medium";
                strengthText.classList.add("medium");
            } else {
                strengthText.textContent = "✅ Strength: Strong";
                strengthText.classList.add("strong");
            }
        }

        // Toggle visibility
        if (togglePass) {
            togglePass.addEventListener("click", () => {
                passwordInput.type = passwordInput.type === "password" ? "text" : "password";
            });
        }

        // Submit form
        vaultForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = titleInput.value.trim();
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            const url = urlInput.value.trim();
            const notes = notesInput.value.trim();
            const category = categoryInput.value;
            const tags = tagsInput.value.split(",").map(t => t.trim()).filter(t => t);
            const expiryDate = expiryInput.value ? new Date(expiryInput.value) : null;

            const payload = { title, username, password, url, notes, category, tags, expiryDate };

            try {
                let response;
                if (editId) {
                    response = await apiFetch(`/vault/${editId}`, {
                        method: "PUT",
                        body: JSON.stringify(payload)
                    });
                } else {
                    response = await apiFetch(`/vault`, {
                        method: "POST",
                        body: JSON.stringify(payload)
                    });
                }

                if (!response.ok) {
                    const err = await response.json();
                    return alert(err.message || "Failed to save credential");
                }

                if (!editId && localStorage.getItem("notify_new_password") === "true") {
                    sessionStorage.setItem("pending_toast", JSON.stringify({
                        title: "Security Update 🔐",
                        message: `Credential "${title}" saved successfully to Vault!`
                    }));
                }

                alert(editId ? "Credential updated!" : "Credential added to Vault!");
                window.location.href = "dashboard.html";
            } catch (error) {
                console.error(error);
                alert("Error saving credential");
            }
        });

        // Cancel button
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                window.location.href = "dashboard.html";
            });
        }
    }

    /* =========================================================
       PROFILE & SECURITY SETTINGS PAGE
    ========================================================= */
    const profileContainer = document.querySelector(".profile-container");
    if (profileContainer) {
        
        // Back button
        const btnBack = document.querySelector("#btnBackToDashboard");
        if (btnBack) {
            btnBack.addEventListener("click", () => {
                window.location.href = "dashboard.html";
            });
        }

        // Check Theme
        const currentTheme = localStorage.getItem("theme");
        if (currentTheme === "dark") {
            document.body.classList.add("dark-mode");
        }

        // Setup Elements
        const mfaStatusText = document.querySelector("#mfaStatusText");
        const btnEnableMfa = document.querySelector("#btnEnableMfa");
        const btnDisableMfa = document.querySelector("#btnDisableMfa");
        const mfaSetupArea = document.querySelector("#mfaSetupArea");
        const mfaSecretCode = document.querySelector("#mfaSecretCode");
        const qrCodeContainer = document.querySelector("#qrCodeContainer");
        const mfaVerificationCode = document.querySelector("#mfaVerificationCode");
        const btnVerifyMfa = document.querySelector("#btnVerifyMfa");
        const btnCopyMfaSecret = document.querySelector("#btnCopyMfaSecret");
        const lnkOpenAuthenticator = document.querySelector("#lnkOpenAuthenticator");

        const btnRegisterPasskey = document.querySelector("#btnRegisterPasskey");
        const passkeyStatus = document.querySelector("#passkeyStatus");

        const sessionsList = document.querySelector("#sessionsList");

        // Load profile stats and sessions on page load
        loadProfileData();

        // Bind notification checkboxes
        const notifyNewPass = document.querySelector("#notificationNewPassword");
        const notifyWeakPass = document.querySelector("#notificationWeakPassword");

        if (notifyNewPass && notifyWeakPass) {
            // Default to true if not set
            if (localStorage.getItem("notify_new_password") === null) {
                localStorage.setItem("notify_new_password", "true");
            }
            if (localStorage.getItem("notify_weak_password") === null) {
                localStorage.setItem("notify_weak_password", "true");
            }

            // Load state
            notifyNewPass.checked = localStorage.getItem("notify_new_password") === "true";
            notifyWeakPass.checked = localStorage.getItem("notify_weak_password") === "true";

            // Save state on change
            notifyNewPass.addEventListener("change", () => {
                localStorage.setItem("notify_new_password", notifyNewPass.checked ? "true" : "false");
                showToast("Preferences Updated", "Notification settings saved.");
            });

            notifyWeakPass.addEventListener("change", () => {
                localStorage.setItem("notify_weak_password", notifyWeakPass.checked ? "true" : "false");
                showToast("Preferences Updated", "Notification settings saved.");
            });
        }

        async function loadProfileData() {
            try {
                // Fetch user profile info to check MFA state
                const profileResponse = await apiFetch("/auth/profile");
                if (profileResponse.ok) {
                    const profileData = await profileResponse.json();
                    
                    // Update UI status badges and buttons
                    if (profileData.mfaEnabled) {
                        mfaStatusText.textContent = "Status: Enabled";
                        mfaStatusText.className = "status-badge enabled";
                        btnDisableMfa.style.display = "inline-block";
                        btnEnableMfa.style.display = "none";
                    } else {
                        mfaStatusText.textContent = "Status: Disabled";
                        mfaStatusText.className = "status-badge";
                        btnDisableMfa.style.display = "none";
                        btnEnableMfa.style.display = "inline-block";
                    }
                    
                    // Save in local user object
                    const user = JSON.parse(localStorage.getItem("user") || "{}");
                    user.mfaEnabled = profileData.mfaEnabled;
                    localStorage.setItem("user", JSON.stringify(user));
                }

                // Fetch active sessions
                const sessionResponse = await apiFetch("/auth/sessions");
                if (sessionResponse.ok) {
                    const sessions = await sessionResponse.json();
                    renderSessions(sessions);
                }
            } catch (err) {
                console.error("Profile load error", err);
            }
        }
        function renderSessions(sessions) {
            if (!sessionsList) return;
            if (sessions.length === 0) {
                sessionsList.innerHTML = "<p>No active sessions found.</p>";
                return;
            }

            sessionsList.innerHTML = sessions.map(session => {
                const isCurrent = session._id === localStorage.getItem("sessionId") || session.isValid;
                const formattedDate = new Date(session.lastUsedAt).toLocaleString();
                
                return `
                    <div class="session-item">
                        <div class="session-info">
                            <strong>IP: ${session.ipAddress}</strong> - ${session.userAgent}<br>
                            <span style="font-size: 11px; opacity: 0.8;">Last Active: ${formattedDate}</span>
                        </div>
                        <button class="btn-revoke" onclick="revokeSession('${session._id}')">Revoke</button>
                    </div>
                `;
            }).join("");
        }

        // Global revoke session action
        window.revokeSession = async function(sessionId) {
            if (!confirm("Are you sure you want to revoke this session? The device will be logged out.")) return;

            try {
                const response = await apiFetch(`/auth/sessions/${sessionId}`, {
                    method: "DELETE"
                });

                if (response.ok) {
                    alert("Session revoked successfully.");
                    loadProfileData(); // Refresh sessions
                } else {
                    const err = await response.json();
                    alert(err.message || "Failed to revoke session.");
                }
            } catch (e) {
                alert("Connection error.");
            }
        };

        // MFA SETUP FLOW
        if (btnEnableMfa) {
            btnEnableMfa.addEventListener("click", async () => {
                try {
                    const response = await apiFetch("/auth/mfa/setup", { method: "POST" });
                    const data = await response.json();

                    mfaSecretCode.textContent = data.secret;
                    qrCodeContainer.innerHTML = `<img src="${data.qrCode}" alt="MFA QR Code">`;
                    mfaSetupArea.style.display = "block";
                    btnEnableMfa.style.display = "none";

                    if (lnkOpenAuthenticator && data.otpAuthUrl) {
                        lnkOpenAuthenticator.href = data.otpAuthUrl;
                    }
                } catch (error) {
                    alert("Failed to initiate MFA setup");
                }
            });
        }

        if (btnCopyMfaSecret && mfaSecretCode) {
            btnCopyMfaSecret.addEventListener("click", () => {
                const secret = mfaSecretCode.textContent;
                if (!secret) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(secret).then(() => {
                        alert("📋 Secret key copied to clipboard!");
                    }).catch(() => {
                        fallbackCopyText(secret);
                    });
                } else {
                    fallbackCopyText(secret);
                }
            });
        }

        function fallbackCopyText(text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand("copy");
                if (successful) {
                    alert("📋 Secret key copied to clipboard!");
                } else {
                    alert("Please select and copy the text manually.");
                }
            } catch (err) {
                alert("Please select and copy the text manually.");
            }
            document.body.removeChild(textArea);
        }

        if (btnVerifyMfa) {
            btnVerifyMfa.addEventListener("click", async () => {
                const code = mfaVerificationCode.value.trim();
                if (!code) return alert("Please enter the 6-digit verification code.");

                try {
                    const response = await apiFetch("/auth/mfa/verify", {
                        method: "POST",
                        body: JSON.stringify({ code })
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        return alert(data.message || "Verification failed");
                    }

                    alert("✅ MFA Enabled successfully! Next time you log in, you will be prompted for 2FA.");
                    mfaSetupArea.style.display = "none";
                    mfaStatusText.textContent = "Status: Enabled";
                    btnDisableMfa.style.display = "inline-block";
                    
                    // Update local user state
                    const user = JSON.parse(localStorage.getItem("user") || "{}");
                    user.mfaEnabled = true;
                    localStorage.setItem("user", JSON.stringify(user));
                } catch (error) {
                    alert("MFA activation failed.");
                }
            });
        }

        if (btnDisableMfa) {
            btnDisableMfa.addEventListener("click", async () => {
                const code = prompt("Enter 2FA TOTP Code from your authenticator app to disable MFA:");
                if (code === null) return;

                try {
                    const response = await apiFetch("/auth/mfa/disable", {
                        method: "POST",
                        body: JSON.stringify({ code })
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        return alert(data.message || "Failed to disable MFA");
                    }

                    alert("MFA has been disabled.");
                    mfaStatusText.textContent = "Status: Disabled";
                    btnDisableMfa.style.display = "none";
                    btnEnableMfa.style.display = "inline-block";
                    
                    // Update local user state
                    const user = JSON.parse(localStorage.getItem("user") || "{}");
                    user.mfaEnabled = false;
                    localStorage.setItem("user", JSON.stringify(user));
                } catch (error) {
                    alert("Error disabling MFA.");
                }
            });
        }

        // WEBAUTHN PASSKEY REGISTRATION
        if (btnRegisterPasskey) {
            btnRegisterPasskey.addEventListener("click", async () => {
                passkeyStatus.textContent = "Initiating challenge...";
                try {
                    const response = await apiFetch("/auth/webauthn/register-challenge", { method: "POST" });
                    const resData = await response.json();

                    if (!response.ok) {
                        passkeyStatus.textContent = "Challenge generation failed: " + resData.message;
                        return;
                    }

                    const options = resData.options;
                    
                    // Convert challenges & user ID from Base64url to ArrayBuffers
                    options.challenge = base64urlToBuffer(options.challenge);
                    options.user.id = base64urlToBuffer(options.user.id);
                    if (options.excludeCredentials) {
                        options.excludeCredentials.forEach(cred => {
                            cred.id = base64urlToBuffer(cred.id);
                        });
                    }

                    // Call browser API
                    const credential = await navigator.credentials.create({
                        publicKey: options
                    });

                    // Convert buffers in response back to base64url for transmission
                    const attestationResponse = {
                        id: credential.id,
                        rawId: bufferToBase64url(credential.rawId),
                        type: credential.type,
                        response: {
                            clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
                            attestationObject: bufferToBase64url(credential.response.attestationObject),
                            transports: credential.response.getTransports ? credential.response.getTransports() : []
                        }
                    };

                    passkeyStatus.textContent = "Verifying with server...";

                    const verifyRes = await apiFetch("/auth/webauthn/register-verify", {
                        method: "POST",
                        body: JSON.stringify({
                            attestationResponse,
                            challengeToken: resData.challengeToken
                        })
                    });

                    const verifyData = await verifyRes.json();
                    if (verifyRes.ok) {
                        passkeyStatus.textContent = "✅ Passkey Registered successfully on this device!";
                        alert("✅ Passkey Registered! You can now log in using this device's biometrics or Hello key.");
                    } else {
                        passkeyStatus.textContent = "Verification failed: " + verifyData.message;
                    }
                } catch (error) {
                    console.error(error);
                    let errMsg = error.message;
                    if (window.location.hostname !== "localhost" && window.location.protocol !== "https:") {
                        errMsg += " (Note: WebAuthn Passkeys require using 'localhost' or an HTTPS connection to function. If you are accessing via 127.0.0.1 or an IP address, please switch to http://localhost:5000)";
                    }
                    passkeyStatus.textContent = "Error registering Passkey: " + errMsg;
                }
            });
        }

        // BACKUPS IMPORT / EXPORT UI Handlers
        const btnExportJson = document.querySelector("#btnExportJson");
        const btnExportCsv = document.querySelector("#btnExportCsv");
        const btnExportEncrypted = document.querySelector("#btnExportEncrypted");
        const btnImportTrigger = document.querySelector("#btnImportTrigger");
        const importFileInput = document.querySelector("#importFileInput");

        if (btnExportJson) {
            btnExportJson.addEventListener("click", () => triggerDownload("/vault/export/json"));
        }
        if (btnExportCsv) {
            btnExportCsv.addEventListener("click", () => triggerDownload("/vault/export/csv"));
        }
        if (btnExportEncrypted) {
            btnExportEncrypted.addEventListener("click", () => {
                const passphrase = prompt("Enter a strong passphrase to encrypt your backup file:");
                if (!passphrase) return;
                triggerDownload(`/vault/export/encrypted?passphrase=${encodeURIComponent(passphrase)}`);
            });
        }

        async function triggerDownload(endpoint) {
            try {
                const response = await apiFetch(endpoint);
                if (!response.ok) {
                    const err = await response.json();
                    return alert(err.message || "Export failed.");
                }

                // Retrieve filename from header if present
                const header = response.headers.get("Content-Disposition");
                const parts = header ? header.split("filename=") : [];
                const filename = parts.length > 1 ? parts[1] : "securevault_export";

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error(error);
                alert("Failed to download backup file.");
            }
        }

        if (btnImportTrigger && importFileInput) {
            btnImportTrigger.addEventListener("click", () => {
                importFileInput.click();
            });

            importFileInput.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const content = evt.target.result;
                    let payload;
                    let format = "json";
                    let passphrase = "";

                    if (file.name.endsWith(".enc")) {
                        format = "encrypted";
                        passphrase = prompt("Enter the passphrase to decrypt your backup:");
                        if (!passphrase) return;
                        try {
                            payload = JSON.parse(content);
                        } catch (err) {
                            return alert("Invalid encrypted backup structure.");
                        }
                    } else if (file.name.endsWith(".csv")) {
                        format = "csv";
                        payload = content; // raw csv text
                    } else {
                        // JSON
                        try {
                            payload = JSON.parse(content);
                        } catch (err) {
                            return alert("Invalid JSON file.");
                        }
                    }

                    try {
                        const response = await apiFetch("/vault/import", {
                            method: "POST",
                            body: JSON.stringify({
                                format,
                                payload,
                                passphrase
                            })
                        });

                        const data = await response.json();
                        if (response.ok) {
                            alert(`✅ Import complete! ${data.message}`);
                        } else {
                            alert(data.message || "Import failed.");
                        }
                    } catch (error) {
                        console.error(error);
                        alert("Error importing file.");
                    }
                };

                // Read encrypted and json files as text, csv as text
                reader.readAsText(file);
            });
        }
    }
});
