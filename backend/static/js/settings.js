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

    async loadApiKey() {
        const apiKey = await Storage.getApiKey();
        if (apiKey) {
            this.elements.apiKeyInput.value = apiKey;
            this.showStatus('API key loaded', 'success');
        } else {
            this.elements.apiKeyInput.value = '';
            if (Storage.isLocked()) {
                this.showStatus('Locked - unlock to view', 'warning');
            } else {
                this.showStatus('No API key found', 'warning');
            }
        }
    },

    async loadChatGPTApiKey() {
        const apiKey = await Storage.getChatGPTApiKey();
        if (apiKey) {
            this.elements.chatgptApiKeyInput.value = apiKey;
            this.showChatGPTStatus('ChatGPT API key loaded', 'success');
        } else {
            this.elements.chatgptApiKeyInput.value = '';
            if (Storage.isLocked()) {
                this.showChatGPTStatus('Locked - unlock to view', 'warning');
            } else {
                this.showChatGPTStatus('No ChatGPT API key found', 'warning');
            }
        }
    },

    async openSettings() {
        // Check if app is locked
        if (Storage.isLocked()) {
            const unlocked = await this.promptForPassphrase('unlock');
            if (!unlocked) {
                return; // User cancelled
            }
        }

        this.elements.settingsModal.style.display = 'flex';
        await this.loadApiKey();
        await this.loadChatGPTApiKey();
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

    async saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();

        if (!this.validateApiKey()) {
            return;
        }

        try {
            // Check if we need to prompt for passphrase
            let passphrase = Storage.sessionPassphrase;

            if (!passphrase) {
                // Check if there are existing plain text keys to migrate
                const hasPlainKeys = localStorage.getItem('anthropicApiKey') || localStorage.getItem('chatgptApiKey');

                if (hasPlainKeys) {
                    // Migration flow
                    passphrase = await this.promptForPassphrase('create', true);
                } else {
                    // First time setup
                    passphrase = await this.promptForPassphrase('create');
                }

                if (!passphrase) {
                    return; // User cancelled
                }
            }

            await Storage.saveApiKey(apiKey, passphrase);
            this.showStatus('API key encrypted and saved!', 'success');

            // Hide notification if visible
            this.hideApiKeyNotification();

            // Update UI
            await this.updateUI();

            // Show lock button now that encryption is enabled
            if (UI.elements.lockBtn) {
                UI.elements.lockBtn.style.display = 'flex';
            }

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

    showApiKeyNotification() {
        this.elements.apiKeyNotification.style.display = 'block';
    },

    hideApiKeyNotification() {
        this.elements.apiKeyNotification.style.display = 'none';
    },

    // Public method to check if API key is available before making requests
    async checkApiKeyBeforeRequest() {
        const hasKey = await Storage.hasApiKey();
        if (!hasKey) {
            this.showApiKeyNotification();
            return false;
        }
        return true;
    },

    // Get API key for API requests
    async getApiKeyForRequest() {
        return await Storage.getApiKey();
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

    async saveChatGPTApiKey() {
        const apiKey = this.elements.chatgptApiKeyInput.value.trim();

        if (!this.validateChatGPTApiKey()) {
            return;
        }

        try {
            // Use existing session passphrase or same as Anthropic key flow
            let passphrase = Storage.sessionPassphrase;

            if (!passphrase) {
                passphrase = await this.promptForPassphrase('create');
                if (!passphrase) {
                    return; // User cancelled
                }
            }

            // Save the API key
            await Storage.saveChatGPTApiKey(apiKey, passphrase);

            // Show success message
            this.showChatGPTStatus('ChatGPT API key encrypted and saved!', 'success');

            // Update UI
            await this.updateUI();

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
    async getChatGPTApiKeyForRequest() {
        return await Storage.getChatGPTApiKey();
    },

    // Passphrase modal methods
    async promptForPassphrase(mode = 'unlock', isMigration = false) {
        return new Promise((resolve) => {
            const modal = UI.elements.passphraseModal;
            const input = UI.elements.passphraseInput;
            const title = UI.elements.passphraseModalTitle;
            const description = UI.elements.passphraseModalDescription;
            const submitBtn = UI.elements.passphraseSubmitBtn;
            const cancelBtn = UI.elements.passphraseCancelBtn;
            const forgotBtn = UI.elements.forgotPassphraseBtn;
            const strengthIndicator = UI.elements.passphraseStrengthIndicator;
            const options = UI.elements.passphraseOptions;
            const statusDiv = UI.elements.passphraseStatus;

            // Configure modal based on mode
            if (mode === 'create') {
                title.textContent = isMigration ? 'Migrate to Encrypted Storage' : 'Create Passphrase';
                description.textContent = isMigration
                    ? 'Create a passphrase to encrypt your existing API keys'
                    : 'Create a passphrase to protect your API keys';
                submitBtn.textContent = 'Create';
                strengthIndicator.style.display = 'block';
                options.style.display = 'block';
                forgotBtn.style.display = 'none';
            } else {
                title.textContent = 'Unlock App';
                description.textContent = 'Enter your passphrase to unlock your encrypted API keys';
                submitBtn.textContent = 'Unlock';
                strengthIndicator.style.display = 'none';
                options.style.display = 'block'; // Show "Remember for 7 days" in unlock mode
                forgotBtn.style.display = 'block';
            }

            // Clear previous state
            input.value = '';
            statusDiv.className = 'passphrase-status';
            statusDiv.style.display = 'none';

            // Show modal
            modal.style.display = 'flex';
            setTimeout(() => input.focus(), 100);

            // Input validation for create mode
            const handleInput = () => {
                if (mode === 'create') {
                    const strength = CryptoUtils.checkPassphraseStrength(input.value);
                    UI.elements.strengthBarFill.setAttribute('data-score', strength.score);
                    UI.elements.strengthLabel.textContent = strength.label;
                    UI.elements.strengthFeedback.textContent = strength.feedback;
                    submitBtn.disabled = !strength.isAcceptable;
                }
            };

            input.addEventListener('input', handleInput);

            // Handle submit
            const handleSubmit = async () => {
                const passphrase = input.value;

                if (!passphrase) {
                    this.showPassphraseStatus('Please enter a passphrase', 'error');
                    return;
                }

                if (mode === 'create') {
                    const strength = CryptoUtils.checkPassphraseStrength(passphrase);
                    if (!strength.isAcceptable) {
                        this.showPassphraseStatus('Passphrase is too weak', 'error');
                        return;
                    }

                    // Set passphrase in storage
                    const rememberFor7Days = UI.elements.rememberPassphraseCheckbox.checked;
                    await Storage.setSessionPassphrase(passphrase, rememberFor7Days);

                    // Migrate existing keys if needed
                    if (isMigration) {
                        await Storage.migratePlainTextKeys(passphrase);
                    }

                    cleanup();
                    modal.style.display = 'none';
                    resolve(passphrase);
                } else {
                    // Unlock mode - verify passphrase
                    try {
                        const encrypted = localStorage.getItem('anthropicApiKey_encrypted') ||
                                        localStorage.getItem('chatgptApiKey_encrypted');

                        if (encrypted) {
                            // Try to decrypt to verify passphrase
                            await CryptoUtils.decrypt(encrypted, passphrase);

                            // Success - set session passphrase
                            const rememberFor7Days = UI.elements.rememberPassphraseCheckbox.checked;
                            await Storage.setSessionPassphrase(passphrase, rememberFor7Days);

                            cleanup();
                            modal.style.display = 'none';
                            resolve(passphrase);
                        } else {
                            this.showPassphraseStatus('No encrypted data found', 'error');
                        }
                    } catch (error) {
                        this.showPassphraseStatus('Incorrect passphrase', 'error');
                        input.value = '';
                        input.focus();
                    }
                }
            };

            // Handle cancel
            const handleCancel = () => {
                cleanup();
                modal.style.display = 'none';
                resolve(null);
            };

            // Handle forgot passphrase
            const handleForgot = () => {
                if (confirm('Reset passphrase? This will delete your encrypted API keys. You will need to re-enter them.')) {
                    Storage.deleteApiKey();
                    Storage.deleteChatGPTApiKey();
                    Storage.clearStoredPassphrase();
                    localStorage.removeItem('encryptionEnabled');
                    cleanup();
                    modal.style.display = 'none';
                    alert('Encryption reset. Please enter your API keys again.');
                    resolve(null);
                }
            };

            // Show/hide passphrase
            const handleShowHide = () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    UI.elements.passphraseShowHideBtn.textContent = '🙈';
                } else {
                    input.type = 'password';
                    UI.elements.passphraseShowHideBtn.textContent = '👁️';
                }
            };

            // Enter key to submit
            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                }
            };

            // Bind events
            submitBtn.addEventListener('click', handleSubmit);
            cancelBtn.addEventListener('click', handleCancel);
            forgotBtn.addEventListener('click', handleForgot);
            UI.elements.passphraseShowHideBtn.addEventListener('click', handleShowHide);
            input.addEventListener('keypress', handleKeyPress);

            // Cleanup function
            const cleanup = () => {
                submitBtn.removeEventListener('click', handleSubmit);
                cancelBtn.removeEventListener('click', handleCancel);
                forgotBtn.removeEventListener('click', handleForgot);
                UI.elements.passphraseShowHideBtn.removeEventListener('click', handleShowHide);
                input.removeEventListener('keypress', handleKeyPress);
                input.removeEventListener('input', handleInput);
            };
        });
    },

    showPassphraseStatus(message, type) {
        const statusDiv = UI.elements.passphraseStatus;
        statusDiv.textContent = message;
        statusDiv.className = `passphrase-status ${type}`;
        statusDiv.style.display = 'block';
    },

    async updateUI() {
        const hasApiKey = await Storage.hasApiKey();

        // Update delete button state
        this.elements.deleteApiKeyBtn.style.display = hasApiKey ? 'block' : 'none';

        // Show/hide lock button based on encryption
        if (Storage.isEncryptionEnabled() && UI.elements.lockBtn) {
            UI.elements.lockBtn.style.display = 'flex';
        }

        // Check if we need to show the notification
        if (!hasApiKey) {
            this.showApiKeyNotification();
        } else {
            this.hideApiKeyNotification();
        }
    }
};