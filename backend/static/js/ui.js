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
        documentsHeader: document.getElementById('documentsHeader'),
        documentsCollapse: document.getElementById('documentsCollapse'),
        documentsList: document.getElementById('documentsList'),
        addDocumentBtn: document.getElementById('addDocumentBtn'),
        documentEditor: document.getElementById('documentEditor'),
        documentTitle: document.getElementById('documentTitle'),
        documentTextarea: document.getElementById('documentTextarea'),
        undoBtn: document.getElementById('undoBtn'),
        redoBtn: document.getElementById('redoBtn'),
        closeDocumentBtn: document.getElementById('closeDocumentBtn'),
        chatContainer: document.getElementById('chatContainer'),
        systemPromptEditor: document.getElementById('systemPromptEditor'),
        editorTitle: document.getElementById('editorTitle'),
        systemPromptTextarea: document.getElementById('systemPromptTextarea'),
        exitEditorBtn: document.getElementById('exitEditorBtn'),
        sidebar: document.getElementById('sidebar'),
        sidebarResizeHandle: document.getElementById('sidebarResizeHandle'),
        screenshareToggle: document.getElementById('screenshareToggle'),
        screenshareIndicator: document.getElementById('screenshareIndicator'),
        screensharePreviewContainer: document.getElementById('screensharePreviewContainer'),
        screensharePreviewImage: document.getElementById('screensharePreviewImage'),
        // Passphrase modal elements
        lockBtn: document.getElementById('lockBtn'),
        passphraseModal: document.getElementById('passphraseModal'),
        passphraseModalTitle: document.getElementById('passphraseModalTitle'),
        passphraseModalDescription: document.getElementById('passphraseModalDescription'),
        passphraseInput: document.getElementById('passphraseInput'),
        passphraseShowHideBtn: document.getElementById('passphraseShowHideBtn'),
        passphraseStrengthIndicator: document.getElementById('passphraseStrengthIndicator'),
        strengthBarFill: document.getElementById('strengthBarFill'),
        strengthLabel: document.getElementById('strengthLabel'),
        strengthFeedback: document.getElementById('strengthFeedback'),
        passphraseOptions: document.getElementById('passphraseOptions'),
        rememberPassphraseCheckbox: document.getElementById('rememberPassphraseCheckbox'),
        passphraseSubmitBtn: document.getElementById('passphraseSubmitBtn'),
        passphraseCancelBtn: document.getElementById('passphraseCancelBtn'),
        forgotPassphraseBtn: document.getElementById('forgotPassphraseBtn'),
        passphraseStatus: document.getElementById('passphraseStatus'),
        lockedOverlay: document.getElementById('lockedOverlay'),
        unlockBtn: document.getElementById('unlockBtn')
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
        
        // Add copy-to-document button for Claude messages when appropriate
        if (!isUser) {
            this.addCopyToDocumentButton(messageDiv, bubbleDiv);
        }
        
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
            // Add copy-to-document button when streaming is complete
            const messageDiv = bubbleDiv.parentElement;
            this.addCopyToDocumentButton(messageDiv, bubbleDiv);
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
        // Reset textarea height to single line
        this.elements.messageInput.style.height = 'auto';
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
    },

    // Add copy-to-document button to Claude messages
    addCopyToDocumentButton(messageDiv, bubbleDiv) {
        // Only show button when document is open
        if (typeof Documents === 'undefined' || !Documents.currentDocumentId) {
            return;
        }

        // Check if button already exists (prevent duplicates)
        if (messageDiv.querySelector('.copy-to-document-btn')) {
            return;
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-to-document-btn';
        copyBtn.innerHTML = '→';
        copyBtn.title = 'Copy to Document (Tab)';
        
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyMessageToDocument(bubbleDiv);
        });

        actionsDiv.appendChild(copyBtn);
        messageDiv.appendChild(actionsDiv);
    },

    // Copy message content to document
    copyMessageToDocument(bubbleDiv, isTabTriggered = false) {
        if (typeof Documents === 'undefined' || !Documents.currentDocumentId) {
            return;
        }

        // For rich text editor, we can insert HTML directly
        let content = bubbleDiv.innerHTML;
        
        // Clean up the HTML for better document insertion
        content = content
            .replace(/\n\s*\n/g, '\n') // Remove empty lines
            .trim();

        // Tab-specific: move cursor to end of document first
        if (isTabTriggered) {
            const editor = UI.elements.documentTextarea;
            if (editor) {
                editor.focus();
                // Move cursor to very end
                const range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false); // false = end of range
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }

        // Insert HTML content at cursor position
        Documents.insertTextAtCursor(content);

        // Tab-specific enhancements: add paragraph break and return focus to chat
        if (isTabTriggered) {
            Documents.insertTextAtCursor('<p><br></p>');
            // Return focus to chat input for seamless workflow
            if (this.elements.messageInput) {
                this.elements.messageInput.focus();
            }
        }
    },

    // Refresh copy-to-document button visibility based on current document state
    refreshCopyToDocumentButtons() {
        const claudeMessages = document.querySelectorAll('.message.claude');
        
        claudeMessages.forEach(messageDiv => {
            const existingButton = messageDiv.querySelector('.copy-to-document-btn');
            const bubbleDiv = messageDiv.querySelector('.message-bubble');
            
            // Check if button should be visible
            const shouldShowButton = (
                typeof Documents !== 'undefined' && 
                Documents.currentDocumentId
            );
            
            if (shouldShowButton && !existingButton && bubbleDiv) {
                // Add button if it should be visible but doesn't exist
                this.addCopyToDocumentButton(messageDiv, bubbleDiv);
            } else if (!shouldShowButton && existingButton) {
                // Remove button if it shouldn't be visible but exists
                const actionsDiv = existingButton.parentElement;
                if (actionsDiv && actionsDiv.className === 'message-actions') {
                    actionsDiv.remove();
                }
            }
        });
    }
};