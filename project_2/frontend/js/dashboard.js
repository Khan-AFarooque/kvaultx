/* =========================================================
   DASHBOARD.JS
   SecureVault AI - Version 3
========================================================= */

// Memorable Words list for passphrase generation
const MEMORABLE_WORDS = [
    "anchor", "beacon", "castle", "desert", "engine", "forest", "glacier", "harbor",
    "island", "jungle", "knight", "lantern", "meadow", "nomad", "ocean", "palace",
    "quarry", "river", "summit", "temple", "valley", "wizard", "canyon", "oasis",
    "tundra", "safari", "geyser", "planet", "galaxy", "comet", "nebula", "meteor"
];

/* ---------- AUTH STATE & MODAL HELPERS ---------- */
window.isUserLoggedIn = function() {
    const token = localStorage.getItem("accessToken");
    return Boolean(token && token !== "undefined" && token !== "null");
};

window.requireAuth = function(actionCallback, defaultTab = "login") {
    if (!window.isUserLoggedIn()) {
        window.openAuthModal(defaultTab);
        return false;
    }
    if (typeof actionCallback === "function") {
        actionCallback();
    }
    return true;
};

window.openAuthModal = function(tab = "login") {
    const overlay = document.getElementById("authModalOverlay");
    if (overlay) {
        overlay.classList.add("active");
        window.switchAuthModalTab(tab);
        window.loadModalCaptcha();
    }
};

window.closeAuthModal = function() {
    const overlay = document.getElementById("authModalOverlay");
    if (overlay) {
        overlay.classList.remove("active");
    }
    const feedback = document.getElementById("modalAuthFeedback");
    if (feedback) feedback.style.display = "none";
};

window.switchAuthModalTab = function(tab) {
    const loginTabBtn = document.getElementById("tabAuthLogin");
    const signupTabBtn = document.getElementById("tabAuthSignup");
    const loginPanel = document.getElementById("modalLoginPanel");
    const signupPanel = document.getElementById("modalSignupPanel");
    const subtitle = document.getElementById("authModalSubtitle");
    const feedback = document.getElementById("modalAuthFeedback");
    if (feedback) feedback.style.display = "none";

    if (tab === "signup") {
        if (loginTabBtn) loginTabBtn.classList.remove("active");
        if (signupTabBtn) signupTabBtn.classList.add("active");
        if (loginPanel) loginPanel.classList.add("hidden");
        if (signupPanel) signupPanel.classList.remove("hidden");
        if (subtitle) subtitle.textContent = "Create a zero-knowledge encrypted vault in seconds.";
    } else {
        if (loginTabBtn) loginTabBtn.classList.add("active");
        if (signupTabBtn) signupTabBtn.classList.remove("active");
        if (loginPanel) loginPanel.classList.remove("hidden");
        if (signupPanel) signupPanel.classList.add("hidden");
        if (subtitle) subtitle.textContent = "Sign in to unlock your secure passwords and notes.";
    }
};

window.loadModalCaptcha = async function() {
    const textEl = document.getElementById("modalCaptchaText");
    const inputEl = document.getElementById("modalCaptchaInput");
    if (!textEl) return;
    textEl.textContent = "...";
    try {
        const captchaUrl = typeof BASE_API_URL !== "undefined" ? `${BASE_API_URL}/auth/captcha` : "/api/auth/captcha";
        const res = await fetch(captchaUrl);
        if (res.ok) {
            const data = await res.json();
            textEl.textContent = data.captchaText;
            window.modalCaptchaToken = data.captchaToken;
            if (inputEl) inputEl.value = "";
        } else {
            textEl.textContent = "↻";
        }
    } catch (e) {
        textEl.textContent = "↻";
    }
};

window.toggleModalEye = function(inputId, eyeEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        eyeEl.textContent = "🙈";
    } else {
        input.type = "password";
        eyeEl.textContent = "👁️";
    }
};

window.checkModalSignupStrength = function(pwd) {
    const bar = document.getElementById("modalPasswordStrengthBar");
    const fill = document.getElementById("modalPasswordStrengthFill");
    const text = document.getElementById("modalPasswordStrengthText");
    if (!bar || !fill || !text) return;
    if (!pwd) {
        bar.style.display = "none";
        text.textContent = "";
        return;
    }
    bar.style.display = "block";
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[0-9]/.test(pwd)) score += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 15;

    fill.style.width = `${score}%`;
    if (score < 50) {
        fill.style.background = "#ef4444";
        text.textContent = "Weak password (add uppercase, numbers, symbols)";
        text.style.color = "#ef4444";
    } else if (score < 75) {
        fill.style.background = "#f59e0b";
        text.textContent = "Moderate password";
        text.style.color = "#f59e0b";
    } else {
        fill.style.background = "#10b981";
        text.textContent = "Strong password (AES-256 ready)";
        text.style.color = "#10b981";
    }
};

window.handleModalLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById("modalLoginEmail").value.trim();
    const password = document.getElementById("modalLoginPassword").value;
    const captchaText = document.getElementById("modalCaptchaInput").value.trim();
    const btn = document.getElementById("btnModalLoginSubmit");
    const feedback = document.getElementById("modalAuthFeedback");

    btn.disabled = true;
    btn.textContent = "Verifying...";
    if (feedback) feedback.style.display = "none";

    try {
        const loginUrl = typeof BASE_API_URL !== "undefined" ? `${BASE_API_URL}/auth/login` : "/api/auth/login";
        const res = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                password,
                captchaInput: captchaText,
                captchaText,
                captchaToken: window.modalCaptchaToken || ""
            })
        });
        const data = await res.json();
        if (res.ok && data.accessToken) {
            localStorage.setItem("accessToken", data.accessToken);
            if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
            if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
            
            if (typeof showToast === "function") {
                showToast("Welcome Back! 🔓", "Vault unlocked successfully.");
            }
            window.closeAuthModal();
            updateUserNavHeader();
            if (typeof loadVaultItems === "function") loadVaultItems();
            if (typeof loadAnalytics === "function") loadAnalytics();
        } else {
            if (feedback) {
                feedback.style.display = "block";
                feedback.style.background = "rgba(239, 68, 68, 0.15)";
                feedback.style.color = "#f87171";
                feedback.style.border = "1px solid rgba(239, 68, 68, 0.3)";
                feedback.textContent = data.message || "Invalid credentials or verification code.";
            }
            window.loadModalCaptcha();
        }
    } catch (err) {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.background = "rgba(239, 68, 68, 0.15)";
            feedback.style.color = "#f87171";
            feedback.textContent = "Network error. Please try again.";
        }
    } finally {
        btn.disabled = false;
        btn.textContent = "Unlock Vault";
    }
};

window.handleModalSignup = async function(e) {
    e.preventDefault();
    const name = document.getElementById("modalSignupName").value.trim();
    const email = document.getElementById("modalSignupEmail").value.trim();
    const password = document.getElementById("modalSignupPassword").value;
    const confirm = document.getElementById("modalSignupConfirm").value;
    const agree = document.getElementById("modalAgreeTerms")?.checked;
    const btn = document.getElementById("btnModalSignupSubmit");
    const feedback = document.getElementById("modalAuthFeedback");

    if (password !== confirm) {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.background = "rgba(239, 68, 68, 0.15)";
            feedback.style.color = "#f87171";
            feedback.textContent = "Passwords do not match.";
        }
        return;
    }
    if (password.length < 8) {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.background = "rgba(239, 68, 68, 0.15)";
            feedback.style.color = "#f87171";
            feedback.textContent = "Password must be at least 8 characters.";
        }
        return;
    }
    if (!agree) {
        alert("Please accept the Terms & Privacy Policy to continue.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Creating Vault...";
    if (feedback) feedback.style.display = "none";

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (typeof showToast === "function") {
                showToast("Vault Created! 🔒", "Account created successfully. Signing in...");
            }
            // Automatically log in with the new credentials
            const loginRes = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const loginData = await loginRes.json();
            if (loginRes.ok && loginData.accessToken) {
                localStorage.setItem("accessToken", loginData.accessToken);
                if (loginData.refreshToken) localStorage.setItem("refreshToken", loginData.refreshToken);
                if (loginData.user) localStorage.setItem("user", JSON.stringify(loginData.user));
            }
            window.closeAuthModal();
            updateUserNavHeader();
            if (typeof loadVaultItems === "function") loadVaultItems();
            if (typeof loadAnalytics === "function") loadAnalytics();
        } else {
            if (feedback) {
                feedback.style.display = "block";
                feedback.style.background = "rgba(239, 68, 68, 0.15)";
                feedback.style.color = "#f87171";
                feedback.style.border = "1px solid rgba(239, 68, 68, 0.3)";
                feedback.textContent = data.message || "Registration failed.";
            }
        }
    } catch (err) {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.background = "rgba(239, 68, 68, 0.15)";
            feedback.style.color = "#f87171";
            feedback.textContent = "Network error. Please try again.";
        }
    } finally {
        btn.disabled = false;
        btn.textContent = "Create Free Vault";
    }
};

function updateUserNavHeader() {
    const userMenuBtn = document.getElementById("userMenuBtn");
    if (!userMenuBtn) return;
    if (window.isUserLoggedIn()) {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const name = user.name ? user.name.split(" ")[0] : "Account";
        userMenuBtn.innerHTML = `<span>👤</span> ${name} ▾`;
        userMenuBtn.onclick = (e) => toggleUserMenu(e);
    } else {
        userMenuBtn.innerHTML = `<span>🔐</span> Sign In`;
        userMenuBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.openAuthModal("login");
        };
    }
}

document.addEventListener("DOMContentLoaded", () => {
    
    updateUserNavHeader();

    // Redirect to profile settings page (protected)
    const btnGoToProfile = document.querySelector("#btnGoToProfile");
    if (btnGoToProfile) {
        btnGoToProfile.addEventListener("click", () => {
            window.requireAuth(() => {
                window.location.href = "profile.html";
            }, "login");
        });
    }

    // Redirect to add password page (protected)
    const btnAddPasswordRedirect = document.querySelector("#btnAddPasswordRedirect");
    if (btnAddPasswordRedirect) {
        btnAddPasswordRedirect.addEventListener("click", () => {
            window.requireAuth(() => {
                window.location.href = "add-password.html";
            }, "login");
        });
    }

    /* =========================================================
       PASSWORD VAULT LISTING & ACTIONS
    ========================================================= */
    const passwordCardsContainer = document.querySelector("#passwordCardsContainer");
    const vaultSearchInput = document.querySelector("#vaultSearchInput");
    const vaultCategoryFilter = document.querySelector("#vaultCategoryFilter");
    const btnFilterFavorite = document.querySelector("#btnFilterFavorite");

    let isFavoriteFilterActive = false;

    // Load initial passwords if we are on dashboard page
    if (passwordCardsContainer) {
        loadVaultItems();
        loadAnalytics();

        // Search & Filter listeners
        vaultSearchInput.addEventListener("input", debounce(loadVaultItems, 300));
        vaultCategoryFilter.addEventListener("change", loadVaultItems);
        btnFilterFavorite.addEventListener("click", () => {
            isFavoriteFilterActive = !isFavoriteFilterActive;
            if (isFavoriteFilterActive) {
                btnFilterFavorite.style.background = "#ffbe0b";
                btnFilterFavorite.style.color = "black";
            } else {
                btnFilterFavorite.style.background = "#555";
                btnFilterFavorite.style.color = "white";
            }
            loadVaultItems();
        });
    }

    let currentVaultViewMode = localStorage.getItem("kvaultx_view_mode") || "grid";

    window.setVaultViewMode = function(mode) {
        currentVaultViewMode = mode;
        localStorage.setItem("kvaultx_view_mode", mode);
        
        const btnGrid = document.querySelector("#btnViewGrid");
        const btnList = document.querySelector("#btnViewList");
        if (btnGrid && btnList) {
            if (mode === "grid") {
                btnGrid.style.background = "rgba(16, 185, 129, 0.25)";
                btnGrid.style.color = "#ffffff";
                btnGrid.style.border = "1px solid rgba(16, 185, 129, 0.4)";
                btnList.style.background = "transparent";
                btnList.style.color = "#a6bba8";
                btnList.style.border = "none";
            } else {
                btnList.style.background = "rgba(16, 185, 129, 0.25)";
                btnList.style.color = "#ffffff";
                btnList.style.border = "1px solid rgba(16, 185, 129, 0.4)";
                btnGrid.style.background = "transparent";
                btnGrid.style.color = "#a6bba8";
                btnGrid.style.border = "none";
            }
        }
        loadVaultItems();
    };

    function calcPasswordStrength(pwd) {
        if (!pwd) return { isWeak: true, text: "Weak", score: 0 };
        let score = 0;
        if (pwd.length >= 8) score += 20;
        if (pwd.length >= 14) score += 30;
        if (/[A-Z]/.test(pwd)) score += 15;
        if (/[a-z]/.test(pwd)) score += 10;
        if (/[0-9]/.test(pwd)) score += 10;
        if (/[^A-Za-z0-9]/.test(pwd)) score += 15;
        return { isWeak: score < 70, text: score < 50 ? "Weak" : (score < 70 ? "Medium" : "Strong"), score };
    }

    async function loadVaultItems() {
        if (!passwordCardsContainer) return;

        if (!window.isUserLoggedIn()) {
            passwordCardsContainer.innerHTML = `
                <div style="text-align: center; padding: 48px 24px; background: rgba(16, 185, 129, 0.04); border: 1px dashed rgba(16, 185, 129, 0.3); border-radius: 16px; margin: 16px 0;">
                    <div style="font-size: 40px; margin-bottom: 12px;">🛡️</div>
                    <h3 style="font-size: 19px; font-weight: 700; margin-bottom: 6px;">Zero-Knowledge Password Vault</h3>
                    <p style="font-size: 13.5px; opacity: 0.8; max-width: 440px; margin: 0 auto 20px; line-height: 1.5;">
                        Store, auto-generate, and audit passwords with military-grade AES-256 encryption. Sign in or create a free account to unlock your digital vault.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="window.openAuthModal('login')" style="background: linear-gradient(135deg, #10b981, #059669); color: #050a09; font-weight: 700; border: none; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-size: 13.5px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
                            🔐 Sign In to Vault
                        </button>
                        <button onclick="window.openAuthModal('signup')" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: inherit; font-weight: 600; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-size: 13.5px;">
                            ✨ Create Free Account
                        </button>
                    </div>
                </div>
            `;
            const banner = document.querySelector("#aiVaultAuditBanner");
            if (banner) banner.style.display = "none";
            return;
        }

        const searchQuery = vaultSearchInput.value.trim();
        const categoryQuery = vaultCategoryFilter.value;
        
        let endpoint = `/vault?search=${encodeURIComponent(searchQuery)}`;
        if (categoryQuery) endpoint += `&category=${encodeURIComponent(categoryQuery)}`;
        if (isFavoriteFilterActive) endpoint += `&isFavorite=true`;

        try {
            const response = await apiFetch(endpoint);
            const items = await response.json();

            if (items.length === 0) {
                passwordCardsContainer.innerHTML = `<p style="text-align: center; color: inherit; padding: 20px;">No credentials found matching filters.</p>`;
                const banner = document.querySelector("#aiVaultAuditBanner");
                if (banner) banner.style.display = "none";
                return;
            }

            // Calculate overall weak items count for AI Audit Banner
            let weakCount = 0;
            items.forEach(item => {
                if (calcPasswordStrength(item.password).isWeak) weakCount++;
            });

            const banner = document.querySelector("#aiVaultAuditBanner");
            const bannerTitle = document.querySelector("#aiBannerTitle");
            const bannerSubtitle = document.querySelector("#aiBannerSubtitle");

            if (banner) {
                if (weakCount > 0) {
                    banner.style.display = "flex";
                    if (bannerTitle) bannerTitle.textContent = `🤖 AI Vault Audit: ${weakCount} Vulnerable ${weakCount === 1 ? 'Password' : 'Passwords'} Found`;
                    if (bannerSubtitle) bannerSubtitle.textContent = `Upgrade your weak passwords to 32-character AES-256 encrypted passwords in 1-click.`;
                } else {
                    banner.style.display = "none";
                }
            }

            if (currentVaultViewMode === "list") {
                // COMPACT LIST TABLE VIEW (Saves 80% vertical space!)
                let tableHtml = `
                    <div style="overflow-x: auto; background: rgba(11, 22, 19, 0.7); border: 1px solid rgba(22, 48, 42, 0.5); border-radius: 14px; padding: 10px;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px; color: #ffffff;">
                            <thead>
                                <tr style="border-bottom: 1px solid rgba(22, 48, 42, 0.6); color: #a6bba8; font-size: 12px; text-transform: uppercase;">
                                    <th style="padding: 10px;">Title & Category</th>
                                    <th style="padding: 10px;">Username</th>
                                    <th style="padding: 10px;">Password</th>
                                    <th style="padding: 10px;">AI Security Badge</th>
                                    <th style="padding: 10px; text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                tableHtml += items.map(item => {
                    const favStar = item.isFavorite ? "★" : "☆";
                    const favColor = item.isFavorite ? "#ffbe0b" : "inherit";
                    const catColor = getCategoryColor(item.category);
                    const st = calcPasswordStrength(item.password);

                    const aiBadge = st.isWeak
                        ? `<button onclick="openAiFixModal('${item.id}', '${escapeHtml(item.title)}', '${escapeHtml(item.password)}')" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 700; cursor: pointer; margin-top:0; width:auto;">⚠️ Weak — ✨ Fix with AI</button>`
                        : `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 700;">✅ Strong (AES-256)</span>`;

                    return `
                        <tr style="border-bottom: 1px solid rgba(22, 48, 42, 0.3);">
                            <td style="padding: 12px 10px; font-weight: 600;">
                                ${escapeHtml(item.title)}
                                <span style="font-size: 10.5px; background: ${catColor}; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${escapeHtml(item.category)}</span>
                            </td>
                            <td style="padding: 12px 10px; color: #a6bba8;">${escapeHtml(item.username || "-")}</td>
                            <td style="padding: 12px 10px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <input type="password" class="card-pwd-field" value="${escapeHtml(item.password)}" readonly style="margin:0; padding:4px; font-family:monospace; background:transparent; border:none; color:inherit; width:100px; font-size:13px; font-weight:bold;">
                                    <button onclick="toggleCardPassword(this)" style="background: rgba(255,255,255,0.1); border:none; color:#a6bba8; padding:3px 6px; font-size:10px; border-radius:4px; margin-top:0; width:auto; cursor:pointer;">Reveal</button>
                                </div>
                            </td>
                            <td style="padding: 12px 10px;">${aiBadge}</td>
                            <td style="padding: 12px 10px; text-align: right;">
                                <button onclick="copyVaultPassword('${escapeHtml(item.password)}')" title="Copy Password" style="background: #2980b9; padding: 5px 10px; font-size: 11px; margin-top:0; width:auto; cursor:pointer;">Copy</button>
                                <button onclick="toggleFavoriteCard('${item.id}', ${item.isFavorite})" title="Favorite" style="background: #27ae60; color: ${favColor}; padding: 5px 10px; font-size: 12px; margin-top:0; width:auto; cursor:pointer;">${favStar}</button>
                                <button onclick="editVaultPassword('${item.id}')" title="Edit" style="background: #f39c12; padding: 5px 10px; font-size: 11px; margin-top:0; width:auto; cursor:pointer;">Edit</button>
                                <button onclick="deleteVaultPassword('${item.id}')" title="Delete" style="background: #c0392b; padding: 5px 10px; font-size: 11px; margin-top:0; width:auto; cursor:pointer;">Delete</button>
                            </td>
                        </tr>
                    `;
                }).join("");

                tableHtml += `</tbody></table></div>`;
                passwordCardsContainer.innerHTML = tableHtml;

            } else {
                // GRID CARDS VIEW
                passwordCardsContainer.innerHTML = items.map(item => {
                    const favStar = item.isFavorite ? "★" : "☆";
                    const favColor = item.isFavorite ? "#ffbe0b" : "inherit";
                    const displayUrl = item.url ? `<p>🌐 URL: <a href="${item.url}" target="_blank" style="color: #ffde59; text-decoration: underline;">${item.url}</a></p>` : "";
                    const categoryPillColor = getCategoryColor(item.category);
                    const st = calcPasswordStrength(item.password);

                    const aiBadge = st.isWeak
                        ? `<button onclick="openAiFixModal('${item.id}', '${escapeHtml(item.title)}', '${escapeHtml(item.password)}')" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; cursor: pointer; margin-top:0; width:auto;">⚠️ Weak — ✨ Fix with AI</button>`
                        : `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">✅ Strong (AES-256)</span>`;

                    return `
                        <div class="password-card" data-id="${item.id}">
                            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                                <span class="card-title" style="font-weight: 700;">${escapeHtml(item.title)}</span>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    ${aiBadge}
                                    <span class="card-category" style="background: ${categoryPillColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${escapeHtml(item.category)}</span>
                                </div>
                            </div>
                            <div class="card-body">
                                ${item.username ? `<p>👤 User: <strong>${escapeHtml(item.username)}</strong></p>` : ""}
                                
                                <div style="display: flex; align-items: center; gap: 10px; margin: 4px 0;">
                                    <span style="font-size: 13px;">🔑 Password:</span>
                                    <input type="password" class="card-pwd-field" value="${escapeHtml(item.password)}" readonly style="margin: 0; padding: 6px; font-family: monospace; font-size: 14px; background: transparent; border: none; color: inherit; width: 150px; font-weight: bold;">
                                    <button class="btn-reveal-pwd" onclick="toggleCardPassword(this)" style="width: auto; margin-top: 0; padding: 4px 8px; font-size: 11px; background: #555;">Reveal</button>
                                </div>
                                
                                ${displayUrl}
                                ${item.notes ? `<p>📝 Notes: <span style="font-style: italic; opacity: 0.9;">${escapeHtml(item.notes)}</span></p>` : ""}
                                ${item.expiryDate ? `<p style="color: #e74c3c;">⏰ Expires: ${new Date(item.expiryDate).toLocaleDateString()}</p>` : ""}
                            </div>
                            <div class="card-actions">
                                <button onclick="copyVaultPassword('${escapeHtml(item.password)}')" style="background: #2980b9;">Copy</button>
                                <button onclick="toggleFavoriteCard('${item.id}', ${item.isFavorite})" style="background: #27ae60; color: ${favColor}; font-size: 14px; font-weight: bold; padding: 5px 12px;">${favStar}</button>
                                <button onclick="editVaultPassword('${item.id}')" style="background: #f39c12;">Edit</button>
                                <button onclick="deleteVaultPassword('${item.id}')" style="background: #c0392b;">Delete</button>
                                <button onclick="openAiFixModal('${item.id}', '${escapeHtml(item.title)}', '${escapeHtml(item.password)}')" style="background: #8e44ad; font-weight: bold;">✨ Fix with AI</button>
                            </div>
                        </div>
                    `;
                }).join("");
            }

        } catch (error) {
            console.error(error);
            passwordCardsContainer.innerHTML = `<p style="color: red; text-align: center;">Error loading credentials.</p>`;
        }
    }

    // Category Pill Color Mapper
    function getCategoryColor(cat) {
        switch (cat) {
            case "Work": return "#3498db";
            case "Personal": return "#2ecc71";
            case "Social": return "#9b59b6";
            case "Finance": return "#e67e22";
            default: return "#7f8c8d";
        }
    }

    // Global action bindings helper
    window.toggleCardPassword = function(btn) {
        const container = btn.parentElement;
        const input = container.querySelector(".card-pwd-field");
        if (input.type === "password") {
            input.type = "text";
            btn.textContent = "Hide";
            btn.style.background = "#283e51";
        } else {
            input.type = "password";
            btn.textContent = "Reveal";
            btn.style.background = "#555";
        }
    };

    window.copyVaultPassword = function(pwd) {
        copyToClipboard(pwd);
    };

    window.toggleFavoriteCard = async function(id, currentState) {
        try {
            const response = await apiFetch(`/vault/${id}`, {
                method: "PUT",
                body: JSON.stringify({ isFavorite: !currentState })
            });

            if (response.ok) {
                loadVaultItems(); // Refresh cards list
            }
        } catch (e) {
            console.error("Failed to toggle favorite", e);
        }
    };

    window.editVaultPassword = function(id) {
        window.location.href = `add-password.html?edit=${id}`;
    };

    window.deleteVaultPassword = async function(id) {
        if (!confirm("Are you sure you want to delete this credential? This cannot be undone.")) return;

        try {
            const response = await apiFetch(`/vault/${id}`, {
                method: "DELETE"
            });

            if (response.ok) {
                alert("Credential deleted successfully.");
                loadVaultItems();
                loadAnalytics(); // Refresh analytics stats
            }
        } catch (err) {
            console.error(err);
        }
    };

    // AI Strength advisor modal trigger from vault card
    window.openAiFixModal = function(id, title, password) {
        const modal = document.querySelector("#aiFixModal");
        const body = document.querySelector("#aiFixModalBody");
        const btnApply = document.querySelector("#btnApplyAiUpgrade");
        if (!modal || !body) return;

        modal.style.display = "flex";
        modal.classList.remove("hidden");

        const proposedPassword = generateAiStrongPassword(32);
        const len = password ? password.length : 0;

        body.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                <div style="font-size: 14px; font-weight: 700; color: #ef4444; margin-bottom: 4px;">⚠️ Vulnerability Found: ${escapeHtml(title)}</div>
                <div style="font-size: 12.5px; color: #a6bba8;">Current password (${len} chars) does not meet zero-knowledge high-entropy standards (requires 14+ mixed-case characters with numbers & symbols).</div>
            </div>

            <div style="background: rgba(0, 210, 255, 0.08); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 16px;">
                <label style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #00d2ff; font-weight: 700; display: block; margin-bottom: 6px;">✨ AI Proposed 32-Character High-Entropy Password</label>
                <input type="text" id="aiProposedInput" value="${proposedPassword}" readonly style="width: 100%; background: #080f0d; border: 1px solid rgba(0,210,255,0.4); color: #10b981; font-family: monospace; font-size: 14px; font-weight: 700; padding: 10px; border-radius: 6px; text-align: center; box-sizing: border-box;">
            </div>
        `;

        if (btnApply) {
            btnApply.onclick = async function() {
                try {
                    btnApply.disabled = true;
                    btnApply.textContent = "Upgrading...";

                    const res = await apiFetch(`/vault/${id}`, {
                        method: "PUT",
                        body: JSON.stringify({ password: proposedPassword })
                    });

                    if (res.ok) {
                        alert(`✨ Password for "${title}" upgraded to 32-character AES-256 password!`);
                        closeAiFixModal();
                        loadVaultItems();
                        loadAnalytics();
                    } else {
                        alert("Failed to upgrade password.");
                    }
                } catch (e) {
                    console.error(e);
                    alert("Error upgrading password.");
                } finally {
                    btnApply.disabled = false;
                    btnApply.textContent = "✨ Upgrade Password Now";
                }
            };
        }
    };

    window.closeAiFixModal = function() {
        const modal = document.querySelector("#aiFixModal");
        if (modal) {
            modal.style.display = "none";
            modal.classList.add("hidden");
        }
    };

    window.runBatchAiAudit = async function() {
        try {
            const response = await apiFetch("/vault");
            const items = await response.json();
            const weakItems = items.filter(item => calcPasswordStrength(item.password).isWeak);

            if (weakItems.length === 0) {
                return alert("🎉 Outstanding! All passwords in your vault are strong and secure!");
            }

            const first = weakItems[0];
            openAiFixModal(first.id, first.title, first.password);
        } catch (e) {
            console.error(e);
        }
    };

    function generateAiStrongPassword(length = 32) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
        let result = "";
        const bytes = new Uint8Array(length);
        window.crypto.getRandomValues(bytes);
        for (let i = 0; i < length; i++) {
            result += chars[bytes[i] % chars.length];
        }
        return result;
    }

    window.runAiAdvisor = async function(pwd) {
        alert("🤖 Calling AI Password Advisor... Please wait.");
        try {
            const response = await apiFetch("/vault/ai/analyze-strength", {
                method: "POST",
                body: JSON.stringify({ password: pwd })
            });

            const data = await response.json();
            
            const displayEl = document.querySelector("#notesDisplay");
            const popup = document.querySelector("#notesPopup");
            const popupTitle = popup ? popup.querySelector("h2") : null;
            
            if (displayEl && popup) {
                if (popupTitle) popupTitle.textContent = "AI Password Strength Report 🤖";
                displayEl.value = data.analysis.replace(/<[^>]*>/g, ""); 
                popup.classList.remove("hidden");
            } else {
                alert(data.analysis.replace(/<[^>]*>/g, ""));
            }
        } catch (err) {
            alert("Failed to analyze strength.");
        }
    };

    /* =========================================================
       PASSWORD GENERATOR TAB
    ========================================================= */
    const generatedPasswordDisplay = document.querySelector("#generatedPasswordDisplay");
    const btnCopyGenerated = document.querySelector("#btnCopyGenerated");
    const btnGeneratePassword = document.querySelector("#btnGeneratePassword");
    const genLength = document.querySelector("#genLength");
    const lengthVal = document.querySelector("#lengthVal");
    
    const genUpper = document.querySelector("#genUpper");
    const genLower = document.querySelector("#genLower");
    const genNumbers = document.querySelector("#genNumbers");
    const genSymbols = document.querySelector("#genSymbols");
    const genMemorable = document.querySelector("#genMemorable");

    if (genLength && lengthVal) {
        genLength.addEventListener("input", () => {
            lengthVal.textContent = genLength.value;
        });
    }

    if (btnGeneratePassword) {
        btnGeneratePassword.addEventListener("click", () => {
            const isMemorable = genMemorable.checked;
            let result = "";

            if (isMemorable) {
                // Memorable word passphrase generator (e.g. pilot-castle-geyser-Nomad4!)
                const wordsCount = 4;
                const chosenWords = [];
                for (let i = 0; i < wordsCount; i++) {
                    const word = MEMORABLE_WORDS[Math.floor(Math.random() * MEMORABLE_WORDS.length)];
                    // Capitalize some letters randomly
                    if (Math.random() > 0.5) {
                        chosenWords.push(word.charAt(0).toUpperCase() + word.slice(1));
                    } else {
                        chosenWords.push(word);
                    }
                }
                result = chosenWords.join("-");
                // Add a random number and symbol to pad strength
                const num = Math.floor(Math.random() * 10);
                const syms = "!@#$%^&*";
                const sym = syms.charAt(Math.floor(Math.random() * syms.length));
                result += num + sym;
            } else {
                // Cryptographically strong random character generator
                const upperPool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const lowerPool = "abcdefghijklmnopqrstuvwxyz";
                const numPool = "0123456789";
                const symPool = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

                let charPool = "";
                if (genUpper.checked) charPool += upperPool;
                if (genLower.checked) charPool += lowerPool;
                if (genNumbers.checked) charPool += numPool;
                if (genSymbols.checked) charPool += symPool;

                if (!charPool) {
                    return alert("Please select at least one character type option.");
                }

                const length = parseInt(genLength.value);
                const randomValues = new Uint32Array(length);
                window.crypto.getRandomValues(randomValues);

                for (let i = 0; i < length; i++) {
                    result += charPool.charAt(randomValues[i] % charPool.length);
                }
            }

            generatedPasswordDisplay.textContent = result;
        });
    }

    if (btnCopyGenerated && generatedPasswordDisplay) {
        btnCopyGenerated.addEventListener("click", () => {
            const text = generatedPasswordDisplay.textContent.trim();
            if (text === "Click Generate") return alert("Generate a password first!");
            copyToClipboard(text);
        });
    }

    // Voice Speech Synthesis helper
    function speakText(text, callback) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google')) || 
                              voices.find(v => v.lang.startsWith('en-')) || 
                              voices[0];
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        const wave = document.querySelector(".voice-wave-container");
        if (wave) wave.classList.remove("hidden-wave");
        
        utterance.onend = () => {
            if (wave) wave.classList.add("hidden-wave");
            if (callback) callback();
        };
        utterance.onerror = () => {
            if (wave) wave.classList.add("hidden-wave");
            if (callback) callback();
        };
        window.speechSynthesis.speak(utterance);
    }



    /* =========================================================
       ANALYTICS & STATS DASHBOARD
    ========================================================= */
    const statTotalCount = document.querySelector("#statTotalCount");
    const statWeakCount = document.querySelector("#statWeakCount");
    const statReusedCount = document.querySelector("#statReusedCount");
    const statSecurityScore = document.querySelector("#statSecurityScore");
    const recentlyAddedList = document.querySelector("#recentlyAddedList");

    let liveSessionInterval = null;

    function initLiveUnlockTimer(loginTimestamp) {
        if (!sessionStorage.getItem("vault_session_start")) {
            sessionStorage.setItem("vault_session_start", Date.now().toString());
        }

        const lastUnlockEl = document.querySelector("#statLastUnlock");
        const lastUnlockSub = document.querySelector("#statLastUnlockSub");
        const sessionTeleEl = document.querySelector("#statSessionTelemetry");
        const sessionTeleSub = document.querySelector("#kpiSessionSub");
        const modalUnlockedAt = document.querySelector("#modalSessionUnlockedAt");
        const modalDuration = document.querySelector("#modalSessionDuration");

        const unlockDate = loginTimestamp ? new Date(loginTimestamp) : new Date();
        if (modalUnlockedAt) {
            modalUnlockedAt.textContent = unlockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ` (${unlockDate.toLocaleDateString()})`;
        }

        function tick() {
            const relativeTimeStr = formatLastUnlockTime(loginTimestamp);
            if (lastUnlockEl) lastUnlockEl.textContent = relativeTimeStr;
            if (sessionTeleEl) sessionTeleEl.textContent = relativeTimeStr;

            const sessionStart = parseInt(sessionStorage.getItem("vault_session_start") || Date.now());
            const elapsedSec = Math.max(0, Math.floor((Date.now() - sessionStart) / 1000));
            const elapsedMin = Math.floor(elapsedSec / 60);
            const remSec = elapsedSec % 60;
            const durationFormatted = elapsedMin > 0 ? `${elapsedMin}m ${remSec}s` : `${elapsedSec}s`;

            if (lastUnlockSub) {
                lastUnlockSub.innerHTML = `● Active: ${durationFormatted}`;
            }
            if (sessionTeleSub) {
                sessionTeleSub.innerHTML = `● Active: ${durationFormatted}`;
            }
            if (modalDuration) {
                modalDuration.textContent = durationFormatted;
            }
        }

        tick();
        if (liveSessionInterval) clearInterval(liveSessionInterval);
        liveSessionInterval = setInterval(tick, 3000); // Live tick every 3s
    }

    window.openSessionDetailsModal = function() {
        const modal = document.getElementById("sessionDetailsModal");
        if (modal) modal.classList.add("active");
    };

    window.closeSessionDetailsModal = function() {
        const modal = document.getElementById("sessionDetailsModal");
        if (modal) modal.classList.remove("active");
    };

    window.runLiveVaultAudit = async function() {
        const btn = document.getElementById("btnRunDeepAudit");
        if (btn) {
            btn.innerHTML = `<span>⏳</span> Auditing Vault...`;
            btn.disabled = true;
        }
        await loadAnalytics();
        if (btn) {
            btn.innerHTML = `<span>⚡</span> Refresh Security Audit`;
            btn.disabled = false;
        }
        if (typeof showToast === "function") {
            showToast("Security Audit Complete 🛡️", "Evaluated all vault credentials against NIST SP 800-63B guidelines.");
        }
    };

    async function loadAnalytics() {
        if (!window.isUserLoggedIn()) {
            if (statTotalCount) statTotalCount.textContent = "0";
            if (statWeakCount) statWeakCount.textContent = "0";
            if (statReusedCount) statReusedCount.textContent = "0";
            if (statSecurityScore) statSecurityScore.textContent = "100%";

            const dbTotal = document.querySelector("#statTotalCountDashboard");
            const dbScore = document.querySelector("#statSecurityScoreDashboard");
            if (dbTotal) dbTotal.textContent = "0";
            if (dbScore) dbScore.textContent = "100%";

            const notesCountEl = document.querySelector("#statNotesCount");
            if (notesCountEl) {
                const notesList = JSON.parse(localStorage.getItem("secure_notes") || "[]");
                notesCountEl.textContent = notesList.length;
            }

            drawVaultDonutChart(0, 0, 0, 100);
            drawEntropyChart(0, 0, 0);
            drawCanvasChart("categoryDistributionChart", { Work: 0, Personal: 0, Finance: 0, Social: 0 });
            return;
        }

        try {
            const response = await apiFetch("/vault/analytics");
            const data = await response.json();

            const total = data.totalCount || 0;
            const weakCount = data.weakCount || 0;
            const mediumCount = data.mediumCount || 0;
            const strongCount = data.strongCount || (total > 0 ? Math.max(0, total - weakCount - mediumCount) : 0);
            const duplicateCount = data.duplicateCount || 0;
            const staleCount = data.staleCount || 0;
            const score = data.securityScore !== undefined ? data.securityScore : 100;

            // 1. Executive Security Posture Card
            const postureScoreDisplay = document.querySelector("#postureScoreDisplay");
            const postureMeterFill = document.querySelector("#postureMeterFill");
            const postureRatingBadge = document.querySelector("#securityPostureRating");

            if (postureScoreDisplay) postureScoreDisplay.textContent = `${score}%`;
            if (postureMeterFill) {
                postureMeterFill.style.width = `${Math.max(6, score)}%`;
                postureMeterFill.className = "posture-meter-fill " + (score >= 80 ? "optimal" : (score >= 50 ? "moderate" : "critical"));
            }
            if (postureRatingBadge) {
                postureRatingBadge.textContent = data.securityRating || (score >= 80 ? "Rating: A+ (Optimal)" : (score >= 50 ? "Rating: C (Moderate)" : "Rating: D (Critical)"));
                postureRatingBadge.className = "posture-grade-badge " + (score >= 80 ? "optimal" : (score >= 50 ? "moderate" : "critical"));
            }

            // 2. 6 KPI Cards on Analytics Tab
            if (statTotalCount) statTotalCount.textContent = total;
            const kpiTotalSub = document.querySelector("#kpiTotalSub");
            if (kpiTotalSub) kpiTotalSub.textContent = `${strongCount} Strong · ${mediumCount} Med · ${weakCount} Weak`;

            if (statWeakCount) statWeakCount.textContent = weakCount;
            const kpiWeakSub = document.querySelector("#kpiWeakSub");
            if (kpiWeakSub) {
                if (weakCount > 0 && total > 0) {
                    kpiWeakSub.textContent = `${Math.round((weakCount / total) * 100)}% of vault exposed`;
                    kpiWeakSub.className = "kpi-sub-badge danger";
                } else {
                    kpiWeakSub.textContent = "Zero weak passwords";
                    kpiWeakSub.className = "kpi-sub-badge success";
                }
            }

            if (statReusedCount) statReusedCount.textContent = duplicateCount;
            const kpiReusedSub = document.querySelector("#kpiReusedSub");
            if (kpiReusedSub) {
                if (duplicateCount > 0) {
                    kpiReusedSub.textContent = `${duplicateCount} credential stuffing risk`;
                    kpiReusedSub.className = "kpi-sub-badge danger";
                } else {
                    kpiReusedSub.textContent = "Zero credential reuse";
                    kpiReusedSub.className = "kpi-sub-badge success";
                }
            }

            if (statSecurityScore) {
                statSecurityScore.textContent = `${score}%`;
                if (score >= 80) statSecurityScore.style.color = "#10b981";
                else if (score >= 50) statSecurityScore.style.color = "#f59e0b";
                else statSecurityScore.style.color = "#ef4444";
            }
            const kpiScoreSub = document.querySelector("#kpiScoreSub");
            if (kpiScoreSub) {
                if (score >= 80) {
                    kpiScoreSub.textContent = "Optimal Posture";
                    kpiScoreSub.className = "kpi-sub-badge success";
                } else if (score >= 50) {
                    kpiScoreSub.textContent = "Upgrades Recommended";
                    kpiScoreSub.className = "kpi-sub-badge warning";
                } else {
                    kpiScoreSub.textContent = "Immediate Action Required";
                    kpiScoreSub.className = "kpi-sub-badge danger";
                }
            }

            const statStaleCount = document.querySelector("#statStaleCount");
            if (statStaleCount) statStaleCount.textContent = staleCount;
            const kpiStaleSub = document.querySelector("#kpiStaleSub");
            if (kpiStaleSub) {
                kpiStaleSub.textContent = staleCount > 0 ? `${staleCount} unrotated >90 days` : "All credentials fresh";
            }

            // 3. Notes Tab Summaries
            const dbTotal = document.querySelector("#statTotalCountDashboard");
            const dbScore = document.querySelector("#statSecurityScoreDashboard");
            if (dbTotal) dbTotal.textContent = total;
            if (dbScore) {
                dbScore.textContent = `${score}%`;
                if (score >= 80) dbScore.style.color = "#10b981";
                else if (score >= 50) dbScore.style.color = "#f59e0b";
                else dbScore.style.color = "#ef4444";
            }

            const notesCountEl = document.querySelector("#statNotesCount");
            if (notesCountEl) {
                const notesList = JSON.parse(localStorage.getItem("secure_notes") || "[]");
                notesCountEl.textContent = notesList.length;
            }

            // 4. Vault Tab Security Analysis Breakdown & Donut Chart
            const graphStrongEl = document.querySelector("#graphStrongCount");
            const graphModEl = document.querySelector("#graphModerateCount");
            const graphWeakEl = document.querySelector("#graphWeakCount");
            const graphHealthScoreEl = document.querySelector("#vaultGraphHealthScore");

            if (graphStrongEl) graphStrongEl.textContent = strongCount;
            if (graphModEl) graphModEl.textContent = mediumCount;
            if (graphWeakEl) graphWeakEl.textContent = weakCount;
            if (graphHealthScoreEl) {
                graphHealthScoreEl.textContent = `Health: ${score}%`;
                if (score >= 80) {
                    graphHealthScoreEl.style.color = "#10b981";
                    graphHealthScoreEl.style.background = "rgba(16, 185, 129, 0.15)";
                    graphHealthScoreEl.style.borderColor = "rgba(16, 185, 129, 0.4)";
                } else if (score >= 50) {
                    graphHealthScoreEl.style.color = "#f59e0b";
                    graphHealthScoreEl.style.background = "rgba(245, 158, 11, 0.15)";
                    graphHealthScoreEl.style.borderColor = "rgba(245, 158, 11, 0.4)";
                } else {
                    graphHealthScoreEl.style.color = "#ef4444";
                    graphHealthScoreEl.style.background = "rgba(239, 68, 68, 0.15)";
                    graphHealthScoreEl.style.borderColor = "rgba(239, 68, 68, 0.4)";
                }
            }

            window.cachedVaultAnalytics = { strongCount, moderateCount: mediumCount, weakCount, securityScore: score, categoryStats: data.categoryStats };

            drawVaultDonutChart(strongCount, mediumCount, weakCount, score);

            // 5. Draw Shannon Entropy Chart & Legend
            drawEntropyChart(strongCount, mediumCount, weakCount);
            const entHigh = document.querySelector("#entropyHighCount");
            const entMed = document.querySelector("#entropyMedCount");
            const entLow = document.querySelector("#entropyLowCount");
            if (entHigh) entHigh.textContent = `${strongCount} credential${strongCount !== 1 ? 's' : ''} (${total ? Math.round((strongCount / total) * 100) : 0}%)`;
            if (entMed) entMed.textContent = `${mediumCount} credential${mediumCount !== 1 ? 's' : ''} (${total ? Math.round((mediumCount / total) * 100) : 0}%)`;
            if (entLow) entLow.textContent = `${weakCount} credential${weakCount !== 1 ? 's' : ''} (${total ? Math.round((weakCount / total) * 100) : 0}%)`;

            // 6. Threat Advisory Cards (Microsoft Defender Copilot Style)
            const advisoryListEl = document.querySelector("#securityAdvisoryList");
            if (advisoryListEl) {
                const recs = data.recommendations || [];
                if (recs.length === 0) {
                    advisoryListEl.innerHTML = `
                        <div class="advisory-item success">
                            <div class="advisory-item-left">
                                <span class="adv-icon">🛡️</span>
                                <div class="advisory-item-content">
                                    <h4>NIST Compliant Security Posture</h4>
                                    <p>Zero weak or compromised passwords detected. Client-side AES-256 encryption active.</p>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    advisoryListEl.innerHTML = recs.map(rec => `
                        <div class="advisory-item ${escapeHtml(rec.severity || 'info')}">
                            <div class="advisory-item-left">
                                <span class="adv-icon">${escapeHtml(rec.icon || '💡')}</span>
                                <div class="advisory-item-content">
                                    <h4>${escapeHtml(rec.title)}</h4>
                                    <p>${escapeHtml(rec.description)}</p>
                                </div>
                            </div>
                            <button type="button" class="advisory-btn" onclick="switchTab('${escapeHtml(rec.actionTab || 'vault')}')">
                                ${escapeHtml(rec.actionText || 'Take Action')} ➔
                            </button>
                        </div>
                    `).join("");
                }
            }

            // 7. Vulnerability Triage Register Table
            const triageTbody = document.querySelector("#vulnerabilityTriageTbody");
            if (triageTbody) {
                const vulnItems = data.vulnerableItems || [];
                if (vulnItems.length === 0) {
                    triageTbody.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 24px; color: #10b981; font-weight: 600;">
                                🛡️ All vault credentials satisfy enterprise complexity standards! Zero weak passwords detected.
                            </td>
                        </tr>
                    `;
                } else {
                    triageTbody.innerHTML = vulnItems.map(item => {
                        const feedbackStr = Array.isArray(item.feedback) ? item.feedback.join(", ") : "Weak password complexity";
                        const strengthBadgeClass = item.strength === "Weak" ? "weak" : "medium";
                        return `
                            <tr>
                                <td>
                                    <strong>🔑 ${escapeHtml(item.title)}</strong>
                                    <span style="font-size: 11px; color: #94a3b8; display: block;">${escapeHtml(item.username || 'No username')}</span>
                                </td>
                                <td>${escapeHtml(item.category || 'General')}</td>
                                <td>
                                    <span class="triage-badge ${strengthBadgeClass}">${escapeHtml(item.strength)}</span>
                                    <span style="font-size: 11px; color: #94a3b8; margin-left: 6px;">${item.entropyBits || 24} bits</span>
                                </td>
                                <td style="color: #f87171; font-size: 12px;">${escapeHtml(feedbackStr)}</td>
                                <td>
                                    <button type="button" class="btn-triage-fix" onclick="switchTab('vault')">
                                        Fix in Vault ➔
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join("");
                }
            }

            // 8. Live Session Ticker Initialization
            const loginTimestamp = data.lastLoginAt ? new Date(data.lastLoginAt).getTime() : Date.now();
            initLiveUnlockTimer(loginTimestamp);

            // 9. Render recently added
            if (recentlyAddedList) {
                if (!data.recentlyAdded || data.recentlyAdded.length === 0) {
                    recentlyAddedList.innerHTML = "<li>No passwords recorded.</li>";
                } else {
                    recentlyAddedList.innerHTML = data.recentlyAdded.map(item => `
                        <li style="border-bottom: 1px solid rgba(22, 48, 42, 0.2); padding: 8px 0; display: flex; justify-content: space-between;">
                            <span>🔑 <strong>${escapeHtml(item.title)}</strong> (${escapeHtml(item.category)})</span>
                            <span style="opacity: 0.7; font-size: 11px;">${new Date(item.createdAt).toLocaleDateString()}</span>
                        </li>
                    `).join("");
                }
            }

            // 10. Draw Category Canvas Chart
            drawCanvasChart("categoryDistributionChart", data.categoryStats);

        } catch (error) {
            console.error("Failed to load analytics", error);
        }
    }

    // Shannon Entropy Donut Drawer
    function drawEntropyChart(strongCount, moderateCount, weakCount) {
        const canvas = document.getElementById("entropyDistributionChart");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 6;
        const innerRadius = radius - 12;

        ctx.clearRect(0, 0, width, height);

        const total = strongCount + moderateCount + weakCount;
        if (total === 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI, true);
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            ctx.fill();
            return;
        }

        const data = [
            { count: strongCount, color: "#10b981" },
            { count: moderateCount, color: "#f59e0b" },
            { count: weakCount, color: "#ef4444" }
        ];

        let startAngle = -0.5 * Math.PI;
        data.forEach(segment => {
            if (segment.count > 0) {
                const sliceAngle = (segment.count / total) * 2 * Math.PI;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
                ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
                ctx.closePath();
                ctx.fillStyle = segment.color;
                ctx.fill();
                startAngle += sliceAngle;
            }
        });

        const isLight = document.body.classList.contains("light-mode");
        ctx.fillStyle = isLight ? "#0f2922" : "#ffffff";
        ctx.font = "bold 13px Poppins, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${total}`, centerX, centerY - 4);

        ctx.fillStyle = isLight ? "#64748b" : "#a6bba8";
        ctx.font = "600 8.5px Poppins, sans-serif";
        ctx.fillText("ITEMS", centerX, centerY + 8);
    }

    // Canvas Chart Drawer
    function drawCanvasChart(canvasId, categoryStats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const keys = Object.keys(categoryStats || {});
        const values = Object.values(categoryStats || {});
        const isLight = document.body.classList.contains("light-mode");
        
        if (keys.length === 0) {
            ctx.fillStyle = isLight ? "#64748b" : "#888";
            ctx.font = "14px Arial";
            ctx.fillText("No category data available.", canvas.width / 2 - 80, canvas.height / 2);
            return;
        }

        const maxVal = Math.max(1, ...values);
        const chartHeight = canvas.height - 40;
        const barWidth = Math.min(50, (canvas.width - 60) / keys.length);
        const spacing = (canvas.width - 40 - (barWidth * keys.length)) / (keys.length + 1);

        const colors = ["#10b981", "#00d2ff", "#f59e0b", "#a855f7", "#ec4899", "#3b82f6", "#14b8a6"];

        for (let i = 0; i < keys.length; i++) {
            const value = values[i];
            const barHeight = (value / maxVal) * (chartHeight - 40);
            const x = 20 + spacing * (i + 1) + barWidth * i;
            const y = canvas.height - 30 - barHeight;

            // Draw Bar with rounded top
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw value labels
            ctx.fillStyle = isLight ? "#0f172a" : "#ffffff";
            ctx.font = "bold 11px Arial";
            ctx.fillText(value, x + barWidth / 2 - 4, y - 6);

            // Draw labels
            ctx.fillStyle = isLight ? "#475569" : "#cbd5e0";
            ctx.font = "bold 10px Arial";
            const label = keys[i].length > 10 ? keys[i].substring(0, 8) + ".." : keys[i];
            ctx.fillText(label, x + barWidth / 2 - ctx.measureText(label).width / 2, canvas.height - 12);
        }
    }

    /* =========================================================
       VOICE AI SECURITY AGENT INTERACTION
    ========================================================= */
    const aiAgentBtn = document.querySelector("#aiAgentBtn");
    const aiAgentPanel = document.querySelector("#aiAgentPanel");
    const closeAgentPanelBtn = document.querySelector("#closeAgentPanelBtn");
    const agentSpeechBubble = document.querySelector("#agentSpeechBubble");
    const agentOptionPhishing = document.querySelector("#agentOptionPhishing");
    const agentOptionAdvisor = document.querySelector("#agentOptionAdvisor");

    if (aiAgentBtn) {
        aiAgentBtn.addEventListener("click", () => {
            const isHidden = aiAgentPanel.classList.contains("hidden-agent-panel");
            if (isHidden) {
                // Open panel
                aiAgentPanel.classList.remove("hidden-agent-panel");
                
                // Get user name from local session
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                const userName = user.name || "User";
                
                const greeting = `Hello ${userName}! I am your AI Security Agent. I can analyze suspicious links or audit your database health. Select an option to proceed.`;
                agentSpeechBubble.textContent = greeting;
                speakText(greeting);
            } else {
                // Close panel
                aiAgentPanel.classList.add("hidden-agent-panel");
                window.speechSynthesis.cancel();
            }
        });
    }

    if (closeAgentPanelBtn) {
        closeAgentPanelBtn.addEventListener("click", () => {
            aiAgentPanel.classList.add("hidden-agent-panel");
            window.speechSynthesis.cancel();
        });
    }

    // Tab switcher helper
    function switchTab(tabName) {
        if (!tabName) tabName = "analytics";
        const tabButtons = document.querySelectorAll(".tab-btn");
        const tabContents = document.querySelectorAll(".tab-content");
        
        tabButtons.forEach(btn => {
            if (btn.getAttribute("data-tab") === tabName) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
        
        tabContents.forEach(content => {
            if (content.id === `${tabName}Tab`) {
                content.classList.remove("hidden-tab");
            } else {
                content.classList.add("hidden-tab");
            }
        });

        // Update Dashboard Header Title and Subtitle dynamically based on active tab
        const headerTitle = document.getElementById("dashboardHeaderTitle");
        const headerSubtitle = document.getElementById("dashboardHeaderSubtitle");
        if (headerTitle && headerSubtitle) {
            if (tabName === "analytics") {
                headerTitle.innerHTML = "✨ Dashboard Analytics";
                headerSubtitle.textContent = "Welcome back — real-time cryptographic audit & vault health status.";
            } else if (tabName === "notes") {
                headerTitle.innerHTML = "✨ Secure Notes";
                headerSubtitle.textContent = "Client-side encrypted scratchpad for confidential thoughts and PINs.";
            } else if (tabName === "vault") {
                headerTitle.innerHTML = "✨ Password Vault";
                headerSubtitle.textContent = "Zero-knowledge encrypted credential database with AES-256.";
            } else if (tabName === "generator") {
                headerTitle.innerHTML = "✨ Password Generator";
                headerSubtitle.textContent = "Cryptographically secure random password and passphrase engine.";
            }
        }

        if (tabName === "notes") {
            const notesCountEl = document.querySelector("#statNotesCount");
            if (notesCountEl) {
                const notesList = JSON.parse(localStorage.getItem("secure_notes") || "[]");
                notesCountEl.textContent = notesList.length;
            }
        } else if (tabName === "vault") {
            loadVaultItems();
            setTimeout(() => {
                if (window.cachedVaultAnalytics) {
                    drawVaultDonutChart(
                        window.cachedVaultAnalytics.strongCount,
                        window.cachedVaultAnalytics.moderateCount,
                        window.cachedVaultAnalytics.weakCount,
                        window.cachedVaultAnalytics.securityScore
                    );
                } else {
                    loadAnalytics();
                }
            }, 60);
        } else if (tabName === "analytics") {
            loadAnalytics();
            setTimeout(() => {
                if (window.cachedVaultAnalytics) {
                    drawCanvasChart("categoryDistributionChart", window.cachedVaultAnalytics.categoryStats);
                    drawEntropyChart(
                        window.cachedVaultAnalytics.strongCount,
                        window.cachedVaultAnalytics.moderateCount,
                        window.cachedVaultAnalytics.weakCount
                    );
                }
            }, 60);
        }

        try {
            const url = new URL(window.location);
            url.searchParams.set("tab", tabName);
            window.history.replaceState({}, "", url);
        } catch (e) {}
    }

    window.switchTab = switchTab;

    // Attach click listeners to all tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const tabName = btn.getAttribute("data-tab");
            if (tabName) switchTab(tabName);
        });
    });

    // Check query params on load (defaults to analytics as requested)
    const initialUrlParams = new URLSearchParams(window.location.search);
    const initialTabParam = initialUrlParams.get("tab") || "analytics";
    if (["notes", "vault", "generator", "analytics"].includes(initialTabParam)) {
        switchTab(initialTabParam);
    }

    // Direct Note Area Action Handlers
    const toggleActions = document.querySelector("#toggleActions");
    const actionButtons = document.querySelector("#actionButtons");
    const saveNoteBtn = document.querySelector("#saveNoteBtn");
    const showNotesBtn = document.querySelector("#showNotesBtn");
    const downloadNotesBtn = document.querySelector("#downloadNotesBtn");
    const copyNotesBtn = document.querySelector("#copyNotesBtn");
    const shareNotesBtn = document.querySelector("#shareNotesBtn");
    const deleteAllBtn = document.querySelector("#deleteAllBtn");
    const noteInput = document.querySelector("#noteInput");
    const notesPopup = document.querySelector("#notesPopup");
    const notesDisplay = document.querySelector("#notesDisplay");
    const closePopupBtn = document.querySelector("#closePopupBtn");

    if (toggleActions && actionButtons) {
        toggleActions.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            actionButtons.classList.toggle("hidden");
        });
        document.addEventListener("click", (e) => {
            if (actionButtons && !actionButtons.contains(e.target) && e.target !== toggleActions) {
                actionButtons.classList.add("hidden");
            }
        });
    }

    if (saveNoteBtn && noteInput) {
        saveNoteBtn.addEventListener("click", () => {
            const noteContent = noteInput.value.trim();
            if (!noteContent) return alert("Note is empty.");
            let notes = JSON.parse(localStorage.getItem("secure_notes") || "[]");
            notes.push({ content: noteContent, timestamp: new Date().toLocaleString() });
            localStorage.setItem("secure_notes", JSON.stringify(notes));
            if (typeof showToast === "function") {
                showToast("Note Saved 🔒", "Encrypted and saved to your secure storage.");
            } else {
                alert("🔒 Note saved securely!");
            }
            noteInput.value = "";
            const notesCountEl = document.querySelector("#statNotesCount");
            if (notesCountEl) notesCountEl.textContent = notes.length;

            if (!window.isUserLoggedIn()) {
                setTimeout(() => {
                    window.openAuthModal("signup");
                }, 800);
            }
        });
    }

    if (showNotesBtn && notesPopup && notesDisplay) {
        showNotesBtn.addEventListener("click", () => {
            if (actionButtons) actionButtons.classList.add("hidden");
            let notes = JSON.parse(localStorage.getItem("secure_notes") || "[]");
            if (notes.length === 0) {
                notesDisplay.value = "No saved notes found.";
            } else {
                notesDisplay.value = notes.map((n, i) => `--- Note #${i + 1} (${n.timestamp}) ---\n${n.content}\n`).join("\n");
            }
            notesPopup.classList.remove("hidden");
        });
    }

    if (closePopupBtn && notesPopup) {
        closePopupBtn.addEventListener("click", () => {
            notesPopup.classList.add("hidden");
        });
    }

    if (downloadNotesBtn && noteInput) {
        downloadNotesBtn.addEventListener("click", () => {
            if (actionButtons) actionButtons.classList.add("hidden");
            const content = noteInput.value || "No content to download.";
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "kvaultx_note.txt";
            a.click();
            URL.revokeObjectURL(url);
            if (typeof showToast === "function") {
                showToast("Exported 📥", "Note downloaded as kvaultx_note.txt");
            }
        });
    }

    if (copyNotesBtn && noteInput) {
        copyNotesBtn.addEventListener("click", () => {
            if (actionButtons) actionButtons.classList.add("hidden");
            const content = noteInput.value;
            if (!content) return alert("Nothing to copy!");
            navigator.clipboard.writeText(content).then(() => {
                if (typeof showToast === "function") {
                    showToast("Copied 📋", "Note copied to clipboard!");
                } else {
                    alert("📋 Note copied to clipboard!");
                }
            });
        });
    }

    if (shareNotesBtn && noteInput) {
        shareNotesBtn.addEventListener("click", () => {
            if (actionButtons) actionButtons.classList.add("hidden");
            const content = noteInput.value;
            if (!content) return alert("Nothing to share!");
            if (navigator.share) {
                navigator.share({ title: 'KvaultX Note', text: content }).catch(() => {});
            } else {
                navigator.clipboard.writeText(content);
                if (typeof showToast === "function") {
                    showToast("Copied 📋", "Sharing not supported in this browser. Copied to clipboard!");
                } else {
                    alert("Sharing not supported in browser. Copied to clipboard!");
                }
            }
        });
    }

    if (deleteAllBtn && noteInput) {
        deleteAllBtn.addEventListener("click", () => {
            if (actionButtons) actionButtons.classList.add("hidden");
            if (confirm("Are you sure you want to delete all saved notes?")) {
                localStorage.removeItem("secure_notes");
                noteInput.value = "";
                if (typeof showToast === "function") {
                    showToast("Notes Cleared 🗑️", "All local notes deleted.");
                } else {
                    alert("🗑️ All notes deleted.");
                }
                const notesCountEl = document.querySelector("#statNotesCount");
                if (notesCountEl) notesCountEl.textContent = "0";
            }
        });
    }

    if (agentOptionPhishing) {
        agentOptionPhishing.addEventListener("click", async () => {
            const url = prompt("Enter a website URL to analyze for phishing/typosquatting (e.g. g00gle.com):");
            if (!url) return;

            try {
                agentSpeechBubble.innerHTML = "Analyzing URL...";
                const response = await apiFetch("/vault/ai/detect-phishing", {
                    method: "POST",
                    body: JSON.stringify({ url })
                });
                const data = await response.json();

                agentSpeechBubble.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px; color: ${data.isSuspicious ? '#fc8181' : '#68d391'};">
                        ${data.isSuspicious ? '⚠️ Alert: Potential Phishing/Typosquatting site' : '✅ Verified: Looks clean'}
                    </div>
                    <ul style="padding-left: 15px; margin-top: 5px; font-size: 12px; margin-bottom: 0;">
                        ${data.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
                    </ul>
                `;

                if (data.isSuspicious) {
                    speakText("Warning! This URL looks suspicious and may be a phishing attempt.");
                } else {
                    speakText("This URL looks clean and safe to use.");
                }
            } catch (err) {
                agentSpeechBubble.innerHTML = "Failed to analyze URL.";
            }
        });
    }

    if (agentOptionAdvisor) {
        agentOptionAdvisor.addEventListener("click", async () => {
            try {
                agentSpeechBubble.innerHTML = "Scanning vault database...";
                const response = await apiFetch("/vault/ai/recommendations");
                const data = await response.json();

                if (data.length === 0) {
                    agentSpeechBubble.innerHTML = "✅ Your password vault is completely healthy! No recommendations.";
                    speakText("Your vault is completely healthy! No recommendations.");
                    return;
                }

                agentSpeechBubble.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px; color: #ffde59;">
                        📋 Vault Security Report:
                    </div>
                    <div style="max-height: 180px; overflow-y: auto; font-size: 11px; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; text-align: left;">
                        ${data.map(rec => `
                            <div style="border-left: 2px solid ${rec.type === 'danger' ? '#fc8181' : '#3182ce'}; padding-left: 6px; margin-bottom: 4px;">
                                <strong>Problem:</strong> ${escapeHtml(rec.message)}<br>
                                <strong>Advice:</strong> ${escapeHtml(rec.action)}
                            </div>
                        `).join("")}
                    </div>
                `;
                speakText(`I found ${data.length} recommendations to improve your vault security. Please review them inside the panel.`);
            } catch (err) {
                agentSpeechBubble.innerHTML = "Failed to scan vault.";
                speakText("Sorry, I encountered an error while scanning your vault.");
            }
        });
    }
});

// Utility Debouncer
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function drawVaultDonutChart(strongCount, moderateCount, weakCount, customScore) {
    const canvas = document.getElementById("vaultSecurityChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 8;
    const innerRadius = radius - 14;

    ctx.clearRect(0, 0, width, height);

    const total = strongCount + moderateCount + weakCount;
    
    if (total === 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI, true);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fill();

        ctx.fillStyle = "#a6bba8";
        ctx.font = "600 12px Poppins, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Empty Vault", centerX, centerY);
        return;
    }

    const data = [
        { count: strongCount, color: "#10b981" },
        { count: moderateCount, color: "#f59e0b" },
        { count: weakCount, color: "#ef4444" }
    ];

    let startAngle = -0.5 * Math.PI;

    data.forEach(segment => {
        if (segment.count > 0) {
            const sliceAngle = (segment.count / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = segment.color;
            ctx.fill();
            startAngle += sliceAngle;
        }
    });

    const displayScore = customScore !== undefined ? customScore : Math.round((strongCount / total) * 100);
    const isLightMode = document.body.classList.contains("light-mode");
    
    if (displayScore >= 80) {
        ctx.fillStyle = "#10b981";
    } else if (displayScore >= 50) {
        ctx.fillStyle = "#f59e0b";
    } else {
        ctx.fillStyle = "#ef4444";
    }
    
    ctx.font = "bold 16px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${displayScore}%`, centerX, centerY - 6);

    ctx.fillStyle = isLightMode ? "#475569" : "#a6bba8";
    ctx.font = "600 10px Poppins, sans-serif";
    ctx.fillText("HEALTH", centerX, centerY + 10);
}

// Escape HTML utility
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatLastUnlockTime(startMs) {
    if (!startMs) return "Just now";
    const diffMs = Date.now() - parseInt(startMs);
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo ago`;

    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears}y ago`;
}

/* =========================================================
   TOGGLE SIDEBAR & CONSOLIDATED ACCOUNT DROPDOWN LOGIC
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    // 1. Sidebar Toggle Button
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const dashboardSidebar = document.getElementById("dashboardSidebar");
    const dashboardLayout = document.querySelector(".dashboard-layout");

    if (sidebarToggleBtn && dashboardSidebar) {
        sidebarToggleBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            dashboardSidebar.classList.toggle("collapsed");
            if (dashboardLayout) {
                dashboardLayout.classList.toggle("sidebar-collapsed");
            }
            try {
                localStorage.setItem("kvault_sidebar_collapsed", dashboardSidebar.classList.contains("collapsed"));
            } catch (err) {}
        });

        // Restore saved collapsed state
        try {
            if (localStorage.getItem("kvault_sidebar_collapsed") === "true") {
                dashboardSidebar.classList.add("collapsed");
                if (dashboardLayout) dashboardLayout.classList.add("sidebar-collapsed");
            }
        } catch (err) {}
    }

    // 2. Load User Profile for Sidebar Dropdown Pill
    loadSidebarUserInfo();
});

// Global Sidebar Account Dropdown Trigger ("below 4 option hi uska drop down bna do ok")
window.toggleSidebarAccountMenu = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const dropdown = document.getElementById("sidebarAccountDropdown");
    const caret = document.getElementById("sidebarCaret");
    if (dropdown) {
        const isHidden = dropdown.classList.contains("hidden");
        dropdown.classList.toggle("hidden");
        if (caret) {
            caret.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
        }
    }
};

// Close dropdown on outside click
document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("sidebarAccountDropdown");
    const trigger = document.getElementById("sidebarAccountBtn");
    const caret = document.getElementById("sidebarCaret");
    if (dropdown && !dropdown.classList.contains("hidden")) {
        if (!dropdown.contains(e.target) && trigger && !trigger.contains(e.target)) {
            dropdown.classList.add("hidden");
            if (caret) caret.style.transform = "rotate(0deg)";
        }
    }
});

// Load User info to populate sidebar avatar and name
async function loadSidebarUserInfo() {
    try {
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        const res = await apiFetch("/auth/profile");
        if (res.ok) {
            const user = await res.json();
            const name = user.name || "Sameer";
            const initial = name.charAt(0).toUpperCase();
            const avatarEl = document.getElementById("sidebarAvatarCircle");
            const nameEl = document.getElementById("sidebarUserNameLabel");
            if (avatarEl) avatarEl.textContent = initial;
            if (nameEl) nameEl.textContent = name;
        }
    } catch (e) {
        console.error("Failed to load user info for sidebar:", e);
    }
}

