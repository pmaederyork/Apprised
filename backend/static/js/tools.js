/**
 * Tools management module
 */
const Tools = {
    // State
    webSearchEnabled: false,

    // Initialize tools
    init() {
        this.loadState();
        this.bindEvents();
    },

    // Load tool states from localStorage
    loadState() {
        const saved = localStorage.getItem('toolsState');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.webSearchEnabled = state.webSearchEnabled || false;
            } catch (error) {
                console.warn('Failed to load tools state:', error);
                this.webSearchEnabled = false;
            }
        }
        this.updateUI();
    },

    // Save tool states to localStorage
    saveState() {
        const state = {
            webSearchEnabled: this.webSearchEnabled
        };
        localStorage.setItem('toolsState', JSON.stringify(state));
    },

    // Bind event listeners
    bindEvents() {
        const webSearchToggle = document.getElementById('webSearchToggle');
        if (webSearchToggle) {
            webSearchToggle.addEventListener('change', (e) => {
                this.setWebSearch(e.target.checked);
            });
        }
    },

    // Update UI to reflect current state
    updateUI() {
        const webSearchToggle = document.getElementById('webSearchToggle');
        if (webSearchToggle) {
            webSearchToggle.checked = this.webSearchEnabled;
        }
    },

    // Toggle web search
    setWebSearch(enabled) {
        this.webSearchEnabled = enabled;
        this.saveState();
        console.log('Web search', enabled ? 'enabled' : 'disabled');
    },

    // Get current web search state
    isWebSearchEnabled() {
        return this.webSearchEnabled;
    },

    // Get tools configuration for API calls
    getToolsConfig() {
        const tools = [];
        
        if (this.webSearchEnabled) {
            // According to Claude API docs, web search uses the correct tool format
            tools.push({
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 5
            });
        }
        
        return tools;
    }
};