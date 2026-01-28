/**
 * Mobile Attachments
 * Long-press attachment menu and camera/photo capture on mobile.
 */
const MobileAttachments = {
    initialized: false,
    menuVisible: false,
    longPressTimer: null,
    LONG_PRESS_DURATION: 500,

    init() {
        if (this.initialized) {
            console.warn('MobileAttachments module already initialized');
            return;
        }

        this.menu = document.getElementById('mobileAttachmentMenu');
        this.backdrop = document.getElementById('mobileAttachmentBackdrop');
        this.cameraInput = document.getElementById('mobileCameraInput');
        this.photoInput = document.getElementById('mobilePhotoInput');
        this.fileInput = document.getElementById('mobileFileInput');

        this.bindEvents();
        this.initialized = true;
        console.log('MobileAttachments module initialized');
    },

    bindEvents() {
        // Long-press on message input
        const messageInput = document.getElementById('messageInput');
        const inputContainer = messageInput?.closest('.chat-input-container') || messageInput?.parentElement;

        if (messageInput) {
            messageInput.addEventListener('touchstart', (e) => this.handleInputTouchStart(e, inputContainer), { passive: true });
            messageInput.addEventListener('touchend', () => this.handleInputTouchEnd(inputContainer));
            messageInput.addEventListener('touchmove', () => this.cancelLongPress(inputContainer));
        }

        // Backdrop closes menu
        this.backdrop?.addEventListener('click', () => this.hideMenu());

        // Menu item handlers
        document.getElementById('attachCameraBtn')?.addEventListener('click', () => {
            this.hideMenu();
            this.openCamera();
        });

        document.getElementById('attachPhotoBtn')?.addEventListener('click', () => {
            this.hideMenu();
            this.openPhotoLibrary();
        });

        document.getElementById('attachFileBtn')?.addEventListener('click', () => {
            this.hideMenu();
            this.openFilePicker();
        });

        // File input change handlers
        this.cameraInput?.addEventListener('change', (e) => this.handleFileSelect(e));
        this.photoInput?.addEventListener('change', (e) => this.handleFileSelect(e));
        this.fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));

        // Optional: Add a dedicated attachment button (alternative to long-press)
        this.addAttachmentButton();
    },

    addAttachmentButton() {
        // Find the chat input area and add an attachment button
        const inputContainer = document.querySelector('.chat-input-container');
        if (!inputContainer) return;

        // Check if button already exists
        if (inputContainer.querySelector('.mobile-attach-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'mobile-attach-btn';
        btn.title = 'Add attachment';
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
        `;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMenu();
        });

        // Insert at the beginning of the container (before textarea)
        const textarea = inputContainer.querySelector('#messageInput');
        if (textarea) {
            inputContainer.insertBefore(btn, textarea);
        } else {
            inputContainer.prepend(btn);
        }
    },

    handleInputTouchStart(e, container) {
        // Only on mobile
        if (typeof Mobile !== 'undefined' && !Mobile.isMobileView()) return;

        // Don't trigger if already has text (allow normal selection)
        const input = e.target;
        if (input.value && input.value.length > 0) return;

        this.longPressTimer = setTimeout(() => {
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            container?.classList.add('long-press-active');
            this.showMenu();
        }, this.LONG_PRESS_DURATION);
    },

    handleInputTouchEnd(container) {
        this.cancelLongPress(container);
    },

    cancelLongPress(container) {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        container?.classList.remove('long-press-active');
    },

    showMenu() {
        if (!this.menu || !this.backdrop) return;

        this.menuVisible = true;
        this.menu.classList.add('visible');
        this.backdrop.classList.add('visible');
    },

    hideMenu() {
        if (!this.menu || !this.backdrop) return;

        this.menuVisible = false;
        this.menu.classList.remove('visible');
        this.backdrop.classList.remove('visible');
    },

    openCamera() {
        this.cameraInput?.click();
    },

    openPhotoLibrary() {
        this.photoInput?.click();
    },

    openFilePicker() {
        this.fileInput?.click();
    },

    handleFileSelect(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Pass to existing Files module if available
        if (typeof Files !== 'undefined' && Files.handleFileSelection) {
            Files.handleFileSelection(files);
        } else {
            // Fallback: Add to pending files for next message
            console.log('Files selected:', files);
            this.processFiles(files);
        }

        // Clear input for re-selection
        e.target.value = '';
    },

    processFiles(files) {
        // Basic file processing if Files module not available
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                this.previewImage(file);
            } else {
                console.log('File attached:', file.name);
            }
        });
    },

    previewImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Create preview if Files module handles it
            if (typeof Files !== 'undefined' && Files.addFilePreview) {
                Files.addFilePreview({
                    name: file.name,
                    type: file.type,
                    data: e.target.result
                });
            }
        };
        reader.readAsDataURL(file);
    }
};
