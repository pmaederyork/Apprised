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

    // Add file to selection
    addFile(file) {
        const fileData = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            file: file,
            name: file.name,
            type: file.type,
            size: file.size
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
            if (fileData.type.includes('pdf')) {
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
    }
};