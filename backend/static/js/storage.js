/**
 * Storage utilities for localStorage operations
 * Uses write-through cache: localStorage for reads, server sync on writes
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

    saveChats(chats, changedChatId = null) {
        localStorage.setItem('chats', JSON.stringify(chats));

        // Sync the changed chat to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            // If specific chat ID provided, sync that one
            if (changedChatId && chats[changedChatId]) {
                StorageSync.saveChat(changedChatId, chats[changedChatId]);
            } else if (typeof Chat !== 'undefined' && Chat.currentChatId && chats[Chat.currentChatId]) {
                // Otherwise sync current chat (most common case)
                StorageSync.saveChat(Chat.currentChatId, chats[Chat.currentChatId]);
            }
        }
    },

    /**
     * Save a single chat to localStorage and sync to server
     */
    saveChat(chatId, chatData) {
        const chats = this.getChats();
        chats[chatId] = chatData;
        this.saveChats(chats);

        // Sync to server (fire and forget, errors handled in StorageSync)
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.saveChat(chatId, chatData);
        }
    },

    /**
     * Delete a chat - syncs deletion to server
     * Note: Caller should have already deleted from their local chats object
     */
    deleteChat(chatId) {
        // Update localStorage
        const chats = this.getChats();
        if (chats[chatId]) {
            delete chats[chatId];
            localStorage.setItem('chats', JSON.stringify(chats));
        }

        // Sync deletion to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.deleteChat(chatId);
        }
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

    saveSystemPrompts(systemPrompts, changedPromptId = null) {
        localStorage.setItem('systemPrompts', JSON.stringify(systemPrompts));

        // Sync the changed system prompt to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            if (changedPromptId && systemPrompts[changedPromptId]) {
                StorageSync.saveSystemPrompt(changedPromptId, systemPrompts[changedPromptId]);
            } else if (typeof SystemPrompts !== 'undefined' && SystemPrompts.state?.editingSystemPromptId && systemPrompts[SystemPrompts.state.editingSystemPromptId]) {
                // Sync currently editing prompt (most common case)
                StorageSync.saveSystemPrompt(SystemPrompts.state.editingSystemPromptId, systemPrompts[SystemPrompts.state.editingSystemPromptId]);
            }
        }
    },

    /**
     * Save a single system prompt to localStorage and sync to server
     */
    saveSystemPrompt(promptId, promptData) {
        const prompts = this.getSystemPrompts();
        prompts[promptId] = promptData;
        this.saveSystemPrompts(prompts);

        // Sync to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.saveSystemPrompt(promptId, promptData);
        }
    },

    /**
     * Delete a system prompt - syncs deletion to server
     * Note: Caller should have already deleted from their local prompts object
     */
    deleteSystemPrompt(promptId) {
        // Update localStorage
        const prompts = this.getSystemPrompts();
        if (prompts[promptId]) {
            delete prompts[promptId];
            localStorage.setItem('systemPrompts', JSON.stringify(prompts));
        }

        // Sync deletion to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.deleteSystemPrompt(promptId);
        }
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

    // Agent storage (for standalone agent configs)
    getAgents() {
        try {
            return JSON.parse(localStorage.getItem('agents') || '{}');
        } catch (error) {
            console.warn('Failed to parse agents from localStorage:', error);
            return {};
        }
    },

    saveAgents(agents) {
        localStorage.setItem('agents', JSON.stringify(agents));
    },

    saveAgent(agentId, agentData) {
        const agents = this.getAgents();
        agents[agentId] = agentData;
        this.saveAgents(agents);

        // Sync to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.saveAgent(agentId, agentData);
        }
    },

    deleteAgent(agentId) {
        const agents = this.getAgents();
        delete agents[agentId];
        this.saveAgents(agents);

        // Sync deletion to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.deleteAgent(agentId);
        }
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

    saveDocuments(documents, changedDocId = null) {
        localStorage.setItem('documents', JSON.stringify(documents));

        // Sync the changed document to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            if (changedDocId && documents[changedDocId]) {
                StorageSync.saveDocument(changedDocId, documents[changedDocId]);
            } else if (typeof Documents !== 'undefined' && Documents.currentDocumentId && documents[Documents.currentDocumentId]) {
                // Sync current document (most common case)
                StorageSync.saveDocument(Documents.currentDocumentId, documents[Documents.currentDocumentId]);
            }
        }
    },

    /**
     * Save a single document to localStorage and sync to server
     */
    saveDocument(docId, docData) {
        const docs = this.getDocuments();
        docs[docId] = docData;
        this.saveDocuments(docs);

        // Sync to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.saveDocument(docId, docData);
        }
    },

    /**
     * Delete a document - syncs deletion to server
     * Note: Caller should have already deleted from their local documents object
     */
    deleteDocument(docId) {
        // Update localStorage
        const docs = this.getDocuments();
        if (docs[docId]) {
            delete docs[docId];
            localStorage.setItem('documents', JSON.stringify(docs));
        }

        // Sync deletion to server
        if (typeof StorageSync !== 'undefined' && StorageSync.initialized) {
            StorageSync.deleteDocument(docId);
        }
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