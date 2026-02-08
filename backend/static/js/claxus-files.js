/**
 * Claxus File Browser module
 * Browse, open, edit, and save files from the /.claxus container directory
 * Files are accessed via WebSocket messages through the Claxus gateway
 * Uses its own Squire editor instance, independent of Documents module
 */
const ClaxusFiles = {
    currentPath: '/',
    openFilePath: null,
    openFileContent: null,
    collapsed: false,
    initialized: false,
    squireEditor: null,
    _loadingFile: false,
    _autoSaveTimeout: null,
    _autoSaveDelay: 500,
    _editorInputHandler: null,
    _draggedEntry: null,
    _draggedElement: null,

    init() {
        if (this.initialized) return;
        this.bindEvents();
        this.initialized = true;
    },

    /**
     * Initialize own Squire editor on the Claxus document textarea
     */
    initEditor() {
        const container = ClaxusUI.elements.documentTextarea;
        if (!container || this.squireEditor) return;

        try {
            this.squireEditor = new Squire(container, {
                blockTag: 'pre',
                blockAttributes: {
                    style: 'white-space:pre-wrap;word-wrap:break-word;font-family:monospace;font-size:13px;margin:0;padding:0;'
                }
            });
            console.log('[ClaxusFiles] Squire editor initialized');
        } catch (e) {
            console.error('[ClaxusFiles] Failed to init Squire:', e);
        }
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

        // Claxus editor Pull/Save/Close buttons (desktop)
        ClaxusUI.elements.editorPullBtn?.addEventListener('click', () => {
            if (this.openFilePath) this.requestFileRead(this.openFilePath);
        });
        ClaxusUI.elements.editorSaveBtn?.addEventListener('click', () => {
            this.saveCurrentFile();
        });
        ClaxusUI.elements.closeEditorBtn?.addEventListener('click', () => {
            this.closeFile();
        });

        // Mobile buttons
        ClaxusUI.elements.editorMobilePullBtn?.addEventListener('click', () => {
            if (this.openFilePath) this.requestFileRead(this.openFilePath);
        });
        ClaxusUI.elements.editorMobileSaveBtn?.addEventListener('click', () => {
            this.saveCurrentFile();
        });
        ClaxusUI.elements.mobileCloseEditorBtn?.addEventListener('click', () => {
            this.closeFile();
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
        if (!this.openFilePath || !this.squireEditor) return;

        const html = this.squireEditor.getHTML();
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
            if (data.path === this.openFilePath && this.squireEditor) {
                this.openFileContent = this.squireEditor.getHTML();
            }
            console.log('[ClaxusFiles] Saved:', data.path);
        } else {
            console.error('[ClaxusFiles] Save failed:', data.path);
        }
    },

    handleFileError(data) {
        console.error('[ClaxusFiles] Error:', data.error, 'path:', data.path);
        ClaxusUI.addSystemMessage(`File error: ${data.error}`);
    },

    handleFileCreated(data) {
        if (data.success) {
            this.requestFileList(this.currentPath);
        }
    },

    handleFileRenamed(data) {
        if (data.success) {
            if (this.openFilePath === data.path) {
                this.openFilePath = data.destination;
                const filename = data.destination.split('/').pop();
                if (ClaxusUI.elements.documentTitle) ClaxusUI.elements.documentTitle.value = filename;
                if (ClaxusUI.elements.mobileDocumentTitle) ClaxusUI.elements.mobileDocumentTitle.value = filename;
            }
            this.requestFileList(this.currentPath);
        }
    },

    handleFileMoved(data) {
        if (data.success) {
            if (this.openFilePath === data.path) {
                this.openFilePath = data.destination;
                const filename = data.destination.split('/').pop();
                if (ClaxusUI.elements.documentTitle) ClaxusUI.elements.documentTitle.value = filename;
                if (ClaxusUI.elements.mobileDocumentTitle) ClaxusUI.elements.mobileDocumentTitle.value = filename;
            }
            this.requestFileList(this.currentPath);
        }
    },

    // === Editor Integration ===

    openInEditor(path, content) {
        if (!this.squireEditor) return;

        this.openFilePath = path;

        // Convert plain text to HTML for Squire
        const html = this.plainTextToHtml(content);
        this.openFileContent = html;

        // Set title to filename (read-only)
        const filename = path.split('/').pop() || path;
        if (ClaxusUI.elements.documentTitle) {
            ClaxusUI.elements.documentTitle.value = filename;
        }
        if (ClaxusUI.elements.mobileDocumentTitle) {
            ClaxusUI.elements.mobileDocumentTitle.value = filename;
        }

        // Load content into our own Squire editor
        this._loadingFile = true;
        this.squireEditor.setHTML(html);
        setTimeout(() => { this._loadingFile = false; }, 0);

        // Show Claxus document editor
        if (ClaxusUI.elements.documentEditor) {
            ClaxusUI.elements.documentEditor.classList.add('active');
        }
        if (ClaxusUI.elements.chatContainer) {
            ClaxusUI.elements.chatContainer.classList.add('document-open');
        }

        // Mark active file in file list
        this.markActiveFile(path);

        // Set up auto-save on input
        this.setupAutoSave();
    },

    closeFile() {
        this.teardownAutoSave();

        this.openFilePath = null;
        this.openFileContent = null;

        // Clear active state in file list
        const list = document.getElementById('claxusFilesList');
        if (list) {
            list.querySelectorAll('.claxus-file-item.active').forEach(el => el.classList.remove('active'));
        }

        // Clear editor and hide
        if (this.squireEditor) {
            this._loadingFile = true;
            this.squireEditor.setHTML('');
            setTimeout(() => { this._loadingFile = false; }, 0);
        }
        if (ClaxusUI.elements.documentEditor) {
            ClaxusUI.elements.documentEditor.classList.remove('active');
        }
        if (ClaxusUI.elements.chatContainer) {
            ClaxusUI.elements.chatContainer.classList.remove('document-open');
        }
    },

    setupAutoSave() {
        this.teardownAutoSave();

        if (!this.squireEditor) return;

        this._editorInputHandler = () => {
            if (this._loadingFile) return;
            if (!this.openFilePath) return;

            if (this._autoSaveTimeout) clearTimeout(this._autoSaveTimeout);
            this._autoSaveTimeout = setTimeout(() => {
                if (this.isDirty()) {
                    this.saveCurrentFile();
                }
            }, this._autoSaveDelay);
        };

        this.squireEditor.addEventListener('input', this._editorInputHandler);
    },

    teardownAutoSave() {
        if (this._autoSaveTimeout) {
            clearTimeout(this._autoSaveTimeout);
            this._autoSaveTimeout = null;
        }

        if (this._editorInputHandler && this.squireEditor) {
            this.squireEditor.removeEventListener('input', this._editorInputHandler);
            this._editorInputHandler = null;
        }
    },

    isDirty() {
        if (!this.squireEditor || !this.openFileContent) return false;
        return this.squireEditor.getHTML() !== this.openFileContent;
    },

    // === UI Actions ===

    promptMkdir() {
        const name = prompt('New folder name:');
        if (!name || !name.trim()) return;

        const trimmed = name.trim();
        if (trimmed.includes('/')) {
            ClaxusUI.addSystemMessage('Folder name cannot contain slashes');
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
            ClaxusUI.addSystemMessage('File name cannot contain slashes');
            return;
        }

        const path = this.currentPath === '/'
            ? '/' + trimmed
            : this.currentPath + '/' + trimmed;

        Claxus.send({ type: 'file_write', path, content: '' });
        setTimeout(() => this.requestFileList(this.currentPath), 200);
    },

    promptRename(entryPath, currentName) {
        const newName = prompt('Rename to:', currentName);
        if (!newName || !newName.trim() || newName.trim() === currentName) return;

        const trimmed = newName.trim();
        if (trimmed.includes('/')) {
            ClaxusUI.addSystemMessage('Name cannot contain slashes');
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

        const sorted = [...entries].sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });

        if (this.currentPath !== '/') {
            const parentPath = this.currentPath.replace(/\/[^/]+\/?$/, '') || '/';
            const backItem = document.createElement('div');
            backItem.className = 'claxus-file-item claxus-file-back';
            backItem.innerHTML = '<span class="file-icon">\u2190</span><span class="file-name">Back</span>';
            backItem.addEventListener('click', () => this.navigateTo(parentPath));
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

            item.addEventListener('contextmenu', (e) => this.showContextMenu(e, entry));

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
                list.querySelectorAll('.drop-over').forEach(el => el.classList.remove('drop-over'));
            });

            if (entry.type === 'directory') {
                this._makeDropTarget(item, fullPath);
            }

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
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return '<pre style="white-space:pre-wrap;word-wrap:break-word;font-family:monospace;font-size:13px;margin:0;padding:0;">' + escaped + '</pre>';
    },

    htmlToPlainText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        const pre = temp.querySelector('pre');
        if (pre) {
            return pre.textContent;
        }

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
