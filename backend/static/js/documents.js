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
    isPulling: false, // Flag to prevent recursive auto-pull loops
    squireEditor: null, // Squire editor instance

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

        // Initialize Squire editor
        const editorContainer = document.getElementById('documentTextarea');
        if (editorContainer && typeof Squire !== 'undefined') {
            this.squireEditor = new Squire(editorContainer);
            console.log('Squire editor initialized');
        } else {
            console.error('Failed to initialize Squire: container or Squire library not found');
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
        UI.elements.documentSyncBtn?.addEventListener('click', () => {
            if (this.currentDocumentId && typeof GDrive !== 'undefined') {
                GDrive.pullFromDrive(this.currentDocumentId);
            }
        });

        UI.elements.closeDocumentBtn?.addEventListener('click', () => {
            this.closeEditor();
        });

        // Open in Drive button
        UI.elements.openInDriveBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openInGoogleDrive();
        });

        // Document title saving
        UI.elements.documentTitle?.addEventListener('input', () => {
            this.saveDocumentTitleImmediate();
        });
        UI.elements.documentTitle?.addEventListener('blur', () => {
            this.saveDocumentTitle();
        });

        // Document content auto-save and history tracking
        // Use Squire's input event
        if (this.squireEditor) {
            this.squireEditor.addEventListener('input', () => {
                this.scheduleAutoSave();
                this.scheduleHistoryCapture();
            });
        }

        // Markdown toolbar button events
        this.bindMarkdownEvents();

        // Markdown keyboard shortcuts
        this.bindMarkdownShortcuts();

        // Smart copy/paste functionality
        this.bindSmartCopyPaste();

        // Google Drive buttons
        UI.elements.saveToDriveBtn?.addEventListener('click', () => {
            if (this.currentDocumentId) {
                this.saveToDrive(this.currentDocumentId);
            }
        });

        UI.elements.importFromDriveBtn?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent section collapse
            if (typeof GDrive !== 'undefined') {
                GDrive.importFromGoogleDrive();
            }
        });

        // Clean meta tags from pasted content
        UI.elements.documentTextarea?.addEventListener('paste', (e) => {
            const html = e.clipboardData?.getData('text/html');
            if (html && html.includes('<meta')) {
                e.preventDefault();
                const cleaned = html.replace(/<meta[^>]*>/gi, '');
                document.execCommand('insertHTML', false, cleaned);
            }
        });
    },

    // Create a new document
    createNew() {
        this.currentDocumentId = Storage.generateDocumentId();
        const newDocument = {
            id: this.currentDocumentId,
            title: 'New Document.html',
            content: '<p>New Document</p><p><br></p>',
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

        // Load content into Squire editor
        if (this.squireEditor) {
            this.squireEditor.setHTML(document.content || '');
        }

        // Show document editor
        UI.elements.documentEditor.classList.add('active');

        // Update active state in sidebar
        this.updateActiveDocumentInSidebar(documentId);

        // Initialize undo/redo for this document
        this.initializeHistory(documentId);

        // Focus the editor
        if (this.squireEditor) {
            this.squireEditor.focus();
        }

        // Refresh copy-to-document buttons in chat
        if (typeof UI !== 'undefined' && UI.refreshCopyToDocumentButtons) {
            UI.refreshCopyToDocumentButtons();
        }

        // Auto-enable Doc Context when document opens
        if (typeof Tools !== 'undefined' && Tools.setDocContext) {
            Tools.setDocContext(true);
        }

        // Update Drive icon visibility
        this.updateDriveIconVisibility();

        // Auto-pull from Drive if document is linked (similar to auto-save on close)
        if (document.driveFileId && typeof GDrive !== 'undefined' && GDrive.isConnected && !this.isPulling) {
            this.isPulling = true;
            GDrive.pullFromDrive(documentId).finally(() => {
                this.isPulling = false;
            });
        }
    },

    // Close the document editor
    closeEditor() {
        // Check if review mode is active and exit it (rejecting all changes)
        if (typeof ClaudeChanges !== 'undefined' && ClaudeChanges.isInReviewMode()) {
            ClaudeChanges.exitReviewMode(true); // true = revert all pending changes
        }

        // Save current document before closing
        if (this.currentDocumentId) {
            this.saveCurrentDocument();

            // Save to Google Drive if document is linked
            const doc = this.documents[this.currentDocumentId];
            if (doc && doc.driveFileId && typeof GDrive !== 'undefined' && GDrive.isConnected) {
                GDrive.saveToGoogleDrive(this.currentDocumentId);
            }
        }

        // Clear last open document
        Storage.saveLastOpenDocumentId(null);

        UI.elements.documentEditor.classList.remove('active');
        this.currentDocumentId = null;

        // Clear active state in sidebar
        this.updateActiveDocumentInSidebar(null);

        // Auto-disable Doc Context when document closes
        if (typeof Tools !== 'undefined' && Tools.setDocContext) {
            Tools.setDocContext(false);
        }

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
        if (document && this.squireEditor) {
            document.content = this.squireEditor.getHTML();
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

    // Save document to Google Drive
    async saveToDrive(documentId) {
        if (typeof GDrive === 'undefined' || !GDrive.isConnected) {
            const proceed = confirm('Google Drive is not connected. Would you like to enable Drive access now?');
            if (proceed && typeof GDrive !== 'undefined') {
                GDrive.reconnect();
            }
            return;
        }

        const result = await GDrive.saveToGoogleDrive(documentId);
        if (result.success) {
            this.renderDocumentList(); // Refresh to show sync status
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
        if (this.squireEditor) {
            this.squireEditor.bold();
            this.scheduleAutoSave();
        }
    },

    formatItalic() {
        if (this.squireEditor) {
            this.squireEditor.italic();
            this.scheduleAutoSave();
        }
    },

    formatUnderline() {
        if (this.squireEditor) {
            this.squireEditor.underline();
            this.scheduleAutoSave();
        }
    },

    formatStrikethrough() {
        if (this.squireEditor) {
            this.squireEditor.strikethrough();
            this.scheduleAutoSave();
        }
    },

    formatList() {
        if (this.squireEditor) {
            this.squireEditor.makeUnorderedList();
            this.scheduleAutoSave();
        }
    },

    formatOrderedList() {
        if (this.squireEditor) {
            this.squireEditor.makeOrderedList();
            this.scheduleAutoSave();
        }
    },



    // Bind markdown toolbar button events
    bindMarkdownEvents() {
        const buttons = [
            { id: 'undoBtn', handler: () => this.undo() },
            { id: 'redoBtn', handler: () => this.redo() },
            { id: 'boldBtn', handler: () => this.formatBold() },
            { id: 'italicBtn', handler: () => this.formatItalic() },
            { id: 'underlineBtn', handler: () => this.formatUnderline() },
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
                    case 'u':
                        e.preventDefault();
                        e.stopPropagation();
                        this.formatUnderline();
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

        // Initialize Claude Changes review mode FIRST (captures clean HTML before wrappers)
        ClaudeChanges.init(this.currentDocumentId, changes);

        // Then render the changes in the document with visual highlights
        this.renderChangesInDocument(changes);

        // Show the review panel
        if (UI.elements.documentChangeReview) {
            UI.elements.documentChangeReview.style.display = 'block';
        }

        // Focus on the first change
        ClaudeChanges.focusCurrentChange();

        // Focus review panel for immediate keyboard navigation
        setTimeout(() => {
            if (UI.elements.documentChangeReview) {
                UI.elements.documentChangeReview.focus();
            }
        }, 100);
    },

    /**
     * Render changes in the document with visual highlighting
     */
    renderChangesInDocument(changes) {
        const editor = UI.elements.documentTextarea;
        if (!editor) return;

        // Clean up any existing change numbers before rendering new ones
        document.querySelectorAll('.claude-change-number').forEach(el => el.remove());

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
                    // Cache content signature (not DOM reference) for reconstruction
                    change._cachedSignature = {
                        textContent: originalNode.textContent?.trim() || '',
                        tagName: originalNode.tagName?.toLowerCase() || '',
                        innerHTML: originalNode.innerHTML || '',
                        outerHTML: originalNode.outerHTML || ''
                    };
                    originalNode.replaceWith(changeElement);
                } else {
                    // DELETE: Don't render preview if content not found
                    // This prevents confusing duplicates when content can't be located
                    console.warn('❌ DELETE preview: Could not locate content, no signature cached');
                    console.warn('Change', change.id, 'will not be previewed in document');
                    // User can still review and accept/reject via sidebar
                    change._cachedSignature = null;
                }
            } else if (change.type === 'add') {
                // Wrap new content in green highlight
                changeElement.className = 'claude-change-add';
                changeElement.innerHTML = change.newContent || '';

                // Insert at appropriate position using content anchoring
                if (change.insertAfter) {
                    const anchorNode = this.findNodeByContent(tempDiv, change.insertAfter);
                    if (anchorNode) {
                        // Cache anchor signature for reconstruction
                        change._cachedSignature = {
                            textContent: anchorNode.textContent?.trim() || '',
                            tagName: anchorNode.tagName?.toLowerCase() || '',
                            innerHTML: anchorNode.innerHTML || '',
                            outerHTML: anchorNode.outerHTML || '',
                            anchorType: 'insertAfter'
                        };
                        anchorNode.after(changeElement);
                    } else {
                        change._cachedSignature = null;
                        tempDiv.appendChild(changeElement);
                    }
                } else if (change.insertBefore) {
                    const anchorNode = this.findNodeByContent(tempDiv, change.insertBefore);
                    if (anchorNode) {
                        // Cache anchor signature for reconstruction
                        change._cachedSignature = {
                            textContent: anchorNode.textContent?.trim() || '',
                            tagName: anchorNode.tagName?.toLowerCase() || '',
                            innerHTML: anchorNode.innerHTML || '',
                            outerHTML: anchorNode.outerHTML || '',
                            anchorType: 'insertBefore'
                        };
                        anchorNode.before(changeElement);
                    } else {
                        console.warn('❌ ADD preview: Could not find insertBefore anchor:', change.insertBefore);
                        change._cachedSignature = null;
                        tempDiv.appendChild(changeElement);
                    }
                } else {
                    // No anchor specified, append to end
                    console.warn(`⚠️ ADD preview: NO ANCHOR specified (insertBefore/insertAfter both missing) - appending to END`);
                    change._cachedSignature = null;
                    tempDiv.appendChild(changeElement);
                }
            } else if (change.type === 'modify') {
                // Show both old (strikethrough) and new (highlighted)
                changeElement.className = 'claude-change-modify';
                changeElement.innerHTML = change.newContent || '';

                // Try to find and replace the original content
                const originalNode = this.findNodeByContent(tempDiv, change.originalContent);
                if (originalNode) {
                    // Cache content signature for reconstruction
                    change._cachedSignature = {
                        textContent: originalNode.textContent?.trim() || '',
                        tagName: originalNode.tagName?.toLowerCase() || '',
                        innerHTML: originalNode.innerHTML || '',
                        outerHTML: originalNode.outerHTML || ''
                    };
                    originalNode.replaceWith(changeElement);
                } else {
                    // If can't find exact match, append to end
                    console.warn('❌ MODIFY preview: Could not locate content, no signature cached');
                    change._cachedSignature = null;
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
        // Use DOM manipulation instead of innerHTML to preserve node references
        while (editor.firstChild) {
            editor.removeChild(editor.firstChild);
        }
        while (tempDiv.firstChild) {
            editor.appendChild(tempDiv.firstChild);
        }
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

            // Strategy 1: Normalized innerHTML match (handles whitespace)
            if (this.normalizeHTML(node.innerHTML) === normalizedContent) {
                return node;
            }

            // Strategy 2: Normalized outerHTML match (handles whitespace + attributes)
            if (this.normalizeHTML(node.outerHTML) === normalizedContent) {
                return node;
            }

            // Strategy 3: Normalized match with attributes stripped (handles attribute differences)
            const normalizedContentNoAttrs = this.normalizeHTML(content, true);
            if (this.normalizeHTML(node.outerHTML, true) === normalizedContentNoAttrs) {
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

        // Strategy 4: Text-content matching (ignores inner formatting)
        // Only use if previous strategies failed, and only if match is unique
        if (!result) {
            const searchText = this.extractTextContent(content);
            const searchTag = this.extractOuterTag(content);

            if (searchText && searchTag && searchText.length > 10) { // Minimum length for safety
                // Find all nodes with same outer tag and matching text content
                const candidates = [];
                const searchNodes = (node) => {
                    if (node.nodeType === 1 && node.tagName.toLowerCase() === searchTag) {
                        const nodeText = this.extractTextContent(node.outerHTML);
                        if (nodeText === searchText) {
                            candidates.push(node);
                        }
                    }
                    for (let child of node.children) {
                        searchNodes(child);
                    }
                };

                searchNodes(container);

                if (candidates.length === 1) {
                    return candidates[0];
                }
                // If multiple candidates, too ambiguous - fall through to return null
            }
        }

        if (!result) {
            console.warn('Could not find anchor content:', content);
            console.warn('Normalized search term:', normalizedContent);
        }

        return result;
    },

    /**
     * Extract just the text content from HTML, removing all tags
     */
    extractTextContent(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
    },

    /**
     * Extract the outer tag name from HTML string
     */
    extractOuterTag(html) {
        if (!html) return null;
        const match = html.match(/^<(\w+)/);
        return match ? match[1].toLowerCase() : null;
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

        // Parse each <change> element - handle attributes that contain HTML with > inside quotes
        // Pattern: match chars except > or ", OR match quoted strings (which can contain >)
        const changeRegex = /<change\s+((?:[^>"]|"[^"]*")*?)>(.*?)<\/change>/gs;
        let match;

        while ((match = changeRegex.exec(editXML)) !== null) {
            const [, attributeString, content] = match;

            // Extract attributes independently (order-agnostic)
            // Type is simple (no nested quotes)
            const type = attributeString.match(/type="([^"]+)"/)?.[1];

            // For insertAfter/insertBefore, handle nested quotes in HTML content
            // Use positive lookahead to check for space, >, or end-of-string after closing quote
            const insertAfterMatch = attributeString.match(/insertAfter="(.*?)"(?=\s|>|$)/s);
            const insertBeforeMatch = attributeString.match(/insertBefore="(.*?)"(?=\s|>|$)/s);

            const insertAfter = insertAfterMatch ? insertAfterMatch[1] : undefined;
            const insertBefore = insertBeforeMatch ? insertBeforeMatch[1] : undefined;

            const originalMatch = content.match(/<original>(.*?)<\/original>/s);
            const newMatch = content.match(/<new>(.*?)<\/new>/s);

            const change = {
                id: Storage.generateChangeId(),
                type: type,
                insertAfter: insertAfter || undefined,
                insertBefore: insertBefore || undefined,
                originalContent: originalMatch ? originalMatch[1].trim() : null,
                newContent: newMatch ? newMatch[1].trim() : null,
                status: 'pending'
            };

            changes.push(change);
        }

        return changes.length > 0 ? changes : null;
    },

    /**
     * Check if currently in edit review mode
     */
    isInEditReviewMode() {
        return ClaudeChanges && ClaudeChanges.isInReviewMode();
    },

    /**
     * Update visibility of Drive icon button based on whether current document has driveFileId
     */
    updateDriveIconVisibility() {
        const openInDriveBtn = UI.elements.openInDriveBtn;
        if (!openInDriveBtn) return;

        const doc = this.documents[this.currentDocumentId];
        if (doc && doc.driveFileId) {
            openInDriveBtn.style.display = 'inline-block';
            // Update href with actual Drive file ID
            openInDriveBtn.href = `https://docs.google.com/document/d/${doc.driveFileId}/edit`;
        } else {
            openInDriveBtn.style.display = 'none';
        }
    },

    /**
     * Open current document in Google Drive in a new tab
     */
    openInGoogleDrive() {
        const doc = this.documents[this.currentDocumentId];
        if (!doc || !doc.driveFileId) {
            alert('This document is not linked to Google Drive. Save it to Drive first.');
            return;
        }

        const driveUrl = `https://docs.google.com/document/d/${doc.driveFileId}/edit`;
        window.open(driveUrl, '_blank');
    },

};