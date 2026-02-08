/**
 * Settings module for managing API key and other application settings
 */

// Settings configuration - Add new settings here
const SETTINGS_CONFIG = {
    apiKey: {
        label: 'Anthropic API Key',
        type: 'password',
        section: 'api',
        validator: (value) => value && value.trim().length > 0 && value.startsWith('sk-ant-') && value.length >= 50,
        storage: 'anthropicApiKey', // Use legacy storage for API key
        required: true
    },
    theme: {
        label: 'Theme',
        type: 'select',
        options: ['light', 'dark', 'auto'],
        section: 'appearance',
        validator: (value) => ['light', 'dark', 'auto'].includes(value),
        storage: 'theme',
        default: 'auto'
    },
    claxusEnabled: {
        label: 'Enable Claxus',
        type: 'boolean',
        default: false,
        storage: 'claxusEnabled',
        section: 'claxus'
    },
    claxusUrl: {
        label: 'Claxus URL',
        type: 'text',
        placeholder: 'ws://127.0.0.1:8000',
        default: 'ws://127.0.0.1:8000',
        storage: 'claxusUrl',
        validator: (value) => value.startsWith('ws://') || value.startsWith('wss://'),
        section: 'claxus'
    }
};

const Settings = {
    // State management
    initialized: false,
    settings: {},

    // DOM elements
    elements: {
        settingsModal: null,
        closeSettingsBtn: null,
        apiKeyInput: null,
        showHideBtn: null,
        apiKeyStatus: null,
        saveApiKeyBtn: null,
        saveApiKeyBtnModal: null,
        deleteApiKeyBtn: null,
        apiKeyNotification: null,
        openSettingsFromNotification: null,
        themeSelect: null
    },

    /**
     * Initialize settings module
     */
    async init() {
        if (this.initialized) return;

        this.initTheme();
        this.initElements();
        this.bindEvents();
        await this.loadAllSettings();
        this.updateUI();

        this.initialized = true;
    },

    /**
     * Initialize DOM element references
     */
    initElements() {
        this.elements.settingsModal = document.getElementById('settingsModal');
        this.elements.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.elements.apiKeyInput = document.getElementById('apiKeyInput');
        this.elements.showHideBtn = document.getElementById('showHideBtn');
        this.elements.apiKeyStatus = document.getElementById('apiKeyStatus');
        this.elements.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        this.elements.saveApiKeyBtnModal = document.getElementById('saveApiKeyBtnModal');
        this.elements.deleteApiKeyBtn = document.getElementById('deleteApiKeyBtn');
        this.elements.apiKeyNotification = document.getElementById('apiKeyNotification');
        this.elements.openSettingsFromNotification = document.getElementById('openSettingsFromNotification');
        // Google Drive elements
        this.elements.gdriveStatusContainer = document.getElementById('gdriveStatusContainer');
        this.elements.gdriveConnectBtn = document.getElementById('gdriveConnectBtn');
        // Theme elements
        this.elements.themeSelect = document.getElementById('themeSelect');
        // Claxus elements
        this.elements.claxusEnabledToggle = document.getElementById('claxusEnabledToggle');
        this.elements.claxusUrlInput = document.getElementById('claxusUrlInput');
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
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

        // Save API key (settings modal)
        this.elements.saveApiKeyBtnModal?.addEventListener('click', () => this.saveApiKey());

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

        // Google Drive connection
        this.elements.gdriveConnectBtn?.addEventListener('click', () => {
            if (typeof GDrive !== 'undefined') {
                GDrive.reconnect();
            }
        });

        // Google Drive disconnect
        this.elements.gdriveDisconnectBtn = document.getElementById('gdriveDisconnectBtn');
        this.elements.gdriveDisconnectBtn?.addEventListener('click', () => {
            if (typeof GDrive !== 'undefined') {
                GDrive.disconnect();
            }
        });

        // Google Drive folder picker
        this.elements.gdriveFolderBtn = document.getElementById('gdriveFolderBtn');
        this.elements.gdriveFolderBtn?.addEventListener('click', () => {
            if (typeof GDrive !== 'undefined') {
                GDrive.pickDefaultFolder();
            }
        });

        // Theme change
        this.elements.themeSelect?.addEventListener('change', (e) => this.setTheme(e.target.value));

        // Claxus enabled toggle
        this.elements.claxusEnabledToggle?.addEventListener('change', (e) => {
            Storage.saveSetting('claxusEnabled', e.target.checked);
            if (typeof Claxus !== 'undefined') {
                Claxus.updateButtonVisibility();
            }
        });

        // Claxus URL change
        this.elements.claxusUrlInput?.addEventListener('change', (e) => {
            Storage.saveSetting('claxusUrl', e.target.value);
            if (typeof Claxus !== 'undefined') {
                Claxus.updateButtonVisibility();
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

    /**
     * Load all settings from storage
     */
    async loadAllSettings() {
        // Load API key (uses legacy storage)
        const apiKey = Storage.getApiKey();
        this.settings.apiKey = apiKey || '';

        // Future: Load other settings from generic storage
        // const appSettings = Storage.getSettings();
        // Object.keys(SETTINGS_CONFIG).forEach(key => {
        //     if (key !== 'apiKey') {
        //         this.settings[key] = appSettings[key] || SETTINGS_CONFIG[key].default;
        //     }
        // });
    },

    /**
     * Load API key into UI
     */
    loadApiKey() {
        const apiKey = Storage.getApiKey();
        if (apiKey && this.elements.apiKeyInput) {
            this.elements.apiKeyInput.value = apiKey;
            this.showStatus('API key loaded', 'success');
        } else if (this.elements.apiKeyInput) {
            this.elements.apiKeyInput.value = '';
            this.showStatus('No API key found', 'warning');
        }

        // Update theme select if it exists
        if (this.elements.themeSelect) {
            this.elements.themeSelect.value = this.settings.theme || 'auto';
        }

        // Load Claxus settings
        if (this.elements.claxusEnabledToggle) {
            this.elements.claxusEnabledToggle.checked = Storage.getSetting('claxusEnabled', false);
        }
        if (this.elements.claxusUrlInput) {
            this.elements.claxusUrlInput.value = Storage.getSetting('claxusUrl', 'ws://127.0.0.1:8000');
        }
    },

    /**
     * Open settings modal
     */
    openSettings() {
        if (!this.elements.settingsModal) return;

        this.elements.settingsModal.style.display = 'flex';
        this.loadApiKey();
        this.validateApiKey();

        // Focus on input after modal opens
        setTimeout(() => {
            this.elements.apiKeyInput?.focus();
        }, 100);
    },

    /**
     * Close settings modal
     */
    closeSettings() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.style.display = 'none';
        }
    },

    /**
     * Toggle password visibility
     */
    togglePasswordVisibility() {
        const input = this.elements.apiKeyInput;
        const btn = this.elements.showHideBtn;

        if (!input || !btn) return;

        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    },

    /**
     * Validate API key
     */
    validateApiKey() {
        if (!this.elements.apiKeyInput) return false;

        const apiKey = this.elements.apiKeyInput.value.trim();
        const config = SETTINGS_CONFIG.apiKey;
        const isValid = config.validator(apiKey);

        // Enable/disable save button (settings modal)
        if (this.elements.saveApiKeyBtnModal) {
            this.elements.saveApiKeyBtnModal.disabled = !isValid;
        }

        // Show validation feedback
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

    /**
     * Save API key
     */
    saveApiKey() {
        if (!this.validateApiKey()) {
            return;
        }

        const apiKey = this.elements.apiKeyInput.value.trim();

        try {
            Storage.saveApiKey(apiKey);
            this.settings.apiKey = apiKey;
            this.showStatus('API key saved!', 'success');

            // Hide notification if visible
            this.hideApiKeyNotification();

            // Update UI
            this.updateUI();

            // Close settings immediately
            this.closeSettings();

        } catch (error) {
            console.error('Error saving API key:', error);
            this.showStatus('Error saving API key', 'error');
        }
    },

    /**
     * Delete API key
     */
    deleteApiKey() {
        if (confirm('Are you sure you want to delete your API key?')) {
            try {
                Storage.deleteApiKey();
                this.settings.apiKey = '';

                if (this.elements.apiKeyInput) {
                    this.elements.apiKeyInput.value = '';
                }

                this.showStatus('API key deleted', 'warning');

                // Update delete button visibility
                if (this.elements.deleteApiKeyBtn) {
                    this.elements.deleteApiKeyBtn.style.display = 'none';
                }

            } catch (error) {
                console.error('Error deleting API key:', error);
                this.showStatus('Error deleting API key', 'error');
            }
        }
    },

    /**
     * Show status message for a specific section
     */
    showStatus(message, type, sectionId = 'apiKey') {
        // Currently only handles API key section
        // Future: Make this section-aware for multiple settings sections
        if (this.elements.apiKeyStatus) {
            this.elements.apiKeyStatus.textContent = message;
            this.elements.apiKeyStatus.className = `api-key-status ${type}`;
            this.elements.apiKeyStatus.style.display = 'block';
        }
    },

    /**
     * Show API key required notification
     */
    showApiKeyNotification() {
        if (this.elements.apiKeyNotification) {
            this.elements.apiKeyNotification.style.display = 'block';
        }
    },

    /**
     * Hide API key required notification
     */
    hideApiKeyNotification() {
        if (this.elements.apiKeyNotification) {
            this.elements.apiKeyNotification.style.display = 'none';
        }
    },

    /**
     * Check if API key is available before making requests
     */
    async checkApiKeyBeforeRequest() {
        const hasKey = Storage.hasApiKey();
        if (!hasKey) {
            this.showApiKeyNotification();
            return false;
        }
        return true;
    },

    /**
     * Get API key for API requests
     */
    async getApiKeyForRequest() {
        return Storage.getApiKey();
    },

    /**
     * Update UI based on current settings state
     */
    updateUI() {
        const hasApiKey = Storage.hasApiKey();

        // Update delete button state
        if (this.elements.deleteApiKeyBtn) {
            this.elements.deleteApiKeyBtn.style.display = hasApiKey ? 'block' : 'none';
        }

        // Check if we need to show the notification
        if (!hasApiKey) {
            this.showApiKeyNotification();
        } else {
            this.hideApiKeyNotification();
        }
    },

    /**
     * Generic method to save a setting (for future expansion)
     */
    async saveSetting(key, value) {
        const config = SETTINGS_CONFIG[key];
        if (!config) {
            console.error(`Unknown setting: ${key}`);
            return false;
        }

        // Validate
        if (config.validator && !config.validator(value)) {
            this.showStatus(`Invalid ${config.label}`, 'error', key);
            return false;
        }

        // Save
        try {
            if (config.storage === 'anthropicApiKey') {
                // Use legacy API key storage
                Storage.saveApiKey(value);
            } else {
                // Use generic storage for other settings
                Storage.saveSetting(config.storage || key, value);
            }

            this.settings[key] = value;
            this.showStatus(`${config.label} saved`, 'success', key);
            return true;
        } catch (error) {
            console.error(`Error saving ${key}:`, error);
            this.showStatus(`Error saving ${config.label}`, 'error', key);
            return false;
        }
    },

    /**
     * Generic method to load a setting (for future expansion)
     */
    async loadSetting(key, defaultValue = null) {
        const config = SETTINGS_CONFIG[key];
        if (!config) {
            console.error(`Unknown setting: ${key}`);
            return defaultValue;
        }

        try {
            if (config.storage === 'anthropicApiKey') {
                return Storage.getApiKey() || defaultValue;
            } else {
                return Storage.getSetting(config.storage || key, defaultValue);
            }
        } catch (error) {
            console.error(`Error loading ${key}:`, error);
            return defaultValue;
        }
    },

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        const resolvedTheme = theme === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : theme;
        document.documentElement.dataset.theme = resolvedTheme;
    },

    /**
     * Set and persist theme
     */
    setTheme(theme) {
        Storage.saveSetting('theme', theme);
        this.settings.theme = theme;
        this.applyTheme(theme);
    },

    /**
     * Initialize theme on load
     */
    initTheme() {
        const theme = Storage.getSetting('theme', 'dark');
        this.settings.theme = theme;
        this.applyTheme(theme);

        // Update select if it exists
        if (this.elements.themeSelect) {
            this.elements.themeSelect.value = theme;
        }

        // Listen for system preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.settings.theme === 'auto') {
                this.applyTheme('auto');
            }
        });
    },

    /**
     * Get Claxus URL from settings
     */
    getClaxusUrl() {
        return Storage.getSetting('claxusUrl', 'ws://127.0.0.1:8000');
    }
};
