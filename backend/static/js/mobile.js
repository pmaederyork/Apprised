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

    updateLayoutClasses() {
        const body = document.body;

        // Only apply layout classes on mobile
        if (!this.isMobileView()) {
            body.classList.remove('chat-only-mode', 'split-view', 'chat-collapsed');
            return;
        }

        // Chat-only vs split view
        if (this.documentOpen) {
            body.classList.remove('chat-only-mode');
            body.classList.add('split-view');
        } else {
            body.classList.add('chat-only-mode');
            body.classList.remove('split-view');
        }

        // Chat collapsed state
        body.classList.toggle('chat-collapsed', this.chatCollapsed);
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
    }
};
