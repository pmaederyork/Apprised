/**
 * Claude Change Tracking and Review System
 * Manages document edits proposed by Claude with visual diff highlighting
 */
const ClaudeChanges = {
    currentChangeIndex: 0,
    changes: [],
    documentId: null,
    initialized: false,

    /**
     * Initialize the change review system with a set of changes
     */
    init(documentId, changes) {
        this.documentId = documentId;
        this.changes = changes;
        this.currentChangeIndex = 0;
        this.initialized = true;

        // Add body class for layout adjustment
        document.body.classList.add('review-mode-active');

        console.log(`ClaudeChanges initialized with ${changes.length} changes for document ${documentId}`);
    },

    /**
     * Check if currently in review mode
     */
    isInReviewMode() {
        return this.initialized && this.changes.length > 0 && UI.elements.documentChangeReview?.style.display !== 'none';
    },

    /**
     * Get pending changes count
     */
    getPendingChangesCount() {
        return this.changes.filter(c => c.status === 'pending').length;
    },

    /**
     * Get change statistics
     */
    getChangeStats() {
        return {
            total: this.changes.length,
            pending: this.changes.filter(c => c.status === 'pending').length,
            accepted: this.changes.filter(c => c.status === 'accepted').length,
            rejected: this.changes.filter(c => c.status === 'rejected').length,
            deletions: this.changes.filter(c => c.type === 'delete').length,
            additions: this.changes.filter(c => c.type === 'add').length,
            modifications: this.changes.filter(c => c.type === 'modify').length
        };
    },

    /**
     * Capture document state for undo history
     */
    captureHistoryState() {
        if (Documents && Documents.captureCurrentState) {
            Documents.captureCurrentState();
        }
    },

    /**
     * Navigate to next change
     */
    nextChange() {
        if (!this.isInReviewMode()) return;

        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        if (pendingChanges.length === 0) {
            this.exitReviewMode();
            return;
        }

        // Find next pending change
        for (let i = this.currentChangeIndex + 1; i < this.changes.length; i++) {
            if (this.changes[i].status === 'pending') {
                this.currentChangeIndex = i;
                this.focusCurrentChange();
                return;
            }
        }

        // Wrap around to first pending change
        for (let i = 0; i < this.currentChangeIndex; i++) {
            if (this.changes[i].status === 'pending') {
                this.currentChangeIndex = i;
                this.focusCurrentChange();
                return;
            }
        }
    },

    /**
     * Navigate to previous change
     */
    prevChange() {
        if (!this.isInReviewMode()) return;

        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        if (pendingChanges.length === 0) {
            this.exitReviewMode();
            return;
        }

        // Find previous pending change
        for (let i = this.currentChangeIndex - 1; i >= 0; i--) {
            if (this.changes[i].status === 'pending') {
                this.currentChangeIndex = i;
                this.focusCurrentChange();
                return;
            }
        }

        // Wrap around to last pending change
        for (let i = this.changes.length - 1; i > this.currentChangeIndex; i--) {
            if (this.changes[i].status === 'pending') {
                this.currentChangeIndex = i;
                this.focusCurrentChange();
                return;
            }
        }
    },

    /**
     * Focus on current change and scroll into view
     */
    focusCurrentChange() {
        if (!this.isInReviewMode()) return;

        const change = this.changes[this.currentChangeIndex];
        if (!change) return;

        // Remove active class from all changes
        document.querySelectorAll('.claude-change-active').forEach(el => {
            el.classList.remove('claude-change-active');
        });

        // Find and focus the change element
        const changeElement = document.querySelector(`[data-change-id="${change.id}"]`);
        if (changeElement) {
            changeElement.classList.add('claude-change-active');
            changeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        this.updateReviewUI();
    },

    /**
     * Update review panel UI with current stats
     */
    updateReviewUI() {
        if (!UI.elements.documentChangeReview) return;

        const stats = this.getChangeStats();
        const pendingIndex = this.changes.slice(0, this.currentChangeIndex + 1).filter(c => c.status === 'pending').length;

        // Update stats display
        const statsElement = UI.elements.changeReviewStats;
        if (statsElement) {
            statsElement.textContent = `${stats.pending} change${stats.pending !== 1 ? 's' : ''} pending`;
        }

        // Update position indicator
        const positionElement = UI.elements.changePosition;
        if (positionElement) {
            positionElement.textContent = `Change ${pendingIndex} of ${stats.pending}`;
        }

        // Update change detail preview
        const change = this.changes[this.currentChangeIndex];
        if (change) {
            const typeIndicator = UI.elements.changeTypeIndicator;
            const contentPreview = UI.elements.changeContentPreview;

            if (typeIndicator) {
                typeIndicator.textContent = change.type.toUpperCase();
                typeIndicator.className = 'change-type-indicator change-type-' + change.type;
            }

            if (contentPreview) {
                let previewHTML = '';
                if (change.originalContent) {
                    previewHTML += `<div class="preview-original"><strong>Original:</strong><br>${this.truncateHTML(change.originalContent)}</div>`;
                }
                if (change.newContent) {
                    previewHTML += `<div class="preview-new"><strong>New:</strong><br>${this.truncateHTML(change.newContent)}</div>`;
                }
                contentPreview.innerHTML = previewHTML;
            }
        }

        // Disable navigation buttons if at boundaries
        if (UI.elements.prevChangeBtn) {
            UI.elements.prevChangeBtn.disabled = (stats.pending <= 1);
        }
        if (UI.elements.nextChangeBtn) {
            UI.elements.nextChangeBtn.disabled = (stats.pending <= 1);
        }
    },

    /**
     * Truncate HTML for preview display
     */
    truncateHTML(html, maxLength = 100) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const text = temp.textContent || temp.innerText || '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },

    /**
     * Accept current change
     */
    acceptCurrentChange() {
        if (!this.isInReviewMode()) return;

        const change = this.changes[this.currentChangeIndex];
        if (!change || change.status !== 'pending') {
            this.moveToNextPendingChange();
            return;
        }

        this.acceptChange(change.id);
    },

    /**
     * Accept specific change by ID
     */
    acceptChange(changeId) {
        const change = this.changes.find(c => c.id === changeId);
        if (!change) return;

        const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
        if (!changeElement) return;

        // Capture state BEFORE applying change (for undo)
        this.captureHistoryState();

        if (change.type === 'delete') {
            // Remove the deleted content
            changeElement.remove();
        } else if (change.type === 'add') {
            // Keep added content, remove highlighting
            changeElement.classList.remove('claude-change-add', 'claude-change-active');
            changeElement.removeAttribute('data-change-id');
        } else if (change.type === 'modify') {
            // Replace with new content, remove highlighting
            if (change.newContent) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = change.newContent;
                const newNode = tempDiv.firstChild;
                if (newNode) {
                    changeElement.replaceWith(newNode);
                }
            }
        }

        // Mark as accepted
        change.status = 'accepted';

        // Save changes to storage
        Storage.saveClaudeChanges(this.documentId, {
            changeId: 'changes_' + Date.now(),
            documentId: this.documentId,
            timestamp: Date.now(),
            changes: this.changes
        });

        // Capture state AFTER applying change (creates undo point)
        setTimeout(() => {
            this.captureHistoryState();
            // Update undo/redo buttons
            if (Documents && Documents.updateUndoRedoButtons) {
                Documents.updateUndoRedoButtons();
            }
        }, 100);

        // Move to next pending change
        this.moveToNextPendingChange();
    },

    /**
     * Reject current change
     */
    rejectCurrentChange() {
        if (!this.isInReviewMode()) return;

        const change = this.changes[this.currentChangeIndex];
        if (!change || change.status !== 'pending') {
            this.moveToNextPendingChange();
            return;
        }

        this.rejectChange(change.id);
    },

    /**
     * Reject specific change by ID
     */
    rejectChange(changeId) {
        const change = this.changes.find(c => c.id === changeId);
        if (!change) return;

        const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
        if (!changeElement) return;

        // Capture state BEFORE rejecting change (for undo)
        this.captureHistoryState();

        if (change.type === 'delete') {
            // Keep original content, remove highlighting
            changeElement.classList.remove('claude-change-delete', 'claude-change-active');
            changeElement.style.textDecoration = 'none';
            changeElement.removeAttribute('data-change-id');
        } else if (change.type === 'add') {
            // Remove added content completely
            changeElement.remove();
        } else if (change.type === 'modify') {
            // Revert to original content
            if (change.originalContent) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = change.originalContent;
                const originalNode = tempDiv.firstChild;
                if (originalNode) {
                    changeElement.replaceWith(originalNode);
                }
            }
        }

        // Mark as rejected
        change.status = 'rejected';

        // Save changes to storage
        Storage.saveClaudeChanges(this.documentId, {
            changeId: 'changes_' + Date.now(),
            documentId: this.documentId,
            timestamp: Date.now(),
            changes: this.changes
        });

        // Capture state AFTER rejecting change (creates undo point)
        setTimeout(() => {
            this.captureHistoryState();
            // Update undo/redo buttons
            if (Documents && Documents.updateUndoRedoButtons) {
                Documents.updateUndoRedoButtons();
            }
        }, 100);

        // Move to next pending change
        this.moveToNextPendingChange();
    },

    /**
     * Move to next pending change or exit if none left
     */
    moveToNextPendingChange() {
        const pendingCount = this.getPendingChangesCount();

        if (pendingCount === 0) {
            this.exitReviewMode();
            return;
        }

        // Find next pending change
        for (let i = this.currentChangeIndex; i < this.changes.length; i++) {
            if (this.changes[i].status === 'pending') {
                this.currentChangeIndex = i;
                this.focusCurrentChange();
                return;
            }
        }

        // Wrap to beginning
        for (let i = 0; i < this.currentChangeIndex; i++) {
            if (this.changes[i].status === 'pending') {
                this.currentChangeIndex = i;
                this.focusCurrentChange();
                return;
            }
        }
    },

    /**
     * Accept all pending changes
     */
    acceptAll() {
        if (!this.isInReviewMode()) return;

        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        pendingChanges.forEach(change => {
            this.acceptChange(change.id);
        });

        this.exitReviewMode();
    },

    /**
     * Reject all pending changes
     */
    rejectAll() {
        if (!this.isInReviewMode()) return;

        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        pendingChanges.forEach(change => {
            this.rejectChange(change.id);
        });

        this.exitReviewMode();
    },

    /**
     * Exit review mode and clean up
     */
    exitReviewMode(revertAll = false) {
        if (!this.initialized) return;

        // If reverting all, reject all pending changes first
        if (revertAll) {
            const pendingChanges = this.changes.filter(c => c.status === 'pending');
            pendingChanges.forEach(change => {
                this.rejectChange(change.id);
            });
        }

        // Clean up change tracking
        Storage.clearClaudeChanges(this.documentId);

        // Hide review panel
        if (UI.elements.documentChangeReview) {
            UI.elements.documentChangeReview.style.display = 'none';
        }

        // Remove body class for layout adjustment
        document.body.classList.remove('review-mode-active');

        // Remove all change markers
        document.querySelectorAll('[data-change-id]').forEach(el => {
            el.removeAttribute('data-change-id');
            el.classList.remove('claude-change-delete', 'claude-change-add', 'claude-change-modify', 'claude-change-active');
            if (el.classList.contains('claude-change-delete')) {
                el.style.textDecoration = 'none';
            }
        });

        // Save final document state
        if (Documents && Documents.saveCurrentDocument) {
            Documents.saveCurrentDocument();
        }

        // Reset state
        this.changes = [];
        this.currentChangeIndex = 0;
        this.documentId = null;
        this.initialized = false;

        console.log('ClaudeChanges: Exited review mode');
    },

    /**
     * Bind keyboard shortcuts for review mode
     */
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isInReviewMode()) return;

            // Don't interfere with text input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch(e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextChange();
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    this.prevChange();
                    break;

                case 'Enter':
                case 'y':
                case 'Y':
                    e.preventDefault();
                    this.acceptCurrentChange();
                    break;

                case 'Backspace':
                case 'Delete':
                case 'n':
                case 'N':
                    e.preventDefault();
                    this.rejectCurrentChange();
                    break;

                case 'a':
                case 'A':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.acceptAll();
                    }
                    break;

                case 'r':
                case 'R':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.rejectAll();
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    if (confirm('Cancel review and revert all pending changes?')) {
                        this.exitReviewMode(true);
                    }
                    break;
            }
        });

        console.log('ClaudeChanges: Keyboard shortcuts bound');
    }
};
