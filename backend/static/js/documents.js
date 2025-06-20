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

        // Document content auto-save
        UI.elements.documentTextarea?.addEventListener('input', () => {
            this.scheduleAutoSave();
        });

        // Markdown toolbar button events
        this.bindMarkdownEvents();

        // Markdown keyboard shortcuts
        this.bindMarkdownShortcuts();
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
                }
                
                // Handle Ctrl+Shift+X for strikethrough
                if (e.shiftKey && e.key === 'X') {
                    e.preventDefault();
                    this.formatStrikethrough();
                }
            }
        });
    }
};