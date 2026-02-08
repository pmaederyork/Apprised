/**
 * Claxus WebSocket client and mode manager
 * Handles bidirectional communication with agent orchestration system
 * Manages dedicated Claxus conversation separate from regular chats
 */
const Claxus = {
    ws: null,
    conversationId: null,
    connectionState: 'DISCONNECTED', // CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED
    isSending: false,
    active: false, // Whether Claxus mode is currently active
    currentStreamingBubble: null,
    fullResponse: '',
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    messageHandlers: {},
    reconnectTimeout: null,
    savedChatState: null, // Stores regular chat state when entering Claxus mode

    /**
     * Check if Claxus is configured (enabled in settings + URL set)
     */
    isConfigured() {
        const enabled = Storage.getSetting('claxusEnabled', false);
        const url = Settings.getClaxusUrl();
        return enabled && url && url.length > 0;
    },

    /**
     * Update sidebar button visibility based on settings
     */
    updateButtonVisibility() {
        const btn = document.getElementById('claxusSidebarBtn');
        if (btn) {
            btn.style.display = this.isConfigured() ? '' : 'none';
        }
    },

    /**
     * Enter Claxus mode - switch to dedicated Claxus conversation
     */
    enterMode() {
        if (this.active) return;
        if (this.isSending || (typeof Chat !== 'undefined' && Chat.isSending)) return;

        this.active = true;

        // Save current chat state so we can restore it later
        if (typeof Chat !== 'undefined') {
            this.savedChatState = {
                chatId: Chat.currentChatId,
                messages: [...Chat.currentMessages]
            };
        }

        // Add body class for CSS styling
        document.body.classList.add('claxus-mode');

        // Update sidebar button state
        const btn = document.getElementById('claxusSidebarBtn');
        if (btn) btn.classList.add('active');

        // Update chat title
        if (UI.elements.chatTitle) {
            UI.elements.chatTitle.value = 'Claxus';
            UI.elements.chatTitle.readOnly = true;
        }

        // Clear chat and show Claxus welcome
        UI.clearMessages();

        // Update input placeholder
        if (UI.elements.messageInput) {
            UI.elements.messageInput.placeholder = 'Message Claxus...';
        }

        // Get or create persistent conversation ID
        this.conversationId = Storage.getSetting('claxusConversationId', null);
        if (!this.conversationId) {
            this.conversationId = this.generateConversationId();
            Storage.saveSetting('claxusConversationId', this.conversationId);
        }

        // Connect to Claxus gateway
        this.connect(this.conversationId);
    },

    /**
     * Exit Claxus mode - return to regular chat
     */
    exitMode() {
        if (!this.active) return;

        this.active = false;
        this.disconnect();

        // Remove body class
        document.body.classList.remove('claxus-mode');

        // Update sidebar button state
        const btn = document.getElementById('claxusSidebarBtn');
        if (btn) btn.classList.remove('active');

        // Restore chat title
        if (UI.elements.chatTitle) {
            UI.elements.chatTitle.readOnly = false;
        }

        // Restore input placeholder
        if (UI.elements.messageInput) {
            UI.elements.messageInput.placeholder = 'Reply to Claude...';
        }

        // Restore previous chat state
        if (this.savedChatState && typeof Chat !== 'undefined') {
            Chat.loadChat(this.savedChatState.chatId);
            this.savedChatState = null;
        }
    },

    /**
     * Toggle Claxus mode
     */
    toggleMode() {
        if (this.active) {
            this.exitMode();
        } else {
            this.enterMode();
        }
    },

    /**
     * Initialize message handlers
     */
    initHandlers() {
        this.messageHandlers = {
            'history': (data) => this.handleHistory(data),
            'stream': (data) => this.handleStream(data),
            'complete': (data) => this.handleComplete(data),
            'tool_use': (data) => this.handleToolUse(data),
            'tool_status': (data) => this.handleToolStatus(data),
            'agent_start': (data) => this.handleAgentStart(data),
            'agent_complete': (data) => this.handleAgentComplete(data),
            'routing': (data) => this.handleRouting(data),
            'error': (data) => this.handleError(data),
            'cleared': (data) => this.handleCleared(data),
            'interrupted': (data) => this.handleInterrupted(data),
            'context_stats': (data) => this.handleContextStats(data),
            'scheduled': (data) => this.handleScheduled(data),
            'new_conversation': (data) => this.handleNewConversation(data),
            'confirmation_needed': (data) => this.handleConfirmationNeeded(data),
            'confirmation_resolved': (data) => this.handleConfirmationResolved(data),
            'switched': (data) => this.handleSwitched(data)
        };
    },

    /**
     * Connect to Claxus WebSocket API
     */
    connect(conversationId) {
        if (this.ws && (this.connectionState === 'CONNECTED' || this.connectionState === 'CONNECTING')) {
            console.log('[Claxus] Already connected or connecting');
            return;
        }

        this.conversationId = conversationId || this.generateConversationId();
        this.connectionState = 'CONNECTING';
        this.initHandlers();

        const wsUrl = this.getWsUrl();
        const fullUrl = `${wsUrl}/ws/chat/${this.conversationId}`;

        console.log(`[Claxus] Connecting to ${fullUrl}`);

        try {
            this.ws = new WebSocket(fullUrl);
            this.ws.addEventListener('open', () => this.handleOpen());
            this.ws.addEventListener('close', (event) => this.handleClose(event));
            this.ws.addEventListener('error', (error) => {
                console.error('[Claxus] WebSocket error:', error);
                this.handleConnectionError();
            });
            this.ws.addEventListener('message', (event) => this.handleMessage(event));
        } catch (error) {
            console.error('[Claxus] Failed to create WebSocket:', error);
            this.handleConnectionError();
        }
    },

    /**
     * Disconnect from Claxus WebSocket
     */
    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            console.log('[Claxus] Disconnecting');
            this.connectionState = 'DISCONNECTED';
            this.ws.close(1000); // Normal closure
            this.ws = null;
        }

        ClaxusUI.hideStatus();
    },

    /**
     * Send helper - check WebSocket state before sending
     */
    send(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[Claxus] Cannot send - WebSocket not open');
            return false;
        }

        try {
            this.ws.send(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('[Claxus] Send failed:', error);
            return false;
        }
    },

    /**
     * Send message to Claxus
     */
    sendMessage(content) {
        this.isSending = true;
        UI.setSendButtonState(false, true); // Show stop button

        // Add user message to UI
        UI.addMessage(content, true, []);
        UI.clearMessageInput();

        // Start streaming bubble for response
        this.currentStreamingBubble = UI.addStreamingMessage(false, null);
        this.fullResponse = '';

        this.send({ type: 'message', content });
    },

    /**
     * Send interrupt signal
     */
    sendInterrupt() {
        this.send({ type: 'interrupt' });
    },

    /**
     * Send clear conversation signal
     */
    sendClear() {
        this.send({ type: 'clear' });
    },

    /**
     * Send new conversation signal
     */
    sendNewConversation() {
        // Generate new conversation ID
        this.conversationId = this.generateConversationId();
        Storage.saveSetting('claxusConversationId', this.conversationId);
        this.send({ type: 'new_conversation' });
    },

    /**
     * Send confirmation response
     */
    sendConfirmation(confirmationId, approved) {
        this.send({
            type: 'confirmation_response',
            confirmation_id: confirmationId,
            approved
        });
    },

    /**
     * Request context statistics
     */
    requestContext() {
        this.send({ type: 'context' });
    },

    /**
     * Handle incoming WebSocket message
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            const handler = this.messageHandlers[data.type];

            if (handler) {
                handler(data);
            } else {
                console.warn('[Claxus] Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('[Claxus] Failed to parse message:', error);
        }
    },

    /**
     * Handle connection open
     */
    handleOpen() {
        console.log('[Claxus] Connected');
        this.connectionState = 'CONNECTED';
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage('Connected to Claxus');
        }
    },

    /**
     * Handle connection close
     */
    handleClose(event) {
        console.log(`[Claxus] Connection closed (code: ${event.code})`);

        if (event.code === 1000) {
            this.connectionState = 'DISCONNECTED';
            console.log('[Claxus] Normal disconnect');
        } else {
            this.attemptReconnect();
        }
    },

    /**
     * Handle connection error
     */
    handleConnectionError() {
        console.error('[Claxus] Connection error');

        if (this.connectionState === 'CONNECTING') {
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage('Could not connect to Claxus at ' + this.getWsUrl() + '. Check settings and ensure Claxus is running.');
            }
            this.connectionState = 'DISCONNECTED';
        }
    },

    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[Claxus] Max reconnect attempts reached');
            this.connectionState = 'DISCONNECTED';

            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage('Connection lost. Click the Claxus button to reconnect.');
            }

            ClaxusUI.hideStatus();
            return;
        }

        this.connectionState = 'RECONNECTING';
        this.reconnectAttempts++;

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[Claxus] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        ClaxusUI.showStatus('Reconnecting...');

        this.reconnectTimeout = setTimeout(() => {
            this.connect(this.conversationId);
        }, delay);
    },

    /**
     * Generate conversation ID
     */
    generateConversationId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Get WebSocket URL from settings
     */
    getWsUrl() {
        if (typeof Settings !== 'undefined' && Settings.getClaxusUrl) {
            return Settings.getClaxusUrl();
        }
        return localStorage.getItem('claxusUrl') || 'ws://localhost:8000';
    },

    // ===== Message Handlers =====

    handleHistory(data) {
        console.log('[Claxus] Received history:', data.messages?.length || 0, 'messages');

        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                UI.addMessage(msg.content, msg.role === 'user', []);
            });
        }
    },

    handleStream(data) {
        if (data.chunk && this.currentStreamingBubble) {
            this.fullResponse += data.chunk;
            UI.updateStreamingMessage(this.currentStreamingBubble, this.fullResponse);
        }
    },

    handleComplete(data) {
        console.log('[Claxus] Streaming complete');

        if (this.currentStreamingBubble) {
            UI.updateStreamingMessage(this.currentStreamingBubble, this.fullResponse, true);
            this.currentStreamingBubble = null;
        }

        this.fullResponse = '';
        this.isSending = false;
        UI.setSendButtonState(true, false);
        UI.focusMessageInput();
    },

    handleToolUse(data) {
        const indicator = ClaxusUI.createToolIndicator(data.tool_name, data.tool_input);
        UI.addClaxusElement(indicator);
    },

    handleToolStatus(data) {
        const statusIndicator = ClaxusUI.createToolStatusIndicator(data.content);
        UI.addClaxusElement(statusIndicator);
    },

    handleAgentStart(data) {
        console.log('[Claxus] Agent started:', data.agent_type);
        ClaxusUI.showStatus(data.agent_type);

        const badge = ClaxusUI.createAgentBadge(data.agent_type);
        UI.addClaxusElement(badge);
    },

    handleAgentComplete(data) {
        console.log('[Claxus] Agent complete:', data.agent_type);
        ClaxusUI.hideStatus();

        const completionBadge = ClaxusUI.createCompletionBadge(data.duration_ms, data.success);
        UI.addClaxusElement(completionBadge);
    },

    handleRouting(data) {
        const routingIndicator = ClaxusUI.createRoutingIndicator(data.agent, data.confidence);
        UI.addClaxusElement(routingIndicator);
    },

    handleError(data) {
        console.error('[Claxus] Error:', data.message || data.error);

        const errorContent = data.message || data.error || 'Unknown error';
        UI.addMessage(`Error: ${errorContent}`, false, []);

        this.isSending = false;
        UI.setSendButtonState(true, false);
    },

    handleCleared(data) {
        console.log('[Claxus] Conversation cleared');
        UI.clearMessages();
        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage('Conversation cleared');
        }
    },

    handleInterrupted(data) {
        console.log('[Claxus] Message interrupted');

        if (this.currentStreamingBubble) {
            UI.updateStreamingMessage(this.currentStreamingBubble, this.fullResponse, true);
            this.currentStreamingBubble = null;
        }

        const interruptedIndicator = ClaxusUI.createInterruptedIndicator();
        UI.addClaxusElement(interruptedIndicator);

        this.fullResponse = '';
        this.isSending = false;
        UI.setSendButtonState(true, false);
    },

    handleContextStats(data) {
        const statsDisplay = ClaxusUI.createContextStatsDisplay(data.stats);
        UI.addClaxusElement(statsDisplay);
    },

    handleScheduled(data) {
        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage(`Task scheduled: ${data.description || 'Unknown task'}`);
        }
    },

    handleNewConversation(data) {
        console.log('[Claxus] New conversation:', data.conversation_id);
        this.conversationId = data.conversation_id;
        Storage.saveSetting('claxusConversationId', this.conversationId);

        UI.clearMessages();
        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage('New conversation started');
        }
    },

    handleConfirmationNeeded(data) {
        console.log('[Claxus] Confirmation needed:', data.confirmation_id);

        const confirmationDialog = ClaxusUI.createConfirmationDialog(data);
        UI.addClaxusElement(confirmationDialog);
    },

    handleConfirmationResolved(data) {
        console.log('[Claxus] Confirmation resolved:', data.confirmation_id, data.approved);

        const card = document.querySelector(`[data-confirmation-id="${data.confirmation_id}"]`);
        if (card) {
            const statusText = card.querySelector('.confirmation-status');
            if (statusText) {
                statusText.textContent = data.approved ? 'Approved' : 'Denied';
                statusText.style.color = data.approved ? '#10b981' : '#ef4444';
            }

            const buttons = card.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = true);
        }
    },

    handleSwitched(data) {
        console.log('[Claxus] Switched to conversation:', data.conversation_id);
        this.conversationId = data.conversation_id;
        Storage.saveSetting('claxusConversationId', this.conversationId);
    }
};

// Page lifecycle: close WebSocket on page unload
window.addEventListener('pagehide', () => {
    if (Claxus.ws) {
        Claxus.disconnect();
    }
});

// Reconnect if needed when page becomes visible again
window.addEventListener('pageshow', () => {
    if (Claxus.active && Claxus.connectionState === 'DISCONNECTED') {
        Claxus.connect(Claxus.conversationId);
    }
});
