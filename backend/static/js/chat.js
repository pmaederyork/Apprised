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
                UI.addMessage(msg.content, msg.isUser, msg.files || []); // Include files when loading
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

        // In multi-agent mode, show agent badge for initial response (Agent 1)
        let agent1 = null;
        if (hasAddedAgents && activeSystemPromptId && systemPrompts[activeSystemPromptId]) {
            agent1 = {
                id: 'agent_active_prompt',
                name: systemPrompts[activeSystemPromptId].name || 'Assistant',
                systemPromptId: activeSystemPromptId,
                color: '#ea580c'  // Orange - Agent 1 color
            };
        }

        // Create streaming message bubble with agent badge if in multi-agent mode
        const streamingBubble = UI.addStreamingMessage(false, agent1);
        let fullResponse = '';

        try {

            // Append document editing instructions if document is open
            if (Documents && Documents.currentDocumentId) {
                const documentEditingInstructions = `

DOCUMENT EDITING CAPABILITY:
The user has a document open in the editor and its HTML content is provided to you as a file attachment. You can interpret natural language editing requests and propose structured edits.

STEP 1: INTERPRET NATURAL LANGUAGE REFERENCES
When the user says:
- "the title" or "the heading" → Look for the first <h1> element
- "the introduction" → Find the first paragraph or section with "introduction" in heading/content
- "section about X" → Find heading containing "X" and the content that follows
- "paragraph 3" or "the third paragraph" → Count <p> elements to find the specified one
- "move X to the top" → Delete X from current location, add it before the first element
- "move X to the end" or "move X to the bottom" → Delete X, add it after the last element
- "move X after Y" → Delete X, add it with insertAfter="<Y's exact HTML>"
- "delete this section" (referring to recent context) → Find the section they mentioned
- "change X to Y" → Modify the element containing X

STEP 2: EXAMINE THE DOCUMENT
The document HTML is provided as a file attachment. Carefully examine it to:
1. Find the EXACT HTML of elements you need to reference
2. Copy the HTML character-for-character (including all attributes, whitespace, capitalization)
3. For insertAfter/insertBefore, copy the complete opening and closing tags
4. Use distinctive, easily-found elements as anchors (headings work best)

STEP 3: GENERATE PRECISE XML
Use this format for all edits:

<document_edit>
<change type="delete">
<original>[exact HTML to delete]</original>
</change>

<change type="add" insertAfter="[exact HTML of existing element]">
<new>[HTML content to add]</new>
</change>

<change type="add" insertBefore="[exact HTML of existing element]">
<new>[HTML content to add]</new>
</change>

<change type="modify">
<original>[exact original HTML]</original>
<new>[replacement HTML]</new>
</change>
</document_edit>

CRITICAL RULES FOR insertBefore/insertAfter:
- ALWAYS copy the COMPLETE HTML element (opening tag + content + closing tag) from the document
- NEVER use text fragments like "sentence" - use the FULL element like "<p>This is a sentence.</p>"
- When user says "before/after [text]", find the element CONTAINING that text, then copy that ENTIRE element's HTML
- Example: User says "add before 'introduction'" → Find <p>This is the introduction.</p> → Use that full HTML as anchor

OTHER CRITICAL RULES:
- Quote HTML EXACTLY as it appears in the document (copy-paste from what you see)
- Include all attributes, even if they seem redundant: <h1 class="title">Title</h1>
- Use HTML formatting (not markdown) since this is a rich text editor
- For move operations, use TWO changes: one delete, one add
- BATCH OPERATIONS: For bulk actions like "delete all text", use ONE change containing all content, not multiple separate changes
- CONSOLIDATE CHANGES: Combine related edits when possible (e.g., deleting adjacent paragraphs = one delete with all paragraphs)
- Keep your message BRIEF - just say what you're doing in one short sentence using FUTURE TENSE ("I'll..."), then provide the XML
- ALWAYS use future tense: "I'll remove..." NOT "I've removed..." or "Removing..."
- DO NOT repeat or describe the content being changed - the user can see it in the review panel
- DO NOT use emojis

EXAMPLES:

Example 1 - Natural language: "Change the title to 'New Project Name'"
Step 1: "the title" = first <h1>
Step 2: Look at document, find: <h1>My Project</h1>
Step 3: Generate modify change

"I'll update the title:

<document_edit>
<change type="modify">
<original><h1>My Project</h1></original>
<new><h1>New Project Name</h1></new>
</change>
</document_edit>"

Example 2 - Natural language: "Move the introduction paragraph to the top"
Step 1: Find paragraph with "introduction" content
Step 2: Look at document, find: <p>This is an introduction to my project.</p> and first element: <h1>My Project</h1>
Step 3: Generate delete + add before first element

"I'll move the introduction to the top:

<document_edit>
<change type="delete">
<original><p>This is an introduction to my project.</p></original>
</change>

<change type="add" insertBefore="<h1>My Project</h1>">
<new><p>This is an introduction to my project.</p></new>
</change>
</document_edit>"

Example 2b - Natural language: "Add a paragraph before 'This is the introduction'" (TEXT-BASED POSITIONING)
Step 1: User wants to add before text containing "This is the introduction"
Step 2: Look at document, find the COMPLETE element containing that text: <p>This is the introduction to my project.</p>
Step 3: Generate add change with insertBefore using THE COMPLETE ELEMENT (not just the text fragment)

"I'll add a paragraph:

<document_edit>
<change type="add" insertBefore="<p>This is the introduction to my project.</p>">
<new><p>New content before the introduction.</p></new>
</change>
</document_edit>"

Example 3 - Natural language: "Delete the section about API keys"
Step 1: Find heading containing "API keys"
Step 2: Look at document, find heading and its content
Step 3: Generate delete changes for heading and related paragraphs

"I'll remove the API keys section:

<document_edit>
<change type="delete">
<original><h2>API Keys</h2></original>
</change>

<change type="delete">
<original><p>Your API key is stored securely in the browser.</p></original>
</change>
</document_edit>"

Example 4 - Natural language: "Add a new section about usage after the introduction"
Step 1: Find introduction heading
Step 2: Look at document, find: <h2>Introduction</h2>
Step 3: Generate add change

"I'll add a usage section:

<document_edit>
<change type="add" insertAfter="<h2>Introduction</h2>">
<new><h2>Usage</h2><p>To use this application, follow these steps:</p></new>
</change>
</document_edit>"

Example 5 - Natural language: "Delete all the text" (BATCH OPERATION)
Step 1: User wants to delete ALL content
Step 2: Look at document, get ALL HTML content from first to last element
Step 3: Generate ONE delete change with all content

"I'll remove all content:

<document_edit>
<change type="delete">
<original><h1>My Project</h1><p>This is an introduction.</p><h2>Section 1</h2><p>More content here.</p></original>
</change>
</document_edit>"

The user will review each change with visual highlighting (deletions in red, additions in green, modifications in yellow) and can accept or reject individual changes using keyboard shortcuts or buttons.`;

                systemPrompt = systemPrompt ? systemPrompt + documentEditingInstructions : documentEditingInstructions;
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
                    this.saveMessageToHistory(fullResponse, false);

                    // Check if response contains document edits (only if document is open)
                    if (Documents && Documents.currentDocumentId) {
                        const changes = Documents.parseClaudeEditResponse(fullResponse);
                        if (changes && changes.length > 0) {
                            // Claude proposed document edits
                            console.log(`Detected ${changes.length} document edits from Claude`);
                            Documents.applyClaudeEdits(changes);

                            // Show notification in chat
                            this.addSystemMessage(`Claude proposed ${changes.length} change${changes.length !== 1 ? 's' : ''} to your document. Review them in the editor.`);
                        }
                    }

                    // After initial response, check if multi-agent conversation should start
                    if (typeof Agents !== 'undefined') {
                        await Agents.orchestrateAgentTurns(message);
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
            color: #78716c;
            padding: 8px 16px;
            margin: 8px 0;
            background: #fafaf9;
            border-radius: 6px;
            font-style: italic;
        `;
        messageDiv.textContent = message;

        UI.elements.chatMessages.appendChild(messageDiv);
        UI.autoScroll();
    }
};