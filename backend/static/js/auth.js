/**
 * Authentication Module
 * Handles Google OAuth login flow and API key setup
 */
const Auth = {
    user: null,
    hasApiKey: false,

    /**
     * Initialize authentication
     */
    async init() {
        console.log('Initializing authentication...');

        // Check authentication status
        const status = await this.checkAuth();

        if (!status.authenticated) {
            // User not authenticated - redirect to landing page
            window.location.href = '/';
            return false;
        }

        this.user = status.user;

        // Check if API key exists in localStorage
        const apiKey = localStorage.getItem('anthropicApiKey');
        this.hasApiKey = !!apiKey;

        if (!this.hasApiKey) {
            // Check if user previously dismissed the setup
            const setupDismissed = localStorage.getItem('apiKeySetupDismissed');

            if (setupDismissed) {
                // User dismissed setup previously - show app without API key
                this.showMainApp();
                return true;
            }

            // Check if this is a returning user (has existing data)
            const isReturningUser = this.checkForExistingData();

            if (isReturningUser) {
                // Returning user - show main app with API key notification
                this.showMainApp();
                return true; // Let app initialize, Settings will show notification
            } else {
                // First-time user - show setup overlay
                this.showApiKeySetup();
                return false;
            }
        }

        // User is fully authenticated and has API key
        this.showMainApp();
        return true;
    },

    /**
     * Check if user has existing data (returning user)
     */
    checkForExistingData() {
        try {
            // Check for existing chats
            const chats = localStorage.getItem('chats');
            if (chats && Object.keys(JSON.parse(chats)).length > 0) {
                return true;
            }

            // Check for existing documents
            const documents = localStorage.getItem('documents');
            if (documents && Object.keys(JSON.parse(documents)).length > 0) {
                return true;
            }

            // Check for existing system prompts
            const prompts = localStorage.getItem('systemPrompts');
            if (prompts && Object.keys(JSON.parse(prompts)).length > 0) {
                return true;
            }

            // Check for saved settings (indicates prior usage)
            const appSettings = localStorage.getItem('appSettings');
            if (appSettings && Object.keys(JSON.parse(appSettings)).length > 0) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking for existing data:', error);
            return false;
        }
    },

    /**
     * Check if user is authenticated
     */
    async checkAuth() {
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to check auth status:', error);
            return { authenticated: false };
        }
    },

    /**
     * Show API key setup screen
     */
    showApiKeySetup() {
        // Show API key setup overlay (app stays visible underneath)
        const apiKeySetup = document.getElementById('apiKeySetup');
        if (apiKeySetup) {
            apiKeySetup.style.display = 'flex';

            // Set user name
            const userName = document.getElementById('setupUserName');
            if (userName && this.user) {
                userName.textContent = this.user.name || this.user.email;
            }
        }
    },

    /**
     * Show main application
     */
    showMainApp() {
        // Hide setup screen
        const apiKeySetup = document.getElementById('apiKeySetup');
        if (apiKeySetup) apiKeySetup.style.display = 'none';

        // Show main app
        if (UI.elements.sidebar) UI.elements.sidebar.style.display = '';
        if (UI.elements.mainContent) UI.elements.mainContent.style.display = '';

        // Note: updateUserMenu() is now called from app.js after full initialization
        // to avoid race condition with DOM elements on hard refresh
    },

    /**
     * Save API key
     */
    async saveApiKey() {
        const input = document.getElementById('setupApiKeyInput');
        const errorDiv = document.getElementById('apiKeyError');
        const button = document.getElementById('saveApiKeyBtn');

        if (!input) return;

        const apiKey = input.value.trim();

        // Clear previous error
        if (errorDiv) errorDiv.textContent = '';

        // Validate
        if (!apiKey) {
            if (errorDiv) errorDiv.textContent = 'Please enter your API key';
            return;
        }

        if (!apiKey.startsWith('sk-ant-')) {
            if (errorDiv) errorDiv.textContent = 'Invalid API key format. Should start with sk-ant-';
            return;
        }

        // Save to localStorage
        localStorage.setItem('anthropicApiKey', apiKey);

        // Clear dismissed flag since user now has a key
        localStorage.removeItem('apiKeySetupDismissed');

        this.hasApiKey = true;
        this.showMainApp();

        // Initialize the rest of the app
        if (typeof initializeModules === 'function') {
            initializeModules();
        }
    },

    /**
     * Skip API key setup - user can add key later in settings
     */
    skipApiKeySetup() {
        // Remember that user dismissed the setup
        localStorage.setItem('apiKeySetupDismissed', 'true');

        this.hasApiKey = false;
        this.showMainApp();

        // Initialize the rest of the app (chat will show error when used)
        if (typeof initializeModules === 'function') {
            initializeModules();
        }

        console.log('API key setup skipped - chat will be disabled until key is added in Settings');
    },

    /**
     * Update user menu in header
     */
    updateUserMenu() {
        if (!this.user) return;

        // Show user profile in footer
        if (UI.elements.userProfile) {
            UI.elements.userProfile.style.display = 'flex';
        }

        // Set user avatar in footer
        if (UI.elements.userAvatarFooter && this.user.picture) {
            UI.elements.userAvatarFooter.src = this.user.picture;
            UI.elements.userAvatarFooter.alt = this.user.name || this.user.email;
        }

        // Set user name in footer (first name only)
        if (UI.elements.userNameFooter) {
            const displayName = this.user.name ? this.user.name.split(' ')[0] : this.user.email;
            UI.elements.userNameFooter.textContent = displayName;
        }

        // Bind click handler for user profile to toggle menu
        if (UI.elements.userProfile) {
            UI.elements.userProfile.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserMenu();
            });
        }

        // Bind menu item click handlers
        if (UI.elements.menuSettings) {
            UI.elements.menuSettings.addEventListener('click', () => {
                this.closeUserMenu();
                // Open settings modal directly
                if (typeof Settings !== 'undefined' && Settings.openSettings) {
                    Settings.openSettings();
                }
            });
        }

        if (UI.elements.menuLogout) {
            UI.elements.menuLogout.addEventListener('click', () => {
                this.closeUserMenu();
                this.logout();
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (UI.elements.userMenuDropdown &&
                UI.elements.userMenuDropdown.style.display === 'block' &&
                !e.target.closest('.user-menu-dropdown') &&
                !e.target.closest('.user-profile')) {
                this.closeUserMenu();
            }
        });
    },

    /**
     * Toggle user menu dropdown
     */
    toggleUserMenu() {
        if (!UI.elements.userMenuDropdown) return;

        const isVisible = UI.elements.userMenuDropdown.style.display === 'block';
        if (isVisible) {
            this.closeUserMenu();
        } else {
            UI.elements.userMenuDropdown.style.display = 'block';
        }
    },

    /**
     * Close user menu dropdown
     */
    closeUserMenu() {
        if (UI.elements.userMenuDropdown) {
            UI.elements.userMenuDropdown.style.display = 'none';
        }
    },

    /**
     * Logout user
     */
    logout() {
        if (confirm('Are you sure you want to log out?')) {
            window.location.href = '/auth/logout';
        }
    }
};

// Bind global functions for HTML onclick handlers
window.saveApiKey = () => Auth.saveApiKey();
window.skipApiKeySetup = () => Auth.skipApiKeySetup();
window.logoutUser = () => Auth.logout();
