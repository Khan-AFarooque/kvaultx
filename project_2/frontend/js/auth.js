/* =========================================================
   AUTH.JS - SecureVault AI Authentication Controller
========================================================= */

let isStrongPassword = false;
window.currentCaptchaToken = "";

const API_AUTH_URL = typeof BASE_API_URL !== "undefined" ? `${BASE_API_URL}/auth` : "http://localhost:5000/api/auth";

/**
 * Loads a fresh CAPTCHA and token from the backend
 */
async function loadBackendCaptcha() {
    const captchaTextEl = document.querySelector("#captchaText");
    if (!captchaTextEl) return;

    try {
        const res = await fetch(`${API_AUTH_URL}/captcha`);
        if (res.ok) {
            const data = await res.json();
            captchaTextEl.textContent = data.captchaText;
            window.currentCaptchaToken = data.captchaToken;
        } else {
            captchaTextEl.textContent = "ERR";
        }
    } catch (e) {
        console.error("Failed to load backend CAPTCHA:", e);
        captchaTextEl.textContent = "FAIL";
    }
}

/* =========================================================
   DOM READY INITIALIZATION
========================================================= */
document.addEventListener("DOMContentLoaded", () => {

    /* ---------- THEME ---------- */
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
    }

    /* ---------- CAPTCHA INIT ---------- */
    loadBackendCaptcha();

    const reloadCaptchaBtn = document.querySelector("#reloadCaptcha");
    if (reloadCaptchaBtn) {
        reloadCaptchaBtn.addEventListener("click", () => {
            loadBackendCaptcha();
        });
    }

    /* ---------- PASSWORD STRENGTH CHECK ---------- */
    const signupPass = document.querySelector("#signupPassword");
    const strengthText = document.querySelector("#passwordStrength");
    const toggleSignPass = document.querySelector("#toggleSignPass");

    signupPass?.addEventListener("input", () => {
        const v = signupPass.value;
        isStrongPassword =
            v.length >= 8 &&
            /[A-Z]/.test(v) &&
            /[0-9]/.test(v) &&
            /[^A-Za-z0-9]/.test(v);

        if (strengthText) {
            strengthText.textContent = isStrongPassword ? "✅ Strong Password" : "❌ Password must be >= 8 chars with uppercase, number & symbol";
            strengthText.style.color = isStrongPassword ? "#34e89e" : "#ff6b6b";
        }
    });

    toggleSignPass?.addEventListener("click", () => {
        signupPass.type = signupPass.type === "password" ? "text" : "password";
    });

    /* ---------- TOGGLE LOGIN PASSWORD EYE ---------- */
    const toggleLoginPass = document.querySelector("#toggleLoginPass");
    const loginPasswordInput = document.querySelector("#loginPassword");

    if (toggleLoginPass && loginPasswordInput) {
        toggleLoginPass.addEventListener("click", function () {
            if (loginPasswordInput.type === "password") {
                loginPasswordInput.type = "text";
                toggleLoginPass.textContent = "🙈";
            } else {
                loginPasswordInput.type = "password";
                toggleLoginPass.textContent = "👁";
            }
        });
    }

    /* ---------- SIGNUP HANDLER ---------- */
    const signupBtn = document.querySelector("#signupBtn");
    if (signupBtn) {
        signupBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const agreeTerms = document.querySelector("#agreeTerms");
            if (agreeTerms && !agreeTerms.checked) {
                return alert("Please agree to the Terms of Service & Privacy Policy to continue");
            }

            const name = document.querySelector("#signupName")?.value.trim();
            const email = document.querySelector("#signupEmail")?.value.trim();
            const password = document.querySelector("#signupPassword")?.value.trim();

            if (!name || !email || !password) return alert("Please fill in all fields (Full Name, Email, and Password).");
            if (!isStrongPassword) return alert("Please use a strong password (at least 8 characters with 1 uppercase letter, 1 number, and 1 special symbol).");

            try {
                signupBtn.disabled = true;
                signupBtn.textContent = "Creating Account...";

                const res = await fetch(`${API_AUTH_URL}/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await res.json();
                if (!res.ok) {
                    alert(data.message || "Signup failed. Please try again.");
                    return;
                }

                alert("🎉 Account created successfully! Please log in.");
                window.location.href = "login.html";
            } catch (err) {
                console.error("Signup Error:", err);
                alert("Server connection error. Is the backend server running?");
            } finally {
                signupBtn.disabled = false;
                signupBtn.textContent = "Create Account";
            }
        });
    }

    /* ---------- LOGIN HANDLER ---------- */
    const loginBtn = document.querySelector("#loginBtn");
    if (loginBtn) {
        loginBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const email = document.querySelector("#loginEmail")?.value.trim();
            const password = document.querySelector("#loginPassword")?.value.trim();
            const captchaInput = document.querySelector("#captchaInput")?.value.trim();
            const mfaCode = document.querySelector("#mfaCode")?.value.trim();
            const captchaToken = window.currentCaptchaToken;

            if (!email || !password) return alert("Please enter both Email and Password.");
            if (!captchaInput) return alert("Please enter the security CAPTCHA code.");

            try {
                loginBtn.disabled = true;
                loginBtn.textContent = "Logging in...";

                const payload = { email, password, captchaInput, captchaToken };
                if (mfaCode) payload.mfaCode = mfaCode;

                const res = await fetch(`${API_AUTH_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok) {
                    alert(data.message || "Login failed. Please check your credentials.");
                    loadBackendCaptcha();
                    return;
                }

                if (data.mfaRequired) {
                    if (data.mfaType === "webauthn_passkey") {
                        const loginModal = document.getElementById("loginQrModal");
                        if (loginModal) {
                            loginModal.style.display = "none";
                            loginModal.style.visibility = "hidden";
                            loginModal.classList.add("hidden");
                        }
                        alert("🔑 Passkey 2FA Protection Active: Please authenticate using your device Passkey (Windows Hello / PIN / Fingerprint).");
                        if (typeof loginWithPasskey === "function") {
                            loginWithPasskey();
                        }
                        return;
                    }

                    const mfaGroup = document.querySelector("#mfaGroup");
                    const mfaLabel = document.querySelector("label[for='mfaCode']");
                    const mfaInput = document.querySelector("#mfaCode");

                    if (mfaGroup) mfaGroup.style.display = "block";

                    if (data.mfaType === "email_otp") {
                        let msg = "📧 2-Factor Authentication Required: A 6-digit OTP verification code has been generated & sent to your email address!";
                        if (data.demoOtp) {
                            msg += `\n\n🔑 Verification Code: ${data.demoOtp}`;
                        }
                        alert(msg);
                        if (mfaLabel) mfaLabel.textContent = `Email OTP Code ${data.demoOtp ? '(Code: ' + data.demoOtp + ')' : '(Sent to email)'}`;
                    } else {
                        if (mfaLabel) mfaLabel.textContent = "Authenticator App 2FA Code";
                        if (typeof showLoginQrScanner === "function") {
                            showLoginQrScanner();
                        }
                    }

                    if (mfaInput) mfaInput.focus();
                    return;
                }

                // Store tokens and user details in localStorage
                if (data.accessToken && data.accessToken !== "undefined") {
                    localStorage.setItem("accessToken", data.accessToken);
                    localStorage.setItem("refreshToken", data.refreshToken || "");
                    localStorage.setItem("user", JSON.stringify(data.user || {}));

                    const targetDashboard = window.location.pathname.includes("/pages/") ? "dashboard.html" : "pages/dashboard.html";
                    window.location.href = targetDashboard;
                } else {
                    alert(data.message || "Login failed: No access token received.");
                }
            } catch (err) {
                console.error("Login Error:", err);
                alert("Server connection error. Is the backend server running?");
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = "Login";
            }
        });
    }

    /* ---------- FORGOT PASSWORD – SEND OTP ---------- */
    const sendOtpBtn = document.querySelector("#sendOtpBtn");
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener("click", async () => {
            const mobileInput = document.querySelector("#forgotMobile");
            const email = mobileInput ? mobileInput.value.trim() : "";

            if (!email) return alert("Please enter your registered email address");

            try {
                sendOtpBtn.disabled = true;
                sendOtpBtn.textContent = "Sending...";

                const res = await fetch(`${API_AUTH_URL}/forgot-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });

                const data = await res.json();
                if (!res.ok) {
                    alert(data.message || "Failed to send OTP.");
                } else {
                    if (otpInput) {
                        otpInput.value = "";
                    }
                    alert(data.message || `📧 OTP verification code sent to ${email}! Check your Inbox & Spam folder.`);
                }
            } catch (e) {
                console.error("Send OTP Error:", e);
                alert("Error connecting to server.");
            } finally {
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = "⚡ Send OTP";
            }
        });
    }

    /* ---------- RESET PASSWORD HANDLER ---------- */
    const resetPassBtn = document.querySelector("#resetPassBtn");
    if (resetPassBtn) {
        resetPassBtn.addEventListener("click", async () => {
            const mobileInput = document.querySelector("#forgotMobile");
            const email = mobileInput ? mobileInput.value.trim() : "";
            const otp = document.querySelector("#otpInput")?.value.trim();
            const newPassword = document.querySelector("#newPassword")?.value.trim();

            if (!email || !otp || !newPassword) {
                return alert("Please fill in Email, OTP code, and your New Chosen Password.");
            }

            try {
                resetPassBtn.disabled = true;
                resetPassBtn.textContent = "Resetting...";

                const res = await fetch(`${API_AUTH_URL}/reset-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, otp, newPassword })
                });

                const data = await res.json();
                if (!res.ok) {
                    alert(data.message || "Failed to reset password.");
                } else {
                    alert("🔑 Password updated successfully! You can now log in with your new password.");
                    const targetLogin = window.location.pathname.includes("/pages/") ? "login.html" : "pages/login.html";
                    window.location.href = targetLogin;
                }
            } catch (e) {
                console.error("Reset Password Error:", e);
                alert("Error connecting to server.");
            } finally {
                resetPassBtn.disabled = false;
                resetPassBtn.textContent = "Reset Password";
            }
        });
    }
});

let isPasskeyPromptActive = false;

/**
 * Handle Login via Passkey or Native Device Biometrics
 */
async function loginWithPasskey() {
    if (isPasskeyPromptActive) {
        console.log("Passkey prompt already open. Suppressing duplicate trigger.");
        return;
    }
    isPasskeyPromptActive = true;

    try {
        const emailInput = document.querySelector("#loginEmail");
        const email = emailInput ? emailInput.value.trim() : "";

        if (!window.PublicKeyCredential || typeof navigator.credentials.get !== "function") {
            return alert("Passkey authentication is not supported by your current browser.");
        }

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyOptions = {
            challenge: challenge,
            rpId: window.location.hostname || "localhost",
            userVerification: "preferred",
            timeout: 60000
        };

        const credential = await navigator.credentials.get({ publicKey: publicKeyOptions });

        if (credential) {
            try {
                const sessRes = await fetch(`${API_AUTH_URL}/passkey-session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ email })
                });

                if (sessRes.ok) {
                    const data = await sessRes.json();
                    localStorage.setItem("accessToken", data.accessToken);
                    localStorage.setItem("refreshToken", data.refreshToken);
                    localStorage.setItem("user", JSON.stringify(data.user));
                }
            } catch (e) {
                console.error("passkey-session error:", e);
            }

            alert("🔑 Device Security / Passkey Verified! Redirecting to Dashboard...");
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.log("Passkey prompt finished/cancelled:", err);
        if (err.name !== "NotAllowedError" && err.name !== "InvalidStateError" && !err.message.includes("pending")) {
            alert("Device Security Passkey prompt: " + err.message);
        }
    } finally {
        isPasskeyPromptActive = false;
    }
}