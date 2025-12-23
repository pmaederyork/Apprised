/**
 * Document management functionality
 * Handles document creation, loading, deletion, editing, and document list rendering
 */
const Documents = {
    // Current document state
    currentDocumentId: null,
    documents: {},
    isSaving: false,
    saveTimeout: null,
    
    // Undo/redo state
    undoStacks: {}, // Per document undo stacks
    redoStacks: {}, // Per document redo stacks
    maxHistorySize: 50,
    inputTimeout: null,
    lastSavedState: null,

    // Initialize document system
    init() {
        // Prevent multiple initialization to avoid duplicate event listeners
        if (this.initialized) {
            console.warn('Documents module already initialized');
            return;
        }
        
        this.documents = Storage.getDocuments();
        this.bindEvents();
        this.renderDocumentList();
        
        // Restore last open document if it exists
        this.restoreLastOpenDocument();
        
        this.initialized = true;
    },

    // Bind event listeners
    bindEvents() {
        // Add document button
        UI.elements.addDocumentBtn?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent collapsing the section
            this.createNew();
        });

        // Documents collapse functionality
        UI.elements.documentsHeader?.addEventListener('click', () => {
            this.toggleDocumentsCollapse();
        });

        // Document editor events
        UI.elements.closeDocumentBtn?.addEventListener('click', () => {
            this.closeEditor();
        });

        // Document title saving
        UI.elements.documentTitle?.addEventListener('input', () => {
            this.saveDocumentTitleImmediate();
        });
        UI.elements.documentTitle?.addEventListener('blur', () => {
            this.saveDocumentTitle();
        });

        // Document content auto-save and history tracking
        UI.elements.documentTextarea?.addEventListener('input', () => {
            this.scheduleAutoSave();
            this.scheduleHistoryCapture();
        });

        // Cursor position tracking for header button states
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === UI.elements.documentTextarea) {
                this.updateHeaderButtonStates();
            }
        });
        UI.elements.documentTextarea?.addEventListener('click', () => {
            this.updateHeaderButtonStates();
        });
        UI.elements.documentTextarea?.addEventListener('keyup', () => {
            this.updateHeaderButtonStates();
        });

        // Markdown toolbar button events
        this.bindMarkdownEvents();

        // Markdown keyboard shortcuts
        this.bindMarkdownShortcuts();

        // Smart copy/paste functionality
        this.bindSmartCopyPaste();
    },

    // Create a new document
    createNew() {
        this.currentDocumentId = Storage.generateDocumentId();
        const newDocument = {
            id: this.currentDocumentId,
            title: 'New Document.html',
            content: '<h1>New Document</h1><p><br></p>',
            createdAt: Date.now(),
            lastModified: Date.now()
        };

        this.documents[this.currentDocumentId] = newDocument;
        Storage.saveDocuments(this.documents);
        this.renderDocumentList();
        this.openDocument(this.currentDocumentId);
    },

    // Open a document in the editor
    openDocument(documentId) {
        const document = this.documents[documentId];
        if (!document) {
            console.error('Document not found:', documentId);
            return;
        }

        this.currentDocumentId = documentId;
        
        // Save as last open document
        Storage.saveLastOpenDocumentId(documentId);
        
        // Update UI - hide .html extension in document editor
        const displayTitle = document.title.endsWith('.html') ? 
            document.title.slice(0, -5) : document.title;
        UI.elements.documentTitle.value = displayTitle;
        UI.elements.documentTextarea.innerHTML = document.content;
        
        // Show document editor
        UI.elements.documentEditor.classList.add('active');
        
        // Update active state in sidebar
        this.updateActiveDocumentInSidebar(documentId);
        
        // Initialize undo/redo for this document
        this.initializeHistory(documentId);
        
        // Focus the editor
        UI.elements.documentTextarea.focus();
        
        // Update header button states
        this.updateHeaderButtonStates();
        
        // Refresh copy-to-document buttons in chat
        if (typeof UI !== 'undefined' && UI.refreshCopyToDocumentButtons) {
            UI.refreshCopyToDocumentButtons();
        }
    },

    // Close the document editor
    closeEditor() {
        // Save current document before closing
        if (this.currentDocumentId) {
            this.saveCurrentDocument();
        }
        
        // Clear last open document
        Storage.saveLastOpenDocumentId(null);
        
        UI.elements.documentEditor.classList.remove('active');
        this.currentDocumentId = null;
        
        // Clear active state in sidebar
        this.updateActiveDocumentInSidebar(null);
        
        // Refresh copy-to-document buttons in chat
        if (typeof UI !== 'undefined' && UI.refreshCopyToDocumentButtons) {
            UI.refreshCopyToDocumentButtons();
        }
    },

    // Delete a document
    deleteDocument(documentId) {
        if (confirm('Are you sure you want to delete this document?')) {
            // Close editor if this document is currently open
            if (this.currentDocumentId === documentId) {
                this.closeEditor();
            }
            
            // Clear last open document if it matches the deleted document
            const lastOpenDocumentId = Storage.getLastOpenDocumentId();
            if (lastOpenDocumentId === documentId) {
                Storage.saveLastOpenDocumentId(null);
            }
            
            delete this.documents[documentId];
            Storage.saveDocuments(this.documents);
            this.renderDocumentList();
        }
    },

    // Save current document content
    saveCurrentDocument() {
        if (!this.currentDocumentId || this.isSaving) return;
        
        this.isSaving = true;
        const document = this.documents[this.currentDocumentId];
        if (document) {
            document.content = UI.elements.documentTextarea.innerHTML;
            document.lastModified = Date.now();
            Storage.saveDocuments(this.documents);
        }
        this.isSaving = false;
    },

    // Save document title immediately (without extension logic)
    saveDocumentTitleImmediate() {
        if (!this.currentDocumentId) return;
        
        const newTitle = UI.elements.documentTitle.value.trim() || 'New Document';
        const document = this.documents[this.currentDocumentId];
        if (document && document.title !== newTitle) {
            document.title = newTitle;
            document.lastModified = Date.now();
            Storage.saveDocuments(this.documents);
            this.renderDocumentList();
        }
    },

    // Save document title with extension logic (on blur)
    saveDocumentTitle() {
        if (!this.currentDocumentId) return;
        
        const rawTitle = UI.elements.documentTitle.value.trim() || 'New Document';
        // Auto-add .html extension if not present
        const newTitle = rawTitle.endsWith('.html') ? rawTitle : rawTitle + '.html';
        const document = this.documents[this.currentDocumentId];
        if (document && document.title !== newTitle) {
            document.title = newTitle;
            document.lastModified = Date.now();
            Storage.saveDocuments(this.documents);
            this.renderDocumentList();
            
            // Update the input field to show the final name without extension
            const displayTitle = newTitle.endsWith('.html') ? 
                newTitle.slice(0, -5) : newTitle;
            UI.elements.documentTitle.value = displayTitle;
        }
    },

    // Schedule auto-save with debouncing
    scheduleAutoSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveCurrentDocument();
        }, 500);
    },

    // Render document list in sidebar
    renderDocumentList() {
        if (!UI.elements.documentsList) return;
        
        UI.elements.documentsList.innerHTML = '';
        
        const sortedDocuments = Object.values(this.documents).sort((a, b) => b.lastModified - a.lastModified);
        
        sortedDocuments.forEach(document => {
            // Hide .html extension in sidebar display
            const displayTitle = document.title.endsWith('.html') ? 
                document.title.slice(0, -5) : document.title;
            
            const documentItem = Components.createListItem({
                text: displayTitle,
                isActive: document.id === this.currentDocumentId,
                className: 'document-item',
                maxLength: 25,
                onClick: () => this.openDocument(document.id),
                onNameEdit: (newName) => this.renameDocument(document.id, newName),
                actions: [
                    {
                        icon: '✕',
                        title: 'Delete document',
                        onClick: () => this.deleteDocument(document.id)
                    }
                ]
            });
            
            documentItem.setAttribute('data-document-id', document.id);
            UI.elements.documentsList.appendChild(documentItem);
        });
    },

    // Update active document state in sidebar
    updateActiveDocumentInSidebar(documentId) {
        document.querySelectorAll('.document-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (documentId) {
            const activeItem = document.querySelector(`[data-document-id="${documentId}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
    },

    // Rename a document
    renameDocument(documentId, newName) {
        const document = this.documents[documentId];
        if (document) {
            const trimmedName = newName.trim() || 'New Document.html';
            // Auto-add .html extension if not present
            const finalName = trimmedName.endsWith('.html') ? trimmedName : trimmedName + '.html';
            
            document.title = finalName;
            document.lastModified = Date.now();
            Storage.saveDocuments(this.documents);
            this.renderDocumentList();
            
            // Update title input if this is the current document - hide .html extension
            if (documentId === this.currentDocumentId) {
                const displayTitle = finalName.endsWith('.html') ? 
                    finalName.slice(0, -5) : finalName;
                UI.elements.documentTitle.value = displayTitle;
            }
        }
    },

    // Toggle collapse state of documents section
    toggleDocumentsCollapse() {
        const list = UI.elements.documentsList;
        const icon = UI.elements.documentsCollapse;
        
        if (!list || !icon) return;
        
        if (list.classList.contains('collapsed')) {
            list.classList.remove('collapsed');
            icon.classList.remove('collapsed');
        } else {
            list.classList.add('collapsed');
            icon.classList.add('collapsed');
        }
    },

    // Text manipulation utilities
    getEditorSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        
        const range = selection.getRangeAt(0);
        return {
            range: range,
            text: range.toString()
        };
    },

    insertTextAtCursor(text) {
        const editor = UI.elements.documentTextarea;
        if (!editor) return;
        
        editor.focus();
        
        // Use execCommand for better rich text insertion
        if (text.includes('<') && text.includes('>')) {
            // HTML content - insert as HTML
            document.execCommand('insertHTML', false, text);
        } else {
            // Plain text
            document.execCommand('insertText', false, text);
        }
        
        // Trigger auto-save
        this.scheduleAutoSave();
    },

    wrapSelectedText(before, after = '') {
        const editor = UI.elements.documentTextarea;
        if (!editor) return;
        
        const selection = this.getEditorSelection();
        if (!selection) return;
        
        const selectedText = selection.text;
        
        if (selectedText) {
            // Wrap selected text
            const wrappedText = before + selectedText + after;
            document.execCommand('insertHTML', false, wrappedText);
        } else {
            // No selection, insert template with placeholder
            const placeholder = this.getPlaceholderText(before, after);
            const wrappedText = before + placeholder + after;
            document.execCommand('insertHTML', false, wrappedText);
            
            // Select the placeholder text for easy replacement
            setTimeout(() => {
                const newSelection = window.getSelection();
                const range = document.createRange();
                const textNode = newSelection.focusNode;
                if (textNode && textNode.textContent.includes(placeholder)) {
                    const start = textNode.textContent.indexOf(placeholder);
                    range.setStart(textNode, start);
                    range.setEnd(textNode, start + placeholder.length);
                    newSelection.removeAllRanges();
                    newSelection.addRange(range);
                }
            }, 0);
        }
        
        editor.focus();
        this.scheduleAutoSave();
    },

    getPlaceholderText(before, after) {
        if (before === '**' && after === '**') return 'bold text';
        if (before === '*' && after === '*') return 'italic text';
        if (before === '~~' && after === '~~') return 'strikethrough';
        return 'text';
    },

    insertAtLineStart(prefix) {
        const editor = UI.elements.documentTextarea;
        if (!editor) return;
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        // For contentEditable, we'll just insert the prefix at cursor
        // This is a simplified implementation for rich text
        document.execCommand('insertText', false, prefix);
        
        editor.focus();
        this.scheduleAutoSave();
    },

    // Rich text formatting functions
    formatBold() {
        document.execCommand('bold', false, null);
        this.scheduleAutoSave();
    },

    formatItalic() {
        document.execCommand('italic', false, null);
        this.scheduleAutoSave();
    },


    formatStrikethrough() {
        document.execCommand('strikeThrough', false, null);
        this.scheduleAutoSave();
    },


    formatHeader(level) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const currentLevel = this.getCurrentHeaderLevel();
        let node = selection.focusNode;

        // If focus is on a text node, get the parent element
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
        }

        // Check if we're inside a header element
        let headerElement = null;
        if (node && node.nodeType === Node.ELEMENT_NODE && node.tagName.match(/^H[1-6]$/i)) {
            headerElement = node;
        }

        if (headerElement) {
            // We're inside a header - manually replace it
            if (currentLevel === level) {
                // Same level - convert to paragraph
                const p = document.createElement('p');
                p.innerHTML = headerElement.innerHTML;
                headerElement.replaceWith(p);

                // Restore cursor position
                const range = document.createRange();
                range.selectNodeContents(p);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                // Different level - change header tag
                const newHeader = document.createElement(`h${level}`);
                newHeader.innerHTML = headerElement.innerHTML;
                headerElement.replaceWith(newHeader);

                // Restore cursor position
                const range = document.createRange();
                range.selectNodeContents(newHeader);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } else {
            // No header - use formatBlock to create one
            const headerTag = `h${level}`;
            document.execCommand('formatBlock', false, headerTag);
        }

        this.scheduleAutoSave();
        this.updateHeaderButtonStates();
    },

    formatList() {
        document.execCommand('insertUnorderedList', false, null);
        this.scheduleAutoSave();
    },

    formatOrderedList() {
        document.execCommand('insertOrderedList', false, null);
        this.scheduleAutoSave();
    },



    // Bind markdown toolbar button events
    bindMarkdownEvents() {
        const buttons = [
            { id: 'undoBtn', handler: () => this.undo() },
            { id: 'redoBtn', handler: () => this.redo() },
            { id: 'boldBtn', handler: () => this.formatBold() },
            { id: 'italicBtn', handler: () => this.formatItalic() },
            { id: 'h1Btn', handler: () => this.formatHeader(1) },
            { id: 'h2Btn', handler: () => this.formatHeader(2) },
            { id: 'h3Btn', handler: () => this.formatHeader(3) },
            { id: 'listBtn', handler: () => this.formatList() },
            { id: 'orderedListBtn', handler: () => this.formatOrderedList() },
            { id: 'strikeBtn', handler: () => this.formatStrikethrough() }
        ];

        buttons.forEach(({ id, handler }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    handler();
                });
            }
        });
    },

    // Bind rich text keyboard shortcuts
    bindMarkdownShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when document editor is focused
            const editor = UI.elements.documentTextarea;
            const documentEditor = UI.elements.documentEditor;

            // Enhanced focus check with proper grouping
            if (!editor || !documentEditor) return;
            if (!documentEditor.classList.contains('active')) return; // Editor not open
            if (document.activeElement !== editor && !editor.contains(document.activeElement)) return;

            const isCtrlCmd = e.ctrlKey || e.metaKey;

            if (isCtrlCmd) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        e.stopPropagation();
                        this.formatBold();
                        break;
                    case 'i':
                        e.preventDefault();
                        e.stopPropagation();
                        this.formatItalic();
                        break;
                    case '1':
                        e.preventDefault();
                        e.stopPropagation();
                        this.formatHeader(1);
                        break;
                    case '2':
                        e.preventDefault();
                        e.stopPropagation();
                        this.formatHeader(2);
                        break;
                    case '3':
                        e.preventDefault();
                        e.stopPropagation();
                        this.formatHeader(3);
                        break;
                    case 'l':
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.shiftKey) {
                            this.formatOrderedList();
                        } else {
                            this.formatList();
                        }
                        break;
                    case 'z':
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        e.stopPropagation();
                        this.redo();
                        break;
                }

                // Handle Ctrl+Shift+X for strikethrough
                if (e.shiftKey && e.key === 'X') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.formatStrikethrough();
                }
            }
        });
    },

    // History management methods
    initializeHistory(documentId) {
        if (!this.undoStacks[documentId]) {
            this.undoStacks[documentId] = [];
        }
        if (!this.redoStacks[documentId]) {
            this.redoStacks[documentId] = [];
        }
        
        // Capture initial state
        this.captureCurrentState();
        this.updateUndoRedoButtons();
    },

    getCurrentState() {
        const editor = UI.elements.documentTextarea;
        if (!editor) return null;

        // Save current selection
        const selection = window.getSelection();
        let range = null;
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        }

        return {
            content: editor.innerHTML,
            range: range ? {
                startContainer: range.startContainer,
                startOffset: range.startOffset,
                endContainer: range.endContainer,
                endOffset: range.endOffset
            } : null,
            timestamp: Date.now()
        };
    },

    captureCurrentState() {
        if (!this.currentDocumentId) return;

        const currentState = this.getCurrentState();
        if (!currentState) return;

        const undoStack = this.undoStacks[this.currentDocumentId];
        
        // Don't capture if content hasn't changed
        if (undoStack.length > 0) {
            const lastState = undoStack[undoStack.length - 1];
            if (lastState.content === currentState.content) {
                return;
            }
        }

        // Add to undo stack
        undoStack.push(currentState);

        // Limit stack size
        if (undoStack.length > this.maxHistorySize) {
            undoStack.shift();
        }

        // Clear redo stack when new changes are made
        this.redoStacks[this.currentDocumentId] = [];
        
        this.updateUndoRedoButtons();
    },

    scheduleHistoryCapture() {
        // Don't capture history during undo/redo restoration
        if (this.isRestoring) return;

        // Debounce history capture to avoid capturing every keystroke
        if (this.inputTimeout) {
            clearTimeout(this.inputTimeout);
        }

        this.inputTimeout = setTimeout(() => {
            this.captureCurrentState();
        }, 1000); // Capture after 1 second of inactivity
    },

    restoreState(state) {
        const editor = UI.elements.documentTextarea;
        if (!editor || !state) return;

        // Set flag to prevent history capture during restoration
        this.isRestoring = true;

        editor.innerHTML = state.content;

        // Restore selection if available
        if (state.range) {
            try {
                const selection = window.getSelection();
                const range = document.createRange();
                range.setStart(state.range.startContainer, state.range.startOffset);
                range.setEnd(state.range.endContainer, state.range.endOffset);
                selection.removeAllRanges();
                selection.addRange(range);
            } catch (e) {
                // If restoration fails, just focus the editor
                editor.focus();
            }
        } else {
            editor.focus();
        }

        // Clear restoration flag
        this.isRestoring = false;

        // Trigger auto-save but NOT history capture
        this.scheduleAutoSave();
    },

    undo() {
        if (!this.currentDocumentId) return;

        // Block undo during review mode
        if (this.isInEditReviewMode()) return;

        const undoStack = this.undoStacks[this.currentDocumentId];
        const redoStack = this.redoStacks[this.currentDocumentId];

        if (!undoStack || undoStack.length <= 1) return; // Need at least 2 states

        // Save current state to redo stack
        const currentState = undoStack.pop();
        redoStack.push(currentState);

        // Restore previous state
        const previousState = undoStack[undoStack.length - 1];
        this.restoreState(previousState);

        this.updateUndoRedoButtons();
    },

    redo() {
        if (!this.currentDocumentId) return;

        // Block redo during review mode
        if (this.isInEditReviewMode()) return;

        const undoStack = this.undoStacks[this.currentDocumentId];
        const redoStack = this.redoStacks[this.currentDocumentId];

        if (!redoStack || redoStack.length === 0) return;

        // Restore next state from redo stack
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        this.restoreState(nextState);

        this.updateUndoRedoButtons();
    },

    updateUndoRedoButtons() {
        const undoBtn = UI.elements.undoBtn;
        const redoBtn = UI.elements.redoBtn;

        if (!undoBtn || !redoBtn || !this.currentDocumentId) return;

        // Disable during review mode
        if (this.isInEditReviewMode()) {
            undoBtn.disabled = true;
            redoBtn.disabled = true;
            undoBtn.classList.add('review-mode-disabled');
            redoBtn.classList.add('review-mode-disabled');
            undoBtn.title = 'Undo disabled during review';
            redoBtn.title = 'Redo disabled during review';
            return;
        }

        // Remove review mode styling
        undoBtn.classList.remove('review-mode-disabled');
        redoBtn.classList.remove('review-mode-disabled');
        undoBtn.title = 'Undo (Ctrl+Z)';
        redoBtn.title = 'Redo (Ctrl+Y)';

        const undoStack = this.undoStacks[this.currentDocumentId] || [];
        const redoStack = this.redoStacks[this.currentDocumentId] || [];

        // Update undo button (need at least 2 states to undo)
        undoBtn.disabled = undoStack.length <= 1;

        // Update redo button
        redoBtn.disabled = redoStack.length === 0;
    },


    // Get current header level at cursor position (0 = no header, 1-6 = header level)
    getCurrentHeaderLevel() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return 0;
        
        let node = selection.focusNode;
        
        // If focus is on a text node, check its immediate parent
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
        }
        
        // Only check the immediate element, not ancestors
        if (node && node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            if (tagName.match(/^h[1-6]$/)) {
                return parseInt(tagName.charAt(1));
            }
        }
        
        return 0;
    },


    // Update header button visual states based on current cursor position
    updateHeaderButtonStates() {
        const h1Btn = document.getElementById('h1Btn');
        const h2Btn = document.getElementById('h2Btn');
        const h3Btn = document.getElementById('h3Btn');
        
        if (!h1Btn || !h2Btn || !h3Btn) return;
        
        // Clear all active states
        h1Btn.classList.remove('active');
        h2Btn.classList.remove('active');
        h3Btn.classList.remove('active');
        
        // Set active state based on current header level
        const currentLevel = this.getCurrentHeaderLevel();
        if (currentLevel === 1) {
            h1Btn.classList.add('active');
        } else if (currentLevel === 2) {
            h2Btn.classList.add('active');
        } else if (currentLevel === 3) {
            h3Btn.classList.add('active');
        }
    },

    // Smart copy/paste functionality for Google Docs integration
    bindSmartCopyPaste() {
        const editor = UI.elements.documentTextarea;
        if (!editor) return;

        // Rich text editor doesn't need special copy handling - browser handles it
        // Just ensure paste events trigger auto-save
        editor.addEventListener('paste', (e) => {
            if (!this.isDocumentEditorActive()) return;
            
            // Let browser handle rich text paste naturally
            setTimeout(() => {
                this.scheduleAutoSave();
            }, 0);
        });
    },

    // Check if document editor is currently active
    isDocumentEditorActive() {
        const documentEditor = UI.elements.documentEditor;
        const editor = UI.elements.documentTextarea;
        return documentEditor && 
               documentEditor.classList.contains('active') && 
               editor && 
               (document.activeElement === editor || editor.contains(document.activeElement));
    },

    // Convert markdown to HTML for Google Docs compatibility
    markdownToHTML(markdown) {
        if (!markdown) return '';

        let html = markdown
            // Headers
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            
            // Bold and italic
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Strikethrough
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            
            // Code (inline)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            
            // Horizontal rule
            .replace(/^---$/gm, '<hr>')
            
            // Blockquotes
            .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
            
            // Unordered lists
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            
            // Ordered lists
            .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
            
            // Line breaks
            .replace(/\n/g, '<br>');

        // Wrap consecutive list items in proper list tags
        html = html
            .replace(/(<li>.*?<\/li>)(<br>)*(?=<li>)/g, '$1')
            .replace(/(<li>.*?<\/li>)(<br>)*(?!<li>)/g, '</ul>$1')
            .replace(/(?<!<\/ul>)(<li>.*?<\/li>)/g, '<ul>$1');

        // Fix nested blockquotes
        html = html.replace(/(<blockquote>.*?<\/blockquote>)(<br>)*(?=<blockquote>)/g, '$1');

        return html;
    },

    // Convert HTML to clean markdown
    htmlToMarkdown(html) {
        if (!html) return '';

        // Step 1: Parse HTML and identify Google Docs bold formatting
        // Google Docs uses <span style="font-weight:700;"> for bold
        let markdown = html;

        // Step 2: Convert Google Docs bold spans to markdown FIRST (before removing spans)
        markdown = markdown.replace(/<span[^>]*font-weight:700[^>]*>(.*?)<\/span>/gi, '**$1**');
        
        // Step 3: Convert headers
        markdown = markdown
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n');

        // Step 4: Convert paragraphs to line breaks
        markdown = markdown.replace(/<\/p>/gi, '\n');
        markdown = markdown.replace(/<p[^>]*>/gi, '');

        // Step 5: Convert line breaks
        markdown = markdown.replace(/<br[^>]*\/?>/gi, '\n');

        // Step 6: Clean up Google Docs meta tags and spans
        markdown = markdown
            .replace(/<meta[^>]*>/gi, '')
            .replace(/<b[^>]*id="[^"]*"[^>]*>/gi, '')
            .replace(/<\/b>/gi, '')
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '');

        // Step 7: Handle any remaining standard HTML formatting
        markdown = markdown
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

        // Step 8: Remove any remaining HTML tags
        markdown = markdown.replace(/<[^>]*>/g, '');

        // Step 9: Clean up HTML entities
        markdown = markdown
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'");

        // Step 10: Clean up whitespace while preserving structure
        markdown = markdown
            .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
            .replace(/\n[ \t]+/g, '\n') // Remove leading whitespace
            .replace(/[ \t]+\n/g, '\n') // Remove trailing whitespace  
            .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
            .replace(/^\n+/, '') // Remove leading newlines
            .replace(/\n+$/, '') // Remove trailing newlines
            .trim();

        return markdown;
    },

    // Restore the last open document if it exists
    restoreLastOpenDocument() {
        const lastOpenDocumentId = Storage.getLastOpenDocumentId();

        // If no document was previously open, do nothing
        if (!lastOpenDocumentId) {
            return;
        }

        // Check if the document still exists
        if (this.documents[lastOpenDocumentId]) {
            // Silently reopen the document
            this.openDocument(lastOpenDocumentId);
        } else {
            // Document was deleted, clear the stored ID and silently continue
            Storage.saveLastOpenDocumentId(null);
        }
    },

    // ============================================
    // CLAUDE DOCUMENT EDITING METHODS
    // ============================================

    /**
     * Apply Claude's proposed edits to the document
     * Enters review mode where user can accept/reject changes
     */
    applyClaudeEdits(changes) {
        if (!this.currentDocumentId) {
            console.warn('No document open to apply edits');
            return;
        }

        if (!changes || changes.length === 0) {
            console.warn('No changes to apply');
            return;
        }

        // Mark all changes as pending
        changes.forEach(change => {
            if (!change.status) {
                change.status = 'pending';
            }
        });

        // Render the changes in the document with visual highlights
        this.renderChangesInDocument(changes);

        // Initialize Claude Changes review mode
        ClaudeChanges.init(this.currentDocumentId, changes);

        // Show the review panel
        if (UI.elements.documentChangeReview) {
            UI.elements.documentChangeReview.style.display = 'block';
        }

        // Focus on the first change
        ClaudeChanges.focusCurrentChange();

        console.log(`Applied ${changes.length} changes from Claude to document`);
    },

    /**
     * Render changes in the document with visual highlighting
     */
    renderChangesInDocument(changes) {
        const editor = UI.elements.documentTextarea;
        if (!editor) return;

        // Get current HTML content
        const currentHTML = editor.innerHTML;

        // Create a temporary container to work with
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentHTML;

        // Apply each change with visual markers
        changes.forEach((change, index) => {
            const changeElement = document.createElement('div');
            changeElement.setAttribute('data-change-id', change.id);
            changeElement.setAttribute('data-change-index', index);

            if (change.type === 'delete') {
                // Wrap content to be deleted in red highlight
                changeElement.className = 'claude-change-delete';
                changeElement.innerHTML = change.originalContent || '';

                // Try to find and replace the original content
                const originalNode = this.findNodeByContent(tempDiv, change.originalContent);
                if (originalNode) {
                    originalNode.replaceWith(changeElement);
                } else {
                    // If can't find exact match, append to end
                    tempDiv.appendChild(changeElement);
                }
            } else if (change.type === 'add') {
                // Wrap new content in green highlight
                changeElement.className = 'claude-change-add';
                changeElement.innerHTML = change.newContent || '';

                // Insert at appropriate position using content anchoring
                if (change.insertAfter) {
                    const anchorNode = this.findNodeByContent(tempDiv, change.insertAfter);
                    if (anchorNode) {
                        anchorNode.after(changeElement);
                    } else {
                        console.warn('Could not find insertAfter anchor:', change.insertAfter);
                        tempDiv.appendChild(changeElement);
                    }
                } else if (change.insertBefore) {
                    const anchorNode = this.findNodeByContent(tempDiv, change.insertBefore);
                    if (anchorNode) {
                        anchorNode.before(changeElement);
                    } else {
                        console.warn('Could not find insertBefore anchor:', change.insertBefore);
                        tempDiv.appendChild(changeElement);
                    }
                } else {
                    // No anchor specified, append to end
                    tempDiv.appendChild(changeElement);
                }
            } else if (change.type === 'modify') {
                // Show both old (strikethrough) and new (highlighted)
                changeElement.className = 'claude-change-modify';
                changeElement.innerHTML = change.newContent || '';

                // Try to find and replace the original content
                const originalNode = this.findNodeByContent(tempDiv, change.originalContent);
                if (originalNode) {
                    originalNode.replaceWith(changeElement);
                } else {
                    // If can't find exact match, append to end
                    tempDiv.appendChild(changeElement);
                }
            }

            // Add change number indicator
            const numberIndicator = document.createElement('span');
            numberIndicator.className = 'claude-change-number';
            numberIndicator.textContent = (index + 1).toString();
            changeElement.appendChild(numberIndicator);
        });

        // Update the editor with the marked-up content
        editor.innerHTML = tempDiv.innerHTML;
    },

    /**
     * Normalize HTML string for comparison (removes whitespace variations)
     * @param {string} html - HTML content to normalize
     * @param {boolean} stripAttributes - If true, removes all HTML attributes
     */
    normalizeHTML(html, stripAttributes = false) {
        if (!html) return '';

        // Trim whitespace, collapse multiple spaces, remove newlines
        let normalized = html
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><');

        // Optionally strip attributes for more flexible matching
        if (stripAttributes) {
            // Convert <tag attr="value"> to <tag>
            normalized = normalized.replace(/<(\w+)[^>]*>/g, '<$1>');
        }

        return normalized.toLowerCase();
    },

    /**
     * Find a node by its content (helper for renderChangesInDocument)
     * Uses recursive search with multiple matching strategies
     */
    findNodeByContent(container, content) {
        if (!content) return null;

        // Normalize the search content for flexible matching
        const normalizedContent = this.normalizeHTML(content);

        // Helper: Recursive depth-first search
        const searchNode = (node) => {
            if (!node || node.nodeType !== 1) return null; // Only element nodes

            // Strategy 1: Exact innerHTML match (fast path)
            if (node.innerHTML === content) {
                return node;
            }

            // Strategy 2: Exact outerHTML match
            if (node.outerHTML === content) {
                return node;
            }

            // Strategy 3: Normalized innerHTML match (handles whitespace)
            if (this.normalizeHTML(node.innerHTML) === normalizedContent) {
                console.log('Found match using normalized innerHTML:', node.tagName);
                return node;
            }

            // Strategy 4: Normalized outerHTML match (handles whitespace + attributes)
            if (this.normalizeHTML(node.outerHTML) === normalizedContent) {
                console.log('Found match using normalized outerHTML:', node.tagName);
                return node;
            }

            // Strategy 4.5: Normalized match with attributes stripped (handles attribute differences)
            const normalizedContentNoAttrs = this.normalizeHTML(content, true);
            if (this.normalizeHTML(node.outerHTML, true) === normalizedContentNoAttrs) {
                console.log('Found match ignoring attributes:', node.tagName);
                return node;
            }

            // Strategy 5: Plain text content match (most forgiving fallback)
            // Strip all HTML tags and compare text content only
            const nodeText = node.textContent?.trim().replace(/\s+/g, ' ').toLowerCase();
            const searchText = content.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
            if (nodeText && searchText && nodeText === searchText && searchText.length > 0) {
                console.log('Found match using plain text content:', node.tagName);
                return node;
            }

            // Recurse into children
            for (let child of node.children) {
                const found = searchNode(child);
                if (found) return found;
            }

            return null;
        };

        const result = searchNode(container);

        if (!result) {
            console.warn('Could not find anchor content:', content);
            console.warn('Normalized search term:', normalizedContent);
        }

        return result;
    },

    /**
     * Parse Claude's response for document edit commands
     * Looks for <document_edit> XML tags in Claude's response
     */
    parseClaudeEditResponse(responseText) {
        if (!responseText) return null;

        // Look for <document_edit> tags in Claude's response
        const editMatch = responseText.match(/<document_edit>(.*?)<\/document_edit>/s);

        if (!editMatch) {
            // Claude didn't propose structured edits
            return null;
        }

        const editXML = editMatch[1];
        const changes = [];

        // Parse each <change> element with flexible attribute order
        // Match opening tag and content separately to handle any attribute order
        const changeRegex = /<change\s+([^>]+)>(.*?)<\/change>/gs;
        let match;

        while ((match = changeRegex.exec(editXML)) !== null) {
            const [, attributeString, content] = match;

            // Extract attributes independently (order-agnostic)
            const type = attributeString.match(/type="([^"]+)"/)?.[1];
            const insertAfter = attributeString.match(/insertAfter="([^"]+)"/)?.[1];
            const insertBefore = attributeString.match(/insertBefore="([^"]+)"/)?.[1];

            const originalMatch = content.match(/<original>(.*?)<\/original>/s);
            const newMatch = content.match(/<new>(.*?)<\/new>/s);

            changes.push({
                id: Storage.generateChangeId(),
                type: type,
                insertAfter: insertAfter || undefined,
                insertBefore: insertBefore || undefined,
                originalContent: originalMatch ? originalMatch[1].trim() : null,
                newContent: newMatch ? newMatch[1].trim() : null,
                status: 'pending'
            });
        }

        return changes.length > 0 ? changes : null;
    },

    /**
     * Check if currently in edit review mode
     */
    isInEditReviewMode() {
        return ClaudeChanges && ClaudeChanges.isInReviewMode();
    }
};