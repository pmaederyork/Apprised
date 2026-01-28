/**
 * Mobile Drawer Navigation
 * Handles hamburger menu drawer open/close with backdrop.
 */
const MobileDrawer = {
    initialized: false,
    isOpen: false,
    sidebar: null,
    backdrop: null,
    hamburgerBtn: null,

    init() {
        if (this.initialized) {
            console.warn('MobileDrawer module already initialized');
            return;
        }

        this.sidebar = document.querySelector('.sidebar');
        this.backdrop = document.getElementById('drawerBackdrop');
        this.hamburgerBtn = document.getElementById('hamburgerBtn');

        if (!this.sidebar || !this.backdrop || !this.hamburgerBtn) {
            console.warn('MobileDrawer: Required elements not found');
            return;
        }

        this.bindEvents();
        this.initialized = true;
        console.log('MobileDrawer module initialized');
    },

    bindEvents() {
        // Hamburger button opens drawer
        this.hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.open();
        });

        // Backdrop click closes drawer
        this.backdrop.addEventListener('click', () => {
            this.close();
        });

        // Close on item selection in sidebar
        this.sidebar.addEventListener('click', (e) => {
            const listItem = e.target.closest('.sidebar-item, .chat-item, .document-item, .agent-item');
            if (listItem && !e.target.closest('.action-btn')) {
                // Small delay to allow the selection to register
                setTimeout(() => this.close(), 100);
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Close drawer when window resizes to desktop
        window.addEventListener('resize', () => {
            if (this.isOpen && typeof Mobile !== 'undefined' && !Mobile.isMobileView()) {
                this.close();
            }
        });
    },

    open() {
        if (this.isOpen) return;

        this.isOpen = true;
        this.sidebar.classList.add('drawer-open');
        this.backdrop.classList.add('visible');
        document.body.classList.add('drawer-open');

        // Prevent body scroll
        this.scrollY = window.scrollY;
        document.body.style.top = `-${this.scrollY}px`;

        // Focus management for accessibility
        this.sidebar.setAttribute('aria-hidden', 'false');
        this.hamburgerBtn.setAttribute('aria-expanded', 'true');
    },

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.sidebar.classList.remove('drawer-open');
        this.backdrop.classList.remove('visible');
        document.body.classList.remove('drawer-open');

        // Restore body scroll
        document.body.style.top = '';
        window.scrollTo(0, this.scrollY || 0);

        // Accessibility
        this.sidebar.setAttribute('aria-hidden', 'true');
        this.hamburgerBtn.setAttribute('aria-expanded', 'false');
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
};
