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
    squireEditor: null, // Squire editor instance

    // Undo/redo state
    undoStacks: {}, // Per document undo stacks
    redoStacks: {}, // Per document redo stacks
    maxHistorySize: 50,
    inputTimeout: null,
    lastSavedState: null,

    // Loading state to prevent premature font detection
    _loadingDocument: false,

    // Normalization cache for O(1) repeated lookups
    // Prevents redundant regex operations during batch change processing
    _normalizedCache: new Map(),
    _normalizedCacheMaxSize: 2000,

    // Default formatting for new documents
    DEFAULT_FORMATTING: {
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '11pt',
        lineHeight: '1.15'
    },

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
            this.squireEditor = new Squire(editorContainer, {
                blockTag: 'P',
                blockAttributes: {
                    style: `padding:0;margin:0;color:#000000;font-size:${this.DEFAULT_FORMATTING.fontSize};font-family:${this.DEFAULT_FORMATTING.fontFamily};line-height:${this.DEFAULT_FORMATTING.lineHeight};text-align:left`
                }
            });
            console.log('Squire editor initialized');

            // Disable Squire's built-in Tab handlers so our custom ones work everywhere
            this.squireEditor.setKeyHandler('Tab', null);
            this.squireEditor.setKeyHandler('Shift-Tab', null);

            // Disable Squire's built-in formatting handlers to prevent conflicts
            this.squireEditor.setKeyHandler('Ctrl-b', null);
            this.squireEditor.setKeyHandler('Meta-b', null);
            this.squireEditor.setKeyHandler('Ctrl-i', null);
            this.squireEditor.setKeyHandler('Meta-i', null);
            this.squireEditor.setKeyHandler('Ctrl-u', null);
            this.squireEditor.setKeyHandler('Meta-u', null);

            // Bind pathChange event to update font size and family display
            this.squireEditor.addEventListener('pathChange', () => {
                this.updateFontSizeDisplay();
                this.updateFontFamilyDisplay();
                this.updateToolbarButtonStates();
                this.updateFormatDisplay();
            });

            // Also update on selection change
            this.squireEditor.addEventListener('select', () => {
                this.updateFontSizeDisplay();
                this.updateFontFamilyDisplay();
                this.updateToolbarButtonStates();
                this.updateFormatDisplay();
            });
        } else {
            console.error('Failed to initialize Squire: container or Squire library not found');
        }

        this.documents = Storage.getDocuments();
        this.bindEvents();
        this.renderDocumentList();

        // Restore last open document if it exists
        this.restoreLastOpenDocument();

        // Restore auto-accept toggle state
        if (UI.elements.autoAcceptEditsToggle) {
            UI.elements.autoAcceptEditsToggle.checked = Storage.getSetting('autoAcceptEdits', false);
        }

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
            // Sync to mobile title
            if (UI.elements.mobileDocumentTitle) {
                UI.elements.mobileDocumentTitle.value = UI.elements.documentTitle.value;
            }
        });
        UI.elements.documentTitle?.addEventListener('blur', () => {
            this.saveDocumentTitle();
        });

        // Mobile document title syncing
        UI.elements.mobileDocumentTitle?.addEventListener('input', () => {
            // Sync to desktop title
            if (UI.elements.documentTitle) {
                UI.elements.documentTitle.value = UI.elements.mobileDocumentTitle.value;
            }
            this.saveDocumentTitleImmediate();
        });
        UI.elements.mobileDocumentTitle?.addEventListener('blur', () => {
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

        // Auto-accept toggle
        UI.elements.autoAcceptEditsToggle?.addEventListener('change', () => {
            const isEnabled = UI.elements.autoAcceptEditsToggle.checked;
            Storage.saveSetting('autoAcceptEdits', isEnabled);
            console.log('Auto-accept edits:', isEnabled ? 'enabled' : 'disabled');
        });

        // Squire handles paste events automatically with DOMPurify sanitization

        // Triple-click handler to select only current paragraph (fixes browser bug)
        if (this.squireEditor) {
            const editorRoot = this.squireEditor.getRoot();

            editorRoot.addEventListener('mousedown', (e) => {
                // Detect triple-click
                if (e.detail === 3) {
                    // Let browser complete the selection first, then fix it
                    setTimeout(() => {
                        try {
                            const selection = window.getSelection();
                            if (!selection.rangeCount) return;

                            // Find the block element containing the click
                            let target = e.target;
                            while (target && target !== editorRoot) {
                                const nodeName = target.nodeName;
                                // Check if this is a block-level element
                                if (/^(DIV|P|H[1-6]|LI|BLOCKQUOTE)$/.test(nodeName)) {
                                    // Helper function to find first text node recursively
                                    const getFirstTextNode = (node) => {
                                        if (node.nodeType === Node.TEXT_NODE) return node;
                                        for (let child of node.childNodes) {
                                            const textNode = getFirstTextNode(child);
                                            if (textNode) return textNode;
                                        }
                                        return null;
                                    };

                                    // Helper function to find last text node recursively
                                    const getLastTextNode = (node) => {
                                        if (node.nodeType === Node.TEXT_NODE) return node;
                                        for (let i = node.childNodes.length - 1; i >= 0; i--) {
                                            const textNode = getLastTextNode(node.childNodes[i]);
                                            if (textNode) return textNode;
                                        }
                                        return null;
                                    };

                                    // Find first and last text nodes
                                    const firstTextNode = getFirstTextNode(target);
                                    const lastTextNode = getLastTextNode(target);

                                    // Create a new range that selects text nodes, not element nodes
                                    const newRange = document.createRange();

                                    if (firstTextNode && lastTextNode) {
                                        // Select from first text node to last text node
                                        newRange.setStart(firstTextNode, 0);
                                        newRange.setEnd(lastTextNode, lastTextNode.length);
                                    } else {
                                        // Fallback to selectNodeContents if no text nodes found
                                        newRange.selectNodeContents(target);
                                    }

                                    // Replace the current selection with our constrained range
                                    selection.removeAllRanges();
                                    selection.addRange(newRange);

                                    // CRITICAL: Sync the corrected selection back to Squire
                                    this.squireEditor.setSelection(newRange);

                                    // Manually trigger font detection to read from corrected selection
                                    this.updateFontSizeDisplay();
                                    this.updateFontFamilyDisplay();
                                    this.updateToolbarButtonStates();

                                    break;
                                }
                                target = target.parentElement;
                            }
                        } catch (error) {
                            console.warn('Failed to constrain triple-click selection:', error);
                        }
                    }, 0);
                }
            });
        }
    },

    // Create a new document
    createNew() {
        this.currentDocumentId = Storage.generateDocumentId();
        const defaultStyle = `font-family: ${this.DEFAULT_FORMATTING.fontFamily}; font-size: ${this.DEFAULT_FORMATTING.fontSize}; line-height: ${this.DEFAULT_FORMATTING.lineHeight};`;
        const newDocument = {
            id: this.currentDocumentId,
            title: 'New Document.html',
            content: `<p style="${defaultStyle}">New Document</p><p style="${defaultStyle}"><br></p>`,
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
        if (UI.elements.mobileDocumentTitle) {
            UI.elements.mobileDocumentTitle.value = displayTitle;
        }

        // Load content into Squire editor
        if (this.squireEditor) {
            // Set loading flag to prevent premature font detection
            this._loadingDocument = true;

            this.squireEditor.setHTML(document.content || '');

            // Assign stable element IDs for change tracking
            if (typeof ElementIds !== 'undefined') {
                ElementIds.assignIds(this.squireEditor.getRoot());
                // Start mutation observer to assign IDs to new elements created during editing
                if (ElementIds.startObserving) {
                    ElementIds.startObserving(this.squireEditor.getRoot());
                }
            }

            // Defer cursor positioning and font detection until next event loop tick
            // This ensures Squire has finished loading content and cursor is in styled content
            setTimeout(() => {
                if (this.squireEditor) {
                    this._loadingDocument = false;
                    this.squireEditor.moveCursorToStart();

                    // Set default formatting for new content typed by user
                    // This ensures new text inherits defaults rather than browser defaults
                    this.squireEditor.setFontFace(this.DEFAULT_FORMATTING.fontFamily);
                    this.squireEditor.setFontSize(this.DEFAULT_FORMATTING.fontSize);

                    // Manually update font displays now that cursor is properly positioned
                    this.updateFontSizeDisplay();
                    this.updateFontFamilyDisplay();
                }
            }, 0);
        }

        // Show document editor
        UI.elements.documentEditor.classList.add('active');
        UI.elements.chatContainer.classList.add('document-open');

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

        // Notify Mobile module that document is open
        if (typeof Mobile !== 'undefined' && Mobile.setDocumentOpen) {
            Mobile.setDocumentOpen(true);
        }

        // Update mobile editor title
        if (typeof Mobile !== 'undefined' && Mobile.updateEditorTitle) {
            Mobile.updateEditorTitle(displayTitle);
        }
    },

    // Close the document editor
    closeEditor() {
        // Stop mutation observer for element IDs
        if (typeof ElementIds !== 'undefined' && ElementIds.stopObserving) {
            ElementIds.stopObserving();
        }

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
        UI.elements.chatContainer.classList.remove('document-open');
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

        // Notify Claude and user that document is closed
        if (typeof Chat !== 'undefined' && Chat.currentChatId) {
            Chat.addSystemMessage('📄 Document closed. Document editing is no longer available.');
        }

        // Notify Mobile module that document is closed
        if (typeof Mobile !== 'undefined' && Mobile.setDocumentOpen) {
            Mobile.setDocumentOpen(false);
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
        if (!this.currentDocumentId) {
            console.warn('saveCurrentDocument: No document open');
            return;
        }
        if (this.isSaving) {
            console.warn('saveCurrentDocument: Already saving, skipped');
            return;
        }

        this.isSaving = true;
        const document = this.documents[this.currentDocumentId];
        if (document && this.squireEditor) {
            // Ensure element IDs are assigned before saving
            if (typeof ElementIds !== 'undefined') {
                ElementIds.ensureIds(this.squireEditor.getRoot());
            }
            document.content = this.squireEditor.getHTML();
            document.lastModified = Date.now();
            Storage.saveDocuments(this.documents);
            console.log('Document saved:', this.currentDocumentId);
        } else {
            console.warn('saveCurrentDocument: Missing document or editor', {
                hasDocument: !!document,
                hasEditor: !!this.squireEditor
            });
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

            // Update mobile editor title
            if (typeof Mobile !== 'undefined' && Mobile.updateEditorTitle) {
                Mobile.updateEditorTitle(newTitle);
            }
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

            // Update mobile editor title
            if (typeof Mobile !== 'undefined' && Mobile.updateEditorTitle) {
                Mobile.updateEditorTitle(displayTitle);
            }
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

            // Add warning indicator for broken Drive links
            if (document.driveFileId && document.driveSyncStatus === 'access_denied') {
                const warningIcon = window.document.createElement('span');
                warningIcon.className = 'drive-link-warning';
                warningIcon.textContent = '⚠️';
                warningIcon.title = 'Drive access lost - click to re-link';
                warningIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof GDrive !== 'undefined') {
                        GDrive.relinkDocument(document.id);
                    }
                });
                // Insert warning icon at the beginning of the item content
                const contentDiv = documentItem.querySelector('.document-item-content');
                if (contentDiv) {
                    contentDiv.insertBefore(warningIcon, contentDiv.firstChild);
                }
            }

            // Make document draggable for chat attachment
            documentItem.draggable = true;
            documentItem.setAttribute('data-document-id', document.id);

            // Setup drag-and-drop for attachment
            this.setupDragForAttachment(documentItem, document.id);

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

    // Trigger inline edit for a document name (used by mobile long-press)
    editName(documentId) {
        const doc = this.documents[documentId];
        if (!doc) return;

        // Find the document item in the sidebar
        const docItem = document.querySelector(`.document-item[data-document-id="${documentId}"]`);
        if (!docItem) return;

        // Find the text span inside the item content
        const textSpan = docItem.querySelector('.document-item-content span');
        if (!textSpan) return;

        // Get display title (without .html extension)
        const displayTitle = doc.title.endsWith('.html') ?
            doc.title.slice(0, -5) : doc.title;

        // Trigger inline edit via Components
        if (typeof Components !== 'undefined' && Components.startInlineEdit) {
            Components.startInlineEdit(textSpan, displayTitle, (newName) => {
                this.renameDocument(documentId, newName);
            });
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
                if (UI.elements.mobileDocumentTitle) {
                    UI.elements.mobileDocumentTitle.value = displayTitle;
                }
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
        if (!this.squireEditor) return;

        this.squireEditor.focus();

        // Insert HTML or plain text based on content
        if (text.includes('<') && text.includes('>')) {
            // HTML content - insert as HTML
            this.squireEditor.insertHTML(text);
        } else {
            // Plain text
            this.squireEditor.insertPlainText(text);
        }

        // Trigger auto-save
        this.scheduleAutoSave();
    },

    wrapSelectedText(before, after = '') {
        if (!this.squireEditor) return;

        const selection = this.getEditorSelection();
        if (!selection) return;

        const selectedText = selection.text;

        if (selectedText) {
            // Wrap selected text
            const wrappedText = before + selectedText + after;
            this.squireEditor.insertHTML(wrappedText);
        } else {
            // No selection, insert template with placeholder
            const placeholder = this.getPlaceholderText(before, after);
            const wrappedText = before + placeholder + after;
            this.squireEditor.insertHTML(wrappedText);

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

        this.squireEditor.focus();
        this.scheduleAutoSave();
    },

    getPlaceholderText(before, after) {
        if (before === '**' && after === '**') return 'bold text';
        if (before === '*' && after === '*') return 'italic text';
        if (before === '~~' && after === '~~') return 'strikethrough';
        return 'text';
    },

    insertAtLineStart(prefix) {
        if (!this.squireEditor) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // For contentEditable, we'll just insert the prefix at cursor
        // This is a simplified implementation for rich text
        this.squireEditor.insertPlainText(prefix);

        this.squireEditor.focus();
        this.scheduleAutoSave();
    },

    // Rich text formatting functions
    formatBold() {
        if (this.squireEditor) {
            if (this.squireEditor.hasFormat('B')) {
                this.squireEditor.removeBold();
            } else {
                this.squireEditor.bold();
            }
            this.scheduleAutoSave();
            this.updateToolbarButtonStates();
            this.updateFormatDisplay();
        }
    },

    formatItalic() {
        if (this.squireEditor) {
            if (this.squireEditor.hasFormat('I')) {
                this.squireEditor.removeItalic();
            } else {
                this.squireEditor.italic();
            }
            this.scheduleAutoSave();
            this.updateToolbarButtonStates();
            this.updateFormatDisplay();
        }
    },

    formatUnderline() {
        if (this.squireEditor) {
            if (this.squireEditor.hasFormat('U')) {
                this.squireEditor.removeUnderline();
            } else {
                this.squireEditor.underline();
            }
            this.scheduleAutoSave();
            this.updateToolbarButtonStates();
            this.updateFormatDisplay();
        }
    },

    formatStrikethrough() {
        if (this.squireEditor) {
            if (this.squireEditor.hasFormat('S')) {
                this.squireEditor.removeStrikethrough();
            } else {
                this.squireEditor.strikethrough();
            }
            this.scheduleAutoSave();
            this.updateToolbarButtonStates();
        }
    },

    // Set text alignment for selected text
    setTextAlignment(alignment) {
        if (!this.squireEditor) return;

        if (alignment) {
            this.squireEditor.setTextAlignment(alignment);
        }

        this.scheduleAutoSave();
    },

    // Increase indentation (margin-based for visual indent)
    formatIndent() {
        if (!this.squireEditor) return;

        const path = this.squireEditor.getPath();

        // For lists, use Squire's list level methods
        if (/(?:^|>)[OU]L/.test(path)) {
            this.squireEditor.increaseListLevel();
        } else {
            // Progressive indentation: first-line → full paragraph
            this.squireEditor.modifyBlocks((frag) => {
                const blocks = frag.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
                blocks.forEach(block => {
                    const currentTextIndent = parseInt(block.style.textIndent || '0');
                    const currentMargin = parseInt(block.style.marginLeft || '0');

                    if (currentTextIndent === 0 && currentMargin === 0) {
                        // First Tab: First-line indent
                        block.style.textIndent = '40px';
                    } else if (currentTextIndent > 0) {
                        // Second Tab: Convert to full paragraph indent
                        block.style.textIndent = '';
                        block.style.marginLeft = '40px';
                    } else {
                        // Third+ Tab: Increase margin
                        block.style.marginLeft = (currentMargin + 40) + 'px';
                    }
                });
                return frag;
            });
        }

        this.scheduleAutoSave();
        this.squireEditor.focus();
    },

    // Decrease indentation (margin-based for visual outdent)
    formatOutdent() {
        if (!this.squireEditor) return;

        const path = this.squireEditor.getPath();

        // For lists, use Squire's list level methods
        if (/(?:^|>)[OU]L/.test(path)) {
            this.squireEditor.decreaseListLevel();
        } else {
            // Progressive outdent: margin → text-indent → none
            this.squireEditor.modifyBlocks((frag) => {
                const blocks = frag.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
                blocks.forEach(block => {
                    const currentTextIndent = parseInt(block.style.textIndent || '0');
                    const currentMargin = parseInt(block.style.marginLeft || '0');

                    if (currentMargin > 0) {
                        // Remove margin first
                        const newMargin = Math.max(0, currentMargin - 40);
                        if (newMargin === 0) {
                            block.style.marginLeft = '';
                        } else {
                            block.style.marginLeft = newMargin + 'px';
                        }
                    } else if (currentTextIndent > 0) {
                        // Then remove text-indent
                        block.style.textIndent = '';
                    }
                });
                return frag;
            });
        }

        this.scheduleAutoSave();
        this.squireEditor.focus();
    },

    formatList() {
        if (this.squireEditor) {
            if (this.squireEditor.hasFormat('UL')) {
                this.squireEditor.removeList();
            } else {
                this.squireEditor.makeUnorderedList();
            }
            this.scheduleAutoSave();
            this.updateToolbarButtonStates();
        }
    },

    formatOrderedList() {
        if (this.squireEditor) {
            if (this.squireEditor.hasFormat('OL')) {
                this.squireEditor.removeList();
            } else {
                this.squireEditor.makeOrderedList();
            }
            this.scheduleAutoSave();
            this.updateToolbarButtonStates();
        }
    },

    // Convert block between paragraph and heading formats
    setFormat(format) {
        if (!this.squireEditor) return;

        // Validate format value
        if (!['p', 't', 'h1', 'h2', 'h3'].includes(format)) {
            console.warn('Invalid format:', format);
            return;
        }

        // Save undo state before format changes
        this.squireEditor.saveUndoState();

        try {
            // Use modifyBlocks to change tag names
            this.squireEditor.modifyBlocks((fragment) => {
                // Find all block elements in the fragment
                const blocks = fragment.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');

                blocks.forEach((block) => {
                    // Create new element with target tag
                    // Title ('t') uses H1 tag but with different font-size
                    const tagName = format === 't' ? 'H1' : format.toUpperCase();
                    const newElement = document.createElement(tagName);

                    // Copy all attributes (preserve styles, classes, etc.)
                    Array.from(block.attributes).forEach(attr => {
                        newElement.setAttribute(attr.name, attr.value);
                    });

                    // Move all child nodes
                    while (block.firstChild) {
                        newElement.appendChild(block.firstChild);
                    }

                    // Replace old element with new one
                    block.parentNode.replaceChild(newElement, block);

                    // Apply formatting from HeaderFormats config
                    if (typeof HeaderFormats !== 'undefined' && HeaderFormats[format]) {
                        const formatConfig = HeaderFormats[format];
                        let content = newElement.innerHTML;

                        // 1. Strip block-level font styles (will be reapplied from config)
                        newElement.style.fontSize = '';
                        newElement.style.fontFamily = '';

                        // 2. Clean inner span styles
                        newElement.querySelectorAll('span[style]').forEach(span => {
                            // Remove font-size and font-family
                            if (span.style.fontSize) span.style.fontSize = '';
                            if (span.style.fontFamily) span.style.fontFamily = '';

                            // Keep other formatting (bold, italic, color, background, etc.)
                            const remainingStyle = span.getAttribute('style');
                            if (!remainingStyle || !remainingStyle.trim()) {
                                span.removeAttribute('style');
                            }

                            // Unwrap empty spans
                            if (span.attributes.length === 0 && span.parentNode) {
                                while (span.firstChild) {
                                    span.parentNode.insertBefore(span.firstChild, span);
                                }
                                span.remove();
                            }
                        });

                        // 3. Apply config-defined formatting (only for headers, not paragraphs)
                        if (format !== 'p') {
                            // Apply font size
                            if (formatConfig.fontSize) {
                                newElement.style.fontSize = formatConfig.fontSize;
                            }

                            // Wrap content in semantic tags if configured
                            if (formatConfig.bold && !newElement.querySelector('b')) {
                                content = `<b>${content}</b>`;
                            }
                            if (formatConfig.italic && !newElement.querySelector('i')) {
                                content = `<i>${content}</i>`;
                            }
                            if (formatConfig.underline && !newElement.querySelector('u')) {
                                content = `<u>${content}</u>`;
                            }

                            newElement.innerHTML = content;
                        }
                    }
                });

                return fragment;
            });

            // Focus editor and update UI
            this.squireEditor.focus();

            // Update toolbar displays after DOM settles
            setTimeout(() => {
                this.updateFormatDisplay();
                this.updateFontSizeDisplay();
                this.updateToolbarButtonStates();
            }, 0);

            // Save changes
            this.scheduleAutoSave();
        } catch (error) {
            console.error('Failed to set format:', error);
        }
    },

    // Set font size for selected text
    setFontSize(size) {
        if (!this.squireEditor) return;

        const sizeValue = size ? size + 'pt' : null;

        if (sizeValue) {
            this.squireEditor.setFontSize(sizeValue);
        } else {
            this.squireEditor.setFontSize(null);
        }

        this.scheduleAutoSave();
    },

    // Set font family for selected text
    setFontFamily(family) {
        if (!this.squireEditor) return;

        if (family) {
            this.squireEditor.setFontFace(family);
        } else {
            this.squireEditor.setFontFace(null);
        }

        this.scheduleAutoSave();
    },

    // Set line spacing for selected blocks
    setLineSpacing(lineHeight) {
        if (!this.squireEditor) return;

        this.squireEditor.forEachBlock((block) => {
            if (lineHeight) {
                block.style.lineHeight = lineHeight;
            } else {
                block.style.lineHeight = '';
            }
        }, true);

        this.scheduleAutoSave();
        this.squireEditor.focus();
        this.updateSpacingCheckmarks();
    },

    // Toggle paragraph spacing before (margin-top) - Google Docs style
    toggleParagraphSpacingBefore() {
        if (!this.squireEditor) return;

        this.squireEditor.forEachBlock((block) => {
            // Skip list items to avoid double-spacing issues
            if (block.nodeName === 'LI') return;

            const currentMargin = block.style.marginTop;
            if (currentMargin && currentMargin !== '0px' && currentMargin !== '0pt') {
                // Remove spacing
                block.style.marginTop = '';
            } else {
                // Add 12pt spacing (Google Docs standard)
                block.style.marginTop = '12pt';
            }
        }, true);

        this.scheduleAutoSave();
        this.squireEditor.focus();
        this.updateSpacingCheckmarks();
    },

    // Toggle paragraph spacing after (margin-bottom) - Google Docs style
    toggleParagraphSpacingAfter() {
        if (!this.squireEditor) return;

        this.squireEditor.forEachBlock((block) => {
            // Skip list items to avoid double-spacing issues
            if (block.nodeName === 'LI') return;

            const currentMargin = block.style.marginBottom;
            if (currentMargin && currentMargin !== '0px' && currentMargin !== '0pt') {
                // Remove spacing
                block.style.marginBottom = '';
            } else {
                // Add 12pt spacing (Google Docs standard)
                block.style.marginBottom = '12pt';
            }
        }, true);

        this.scheduleAutoSave();
        this.squireEditor.focus();
        this.updateSpacingCheckmarks();
    },

    // Update spacing dropdown checkmarks based on current selection
    updateSpacingCheckmarks() {
        if (!this.squireEditor) return;

        try {
            const selection = this.squireEditor.getSelection();
            let node = selection.startContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentNode;
            }

            // Find the block element
            while (node && node !== this.squireEditor.getRoot()) {
                if (node.nodeType === Node.ELEMENT_NODE && /^(P|DIV|H[1-6]|LI)$/.test(node.nodeName)) {
                    break;
                }
                node = node.parentNode;
            }

            if (!node || node === this.squireEditor.getRoot()) return;

            // Get current line-height
            const lineHeight = node.style.lineHeight || window.getComputedStyle(node).lineHeight;
            let lineHeightValue = lineHeight;
            // Convert px to unitless if needed
            if (lineHeight.includes('px')) {
                const fontSize = parseFloat(window.getComputedStyle(node).fontSize);
                const lineHeightPx = parseFloat(lineHeight);
                lineHeightValue = (lineHeightPx / fontSize).toFixed(2);
            }

            // Get current margins (check inline style first, then computed)
            const marginTop = node.style.marginTop || window.getComputedStyle(node).marginTop;
            const marginBottom = node.style.marginBottom || window.getComputedStyle(node).marginBottom;
            const hasSpaceBefore = marginTop && marginTop !== '0px' && marginTop !== '0pt' && parseFloat(marginTop) > 0;
            const hasSpaceAfter = marginBottom && marginBottom !== '0px' && marginBottom !== '0pt' && parseFloat(marginBottom) > 0;

            // Update checkmarks
            document.querySelectorAll('.spacing-menu-item').forEach(item => {
                const action = item.getAttribute('data-action');
                const value = item.getAttribute('data-value');
                const checkmark = item.querySelector('.checkmark');

                if (action === 'line-spacing') {
                    if (Math.abs(parseFloat(lineHeightValue) - parseFloat(value)) < 0.1) {
                        checkmark.style.visibility = 'visible';
                    } else {
                        checkmark.style.visibility = 'hidden';
                    }
                } else if (action === 'space-before') {
                    checkmark.style.visibility = hasSpaceBefore ? 'visible' : 'hidden';
                } else if (action === 'space-after') {
                    checkmark.style.visibility = hasSpaceAfter ? 'visible' : 'hidden';
                }
            });
        } catch (error) {
            console.warn('Failed to update spacing checkmarks:', error);
        }
    },

    // Update font size display based on cursor position or selection
    updateFontSizeDisplay() {
        // Skip font detection while document is loading
        if (this._loadingDocument) return;

        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (!fontSizeSelect || !this.squireEditor) return;

        try {
            const selection = this.squireEditor.getSelection();
            let fontSize = null;

            // First check if we're in a header block with direct styling
            let node = selection.startContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentNode;
            }

            // Traverse up to find block-level font-size or header
            while (node && node !== this.squireEditor.getRoot()) {
                // Check if this is a header with block-level font-size
                if (/^H[1-6]$/.test(node.nodeName) && node.style && node.style.fontSize) {
                    fontSize = node.style.fontSize;
                    break;
                }
                // Check for inline font-size style
                if (node.style && node.style.fontSize) {
                    fontSize = node.style.fontSize;
                    break;
                }
                node = node.parentNode;
            }

            // Fallback: use getFontInfo or computed style
            if (!fontSize) {
                // Try getFontInfo first (faster for inline styles)
                const fontInfo = this.squireEditor.getFontInfo();
                fontSize = fontInfo?.fontSize;

                // If still no fontSize, check computed style (works for CSS defaults)
                if (!fontSize) {
                    const startElement = selection.startContainer.nodeType === Node.TEXT_NODE
                        ? selection.startContainer.parentElement
                        : selection.startContainer;

                    if (startElement) {
                        const computedStyle = window.getComputedStyle(startElement);
                        fontSize = computedStyle.fontSize;
                    }
                }
            }

            if (fontSize) {
                // Extract numeric value and unit from fontSize (e.g., "16px" or "12pt")
                const sizeMatch = fontSize.match(/(\d+(?:\.\d+)?)(px|pt)?/);
                if (sizeMatch) {
                    let sizeValue = parseFloat(sizeMatch[1]);
                    const unit = sizeMatch[2];

                    // Convert pixels to points if needed (px * 0.75 = pt)
                    if (unit === 'px') {
                        sizeValue = Math.round(sizeValue * 0.75);
                    }

                    fontSizeSelect.value = sizeValue.toString();
                } else {
                    fontSizeSelect.value = '';
                }
            } else {
                fontSizeSelect.value = '';
            }
        } catch (error) {
            console.warn('Failed to get font info:', error);
            fontSizeSelect.value = '';
        }
    },

    // Update font family display based on cursor position or selection
    updateFontFamilyDisplay() {
        // Skip font detection while document is loading
        if (this._loadingDocument) return;

        const fontFamilySelect = document.getElementById('fontFamilySelect');
        if (!fontFamilySelect || !this.squireEditor) return;

        try {
            const selection = this.squireEditor.getSelection();
            let fontFamily = null;

            // First check if we're in a header block with direct styling
            let node = selection.startContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentNode;
            }

            // Traverse up to find block-level font-family or header
            while (node && node !== this.squireEditor.getRoot()) {
                // Check if this is a header with block-level font-family
                if (/^H[1-6]$/.test(node.nodeName) && node.style && node.style.fontFamily) {
                    fontFamily = node.style.fontFamily;
                    break;
                }
                // Check for inline font-family style
                if (node.style && node.style.fontFamily) {
                    fontFamily = node.style.fontFamily;
                    break;
                }
                node = node.parentNode;
            }

            // Fallback: use getFontInfo or computed style
            if (!fontFamily) {
                // Try getFontInfo first (faster for inline styles)
                const fontInfo = this.squireEditor.getFontInfo();
                fontFamily = fontInfo?.fontFamily;

                // If still no fontFamily, check computed style (works for CSS defaults)
                if (!fontFamily) {
                    const startElement = selection.startContainer.nodeType === Node.TEXT_NODE
                        ? selection.startContainer.parentElement
                        : selection.startContainer;

                    if (startElement) {
                        const computedStyle = window.getComputedStyle(startElement);
                        fontFamily = computedStyle.fontFamily;
                    }
                }
            }

            if (fontFamily) {
                // Extract family name from string (e.g., '"Arial", sans-serif' -> 'Arial')
                const familyName = fontFamily.split(',')[0].replace(/['"]/g, '').trim();

                // Normalize Google Docs font names to match dropdown options
                // Google Docs converts "Times New Roman" to "Times", "Courier New" to "Courier", etc.
                const fontMapping = {
                    'Times': 'Times New Roman',
                    'times': 'Times New Roman',
                    'Times New Roman': 'Times New Roman',
                    'Courier': 'Courier New',
                    'courier': 'Courier New',
                    'Courier New': 'Courier New',
                    'Arial': 'Arial',
                    'arial': 'Arial',
                    'Georgia': 'Georgia',
                    'georgia': 'Georgia',
                    'Verdana': 'Verdana',
                    'verdana': 'Verdana'
                };

                const normalizedFont = fontMapping[familyName] || familyName;
                fontFamilySelect.value = normalizedFont;
            } else {
                fontFamilySelect.value = '';
            }
        } catch (error) {
            console.warn('Failed to get font family info:', error);
            fontFamilySelect.value = '';
        }
    },

    // Update format dropdown to show current block type
    updateFormatDisplay() {
        // Skip updates during document loading
        if (this._loadingDocument) return;

        const formatSelect = document.getElementById('formatSelect');
        if (!formatSelect || !this.squireEditor) return;

        try {
            const path = this.squireEditor.getPath();

            // Find first block-level element in path
            // getPath() returns "BODY>DIV>P>STRONG" - must find block, not inline element
            const pathSegments = path.split('>');
            const blockTypes = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'LI'];
            const currentBlock = pathSegments.find(seg => blockTypes.includes(seg)) || 'P';

            if (currentBlock === 'H1') {
                // Check font-size to distinguish Title (20pt) vs H1 (16pt)
                const selection = this.squireEditor.getSelection();
                const block = selection?.startContainer?.nodeType === Node.ELEMENT_NODE
                    ? selection.startContainer.closest('h1')
                    : selection?.startContainer?.parentElement?.closest('h1');
                const fontSize = block?.style?.fontSize;
                if (fontSize === '20pt') {
                    formatSelect.value = 't';
                } else {
                    formatSelect.value = 'h1';
                }
            } else if (currentBlock === 'H2') {
                formatSelect.value = 'h2';
            } else if (currentBlock === 'H3') {
                formatSelect.value = 'h3';
            } else {
                formatSelect.value = 'p';
            }
        } catch (error) {
            console.warn('Failed to detect format:', error);
            formatSelect.value = 'p';
        }
    },

    // Update toolbar button states based on current cursor formatting
    updateToolbarButtonStates() {
        // Skip during document loading
        if (this._loadingDocument || !this.squireEditor) return;

        try {
            // Get references to toolbar buttons
            const boldBtn = document.getElementById('boldBtn');
            const italicBtn = document.getElementById('italicBtn');
            const underlineBtn = document.getElementById('underlineBtn');
            const strikeBtn = document.getElementById('strikeBtn');
            const listBtn = document.getElementById('listBtn');
            const orderedListBtn = document.getElementById('orderedListBtn');

            // Check inline formatting using hasFormat()
            if (boldBtn) {
                if (this.squireEditor.hasFormat('B')) {
                    boldBtn.classList.add('format-active');
                } else {
                    boldBtn.classList.remove('format-active');
                }
            }

            if (italicBtn) {
                if (this.squireEditor.hasFormat('I')) {
                    italicBtn.classList.add('format-active');
                } else {
                    italicBtn.classList.remove('format-active');
                }
            }

            if (underlineBtn) {
                if (this.squireEditor.hasFormat('U')) {
                    underlineBtn.classList.add('format-active');
                } else {
                    underlineBtn.classList.remove('format-active');
                }
            }

            if (strikeBtn) {
                if (this.squireEditor.hasFormat('S')) {
                    strikeBtn.classList.add('format-active');
                } else {
                    strikeBtn.classList.remove('format-active');
                }
            }

            // Check block-level formatting using getPath()
            const path = this.squireEditor.getPath();

            if (listBtn) {
                if (path.includes('UL')) {
                    listBtn.classList.add('format-active');
                } else {
                    listBtn.classList.remove('format-active');
                }
            }

            if (orderedListBtn) {
                if (path.includes('OL')) {
                    orderedListBtn.classList.add('format-active');
                } else {
                    orderedListBtn.classList.remove('format-active');
                }
            }
        } catch (error) {
            console.warn('Failed to update toolbar button states:', error);
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
            { id: 'strikeBtn', handler: () => this.formatStrikethrough() },
            { id: 'indentBtn', handler: () => this.formatIndent() },
            { id: 'outdentBtn', handler: () => this.formatOutdent() }
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

        // Bind font size dropdown
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) {
            // Store selection when opening dropdown
            let savedSelection = null;

            // Save selection on mousedown (before focus is lost)
            fontSizeSelect.addEventListener('mousedown', (e) => {
                if (this.squireEditor) {
                    try {
                        savedSelection = this.squireEditor.getSelection();
                    } catch (error) {
                        console.warn('Failed to save selection:', error);
                    }
                }
            });

            // Handle change event (when user selects a size)
            fontSizeSelect.addEventListener('change', (e) => {
                const size = e.target.value;
                if (size) {
                    // Restore selection before applying format
                    if (savedSelection) {
                        try {
                            this.squireEditor.setSelection(savedSelection);
                        } catch (error) {
                            console.warn('Failed to restore selection:', error);
                        }
                    }
                    this.setFontSize(size);
                    savedSelection = null;
                }
            });

            // Clear saved selection if dropdown is closed without selecting
            fontSizeSelect.addEventListener('blur', () => {
                savedSelection = null;
            });
        }

        // Bind font family dropdown
        const fontFamilySelect = document.getElementById('fontFamilySelect');
        if (fontFamilySelect) {
            // Store selection when opening dropdown
            let savedSelection = null;

            // Save selection on mousedown (before focus is lost)
            fontFamilySelect.addEventListener('mousedown', (e) => {
                if (this.squireEditor) {
                    try {
                        savedSelection = this.squireEditor.getSelection();
                    } catch (error) {
                        console.warn('Failed to save selection:', error);
                    }
                }
            });

            // Handle change event (when user selects a font)
            fontFamilySelect.addEventListener('change', (e) => {
                const family = e.target.value;
                if (family) {
                    // Restore selection before applying format
                    if (savedSelection) {
                        try {
                            this.squireEditor.setSelection(savedSelection);
                        } catch (error) {
                            console.warn('Failed to restore selection:', error);
                        }
                    }
                    this.setFontFamily(family);
                    savedSelection = null;
                }
            });

            // Clear saved selection if dropdown is closed without selecting
            fontFamilySelect.addEventListener('blur', () => {
                savedSelection = null;
            });
        }

        // Bind text alignment dropdown
        const textAlignSelect = document.getElementById('textAlignSelect');
        if (textAlignSelect) {
            // Store selection when opening dropdown
            let savedSelection = null;

            // Save selection on mousedown (before focus is lost)
            textAlignSelect.addEventListener('mousedown', (e) => {
                if (this.squireEditor) {
                    try {
                        savedSelection = this.squireEditor.getSelection();
                    } catch (error) {
                        console.warn('Failed to save selection:', error);
                    }
                }
            });

            // Handle change event (when user selects an alignment)
            textAlignSelect.addEventListener('change', (e) => {
                const alignment = e.target.value;
                if (alignment) {
                    // Restore selection before applying format
                    if (savedSelection) {
                        try {
                            this.squireEditor.setSelection(savedSelection);
                        } catch (error) {
                            console.warn('Failed to restore selection:', error);
                        }
                    }
                    this.setTextAlignment(alignment);
                    savedSelection = null;
                    // Reset dropdown to default after selection
                    e.target.value = '';
                }
            });

            // Clear saved selection if dropdown is closed without selecting
            textAlignSelect.addEventListener('blur', () => {
                savedSelection = null;
            });
        }

        // Format dropdown with selection preservation
        const formatSelect = document.getElementById('formatSelect');
        let formatSavedSelection = null;

        if (formatSelect) {
            // Save selection BEFORE dropdown opens
            formatSelect.addEventListener('mousedown', (e) => {
                if (this.squireEditor) {
                    try {
                        formatSavedSelection = this.squireEditor.getSelection();
                    } catch (error) {
                        console.warn('Failed to save selection:', error);
                    }
                }
            });

            // Apply format change
            formatSelect.addEventListener('change', (e) => {
                // Try to restore selection
                if (formatSavedSelection) {
                    try {
                        this.squireEditor.setSelection(formatSavedSelection);
                    } catch (error) {
                        // Range might be invalid - Squire handles cursor positioning
                        console.warn('Failed to restore selection:', error);
                    }
                }

                // Apply format change
                this.setFormat(e.target.value);

                // Focus editor
                this.squireEditor.focus();

                // Clear saved selection
                formatSavedSelection = null;
            });

            // Clear saved selection if dropdown closed without selecting
            formatSelect.addEventListener('blur', () => {
                formatSavedSelection = null;
            });
        }

        // Bind spacing dropdown
        const spacingDropdownBtn = document.getElementById('spacingDropdownBtn');
        const spacingDropdownMenu = document.getElementById('spacingDropdownMenu');

        if (spacingDropdownBtn && spacingDropdownMenu) {
            // Toggle dropdown on button click
            spacingDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = spacingDropdownMenu.style.display !== 'none';
                spacingDropdownMenu.style.display = isVisible ? 'none' : 'block';

                // Update checkmarks when opening
                if (!isVisible) {
                    this.updateSpacingCheckmarks();
                }
            });

            // Handle menu item clicks
            spacingDropdownMenu.addEventListener('click', (e) => {
                const menuItem = e.target.closest('.spacing-menu-item');
                if (!menuItem) return;

                const action = menuItem.getAttribute('data-action');
                const value = menuItem.getAttribute('data-value');

                if (action === 'line-spacing') {
                    this.setLineSpacing(value);
                } else if (action === 'space-before') {
                    this.toggleParagraphSpacingBefore();
                } else if (action === 'space-after') {
                    this.toggleParagraphSpacingAfter();
                }

                // Keep menu open after selection so user can see updated checkmarks
                this.updateSpacingCheckmarks();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!spacingDropdownBtn.contains(e.target) && !spacingDropdownMenu.contains(e.target)) {
                    spacingDropdownMenu.style.display = 'none';
                }
            });
        }

        // Update checkmarks on selection change
        if (this.squireEditor) {
            this.squireEditor.addEventListener('pathChange', () => {
                this.updateSpacingCheckmarks();
            });
        }
    },

    // Bind rich text keyboard shortcuts
    bindMarkdownShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when document editor is focused
            const documentEditor = UI.elements.documentEditor;

            // Enhanced focus check with proper grouping
            if (!documentEditor) return;
            if (!documentEditor.classList.contains('active')) return; // Editor not open

            // Check if Squire editor is focused
            if (!this.squireEditor) return;
            const squireRoot = this.squireEditor.getRoot();
            if (!squireRoot || document.activeElement !== squireRoot) return;

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

            // Handle Tab and Shift+Tab for indentation
            if (e.key === 'Tab' && !isCtrlCmd) {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) {
                    this.formatOutdent();
                } else {
                    this.formatIndent();
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
        if (!this.squireEditor) return null;

        return {
            content: this.squireEditor.getHTML(),
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
        if (!this.squireEditor || !state) return;

        // Set flag to prevent history capture during restoration
        this.isRestoring = true;

        this.squireEditor.setHTML(state.content);

        // Clean up any orphaned Claude Changes overlays
        this.cleanupChangeOverlays();

        this.squireEditor.focus();

        // Clear restoration flag
        this.isRestoring = false;

        // Trigger auto-save but NOT history capture
        this.scheduleAutoSave();
    },

    /**
     * Clean up all Claude Changes overlay elements and classes
     * Called during undo/redo to remove visual artifacts from restored content
     */
    cleanupChangeOverlays() {
        // Remove change number indicators
        document.querySelectorAll('.claude-change-number').forEach(el => el.remove());

        // Remove pattern group indicators
        document.querySelectorAll('.pattern-group-indicator').forEach(el => el.remove());

        // Get editor root for scoped cleanup
        const editor = this.squireEditor?.getRoot();
        if (!editor) return;

        // Remove data-change-id attributes and highlight classes from all elements
        editor.querySelectorAll('[data-change-id]').forEach(el => {
            el.removeAttribute('data-change-id');
            el.removeAttribute('data-change-index');
            el.removeAttribute('data-pattern-group');
            el.removeAttribute('data-pattern-source');
            el.classList.remove(
                'claude-change-delete',
                'claude-change-add',
                'claude-change-modify',
                'claude-change-active',
                'claude-change-pattern'
            );
        });

        // Also clean up any elements with pattern attributes that might not have data-change-id
        editor.querySelectorAll('[data-pattern-group], [data-pattern-source]').forEach(el => {
            el.removeAttribute('data-pattern-group');
            el.removeAttribute('data-pattern-source');
        });

        // Also call ClaudeChanges cleanup for redundancy
        if (typeof ClaudeChanges !== 'undefined' && ClaudeChanges.cleanupChangeNumbers) {
            ClaudeChanges.cleanupChangeNumbers();
        }
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

    // Check if document editor is currently active
    isDocumentEditorActive() {
        const documentEditor = UI.elements.documentEditor;
        if (!documentEditor || !documentEditor.classList.contains('active')) return false;

        if (!this.squireEditor) return false;

        const squireRoot = this.squireEditor.getRoot();
        return squireRoot && document.activeElement === squireRoot;
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

        // Ensure all elements have IDs before processing changes
        if (typeof ElementIds !== 'undefined' && this.squireEditor) {
            ElementIds.ensureIds(this.squireEditor.getRoot());
        }

        // Check if auto-accept is enabled
        const autoAccept = Storage.getSetting('autoAcceptEdits', false);

        if (autoAccept) {
            // Auto-accept mode: apply all changes directly without review
            console.log(`Auto-accepting ${changes.length} Claude edit(s)`);

            // Cache original HTML before changes
            const editor = this.squireEditor.getRoot();
            const originalHTML = editor.innerHTML;

            // Mark all changes as accepted
            changes.forEach(change => {
                change.status = 'accepted';
            });

            // Use ClaudeChanges reconstruction to apply all changes
            const reconstructedHTML = ClaudeChanges.reconstructDocument(originalHTML, changes);

            // Apply to editor
            this.squireEditor.saveUndoState();
            editor.innerHTML = reconstructedHTML;

            // Ensure new elements have IDs
            if (typeof ElementIds !== 'undefined') {
                ElementIds.ensureIds(editor);
            }

            // Save document
            this.saveCurrentDocument();

            // Notify user
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage(`Auto-accepted ${changes.length} change${changes.length !== 1 ? 's' : ''} from Claude.`);
            }

            return;
        }

        // Normal review mode continues below...

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
     * Supports pattern-based changes with grouped indicators
     *
     * OPTIMIZED: Uses buildContentIndex for O(1) lookups instead of O(M) recursive searches.
     * Reduces complexity from O(N × M) to O(M + N) for N changes on M-node documents.
     */
    renderChangesInDocument(changes) {
        if (!this.squireEditor) return;

        const startTime = performance.now();

        // Save undo state before making changes
        this.squireEditor.saveUndoState();

        // Get editor root element
        const editor = this.squireEditor.getRoot();
        if (!editor) return;

        // Clean up any existing change numbers before rendering new ones
        document.querySelectorAll('.claude-change-number').forEach(el => el.remove());
        document.querySelectorAll('.pattern-group-indicator').forEach(el => el.remove());

        // Get current HTML content
        const currentHTML = editor.innerHTML;

        // Create a temporary container to work with
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentHTML;

        // BUILD CONTENT INDEX ONCE - O(M) single pass
        const contentIndex = this.buildContentIndex(tempDiv);

        // Helper to find node using ID-only lookup
        const findNodeWithIndex = (targetId) => {
            if (!targetId) return null;

            const node = contentIndex.byId.get(targetId);
            if (node && !contentIndex.isUsed(node)) {
                return node;
            }

            if (!node) {
                console.warn(`ID not found: ${targetId}`);
            }
            return null;
        };

        // Track change elements for sequence chaining
        const changeElementsById = new Map();

        // Apply each change with visual markers
        changes.forEach((change, index) => {
            const changeElement = document.createElement('div');
            changeElement.setAttribute('data-change-id', change.id);
            changeElement.setAttribute('data-change-index', index);

            // Track for sequence chaining
            changeElementsById.set(change.id, changeElement);

            // Add sequence group attribute if this is part of a sequence
            if (change._sequenceGroup) {
                changeElement.setAttribute('data-sequence-group', 'true');
            }

            // Add pattern source attribute if this is a pattern-based change
            if (change._patternGroup) {
                changeElement.setAttribute('data-pattern-source', change._patternGroup.patternName);
                changeElement.setAttribute('data-pattern-group', change._patternGroup.groupId);
            }

            if (change.type === 'delete') {
                // Wrap content to be deleted in red highlight
                changeElement.className = 'claude-change-delete';
                if (change._patternGroup) {
                    changeElement.classList.add('claude-change-pattern');
                }

                // Find the target using ID-only lookup
                const originalNode = findNodeWithIndex(change.targetId);

                if (originalNode) {
                    // Get content from actual element (not from change.originalContent which may be empty)
                    // Strip data-edit-id to prevent duplicate ID issues
                    let deleteContent = originalNode.outerHTML;
                    deleteContent = deleteContent.replace(/\s*data-edit-id="[^"]*"/g, '');
                    changeElement.innerHTML = deleteContent;

                    // Also store for later use if needed
                    if (!change.originalContent) {
                        change.originalContent = originalNode.outerHTML;
                    }

                    contentIndex.markUsed(originalNode);
                    originalNode.replaceWith(changeElement);
                } else {
                    // DELETE: Don't render preview if ID not found
                    console.warn(`DELETE preview: Target ID not found: ${change.targetId}`);
                }
            } else if (change.type === 'add') {
                // Wrap new content in green highlight
                changeElement.className = 'claude-change-add';
                if (change._patternGroup) {
                    changeElement.classList.add('claude-change-pattern');
                }
                changeElement.innerHTML = change.newContent || '';

                // Handle chained sequence items (insert after previous change in sequence)
                if (change._chainedAfter) {
                    const prevChangeElement = changeElementsById.get(change._chainedAfter);
                    if (prevChangeElement && prevChangeElement.parentNode) {
                        // Insert after the previous change element in the sequence
                        prevChangeElement.after(changeElement);
                        // Mark as chained for signature reconstruction
                        if (!change._cachedSignature) {
                            change._cachedSignature = {
                                anchorType: 'chainedAfter',
                                chainedAfter: change._chainedAfter
                            };
                        }
                    } else {
                        console.warn('❌ ADD preview: Could not find chained anchor:', change._chainedAfter);
                        tempDiv.appendChild(changeElement);
                    }
                }
                // Handle ADD with anchorTargetId (ID-only targeting)
                else if (change.anchorTargetId) {
                    const anchorNode = findNodeWithIndex(change.anchorTargetId);
                    if (anchorNode) {
                        if (change._anchorDirection === 'after') {
                            anchorNode.after(changeElement);
                        } else {
                            anchorNode.before(changeElement);
                        }
                    } else {
                        console.warn(`ADD preview: Anchor ID not found: ${change.anchorTargetId}`);
                        tempDiv.appendChild(changeElement);
                    }
                } else {
                    // No anchor specified
                    console.warn(`ADD preview: No anchor ID specified for change ${change.id}`);
                    tempDiv.appendChild(changeElement);
                }
            } else if (change.type === 'modify') {
                // Show both old (strikethrough) and new (highlighted)
                changeElement.className = 'claude-change-modify';
                if (change._patternGroup) {
                    changeElement.classList.add('claude-change-pattern');
                }
                changeElement.innerHTML = change.newContent || '';

                // Find target using ID-only lookup
                const originalNode = findNodeWithIndex(change.targetId);

                if (originalNode) {
                    // Store original content for reconstruction if not already set
                    if (!change.originalContent) {
                        change.originalContent = originalNode.outerHTML;
                    }

                    contentIndex.markUsed(originalNode);
                    originalNode.replaceWith(changeElement);
                } else {
                    console.warn(`MODIFY preview: Target ID not found: ${change.targetId}`);
                    tempDiv.appendChild(changeElement);
                }
            } else if (change.type === 'format') {
                // Format change - purple indicator (formatting-only, no content change)
                changeElement.className = 'claude-change-format';

                // Find target using ID-only lookup
                const targetNode = findNodeWithIndex(change.targetId);

                if (targetNode) {
                    // Store original HTML for reject/revert
                    change._originalHTML = targetNode.innerHTML;
                    change._originalOuterHTML = targetNode.outerHTML;

                    // Clone content and apply preview formatting (CSS-only simulation)
                    const previewContent = targetNode.cloneNode(true);
                    this.applyPreviewFormatting(previewContent, change);
                    changeElement.innerHTML = previewContent.outerHTML;

                    contentIndex.markUsed(targetNode);
                    targetNode.replaceWith(changeElement);
                } else {
                    console.warn(`FORMAT preview: Target ID not found: ${change.targetId}`);
                }
            }

            // Add change number indicator - same for all changes including patterns
            const numberIndicator = document.createElement('span');
            numberIndicator.className = 'claude-change-number';
            numberIndicator.textContent = (index + 1).toString();
            changeElement.appendChild(numberIndicator);

            // Add agent attribution if available (multi-agent mode)
            if (change.agentColor) {
                // Apply agent color to the left border
                changeElement.style.borderLeftColor = change.agentColor;

                // Add agent badge with color dot and name
                const agentBadge = document.createElement('span');
                agentBadge.className = 'claude-change-agent-badge';
                const agentName = (change.agentName || 'Agent').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                agentBadge.innerHTML = `<span class="agent-dot" style="background-color: ${change.agentColor}"></span>${agentName}`;
                agentBadge.title = change.agentName || 'Agent';
                changeElement.appendChild(agentBadge);
            }

            // Mark conflicts if present
            if (change._conflict) {
                changeElement.classList.add('claude-change-conflict');
                changeElement.setAttribute('data-conflict-group', change._conflictGroup || '');
                changeElement.setAttribute('data-conflict-index', change._conflictIndex || 1);
                changeElement.setAttribute('data-conflict-total', change._conflictTotal || 1);

                // Add conflict indicator
                const conflictBadge = document.createElement('span');
                conflictBadge.className = 'claude-change-conflict-badge';
                conflictBadge.textContent = `Conflict ${change._conflictIndex}/${change._conflictTotal}`;
                conflictBadge.title = 'Multiple agents proposed different changes for this content';
                changeElement.appendChild(conflictBadge);
            }
        });

        // Update the editor with the marked-up content
        // Use DOM manipulation instead of innerHTML to preserve node references
        while (editor.firstChild) {
            editor.removeChild(editor.firstChild);
        }
        while (tempDiv.firstChild) {
            editor.appendChild(tempDiv.firstChild);
        }

        const elapsed = performance.now() - startTime;
        console.log(`🎨 Rendered ${changes.length} changes in ${elapsed.toFixed(2)}ms`);
    },

    /**
     * Normalize HTML string for comparison (removes whitespace variations)
     * Uses LRU cache to avoid redundant regex operations during batch processing.
     * @param {string} html - HTML content to normalize
     * @param {boolean} stripAttributes - If true, removes all HTML attributes
     */
    normalizeHTML(html, stripAttributes = false) {
        if (!html) return '';

        // Check cache first (O(1) lookup)
        const cacheKey = `${stripAttributes ? '1' : '0'}:${html}`;
        if (this._normalizedCache.has(cacheKey)) {
            return this._normalizedCache.get(cacheKey);
        }

        // Compute normalization
        let normalized = html
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><');

        // Optionally strip attributes for more flexible matching
        if (stripAttributes) {
            // Convert <tag attr="value"> to <tag>
            normalized = normalized.replace(/<(\w+)[^>]*>/g, '<$1>');
        }

        normalized = normalized.toLowerCase();

        // Cache with LRU eviction
        if (this._normalizedCache.size >= this._normalizedCacheMaxSize) {
            // Delete oldest entry (first key in Map iteration order)
            const firstKey = this._normalizedCache.keys().next().value;
            this._normalizedCache.delete(firstKey);
        }
        this._normalizedCache.set(cacheKey, normalized);

        return normalized;
    },

    /**
     * Clear normalization cache (call when document changes significantly)
     */
    clearNormalizationCache() {
        this._normalizedCache.clear();
    },

    /**
     * Build content index for O(1) node lookups during change rendering
     * Single TreeWalker pass creates ID lookup map
     * @param {Element} container - DOM container to index
     * @returns {Object} Index with byId map and utility methods
     */
    buildContentIndex(container) {
        const startTime = performance.now();
        const index = {
            byId: new Map(),
            usedNodes: new Set(),

            // Mark node as matched (prevents double-matching)
            markUsed(node) {
                this.usedNodes.add(node);
            },

            // Check if node was already matched
            isUsed(node) {
                return this.usedNodes.has(node);
            }
        };

        // Single TreeWalker pass
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_ELEMENT,
            null
        );

        let nodeCount = 0;
        while (walker.nextNode()) {
            const node = walker.currentNode;
            nodeCount++;

            // Skip nodes inside change wrappers
            if (node.closest('[data-change-id]')) continue;

            // Index by edit-id
            if (node.dataset?.editId) {
                index.byId.set(node.dataset.editId, node);
            }
        }

        const elapsed = performance.now() - startTime;
        console.log(`📇 Documents index built: ${nodeCount} nodes in ${elapsed.toFixed(2)}ms`);
        return index;
    },

    /**
     * Find node using pre-built index (O(1) lookup)
     * @param {Object} index - Index from buildContentIndex
     * @param {Object} change - Change object with targetId or anchorTargetId
     * @returns {Element|null} Found node or null
     */
    findNodeUsingIndex(index, change) {
        // For MODIFY/DELETE/FORMAT: use targetId
        if (change.targetId) {
            const node = index.byId.get(change.targetId);
            if (node && !index.isUsed(node)) {
                return node;
            }
            if (!node) {
                console.warn(`Target ID not found: ${change.targetId}`);
            }
        }

        // For ADD: use anchorTargetId
        if (change.type === 'add' && change.anchorTargetId) {
            const node = index.byId.get(change.anchorTargetId);
            if (node) {
                return node;
            }
            console.warn(`Anchor ID not found: ${change.anchorTargetId}`);
        }

        return null;
    },

    /**
     * Find a node by its content
     * @deprecated Use ID-based targeting (targetId, anchorTargetId) instead.
     * This function is kept for backward compatibility but will be removed.
     */
    findNodeByContent(container, content) {
        console.warn('DEPRECATED: findNodeByContent called. Use ID-based targeting instead.');
        if (!content) return null;

        // Normalize the search content for flexible matching
        const normalizedContent = this.normalizeHTML(content);

        // Helper: Recursive depth-first search
        const searchNode = (node) => {
            if (!node || node.nodeType !== 1) return null; // Only element nodes

            // Skip nodes inside change wrappers
            if (node.closest('[data-change-id]')) return null;

            // Try normalized innerHTML match
            if (this.normalizeHTML(node.innerHTML) === normalizedContent) {
                return node;
            }

            // Try normalized outerHTML match
            if (this.normalizeHTML(node.outerHTML) === normalizedContent) {
                return node;
            }

            // Recurse into children
            for (let child of node.children) {
                const found = searchNode(child);
                if (found) return found;
            }

            return null;
        };

        return searchNode(container);
    },

    /**
     * Apply formatting preview to a cloned element (CSS-only simulation)
     * For safe reject, we simulate formatting visually rather than using Squire
     * @param {Element} element - Cloned element to apply preview formatting
     * @param {Object} change - Change object with styles and removes arrays
     */
    applyPreviewFormatting(element, change) {
        // Get the target content - either specific text or entire element
        const textTarget = change.textTarget;

        // Helper to wrap text in formatting span
        const wrapTextInStyle = (parentElement, styles) => {
            const wrapper = document.createElement('span');
            wrapper.className = 'format-preview-applied';

            (styles || []).forEach(style => {
                if (style === '<b>' || style === 'b') {
                    wrapper.style.fontWeight = 'bold';
                } else if (style === '<i>' || style === 'i') {
                    wrapper.style.fontStyle = 'italic';
                } else if (style === '<u>' || style === 'u') {
                    wrapper.style.textDecoration = (wrapper.style.textDecoration || '') + ' underline';
                } else if (style === '<s>' || style === 's') {
                    wrapper.style.textDecoration = (wrapper.style.textDecoration || '') + ' line-through';
                } else if (style.startsWith('font-size:')) {
                    wrapper.style.fontSize = style.split(':')[1].trim();
                } else if (style.startsWith('font-family:')) {
                    wrapper.style.fontFamily = style.split(':')[1].trim();
                } else if (style.startsWith('text-align:')) {
                    // Block-level style - apply to element itself
                    parentElement.style.textAlign = style.split(':')[1].trim();
                } else if (style.startsWith('line-height:')) {
                    parentElement.style.lineHeight = style.split(':')[1].trim();
                } else if (style.startsWith('margin-top:') || style === 'space-before') {
                    // Space Before - apply to element itself
                    parentElement.style.marginTop = style === 'space-before' ? '12pt' : style.split(':')[1].trim();
                } else if (style.startsWith('margin-bottom:') || style === 'space-after') {
                    // Space After - apply to element itself
                    parentElement.style.marginBottom = style === 'space-after' ? '12pt' : style.split(':')[1].trim();
                }
            });

            return wrapper;
        };

        if (textTarget) {
            // Format specific text occurrences within the element
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            while (walker.nextNode()) {
                textNodes.push(walker.currentNode);
            }

            textNodes.forEach(textNode => {
                const text = textNode.textContent;
                if (text.includes(textTarget)) {
                    // Replace all occurrences
                    const parts = text.split(textTarget);
                    const fragment = document.createDocumentFragment();

                    parts.forEach((part, index) => {
                        if (part) {
                            fragment.appendChild(document.createTextNode(part));
                        }
                        if (index < parts.length - 1) {
                            // Add formatted text
                            const wrapper = wrapTextInStyle(element, change.styles);
                            wrapper.textContent = textTarget;
                            fragment.appendChild(wrapper);
                        }
                    });

                    textNode.replaceWith(fragment);
                }
            });
        } else {
            // Format entire element content
            const wrapper = wrapTextInStyle(element, change.styles);
            wrapper.innerHTML = element.innerHTML;
            element.innerHTML = '';
            element.appendChild(wrapper);
        }
    },

    /**
     * Apply formatting to a node using Squire methods
     * Called during reconstruction for accepted FORMAT changes
     * @param {Element} node - Target node to format
     * @param {Object} change - Change object with styles, removes, textTarget
     * @returns {boolean} Success status
     */
    applyFormatToNode(node, change) {
        if (!this.squireEditor) {
            console.warn('Squire editor not available for format application');
            return false;
        }

        const editor = this.squireEditor;

        // Focus required by Squire API before formatting methods (per SQUIRE_API.md)
        editor.focus();

        // Create range for selection
        const range = document.createRange();

        if (change.textTarget) {
            // Find and format all occurrences of text within element
            const textOccurrences = this.findTextOccurrences(node, change.textTarget);

            textOccurrences.forEach(occurrence => {
                range.setStart(occurrence.node, occurrence.start);
                range.setEnd(occurrence.node, occurrence.end);
                editor.setSelection(range);
                this.applySquireFormatting(change.styles, change.removes);
            });
        } else {
            // Select entire element content
            range.selectNodeContents(node);
            editor.setSelection(range);
            this.applySquireFormatting(change.styles, change.removes);
        }

        return true;
    },

    /**
     * Find all occurrences of text within an element
     * @param {Element} element - Element to search within
     * @param {string} searchText - Text to find
     * @returns {Array} Array of {node, start, end} objects
     */
    findTextOccurrences(element, searchText) {
        const occurrences = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

        while (walker.nextNode()) {
            const textNode = walker.currentNode;
            const text = textNode.textContent;
            let pos = 0;

            while ((pos = text.indexOf(searchText, pos)) !== -1) {
                occurrences.push({
                    node: textNode,
                    start: pos,
                    end: pos + searchText.length
                });
                pos += searchText.length;
            }
        }

        return occurrences;
    },

    /**
     * Apply formatting using Squire methods
     * @param {Array} styles - Array of style strings to apply
     * @param {Array} removes - Array of tag names to remove
     */
    applySquireFormatting(styles, removes) {
        const editor = this.squireEditor;
        if (!editor) return;

        // Apply removes first (order matters for toggle behavior)
        (removes || []).forEach(remove => {
            if (remove === 'b') editor.removeBold();
            else if (remove === 'i') editor.removeItalic();
            else if (remove === 'u') editor.removeUnderline();
            else if (remove === 's') editor.removeStrikethrough();
        });

        // Apply styles
        (styles || []).forEach(style => {
            if (style === '<b>' || style === 'b') editor.bold();
            else if (style === '<i>' || style === 'i') editor.italic();
            else if (style === '<u>' || style === 'u') editor.underline();
            else if (style === '<s>' || style === 's') editor.strikethrough();
            else if (style.startsWith('font-size:')) {
                editor.setFontSize(style.split(':')[1].trim());
            }
            else if (style.startsWith('font-family:')) {
                editor.setFontFace(style.split(':')[1].trim());
            }
            else if (style.startsWith('text-align:')) {
                editor.setTextAlignment(style.split(':')[1].trim());
            }
            else if (style.startsWith('line-height:')) {
                // Squire doesn't have native line-height, use forEachBlock (same as setLineSpacing)
                const lineHeight = style.split(':')[1].trim();
                editor.forEachBlock((block) => {
                    block.style.lineHeight = lineHeight;
                }, true);
            }
            else if (style.startsWith('margin-top:') || style === 'space-before') {
                // Space Before - add margin-top to block
                const value = style === 'space-before' ? '12pt' : style.split(':')[1].trim();
                editor.forEachBlock((block) => {
                    block.style.marginTop = value;
                }, true);
            }
            else if (style.startsWith('margin-bottom:') || style === 'space-after') {
                // Space After - add margin-bottom to block
                const value = style === 'space-after' ? '12pt' : style.split(':')[1].trim();
                editor.forEachBlock((block) => {
                    block.style.marginBottom = value;
                }, true);
            }
        });
    },

    /**
     * Parse Claude's response for document edit commands
     * Looks for <document_edit> XML tags in Claude's response
     * Supports pattern-based changes that expand to all matches client-side
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

            // Check for pattern-based change (type ends with "-pattern")
            if (type && type.endsWith('-pattern')) {
                // Extract pattern attribute
                const patternMatch = attributeString.match(/pattern="([^"]+)"/);
                const patternName = patternMatch ? patternMatch[1] : null;

                if (patternName && typeof ClaudeChanges !== 'undefined' && ClaudeChanges.PatternMatcher) {
                    // Get the document container for pattern matching
                    const editor = this.squireEditor?.getRoot();
                    if (editor) {
                        // Ensure element IDs are assigned before pattern matching
                        if (typeof ElementIds !== 'undefined') {
                            ElementIds.ensureIds(editor);
                        }

                        // Determine change type from pattern type (e.g., "delete-pattern" -> "delete")
                        const baseType = type.replace('-pattern', '');

                        // Use PatternMatcher to find ALL matches client-side
                        const patternChanges = ClaudeChanges.PatternMatcher.createChangesFromPattern(
                            editor,
                            patternName,
                            baseType
                        );

                        if (patternChanges.length > 0) {
                            console.log(`Pattern "${patternName}" expanded to ${patternChanges.length} change(s)`);
                            changes.push(...patternChanges);
                        } else {
                            console.log(`Pattern "${patternName}" found no matches`);
                        }
                    } else {
                        console.warn('Cannot expand pattern: editor not available');
                    }
                } else {
                    console.warn('Pattern change specified but PatternMatcher not available or pattern not specified');
                }

                // Skip normal parsing for pattern changes - already handled above
                continue;
            }

            // Handle format type (formatting-only changes via Squire methods)
            if (type === 'format') {
                // Parse targetId (required for format)
                const targetIdMatch = attributeString.match(/targetId="([^"]+)"/);
                const targetId = targetIdMatch ? targetIdMatch[1] : undefined;

                // Parse optional text attribute for partial formatting
                const textMatch = attributeString.match(/text="([^"]+)"/);
                const textTarget = textMatch ? textMatch[1] : undefined;

                // Parse style elements (multiple allowed)
                const styles = [];
                const styleRegex = /<style>(.*?)<\/style>/gs;
                let styleMatch;
                while ((styleMatch = styleRegex.exec(content)) !== null) {
                    styles.push(styleMatch[1].trim());
                }

                // Parse remove elements (multiple allowed)
                const removes = [];
                const removeRegex = /<remove>(.*?)<\/remove>/gs;
                let removeMatch;
                while ((removeMatch = removeRegex.exec(content)) !== null) {
                    // Extract just the tag name: <b> -> 'b'
                    const tagMatch = removeMatch[1].match(/<(\w+)/);
                    if (tagMatch) removes.push(tagMatch[1].toLowerCase());
                }

                // Parse original for fallback verification
                const originalMatch = content.match(/<original>(.*?)<\/original>/s);

                const change = {
                    id: Storage.generateChangeId(),
                    type: 'format',
                    targetId: targetId,
                    textTarget: textTarget,
                    styles: styles,
                    removes: removes,
                    originalContent: originalMatch ? originalMatch[1].trim() : null,
                    status: 'pending'
                };

                changes.push(change);
                continue;
            }

            // Handle add-sequence type (bulk insertions)
            if (type === 'add-sequence') {
                // Parse ID-based anchors (REQUIRED)
                const insertAfterIdMatch = attributeString.match(/insertAfter-id="([^"]+)"/);
                const insertBeforeIdMatch = attributeString.match(/insertBefore-id="([^"]+)"/);
                const anchorTargetId = insertAfterIdMatch?.[1] || insertBeforeIdMatch?.[1];
                const anchorDirection = insertAfterIdMatch ? 'after' : (insertBeforeIdMatch ? 'before' : null);

                if (!anchorTargetId) {
                    console.warn('add-sequence missing required insertAfter-id or insertBefore-id');
                    continue;
                }

                // Parse items from sequence
                const itemsMatch = content.match(/<items>(.*?)<\/items>/s);
                if (itemsMatch) {
                    const itemsContent = itemsMatch[1];
                    const itemRegex = /<item>(.*?)<\/item>/gs;
                    let itemMatch;
                    let isFirstItem = true;
                    let previousChangeId = null;

                    while ((itemMatch = itemRegex.exec(itemsContent)) !== null) {
                        const itemContent = itemMatch[1].trim();
                        const changeId = Storage.generateChangeId();

                        const change = {
                            id: changeId,
                            type: 'add',
                            newContent: itemContent,
                            status: 'pending',
                            _sequenceGroup: true // Mark as part of a sequence
                        };

                        if (isFirstItem) {
                            // First item uses the original anchor
                            change.anchorTargetId = anchorTargetId;
                            change._anchorDirection = anchorDirection;
                            isFirstItem = false;
                        } else {
                            // Subsequent items chain to previous item
                            change._chainedAfter = previousChangeId;
                        }

                        previousChangeId = changeId;
                        changes.push(change);
                    }
                }
                continue;
            }

            // Parse ID-based attributes (REQUIRED for all change types)
            const insertAfterIdMatch = attributeString.match(/insertAfter-id="([^"]+)"/);
            const insertBeforeIdMatch = attributeString.match(/insertBefore-id="([^"]+)"/);
            const targetIdMatch = attributeString.match(/targetId="([^"]+)"/);
            const targetId = targetIdMatch ? targetIdMatch[1] : undefined;

            // For ADD: use insertAfter-id or insertBefore-id
            const anchorTargetId = insertAfterIdMatch?.[1] || insertBeforeIdMatch?.[1];
            const anchorDirection = insertAfterIdMatch ? 'after' : (insertBeforeIdMatch ? 'before' : null);

            // Validate required targeting
            if (type === 'add' && !anchorTargetId) {
                console.warn(`ADD change missing required insertAfter-id or insertBefore-id`);
            }
            if ((type === 'modify' || type === 'delete') && !targetId) {
                console.warn(`${type.toUpperCase()} change missing required targetId`);
            }

            // Parse optional <original> for verification (not used for resolution)
            const originalMatch = content.match(/<original>(.*?)<\/original>/s);

            // Handle multiple <new> blocks - Claude might generate separate blocks for each paragraph
            let newContent = null;
            const newBlockRegex = /<new>(.*?)<\/new>/gs;
            const newBlocks = [];
            let newBlockMatch;
            while ((newBlockMatch = newBlockRegex.exec(content)) !== null) {
                newBlocks.push(newBlockMatch[1].trim());
            }
            if (newBlocks.length > 0) {
                newContent = newBlocks.join('');
            }

            const change = {
                id: Storage.generateChangeId(),
                type: type,
                anchorTargetId: anchorTargetId || undefined,
                _anchorDirection: anchorDirection,
                targetId: targetId || undefined,
                originalContent: originalMatch ? originalMatch[1].trim() : null,
                newContent: newContent,
                status: 'pending'
            };

            changes.push(change);
        }

        // Resolve cross-ADD anchor dependencies
        // When Claude uses anchors that reference other ADDs' newContent IDs,
        // convert those to _chainedAfter relationships so they work correctly
        if (changes.length > 1) {
            // Extract IDs from all ADD newContent
            const contentIdToChangeId = new Map();

            changes.forEach(change => {
                if (change.type === 'add' && change.newContent) {
                    // Parse newContent for id and data-edit-id attributes
                    const idMatches = change.newContent.matchAll(/(?:data-edit-id|id)="([^"]+)"/g);
                    for (const match of idMatches) {
                        contentIdToChangeId.set(match[1], change.id);
                    }
                }
            });

            // Check if any ADD anchor references another ADD's newContent ID
            changes.forEach(change => {
                if (change.type === 'add' && change.anchorTargetId) {
                    const creatorChangeId = contentIdToChangeId.get(change.anchorTargetId);
                    if (creatorChangeId && creatorChangeId !== change.id) {
                        const inventedId = change.anchorTargetId;
                        change._chainedAfter = creatorChangeId;
                        delete change.anchorTargetId;
                        delete change._anchorDirection;
                        console.log(`Auto-chained ADD ${change.id} after ${creatorChangeId} (anchor ID "${inventedId}" is in newContent)`);
                    }
                }
            });
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

    /**
     * Convert a document to a File object for drag-and-drop attachment
     * @param {string} documentId - ID of document to convert
     * @returns {Object|null} - File data object compatible with Files module
     */
    getDocumentAsFile(documentId) {
        const doc = this.documents[documentId];
        if (!doc) {
            console.warn('Document not found:', documentId);
            return null;
        }

        // Create HTML blob from document content
        const htmlContent = doc.content || '<p></p>';
        const blob = new Blob([htmlContent], { type: 'text/html' });

        // Create File object
        const file = new File([blob], doc.title, {
            type: 'text/html',
            lastModified: doc.lastModified
        });

        // Return in Files.selectedFiles format
        return {
            id: 'dragged_doc_' + doc.id + '_' + Date.now(),
            file: file,
            name: doc.title,
            type: 'text/html',
            size: blob.size,
            isDraggedDocument: true, // Flag for special handling/styling
            sourceDocumentId: doc.id // Track origin for duplicate detection
        };
    },

    /**
     * Setup drag-and-drop handlers for document attachment
     * @param {HTMLElement} documentItem - Document list item element
     * @param {string} documentId - Document ID
     */
    setupDragForAttachment(documentItem, documentId) {
        documentItem.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            documentItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'copy'; // Copy, not move
            e.dataTransfer.setData('text/plain', documentId);
            e.dataTransfer.setData('application/x-apprised-document', documentId);
        });

        documentItem.addEventListener('dragend', (e) => {
            e.stopPropagation();
            documentItem.classList.remove('dragging');
        });
    },

};