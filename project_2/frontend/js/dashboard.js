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

document.addEventListener("DOMContentLoaded", () => {
    
    // Redirect to profile settings page
    const btnGoToProfile = document.querySelector("#btnGoToProfile");
    if (btnGoToProfile) {
        btnGoToProfile.addEventListener("click", () => {
            window.location.href = "profile.html";
        });
    }

    // Redirect to add password page
    const btnAddPasswordRedirect = document.querySelector("#btnAddPasswordRedirect");
    if (btnAddPasswordRedirect) {
        btnAddPasswordRedirect.addEventListener("click", () => {
            window.location.href = "add-password.html";
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

    async function loadAnalytics() {
        try {
            const response = await apiFetch("/vault/analytics");
            const data = await response.json();

            if (statTotalCount) statTotalCount.textContent = data.totalCount;
            if (statWeakCount) statWeakCount.textContent = data.weakCount;
            if (statReusedCount) statReusedCount.textContent = data.duplicateCount;
            if (statSecurityScore) statSecurityScore.textContent = `${data.securityScore}%`;

            // Style security score color
            if (statSecurityScore) {
                if (data.securityScore > 80) statSecurityScore.style.color = "#10b981";
                else if (data.securityScore > 50) statSecurityScore.style.color = "#f39c12";
                else statSecurityScore.style.color = "#ef4444";
            }

            // Update Dashboard Tab summaries
            const dbTotal = document.querySelector("#statTotalCountDashboard");
            const dbScore = document.querySelector("#statSecurityScoreDashboard");
            if (dbTotal) dbTotal.textContent = data.totalCount;
            if (dbScore) {
                dbScore.textContent = `${data.securityScore}%`;
                if (data.securityScore > 80) dbScore.style.color = "#10b981";
                else if (data.securityScore > 50) dbScore.style.color = "#f39c12";
                else dbScore.style.color = "#ef4444";
            }

            // Update secure notes count on dashboard
            const notesCountEl = document.querySelector("#statNotesCount");
            if (notesCountEl) {
                const notesList = JSON.parse(localStorage.getItem("secure_notes") || "[]");
                notesCountEl.textContent = notesList.length;
            }

            // Update last unlock elapsed time (m, h, d, mo, y)
            const lastUnlockEl = document.querySelector("#statLastUnlock");
            if (lastUnlockEl) {
                let sessionStart = sessionStorage.getItem("sessionStart");
                if (!sessionStart) {
                    sessionStart = Date.now().toString();
                    sessionStorage.setItem("sessionStart", sessionStart);
                }
                lastUnlockEl.textContent = formatLastUnlockTime(sessionStart);
            }

            // Trigger weak password notification if enabled
            if (data.weakCount > 0 && localStorage.getItem("notify_weak_password") === "true") {
                if (!sessionStorage.getItem("weak_alert_shown")) {
                    showToast("Security Alert ⚠️", `You have ${data.weakCount} weak passwords in your vault.`);
                    sessionStorage.setItem("weak_alert_shown", "true");
                }
            }

            // Update Vault Security Chart graph elements
            const weakCount = data.weakCount || 0;
            const totalCount = data.totalCount || 0;
            const strongCount = Math.max(0, totalCount - weakCount - (data.duplicateCount || 0));
            const moderateCount = Math.max(0, totalCount - strongCount - weakCount);

            const graphStrongEl = document.querySelector("#graphStrongCount");
            const graphModEl = document.querySelector("#graphModerateCount");
            const graphWeakEl = document.querySelector("#graphWeakCount");
            const graphHealthScoreEl = document.querySelector("#vaultGraphHealthScore");

            if (graphStrongEl) graphStrongEl.textContent = strongCount;
            if (graphModEl) graphModEl.textContent = moderateCount;
            if (graphWeakEl) graphWeakEl.textContent = weakCount;
            if (graphHealthScoreEl) graphHealthScoreEl.textContent = `Health: ${data.securityScore}%`;

            drawVaultDonutChart(strongCount, moderateCount, weakCount);

            // Render recently added
            if (recentlyAddedList) {
                if (data.recentlyAdded.length === 0) {
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

            // Draw Category Canvas Chart
            drawCanvasChart("categoryDistributionChart", data.categoryStats);

        } catch (error) {
            console.error("Failed to load analytics", error);
        }
    }

    // Canvas Chart Drawer
    function drawCanvasChart(canvasId, categoryStats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        
        // Handle scaling for high DPI displays
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const keys = Object.keys(categoryStats || {});
        const values = Object.values(categoryStats || {});
        
        if (keys.length === 0) {
            ctx.fillStyle = "#888";
            ctx.font = "14px Arial";
            ctx.fillText("No category data available.", canvas.width / 2 - 80, canvas.height / 2);
            return;
        }

        const maxVal = Math.max(...values);
        const chartHeight = canvas.height - 40;
        const barWidth = Math.min(50, (canvas.width - 60) / keys.length);
        const spacing = (canvas.width - 40 - (barWidth * keys.length)) / (keys.length + 1);

        const colors = ["#3498db", "#2ecc71", "#9b59b6", "#e67e22", "#e74c3c", "#1abc9c", "#f1c40f"];

        for (let i = 0; i < keys.length; i++) {
            const value = values[i];
            const barHeight = (value / maxVal) * (chartHeight - 40);
            const x = 20 + spacing * (i + 1) + barWidth * i;
            const y = canvas.height - 30 - barHeight;

            // Draw Bar
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw value labels in white for dark mode compatibility
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px Arial";
            ctx.fillText(value, x + barWidth / 2 - 4, y - 6);

            // Draw labels in light gray
            ctx.fillStyle = "#cbd5e0";
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

function drawVaultDonutChart(strongCount, moderateCount, weakCount) {
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

    const healthPercent = Math.round((strongCount / total) * 100);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${healthPercent}%`, centerX, centerY - 6);

    ctx.fillStyle = "#a6bba8";
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
