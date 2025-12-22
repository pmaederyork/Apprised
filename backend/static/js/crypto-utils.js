/**
 * Cryptographic utilities for secure API key storage
 * Uses Web Crypto API for AES-GCM encryption with PBKDF2 key derivation
 */

const CryptoUtils = {
    // Configuration constants
    PBKDF2_ITERATIONS: 600000, // OWASP 2023 recommendation
    SALT_LENGTH: 16,
    IV_LENGTH: 12, // GCM standard IV size
    KEY_LENGTH: 256,

    /**
     * Derive encryption key from passphrase using PBKDF2
     * @param {string} passphrase - User's passphrase
     * @param {Uint8Array} salt - Random salt for key derivation
     * @returns {Promise<CryptoKey>} - Derived encryption key
     */
    async deriveKey(passphrase, salt) {
        const encoder = new TextEncoder();

        // Import passphrase as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(passphrase),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive AES-GCM key using PBKDF2
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: this.KEY_LENGTH },
            false,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Encrypt data using AES-GCM with passphrase
     * @param {string} data - Plain text data to encrypt
     * @param {string} passphrase - User's passphrase
     * @returns {Promise<string>} - Base64-encoded encrypted data
     */
    async encrypt(data, passphrase) {
        try {
            const encoder = new TextEncoder();

            // Generate random salt and IV
            const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
            const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

            // Derive encryption key
            const key = await this.deriveKey(passphrase, salt);

            // Encrypt the data
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encoder.encode(data)
            );

            // Combine salt + iv + encrypted data for storage
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);

            // Convert to base64 for localStorage
            return this.arrayBufferToBase64(combined);
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    },

    /**
     * Decrypt data using AES-GCM with passphrase
     * @param {string} encryptedBase64 - Base64-encoded encrypted data
     * @param {string} passphrase - User's passphrase
     * @returns {Promise<string>} - Decrypted plain text
     */
    async decrypt(encryptedBase64, passphrase) {
        try {
            // Convert from base64
            const combined = this.base64ToArrayBuffer(encryptedBase64);

            // Extract salt, iv, and encrypted data
            const salt = combined.slice(0, this.SALT_LENGTH);
            const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
            const encrypted = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);

            // Derive decryption key
            const key = await this.deriveKey(passphrase, salt);

            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );

            // Convert to string
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Decryption failed - incorrect passphrase or corrupted data');
        }
    },

    /**
     * Encrypt passphrase for storage (7-day convenience mode)
     * Uses a device-specific derived key for additional security
     * @param {string} passphrase - Passphrase to store
     * @returns {Promise<string>} - Encrypted passphrase
     */
    async encryptPassphraseForStorage(passphrase) {
        // Use a device fingerprint + constant as encryption key
        const deviceKey = await this.getDeviceKey();
        return this.encrypt(passphrase, deviceKey);
    },

    /**
     * Decrypt stored passphrase (7-day convenience mode)
     * @param {string} encryptedPassphrase - Encrypted passphrase
     * @returns {Promise<string>} - Decrypted passphrase
     */
    async decryptStoredPassphrase(encryptedPassphrase) {
        const deviceKey = await this.getDeviceKey();
        return this.decrypt(encryptedPassphrase, deviceKey);
    },

    /**
     * Generate device-specific key for passphrase storage
     * Note: This provides obfuscation, not true security
     * @returns {Promise<string>} - Device-specific key
     */
    async getDeviceKey() {
        // Combine multiple device characteristics
        const userAgent = navigator.userAgent;
        const language = navigator.language;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const platform = navigator.platform;

        // Create a relatively stable device fingerprint
        const deviceString = `${userAgent}|${language}|${timezone}|${platform}|apprised-v1`;

        // Hash it to create a consistent key
        const encoder = new TextEncoder();
        const data = encoder.encode(deviceString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex;
    },

    /**
     * Check passphrase strength
     * @param {string} passphrase - Passphrase to check
     * @returns {Object} - {score: 0-4, feedback: string}
     */
    checkPassphraseStrength(passphrase) {
        if (!passphrase) {
            return { score: 0, feedback: 'Passphrase is required' };
        }

        let score = 0;
        const feedback = [];

        // Length check
        if (passphrase.length >= 8) score++;
        if (passphrase.length >= 12) score++;
        if (passphrase.length >= 16) score++;

        // Character variety checks
        if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) score++;
        if (/[0-9]/.test(passphrase)) score++;
        if (/[^A-Za-z0-9]/.test(passphrase)) score++;

        // Normalize score to 0-4
        score = Math.min(4, Math.floor(score / 1.5));

        // Generate feedback
        if (passphrase.length < 12) {
            feedback.push('Use at least 12 characters');
        }
        if (!/[a-z]/.test(passphrase) || !/[A-Z]/.test(passphrase)) {
            feedback.push('Mix uppercase and lowercase');
        }
        if (!/[0-9]/.test(passphrase)) {
            feedback.push('Include numbers');
        }
        if (!/[^A-Za-z0-9]/.test(passphrase)) {
            feedback.push('Add special characters');
        }

        const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

        return {
            score: score,
            label: strengthLabels[score],
            feedback: feedback.join('. '),
            isAcceptable: score >= 2
        };
    },

    /**
     * Convert ArrayBuffer to Base64 string
     * @param {ArrayBuffer|Uint8Array} buffer - Buffer to convert
     * @returns {string} - Base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    /**
     * Convert Base64 string to Uint8Array
     * @param {string} base64 - Base64 string
     * @returns {Uint8Array} - Decoded array
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    /**
     * Generate a random passphrase suggestion
     * @returns {string} - Random passphrase
     */
    generatePassphrase() {
        const words = [
            'Correct', 'Horse', 'Battery', 'Staple', 'Mountain', 'River', 'Forest', 'Ocean',
            'Thunder', 'Lightning', 'Sunset', 'Rainbow', 'Crystal', 'Phoenix', 'Dragon', 'Tiger'
        ];

        const word1 = words[Math.floor(Math.random() * words.length)];
        const word2 = words[Math.floor(Math.random() * words.length)];
        const word3 = words[Math.floor(Math.random() * words.length)];
        const number = Math.floor(Math.random() * 999);
        const symbols = ['!', '@', '#', '$', '%', '&', '*'];
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];

        return `${word1}${word2}${word3}${number}${symbol}`;
    }
};
