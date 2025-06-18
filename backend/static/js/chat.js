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
        
        // Mark as initialized
        this.initialized = true;
    },

    // Bind event listeners
    bindEvents() {
        // Send message events
        UI.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        UI.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // New chat button
        const newChatBtn = document.querySelector('.new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
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
    },

    // Create a new chat
    createNewChat() {
        this.currentChatId = Storage.generateChatId();
        this.currentMessages = [];
        this.chats[this.currentChatId] = {
            id: this.currentChatId,
            title: 'New Chat',
            messages: [],
            createdAt: Date.now()
        };
        
        UI.elements.chatTitle.value = 'New Chat';
        this.clearMessages();
        this.addWelcomeMessage();
        Storage.saveChats(this.chats);
        this.renderChatList();
    },

    // Load an existing chat
    loadChat(chatId) {
        if (this.chats[chatId]) {
            this.currentChatId = chatId;
            const chat = this.chats[chatId];
            UI.elements.chatTitle.value = chat.title;
            this.currentMessages = [...chat.messages];
            this.clearMessages();
            
            // Load all messages
            chat.messages.forEach(msg => {
                UI.addMessage(msg.content, msg.isUser, msg.files || []); // Include files when loading
            });
            
            // Update active chat in sidebar
            this.updateActiveChatInSidebar(chatId);
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

        // Get selected files and clear immediately
        const filesData = await Files.prepareFilesForAPI();
        Files.clearSelectedFiles();

        // Add user message to UI and clear input
        UI.addMessage(message, true, filesData);
        UI.clearMessageInput();
        UI.setSendButtonState(false);
        UI.hideLoading();

        // Create streaming message bubble
        const streamingBubble = UI.addStreamingMessage(false);
        let fullResponse = '';

        try {
            // Get system prompt if active
            const systemPrompts = Storage.getSystemPrompts();
            const activeSystemPromptId = Storage.getActiveSystemPromptId();
            const systemPrompt = activeSystemPromptId && systemPrompts[activeSystemPromptId] ? 
                systemPrompts[activeSystemPromptId].content : null;
            
            // Send message to API
            const response = await API.sendMessage(message, this.currentMessages, systemPrompt, filesData);

            // Process streaming response
            for await (const data of API.streamResponse(response)) {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                if (data.chunk) {
                    fullResponse += data.chunk;
                    UI.updateStreamingMessage(streamingBubble, fullResponse);
                }
                
                if (data.done) {
                    // Complete the streaming message and save both messages to history
                    UI.updateStreamingMessage(streamingBubble, fullResponse, true);
                    this.saveMessageToHistory(message, true, filesData);
                    this.saveMessageToHistory(fullResponse, false);
                }
            }
        } catch (error) {
            UI.updateStreamingMessage(streamingBubble, `Error: ${error.message}`, true);
            // Save user message to history even if API call failed
            this.saveMessageToHistory(message, true, filesData);
        } finally {
            this.isSending = false;
            UI.setSendButtonState(true);
            UI.focusMessageInput();
        }
    },

    // Save message to chat history
    saveMessageToHistory(content, isUser, files = []) {
        if (this.currentChatId) {
            const messageObj = { 
                content, 
                isUser, 
                timestamp: Date.now(),
                files: files.length > 0 ? files : undefined
            };
            this.currentMessages.push(messageObj);
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

    // Export chat data (for backup/sharing)
    exportChat(chatId = null) {
        const targetChatId = chatId || this.currentChatId;
        if (targetChatId && this.chats[targetChatId]) {
            return JSON.stringify(this.chats[targetChatId], null, 2);
        }
        return null;
    },

    // Import chat data
    importChat(chatData) {
        try {
            const chat = JSON.parse(chatData);
            if (chat.id && chat.title && Array.isArray(chat.messages)) {
                // Generate new ID to avoid conflicts
                const newId = Storage.generateChatId();
                chat.id = newId;
                chat.title = `${chat.title} (imported)`;
                chat.createdAt = Date.now();
                
                this.chats[newId] = chat;
                Storage.saveChats(this.chats);
                this.renderChatList();
                return newId;
            }
        } catch (error) {
            console.error('Failed to import chat:', error);
        }
        return null;
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

    // Get chat statistics
    getStats() {
        const totalChats = Object.keys(this.chats).length;
        const totalMessages = Object.values(this.chats).reduce((sum, chat) => sum + chat.messages.length, 0);
        const oldestChat = Object.values(this.chats).reduce((oldest, chat) => 
            !oldest || chat.createdAt < oldest.createdAt ? chat : oldest, null);
        
        return {
            totalChats,
            totalMessages,
            oldestChatDate: oldestChat ? new Date(oldestChat.createdAt) : null,
            currentChatId: this.currentChatId
        };
    }
};