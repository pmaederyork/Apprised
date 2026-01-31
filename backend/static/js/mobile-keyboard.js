/**
 * iOS Keyboard Handler
 * Uses visualViewport API to keep the chat interface visible when keyboard opens.
 *
 * On iOS Safari, the keyboard doesn't resize the layout viewport - it scrolls
 * the page instead. This causes position:fixed elements to move off-screen.
 *
 * Solution: Resize and reposition the chat-container to match the visual viewport.
 * The internal flex layout then automatically adjusts header/messages/input.
 */
const MobileKeyboard = {
    initialized: false,
    pendingUpdate: false,
    appContainerEl: null,
    chatContainerEl: null,
    messagesEl: null,
    inputEl: null,

    init() {
        if (this.initialized) return;
        if (typeof Mobile !== 'undefined' && !Mobile.isMobileView()) return;
        if (!window.visualViewport) return;

        // Cache DOM elements
        this.appContainerEl = document.querySelector('.app-container');
        this.chatContainerEl = document.querySelector('.chat-container');
        this.messagesEl = document.querySelector('.chat-messages');
        this.inputEl = document.querySelector('.chat-input-container');

        if (!this.chatContainerEl) return;

        this.bindEvents();
        this.measureComposer();
        this.update(); // Initial positioning
        this.initialized = true;
        console.log('MobileKeyboard module initialized');
    },

    bindEvents() {
        const vv = window.visualViewport;

        // Throttled viewport change handler
        const onViewportChange = () => {
            if (this.pendingUpdate) return;
            this.pendingUpdate = true;
            requestAnimationFrame(() => {
                this.pendingUpdate = false;
                this.update();
            });
        };

        vv.addEventListener('resize', onViewportChange);
        vv.addEventListener('scroll', onViewportChange);

        // iOS 26.0 workaround: force reset on input blur
        if (this.inputEl) {
            this.inputEl.addEventListener('focusout', () => this.handleFocusOut());
        }

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.update(), 200);
        });

        // Measure composer on resize (for dynamic height changes)
        if (this.inputEl && window.ResizeObserver) {
            new ResizeObserver(() => this.measureComposer()).observe(this.inputEl);
        }

        document.fonts?.ready?.then(() => this.measureComposer());
    },

    measureComposer() {
        if (!this.inputEl) return;
        const height = this.inputEl.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--composer-height', `${height}px`);
    },

    update() {
        const vv = window.visualViewport;
        if (!vv) return;

        // Calculate keyboard offset
        const offsetTop = vv.offsetTop;
        const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const keyboardVisible = keyboardHeight > 100;

        // Determine which container to resize based on mode
        const isChatOnlyMode = document.body.classList.contains('chat-only-mode');
        const isSplitView = document.body.classList.contains('split-view');

        // In chat-only mode, resize chat-container
        // In split-view mode, resize app-container
        const targetEl = isChatOnlyMode ? this.chatContainerEl :
                         isSplitView ? this.appContainerEl : null;

        if (!targetEl) return;

        if (keyboardVisible) {
            // Resize container to fit visual viewport
            // Use setProperty with 'important' to override PWA standalone CSS
            targetEl.style.setProperty('height', `${vv.height}px`, 'important');
            targetEl.style.setProperty('top', `${offsetTop}px`, 'important');
            targetEl.style.setProperty('bottom', 'auto', 'important');

            // Auto-scroll messages to bottom
            if (this.messagesEl) {
                this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
            }
        } else {
            // Reset all containers - remove inline important styles
            // This handles mode switches (e.g., closing doc while keyboard was open)
            if (this.chatContainerEl) {
                this.chatContainerEl.style.removeProperty('height');
                this.chatContainerEl.style.removeProperty('top');
                this.chatContainerEl.style.removeProperty('bottom');
            }
            if (this.appContainerEl) {
                this.appContainerEl.style.removeProperty('height');
                this.appContainerEl.style.removeProperty('top');
                this.appContainerEl.style.removeProperty('bottom');
            }
        }
    },

    handleFocusOut() {
        // iOS 26.0 bug: offsetTop may not reset after keyboard dismissal
        setTimeout(() => {
            const vv = window.visualViewport;
            if (vv && vv.offsetTop > 0 && vv.height >= window.innerHeight - 50) {
                // Keyboard should be closed but offsetTop is stuck
                // Force a scroll correction
                window.scrollBy(0, -1);
                window.scrollBy(0, 1);
            }
            this.update();
        }, 150);
    },

    // Called by Mobile module on orientation change
    forceUpdate() {
        this.update();
        setTimeout(() => this.update(), 200);
    }
};
