const Password = require("../models/Password");
const Category = require("../models/Category");
const encryption = require("../utils/encryption");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to determine password strength
const evaluatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "Weak", feedback: "Password is empty" };
    let score = 0;
    const feedback = [];

    if (pwd.length >= 8) score += 2;
    else feedback.push("Length is less than 8 characters");

    if (pwd.length >= 14) score += 2; // extra points for very long passwords

    if (/[A-Z]/.test(pwd)) score += 1;
    else feedback.push("Missing uppercase letters");

    if (/[a-z]/.test(pwd)) score += 1;
    else feedback.push("Missing lowercase letters");

    if (/[0-9]/.test(pwd)) score += 1;
    else feedback.push("Missing numbers");

    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    else feedback.push("Missing special symbols");

    let label = "Weak";
    if (score >= 6) label = "Strong";
    else if (score >= 4) label = "Medium";

    return {
        score: Math.min(100, Math.round((score / 8) * 100)),
        label,
        feedback: feedback.length ? feedback : ["Perfect password combination!"]
    };
};

// Levenshtein distance for typosquatting
const getLevenshteinDistance = (s1, s2) => {
    const m = s1.length;
    const n = s2.length;
    const d = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;

    for (let j = 1; j <= n; j++) {
        for (let i = 1; i <= m; i++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1, // deletion
                d[i][j - 1] + 1, // insertion
                d[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return d[m][n];
};

// Detect Typosquatting against popular domains
const detectTyposquattingLocal = (urlStr) => {
    if (!urlStr) return { isTyposquatted: false, target: null };
    try {
        let hostname = urlStr;
        if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
            hostname = "https://" + urlStr;
        }
        const urlObj = new URL(hostname);
        let domain = urlObj.hostname.toLowerCase().replace("www.", "");
        
        const popularDomains = [
            "google.com", "facebook.com", "youtube.com", "twitter.com", 
            "instagram.com", "linkedin.com", "amazon.com", "netflix.com", 
            "apple.com", "microsoft.com", "github.com", "paypal.com", 
            "bitwarden.com", "gmail.com", "yahoo.com", "outlook.com"
        ];

        if (popularDomains.includes(domain)) {
            return { isTyposquatted: false, target: null };
        }

        for (const target of popularDomains) {
            const distance = getLevenshteinDistance(domain, target);
            // If edit distance is 1 or 2, it is likely typosquatted (e.g. g00gle.com vs google.com)
            // But we should also verify length, so that we don't alert on completely different names
            if (distance > 0 && distance <= 2 && Math.abs(domain.length - target.length) <= 2) {
                return { isTyposquatted: true, target };
            }
        }
        return { isTyposquatted: false, target: null };
    } catch (e) {
        return { isTyposquatted: false, target: null };
    }
};

// Check for suspicious Phishing indicators in URL
const detectPhishingLocal = (urlStr) => {
    if (!urlStr) return { isSuspicious: false, reasons: [] };
    const reasons = [];
    try {
        let hostname = urlStr;
        if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
            hostname = "https://" + urlStr;
        }
        const urlObj = new URL(hostname);
        const domain = urlObj.hostname.toLowerCase();
        
        // 1. IP address instead of domain name
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (ipRegex.test(domain)) {
            reasons.push("URL uses a raw IP address instead of a domain name.");
        }

        // 2. Too many subdomains
        const parts = domain.split(".");
        if (parts.length > 4) {
            reasons.push("URL contains an unusually high number of subdomains.");
        }

        // 3. Phishing keywords in hostname
        const suspiciousKeywords = ["login", "signin", "verify", "secure", "update", "bank", "account", "support", "billing"];
        for (const keyword of suspiciousKeywords) {
            // Check if keyword is in host but not the main domain
            if (domain.includes(keyword) && parts.length > 2 && !parts[parts.length - 2].includes(keyword)) {
                reasons.push(`URL hostname contains suspicious keyword: "${keyword}".`);
            }
        }

        // 4. Typosquatting check
        const typoResult = detectTyposquattingLocal(urlStr);
        if (typoResult.isTyposquatted) {
            reasons.push(`URL appears to be typosquatting "${typoResult.target}".`);
        }

        return {
            isSuspicious: reasons.length > 0,
            reasons
        };
    } catch (e) {
        return { isSuspicious: false, reasons: [] };
    }
};

/* =========================================================
   VAULT CRUD OPERATIONS
========================================================= */

// Get all credentials (decrypted)
exports.getPasswords = async (req, res) => {
    try {
        const { search, category, isFavorite } = req.query;
        let query = { user: req.user.id };

        if (category) query.category = category;
        if (isFavorite === "true") query.isFavorite = true;

        let passwords = await Password.find(query).sort({ createdAt: -1 });

        // Map and Decrypt
        let decryptedList = passwords.map(item => {
            return {
                id: item._id,
                title: item.title,
                username: item.username,
                password: encryption.decrypt(item.password, item.iv),
                url: item.url,
                notes: item.notes ? encryption.decrypt(item.notes, item.iv) : "",
                category: item.category,
                tags: item.tags,
                isFavorite: item.isFavorite,
                expiryDate: item.expiryDate,
                lastRotated: item.lastRotated,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            };
        });

        // Search Filter (on decrypted elements)
        if (search) {
            const searchLower = search.toLowerCase();
            decryptedList = decryptedList.filter(item => 
                item.title.toLowerCase().includes(searchLower) ||
                (item.username && item.username.toLowerCase().includes(searchLower)) ||
                (item.url && item.url.toLowerCase().includes(searchLower))
            );
        }

        res.json(decryptedList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add password to Vault
exports.addPassword = async (req, res) => {
    try {
        const { title, username, password, url, notes, category, tags, expiryDate } = req.body;

        if (!title || !password) {
            return res.status(400).json({ message: "Title and Password fields are required." });
        }

        const encryptedPass = encryption.encrypt(password);
        let encryptedNotes = "";
        if (notes) {
            // Encrypt notes using the same IV as password to simplify
            const tempEncrypted = encryption.encrypt(notes);
            // Wait, encryption returns random IV. We can store encryptedData in notes, but notes needs its own IV if we decrypt it.
            // Let's modify: encryption.encrypt returns { encryptedData, iv }. If notes is encrypted separately, it might have a different IV.
            // Let's encrypt notes with a standard encrypt call, and store both or we can store notes in encrypted format and use the password's iv.
            // Wait, decrypting requires the exact IV. If notes has a separate IV, how do we store it?
            // To keep schema simple and secure, let's encrypt notes using the password's IV or encrypt it separately and keep a separate schema, OR:
            // Just encrypt notes separately and append the IV to notes! E.g. `iv_hex:ciphertext_hex`. That is a classic database trick!
            // Let's do that! That way we can store notes encryption in a single String field.
            const encNotes = encryption.encrypt(notes);
            encryptedNotes = `${encNotes.iv}:${encNotes.encryptedData}`;
        }

        const item = await Password.create({
            user: req.user.id,
            title,
            username,
            password: encryptedPass.encryptedData,
            iv: encryptedPass.iv,
            url,
            notes: encryptedNotes,
            category: category || "Uncategorized",
            tags: tags || [],
            expiryDate: expiryDate || null
        });

        res.status(201).json({ message: "Credential added to Vault successfully", item });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Edit password in Vault
exports.editPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, username, password, url, notes, category, tags, expiryDate, isFavorite } = req.body;

        const item = await Password.findOne({ _id: id, user: req.user.id });
        if (!item) {
            return res.status(404).json({ message: "Credential not found" });
        }

        if (title !== undefined) item.title = title;
        if (username !== undefined) item.username = username;
        if (category !== undefined) item.category = category;
        if (tags !== undefined) item.tags = tags;
        if (expiryDate !== undefined) item.expiryDate = expiryDate;
        if (isFavorite !== undefined) item.isFavorite = isFavorite;
        if (url !== undefined) item.url = url;

        // If password is being updated, encrypt with fresh IV and update lastRotated
        if (password !== undefined) {
            const encryptedPass = encryption.encrypt(password);
            item.password = encryptedPass.encryptedData;
            item.iv = encryptedPass.iv;
            item.lastRotated = Date.now();
        }

        // If notes is updated
        if (notes !== undefined) {
            if (notes) {
                const encNotes = encryption.encrypt(notes);
                item.notes = `${encNotes.iv}:${encNotes.encryptedData}`;
            } else {
                item.notes = "";
            }
        }

        await item.save();

        res.json({ message: "Credential updated successfully", item });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete password
exports.deletePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Password.deleteOne({ _id: id, user: req.user.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Credential not found" });
        }
        res.json({ message: "Credential removed from Vault" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper helper to decrypt notes inside the database format `iv:ciphertext`
const decryptNotesField = (notesField) => {
    if (!notesField) return "";
    if (notesField.includes(":")) {
        const parts = notesField.split(":");
        return encryption.decrypt(parts[1], parts[0]);
    }
    return notesField; // Fallback for unencrypted notes
};

/* =========================================================
   DASHBOARD & STATS ANALYTICS
========================================================= */

exports.getAnalytics = async (req, res) => {
    try {
        const items = await Password.find({ user: req.user.id });

        // Decrypt all passwords for analysis
        const decryptedList = items.map(item => ({
            password: encryption.decrypt(item.password, item.iv),
            category: item.category,
            createdAt: item.createdAt
        }));

        const totalCount = decryptedList.length;

        // Weak Password detection
        let weakCount = 0;
        let strongCount = 0;
        let mediumCount = 0;

        decryptedList.forEach(item => {
            const analysis = evaluatePasswordStrength(item.password);
            if (analysis.label === "Weak") weakCount++;
            else if (analysis.label === "Medium") mediumCount++;
            else if (analysis.label === "Strong") strongCount++;
        });

        // Duplicate Password detection
        const passwordMap = {};
        decryptedList.forEach(item => {
            if (item.password) {
                passwordMap[item.password] = (passwordMap[item.password] || 0) + 1;
            }
        });
        
        let duplicateCount = 0;
        Object.values(passwordMap).forEach(count => {
            if (count > 1) {
                duplicateCount += count;
            }
        });

        // Calculate security score
        // Base: 100
        // Deduct 5 points per weak password
        // Deduct 8 points per duplicate password entry
        let securityScore = 100;
        if (totalCount > 0) {
            const deduction = (weakCount * 5) + (duplicateCount * 8);
            securityScore = Math.max(0, 100 - deduction);
        }

        // Category breakdown
        const categoryStats = {};
        decryptedList.forEach(item => {
            const cat = item.category || "Uncategorized";
            categoryStats[cat] = (categoryStats[cat] || 0) + 1;
        });

        // Recently Added passwords
        const recentlyAdded = items
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5)
            .map(item => ({
                id: item._id,
                title: item.title,
                username: item.username,
                category: item.category,
                createdAt: item.createdAt
            }));

        res.json({
            totalCount,
            weakCount,
            duplicateCount,
            securityScore,
            categoryStats,
            recentlyAdded,
            strengthBreakdown: {
                Strong: strongCount,
                Medium: mediumCount,
                Weak: weakCount
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================================================
   IMPORT / EXPORT VAULT
========================================================= */

// Export Vault
exports.exportVault = async (req, res) => {
    try {
        const { format } = req.params;
        const { passphrase } = req.query; // Used for encrypted backup option

        const items = await Password.find({ user: req.user.id }).sort({ createdAt: -1 });

        const decryptedList = items.map(item => {
            const plainPass = encryption.decrypt(item.password, item.iv);
            const plainNotes = decryptNotesField(item.notes);
            return {
                title: item.title,
                username: item.username,
                password: plainPass,
                url: item.url,
                notes: plainNotes,
                category: item.category,
                tags: item.tags.join(", "),
                isFavorite: item.isFavorite ? "Yes" : "No",
                expiryDate: item.expiryDate ? item.expiryDate.toISOString() : ""
            };
        });

        if (format === "json") {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Content-Disposition", "attachment; filename=securevault_export.json");
            return res.json(decryptedList);
        } 
        
        if (format === "csv") {
            const csvHeaders = ["Title", "Username", "Password", "URL", "Notes", "Category", "Tags", "Favorite", "Expiry Date"];
            let csvRows = decryptedList.map(item => [
                `"${item.title.replace(/"/g, '""')}"`,
                `"${(item.username || "").replace(/"/g, '""')}"`,
                `"${item.password.replace(/"/g, '""')}"`,
                `"${(item.url || "").replace(/"/g, '""')}"`,
                `"${item.notes.replace(/"/g, '""')}"`,
                `"${item.category.replace(/"/g, '""')}"`,
                `"${item.tags.replace(/"/g, '""')}"`,
                `"${item.isFavorite}"`,
                `"${item.expiryDate}"`
            ].join(","));

            const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=securevault_export.csv");
            return res.send(csvContent);
        }

        if (format === "encrypted") {
            if (!passphrase) {
                return res.status(400).json({ message: "Passphrase is required for encrypted export" });
            }
            
            // Encrypt JSON backup list with user password
            const rawJson = JSON.stringify(decryptedList);
            
            // Temporary AES key derivation from passphrase
            const backupSalt = "backup_secure_salt_456";
            const deriveKey = require("crypto").scryptSync(passphrase, backupSalt, 32);
            const backupIv = require("crypto").randomBytes(16);
            const cipher = require("crypto").createCipheriv("aes-256-cbc", deriveKey, backupIv);
            
            let backupEncrypted = cipher.update(rawJson, "utf8", "hex");
            backupEncrypted += cipher.final("hex");

            const backupPayload = {
                iv: backupIv.toString("hex"),
                data: backupEncrypted,
                version: "3.0"
            };

            res.setHeader("Content-Type", "application/json");
            res.setHeader("Content-Disposition", "attachment; filename=securevault_backup.enc");
            return res.json(backupPayload);
        }

        res.status(400).json({ message: "Invalid export format specified" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Import Vault
exports.importVault = async (req, res) => {
    try {
        const { format, payload, passphrase } = req.body;
        
        let importList = [];

        if (format === "json") {
            importList = payload; // Array of objects
        } else if (format === "csv") {
            // Quick CSV parsing
            const lines = payload.trim().split("\n");
            if (lines.length <= 1) {
                return res.status(400).json({ message: "CSV file is empty or missing headers" });
            }

            // Simple parsing of CSV lines
            importList = lines.slice(1).map(line => {
                // Split by comma outside of quotes (simple regex)
                const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                const fields = matches.map(f => f.replace(/^"|"$/g, "").replace(/""/g, '"'));
                
                return {
                    title: fields[0] || "Imported",
                    username: fields[1] || "",
                    password: fields[2] || "",
                    url: fields[3] || "",
                    notes: fields[4] || "",
                    category: fields[5] || "Imported",
                    tags: fields[6] ? fields[6].split(",").map(t => t.trim()) : [],
                    isFavorite: fields[7] === "Yes",
                    expiryDate: fields[8] ? new Date(fields[8]) : null
                };
            });

        } else if (format === "encrypted") {
            if (!passphrase) {
                return res.status(400).json({ message: "Passphrase is required to decrypt backup" });
            }

            const { iv, data } = payload;
            if (!iv || !data) {
                return res.status(400).json({ message: "Invalid encrypted backup structure" });
            }

            try {
                const backupSalt = "backup_secure_salt_456";
                const deriveKey = require("crypto").scryptSync(passphrase, backupSalt, 32);
                const decipher = require("crypto").createDecipheriv("aes-256-cbc", deriveKey, Buffer.from(iv, "hex"));
                let rawJson = decipher.update(data, "hex", "utf8");
                rawJson += decipher.final("utf8");

                importList = JSON.parse(rawJson);
            } catch (err) {
                return res.status(400).json({ message: "Decryption failed. Please check your backup passphrase." });
            }
        }

        if (!Array.isArray(importList) || importList.length === 0) {
            return res.status(400).json({ message: "No credentials found to import" });
        }

        // Loop and Save
        let count = 0;
        for (const item of importList) {
            if (!item.title || !item.password) continue;

            const encryptedPass = encryption.encrypt(item.password);
            let encryptedNotes = "";
            if (item.notes) {
                const encNotes = encryption.encrypt(item.notes);
                encryptedNotes = `${encNotes.iv}:${encNotes.encryptedData}`;
            }

            await Password.create({
                user: req.user.id,
                title: item.title,
                username: item.username || "",
                password: encryptedPass.encryptedData,
                iv: encryptedPass.iv,
                url: item.url || "",
                notes: encryptedNotes,
                category: item.category || "Imported",
                tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []),
                isFavorite: item.isFavorite === true || item.isFavorite === "Yes",
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
            });
            count++;
        }

        res.json({ message: `Successfully imported ${count} vault records.` });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================================================
   AI SECURITY FEATURES
========================================================= */

// AI Strength Advisor
exports.aiAnalyzeStrength = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ message: "Password is required" });

        // Let's check if Gemini API key exists
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `Analyze the security strength of the password "${password}". Describe its weaknesses and provide 3 actionable, specific, bulleted tips to make it stronger. Keep your response brief, clear and professional, formatting it in HTML format.`;
                const result = await model.generateContent(prompt);
                const response = await result.response;
                return res.json({ analysis: response.text() });
            } catch (err) {
                console.error("Gemini API call failed, falling back to local analysis:", err.message);
            }
        }

        // Rule-based AI Strength Advisor fallback
        const evaluation = evaluatePasswordStrength(password);
        let feedbackHtml = `<h3>Password Analysis (${evaluation.label})</h3>`;
        feedbackHtml += `<p>Strength Score: <strong>${evaluation.score}/100</strong></p>`;
        
        if (evaluation.label === "Strong") {
            feedbackHtml += `<p>Excellent! Your password meets the core security guidelines. It contains a diverse range of characters and is sufficiently long.</p>`;
        } else {
            feedbackHtml += `<p>Weaknesses discovered:</p><ul>`;
            evaluation.feedback.forEach(item => {
                feedbackHtml += `<li>${item}</li>`;
            });
            feedbackHtml += `</ul>`;
            feedbackHtml += `<p><strong>AI Recommendation Tips:</strong></p><ol>`;
            feedbackHtml += `<li>Add uppercase letters, numbers, and symbols like !, @, # to increase character set complexity.</li>`;
            feedbackHtml += `<li>Increase length to 14+ characters. Length is the single most powerful factor against brute force.</li>`;
            feedbackHtml += `<li>Use a memorable passphrase (e.g. four random words like "correct-horse-battery-staple") instead of keyboard patterns.</li>`;
            feedbackHtml += `</ol>`;
        }

        res.json({ analysis: feedbackHtml });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// AI Phishing & Typosquatting Detector
exports.aiDetectPhishing = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ message: "URL is required" });

        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `Perform a security analysis on the URL "${url}". Check for typosquatting, suspicious subdomains, phishing keywords (login, secure, bank, verify, etc.) or raw IP use. Return a JSON response with structure: { "isSuspicious": boolean, "reasons": string[], "confidence": string }. Return ONLY valid JSON.`;
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const jsonText = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
                const analysisResult = JSON.parse(jsonText);
                return res.json(analysisResult);
            } catch (err) {
                console.error("Gemini Phishing Detector failed, falling back to local analysis:", err.message);
            }
        }

        // Local Fallback Phishing Detector
        const localPhishing = detectPhishingLocal(url);
        res.json({
            isSuspicious: localPhishing.isSuspicious,
            reasons: localPhishing.reasons.length ? localPhishing.reasons : ["No immediate suspicious characteristics or typosquatting detected."],
            confidence: "High (Rule-Based Algorithm)"
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// AI Security Recommendations
exports.aiRecommendations = async (req, res) => {
    try {
        const items = await Password.find({ user: req.user.id });

        // Decrypt all passwords for analysis
        const decryptedList = items.map(item => ({
            id: item._id,
            title: item.title,
            username: item.username,
            password: encryption.decrypt(item.password, item.iv),
            url: item.url,
            category: item.category
        }));

        const recommendations = [];

        // 1. Weak passwords recommendation
        const weakItems = decryptedList.filter(item => evaluatePasswordStrength(item.password).label === "Weak");
        if (weakItems.length > 0) {
            recommendations.push({
                type: "danger",
                message: `You have ${weakItems.length} weak passwords in your vault (e.g. for "${weakItems[0].title}").`,
                action: "Update them to be at least 12 characters with capital letters, digits, and symbols."
            });
        }

        // 2. Duplicate passwords recommendation
        const passwordMap = {};
        decryptedList.forEach(item => {
            if (item.password) {
                passwordMap[item.password] = (passwordMap[item.password] || 0) + 1;
            }
        });
        
        let duplicateItemsCount = 0;
        decryptedList.forEach(item => {
            if (passwordMap[item.password] > 1) {
                duplicateItemsCount++;
            }
        });

        if (duplicateItemsCount > 0) {
            recommendations.push({
                type: "warning",
                message: `You are reusing the same passwords across ${duplicateItemsCount} accounts.`,
                action: "Generate unique passwords for each service to prevent credential stuffing attacks."
            });
        }

        // 3. HTTPS recommendation
        const insecureUrls = decryptedList.filter(item => item.url && item.url.startsWith("http://"));
        if (insecureUrls.length > 0) {
            recommendations.push({
                type: "info",
                message: `You have ${insecureUrls.length} credentials configured with insecure HTTP protocol instead of HTTPS (e.g. for "${insecureUrls[0].title}").`,
                action: "Update these URLs to use https:// to ensure logins are encrypted in transit."
            });
        }

        // 4. Expiry recommendation
        const expiredUrls = items.filter(item => item.expiryDate && new Date(item.expiryDate) < new Date());
        if (expiredUrls.length > 0) {
            recommendations.push({
                type: "warning",
                message: `You have ${expiredUrls.length} passwords that have reached their expiration date.`,
                action: "Rotate these credentials now to maintain proper security hygiene."
            });
        }

        // Default if vault is healthy
        if (recommendations.length === 0) {
            recommendations.push({
                type: "success",
                message: "Excellent job! No duplicate, weak, insecure or expired passwords found.",
                action: "Keep using the password generator to maintain vault health."
            });
        }

        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
