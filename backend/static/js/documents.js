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
            // Set loading flag to prevent premature font detection
            this._loadingDocument = true;

            this.squireEditor.setHTML(document.content || '');

            // Defer cursor positioning and font detection until next event loop tick
            // This ensures Squire has finished loading content and cursor is in styled content
            setTimeout(() => {
                if (this.squireEditor) {
                    this._loadingDocument = false;
                    this.squireEditor.moveCursorToStart();
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
        if (!['p', 'h1', 'h2', 'h3'].includes(format)) {
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
                    const newElement = document.createElement(format.toUpperCase());

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

    // Toggle paragraph spacing before (margin-top) - uses font size
    toggleParagraphSpacingBefore() {
        if (!this.squireEditor) return;

        this.squireEditor.forEachBlock((block) => {
            // Skip list items to avoid double-spacing issues
            if (block.nodeName === 'LI') return;

            const currentMargin = block.style.marginTop;
            if (currentMargin && currentMargin !== '0px') {
                // Remove spacing
                block.style.marginTop = '';
            } else {
                // Add spacing equal to font size
                const fontSize = window.getComputedStyle(block).fontSize;
                block.style.marginTop = fontSize;
            }
        }, true);

        this.scheduleAutoSave();
        this.squireEditor.focus();
        this.updateSpacingCheckmarks();
    },

    // Toggle paragraph spacing after (margin-bottom) - uses font size
    toggleParagraphSpacingAfter() {
        if (!this.squireEditor) return;

        this.squireEditor.forEachBlock((block) => {
            // Skip list items to avoid double-spacing issues
            if (block.nodeName === 'LI') return;

            const currentMargin = block.style.marginBottom;
            if (currentMargin && currentMargin !== '0px') {
                // Remove spacing
                block.style.marginBottom = '';
            } else {
                // Add spacing equal to font size
                const fontSize = window.getComputedStyle(block).fontSize;
                block.style.marginBottom = fontSize;
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

            // Get current margins
            const marginTop = node.style.marginTop || window.getComputedStyle(node).marginTop;
            const marginBottom = node.style.marginBottom || window.getComputedStyle(node).marginBottom;
            const hasSpaceBefore = marginTop && marginTop !== '0px' && parseFloat(marginTop) > 0;
            const hasSpaceAfter = marginBottom && marginBottom !== '0px' && parseFloat(marginBottom) > 0;

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
                formatSelect.value = 'h1';
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
        this.squireEditor.focus();

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
        if (!this.squireEditor) return;

        // Save undo state before making changes
        this.squireEditor.saveUndoState();

        // Get editor root element
        const editor = this.squireEditor.getRoot();
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