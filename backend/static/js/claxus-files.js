/**
 * Claxus File Browser module
 * Browse, open, edit, and save files from the /.claxus container directory
 * Files are accessed via WebSocket messages through the Claxus gateway
 */
const ClaxusFiles = {
    currentPath: '/',
    openFilePath: null,
    openFileContent: null,
    collapsed: false,
    initialized: false,
    _autoSaveTimeout: null,
    _autoSaveDelay: 500,
    _editorInputHandler: null,
    _previousDocState: null,
    _draggedEntry: null,      // { name, type, fullPath } of item being dragged
    _draggedElement: null,    // DOM element being dragged

    init() {
        if (this.initialized) return;
        this.bindEvents();
        this.initialized = true;
    },

    bindEvents() {
        const header = document.getElementById('claxusFilesHeader');
        if (header) {
            header.addEventListener('click', () => this.toggleCollapse());
        }

        const refreshBtn = document.getElementById('claxusFilesRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.requestFileList(this.currentPath);
            });
        }

        const newFileBtn = document.getElementById('claxusFilesNewFileBtn');
        if (newFileBtn) {
            newFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.promptNewFile();
            });
        }

        const mkdirBtn = document.getElementById('claxusFilesMkdirBtn');
        if (mkdirBtn) {
            mkdirBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.promptMkdir();
            });
        }

        // Claxus file editor Pull/Save buttons (desktop + mobile)
        UI.elements.claxusFilePullBtn?.addEventListener('click', () => {
            if (this.openFilePath) this.requestFileRead(this.openFilePath);
        });
        UI.elements.claxusFileSaveBtn?.addEventListener('click', () => {
            this.saveCurrentFile();
        });
        UI.elements.claxusMobilePullBtn?.addEventListener('click', () => {
            if (this.openFilePath) this.requestFileRead(this.openFilePath);
        });
        UI.elements.claxusMobileSaveBtn?.addEventListener('click', () => {
            this.saveCurrentFile();
        });

        // Close context menu on click outside
        document.addEventListener('click', () => this.closeContextMenu());
    },

    toggleCollapse() {
        this.collapsed = !this.collapsed;
        const collapse = document.getElementById('claxusFilesCollapse');
        const list = document.getElementById('claxusFilesList');
        const pathEl = document.getElementById('claxusFilesPath');

        if (collapse) collapse.textContent = this.collapsed ? '▶' : '▼';
        if (list) list.style.display = this.collapsed ? 'none' : '';
        if (pathEl) pathEl.style.display = this.collapsed ? 'none' : '';
    },

    // === Navigation ===

    requestFileList(path) {
        this.currentPath = path || '/';
        Claxus.send({ type: 'file_list', path: this.currentPath });
    },

    navigateTo(path) {
        this.currentPath = path;
        this.requestFileList(path);
    },

    // === File Operations ===

    requestFileRead(path) {
        Claxus.send({ type: 'file_read', path });
    },

    saveCurrentFile() {
        if (!this.openFilePath || !Documents.squireEditor) return;

        const html = Documents.squireEditor.getHTML();
        const content = this.htmlToPlainText(html);

        Claxus.send({
            type: 'file_write',
            path: this.openFilePath,
            content
        });
    },

    createDirectory(path) {
        Claxus.send({ type: 'file_mkdir', path });
    },

    renameEntry(path, newName) {
        Claxus.send({ type: 'file_rename', path, new_name: newName });
    },

    moveEntry(path, destination) {
        Claxus.send({ type: 'file_move', path, destination });
    },

    // === WS Message Handlers ===

    handleFileList(data) {
        this.currentPath = data.path || '/';
        this.renderBreadcrumb(this.currentPath);
        this.renderFileList(data.entries || []);
    },

    handleFileContent(data) {
        this.openInEditor(data.path, data.content || '');
    },

    handleFileSaved(data) {
        if (data.success) {
            if (data.path === this.openFilePath && Documents.squireEditor) {
                // Update stored content so dirty checking resets
                this.openFileContent = Documents.squireEditor.getHTML();
            }
            console.log('[ClaxusFiles] Saved:', data.path);
        } else {
            console.error('[ClaxusFiles] Save failed:', data.path);
        }
    },

    handleFileError(data) {
        console.error('[ClaxusFiles] Error:', data.error, 'path:', data.path);
        if (typeof Chat !== 'undefined') {
            Chat.addSystemMessage(`File error: ${data.error}`);
        }
    },

    handleFileCreated(data) {
        if (data.success) {
            // Refresh current directory to show new folder
            this.requestFileList(this.currentPath);
        }
    },

    handleFileRenamed(data) {
        if (data.success) {
            // If the renamed file is currently open, update the open path
            if (this.openFilePath === data.path) {
                this.openFilePath = data.destination;
                const filename = data.destination.split('/').pop();
                if (UI.elements.documentTitle) UI.elements.documentTitle.value = filename;
                if (UI.elements.mobileDocumentTitle) UI.elements.mobileDocumentTitle.value = filename;
            }
            this.requestFileList(this.currentPath);
        }
    },

    handleFileMoved(data) {
        if (data.success) {
            // If the moved file is currently open, update the open path
            if (this.openFilePath === data.path) {
                this.openFilePath = data.destination;
                const filename = data.destination.split('/').pop();
                if (UI.elements.documentTitle) UI.elements.documentTitle.value = filename;
                if (UI.elements.mobileDocumentTitle) UI.elements.mobileDocumentTitle.value = filename;
            }
            this.requestFileList(this.currentPath);
        }
    },

    // === Editor Integration ===

    openInEditor(path, content) {
        if (!Documents.squireEditor) return;

        // Save current document state so we can restore later
        if (!this.openFilePath && Documents.currentDocumentId) {
            this._previousDocState = {
                docId: Documents.currentDocumentId,
                title: UI.elements.documentTitle ? UI.elements.documentTitle.value : ''
            };
            // Detach the current document without closing the editor visually
            Documents.currentDocumentId = null;
        }

        this.openFilePath = path;

        // Convert plain text to HTML for Squire
        const html = this.plainTextToHtml(content);
        this.openFileContent = html;

        // Set title to filename (read-only)
        const filename = path.split('/').pop() || path;
        if (UI.elements.documentTitle) {
            UI.elements.documentTitle.value = filename;
            UI.elements.documentTitle.readOnly = true;
        }
        if (UI.elements.mobileDocumentTitle) {
            UI.elements.mobileDocumentTitle.value = filename;
            UI.elements.mobileDocumentTitle.readOnly = true;
        }

        // Load content into Squire
        Documents._loadingDocument = true;
        Documents.squireEditor.setHTML(html);
        setTimeout(() => { Documents._loadingDocument = false; }, 0);

        // Show editor panel using classList (consistent with Documents.openDocument)
        if (UI.elements.documentEditor) {
            UI.elements.documentEditor.classList.add('active');
        }
        if (UI.elements.chatContainer) {
            UI.elements.chatContainer.classList.add('document-open');
        }

        // Mark active file in file list
        this.markActiveFile(path);

        // Set up auto-save on input
        this.setupAutoSave();
    },

    closeFile() {
        // Remove auto-save listener
        this.teardownAutoSave();

        this.openFilePath = null;
        this.openFileContent = null;

        // Restore title editability
        if (UI.elements.documentTitle) UI.elements.documentTitle.readOnly = false;
        if (UI.elements.mobileDocumentTitle) UI.elements.mobileDocumentTitle.readOnly = false;

        // Clear active state in file list
        const list = document.getElementById('claxusFilesList');
        if (list) {
            list.querySelectorAll('.claxus-file-item.active').forEach(el => el.classList.remove('active'));
        }

        // Restore previous document or hide editor
        if (this._previousDocState && typeof Documents !== 'undefined') {
            Documents.openDocument(this._previousDocState.docId);
            this._previousDocState = null;
        } else {
            // Clear the editor and hide it
            if (Documents.squireEditor) {
                Documents._loadingDocument = true;
                Documents.squireEditor.setHTML('');
                setTimeout(() => { Documents._loadingDocument = false; }, 0);
            }
            if (UI.elements.documentEditor) {
                UI.elements.documentEditor.classList.remove('active');
            }
            if (UI.elements.chatContainer) {
                UI.elements.chatContainer.classList.remove('document-open');
            }
        }
    },

    setupAutoSave() {
        this.teardownAutoSave();

        if (!Documents.squireEditor) return;

        this._editorInputHandler = () => {
            if (Documents._loadingDocument) return;
            if (!this.openFilePath) return;

            if (this._autoSaveTimeout) clearTimeout(this._autoSaveTimeout);
            this._autoSaveTimeout = setTimeout(() => {
                if (this.isDirty()) {
                    this.saveCurrentFile();
                }
            }, this._autoSaveDelay);
        };

        Documents.squireEditor.addEventListener('input', this._editorInputHandler);
    },

    teardownAutoSave() {
        if (this._autoSaveTimeout) {
            clearTimeout(this._autoSaveTimeout);
            this._autoSaveTimeout = null;
        }

        if (this._editorInputHandler && Documents.squireEditor) {
            Documents.squireEditor.removeEventListener('input', this._editorInputHandler);
            this._editorInputHandler = null;
        }
    },

    isDirty() {
        if (!Documents.squireEditor || !this.openFileContent) return false;
        return Documents.squireEditor.getHTML() !== this.openFileContent;
    },

    // === UI Actions ===

    promptMkdir() {
        const name = prompt('New folder name:');
        if (!name || !name.trim()) return;

        const trimmed = name.trim();
        if (trimmed.includes('/')) {
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage('Folder name cannot contain slashes');
            }
            return;
        }

        const path = this.currentPath === '/'
            ? '/' + trimmed
            : this.currentPath + '/' + trimmed;
        this.createDirectory(path);
    },

    promptNewFile() {
        const name = prompt('New file name:');
        if (!name || !name.trim()) return;

        const trimmed = name.trim();
        if (trimmed.includes('/')) {
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage('File name cannot contain slashes');
            }
            return;
        }

        const path = this.currentPath === '/'
            ? '/' + trimmed
            : this.currentPath + '/' + trimmed;

        // Create the file with empty content via file_write (creates parent dirs too)
        Claxus.send({ type: 'file_write', path, content: '' });
        // Refresh listing after a short delay to let the write complete
        setTimeout(() => this.requestFileList(this.currentPath), 200);
    },

    promptRename(entryPath, currentName) {
        const newName = prompt('Rename to:', currentName);
        if (!newName || !newName.trim() || newName.trim() === currentName) return;

        const trimmed = newName.trim();
        if (trimmed.includes('/')) {
            if (typeof Chat !== 'undefined') {
                Chat.addSystemMessage('Name cannot contain slashes');
            }
            return;
        }

        this.renameEntry(entryPath, trimmed);
    },

    showContextMenu(e, entry) {
        e.preventDefault();
        e.stopPropagation();
        this.closeContextMenu();

        const fullPath = this.currentPath === '/'
            ? '/' + entry.name
            : this.currentPath + '/' + entry.name;

        const menu = document.createElement('div');
        menu.className = 'claxus-context-menu';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';

        const renameItem = document.createElement('div');
        renameItem.className = 'claxus-context-menu-item';
        renameItem.textContent = 'Rename';
        renameItem.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this.closeContextMenu();
            this.promptRename(fullPath, entry.name);
        });
        menu.appendChild(renameItem);

        document.body.appendChild(menu);

        // Adjust position if off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
        }
    },

    closeContextMenu() {
        const existing = document.querySelector('.claxus-context-menu');
        if (existing) existing.remove();
    },

    // === Drag and Drop ===

    _makeDropTarget(element, dirPath) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            // Don't allow dropping on self
            if (this._draggedEntry && this._draggedEntry.fullPath === dirPath) return;
            e.dataTransfer.dropEffect = 'move';
            element.classList.add('drop-over');
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('drop-over');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drop-over');

            if (!this._draggedEntry) return;

            const srcPath = this._draggedEntry.fullPath;
            const srcName = this._draggedEntry.name;

            // Don't drop into yourself or your own parent (no-op)
            if (srcPath === dirPath) return;
            const srcParent = srcPath.replace(/\/[^/]+\/?$/, '') || '/';
            if (srcParent === dirPath) return;

            const destination = dirPath === '/'
                ? '/' + srcName
                : dirPath + '/' + srcName;

            this.moveEntry(srcPath, destination);
        });
    },

    // === Rendering ===

    renderFileList(entries) {
        const list = document.getElementById('claxusFilesList');
        if (!list) return;

        list.innerHTML = '';

        // Sort: directories first, then alphabetically
        const sorted = [...entries].sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });

        // Add back button if not at root
        if (this.currentPath !== '/') {
            const parentPath = this.currentPath.replace(/\/[^/]+\/?$/, '') || '/';
            const backItem = document.createElement('div');
            backItem.className = 'claxus-file-item claxus-file-back';
            backItem.innerHTML = '<span class="file-icon">\u2190</span><span class="file-name">Back</span>';
            backItem.addEventListener('click', () => this.navigateTo(parentPath));

            // Back row is a drop target (move into parent)
            this._makeDropTarget(backItem, parentPath);
            list.appendChild(backItem);
        }

        sorted.forEach(entry => {
            const fullPath = this.currentPath === '/'
                ? '/' + entry.name
                : this.currentPath + '/' + entry.name;

            const item = ClaxusUI.createFileItem(entry, () => {
                if (entry.type === 'directory') {
                    this.navigateTo(fullPath);
                } else {
                    this.requestFileRead(fullPath);
                }
            });

            // Right-click for context menu (rename)
            item.addEventListener('contextmenu', (e) => this.showContextMenu(e, entry));

            // Drag source — all items are draggable
            item.draggable = true;
            item.addEventListener('dragstart', (e) => {
                this._draggedEntry = { name: entry.name, type: entry.type, fullPath };
                this._draggedElement = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', fullPath);
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this._draggedEntry = null;
                this._draggedElement = null;
                // Clean up all drop-over states
                list.querySelectorAll('.drop-over').forEach(el => el.classList.remove('drop-over'));
            });

            // Directories are drop targets
            if (entry.type === 'directory') {
                this._makeDropTarget(item, fullPath);
            }

            // Mark active if this file is currently open
            if (this.openFilePath && fullPath === this.openFilePath) {
                item.classList.add('active');
            }

            list.appendChild(item);
        });

        if (sorted.length === 0 && this.currentPath === '/') {
            const empty = document.createElement('div');
            empty.className = 'claxus-files-empty';
            empty.textContent = 'No files';
            list.appendChild(empty);
        }
    },

    renderBreadcrumb(path) {
        const container = document.getElementById('claxusFilesPath');
        if (!container) return;

        container.innerHTML = '';

        const parts = path.split('/').filter(Boolean);

        // Root
        const rootSpan = document.createElement('span');
        rootSpan.textContent = '/';
        rootSpan.addEventListener('click', () => this.navigateTo('/'));
        container.appendChild(rootSpan);

        parts.forEach((part, i) => {
            const sep = document.createTextNode(' > ');
            container.appendChild(sep);

            const span = document.createElement('span');
            span.textContent = part;
            const targetPath = '/' + parts.slice(0, i + 1).join('/');
            span.addEventListener('click', () => this.navigateTo(targetPath));
            container.appendChild(span);
        });
    },

    markActiveFile(path) {
        const list = document.getElementById('claxusFilesList');
        if (!list) return;

        list.querySelectorAll('.claxus-file-item').forEach(el => {
            el.classList.toggle('active', el.dataset.path === path);
        });
    },

    // === Text Conversion ===

    plainTextToHtml(text) {
        if (!text) return '<p><br></p>';
        // Escape HTML entities, then wrap lines in <pre> for monospace display
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return '<pre style="white-space:pre-wrap;word-wrap:break-word;font-family:monospace;font-size:13px;margin:0;padding:0;">' + escaped + '</pre>';
    },

    htmlToPlainText(html) {
        // Extract text from the <pre> wrapper, preserving whitespace
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // If wrapped in our <pre>, get its text content directly
        const pre = temp.querySelector('pre');
        if (pre) {
            return pre.textContent;
        }

        // Fallback: convert br to newlines, strip tags
        return temp.innerHTML
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    },

    // === Cleanup ===

    reset() {
        if (this.openFilePath) {
            this.closeFile();
        }

        this.currentPath = '/';
        this.collapsed = false;

        const list = document.getElementById('claxusFilesList');
        if (list) list.innerHTML = '';

        const pathEl = document.getElementById('claxusFilesPath');
        if (pathEl) pathEl.innerHTML = '';
    }
};
