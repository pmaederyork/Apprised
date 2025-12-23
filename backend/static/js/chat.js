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

═══════════════════════════════════════════════════════════════════════════
MODULAR COMMAND SYSTEM
═══════════════════════════════════════════════════════════════════════════

Every user request has THREE components that you must identify and combine:

1️⃣ COMMAND: What action to perform (Add, Move, Delete, Modify)
2️⃣ TARGET: What content to act upon (specific element, range, all matching)
3️⃣ LOCATION: Where to perform the action (at top, at end, before X, after X, between X and Y)

═══════════════════════════════════════════════════════════════════════════
LAYER 1: COMMANDS (What action)
═══════════════════════════════════════════════════════════════════════════

🔵 ADD - Insert new content
   XML: <change type="add" insertBefore="..." OR insertAfter="...">
        <new>[new HTML]</new>
        </change>

🔵 MOVE - Relocate existing content
   XML: TWO changes required:
        1. <change type="delete"><original>[exact HTML]</original></change>
        2. <change type="add" insertBefore="..." OR insertAfter="..."><new>[same HTML]</new></change>

🔵 DELETE - Remove content
   XML: <change type="delete">
        <original>[exact HTML to remove]</original>
        </change>

🔵 MODIFY - Change existing content
   XML: <change type="modify">
        <original>[exact original HTML]</original>
        <new>[replacement HTML]</new>
        </change>

═══════════════════════════════════════════════════════════════════════════
LAYER 2: TARGET SELECTORS (What content)
═══════════════════════════════════════════════════════════════════════════

📍 SPECIFIC ELEMENT
   "the header", "the title", "the introduction section"
   → Find the element by content or description
   → Use its complete HTML: <h1>Title</h1>

📍 RANGE (between X and Y)
   "everything between X and Y", "content between intro and conclusion"
   → Find first element (X) and last element (Y)
   → Include ALL elements from X to Y (inclusive)
   → Generate one DELETE change per element in the range

📍 RELATIVE RANGE (after/before X)
   "everything after X", "all content before Y", "everything below the header"
   → Find anchor element (X or Y)
   → Include all sibling elements in specified direction
   → Generate one DELETE change per element

📍 PATTERN MATCHING
   "all headers", "all paragraphs", "every section with [criteria]"
   → Find all elements matching the pattern
   → Generate one change per matching element

═══════════════════════════════════════════════════════════════════════════
LAYER 3: LOCATION ANCHORS (Where)
═══════════════════════════════════════════════════════════════════════════

📌 "at the top" / "at the beginning"
   → Find the FIRST element in the document
   → Use: insertBefore="<first element HTML>"
   Example: insertBefore="<h1>Document Title</h1>"

📌 "at the end" / "at the bottom"
   → Find the LAST element in the document
   → Use: insertAfter="<last element HTML>"
   Example: insertAfter="<p>Final paragraph.</p>"

📌 "before [X]"
   → Find element X by content or description
   → Use: insertBefore="<X's complete HTML>"
   Example: insertBefore="<h2>Conclusion</h2>"

📌 "after [X]"
   → Find element X by content or description
   → Use: insertAfter="<X's complete HTML>"
   Example: insertAfter="<p>Introduction paragraph.</p>"

📌 "between [X] and [Y]"
   → Find element X
   → Use: insertAfter="<X's complete HTML>"
   (Content inserted after X is automatically "between" X and Y)

═══════════════════════════════════════════════════════════════════════════
STEP-BY-STEP INTERPRETATION PROCESS
═══════════════════════════════════════════════════════════════════════════

For EVERY user request, follow these steps:

STEP 1: DECOMPOSE the user's request
   - Identify the COMMAND (add/move/delete/modify)
   - Identify the TARGET (what content)
   - Identify the LOCATION (where, if applicable)

STEP 2: EXAMINE THE DOCUMENT
   The document HTML is provided as a file attachment. Find:
   - The EXACT HTML of target elements
   - The EXACT HTML of anchor elements for location
   - Copy HTML character-for-character (attributes, whitespace, capitalization)
   - Use distinctive elements as anchors (headings work best)

STEP 3: GENERATE PRECISE XML FORMAT
   Use this structure:

   <document_edit>
   <change type="[add|move|delete|modify]" [insertBefore="..." OR insertAfter="..."]>
   <original>[for delete/modify]</original>
   <new>[for add/modify]</new>
   </change>
   </document_edit>

═══════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════

✅ ALWAYS copy COMPLETE HTML elements (opening tag + content + closing tag)
✅ NEVER use text fragments - use FULL elements like "<p>This is a sentence.</p>"
✅ Quote HTML EXACTLY as it appears (attributes, whitespace, capitalization)
✅ Use HTML formatting (not markdown) - this is a rich text editor
✅ For MOVE operations: Generate TWO changes (delete + add)
✅ For RANGE operations: Generate ONE change per element in the range
✅ Keep response BRIEF: One sentence in FUTURE tense ("I'll...") + XML
✅ DO NOT repeat/describe content - user sees it in review panel
✅ DO NOT use emojis

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: SIMPLE OPERATIONS (Command + Single Target)
═══════════════════════════════════════════════════════════════════════════

Example 1: MODIFY Command
User: "Change the title to 'New Project Name'"
Decompose: MODIFY + TARGET("the title")
Document has: <h1>My Project</h1>

Response: "I'll update the title:

<document_edit>
<change type="modify">
<original><h1>My Project</h1></original>
<new><h1>New Project Name</h1></new>
</change>
</document_edit>"

Example 2: DELETE Command (simple)
User: "Delete the header"
Decompose: DELETE + TARGET("the header")
Document has: <h1>Emma</h1>

Response: "I'll remove the header:

<document_edit>
<change type="delete">
<original><h1>Emma</h1></original>
</change>
</document_edit>"

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: LOCATION-BASED OPERATIONS (Command + Location)
═══════════════════════════════════════════════════════════════════════════

Example 3: ADD at the TOP
User: "Add 'Project Overview' as a header at the top"
Decompose: ADD + LOCATION("at the top")
Document first element: <h1>My Project</h1>

Response: "I'll add a header at the top:

<document_edit>
<change type="add" insertBefore="<h1>My Project</h1>">
<new><h1>Project Overview</h1></new>
</change>
</document_edit>"

Example 4: ADD at the END
User: "Add a footer at the bottom"
Decompose: ADD + LOCATION("at the bottom")
Document last element: <p>Final paragraph.</p>

Response: "I'll add a footer at the end:

<document_edit>
<change type="add" insertAfter="<p>Final paragraph.</p>">
<new><p><em>Document footer</em></p></new>
</change>
</document_edit>"

Example 5: ADD BEFORE specific element
User: "Add a paragraph before the conclusion"
Decompose: ADD + LOCATION("before [conclusion]")
Document has: <h2>Conclusion</h2>

Response: "I'll add a paragraph:

<document_edit>
<change type="add" insertBefore="<h2>Conclusion</h2>">
<new><p>Summary before conclusion.</p></new>
</change>
</document_edit>"

Example 6: ADD AFTER specific element
User: "Add a section after the introduction"
Decompose: ADD + LOCATION("after [introduction]")
Document has: <h2>Introduction</h2>

Response: "I'll add a section:

<document_edit>
<change type="add" insertAfter="<h2>Introduction</h2>">
<new><h2>Background</h2><p>Additional context here.</p></new>
</change>
</document_edit>"

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: MOVE OPERATIONS (Command + Target + Location)
═══════════════════════════════════════════════════════════════════════════

Example 7: MOVE to TOP
User: "Move the conclusion to the top"
Decompose: MOVE + TARGET("conclusion") + LOCATION("to the top")
Document has: <h2>Conclusion</h2><p>Final thoughts.</p> and first element: <h1>Title</h1>

Response: "I'll move the conclusion to the top:

<document_edit>
<change type="delete">
<original><h2>Conclusion</h2></original>
</change>

<change type="delete">
<original><p>Final thoughts.</p></original>
</change>

<change type="add" insertBefore="<h1>Title</h1>">
<new><h2>Conclusion</h2><p>Final thoughts.</p></new>
</change>
</document_edit>"

Example 8: MOVE to END
User: "Move section X to the bottom"
Decompose: MOVE + TARGET("section X") + LOCATION("to the bottom")
Document has: <h2>Section X</h2> and last element: <p>Last paragraph.</p>

Response: "I'll move section X to the end:

<document_edit>
<change type="delete">
<original><h2>Section X</h2></original>
</change>

<change type="add" insertAfter="<p>Last paragraph.</p>">
<new><h2>Section X</h2></new>
</change>
</document_edit>"

Example 9: MOVE AFTER another element
User: "Move paragraph X after the introduction"
Decompose: MOVE + TARGET("paragraph X") + LOCATION("after [introduction]")
Document has: <p>Paragraph X content.</p> and <h2>Introduction</h2>

Response: "I'll move the paragraph:

<document_edit>
<change type="delete">
<original><p>Paragraph X content.</p></original>
</change>

<change type="add" insertAfter="<h2>Introduction</h2>">
<new><p>Paragraph X content.</p></new>
</change>
</document_edit>"

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: RANGE OPERATIONS (Command + Range Target)
═══════════════════════════════════════════════════════════════════════════

Example 10: DELETE BETWEEN X and Y
User: "Delete everything between the intro and conclusion"
Decompose: DELETE + TARGET(RANGE "between intro and conclusion")
Document has: <h2>Introduction</h2><p>Para 1</p><p>Para 2</p><h2>Conclusion</h2>

Response: "I'll remove content between intro and conclusion:

<document_edit>
<change type="delete">
<original><p>Para 1</p></original>
</change>

<change type="delete">
<original><p>Para 2</p></original>
</change>
</document_edit>"

Example 11: DELETE EVERYTHING AFTER X
User: "Delete everything after the summary"
Decompose: DELETE + TARGET(RELATIVE RANGE "after summary")
Document has: <h2>Summary</h2><p>Para 1</p><p>Para 2</p>

Response: "I'll remove all content after the summary:

<document_edit>
<change type="delete">
<original><p>Para 1</p></original>
</change>

<change type="delete">
<original><p>Para 2</p></original>
</change>
</document_edit>"

Example 12: DELETE EVERYTHING BEFORE X
User: "Delete everything before the main content"
Decompose: DELETE + TARGET(RELATIVE RANGE "before main content")
Document has: <p>Intro text</p><p>More intro</p><h2>Main Content</h2>

Response: "I'll remove content before main content:

<document_edit>
<change type="delete">
<original><p>Intro text</p></original>
</change>

<change type="delete">
<original><p>More intro</p></original>
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
                    this.saveMessageToHistory(fullResponse, false, [], agent1);

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