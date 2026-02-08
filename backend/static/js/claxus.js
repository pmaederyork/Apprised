/**
 * Claxus WebSocket client and mode manager
 * Handles bidirectional communication with agent orchestration system
 * Manages dedicated Claxus conversation separate from regular chats
 * Renders to its own independent pane (ClaxusUI) regardless of active mode
 */
const Claxus = {
    ws: null,
    conversationId: null,
    connectionState: 'DISCONNECTED', // CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED
    isSending: false,
    active: false, // Whether Claxus pane is currently visible
    currentStreamingBubble: null,
    fullResponse: '',
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    messageHandlers: {},
    reconnectTimeout: null,
    maxStoredEvents: 200,
    messageCount: 0,

    /**
     * Check if Claxus is configured (enabled in settings + URL set)
     */
    isConfigured() {
        const enabled = Storage.getSetting('claxusEnabled', false);
        return enabled === true;
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
     * Bind Claxus input events (called once at startup)
     */
    bindEvents() {
        const input = ClaxusUI.elements.messageInput;
        const sendBtn = ClaxusUI.elements.sendBtn;

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (this.isSending) {
                        this.sendInterrupt();
                    } else {
                        const msg = input.value.trim();
                        if (msg) this.sendMessage(msg);
                    }
                }
            });

            // Auto-resize textarea
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                const newHeight = Math.min(Math.max(input.scrollHeight, 20), 160);
                input.style.height = newHeight + 'px';
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                if (this.isSending) {
                    this.sendInterrupt();
                } else {
                    const msg = (ClaxusUI.elements.messageInput?.value || '').trim();
                    if (msg) this.sendMessage(msg);
                }
            });
        }
    },

    /**
     * Enter Claxus mode - show Claxus pane, hide normal chat
     */
    enterMode() {
        if (this.active) return;

        this.active = true;

        // Add body class for CSS show/hide
        document.body.classList.add('claxus-mode');

        // Update sidebar button state
        const btn = document.getElementById('claxusSidebarBtn');
        if (btn) btn.classList.add('active');

        // Initialize file browser
        if (typeof ClaxusFiles !== 'undefined') {
            ClaxusFiles.init();
        }

        // Get or create persistent conversation ID
        this.conversationId = Storage.getSetting('claxusConversationId', null);
        if (!this.conversationId) {
            this.conversationId = this.generateConversationId();
            Storage.saveSetting('claxusConversationId', this.conversationId);
        }

        // Connect if not already connected
        if (!this.ws || this.connectionState !== 'CONNECTED') {
            this.connect(this.conversationId);
        }

        // Focus Claxus input
        ClaxusUI.focusMessageInput();
    },

    /**
     * Exit Claxus mode - show normal chat, hide Claxus pane
     */
    exitMode() {
        if (!this.active) return;

        this.active = false;

        // Remove body class
        document.body.classList.remove('claxus-mode');

        // Update sidebar button state
        const btn = document.getElementById('claxusSidebarBtn');
        if (btn) btn.classList.remove('active');

        // Focus normal chat input
        UI.focusMessageInput();
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
            'switched': (data) => this.handleSwitched(data),
            'file_list': (data) => ClaxusFiles.handleFileList(data),
            'file_content': (data) => ClaxusFiles.handleFileContent(data),
            'file_saved': (data) => ClaxusFiles.handleFileSaved(data),
            'file_created': (data) => ClaxusFiles.handleFileCreated(data),
            'file_renamed': (data) => ClaxusFiles.handleFileRenamed(data),
            'file_moved': (data) => ClaxusFiles.handleFileMoved(data),
            'file_error': (data) => ClaxusFiles.handleFileError(data)
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
            this.ws.close(1000);
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
        ClaxusUI.setSendButtonState(false, true);

        ClaxusUI.addMessage(content, true, []);
        this.messageCount++;
        ClaxusUI.clearMessageInput();

        this.currentStreamingBubble = ClaxusUI.addStreamingMessage(false, null);
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
     * File operation helpers
     */
    requestFiles(path) { this.send({ type: 'file_list', path }); },
    requestFile(path) { this.send({ type: 'file_read', path }); },
    writeFile(path, content) { this.send({ type: 'file_write', path, content }); },
    mkdir(path) { this.send({ type: 'file_mkdir', path }); },
    renameFile(path, newName) { this.send({ type: 'file_rename', path, new_name: newName }); },
    moveFile(path, destination) { this.send({ type: 'file_move', path, destination }); },

    /**
     * Handle incoming WebSocket message
     * Always renders to Claxus pane regardless of active state
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            const handler = this.messageHandlers[data.type];

            if (!handler) {
                console.warn('[Claxus] Unknown message type:', data.type);
                return;
            }

            handler(data);
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

        ClaxusUI.addSystemMessage('Connected to Claxus');

        // Request initial file listing
        if (typeof ClaxusFiles !== 'undefined') {
            ClaxusFiles.requestFileList('/');
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
            ClaxusUI.addSystemMessage('Could not connect to Claxus at ' + this.getWsUrl() + '. Check settings and ensure Claxus is running.');
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

            ClaxusUI.addSystemMessage('Connection lost. Click the Claxus button to reconnect.');
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
        let url;
        if (typeof Settings !== 'undefined' && Settings.getClaxusUrl) {
            url = Settings.getClaxusUrl();
        } else {
            url = localStorage.getItem('claxusUrl') || 'ws://127.0.0.1:8000';
        }
        return url.replace('://localhost:', '://127.0.0.1:');
    },

    // ===== Event Storage =====

    saveEvent(event) {
        if (!this.conversationId) return;
        event.messageIndex = this.messageCount;
        const key = 'claxusEvents_' + this.conversationId;
        try {
            const events = JSON.parse(localStorage.getItem(key) || '[]');
            events.push(event);
            if (events.length > this.maxStoredEvents) {
                events.splice(0, events.length - this.maxStoredEvents);
            }
            localStorage.setItem(key, JSON.stringify(events));
        } catch (e) {
            console.warn('[Claxus] Failed to save event:', e);
        }
    },

    getEvents() {
        if (!this.conversationId) return [];
        try {
            return JSON.parse(localStorage.getItem('claxusEvents_' + this.conversationId) || '[]');
        } catch (e) {
            return [];
        }
    },

    clearEvents() {
        if (!this.conversationId) return;
        localStorage.removeItem('claxusEvents_' + this.conversationId);
    },

    createReplayElement(evt) {
        const replayOpts = { replay: true };
        switch (evt.type) {
            case 'agent_start':
                return ClaxusUI.createAgentBadge(evt.agent_type, replayOpts);
            case 'tool_use':
                return ClaxusUI.createToolIndicator(evt.tool_name, evt.tool_input, replayOpts);
            case 'routing':
                return ClaxusUI.createRoutingIndicator(evt.agent, evt.confidence, replayOpts);
            case 'agent_complete':
                return ClaxusUI.createCompletionBadge(evt.duration_ms, evt.success);
            case 'complete':
                return null;
            default:
                return null;
        }
    },

    replayEvents() {
        const events = this.getEvents();
        if (events.length === 0) return;

        console.log('[Claxus] Replaying', events.length, 'stored events');
        events.forEach(evt => {
            const element = this.createReplayElement(evt);
            if (element) ClaxusUI.addClaxusElement(element);
        });
    },

    // ===== Message Handlers =====

    handleHistory(data) {
        const messages = data.messages || [];
        const events = this.getEvents();
        console.log('[Claxus] Received history:', messages.length, 'messages,', events.length, 'stored events');

        let eventIdx = 0;
        messages.forEach((msg, msgIdx) => {
            while (eventIdx < events.length && events[eventIdx].messageIndex <= msgIdx) {
                const element = this.createReplayElement(events[eventIdx]);
                if (element) ClaxusUI.addClaxusElement(element);
                eventIdx++;
            }
            ClaxusUI.addMessage(msg.content, msg.role === 'user', []);
        });

        while (eventIdx < events.length) {
            const element = this.createReplayElement(events[eventIdx]);
            if (element) ClaxusUI.addClaxusElement(element);
            eventIdx++;
        }

        this.messageCount = messages.length;
    },

    handleStream(data) {
        const chunk = data.chunk || data.content;
        if (chunk && this.currentStreamingBubble) {
            this.fullResponse += chunk;
            ClaxusUI.updateStreamingMessage(this.currentStreamingBubble, this.fullResponse);
        }
    },

    handleComplete(data) {
        console.log('[Claxus] Streaming complete');
        this.isSending = false;
        this.messageCount++;
        this.saveEvent({ type: 'complete' });
        ClaxusUI.clearSpinners();

        if (this.currentStreamingBubble) {
            ClaxusUI.updateStreamingMessage(this.currentStreamingBubble, this.fullResponse, true);
            this.currentStreamingBubble = null;
        }

        this.fullResponse = '';
        ClaxusUI.setSendButtonState(true, false);
        ClaxusUI.focusMessageInput();
    },

    handleToolUse(data) {
        this.saveEvent({ type: 'tool_use', tool_name: data.tool_name, tool_input: data.tool_input });
        const indicator = ClaxusUI.createToolIndicator(data.tool_name, data.tool_input);
        ClaxusUI.addClaxusElement(indicator);
    },

    handleToolStatus(data) {
        const statusIndicator = ClaxusUI.createToolStatusIndicator(data.content);
        ClaxusUI.addClaxusElement(statusIndicator);
    },

    handleAgentStart(data) {
        console.log('[Claxus] Agent started:', data.agent_type);
        this.saveEvent({ type: 'agent_start', agent_type: data.agent_type });

        const badge = ClaxusUI.createAgentBadge(data.agent_type);
        ClaxusUI.addClaxusElement(badge);
    },

    handleAgentComplete(data) {
        console.log('[Claxus] Agent complete:', data.agent_type);
        this.saveEvent({ type: 'agent_complete', agent_type: data.agent_type, duration_ms: data.duration_ms, success: data.success });
        ClaxusUI.clearSpinners();
        ClaxusUI.hideStatus();

        const completionBadge = ClaxusUI.createCompletionBadge(data.duration_ms, data.success);
        ClaxusUI.addClaxusElement(completionBadge);
    },

    handleRouting(data) {
        this.saveEvent({ type: 'routing', agent: data.agent, confidence: data.confidence });
        const routingIndicator = ClaxusUI.createRoutingIndicator(data.agent, data.confidence);
        ClaxusUI.addClaxusElement(routingIndicator);
    },

    handleError(data) {
        console.error('[Claxus] Error:', data.message || data.error);

        const errorContent = data.message || data.error || 'Unknown error';
        ClaxusUI.addMessage(`Error: ${errorContent}`, false, []);

        this.isSending = false;
        ClaxusUI.setSendButtonState(true, false);
    },

    handleCleared(data) {
        console.log('[Claxus] Conversation cleared');
        this.clearEvents();
        this.messageCount = 0;

        ClaxusUI.clearMessages();
        ClaxusUI.addSystemMessage('Conversation cleared');
    },

    handleInterrupted(data) {
        console.log('[Claxus] Message interrupted');
        ClaxusUI.clearSpinners();

        if (this.currentStreamingBubble) {
            ClaxusUI.updateStreamingMessage(this.currentStreamingBubble, this.fullResponse, true);
            this.currentStreamingBubble = null;
        }

        const interruptedIndicator = ClaxusUI.createInterruptedIndicator();
        ClaxusUI.addClaxusElement(interruptedIndicator);

        this.fullResponse = '';
        this.isSending = false;
        ClaxusUI.setSendButtonState(true, false);
    },

    handleContextStats(data) {
        const statsDisplay = ClaxusUI.createContextStatsDisplay(data.stats);
        ClaxusUI.addClaxusElement(statsDisplay);
    },

    handleScheduled(data) {
        ClaxusUI.addSystemMessage(`Task scheduled: ${data.description || 'Unknown task'}`);
    },

    handleNewConversation(data) {
        console.log('[Claxus] New conversation:', data.conversation_id);
        this.clearEvents();
        this.messageCount = 0;
        this.conversationId = data.conversation_id;
        Storage.saveSetting('claxusConversationId', this.conversationId);

        ClaxusUI.clearMessages();
        ClaxusUI.addSystemMessage('New conversation started');
    },

    handleConfirmationNeeded(data) {
        console.log('[Claxus] Confirmation needed:', data.confirmation_id);

        const confirmationDialog = ClaxusUI.createConfirmationDialog(data);
        ClaxusUI.addClaxusElement(confirmationDialog);
    },

    handleConfirmationResolved(data) {
        console.log('[Claxus] Confirmation resolved:', data.confirmation_id, data.approved);

        // Search within Claxus pane for the confirmation card
        const container = ClaxusUI.elements.chatMessages || document;
        const card = container.querySelector(`[data-confirmation-id="${data.confirmation_id}"]`);
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
    const shouldReconnect = Claxus.connectionState === 'DISCONNECTED' &&
        Claxus.conversationId &&
        (Claxus.active || Claxus.ws !== null);
    if (shouldReconnect) {
        Claxus.connect(Claxus.conversationId);
    }
});
