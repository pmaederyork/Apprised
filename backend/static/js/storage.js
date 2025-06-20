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

    // API Key storage
    getApiKey() {
        return localStorage.getItem('anthropicApiKey') || null;
    },

    saveApiKey(apiKey) {
        if (apiKey && apiKey.trim()) {
            localStorage.setItem('anthropicApiKey', apiKey.trim());
        } else {
            localStorage.removeItem('anthropicApiKey');
        }
    },

    deleteApiKey() {
        localStorage.removeItem('anthropicApiKey');
    },

    hasApiKey() {
        const apiKey = this.getApiKey();
        return apiKey && apiKey.length > 0;
    }
};