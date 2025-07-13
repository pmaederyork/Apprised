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
    },

    // ChatGPT API Key storage
    getChatGPTApiKey() {
        return localStorage.getItem('chatgptApiKey') || null;
    },

    saveChatGPTApiKey(apiKey) {
        if (apiKey && apiKey.trim()) {
            localStorage.setItem('chatgptApiKey', apiKey.trim());
        } else {
            localStorage.removeItem('chatgptApiKey');
        }
    },

    deleteChatGPTApiKey() {
        localStorage.removeItem('chatgptApiKey');
    },

    hasChatGPTApiKey() {
        const apiKey = this.getChatGPTApiKey();
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