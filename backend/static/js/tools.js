/**
 * Tools management module
 */
const Tools = {
    // State
    webSearchEnabled: false,
    docContextEnabled: false,

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
                this.docContextEnabled = state.docContextEnabled || false;
            } catch (error) {
                console.warn('Failed to load tools state:', error);
                this.webSearchEnabled = false;
                this.docContextEnabled = false;
            }
        }
        this.updateUI();
    },

    // Save tool states to localStorage
    saveState() {
        const state = {
            webSearchEnabled: this.webSearchEnabled,
            docContextEnabled: this.docContextEnabled
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

        const docContextToggle = document.getElementById('docContextToggle');
        if (docContextToggle) {
            docContextToggle.addEventListener('change', (e) => {
                this.setDocContext(e.target.checked);
            });
        }
    },

    // Update UI to reflect current state
    updateUI() {
        const webSearchToggle = document.getElementById('webSearchToggle');
        if (webSearchToggle) {
            webSearchToggle.checked = this.webSearchEnabled;
        }

        const docContextToggle = document.getElementById('docContextToggle');
        if (docContextToggle) {
            docContextToggle.checked = this.docContextEnabled;
        }

        this.updateDocContextIndicator();
    },

    // Update doc context indicator visibility
    updateDocContextIndicator() {
        const indicator = document.getElementById('docContextIndicator');
        if (indicator) {
            if (this.docContextEnabled && typeof Documents !== 'undefined' && Documents.currentDocumentId) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        }
    },

    // Update doc context indicator with actual status from file preparation
    updateDocContextIndicatorWithStatus(docContextAdded) {
        const indicator = document.getElementById('docContextIndicator');
        if (indicator) {
            if (docContextAdded) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        }
    },

    // Toggle web search
    setWebSearch(enabled) {
        this.webSearchEnabled = enabled;
        this.saveState();
        console.log('Web search', enabled ? 'enabled' : 'disabled');
    },

    // Toggle doc context
    setDocContext(enabled) {
        this.docContextEnabled = enabled;
        this.saveState();
        this.updateDocContextIndicator();
        console.log('Doc context', enabled ? 'enabled' : 'disabled');
        
        // Refresh copy-to-document buttons in chat when doc context is toggled
        if (typeof UI !== 'undefined' && UI.refreshCopyToDocumentButtons) {
            UI.refreshCopyToDocumentButtons();
        }
    },

    // Get current web search state
    isWebSearchEnabled() {
        return this.webSearchEnabled;
    },

    // Get current doc context state
    isDocContextEnabled() {
        return this.docContextEnabled;
    },

    // Get current document as file attachment
    getCurrentDocumentAsFile() {
        if (!this.docContextEnabled) {
            return null;
        }

        // Check if Documents module is available and a document is open
        if (typeof Documents === 'undefined' || !Documents.currentDocumentId) {
            return null;
        }

        const currentDocument = Documents.documents[Documents.currentDocumentId];
        if (!currentDocument) {
            return null;
        }

        // Create file attachment in same format as Files module
        const documentContent = currentDocument.content || '';
        const documentTitle = currentDocument.title || 'Untitled Document';
        const fileName = documentTitle;
        
        // Convert to base64 for consistency with file system
        const base64Content = btoa(unescape(encodeURIComponent(documentContent)));
        
        return {
            id: `doc_context_${currentDocument.id}`,
            name: fileName,
            type: 'text/html',
            size: documentContent.length,
            data: `data:text/html;base64,${base64Content}`
        };
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