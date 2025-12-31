/**
 * Help Module
 * Displays help modal with app capabilities and keyboard shortcuts
 */

const Help = {
    initialized: false,
    elements: {
        helpModal: null,
        closeHelpBtn: null,
        appLogo: null
    },

    /**
     * Initialize the help module
     */
    init() {
        if (this.initialized) {
            console.log('Help module already initialized');
            return;
        }

        this.initElements();
        this.bindEvents();
        this.initialized = true;
        console.log('Help module initialized successfully');
    },

    /**
     * Initialize DOM element references
     */
    initElements() {
        this.elements.helpModal = document.getElementById('helpModal');
        this.elements.closeHelpBtn = document.getElementById('closeHelpBtn');
        this.elements.appLogo = document.getElementById('appLogo');

        if (!this.elements.helpModal) {
            console.warn('Help modal element not found');
        }
        if (!this.elements.appLogo) {
            console.warn('App logo element not found');
        }
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Logo click to open help
        this.elements.appLogo?.addEventListener('click', () => {
            this.openHelp();
        });

        // Close button
        this.elements.closeHelpBtn?.addEventListener('click', () => {
            this.closeHelp();
        });

        // Click outside modal to close
        this.elements.helpModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.helpModal) {
                this.closeHelp();
            }
        });

        // ESC key to close help modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.helpModal && this.elements.helpModal.style.display === 'flex') {
                    this.closeHelp();
                    e.preventDefault();
                }
            }
        });
    },

    /**
     * Open the help modal
     */
    openHelp() {
        if (this.elements.helpModal) {
            this.elements.helpModal.style.display = 'flex';
        }
    },

    /**
     * Close the help modal
     */
    closeHelp() {
        if (this.elements.helpModal) {
            this.elements.helpModal.style.display = 'none';
        }
    }
};
