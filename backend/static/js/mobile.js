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
        this.setupScrollLock();
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
        const chatCollapseBtn = document.getElementById('chatCollapseBtn');

        // Only apply layout classes on mobile
        if (!this.isMobileView()) {
            body.classList.remove('chat-only-mode', 'split-view', 'chat-collapsed', 'review-mode');
            // Show collapse button on desktop (if it exists)
            if (chatCollapseBtn) chatCollapseBtn.style.display = '';
            return;
        }

        // Chat-only vs split view (review mode also enables split view)
        if (this.documentOpen || this.reviewMode) {
            body.classList.remove('chat-only-mode');
            body.classList.add('split-view');
            // Show collapse button in split view
            if (chatCollapseBtn) chatCollapseBtn.style.display = '';
        } else {
            body.classList.add('chat-only-mode');
            body.classList.remove('split-view');
            // Hide collapse button in chat-only mode (nothing to collapse to)
            if (chatCollapseBtn) chatCollapseBtn.style.display = 'none';
            // Also ensure chat isn't collapsed when no document open
            this.chatCollapsed = false;
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

        // Mobile close editor button - same behavior as desktop
        const mobileCloseEditorBtn = document.getElementById('mobileCloseEditorBtn');
        mobileCloseEditorBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof Documents !== 'undefined' && Documents.closeEditor) {
                Documents.closeEditor(); // Handles save, GDrive sync, sidebar, chat message, etc.
            }
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
        // Track keyboard state
        this._lastKeyboardHeight = 0;
        this._keyboardAnimationFrame = null;
        this._pendingKeyboardHeight = null;

        // Use VirtualKeyboard API if available (Chrome on Android)
        if ('virtualKeyboard' in navigator) {
            navigator.virtualKeyboard.overlaysContent = true;

            navigator.virtualKeyboard.addEventListener('geometrychange', (e) => {
                this.scheduleKeyboardUpdate(e.target.boundingRect.height);
            });
        } else {
            // Fallback: listen for visual viewport changes (Safari/older browsers)
            this.setupKeyboardFallback();
        }
    },

    setupKeyboardFallback() {
        if (!window.visualViewport) return;

        // Handler for viewport resize - fires during keyboard animation
        const handleViewportResize = () => {
            const keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
            this.scheduleKeyboardUpdate(keyboardHeight);
        };

        // Listen to resize for keyboard height changes
        window.visualViewport.addEventListener('resize', handleViewportResize);

        // Polling fallback for smooth animation
        // iOS visualViewport.resize may not fire every frame during keyboard animation
        // Poll at 60fps during focus transitions to ensure smooth tracking
        let pollingInterval = null;

        const startPolling = () => {
            if (pollingInterval || !this.isMobileView()) return;
            pollingInterval = setInterval(handleViewportResize, 16); // ~60fps
            // Stop polling after keyboard animation completes (500ms max)
            setTimeout(stopPolling, 500);
        };

        const stopPolling = () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        };

        // Start polling on focus events (keyboard may open)
        document.addEventListener('focusin', (e) => {
            const target = e.target;
            const isTextInput = target.tagName === 'TEXTAREA' ||
                               target.tagName === 'INPUT' ||
                               target.isContentEditable;
            if (isTextInput) {
                startPolling();
            }
        }, { capture: true, passive: true });

        // Start polling on blur too (keyboard may close)
        document.addEventListener('focusout', () => {
            startPolling();
        }, { capture: true, passive: true });

        // Initial check
        handleViewportResize();
    },

    /**
     * Schedule keyboard height update via RAF for smooth animation.
     * Multiple rapid events are batched into a single frame update.
     */
    scheduleKeyboardUpdate(newHeight) {
        this._pendingKeyboardHeight = newHeight;

        // Batch updates using RAF for smooth animation
        if (!this._keyboardAnimationFrame) {
            this._keyboardAnimationFrame = requestAnimationFrame(() => {
                this._keyboardAnimationFrame = null;
                if (this._pendingKeyboardHeight !== null) {
                    this.updateKeyboardHeight(this._pendingKeyboardHeight);
                    this._pendingKeyboardHeight = null;
                }
            });
        }
    },

    /**
     * Lock window-level scroll on mobile.
     * iOS can scroll the page when keyboard opens to show focused input.
     * We handle keyboard via --keyboard-height CSS, so this scroll is unwanted.
     * This lock prevents the header from ever leaving the screen.
     */
    setupScrollLock() {
        // Always lock window scroll on mobile - only internal containers should scroll
        const lockScroll = () => {
            if (!this.isMobileView()) return;
            if (window.scrollX !== 0 || window.scrollY !== 0) {
                window.scrollTo(0, 0);
            }
        };

        // Catch any window scroll and reset immediately
        window.addEventListener('scroll', lockScroll, { passive: true });

        // Also catch visualViewport scroll (iOS keyboard-induced panning)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('scroll', () => {
                if (!this.isMobileView()) return;
                // offsetTop > 0 means iOS has panned the viewport
                if (window.visualViewport.offsetTop > 0) {
                    window.scrollTo(0, 0);
                }
            }, { passive: true });
        }

        // Initial reset
        lockScroll();
    },

    updateKeyboardHeight(newHeight) {
        // Round to avoid subpixel issues
        newHeight = Math.round(newHeight);

        // Skip if no meaningful change (< 5px avoids flicker from tiny variations)
        if (Math.abs(newHeight - this._lastKeyboardHeight) < 5) return;

        const wasOpen = this._lastKeyboardHeight > 50;
        const isKeyboardOpen = newHeight > 50;
        const isOpening = isKeyboardOpen && !wasOpen;
        const isClosing = !isKeyboardOpen && wasOpen;

        // Update state
        this.keyboardHeight = newHeight;
        this._lastKeyboardHeight = newHeight;

        // Update CSS variable - this drives all layout changes
        document.documentElement.style.setProperty('--keyboard-height', `${newHeight}px`);

        // Update keyboard-open class only on state transitions (not during animation)
        if (isOpening) {
            document.body.classList.add('keyboard-open');
            this.onKeyboardOpen();
        } else if (isClosing) {
            document.body.classList.remove('keyboard-open');
            this.onKeyboardClose();
        }
    },

    /**
     * Called when keyboard starts opening.
     * Handle any side effects here (not during animation).
     */
    onKeyboardOpen() {
        // Auto-collapse chat when editing document (not when typing in chat)
        if (this.isMobileView() && this.documentOpen) {
            const activeElement = document.activeElement;
            const documentEditor = document.querySelector('.document-editor');
            const isEditingDocument = documentEditor && documentEditor.contains(activeElement);

            if (isEditingDocument && !this.chatCollapsed) {
                this.setChatCollapsed(true);
            }
        }
    },

    /**
     * Called when keyboard finishes closing.
     */
    onKeyboardClose() {
        // Could restore chat collapsed state here if needed
    }
};
