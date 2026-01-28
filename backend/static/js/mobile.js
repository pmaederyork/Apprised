/**
 * Mobile detection and responsive state management.
 * Detects mobile/tablet breakpoints and manages body classes.
 *
 * SINGLE SOURCE OF TRUTH FOR MOBILE BREAKPOINT
 * Change MOBILE_BREAKPOINT below to adjust when mobile UI is used.
 * All CSS uses body.is-mobile class which this module sets.
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

    /**
     * MOBILE BREAKPOINT - Single source of truth
     * Screens narrower than this get mobile UI (body.is-mobile class)
     * Currently: 500px (phones only, iPads get desktop)
     */
    MOBILE_BREAKPOINT: 500,
    TABLET_MAX: 500, // Disabled - iPads get desktop

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

        // Mobile: < 500px (phones only, iPads get desktop)
        this.isMobile = width < this.MOBILE_BREAKPOINT;

        // Tablet detection disabled - iPads get desktop version
        this.isTablet = false;

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

        const reviewPanel = document.getElementById('documentChangeReview');

        if (active) {
            // Ensure chat is not collapsed during review
            this.setChatCollapsed(false);

            // Move review panel to body to escape any transform containers
            if (reviewPanel && reviewPanel.parentElement !== document.body) {
                this._originalReviewParent = reviewPanel.parentElement;
                this._originalReviewNextSibling = reviewPanel.nextSibling;
                document.body.appendChild(reviewPanel);
            }
        } else {
            // Restore review panel to original location
            if (reviewPanel && this._originalReviewParent) {
                if (this._originalReviewNextSibling) {
                    this._originalReviewParent.insertBefore(reviewPanel, this._originalReviewNextSibling);
                } else {
                    this._originalReviewParent.appendChild(reviewPanel);
                }
                this._originalReviewParent = null;
                this._originalReviewNextSibling = null;
            }
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

        // Mobile save button - saves to Google Drive (same as desktop)
        // Creates new Drive doc if not linked, updates existing if linked
        const mobileSaveBtn = document.getElementById('mobileSaveBtn');
        mobileSaveBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (typeof Documents !== 'undefined' && Documents.currentDocumentId) {
                const docId = Documents.currentDocumentId;

                // Visual feedback - show saving state
                mobileSaveBtn.style.color = 'var(--color-warning, #ff9800)';
                console.log('Mobile save: Saving to Google Drive...');

                try {
                    // Same as desktop - saveToDrive handles everything:
                    // - Creates new Drive doc if not linked
                    // - Updates existing Drive doc if linked
                    // - Shows "not connected" dialog if Drive isn't connected
                    await Documents.saveToDrive(docId);
                    console.log('Mobile save: Google Drive save complete');
                    // Success - green
                    mobileSaveBtn.style.color = 'var(--color-success, #4caf50)';
                } catch (err) {
                    console.error('Mobile save: Google Drive save failed:', err);
                    // Error - red
                    mobileSaveBtn.style.color = 'var(--color-error, #e53935)';
                }

                // Reset color after delay
                setTimeout(() => {
                    mobileSaveBtn.style.color = '';
                }, 1000);
            } else {
                console.warn('Mobile save: No document open');
            }
        });

        // Mobile pull from Drive button - with color feedback
        const mobilePullBtn = document.getElementById('mobilePullBtn');
        mobilePullBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (typeof GDrive !== 'undefined' && typeof Documents !== 'undefined' && Documents.currentDocumentId) {
                const docId = Documents.currentDocumentId;

                // Visual feedback - show pulling state
                mobilePullBtn.style.color = 'var(--color-warning, #ff9800)';
                console.log('Mobile pull: Pulling from Google Drive...');

                try {
                    const result = await GDrive.pullFromDrive(docId);
                    if (result && result.success) {
                        console.log('Mobile pull: Google Drive pull complete');
                        // Success - green
                        mobilePullBtn.style.color = 'var(--color-success, #4caf50)';
                    } else {
                        console.warn('Mobile pull: Pull returned unsuccessful');
                        // Unsuccessful - red
                        mobilePullBtn.style.color = 'var(--color-error, #e53935)';
                    }
                } catch (err) {
                    console.error('Mobile pull: Google Drive pull failed:', err);
                    // Error - red
                    mobilePullBtn.style.color = 'var(--color-error, #e53935)';
                }

                // Reset color after delay
                setTimeout(() => {
                    mobilePullBtn.style.color = '';
                }, 1000);
            }
        });

        // Mobile GDrive status button - saves to Drive
        const mobileGdriveStatusBtn = document.getElementById('mobileGdriveStatusBtn');
        mobileGdriveStatusBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof Documents !== 'undefined' && Documents.currentDocumentId) {
                Documents.saveToDrive(Documents.currentDocumentId);
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
            // Works for both input (value) and span (textContent)
            if (titleEl.tagName === 'INPUT') {
                titleEl.value = title || 'Untitled';
            } else {
                titleEl.textContent = title || 'Untitled';
            }
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
            let debounceTimer;

            const handleViewportChange = () => {
                // Debounce rapid changes (iOS Safari fires many events)
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const keyboardHeight = window.innerHeight - window.visualViewport.height;
                    this.keyboardHeight = Math.max(0, keyboardHeight);
                    document.documentElement.style.setProperty(
                        '--keyboard-height',
                        `${this.keyboardHeight}px`
                    );
                    this.handleKeyboardChange();
                }, 50);
            };

            window.visualViewport.addEventListener('resize', handleViewportChange);
            window.visualViewport.addEventListener('scroll', handleViewportChange);

            // Also trigger on initial load in case keyboard was already open
            handleViewportChange();
        }

        // Fallback for browsers without visualViewport - use focus/blur on inputs
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                // Assume keyboard will open, give iOS time to show it
                setTimeout(() => {
                    if (window.visualViewport) {
                        const keyboardHeight = window.innerHeight - window.visualViewport.height;
                        if (keyboardHeight > 50) {
                            this.keyboardHeight = keyboardHeight;
                            document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
                            this.handleKeyboardChange();
                        }
                    }
                }, 300);
            }
        });

        document.addEventListener('focusout', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                // Keyboard likely closing
                setTimeout(() => {
                    if (window.visualViewport) {
                        const keyboardHeight = window.innerHeight - window.visualViewport.height;
                        if (keyboardHeight < 50) {
                            this.keyboardHeight = 0;
                            document.documentElement.style.setProperty('--keyboard-height', '0px');
                            this.handleKeyboardChange();
                        }
                    }
                }, 100);
            }
        });
    },

    handleKeyboardChange() {
        const isKeyboardOpen = this.keyboardHeight > 50; // Threshold to detect real keyboard

        // Toggle keyboard-open class for CSS
        document.body.classList.toggle('keyboard-open', isKeyboardOpen);

        // Log for debugging
        console.log('Keyboard change:', isKeyboardOpen ? 'open' : 'closed', 'height:', this.keyboardHeight);

        // Directly adjust layouts for iOS Safari (CSS variables may not work reliably)
        this.adjustLayoutForKeyboard(isKeyboardOpen);

        // Scroll active input into view when keyboard appears
        const activeElement = document.activeElement;
        if (isKeyboardOpen && activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
            setTimeout(() => {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
        }
    },

    adjustLayoutForKeyboard(isOpen) {
        // Get elements that need adjustment
        const chatContainer = document.querySelector('.chat-container');
        const appContainer = document.querySelector('.app-container');

        if (isOpen && this.keyboardHeight > 0) {
            // Apply direct styles for keyboard open state
            if (chatContainer && document.body.classList.contains('chat-only-mode')) {
                chatContainer.style.bottom = `${this.keyboardHeight}px`;
            }

            if (appContainer && document.body.classList.contains('split-view')) {
                appContainer.style.height = `calc(100dvh - ${this.keyboardHeight}px)`;
            }
        } else {
            // Reset to default (let CSS handle it)
            if (chatContainer) {
                chatContainer.style.bottom = '';
            }
            if (appContainer) {
                appContainer.style.height = '';
            }
        }
    }
};
