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
    }
};