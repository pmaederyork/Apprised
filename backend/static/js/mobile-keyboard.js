/**
 * iOS Keyboard Handler
 * Uses visualViewport API for bulletproof keyboard offset handling.
 */
const MobileKeyboard = {
    initialized: false,
    rafId: null,
    lastOffset: 0,
    composerEl: null,
    messageListEl: null,
    stuckCount: 0,
    lastOffsetTop: 0,

    init() {
        if (this.initialized) return;
        if (typeof Mobile !== 'undefined' && !Mobile.isMobileView()) return;

        this.composerEl = document.querySelector('.chat-input-container');
        this.messageListEl = document.querySelector('.chat-messages');

        if (!this.composerEl) return;

        this.bindEvents();
        this.measureComposer();
        this.initialized = true;
        console.log('MobileKeyboard module initialized');
    },

    bindEvents() {
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.scheduleUpdate());
            window.visualViewport.addEventListener('scroll', () => this.scheduleUpdate());
        } else {
            window.addEventListener('resize', () => this.scheduleUpdate());
        }

        document.fonts?.ready?.then(() => this.measureComposer());

        this.composerEl.addEventListener('focusin', () => {
            this.measureComposer();
            setTimeout(() => this.scheduleUpdate(), 100);
        });

        this.composerEl.addEventListener('focusout', () => {
            setTimeout(() => this.scheduleUpdate(), 100);
        });

        if (window.ResizeObserver) {
            new ResizeObserver(() => this.measureComposer()).observe(this.composerEl);
        }
    },

    measureComposer() {
        if (!this.composerEl) return;
        const height = this.composerEl.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--composer-height', `${height}px`);
    },

    scheduleUpdate() {
        if (this.rafId) return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.update();
        });
    },

    update() {
        if (!window.visualViewport || !this.composerEl) return;

        const vv = window.visualViewport;
        const visibleBottom = vv.height + vv.offsetTop;
        const layoutBottom = window.innerHeight;
        const overlap = Math.max(0, layoutBottom - visibleBottom);

        // Stuck offsetTop detection (iOS 26 bug)
        if (vv.offsetTop === this.lastOffsetTop && vv.offsetTop !== 0 && overlap === 0) {
            this.stuckCount++;
            if (this.stuckCount > 10) {
                // Force recalc - offsetTop stuck after keyboard dismiss
                document.documentElement.style.setProperty('--keyboard-offset', '0px');
                this.lastOffset = 0;
                return;
            }
        } else {
            this.stuckCount = 0;
        }
        this.lastOffsetTop = vv.offsetTop;

        if (overlap !== this.lastOffset) {
            this.lastOffset = overlap;
            document.documentElement.style.setProperty('--keyboard-offset', `${overlap}px`);

            // Scroll to keep latest messages visible
            if (overlap > 0 && this.messageListEl) {
                this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
            }
        }
    },

    // For external calls (e.g., orientation change)
    forceUpdate() {
        this.scheduleUpdate();
        setTimeout(() => this.scheduleUpdate(), 200);
    }
};
