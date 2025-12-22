/**
 * Storage utilities for localStorage operations
 */
const Storage = {
    // Passphrase and encryption state
    sessionPassphrase: null, // In-memory only, cleared on lock/logout
    inactivityTimer: null,
    PASSPHRASE_STORAGE_DAYS: 7,
    INACTIVITY_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour
    // Chat storage
    getChats() {
        try {
            return JSON.parse(localStorage.getItem('chats') || '{}');
        } catch (error) {
            console.warn('Failed to parse chats from localStorage:', error);
            return {};
        }
    },

    saveChats(chats) {
        localStorage.setItem('chats', JSON.stringify(chats));
    },

    // System prompt storage
    getSystemPrompts() {
        try {
            return JSON.parse(localStorage.getItem('systemPrompts') || '{}');
        } catch (error) {
            console.warn('Failed to parse system prompts from localStorage:', error);
            return {};
        }
    },

    saveSystemPrompts(systemPrompts) {
        localStorage.setItem('systemPrompts', JSON.stringify(systemPrompts));
    },

    // Active system prompt
    getActiveSystemPromptId() {
        return localStorage.getItem('activeSystemPromptId') || null;
    },

    saveActiveSystemPromptId(promptId) {
        if (promptId) {
            localStorage.setItem('activeSystemPromptId', promptId);
        } else {
            localStorage.removeItem('activeSystemPromptId');
        }
    },

    // ID generators
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    generateSystemPromptId() {
        return 'prompt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Document storage
    getDocuments() {
        try {
            return JSON.parse(localStorage.getItem('documents') || '{}');
        } catch (error) {
            console.warn('Failed to parse documents from localStorage:', error);
            return {};
        }
    },

    saveDocuments(documents) {
        localStorage.setItem('documents', JSON.stringify(documents));
    },

    generateDocumentId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Last open document persistence
    getLastOpenDocumentId() {
        return localStorage.getItem('lastOpenDocumentId') || null;
    },

    saveLastOpenDocumentId(documentId) {
        if (documentId) {
            localStorage.setItem('lastOpenDocumentId', documentId);
        } else {
            localStorage.removeItem('lastOpenDocumentId');
        }
    },

    // Passphrase management
    async setSessionPassphrase(passphrase, rememberFor7Days = false) {
        this.sessionPassphrase = passphrase;

        // Store encrypted passphrase for 7-day convenience if requested
        if (rememberFor7Days) {
            try {
                const encryptedPassphrase = await CryptoUtils.encryptPassphraseForStorage(passphrase);
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + this.PASSPHRASE_STORAGE_DAYS);

                localStorage.setItem('storedPassphrase', encryptedPassphrase);
                localStorage.setItem('passphraseExpiry', expiryDate.getTime().toString());
            } catch (error) {
                console.error('Failed to store passphrase:', error);
            }
        }

        this.resetInactivityTimer();
    },

    async getStoredPassphrase() {
        try {
            const encrypted = localStorage.getItem('storedPassphrase');
            const expiry = localStorage.getItem('passphraseExpiry');

            if (!encrypted || !expiry) {
                return null;
            }

            // Check if expired
            const expiryDate = parseInt(expiry);
            if (Date.now() > expiryDate) {
                this.clearStoredPassphrase();
                return null;
            }

            // Decrypt and return
            const passphrase = await CryptoUtils.decryptStoredPassphrase(encrypted);
            return passphrase;
        } catch (error) {
            console.error('Failed to retrieve stored passphrase:', error);
            this.clearStoredPassphrase();
            return null;
        }
    },

    clearStoredPassphrase() {
        localStorage.removeItem('storedPassphrase');
        localStorage.removeItem('passphraseExpiry');
    },

    clearSession() {
        this.sessionPassphrase = null;
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    },

    resetInactivityTimer() {
        // Clear existing timer
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }

        // Set new timer to auto-lock after inactivity
        this.inactivityTimer = setTimeout(() => {
            console.log('Auto-locking due to inactivity');
            this.clearSession();

            // Notify user and refresh UI
            if (window.App && typeof App.handleAutoLock === 'function') {
                App.handleAutoLock();
            }
        }, this.INACTIVITY_TIMEOUT_MS);
    },

    isLocked() {
        return this.isEncryptionEnabled() && !this.sessionPassphrase;
    },

    isEncryptionEnabled() {
        return localStorage.getItem('encryptionEnabled') === 'true';
    },

    enableEncryption() {
        localStorage.setItem('encryptionEnabled', 'true');
    },

    // API Key storage - Encrypted
    async getApiKey() {
        // Check if encryption is enabled
        if (!this.isEncryptionEnabled()) {
            // Legacy plain text storage
            return localStorage.getItem('anthropicApiKey') || null;
        }

        // Encrypted storage
        const encrypted = localStorage.getItem('anthropicApiKey_encrypted');
        if (!encrypted) {
            return null;
        }

        // Check if we have passphrase in memory
        if (!this.sessionPassphrase) {
            return null; // Locked state
        }

        try {
            return await CryptoUtils.decrypt(encrypted, this.sessionPassphrase);
        } catch (error) {
            console.error('Failed to decrypt API key:', error);
            return null;
        }
    },

    async saveApiKey(apiKey, passphrase = null) {
        if (!apiKey || !apiKey.trim()) {
            this.deleteApiKey();
            return;
        }

        const trimmedKey = apiKey.trim();

        // If passphrase provided, use encryption
        if (passphrase) {
            try {
                const encrypted = await CryptoUtils.encrypt(trimmedKey, passphrase);
                localStorage.setItem('anthropicApiKey_encrypted', encrypted);
                localStorage.removeItem('anthropicApiKey'); // Remove plain text if exists
                this.enableEncryption();
                this.sessionPassphrase = passphrase;
                this.resetInactivityTimer();
                return true;
            } catch (error) {
                console.error('Failed to encrypt API key:', error);
                throw error;
            }
        } else {
            // Use existing session passphrase if available
            if (this.sessionPassphrase) {
                return this.saveApiKey(trimmedKey, this.sessionPassphrase);
            }

            // Fallback to plain text (backward compatibility)
            localStorage.setItem('anthropicApiKey', trimmedKey);
            return true;
        }
    },

    deleteApiKey() {
        localStorage.removeItem('anthropicApiKey');
        localStorage.removeItem('anthropicApiKey_encrypted');
    },

    async hasApiKey() {
        // Check if encrypted key exists (don't try to decrypt)
        // This way we return true even when locked
        if (this.isEncryptionEnabled()) {
            const encrypted = localStorage.getItem('anthropicApiKey_encrypted');
            return encrypted && encrypted.length > 0;
        }

        // Fallback to plain text check
        const apiKey = localStorage.getItem('anthropicApiKey');
        return apiKey && apiKey.length > 0;
    },

    // Conversation history storage with image data protection
    saveConversationHistory(history) {
        try {
            // Sanitize to ensure no image data gets stored
            const sanitizedHistory = history.map(msg => ({
                role: msg.role,
                content: typeof msg.content === 'string' ? msg.content : (msg.content.text || '')
            }));
            
            localStorage.setItem('conversationHistory', JSON.stringify(sanitizedHistory));
        } catch (error) {
            console.warn('Failed to save conversation history:', error);
        }
    },

    getConversationHistory() {
        try {
            return JSON.parse(localStorage.getItem('conversationHistory') || '[]');
        } catch (error) {
            console.warn('Failed to parse conversation history from localStorage:', error);
            return [];
        }
    }
};