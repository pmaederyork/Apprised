/**
 * Claude Change Tracking and Review System
 * Manages document edits proposed by Claude with visual diff highlighting
 */
const ClaudeChanges = {
    currentChangeIndex: 0,
    changes: [],
    documentId: null,
    initialized: false,
    originalDocumentHTML: null, // Cache of clean document HTML before wrappers

    /**
     * Initialize the change review system with a set of changes
     */
    init(documentId, changes) {
        this.documentId = documentId;
        this.changes = changes;
        this.currentChangeIndex = 0;
        this.initialized = true;

        // Cache original document HTML before any wrappers are added
        const editor = UI.elements.documentTextarea;
        if (editor) {
            this.originalDocumentHTML = editor.innerHTML;
        }

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
     * Clean up all change number indicators from the document
     */
    cleanupChangeNumbers() {
        document.querySelectorAll('.claude-change-number').forEach(el => el.remove());
    },

    /**
     * Find node in container using cached content signature
     * Uses multiple matching strategies: textContent+tag, innerHTML, outerHTML
     */
    findNodeBySignature(container, signature) {
        if (!signature || !signature.tagName) {
            console.log('🔍 Signature lookup: No valid signature provided');
            return null;
        }

        console.log(`🔍 Signature lookup: Searching for <${signature.tagName}> with text "${signature.textContent.substring(0, 50)}..."`);

        // Strategy 1: Match by textContent + tagName (fastest, works across formatting changes)
        const candidates = Array.from(container.getElementsByTagName(signature.tagName));

        for (const node of candidates) {
            const nodeText = node.textContent?.trim() || '';
            if (nodeText === signature.textContent) {
                console.log('✅ Signature match: Found using textContent + tagName (Strategy 1)');
                return node;
            }
        }

        // Strategy 2: Match by innerHTML
        for (const node of candidates) {
            if (node.innerHTML === signature.innerHTML) {
                console.log('✅ Signature match: Found using innerHTML (Strategy 2)');
                return node;
            }
        }

        // Strategy 3: Match by normalized innerHTML (handles whitespace)
        const normalizedSignatureHTML = Documents.normalizeHTML(signature.innerHTML);
        for (const node of candidates) {
            if (Documents.normalizeHTML(node.innerHTML) === normalizedSignatureHTML) {
                console.log('✅ Signature match: Found using normalized innerHTML (Strategy 3)');
                return node;
            }
        }

        // Strategy 4: Match by outerHTML
        for (const node of candidates) {
            if (node.outerHTML === signature.outerHTML) {
                console.log('✅ Signature match: Found using outerHTML (Strategy 4)');
                return node;
            }
        }

        console.log('⚠️ Signature lookup: No match found with any strategy');
        return null;
    },

    /**
     * Reconstruct document from original HTML by applying accepted changes
     * This creates a clean document without wrapper divs
     */
    reconstructDocument(originalHTML, acceptedChanges) {
        console.log(`🔧 Reconstruction: Applying ${acceptedChanges.length} accepted change(s)`);

        // Create temporary container with original clean HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;

        // Apply each accepted change in order
        acceptedChanges.forEach(change => {
            if (change.type === 'delete') {
                console.log(`🔍 DELETE reconstruction: Processing change ${change.id}`);

                // Try to use cached signature first, fallback to findNodeByContent
                let nodeToDelete = null;
                if (change._cachedSignature) {
                    console.log('🔍 DELETE: Using cached signature');
                    nodeToDelete = this.findNodeBySignature(tempDiv, change._cachedSignature);
                }

                if (!nodeToDelete) {
                    console.log('⚠️ DELETE: Signature lookup failed, falling back to findNodeByContent');
                    nodeToDelete = Documents.findNodeByContent(tempDiv, change.originalContent);
                }

                if (nodeToDelete) {
                    console.log(`✅ DELETE: Successfully found and removing <${nodeToDelete.tagName}>`);
                    nodeToDelete.remove();
                } else {
                    const preview = change.originalContent?.substring(0, 100) || 'unknown';
                    console.error(`❌ DELETE: Could not find content to delete: "${preview}..."`);
                }
            } else if (change.type === 'add') {
                console.log(`🔍 ADD reconstruction: Processing change ${change.id}`);

                // Find anchor and insert new content
                if (change.insertAfter) {
                    // Try to use cached signature first, fallback to findNodeByContent
                    let anchorNode = null;
                    if (change._cachedSignature && change._cachedSignature.anchorType === 'insertAfter') {
                        console.log('🔍 ADD: Using cached signature for insertAfter anchor');
                        anchorNode = this.findNodeBySignature(tempDiv, change._cachedSignature);
                    }
                    if (!anchorNode) {
                        console.log('⚠️ ADD: Signature lookup failed, falling back to findNodeByContent');
                        anchorNode = Documents.findNodeByContent(tempDiv, change.insertAfter);
                    }

                    if (anchorNode) {
                        console.log(`✅ ADD: Found insertAfter anchor <${anchorNode.tagName}>, inserting content`);
                        const newElement = document.createElement('div');
                        newElement.innerHTML = change.newContent;
                        // Insert all new content after anchor
                        while (newElement.firstChild) {
                            anchorNode.after(newElement.firstChild);
                        }
                    } else {
                        console.error('❌ ANCHOR NOT FOUND for insertAfter:', change.insertAfter);
                        console.error('⚠️  Content will be appended to END (this is likely incorrect)');
                        console.error('💡 Tip: Anchor must be complete HTML element, not text fragment');
                        // Append to end if anchor not found
                        tempDiv.innerHTML += change.newContent;
                    }
                } else if (change.insertBefore) {
                    // Try to use cached signature first, fallback to findNodeByContent
                    let anchorNode = null;
                    if (change._cachedSignature && change._cachedSignature.anchorType === 'insertBefore') {
                        console.log('🔍 ADD: Using cached signature for insertBefore anchor');
                        anchorNode = this.findNodeBySignature(tempDiv, change._cachedSignature);
                    }
                    if (!anchorNode) {
                        console.log('⚠️ ADD: Signature lookup failed, falling back to findNodeByContent');
                        anchorNode = Documents.findNodeByContent(tempDiv, change.insertBefore);
                    }

                    if (anchorNode) {
                        console.log(`✅ ADD: Found insertBefore anchor <${anchorNode.tagName}>, inserting content`);
                        const newElement = document.createElement('div');
                        newElement.innerHTML = change.newContent;
                        // Insert all new content before anchor
                        while (newElement.firstChild) {
                            anchorNode.before(newElement.firstChild);
                        }
                    } else {
                        console.error('❌ ANCHOR NOT FOUND for insertBefore:', change.insertBefore);
                        console.error('⚠️  Content will be prepended to BEGINNING (this is likely incorrect)');
                        console.error('💡 Tip: Anchor must be complete HTML element, not text fragment');
                        // Prepend to beginning if anchor not found
                        tempDiv.innerHTML = change.newContent + tempDiv.innerHTML;
                    }
                }
            } else if (change.type === 'modify') {
                console.log(`🔍 MODIFY reconstruction: Processing change ${change.id}`);

                // Try to use cached signature first, fallback to findNodeByContent
                let nodeToModify = null;
                if (change._cachedSignature) {
                    console.log('🔍 MODIFY: Using cached signature');
                    nodeToModify = this.findNodeBySignature(tempDiv, change._cachedSignature);
                }
                if (!nodeToModify) {
                    console.log('⚠️ MODIFY: Signature lookup failed, falling back to findNodeByContent');
                    nodeToModify = Documents.findNodeByContent(tempDiv, change.originalContent);
                }

                if (nodeToModify) {
                    console.log(`✅ MODIFY: Successfully found <${nodeToModify.tagName}>, replacing content`);
                    const newElement = document.createElement('div');
                    newElement.innerHTML = change.newContent;
                    // Replace with all new content
                    const fragment = document.createDocumentFragment();
                    while (newElement.firstChild) {
                        fragment.appendChild(newElement.firstChild);
                    }
                    nodeToModify.replaceWith(fragment);
                } else {
                    const preview = change.originalContent?.substring(0, 100) || 'unknown';
                    console.error(`❌ MODIFY: Could not find content to modify: "${preview}..."`);
                }
            }
        });

        // Clear cache after reconstruction
        acceptedChanges.forEach(change => {
            delete change._cachedSignature;
        });

        return tempDiv.innerHTML;
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
                    previewHTML += `<div class="preview-original" data-full-content="${this.escapeHTML(change.originalContent)}"><strong>Original: (click to expand)</strong><br><div class="preview-content">${this.truncateHTML(change.originalContent)}</div></div>`;
                }
                if (change.newContent) {
                    previewHTML += `<div class="preview-new" data-full-content="${this.escapeHTML(change.newContent)}"><strong>New: (click to expand)</strong><br><div class="preview-content">${this.truncateHTML(change.newContent)}</div></div>`;
                }
                contentPreview.innerHTML = previewHTML;

                // Add click handlers for expansion
                this.bindPreviewExpansion(contentPreview);
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
     * Escape HTML for use in attributes
     */
    escapeHTML(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML.replace(/"/g, '&quot;');
    },

    /**
     * Bind click handlers to preview boxes for expansion/collapse
     */
    bindPreviewExpansion(container) {
        const previewBoxes = container.querySelectorAll('.preview-original, .preview-new');

        previewBoxes.forEach(box => {
            box.addEventListener('click', (e) => {
                e.stopPropagation();
                const contentDiv = box.querySelector('.preview-content');
                const label = box.querySelector('strong');

                if (box.classList.contains('expanded')) {
                    // Collapse
                    box.classList.remove('expanded');
                    const fullContent = box.getAttribute('data-full-content');
                    contentDiv.textContent = this.truncateHTML(fullContent);
                    label.textContent = label.textContent.replace('(click to collapse)', '(click to expand)');
                } else {
                    // Expand
                    box.classList.add('expanded');
                    const fullContent = box.getAttribute('data-full-content');
                    contentDiv.innerHTML = fullContent;
                    label.textContent = label.textContent.replace('(click to expand)', '(click to collapse)');
                }
            });
        });
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
        if (!change || !this.originalDocumentHTML) return;

        // Capture state BEFORE applying change (for undo)
        this.captureHistoryState();

        // Mark as accepted
        change.status = 'accepted';

        // Get all accepted changes
        const acceptedChanges = this.changes.filter(c => c.status === 'accepted');

        // Reconstruct document from original HTML + accepted changes
        const reconstructedHTML = this.reconstructDocument(this.originalDocumentHTML, acceptedChanges);

        // Update editor with clean reconstructed HTML
        const editor = UI.elements.documentTextarea;
        if (editor) {
            editor.innerHTML = reconstructedHTML;
        }

        // Clear any lingering change number indicators before re-rendering
        this.cleanupChangeNumbers();

        // Get remaining pending changes and re-render them with wrappers
        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        if (pendingChanges.length > 0 && Documents && Documents.renderChangesInDocument) {
            Documents.renderChangesInDocument(pendingChanges);
        }

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
        if (!change || !this.originalDocumentHTML) return;

        // Capture state BEFORE rejecting change (for undo)
        this.captureHistoryState();

        // Mark as rejected
        change.status = 'rejected';

        // Get all accepted changes (excluding this rejected one)
        const acceptedChanges = this.changes.filter(c => c.status === 'accepted');

        // Reconstruct document from original HTML + accepted changes (rejected changes are skipped)
        const reconstructedHTML = this.reconstructDocument(this.originalDocumentHTML, acceptedChanges);

        // Update editor with clean reconstructed HTML
        const editor = UI.elements.documentTextarea;
        if (editor) {
            editor.innerHTML = reconstructedHTML;
        }

        // Clear any lingering change number indicators before re-rendering
        this.cleanupChangeNumbers();

        // Get remaining pending changes and re-render them with wrappers
        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        if (pendingChanges.length > 0 && Documents && Documents.renderChangesInDocument) {
            Documents.renderChangesInDocument(pendingChanges);
        }

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
            // Batch mark all pending changes as rejected (don't call rejectChange() which re-renders)
            const pendingChanges = this.changes.filter(c => c.status === 'pending');
            pendingChanges.forEach(change => {
                change.status = 'rejected';  // Just mark, don't reconstruct yet
            });

            // Single reconstruction with only accepted changes (none if all were rejected)
            const acceptedChanges = this.changes.filter(c => c.status === 'accepted');
            const cleanHTML = this.reconstructDocument(this.originalDocumentHTML, acceptedChanges);

            const editor = UI.elements.documentTextarea;
            if (editor && cleanHTML) {
                editor.innerHTML = cleanHTML;
            }

            // Save the rejection to storage
            Storage.saveClaudeChanges(this.documentId, {
                changeId: 'changes_' + Date.now(),
                documentId: this.documentId,
                timestamp: Date.now(),
                changes: this.changes
            });

            // Capture undo state after rejecting all changes
            this.captureHistoryState();
        }

        // Clean up change tracking
        Storage.clearClaudeChanges(this.documentId);

        // Hide review panel
        if (UI.elements.documentChangeReview) {
            UI.elements.documentChangeReview.style.display = 'none';
        }

        // Return focus to chat input for seamless workflow
        setTimeout(() => {
            if (UI && UI.focusMessageInput) {
                UI.focusMessageInput();
            }
        }, 100);

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

        // Remove all change number indicators
        this.cleanupChangeNumbers();

        // Save final document state
        if (Documents && Documents.saveCurrentDocument) {
            Documents.saveCurrentDocument();
        }

        // Reset state
        this.changes = [];
        this.currentChangeIndex = 0;
        this.documentId = null;
        this.initialized = false;
        this.originalDocumentHTML = null; // Clear cached HTML

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
