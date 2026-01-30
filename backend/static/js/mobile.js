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
        // Track keyboard state for animation class
        this._keyboardAnimating = false;
        this._lastKeyboardHeight = 0;

        // Use VirtualKeyboard API if available (Chrome on Android)
        if ('virtualKeyboard' in navigator) {
            navigator.virtualKeyboard.overlaysContent = true;

            navigator.virtualKeyboard.addEventListener('geometrychange', (e) => {
                this.updateKeyboardHeight(e.target.boundingRect.height);
            });
        } else {
            // Fallback: listen for visual viewport changes (Safari/older browsers)
            this.setupKeyboardFallback();
        }

        // Pre-emptively resize on focus to prevent iOS auto-scroll
        this.setupPreemptiveResize();
    },

    setupKeyboardFallback() {
        if (!window.visualViewport) return;

        // Single, simple handler for viewport resize
        const handleViewportResize = () => {
            const keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
            this.updateKeyboardHeight(keyboardHeight);
        };

        // Listen only to resize - this is the reliable signal for keyboard
        window.visualViewport.addEventListener('resize', handleViewportResize);

        // Initial check
        handleViewportResize();
    },

    updateKeyboardHeight(newHeight) {
        // Only update if height actually changed significantly
        const heightDelta = Math.abs(newHeight - this._lastKeyboardHeight);
        if (heightDelta < 10) return;

        const wasOpen = this._lastKeyboardHeight > 50;
        const isOpening = newHeight > 50 && !wasOpen;
        const isClosing = newHeight <= 50 && wasOpen;

        // Start animation mode - disable all transitions
        if (isOpening || isClosing) {
            this.startKeyboardAnimation();
        }

        // Update the CSS variable immediately (no debounce)
        this.keyboardHeight = newHeight;
        this._lastKeyboardHeight = newHeight;
        document.documentElement.style.setProperty('--keyboard-height', `${newHeight}px`);

        // Update keyboard-open class
        const isKeyboardOpen = newHeight > 50;
        document.body.classList.toggle('keyboard-open', isKeyboardOpen);

        // Auto-collapse chat when editing document (not when typing in chat)
        if (isKeyboardOpen && this.isMobileView() && this.documentOpen) {
            const activeElement = document.activeElement;
            const documentEditor = document.querySelector('.document-editor');
            const isEditingDocument = documentEditor && documentEditor.contains(activeElement);

            if (isEditingDocument && !this.chatCollapsed) {
                this.setChatCollapsed(true);
            }
        }
    },

    startKeyboardAnimation() {
        // Add class to disable all transitions during keyboard animation
        if (this._keyboardAnimating) return;

        this._keyboardAnimating = true;
        document.body.classList.add('keyboard-animating');

        // Remove animation class after iOS keyboard animation completes (~300ms)
        // Use slightly longer to ensure animation is fully done
        clearTimeout(this._keyboardAnimationTimer);
        this._keyboardAnimationTimer = setTimeout(() => {
            this._keyboardAnimating = false;
            document.body.classList.remove('keyboard-animating');
        }, 350);
    },

    /**
     * Estimate keyboard height based on device characteristics.
     * iOS keyboard heights vary by device model and screen size.
     */
    getEstimatedKeyboardHeight() {
        const screenHeight = window.screen.height;
        const screenWidth = window.screen.width;
        const isLandscape = window.innerWidth > window.innerHeight;

        // Use portrait dimensions for consistent detection
        const portraitHeight = Math.max(screenHeight, screenWidth);

        // Landscape keyboards are shorter
        if (isLandscape) {
            return 200; // Landscape keyboard is much shorter
        }

        // Detect iOS device by screen dimensions (in points)
        // Heights include QuickType suggestion bar (~44px)

        // iPhone SE (1st gen) - 568pt height
        if (portraitHeight <= 568) {
            return 298; // 253 + 45 QuickType
        }

        // iPhone SE (2nd/3rd), 6, 7, 8 - 667pt height
        if (portraitHeight <= 667) {
            return 306; // 260 + 46 QuickType
        }

        // iPhone 6+, 7+, 8+ - 736pt height
        if (portraitHeight <= 736) {
            return 315; // 271 + 44 QuickType
        }

        // iPhone X, XS, 11 Pro, 12 mini, 13 mini - 812pt height
        if (portraitHeight <= 812) {
            return 336; // 291 + 45 QuickType
        }

        // iPhone XR, 11 - 896pt height (LCD, thicker bezels)
        // iPhone XS Max, 11 Pro Max - 896pt height
        if (portraitHeight <= 896) {
            return 346; // 301 + 45 QuickType
        }

        // iPhone 12, 12 Pro, 13, 13 Pro, 14, 14 Pro, 15, 15 Pro - 844-852pt
        if (portraitHeight <= 852) {
            return 336; // 291 + 45 QuickType
        }

        // iPhone 12 Pro Max, 13 Pro Max, 14 Plus, 14 Pro Max, 15 Plus, 15 Pro Max - 926-932pt
        if (portraitHeight <= 932) {
            return 346; // 301 + 45 QuickType
        }

        // iPhone 16 Pro Max and future larger devices
        if (portraitHeight > 932) {
            return 356; // Slightly larger for bigger screens
        }

        // Default fallback - use a safe larger value
        return 346;
    },

    /**
     * Pre-emptively resize layout on focus BEFORE iOS decides to scroll.
     * iOS scrolls the page when it thinks a focused input will be hidden by the keyboard.
     * By applying the estimated keyboard height immediately on focus (capture phase),
     * the input moves up before iOS checks, so iOS doesn't scroll.
     */
    setupPreemptiveResize() {
        document.addEventListener('focusin', (e) => {
            if (!this.isMobileView()) return;

            const target = e.target;
            const isTextInput = target.tagName === 'TEXTAREA' ||
                               target.tagName === 'INPUT' ||
                               target.isContentEditable;

            if (!isTextInput) return;

            // Only pre-resize for inputs in chat area (bottom of screen)
            // Document editor is higher up, so iOS doesn't scroll for it
            const chatContainer = document.querySelector('.chat-container');
            const isInChat = chatContainer?.contains(target);

            if (isInChat) {
                // Get device-specific estimate (recalculate each time for orientation changes)
                const estimatedHeight = this.getEstimatedKeyboardHeight();

                // Apply estimated height IMMEDIATELY in capture phase
                // This happens before iOS's scroll calculation
                this.startKeyboardAnimation();
                this.updateKeyboardHeight(estimatedHeight);
            }
        }, { capture: true }); // Capture phase runs before bubble phase

        document.addEventListener('focusout', (e) => {
            if (!this.isMobileView()) return;

            // Small delay to check if focus moved to another text input
            // (e.g., tabbing between fields shouldn't close keyboard)
            setTimeout(() => {
                const active = document.activeElement;
                const isTextInput = active?.tagName === 'TEXTAREA' ||
                                   active?.tagName === 'INPUT' ||
                                   active?.isContentEditable;

                // Only reset if focus left all text inputs
                if (!isTextInput) {
                    this.updateKeyboardHeight(0);
                }
            }, 50);
        }, { capture: true });
    }
};
