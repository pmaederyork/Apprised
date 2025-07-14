/**
 * Tools management module
 */
const Tools = {
    // State
    webSearchEnabled: false,
    docContextEnabled: false,
    screenshareEnabled: false,
    chatgptEnabled: false,

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
                this.screenshareEnabled = state.screenshareEnabled || false;
                this.chatgptEnabled = state.chatgptEnabled || false;
            } catch (error) {
                console.warn('Failed to load tools state:', error);
                this.webSearchEnabled = false;
                this.docContextEnabled = false;
                this.screenshareEnabled = false;
                this.chatgptEnabled = false;
            }
        }
        this.updateUI();
    },

    // Save tool states to localStorage
    saveState() {
        const state = {
            webSearchEnabled: this.webSearchEnabled,
            docContextEnabled: this.docContextEnabled,
            screenshareEnabled: this.screenshareEnabled,
            chatgptEnabled: this.chatgptEnabled
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

        const screenshareToggle = document.getElementById('screenshareToggle');
        if (screenshareToggle) {
            screenshareToggle.addEventListener('change', (e) => {
                this.setScreenshare(e.target.checked);
            });
        }

        const chatgptToggle = document.getElementById('chatgptToggle');
        if (chatgptToggle) {
            chatgptToggle.addEventListener('change', (e) => {
                this.setChatGPT(e.target.checked);
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

        const chatgptToggle = document.getElementById('chatgptToggle');
        if (chatgptToggle) {
            chatgptToggle.checked = this.chatgptEnabled;
        }

        const screenshareToggle = document.getElementById('screenshareToggle');
        if (screenshareToggle) {
            screenshareToggle.checked = this.screenshareEnabled;
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

    // Toggle ChatGPT
    setChatGPT(enabled) {
        this.chatgptEnabled = enabled;
        this.saveState();
        console.log('ChatGPT', enabled ? 'enabled' : 'disabled');
    },

    // Get current ChatGPT state
    isChatGPTEnabled() {
        return this.chatgptEnabled;
    },

    // Set screenshare state
    async setScreenshare(enabled) {
        this.screenshareEnabled = enabled;
        
        if (this.screenshareEnabled) {
            // Start stream immediately (prompts for window selection)
            await ScreenShare.startStream();
            // If stream failed to start, ScreenShare will call toggleScreenshare again to turn it off
        } else {
            // Stop stream immediately
            ScreenShare.stopStream();
        }
        
        this.saveState();
        console.log('Screenshare', this.screenshareEnabled ? 'enabled' : 'disabled');
    },

    // Toggle screenshare (for compatibility with existing ScreenShare module)
    async toggleScreenshare() {
        this.screenshareEnabled = !this.screenshareEnabled;
        
        if (this.screenshareEnabled) {
            await ScreenShare.startStream();
        } else {
            ScreenShare.stopStream();
        }
        
        this.saveState();
        
        // Update the checkbox to reflect the new state
        const screenshareToggle = document.getElementById('screenshareToggle');
        if (screenshareToggle) {
            screenshareToggle.checked = this.screenshareEnabled;
        }
        
        console.log('Screenshare', this.screenshareEnabled ? 'enabled' : 'disabled');
    },


    // Get current screenshare state
    isScreenshareEnabled() {
        return this.screenshareEnabled;
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

        if (this.chatgptEnabled) {
            tools.push({
                name: "chatgpt",
                description: "Call ChatGPT API only when explicitly asked by the user. Use this tool when the user specifically requests ChatGPT, asks to compare responses, or wants to see what ChatGPT would say. ChatGPT has web search capabilities and can provide current information.",
                input_schema: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "The prompt to send to ChatGPT"
                        },
                        show_response: {
                            type: "boolean",
                            description: "Whether to show the ChatGPT response separately to the user (true) or just integrate it into the response (false)",
                            default: false
                        }
                    },
                    required: ["prompt"]
                }
            });
        }
        
        return tools;
    }
};