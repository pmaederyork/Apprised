/**
 * Mobile Touch Interactions
 * Provides swipe-to-delete and long-press detection for sidebar items.
 */
const MobileTouch = {
    initialized: false,
    LONG_PRESS_DURATION: 500, // Standard 500ms
    SWIPE_THRESHOLD: 50, // Minimum pixels to trigger swipe

    // Track active swipe/long-press state
    activeSwipeItem: null,
    longPressTimer: null,
    longPressTriggered: false,
    startX: 0,
    startY: 0,
    currentX: 0,

    init() {
        if (this.initialized) {
            console.warn('MobileTouch module already initialized');
            return;
        }

        this.bindSidebarTouchEvents();
        this.initialized = true;
        console.log('MobileTouch module initialized');
    },

    bindSidebarTouchEvents() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        // Use event delegation for sidebar items
        sidebar.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        sidebar.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        sidebar.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        sidebar.addEventListener('touchcancel', () => this.cancelTouch());

        // Close any open swipe when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.swipe-container.show-delete')) {
                this.closeAllSwipes();
            }
        });
    },

    handleTouchStart(e) {
        const item = e.target.closest('.chat-item, .document-item, .agent-item, .sidebar-item');
        if (!item) return;

        // Check if mobile mode
        if (typeof Mobile !== 'undefined' && !Mobile.isMobileView()) return;

        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.currentX = this.startX;
        this.longPressTriggered = false;

        // Setup swipe container if needed
        this.setupSwipeContainer(item);

        // Start long-press timer
        this.longPressTimer = setTimeout(() => {
            this.longPressTriggered = true;
            this.handleLongPress(e, item);
        }, this.LONG_PRESS_DURATION);

        // Visual feedback
        item.classList.add('long-press-active');
    },

    handleTouchMove(e) {
        const item = e.target.closest('.chat-item, .document-item, .agent-item, .sidebar-item');
        if (!item) return;

        const touch = e.touches[0];
        this.currentX = touch.clientX;
        const deltaX = this.startX - this.currentX;
        const deltaY = Math.abs(this.startY - touch.clientY);

        // Cancel long-press if moving
        if (Math.abs(deltaX) > 10 || deltaY > 10) {
            this.cancelLongPress();
            item.classList.remove('long-press-active');
        }

        // Handle horizontal swipe
        if (deltaX > 10 && deltaY < 30) {
            e.preventDefault(); // Prevent scroll during swipe

            const swipeContent = item.querySelector('.swipe-content') || item;
            swipeContent.classList.add('swiping');

            // Swipe left reveals delete (cap at 80px)
            const translateX = Math.min(Math.max(deltaX, 0), 80);
            swipeContent.style.transform = `translateX(-${translateX}px)`;

            this.activeSwipeItem = item;
        }
    },

    handleTouchEnd(e) {
        const item = e.target.closest('.chat-item, .document-item, .agent-item, .sidebar-item');
        this.cancelLongPress();

        if (item) {
            item.classList.remove('long-press-active');

            const swipeContent = item.querySelector('.swipe-content') || item;
            swipeContent.classList.remove('swiping');
        }

        // Handle swipe completion
        if (this.activeSwipeItem) {
            const deltaX = this.startX - this.currentX;
            const container = this.activeSwipeItem.closest('.swipe-container');

            if (deltaX > this.SWIPE_THRESHOLD) {
                // Swipe threshold met - show delete
                container?.classList.add('show-delete');
            } else {
                // Not enough swipe - reset
                this.resetSwipe(this.activeSwipeItem);
            }

            this.activeSwipeItem = null;
        }

        // Handle tap (if not long-press or swipe)
        if (!this.longPressTriggered && Math.abs(this.startX - this.currentX) < 10) {
            // Normal tap - let default click behavior happen
        }
    },

    cancelTouch() {
        this.cancelLongPress();
        if (this.activeSwipeItem) {
            this.resetSwipe(this.activeSwipeItem);
            this.activeSwipeItem = null;
        }
    },

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    },

    setupSwipeContainer(item) {
        // Wrap item content in swipe container if not already
        if (item.classList.contains('swipe-container')) return;

        const container = document.createElement('div');
        container.className = 'swipe-container';

        const content = document.createElement('div');
        content.className = 'swipe-content';

        // Move item's children to content wrapper
        while (item.firstChild) {
            content.appendChild(item.firstChild);
        }

        const deleteAction = document.createElement('div');
        deleteAction.className = 'swipe-delete-action';
        deleteAction.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
        `;

        deleteAction.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSwipeDelete(item);
        });

        container.appendChild(deleteAction);
        container.appendChild(content);
        item.appendChild(container);
        item.classList.add('swipe-container');
    },

    resetSwipe(item) {
        const container = item.closest('.swipe-container') || item;
        const content = container.querySelector('.swipe-content');
        container.classList.remove('show-delete');
        if (content) {
            content.style.transform = '';
        }
    },

    closeAllSwipes() {
        document.querySelectorAll('.swipe-container.show-delete').forEach(container => {
            container.classList.remove('show-delete');
            const content = container.querySelector('.swipe-content');
            if (content) content.style.transform = '';
        });
    },

    handleSwipeDelete(item) {
        // Find the delete handler based on item type
        const itemId = item.dataset.id || item.dataset.chatId || item.dataset.documentId;

        if (item.classList.contains('chat-item') && typeof Chat !== 'undefined') {
            Chat.deleteChat(itemId);
        } else if (item.classList.contains('document-item') && typeof Documents !== 'undefined') {
            Documents.deleteDocument(itemId);
        } else if (item.classList.contains('agent-item') && typeof SystemPrompts !== 'undefined') {
            SystemPrompts.delete(itemId);
        }

        this.closeAllSwipes();
    },

    handleLongPress(e, item) {
        // Haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Show options menu
        const touch = e.touches[0];
        this.showOptionsMenu(item, touch.clientX, touch.clientY);
    },

    showOptionsMenu(item, x, y) {
        // Remove existing menu
        this.hideOptionsMenu();

        const backdrop = document.createElement('div');
        backdrop.className = 'touch-menu-backdrop';
        backdrop.addEventListener('click', () => this.hideOptionsMenu());

        const menu = document.createElement('div');
        menu.className = 'touch-options-menu';

        // Build menu items based on item type
        const menuItems = this.getMenuItemsForItem(item);
        menuItems.forEach(menuItem => {
            const el = document.createElement('div');
            el.className = `menu-item ${menuItem.danger ? 'danger' : ''}`;
            el.innerHTML = `${menuItem.icon || ''} ${menuItem.label}`;
            el.addEventListener('click', () => {
                menuItem.action(item);
                this.hideOptionsMenu();
            });
            menu.appendChild(el);
        });

        // Position menu near touch point
        menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
        menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;

        document.body.appendChild(backdrop);
        document.body.appendChild(menu);
    },

    hideOptionsMenu() {
        document.querySelector('.touch-menu-backdrop')?.remove();
        document.querySelector('.touch-options-menu')?.remove();
    },

    getMenuItemsForItem(item) {
        const itemId = item.dataset.id || item.dataset.chatId || item.dataset.documentId;

        if (item.classList.contains('chat-item')) {
            return [
                { label: 'Rename', icon: '✏️', action: () => Chat.editTitle && Chat.editTitle(itemId) },
                { label: 'Delete', icon: '🗑️', danger: true, action: () => Chat.deleteChat && Chat.deleteChat(itemId) }
            ];
        } else if (item.classList.contains('document-item')) {
            return [
                { label: 'Rename', icon: '✏️', action: () => Documents.editName && Documents.editName(itemId) },
                { label: 'Delete', icon: '🗑️', danger: true, action: () => Documents.deleteDocument && Documents.deleteDocument(itemId) }
            ];
        } else if (item.classList.contains('agent-item')) {
            return [
                { label: 'Edit', icon: '✏️', action: () => SystemPrompts.edit && SystemPrompts.edit(itemId) },
                { label: 'Delete', icon: '🗑️', danger: true, action: () => SystemPrompts.delete && SystemPrompts.delete(itemId) }
            ];
        }

        return [];
    }
};
