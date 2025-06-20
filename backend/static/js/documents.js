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
            this.saveDocumentTitle();
        });
        UI.elements.documentTitle?.addEventListener('blur', () => {
            this.saveDocumentTitle();
        });

        // Document content auto-save and history tracking
        UI.elements.documentTextarea?.addEventListener('input', () => {
            this.scheduleAutoSave();
            this.scheduleHistoryCapture();
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
            title: 'New Document',
            content: '# New Document\n\n',
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
        
        // Update UI
        UI.elements.documentTitle.value = document.title;
        UI.elements.documentTextarea.value = document.content;
        
        // Show document editor
        UI.elements.documentEditor.classList.add('active');
        
        // Update active state in sidebar
        this.updateActiveDocumentInSidebar(documentId);
        
        // Initialize undo/redo for this document
        this.initializeHistory(documentId);
        
        // Focus the textarea
        UI.elements.documentTextarea.focus();
    },

    // Close the document editor
    closeEditor() {
        // Save current document before closing
        if (this.currentDocumentId) {
            this.saveCurrentDocument();
        }
        
        UI.elements.documentEditor.classList.remove('active');
        this.currentDocumentId = null;
        
        // Clear active state in sidebar
        this.updateActiveDocumentInSidebar(null);
    },

    // Delete a document
    deleteDocument(documentId) {
        if (confirm('Are you sure you want to delete this document?')) {
            // Close editor if this document is currently open
            if (this.currentDocumentId === documentId) {
                this.closeEditor();
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
            document.content = UI.elements.documentTextarea.value;
            document.lastModified = Date.now();
            Storage.saveDocuments(this.documents);
        }
        this.isSaving = false;
    },

    // Save document title
    saveDocumentTitle() {
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
            const documentItem = Components.createListItem({
                text: document.title,
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
            const trimmedName = newName.trim() || 'New Document';
            // Auto-add .md extension if not present
            const finalName = trimmedName.endsWith('.md') ? trimmedName : trimmedName + '.md';
            
            document.title = finalName;
            document.lastModified = Date.now();
            Storage.saveDocuments(this.documents);
            this.renderDocumentList();
            
            // Update title input if this is the current document
            if (documentId === this.currentDocumentId) {
                UI.elements.documentTitle.value = finalName;
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
    getTextareaSelection() {
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return null;
        
        return {
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
            text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
        };
    },

    insertTextAtCursor(text) {
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        
        textarea.value = before + text + after;
        
        // Set cursor position after inserted text
        const newPosition = start + text.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
        
        // Trigger auto-save
        this.scheduleAutoSave();
    },

    wrapSelectedText(before, after = '') {
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return;
        
        const selection = this.getTextareaSelection();
        if (!selection) return;
        
        const start = selection.start;
        const end = selection.end;
        const selectedText = selection.text;
        
        let wrappedText;
        if (selectedText) {
            wrappedText = before + selectedText + after;
        } else {
            // No selection, insert template
            const placeholder = this.getPlaceholderText(before, after);
            wrappedText = before + placeholder + after;
        }
        
        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);
        
        textarea.value = beforeText + wrappedText + afterText;
        
        // Set selection around placeholder text if no text was selected
        if (!selectedText) {
            const placeholderStart = start + before.length;
            const placeholderEnd = placeholderStart + this.getPlaceholderText(before, after).length;
            textarea.setSelectionRange(placeholderStart, placeholderEnd);
        } else {
            // Position cursor after the wrapped text
            const newPosition = start + wrappedText.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }
        
        textarea.focus();
        this.scheduleAutoSave();
    },

    getPlaceholderText(before, after) {
        if (before === '**' && after === '**') return 'bold text';
        if (before === '*' && after === '*') return 'italic text';
        if (before === '`' && after === '`') return 'code';
        if (before === '~~' && after === '~~') return 'strikethrough';
        if (before === '[' && after === '](url)') return 'link text';
        return 'text';
    },

    insertAtLineStart(prefix) {
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const value = textarea.value;
        
        // Find the start of the current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', start);
        const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
        
        const currentLine = value.substring(lineStart, actualLineEnd);
        
        // Check if line already has this prefix
        if (currentLine.startsWith(prefix)) {
            // Remove the prefix
            const newLine = currentLine.substring(prefix.length);
            textarea.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd);
            textarea.setSelectionRange(start - prefix.length, start - prefix.length);
        } else {
            // Add the prefix
            textarea.value = value.substring(0, lineStart) + prefix + value.substring(lineStart);
            textarea.setSelectionRange(start + prefix.length, start + prefix.length);
        }
        
        textarea.focus();
        this.scheduleAutoSave();
    },

    // Markdown formatting functions
    formatBold() {
        this.wrapSelectedText('**', '**');
    },

    formatItalic() {
        this.wrapSelectedText('*', '*');
    },

    formatCode() {
        this.wrapSelectedText('`', '`');
    },

    formatStrikethrough() {
        this.wrapSelectedText('~~', '~~');
    },

    formatLink() {
        const selection = this.getTextareaSelection();
        if (selection && selection.text) {
            this.wrapSelectedText('[', '](url)');
        } else {
            this.insertTextAtCursor('[link text](url)');
        }
    },

    formatHeader(level) {
        const prefix = '#'.repeat(level) + ' ';
        this.insertAtLineStart(prefix);
    },

    formatList() {
        this.insertAtLineStart('- ');
    },

    formatOrderedList() {
        this.insertAtLineStart('1. ');
    },

    formatBlockquote() {
        this.insertAtLineStart('> ');
    },

    formatHorizontalRule() {
        this.insertTextAtCursor('\n---\n');
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
            { id: 'codeBtn', handler: () => this.formatCode() },
            { id: 'linkBtn', handler: () => this.formatLink() },
            { id: 'listBtn', handler: () => this.formatList() },
            { id: 'orderedListBtn', handler: () => this.formatOrderedList() },
            { id: 'quoteBtn', handler: () => this.formatBlockquote() },
            { id: 'strikeBtn', handler: () => this.formatStrikethrough() },
            { id: 'hrBtn', handler: () => this.formatHorizontalRule() }
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

    // Bind markdown keyboard shortcuts
    bindMarkdownShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when document editor is focused
            const textarea = UI.elements.documentTextarea;
            if (!textarea || document.activeElement !== textarea) return;
            
            const isCtrlCmd = e.ctrlKey || e.metaKey;
            
            if (isCtrlCmd) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        this.formatBold();
                        break;
                    case 'i':
                        e.preventDefault();
                        this.formatItalic();
                        break;
                    case '1':
                        e.preventDefault();
                        this.formatHeader(1);
                        break;
                    case '2':
                        e.preventDefault();
                        this.formatHeader(2);
                        break;
                    case '3':
                        e.preventDefault();
                        this.formatHeader(3);
                        break;
                    case '`':
                        e.preventDefault();
                        this.formatCode();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.formatLink();
                        break;
                    case 'l':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.formatOrderedList();
                        } else {
                            this.formatList();
                        }
                        break;
                    case '.':
                    case '>':
                        e.preventDefault();
                        this.formatBlockquote();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.formatHorizontalRule();
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                }
                
                // Handle Ctrl+Shift+X for strikethrough
                if (e.shiftKey && e.key === 'X') {
                    e.preventDefault();
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
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return null;

        return {
            content: textarea.value,
            selectionStart: textarea.selectionStart,
            selectionEnd: textarea.selectionEnd,
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
        // Debounce history capture to avoid capturing every keystroke
        if (this.inputTimeout) {
            clearTimeout(this.inputTimeout);
        }

        this.inputTimeout = setTimeout(() => {
            this.captureCurrentState();
        }, 1000); // Capture after 1 second of inactivity
    },

    restoreState(state) {
        const textarea = UI.elements.documentTextarea;
        if (!textarea || !state) return;

        textarea.value = state.content;
        textarea.setSelectionRange(state.selectionStart, state.selectionEnd);
        textarea.focus();

        // Trigger auto-save
        this.scheduleAutoSave();
    },

    undo() {
        if (!this.currentDocumentId) return;

        const undoStack = this.undoStacks[this.currentDocumentId];
        const redoStack = this.redoStacks[this.currentDocumentId];

        if (undoStack.length === 0) return;

        // Save current state to redo stack before undoing
        const currentState = this.getCurrentState();
        if (currentState) {
            redoStack.push(currentState);
        }

        // Restore previous state
        const previousState = undoStack.pop();
        this.restoreState(previousState);

        this.updateUndoRedoButtons();
    },

    redo() {
        if (!this.currentDocumentId) return;

        const undoStack = this.undoStacks[this.currentDocumentId];
        const redoStack = this.redoStacks[this.currentDocumentId];

        if (redoStack.length === 0) return;

        // Save current state to undo stack before redoing
        const currentState = this.getCurrentState();
        if (currentState) {
            undoStack.push(currentState);
        }

        // Restore next state
        const nextState = redoStack.pop();
        this.restoreState(nextState);

        this.updateUndoRedoButtons();
    },

    updateUndoRedoButtons() {
        const undoBtn = UI.elements.undoBtn;
        const redoBtn = UI.elements.redoBtn;

        if (!undoBtn || !redoBtn || !this.currentDocumentId) return;

        const undoStack = this.undoStacks[this.currentDocumentId] || [];
        const redoStack = this.redoStacks[this.currentDocumentId] || [];

        // Update undo button
        if (undoStack.length > 0) {
            undoBtn.disabled = false;
        } else {
            undoBtn.disabled = true;
        }

        // Update redo button
        if (redoStack.length > 0) {
            redoBtn.disabled = false;
        } else {
            redoBtn.disabled = true;
        }
    },

    // Override existing text manipulation methods to capture history
    wrapSelectedText(before, after = '') {
        // Capture state before making changes
        this.captureCurrentState();
        
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return;
        
        const selection = this.getTextareaSelection();
        if (!selection) return;
        
        const start = selection.start;
        const end = selection.end;
        const selectedText = selection.text;
        
        let wrappedText;
        if (selectedText) {
            wrappedText = before + selectedText + after;
        } else {
            // No selection, insert template
            const placeholder = this.getPlaceholderText(before, after);
            wrappedText = before + placeholder + after;
        }
        
        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);
        
        textarea.value = beforeText + wrappedText + afterText;
        
        // Set selection around placeholder text if no text was selected
        if (!selectedText) {
            const placeholderStart = start + before.length;
            const placeholderEnd = placeholderStart + this.getPlaceholderText(before, after).length;
            textarea.setSelectionRange(placeholderStart, placeholderEnd);
        } else {
            // Position cursor after the wrapped text
            const newPosition = start + wrappedText.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }
        
        textarea.focus();
        this.scheduleAutoSave();
        
        // Clear redo stack since we made a new change
        if (this.currentDocumentId) {
            this.redoStacks[this.currentDocumentId] = [];
            this.updateUndoRedoButtons();
        }
    },

    insertTextAtCursor(text) {
        // Capture state before making changes
        this.captureCurrentState();
        
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        
        textarea.value = before + text + after;
        
        // Set cursor position after inserted text
        const newPosition = start + text.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
        
        // Trigger auto-save
        this.scheduleAutoSave();
        
        // Clear redo stack since we made a new change
        if (this.currentDocumentId) {
            this.redoStacks[this.currentDocumentId] = [];
            this.updateUndoRedoButtons();
        }
    },

    insertAtLineStart(prefix) {
        // Capture state before making changes
        this.captureCurrentState();
        
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const value = textarea.value;
        
        // Find the start of the current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', start);
        const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
        
        const currentLine = value.substring(lineStart, actualLineEnd);
        
        // Check if line already has this prefix
        if (currentLine.startsWith(prefix)) {
            // Remove the prefix
            const newLine = currentLine.substring(prefix.length);
            textarea.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd);
            textarea.setSelectionRange(start - prefix.length, start - prefix.length);
        } else {
            // Add the prefix
            textarea.value = value.substring(0, lineStart) + prefix + value.substring(lineStart);
            textarea.setSelectionRange(start + prefix.length, start + prefix.length);
        }
        
        textarea.focus();
        this.scheduleAutoSave();
        
        // Clear redo stack since we made a new change
        if (this.currentDocumentId) {
            this.redoStacks[this.currentDocumentId] = [];
            this.updateUndoRedoButtons();
        }
    },

    // Smart copy/paste functionality for Google Docs integration
    bindSmartCopyPaste() {
        const textarea = UI.elements.documentTextarea;
        if (!textarea) return;

        // Enhanced copy handler - convert markdown to rich HTML
        textarea.addEventListener('copy', async (e) => {
            if (!this.isDocumentEditorActive()) return;

            const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
            if (!selectedText) return;

            // Convert markdown to HTML
            const htmlContent = this.markdownToHTML(selectedText);
            
            try {
                // Use modern clipboard API for rich text
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([htmlContent], { type: 'text/html' }),
                        'text/plain': new Blob([selectedText], { type: 'text/plain' })
                    })
                ]);
            } catch (error) {
                // Fallback to legacy clipboard API
                e.clipboardData.setData('text/html', htmlContent);
                e.clipboardData.setData('text/plain', selectedText);
                e.preventDefault();
            }
        });

        // Enhanced paste handler - convert HTML to markdown
        textarea.addEventListener('paste', async (e) => {
            if (!this.isDocumentEditorActive()) return;

            e.preventDefault();
            
            let htmlContent = '';
            let plainText = '';

            // Try legacy clipboard API first (better for HTML from Google Docs)
            const clipboardData = e.clipboardData || window.clipboardData;
            if (clipboardData) {
                htmlContent = clipboardData.getData('text/html');
                plainText = clipboardData.getData('text/plain');
                
                // Also try other possible HTML formats
                if (!htmlContent) {
                    htmlContent = clipboardData.getData('text/rtf') || 
                                 clipboardData.getData('application/rtf') ||
                                 clipboardData.getData('text/richtext');
                }
            }
            
            // Fallback to modern clipboard API if legacy didn't work
            if (!htmlContent && !plainText) {
                try {
                    const clipboardItems = await navigator.clipboard.read();
                    
                    for (const item of clipboardItems) {
                        if (item.types.includes('text/html')) {
                            const blob = await item.getType('text/html');
                            htmlContent = await blob.text();
                        }
                        if (item.types.includes('text/plain')) {
                            const blob = await item.getType('text/plain');
                            plainText = await blob.text();
                        }
                    }
                } catch (error) {
                    // Silently fall back to plain text
                }
            }

            // Convert HTML to markdown if available, otherwise use plain text
            let contentToInsert = '';
            if (htmlContent && htmlContent.trim()) {
                contentToInsert = this.htmlToMarkdown(htmlContent);
            } else {
                contentToInsert = plainText;
            }

            // Insert the converted content
            if (contentToInsert) {
                this.insertTextAtCursor(contentToInsert);
            }
        });
    },

    // Check if document editor is currently active
    isDocumentEditorActive() {
        const documentEditor = UI.elements.documentEditor;
        const textarea = UI.elements.documentTextarea;
        return documentEditor && 
               documentEditor.style.display !== 'none' && 
               textarea && 
               document.activeElement === textarea;
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
    }
};