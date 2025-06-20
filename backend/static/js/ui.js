/**
 * UI utilities and helpers
 */
const UI = {
    // Scroll state tracking
    isUserScrolledUp: false,
    scrollThreshold: 100, // pixels from bottom to consider "at bottom"
    
    // DOM element references
    elements: {
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        chatMessages: document.getElementById('chatMessages'),
        loading: document.getElementById('loading'),
        chatTitle: document.getElementById('chatTitle'),
        chatList: document.getElementById('chatList'),
        newChatBtn: document.getElementById('newChatBtn'),
        systemPromptList: document.getElementById('systemPromptList'),
        addPromptBtn: document.getElementById('addPromptBtn'),
        systemPromptHeader: document.getElementById('systemPromptHeader'),
        systemPromptCollapse: document.getElementById('systemPromptCollapse'),
        conversationsHeader: document.getElementById('conversationsHeader'),
        conversationsCollapse: document.getElementById('conversationsCollapse'),
        conversationsList: document.getElementById('chatList'),
        chatContainer: document.getElementById('chatContainer'),
        systemPromptEditor: document.getElementById('systemPromptEditor'),
        editorTitle: document.getElementById('editorTitle'),
        systemPromptTextarea: document.getElementById('systemPromptTextarea'),
        exitEditorBtn: document.getElementById('exitEditorBtn'),
        quitBtn: document.getElementById('quitBtn'),
        sidebar: document.getElementById('sidebar'),
        sidebarResizeHandle: document.getElementById('sidebarResizeHandle')
    },

    // Message utilities
    addMessage(content, isUser = false, files = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'claude'}`;
        
        // Add file attachments if present
        if (files && files.length > 0) {
            const filesDiv = document.createElement('div');
            filesDiv.className = 'message-files';
            
            files.forEach(file => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'message-file';
                
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = file.data;
                    img.alt = file.name;
                    img.className = 'message-file-image';
                    fileDiv.appendChild(img);
                } else {
                    const icon = document.createElement('span');
                    icon.className = 'message-file-icon';
                    icon.textContent = '📎';
                    
                    const name = document.createElement('span');
                    name.className = 'message-file-name';
                    name.textContent = file.name;
                    
                    fileDiv.appendChild(icon);
                    fileDiv.appendChild(name);
                }
                
                filesDiv.appendChild(fileDiv);
            });
            
            messageDiv.appendChild(filesDiv);
        }
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        // For Claude messages, support basic HTML formatting
        if (!isUser && (content.includes('<') || content.includes('\n'))) {
            // Convert markdown-like formatting to HTML
            let formattedContent = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                .replace(/\n/g, '<br>');
            bubbleDiv.innerHTML = formattedContent;
        } else {
            bubbleDiv.textContent = content;
        }
        
        messageDiv.appendChild(bubbleDiv);
        this.elements.chatMessages.appendChild(messageDiv);
        this.autoScroll();

        return bubbleDiv; // Return bubble for streaming updates
    },

    addStreamingMessage(isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'claude'}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble streaming-cursor';
        bubbleDiv.textContent = '';
        
        messageDiv.appendChild(bubbleDiv);
        this.elements.chatMessages.appendChild(messageDiv);
        this.autoScroll();

        return bubbleDiv;
    },

    updateStreamingMessage(bubbleDiv, content, isComplete = false) {
        // For Claude messages, support basic HTML formatting
        if (content.includes('<') || content.includes('\n')) {
            // Convert markdown-like formatting to HTML
            let formattedContent = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                .replace(/\n/g, '<br>');
            bubbleDiv.innerHTML = formattedContent;
        } else {
            bubbleDiv.textContent = content;
        }

        // Remove cursor when complete
        if (isComplete) {
            bubbleDiv.classList.remove('streaming-cursor');
        }
        
        this.autoScroll();
    },

    clearMessages() {
        this.elements.chatMessages.innerHTML = '';
    },

    autoScroll() {
        // Only auto-scroll if user hasn't manually scrolled up
        if (!this.isUserScrolledUp) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    },

    // Loading states
    showLoading() {
        this.elements.loading.classList.add('show');
        this.autoScroll();
    },

    hideLoading() {
        this.elements.loading.classList.remove('show');
    },

    // Initialize scroll detection for smart autoscroll
    initScrollDetection() {
        this.elements.chatMessages.addEventListener('scroll', () => {
            const container = this.elements.chatMessages;
            const scrollDistance = container.scrollHeight - container.scrollTop - container.clientHeight;
            
            // User is considered "scrolled up" if they're more than threshold pixels from bottom
            this.isUserScrolledUp = scrollDistance > this.scrollThreshold;
        });
    },

    // Reset scroll state (for manual scroll to bottom)
    resetScrollState() {
        this.isUserScrolledUp = false;
        this.autoScroll();
    },

    // UI state management
    setSendButtonState(enabled) {
        this.elements.sendBtn.disabled = !enabled;
    },

    focusMessageInput() {
        if (this.elements.messageInput) {
            this.elements.messageInput.focus();
        }
    },

    clearMessageInput() {
        this.elements.messageInput.value = '';
    },

    // Initialize sidebar resizing
    initSidebarResize() {
        if (!this.elements.sidebar || !this.elements.sidebarResizeHandle) {
            return;
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const handle = this.elements.sidebarResizeHandle;
        const sidebar = this.elements.sidebar;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
            handle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const width = startWidth + e.clientX - startX;
            const minWidth = 200;
            const maxWidth = 500;
            
            if (width >= minWidth && width <= maxWidth) {
                sidebar.style.width = width + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                handle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
};