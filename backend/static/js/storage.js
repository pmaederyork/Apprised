/**
 * Storage utilities for localStorage operations
 */
const Storage = {
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

    generateAgentId() {
        return 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

    // Claude change tracking
    getClaudeChanges(documentId) {
        try {
            const allChanges = JSON.parse(localStorage.getItem('claudeChanges') || '{}');
            return allChanges[documentId] || null;
        } catch (error) {
            console.warn('Failed to parse Claude changes from localStorage:', error);
            return null;
        }
    },

    saveClaudeChanges(documentId, changes) {
        try {
            const allChanges = JSON.parse(localStorage.getItem('claudeChanges') || '{}');
            allChanges[documentId] = changes;
            localStorage.setItem('claudeChanges', JSON.stringify(allChanges));
        } catch (error) {
            console.error('Failed to save Claude changes:', error);
        }
    },

    clearClaudeChanges(documentId) {
        try {
            const allChanges = JSON.parse(localStorage.getItem('claudeChanges') || '{}');
            delete allChanges[documentId];
            localStorage.setItem('claudeChanges', JSON.stringify(allChanges));
        } catch (error) {
            console.error('Failed to clear Claude changes:', error);
        }
    },

    generateChangeId() {
        return 'ch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

    // Google Drive connection status
    getGoogleDriveConnected() {
        return localStorage.getItem('googleDriveConnected') === 'true';
    },

    saveGoogleDriveConnected(connected) {
        localStorage.setItem('googleDriveConnected', connected ? 'true' : 'false');
    },

    // API Key storage - Plain text
    getApiKey() {
        return localStorage.getItem('anthropicApiKey') || null;
    },

    saveApiKey(apiKey) {
        if (!apiKey || !apiKey.trim()) {
            this.deleteApiKey();
            return;
        }
        localStorage.setItem('anthropicApiKey', apiKey.trim());
    },

    deleteApiKey() {
        localStorage.removeItem('anthropicApiKey');
        localStorage.removeItem('anthropicApiKey_encrypted'); // Clean up any old encrypted keys
    },

    hasApiKey() {
        const apiKey = localStorage.getItem('anthropicApiKey');
        return apiKey && apiKey.length > 0;
    },

    // Generic Settings storage
    getSettings() {
        try {
            return JSON.parse(localStorage.getItem('appSettings') || '{}');
        } catch (error) {
            console.warn('Failed to parse settings from localStorage:', error);
            return {};
        }
    },

    saveSettings(settings) {
        try {
            localStorage.setItem('appSettings', JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    },

    getSetting(key, defaultValue = null) {
        try {
            const settings = this.getSettings();
            return settings[key] !== undefined ? settings[key] : defaultValue;
        } catch (error) {
            console.warn(`Failed to get setting ${key}:`, error);
            return defaultValue;
        }
    },

    saveSetting(key, value) {
        try {
            const settings = this.getSettings();
            settings[key] = value;
            this.saveSettings(settings);
            return true;
        } catch (error) {
            console.error(`Failed to save setting ${key}:`, error);
            return false;
        }
    },

    deleteSetting(key) {
        try {
            const settings = this.getSettings();
            delete settings[key];
            this.saveSettings(settings);
            return true;
        } catch (error) {
            console.error(`Failed to delete setting ${key}:`, error);
            return false;
        }
    },

    // Google Drive default folder
    getGoogleDriveFolder() {
        try {
            const folder = this.getSetting('googleDriveDefaultFolder', null);
            return folder && folder.id ? folder : null;
        } catch (error) {
            console.warn('Failed to get Google Drive folder setting:', error);
            return null;
        }
    },

    saveGoogleDriveFolder(id, name) {
        return this.saveSetting('googleDriveDefaultFolder', { id, name });
    },

    clearGoogleDriveFolder() {
        return this.deleteSetting('googleDriveDefaultFolder');
    }
};