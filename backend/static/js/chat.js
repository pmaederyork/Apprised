/**
 * Chat management functionality
 * Handles chat creation, loading, deletion, messaging, and chat list rendering
 */
const Chat = {
    // Current chat state
    currentChatId: null,
    currentMessages: [],
    chats: {},
    isSending: false,
    hadDocumentEditingInstructions: false,

    /**
     * Check if multi-agent mode is active (more than one agent configured)
     */
    isMultiAgentMode() {
        if (typeof Agents !== 'undefined' && Agents.getFullAgentsList) {
            return Agents.getFullAgentsList().length > 1;
        }
        return false;
    },

    // Initialize chat system
    init() {
        // Prevent multiple initialization to avoid duplicate event listeners
        if (this.initialized) {
            console.warn('Chat module already initialized');
            return;
        }
        
        this.chats = Storage.getChats();
        this.bindEvents();
        this.renderChatList();
        
        if (Object.keys(this.chats).length === 0) {
            this.createNewChat();
        } else {
            const sortedChats = Object.values(this.chats).sort((a, b) => b.createdAt - a.createdAt);
            this.loadChat(sortedChats[0].id);
        }
        
        UI.focusMessageInput();
        
        // Initialize textarea auto-resize
        this.autoResizeTextarea();
        
        // Mark as initialized
        this.initialized = true;
    },

    // Bind event listeners
    bindEvents() {
        // Send message events
        UI.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        UI.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea as user types
        UI.elements.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Tab key to copy latest Claude message to document
        // Up arrow to copy last user message
        // Escape to clear input
        UI.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.copyLatestClaudeMessageToDocument();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.copyLastMessage();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                UI.elements.messageInput.value = '';
            }
        });

        // Global Ctrl+C listener for interrupting streaming
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'c' && this.isSending) {
                e.preventDefault();
                this.interruptMessage();
            }
        });

        // New chat button
        const newChatBtn = document.querySelector('.new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent collapsing the section
                // If in system prompt editor, save and exit first
                if (SystemPrompts.isEditing()) {
                    SystemPrompts.saveContent();
                    SystemPrompts.saveName();
                    SystemPrompts.exitEdit();
                }
                this.createNewChat();
            });
        }
        
        // Chat title saving
        UI.elements.chatTitle.addEventListener('input', () => this.saveChatTitle());
        UI.elements.chatTitle.addEventListener('blur', () => this.saveChatTitle());
        
        // Conversations collapse functionality
        UI.elements.conversationsHeader?.addEventListener('click', () => {
            this.toggleConversationsCollapse();
        });
    },

    // Create a new chat
    createNewChat() {
        this.currentChatId = Storage.generateChatId();
        this.currentMessages = [];
        this.hadDocumentEditingInstructions = false;
        this.chats[this.currentChatId] = {
            id: this.currentChatId,
            title: 'New Chat',
            messages: [],
            agents: [],
            turns: 1,
            createdAt: Date.now()
        };

        UI.elements.chatTitle.value = 'New Chat';
        this.clearMessages();
        this.addWelcomeMessage();
        Storage.saveChats(this.chats);
        this.renderChatList();

        // Update agent UI for new chat
        if (typeof Agents !== 'undefined') {
            Agents.updateAgentSelectorUI();
        }
    },

    // Load an existing chat
    loadChat(chatId) {
        if (this.chats[chatId]) {
            this.currentChatId = chatId;
            this.hadDocumentEditingInstructions = false;
            const chat = this.chats[chatId];
            UI.elements.chatTitle.value = chat.title;
            this.currentMessages = [...chat.messages];
            this.clearMessages();

            // Ensure agents and turns exist (backward compatibility)
            let needsSave = false;
            if (!chat.agents) {
                chat.agents = [];
                needsSave = true;
            }
            if (!chat.turns) {
                chat.turns = 1;
                needsSave = true;
            }

            // Persist backward compatibility initialization
            if (needsSave) {
                Storage.saveChats(this.chats);
            }

            // Load all messages
            chat.messages.forEach(msg => {
                // Extract agent info if present in message
                const agent = (msg.agentId && msg.agentName && msg.agentColor) ? {
                    id: msg.agentId,
                    name: msg.agentName,
                    color: msg.agentColor
                } : null;
                UI.addMessage(msg.content, msg.isUser, msg.files || [], agent);
            });

            // Update active chat in sidebar
            this.updateActiveChatInSidebar(chatId);

            // Update agent UI for loaded chat
            if (typeof Agents !== 'undefined') {
                Agents.updateAgentSelectorUI();
            }
        }
    },

    // Delete a chat
    deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat?')) {
            delete this.chats[chatId];
            Storage.saveChats(this.chats);
            
            // If we deleted the current chat, create a new one or load another
            if (this.currentChatId === chatId) {
                if (Object.keys(this.chats).length === 0) {
                    this.createNewChat();
                } else {
                    // Load the most recent remaining chat
                    const sortedChats = Object.values(this.chats).sort((a, b) => b.createdAt - a.createdAt);
                    this.loadChat(sortedChats[0].id);
                    this.renderChatList();
                }
            } else {
                // Just refresh the chat list
                this.renderChatList();
            }
        }
    },

    // Save chat title
    saveChatTitle() {
        if (this.currentChatId && this.chats[this.currentChatId]) {
            this.chats[this.currentChatId].title = UI.elements.chatTitle.value || 'New Chat';
            Storage.saveChats(this.chats);
            this.renderChatList();
        }
    },

    // Clear all messages from the UI
    clearMessages() {
        UI.clearMessages();
    },

    // Add welcome message
    addWelcomeMessage() {
        UI.addMessage("Hello! I'm Claude. Ask me anything and I'll do my best to help you.", false, false);
    },

    // Update active chat styling in sidebar
    updateActiveChatInSidebar(chatId) {
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    },

    // Render the chat list in the sidebar
    renderChatList() {
        if (!UI.elements.chatList) {
            console.warn('chatList element not found');
            return;
        }
        
        try {
            UI.elements.chatList.innerHTML = '';
            const sortedChats = Object.values(this.chats).sort((a, b) => b.createdAt - a.createdAt);
            
            sortedChats.forEach(chat => {
                const chatItem = Components.createListItem({
                    text: chat.title,
                    isActive: chat.id === this.currentChatId,
                    className: 'chat-item',
                    maxLength: 27,
                    onClick: () => {
                        // If in system prompt editor, save and exit first
                        if (SystemPrompts.isEditing()) {
                            SystemPrompts.saveContent();
                            SystemPrompts.saveName();
                            SystemPrompts.exitEdit();
                        }
                        this.loadChat(chat.id);
                    },
                    onNameEdit: (newName) => {
                        this.renameChat(chat.id, newName);
                    },
                    actions: [
                        {
                            icon: '✕',
                            title: 'Delete chat',
                            onClick: () => this.deleteChat(chat.id)
                        }
                    ]
                });
                
                chatItem.setAttribute('data-chat-id', chat.id);
                UI.elements.chatList.appendChild(chatItem);
            });
        } catch (error) {
            console.error('Failed to render chat list:', error);
        }
    },

    // Send a message
    async sendMessage() {
        // Prevent duplicate sends
        if (this.isSending) return;
        
        const message = UI.elements.messageInput.value.trim();
        if (!message) return;

        // Set sending flag
        this.isSending = true;

        // Ensure we have a current chat
        if (!this.currentChatId) {
            this.createNewChat();
        }

        // Get pre-captured screenshot if screenshare is enabled
        let screenshotData = null;
        let displayText = message;
        if (Tools.screenshareEnabled) {
            displayText += '\n\n📸 Screenshot attached';
            screenshotData = ScreenShare.getCurrentScreenshot();
        }

        // Get selected files and clear immediately
        const filesData = await Files.prepareFilesForAPI();
        Files.clearSelectedFiles();

        // Add user message to UI with screenshot indicator (if captured)
        UI.addMessage(displayText, true, filesData);
        UI.clearMessageInput();
        UI.setSendButtonState(false);
        UI.hideLoading();

        // Get system prompt if active
        const systemPrompts = Storage.getSystemPrompts();
        const activeSystemPromptId = Storage.getActiveSystemPromptId();
        let systemPrompt = activeSystemPromptId && systemPrompts[activeSystemPromptId] ?
            systemPrompts[activeSystemPromptId].content : null;

        // Check if we're in multi-agent mode (has added agents)
        const chats = Storage.getChats();
        const currentChat = chats[this.currentChatId];
        const hasAddedAgents = currentChat && currentChat.agents && currentChat.agents.length > 0;

        // In multi-agent mode, Moderator intercepts FIRST (before any agent responds)
        if (hasAddedAgents && typeof Moderator !== 'undefined') {
            console.log('[Chat] Multi-agent mode - Moderator intercepts');
            // Save user message to history
            this.saveMessageToHistory(message, true, filesData);

            try {
                await Moderator.intercept(message, filesData, screenshotData);
            } finally {
                this.isSending = false;
                UI.setSendButtonState(true);
                UI.focusMessageInput();
            }
            return; // Moderator handles everything
        }

        // Single-agent mode: normal flow
        const streamingBubble = UI.addStreamingMessage(false, null);
        let fullResponse = '';

        try {

            // Append document editing instructions if document is open
            if (Documents && Documents.currentDocumentId) {
                this.hadDocumentEditingInstructions = true;

                // Use shared full document editing instructions
                const documentEditingInstructions = DocumentEditingInstructions.getFull(this.isMultiAgentMode());
                systemPrompt = systemPrompt ? systemPrompt + documentEditingInstructions : documentEditingInstructions;
            } else if (this.hadDocumentEditingInstructions) {
                // Document was open earlier but is now closed
                const documentClosedNotice = DocumentEditingInstructions.getClosedNotice();
                systemPrompt = systemPrompt ? systemPrompt + documentClosedNotice : documentClosedNotice;
            }

            // Send message to API (include screenshot data but don't store it)
            const response = await API.sendMessage(message, this.currentMessages, systemPrompt, filesData, screenshotData);

            // Process streaming response
            for await (const data of API.streamResponse(response)) {
                if (data.error) {
                    throw new Error(data.error);
                }

                if (data.chunk) {
                    fullResponse += data.chunk;
                    // Filter out XML blocks during streaming for cleaner display
                    // The fullResponse still contains everything for parsing
                    UI.updateStreamingMessage(streamingBubble, fullResponse);
                }

                if (data.done) {
                    // Complete the streaming message and save both messages to history
                    UI.updateStreamingMessage(streamingBubble, fullResponse, true);
                    // Save only the original text message, not the screenshot data
                    this.saveMessageToHistory(message, true, filesData);
                    this.saveMessageToHistory(fullResponse, false, []);

                    // Single-agent mode: parse <document_edit> XML and apply directly
                    if (Documents && Documents.currentDocumentId) {
                        console.log(`[Chat] Single-agent mode - parsing response for document edits...`);
                        const changes = Documents.parseClaudeEditResponse(fullResponse);
                        if (changes && changes.length > 0) {
                            console.log(`[Chat] Detected ${changes.length} document edits from Claude`);
                            Documents.applyClaudeEdits(changes);
                            this.addSystemMessage(`Claude proposed ${changes.length} change${changes.length !== 1 ? 's' : ''} to your document. Review them in the editor.`);
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                UI.updateStreamingMessage(streamingBubble, 'Message interrupted by user', true);
            } else {
                UI.updateStreamingMessage(streamingBubble, `Error: ${error.message}`, true);
            }
            // Save user message to history even if API call failed (only original text)
            this.saveMessageToHistory(message, true, filesData);
        } finally {
            this.isSending = false;
            UI.setSendButtonState(true);
            UI.focusMessageInput();
        }
    },

    // Save message to chat history
    saveMessageToHistory(content, isUser, files = [], agent = null, turnNumber = null) {
        if (this.currentChatId) {
            const messageObj = {
                content,
                isUser,
                timestamp: Date.now(),
                files: files.length > 0 ? files : undefined
            };

            // Add agent info if provided
            if (agent && !isUser) {
                messageObj.agentId = agent.id;
                messageObj.agentName = agent.name;
                messageObj.agentColor = agent.color;
            }

            // Add turn number if provided
            if (turnNumber !== null) {
                messageObj.turnNumber = turnNumber;
            }

            this.currentMessages.push(messageObj);

            // ✅ FIX: Refresh from Storage to get latest agents/turns before saving
            // This prevents overwriting agents added by the Agents module
            this.chats = Storage.getChats();
            this.chats[this.currentChatId].messages = [...this.currentMessages];
            Storage.saveChats(this.chats);
        }
    },

    // Get current chat data
    getCurrentChat() {
        return this.currentChatId ? this.chats[this.currentChatId] : null;
    },

    // Get current messages
    getCurrentMessages() {
        return [...this.currentMessages];
    },

    // Interrupt current message streaming
    interruptMessage() {
        if (this.isSending) {
            API.interrupt();
        }
    },

    // Copy last user message to input
    copyLastMessage() {
        // Find last user message
        for (let i = this.currentMessages.length - 1; i >= 0; i--) {
            if (this.currentMessages[i].isUser) {
                UI.elements.messageInput.value = this.currentMessages[i].content;
                break;
            }
        }
    },

    // Copy latest Claude message to document
    copyLatestClaudeMessageToDocument() {
        // Check if document is open
        if (typeof Documents === 'undefined' || !Documents.currentDocumentId) {
            return;
        }

        // Find the latest Claude message bubble directly
        const claudeMessages = document.querySelectorAll('.message.claude .message-bubble');
        if (claudeMessages.length === 0) {
            return;
        }

        // Get the last Claude message bubble and copy with Tab-specific behavior
        const lastClaudeBubble = claudeMessages[claudeMessages.length - 1];
        UI.copyMessageToDocument(lastClaudeBubble, true); // true = isTabTriggered
    },


    // Rename chat
    renameChat(chatId, newTitle) {
        if (this.chats[chatId]) {
            this.chats[chatId].title = newTitle;
            Storage.saveChats(this.chats);
            this.renderChatList();
            
            // Update title input if this is the current chat
            if (chatId === this.currentChatId) {
                UI.elements.chatTitle.value = newTitle;
            }
        }
    },
    
    // Toggle collapse state of conversations section
    toggleConversationsCollapse() {
        const list = UI.elements.conversationsList;
        const icon = UI.elements.conversationsCollapse;
        
        if (!list || !icon) return;
        
        if (list.classList.contains('collapsed')) {
            list.classList.remove('collapsed');
            icon.classList.remove('collapsed');
        } else {
            list.classList.add('collapsed');
            icon.classList.add('collapsed');
        }
    },

    // Auto-resize textarea based on content
    autoResizeTextarea() {
        const textarea = UI.elements.messageInput;
        if (!textarea) return;

        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';

        // Set height based on scroll height, constrained by min/max
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 20), 160);
        textarea.style.height = newHeight + 'px';
    },

    // Add system notification message to chat
    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.style.cssText = `
            text-align: center;
            font-size: 13px;
            padding: 8px 16px;
            margin: 8px 0;
            border-radius: 6px;
            font-style: italic;
        `;
        messageDiv.textContent = message;

        UI.elements.chatMessages.appendChild(messageDiv);
        UI.autoScroll();
    }
};