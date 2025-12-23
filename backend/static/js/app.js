/**
 * Main application initialization and orchestration
 */
const App = {
    // Application state
    state: {
        initialized: false,
        currentView: 'chat' // 'chat', 'editor'
    },

    // Initialize the application
    init() {
        if (this.state.initialized) {
            console.warn('App already initialized');
            return;
        }

        try {
            console.log('Initializing Apprised Chat...');
            
            // Initialize modules
            this.initializeModules();
            
            // Set up global event listeners
            this.bindGlobalEvents();
            
            // Load initial data and UI
            this.loadInitialState();
            
            // Focus message input
            try {
                UI.focusMessageInput();
            } catch (error) {
                console.warn('Failed to focus message input:', error);
            }

            // Initialize sidebar resizing
            try {
                UI.initSidebarResize();
            } catch (error) {
                console.warn('Failed to initialize sidebar resize:', error);
            }

            // Initialize scroll detection for smart autoscroll
            try {
                UI.initScrollDetection();
            } catch (error) {
                console.warn('Failed to initialize scroll detection:', error);
            }
            
            this.state.initialized = true;
            console.log('Apprised Chat initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    },

    // Initialize all modules
    initializeModules() {
        // Initialize system prompts first (needed for chat)
        try {
            SystemPrompts.init();
            console.log('SystemPrompts module initialized');
        } catch (error) {
            console.error('Failed to initialize SystemPrompts:', error);
        }
        
        // Initialize documents module
        try {
            Documents.init();
            console.log('Documents module initialized');
        } catch (error) {
            console.error('Failed to initialize Documents:', error);
        }

        // Initialize Claude changes module
        try {
            ClaudeChanges.bindKeyboardShortcuts();
            this.bindClaudeChangesEvents();
            console.log('ClaudeChanges module initialized');
        } catch (error) {
            console.error('Failed to initialize ClaudeChanges:', error);
        }

        // Initialize chat module
        try {
            Chat.init();
            console.log('Chat module initialized');
        } catch (error) {
            console.error('Failed to initialize Chat:', error);
        }

        // Initialize agents module
        try {
            Agents.init();
            console.log('Agents module initialized');
        } catch (error) {
            console.error('Failed to initialize Agents:', error);
        }

        // Initialize tools module
        try {
            Tools.init();
            console.log('Tools module initialized');
        } catch (error) {
            console.error('Failed to initialize Tools:', error);
        }
        
        // Initialize files module
        try {
            Files.init();
            console.log('Files module initialized');
        } catch (error) {
            console.error('Failed to initialize Files:', error);
        }
        
        // Initialize settings module
        try {
            Settings.init();
            console.log('Settings module initialized');
        } catch (error) {
            console.error('Failed to initialize Settings:', error);
        }
        
        console.log('Module initialization completed');
    },

    // Bind Claude changes review panel events
    bindClaudeChangesEvents() {
        // Previous change button
        UI.elements.prevChangeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            ClaudeChanges.prevChange();
        });

        // Next change button
        UI.elements.nextChangeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            ClaudeChanges.nextChange();
        });

        // Accept change button
        UI.elements.acceptChangeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            ClaudeChanges.acceptCurrentChange();
        });

        // Reject change button
        UI.elements.rejectChangeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            ClaudeChanges.rejectCurrentChange();
        });

        // Accept all button
        UI.elements.acceptAllBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Accept all pending changes?')) {
                ClaudeChanges.acceptAll();
            }
        });

        // Reject all button
        UI.elements.rejectAllBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Reject all pending changes?')) {
                ClaudeChanges.rejectAll();
            }
        });
    },

    // Set up global event listeners
    bindGlobalEvents() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to exit editor
            if (e.key === 'Escape' && this.state.currentView === 'editor') {
                SystemPrompts.exitEdit();
            }

            // Ctrl/Cmd + N for new chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                Chat.createNewChat();
            }

            // Ctrl/Cmd + L for lock
            if ((e.ctrlKey || e.metaKey) && e.key === 'l' && Storage.isEncryptionEnabled()) {
                e.preventDefault();
                this.lock();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            UI.autoScroll();
        });

        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                UI.focusMessageInput();
            }
        });

        // Reset inactivity timer on user activity
        const resetTimer = () => {
            if (Storage.sessionPassphrase) {
                Storage.resetInactivityTimer();
            }
        };

        // Track user activity to reset auto-lock timer
        document.addEventListener('mousemove', resetTimer, { passive: true });
        document.addEventListener('keypress', resetTimer, { passive: true });
        document.addEventListener('click', resetTimer, { passive: true });

        // Error handling for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('An unexpected error occurred. Please try again.');
        });

        // Lock button
        UI.elements.lockBtn?.addEventListener('click', () => {
            this.lock();
        });

        // Unlock button
        UI.elements.unlockBtn?.addEventListener('click', () => {
            this.unlock();
        });
    },

    // Load initial application state
    async loadInitialState() {
        try {
            // Check if app needs to be unlocked on startup
            if (Storage.isLocked()) {
                // Try to auto-unlock with stored passphrase
                const storedPassphrase = await Storage.getStoredPassphrase();
                if (storedPassphrase) {
                    await Storage.setSessionPassphrase(storedPassphrase, false);
                    console.log('Auto-unlocked with stored passphrase');
                } else {
                    // Show locked overlay
                    this.showLockedOverlay();
                    return;
                }
            }

            // Render system prompts list
            SystemPrompts.render();

            // Render chat list
            Chat.renderChatList();

            // Load most recent chat or create new one
            const chats = Storage.getChats();
            if (Object.keys(chats).length === 0) {
                // Create first chat if none exist
                Chat.createNewChat();
            } else {
                // Load the most recent chat
                const sortedChats = Object.values(chats).sort((a, b) => b.createdAt - a.createdAt);
                Chat.loadChat(sortedChats[0].id);
            }

            // Show lock button if encryption is enabled
            if (Storage.isEncryptionEnabled() && UI.elements.lockBtn) {
                UI.elements.lockBtn.style.display = 'flex';
            }
        } catch (error) {
            console.error('Failed to load initial state:', error);
            // Try to create a new chat as fallback
            try {
                Chat.createNewChat();
            } catch (fallbackError) {
                console.error('Failed to create fallback chat:', fallbackError);
            }
        }
    },

    // View management
    setView(view) {
        this.state.currentView = view;
        
        // Update UI based on view
        switch (view) {
            case 'chat':
                UI.elements.chatContainer.style.display = '';
                UI.elements.systemPromptEditor.classList.remove('active');
                break;
            case 'editor':
                UI.elements.chatContainer.style.display = 'none';
                UI.elements.systemPromptEditor.classList.add('active');
                break;
        }
    },

    // Error handling
    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc2626;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    },

    // Success notification
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #059669;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    },

    // Lock application
    lock() {
        if (!Storage.isEncryptionEnabled()) {
            return;
        }

        // Clear session passphrase
        Storage.clearSession();

        // Show locked overlay
        this.showLockedOverlay();

        this.showSuccess('App locked securely');
    },

    // Unlock application
    async unlock() {
        const passphrase = await Settings.promptForPassphrase('unlock');

        if (passphrase) {
            // Hide locked overlay
            this.hideLockedOverlay();

            // Reload UI
            await this.loadInitialState();

            this.showSuccess('App unlocked');
        }
    },

    // Handle auto-lock (called from Storage timeout)
    handleAutoLock() {
        console.log('Auto-lock triggered');
        this.showLockedOverlay();
        this.showError('App auto-locked due to inactivity');
    },

    // Show locked overlay
    showLockedOverlay() {
        if (UI.elements.lockedOverlay) {
            UI.elements.lockedOverlay.style.display = 'flex';
        }
    },

    // Hide locked overlay
    hideLockedOverlay() {
        if (UI.elements.lockedOverlay) {
            UI.elements.lockedOverlay.style.display = 'none';
        }
    },

};

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Make App available globally for debugging
window.App = App;