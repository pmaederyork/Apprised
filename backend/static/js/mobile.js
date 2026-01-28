/**
 * Mobile detection and responsive state management.
 * Detects mobile/tablet breakpoints and manages body classes.
 */
const Mobile = {
    initialized: false,
    isMobile: false,
    isTablet: false,
    orientation: 'portrait',

    // Layout state
    documentOpen: false,
    chatCollapsed: false,
    toolbarExpanded: false,
    keyboardHeight: 0,
    reviewMode: false,

    // Breakpoints match CSS
    MOBILE_BREAKPOINT: 768,
    TABLET_MAX: 1024,

    init() {
        if (this.initialized) {
            console.warn('Mobile module already initialized');
            return;
        }

        this.detectDevice();
        this.bindEvents();
        this.bindPanelEvents();
        this.initKeyboardHandling();
        this.applyBodyClasses();
        this.updateLayoutClasses();

        this.initialized = true;
        console.log('Mobile module initialized:', {
            isMobile: this.isMobile,
            isTablet: this.isTablet,
            orientation: this.orientation
        });
    },

    detectDevice() {
        const width = window.innerWidth;

        // Mobile: < 768px
        this.isMobile = width < this.MOBILE_BREAKPOINT;

        // Tablet: 768-1024px (treated as mobile with landscape layout)
        this.isTablet = width >= this.MOBILE_BREAKPOINT && width <= this.TABLET_MAX;

        // Orientation detection
        this.orientation = window.matchMedia('(orientation: portrait)').matches
            ? 'portrait'
            : 'landscape';
    },

    bindEvents() {
        // Resize listener with debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.detectDevice();
                this.applyBodyClasses();
            }, 100);
        });

        // Orientation change listener
        window.addEventListener('orientationchange', () => {
            // Wait for orientation change to complete
            setTimeout(() => {
                this.detectDevice();
                this.applyBodyClasses();
                this.preserveFocus();
            }, 100);
        });

        // Media query listener for orientation
        const orientationQuery = window.matchMedia('(orientation: portrait)');
        orientationQuery.addEventListener('change', (e) => {
            this.orientation = e.matches ? 'portrait' : 'landscape';
            this.applyBodyClasses();
        });
    },

    applyBodyClasses() {
        const body = document.body;

        // Mobile class
        body.classList.toggle('is-mobile', this.isMobile || this.isTablet);

        // Tablet class (for tablet-specific styles)
        body.classList.toggle('is-tablet', this.isTablet);

        // Orientation classes
        body.classList.toggle('is-portrait', this.orientation === 'portrait');
        body.classList.toggle('is-landscape', this.orientation === 'landscape');

        // Update layout classes when device state changes
        this.updateLayoutClasses();
    },

    preserveFocus() {
        // Preserve focus and cursor position during orientation changes
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            const cursorPosition = activeElement.selectionStart;

            setTimeout(() => {
                activeElement.focus();
                if (cursorPosition !== undefined) {
                    activeElement.setSelectionRange(cursorPosition, cursorPosition);
                }
            }, 50);
        }
    },

    // Call this when document opens/closes (will be called by Documents module)
    setDocumentOpen(isOpen) {
        this.documentOpen = isOpen;
        this.updateLayoutClasses();
    },

    // Call this to collapse/expand chat
    setChatCollapsed(collapsed) {
        this.chatCollapsed = collapsed;
        this.updateLayoutClasses();
    },

    toggleChatCollapsed() {
        this.setChatCollapsed(!this.chatCollapsed);
    },

    // Call this when entering/exiting review mode (called by ClaudeChanges module)
    setReviewMode(active) {
        this.reviewMode = active;
        document.body.classList.toggle('review-mode', active);

        if (active) {
            // Ensure chat is not collapsed during review
            this.setChatCollapsed(false);
        }

        this.updateLayoutClasses();
        console.log('Mobile review mode:', active);
    },

    updateLayoutClasses() {
        const body = document.body;

        // Only apply layout classes on mobile
        if (!this.isMobileView()) {
            body.classList.remove('chat-only-mode', 'split-view', 'chat-collapsed', 'review-mode');
            return;
        }

        // Chat-only vs split view (review mode also enables split view)
        if (this.documentOpen || this.reviewMode) {
            body.classList.remove('chat-only-mode');
            body.classList.add('split-view');
        } else {
            body.classList.add('chat-only-mode');
            body.classList.remove('split-view');
        }

        // Chat collapsed state (not applicable in review mode)
        if (!this.reviewMode) {
            body.classList.toggle('chat-collapsed', this.chatCollapsed);
        } else {
            body.classList.remove('chat-collapsed');
        }

        // Review mode class is handled by setReviewMode
    },

    // Utility methods for other modules
    isMobileView() {
        return this.isMobile || this.isTablet;
    },

    isPortrait() {
        return this.orientation === 'portrait';
    },

    isLandscape() {
        return this.orientation === 'landscape';
    },

    bindPanelEvents() {
        // Toolbar toggle
        const toolbarToggleBtn = document.getElementById('toolbarToggleBtn');
        toolbarToggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleToolbar();
        });

        // Chat collapse
        const chatCollapseBtn = document.getElementById('chatCollapseBtn');
        chatCollapseBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleChatCollapsed();
        });

        // Collapsed chat bar - restore chat
        const collapsedChatBar = document.getElementById('collapsedChatBar');
        collapsedChatBar?.addEventListener('click', () => {
            this.setChatCollapsed(false);
        });

        // Mobile close editor button
        const mobileCloseEditorBtn = document.getElementById('mobileCloseEditorBtn');
        mobileCloseEditorBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof Documents !== 'undefined' && Documents.closeDocument) {
                Documents.closeDocument();
            }
            this.setDocumentOpen(false);
        });

        // Mobile save button
        const mobileSaveBtn = document.getElementById('mobileSaveBtn');
        mobileSaveBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof Documents !== 'undefined' && Documents.saveCurrentDocument) {
                Documents.saveCurrentDocument();
            }
        });
    },

    toggleToolbar() {
        this.toolbarExpanded = !this.toolbarExpanded;
        document.body.classList.toggle('toolbar-expanded', this.toolbarExpanded);

        const toggleBtn = document.getElementById('toolbarToggleBtn');
        toggleBtn?.classList.toggle('active', this.toolbarExpanded);
    },

    updateEditorTitle(title) {
        const titleEl = document.querySelector('.mobile-editor-header .editor-doc-title');
        if (titleEl) {
            titleEl.textContent = title || 'Untitled';
        }
    },

    initKeyboardHandling() {
        // Use VirtualKeyboard API if available (Chrome on Android)
        if ('virtualKeyboard' in navigator) {
            navigator.virtualKeyboard.overlaysContent = true;

            navigator.virtualKeyboard.addEventListener('geometrychange', (e) => {
                this.keyboardHeight = e.target.boundingRect.height;
                document.documentElement.style.setProperty(
                    '--keyboard-height',
                    `${this.keyboardHeight}px`
                );
                this.handleKeyboardChange();
            });
        } else {
            // Fallback: listen for visual viewport changes (Safari/older browsers)
            this.setupKeyboardFallback();
        }
    },

    setupKeyboardFallback() {
        // Track visual viewport changes for Safari/older browsers
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                const keyboardHeight = window.innerHeight - window.visualViewport.height;
                this.keyboardHeight = Math.max(0, keyboardHeight);
                document.documentElement.style.setProperty(
                    '--keyboard-height',
                    `${this.keyboardHeight}px`
                );
                this.handleKeyboardChange();
            });
        }
    },

    handleKeyboardChange() {
        // Scroll active input into view when keyboard appears
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            setTimeout(() => {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
};
