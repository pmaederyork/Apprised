/**
 * Settings module for managing API key and other settings
 */
const Settings = {
    elements: {
        settingsBtn: null,
        settingsModal: null,
        closeSettingsBtn: null,
        apiKeyInput: null,
        showHideBtn: null,
        apiKeyStatus: null,
        saveApiKeyBtn: null,
        deleteApiKeyBtn: null,
        apiKeyNotification: null,
        openSettingsFromNotification: null,
        chatgptApiKeyInput: null,
        chatgptShowHideBtn: null,
        chatgptApiKeyStatus: null,
        saveChatGPTApiKeyBtn: null,
        deleteChatGPTApiKeyBtn: null
    },

    init() {
        this.initElements();
        this.bindEvents();
        this.loadApiKey();
        this.loadChatGPTApiKey();
        this.updateUI();
    },

    initElements() {
        this.elements.settingsBtn = document.getElementById('settingsBtn');
        this.elements.settingsModal = document.getElementById('settingsModal');
        this.elements.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.elements.apiKeyInput = document.getElementById('apiKeyInput');
        this.elements.showHideBtn = document.getElementById('showHideBtn');
        this.elements.apiKeyStatus = document.getElementById('apiKeyStatus');
        this.elements.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        this.elements.deleteApiKeyBtn = document.getElementById('deleteApiKeyBtn');
        this.elements.apiKeyNotification = document.getElementById('apiKeyNotification');
        this.elements.openSettingsFromNotification = document.getElementById('openSettingsFromNotification');
        this.elements.chatgptApiKeyInput = document.getElementById('chatgptApiKeyInput');
        this.elements.chatgptShowHideBtn = document.getElementById('chatgptShowHideBtn');
        this.elements.chatgptApiKeyStatus = document.getElementById('chatgptApiKeyStatus');
        this.elements.saveChatGPTApiKeyBtn = document.getElementById('saveChatGPTApiKeyBtn');
        this.elements.deleteChatGPTApiKeyBtn = document.getElementById('deleteChatGPTApiKeyBtn');
    },

    bindEvents() {
        // Settings button
        this.elements.settingsBtn?.addEventListener('click', () => this.openSettings());
        
        // Close settings
        this.elements.closeSettingsBtn?.addEventListener('click', () => this.closeSettings());
        
        // Click outside modal to close
        this.elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });
        
        // Show/hide password toggle
        this.elements.showHideBtn?.addEventListener('click', () => this.togglePasswordVisibility());
        
        // Save API key
        this.elements.saveApiKeyBtn?.addEventListener('click', () => this.saveApiKey());
        
        // Delete API key
        this.elements.deleteApiKeyBtn?.addEventListener('click', () => this.deleteApiKey());
        
        // API key input validation
        this.elements.apiKeyInput?.addEventListener('input', () => this.validateApiKey());
        
        // Enter key to save
        this.elements.apiKeyInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveApiKey();
            }
        });
        
        // Open settings from notification
        this.elements.openSettingsFromNotification?.addEventListener('click', () => {
            this.hideApiKeyNotification();
            this.openSettings();
        });

        // ChatGPT API key events
        this.elements.chatgptShowHideBtn?.addEventListener('click', () => this.toggleChatGPTPasswordVisibility());
        this.elements.saveChatGPTApiKeyBtn?.addEventListener('click', () => this.saveChatGPTApiKey());
        this.elements.deleteChatGPTApiKeyBtn?.addEventListener('click', () => this.deleteChatGPTApiKey());
        this.elements.chatgptApiKeyInput?.addEventListener('input', () => this.validateChatGPTApiKey());
        this.elements.chatgptApiKeyInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveChatGPTApiKey();
            }
        });
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.settingsModal?.style.display !== 'none') {
                    this.closeSettings();
                }
                if (this.elements.apiKeyNotification?.style.display !== 'none') {
                    this.hideApiKeyNotification();
                }
            }
        });
    },

    loadApiKey() {
        const apiKey = Storage.getApiKey();
        if (apiKey) {
            this.elements.apiKeyInput.value = apiKey;
            this.showStatus('API key loaded', 'success');
        } else {
            this.elements.apiKeyInput.value = '';
            this.showStatus('No API key found', 'warning');
        }
    },

    loadChatGPTApiKey() {
        const apiKey = Storage.getChatGPTApiKey();
        if (apiKey) {
            this.elements.chatgptApiKeyInput.value = apiKey;
            this.showChatGPTStatus('ChatGPT API key loaded', 'success');
        } else {
            this.elements.chatgptApiKeyInput.value = '';
            this.showChatGPTStatus('No ChatGPT API key found', 'warning');
        }
    },

    openSettings() {
        this.elements.settingsModal.style.display = 'flex';
        this.loadApiKey();
        this.loadChatGPTApiKey();
        this.validateApiKey();
        this.validateChatGPTApiKey();
        // Focus on input after modal opens
        setTimeout(() => {
            this.elements.apiKeyInput?.focus();
        }, 100);
    },

    closeSettings() {
        this.elements.settingsModal.style.display = 'none';
    },

    togglePasswordVisibility() {
        const input = this.elements.apiKeyInput;
        const btn = this.elements.showHideBtn;
        
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    },

    validateApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        const isValid = apiKey.length > 0 && apiKey.startsWith('sk-ant-');
        
        // Enable/disable save button
        this.elements.saveApiKeyBtn.disabled = !isValid;
        
        if (apiKey.length === 0) {
            this.showStatus('Enter your API key', 'warning');
        } else if (!apiKey.startsWith('sk-ant-')) {
            this.showStatus('Invalid API key format', 'error');
        } else if (apiKey.length < 50) {
            this.showStatus('API key seems too short', 'warning');
        } else {
            this.showStatus('API key format looks correct', 'success');
        }
        
        return isValid;
    },

    saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        
        if (!this.validateApiKey()) {
            return;
        }
        
        try {
            Storage.saveApiKey(apiKey);
            this.showStatus('API key saved successfully!', 'success');
            
            // Hide notification if visible
            this.hideApiKeyNotification();
            
            // Update UI
            this.updateUI();
            
            // Close settings after a short delay
            setTimeout(() => {
                this.closeSettings();
            }, 1000);
            
        } catch (error) {
            console.error('Error saving API key:', error);
            this.showStatus('Error saving API key', 'error');
        }
    },

    deleteApiKey() {
        if (confirm('Are you sure you want to delete your API key?')) {
            try {
                Storage.deleteApiKey();
                this.elements.apiKeyInput.value = '';
                this.showStatus('API key deleted', 'warning');
                
                // Update UI
                this.updateUI();
                
                // Show notification after a short delay
                setTimeout(() => {
                    this.showApiKeyNotification();
                }, 500);
                
            } catch (error) {
                console.error('Error deleting API key:', error);
                this.showStatus('Error deleting API key', 'error');
            }
        }
    },

    showStatus(message, type) {
        this.elements.apiKeyStatus.textContent = message;
        this.elements.apiKeyStatus.className = `api-key-status ${type}`;
        this.elements.apiKeyStatus.style.display = 'block';
    },

    updateUI() {
        const hasApiKey = Storage.hasApiKey();
        
        // Update delete button state
        this.elements.deleteApiKeyBtn.style.display = hasApiKey ? 'block' : 'none';
        
        // Check if we need to show the notification
        if (!hasApiKey) {
            this.showApiKeyNotification();
        } else {
            this.hideApiKeyNotification();
        }
    },

    showApiKeyNotification() {
        this.elements.apiKeyNotification.style.display = 'block';
    },

    hideApiKeyNotification() {
        this.elements.apiKeyNotification.style.display = 'none';
    },

    // Public method to check if API key is available before making requests
    checkApiKeyBeforeRequest() {
        if (!Storage.hasApiKey()) {
            this.showApiKeyNotification();
            return false;
        }
        return true;
    },

    // Get API key for API requests
    getApiKeyForRequest() {
        return Storage.getApiKey();
    },

    // ChatGPT API key methods
    toggleChatGPTPasswordVisibility() {
        const input = this.elements.chatgptApiKeyInput;
        const button = this.elements.chatgptShowHideBtn;
        
        if (!input || !button) return;
        
        if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈';
        } else {
            input.type = 'password';
            button.textContent = '👁️';
        }
    },

    validateChatGPTApiKey() {
        const input = this.elements.chatgptApiKeyInput;
        if (!input) return false;
        
        const apiKey = input.value.trim();
        const isValid = apiKey.length > 0 && apiKey.startsWith('sk-');
        
        // Update button state
        this.elements.saveChatGPTApiKeyBtn.disabled = !isValid;
        
        // Show validation messages
        if (apiKey.length === 0) {
            this.showChatGPTStatus('Enter your ChatGPT API key', 'info');
        } else if (!apiKey.startsWith('sk-')) {
            this.showChatGPTStatus('Invalid key format. ChatGPT keys start with "sk-"', 'error');
        } else if (apiKey.length < 40) {
            this.showChatGPTStatus('Key appears too short', 'warning');
        } else {
            this.showChatGPTStatus('Key format looks correct', 'success');
        }
        
        return isValid;
    },

    saveChatGPTApiKey() {
        const apiKey = this.elements.chatgptApiKeyInput.value.trim();
        
        if (!this.validateChatGPTApiKey()) {
            return;
        }
        
        try {
            // Save the API key
            Storage.saveChatGPTApiKey(apiKey);
            
            // Show success message
            this.showChatGPTStatus('ChatGPT API key saved successfully!', 'success');
            
            // Update UI
            this.updateUI();
            
        } catch (error) {
            console.error('Error saving ChatGPT API key:', error);
            this.showChatGPTStatus('Error saving API key', 'error');
        }
    },

    deleteChatGPTApiKey() {
        if (confirm('Are you sure you want to delete your ChatGPT API key?')) {
            try {
                Storage.deleteChatGPTApiKey();
                
                // Clear input and update UI
                this.elements.chatgptApiKeyInput.value = '';
                this.showChatGPTStatus('ChatGPT API key deleted', 'info');
                this.updateUI();
                
            } catch (error) {
                console.error('Error deleting ChatGPT API key:', error);
                this.showChatGPTStatus('Error deleting API key', 'error');
            }
        }
    },

    showChatGPTStatus(message, type) {
        if (!this.elements.chatgptApiKeyStatus) return;
        
        this.elements.chatgptApiKeyStatus.textContent = message;
        this.elements.chatgptApiKeyStatus.className = `api-key-status ${type}`;
        this.elements.chatgptApiKeyStatus.style.display = 'block';
    },

    // Get ChatGPT API key for API requests
    getChatGPTApiKeyForRequest() {
        return Storage.getChatGPTApiKey();
    }
};