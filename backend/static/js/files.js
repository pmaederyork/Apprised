/**
 * File upload and management module
 */
const Files = {
    // Selected files for the next message
    selectedFiles: [],
    
    // DOM elements
    elements: {
        fileInput: null,
        fileBtn: null,
        filePreviewArea: null
    },

    // Initialize file handling
    init() {
        this.elements.fileInput = document.getElementById('fileInput');
        this.elements.fileBtn = document.getElementById('fileBtn');
        this.elements.filePreviewArea = document.getElementById('filePreviewArea');
        
        this.bindEvents();
    },

    // Bind event listeners
    bindEvents() {
        // File button click
        if (this.elements.fileBtn) {
            this.elements.fileBtn.addEventListener('click', () => {
                this.elements.fileInput.click();
            });
        }

        // File input change
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        // Paste event listeners
        this.bindPasteEvents();
    },

    // Bind paste event listeners
    bindPasteEvents() {
        // Listen for paste events globally
        document.addEventListener('paste', (e) => {
            this.handlePaste(e);
        });

        // Prevent default paste behavior on message input to handle it ourselves
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('paste', (e) => {
                // Let the paste event bubble up to be handled by global handler
                // The global handler will decide whether to prevent default
            });
        }
    },

    // Handle paste events
    async handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        // Check if document editor is focused - if so, let the documents module handle smart conversion
        const documentTextarea = document.getElementById('documentTextarea');
        if (documentTextarea && document.activeElement === documentTextarea) {
            return; // Let the documents module handle the paste with smart conversion
        }

        let hasFileContent = false;

        // Handle files from clipboard (images, documents)
        if (clipboardData.files && clipboardData.files.length > 0) {
            hasFileContent = true;
            e.preventDefault();
            this.handleFileSelection(clipboardData.files);
            
            // Show feedback based on file type
            const files = Array.from(clipboardData.files);
            if (files.some(f => f.type.startsWith('image/'))) {
                this.showPasteNotification('Image(s) pasted as attachment');
            } else {
                this.showPasteNotification('File(s) pasted as attachment');
            }
            return;
        }

        // Handle text content
        const textData = clipboardData.getData('text/plain');
        if (textData && textData.length > 500) {
            hasFileContent = true;
            e.preventDefault();
            this.addTextAsFile(textData);
            return;
        }

        // Handle HTML content (like copied from web pages)
        const htmlData = clipboardData.getData('text/html');
        if (htmlData && htmlData.length > 500 && !textData) {
            hasFileContent = true;
            e.preventDefault();
            this.addHtmlAsFile(htmlData);
            return;
        }

        // If we get here, it's short text that should go directly to input
        // Let the default paste behavior happen
    },

    // Handle file selection
    handleFileSelection(files) {
        Array.from(files).forEach(file => {
            if (this.validateFile(file)) {
                this.addFile(file);
            }
        });
        
        // Clear the input so the same file can be selected again
        this.elements.fileInput.value = '';
        
        this.updatePreviewArea();
    },

    // Validate file
    validateFile(file) {
        // For now, accept all files as requested
        // TODO: Add specific validation if needed later
        return true;
    },

    // Add text content as a file
    addTextAsFile(textContent) {
        const blob = new Blob([textContent], { type: 'text/plain' });
        const fileName = `pasted-text-${Date.now()}.txt`;
        const file = new File([blob], fileName, { type: 'text/plain' });
        
        this.addFile(file);
        this.updatePreviewArea();
        
        // Show user feedback
        this.showPasteNotification('Long text pasted as file attachment');
    },

    // Add HTML content as a file
    addHtmlAsFile(htmlContent) {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const fileName = `pasted-content-${Date.now()}.html`;
        const file = new File([blob], fileName, { type: 'text/html' });
        
        this.addFile(file);
        this.updatePreviewArea();
        
        // Show user feedback
        this.showPasteNotification('Web content pasted as file attachment');
    },

    // Add file to selection
    addFile(file) {
        const fileData = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            file: file,
            name: file.name,
            type: file.type,
            size: file.size,
            isPasted: file.name.startsWith('pasted-') // Track if this was pasted content
        };

        this.selectedFiles.push(fileData);
    },

    // Remove file from selection
    removeFile(fileId) {
        this.selectedFiles = this.selectedFiles.filter(f => f.id !== fileId);
        this.updatePreviewArea();
    },

    // Update preview area
    updatePreviewArea() {
        if (this.selectedFiles.length === 0) {
            this.elements.filePreviewArea.style.display = 'none';
            this.elements.filePreviewArea.innerHTML = '';
            return;
        }

        this.elements.filePreviewArea.style.display = 'flex';
        this.elements.filePreviewArea.innerHTML = '';

        this.selectedFiles.forEach(fileData => {
            const thumbnail = this.createThumbnail(fileData);
            this.elements.filePreviewArea.appendChild(thumbnail);
        });
    },

    // Create thumbnail for file
    createThumbnail(fileData) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'file-thumbnail';
        
        // Add special class for pasted content
        if (fileData.isPasted) {
            thumbnail.classList.add('pasted-content');
        }

        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove file';
        removeBtn.addEventListener('click', () => {
            this.removeFile(fileData.id);
        });

        // Create content based on file type
        if (fileData.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(fileData.file);
            img.alt = fileData.name;
            thumbnail.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.className = 'file-icon';
            
            // Use different icons for different file types
            if (fileData.isPasted && fileData.type.includes('text')) {
                icon.textContent = '📋'; // Clipboard icon for pasted text
            } else if (fileData.isPasted && fileData.type.includes('html')) {
                icon.textContent = '🌐'; // Web icon for pasted HTML
            } else if (fileData.type.includes('pdf')) {
                icon.textContent = '📄';
            } else if (fileData.type.includes('text')) {
                icon.textContent = '📝';
            } else if (fileData.type.includes('video')) {
                icon.textContent = '🎥';
            } else if (fileData.type.includes('audio')) {
                icon.textContent = '🎵';
            } else {
                icon.textContent = '📎';
            }
            thumbnail.appendChild(icon);
        }

        // Add file name/info
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        
        if (fileData.isPasted) {
            // Show preview of pasted content
            if (fileData.type.includes('text')) {
                fileName.textContent = 'Pasted Text';
            } else if (fileData.type.includes('html')) {
                fileName.textContent = 'Pasted Content';
            } else {
                fileName.textContent = fileData.name;
            }
        } else {
            fileName.textContent = fileData.name;
        }
        
        thumbnail.appendChild(fileName);
        thumbnail.appendChild(removeBtn);
        return thumbnail;
    },

    // Get selected files for message sending
    getSelectedFiles() {
        return this.selectedFiles;
    },

    // Clear selected files (after sending message)
    clearSelectedFiles() {
        this.selectedFiles = [];
        this.updatePreviewArea();
    },

    // Convert file to base64 for storage/transmission
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // Convert files to base64 for API transmission
    async prepareFilesForAPI() {
        const filesData = [];
        
        for (const fileData of this.selectedFiles) {
            try {
                const base64 = await this.fileToBase64(fileData.file);
                filesData.push({
                    id: fileData.id,
                    name: fileData.name,
                    type: fileData.type,
                    size: fileData.size,
                    data: base64
                });
            } catch (error) {
                console.error('Failed to convert file to base64:', error);
                UI.showError('Failed to process file: ' + fileData.name);
            }
        }
        
        return filesData;
    },

    // Show paste notification
    showPasteNotification(message) {
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'paste-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ea580c;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            font-size: 14px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
        }, 3000);
    }
};