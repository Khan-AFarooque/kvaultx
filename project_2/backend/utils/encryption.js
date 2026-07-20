const crypto = require("crypto");

// Ensure we have a secure 32-byte key derived from the environment variable
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY || "default_secure_vault_super_key_change_me_123456789";
    // Derive a 32-byte key using scrypt
    return crypto.scryptSync(key, "secure_vault_salt", 32);
};

const algorithm = "aes-256-cbc";

/**
 * Encrypt plaintext string using AES-256-CBC
 * @param {string} text - The plaintext to encrypt
 * @returns {object} - { encryptedData: string, iv: string }
 */
const encrypt = (text) => {
    if (!text) return { encryptedData: "", iv: "" };
    
    const iv = crypto.randomBytes(16);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return {
        encryptedData: encrypted,
        iv: iv.toString("hex")
    };
};

/**
 * Decrypt ciphertext using AES-256-CBC
 * @param {string} encryptedData - The hex-encoded encrypted data
 * @param {string} ivHex - The hex-encoded IV
 * @returns {string} - The decrypted plaintext
 */
const decrypt = (encryptedData, ivHex) => {
    if (!encryptedData || !ivHex) return "";
    
    try {
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, "hex");
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        
        let decrypted = decipher.update(encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error.message);
        return "[Decryption Error]";
    }
};

module.exports = {
    encrypt,
    decrypt
};
