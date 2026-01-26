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
        if (Documents.squireEditor) {
            const editor = Documents.squireEditor.getRoot();
            if (editor) {
                this.originalDocumentHTML = editor.innerHTML;
            }
        }

        // Add body class for layout adjustment
        document.body.classList.add('review-mode-active');
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
            return null;
        }

        // Strategy 1: Match by textContent + tagName (fastest, works across formatting changes)
        const candidates = Array.from(container.getElementsByTagName(signature.tagName));

        for (const node of candidates) {
            const nodeText = node.textContent?.trim() || '';
            if (nodeText === signature.textContent) {
                return node;
            }
        }

        // Strategy 2: Match by innerHTML
        for (const node of candidates) {
            if (node.innerHTML === signature.innerHTML) {
                return node;
            }
        }

        // Strategy 3: Match by normalized innerHTML (handles whitespace)
        const normalizedSignatureHTML = Documents.normalizeHTML(signature.innerHTML);
        for (const node of candidates) {
            if (Documents.normalizeHTML(node.innerHTML) === normalizedSignatureHTML) {
                return node;
            }
        }

        // Strategy 4: Match by outerHTML
        for (const node of candidates) {
            if (node.outerHTML === signature.outerHTML) {
                return node;
            }
        }

        return null;
    },

    /**
     * Resolve change target using hybrid strategy
     * Priority: targetId > cached signature > content matching
     * @param {Element} container - Container to search within
     * @param {Object} change - The change object with targetId, _cachedSignature, originalContent
     * @returns {Object} { node: Element|null, method: string }
     */
    resolveChangeTarget(container, change) {
        // Strategy 1: ID-based (highest confidence)
        if (change.targetId) {
            const byId = typeof ElementIds !== 'undefined'
                ? ElementIds.findById(container, change.targetId)
                : container.querySelector(`[data-edit-id="${change.targetId}"]`);

            if (byId) {
                return { node: byId, method: 'id' };
            }
            console.warn(`Target ID "${change.targetId}" not found, trying fallback strategies`);
        }

        // Strategy 2: Cached signature (from preview phase)
        if (change._cachedSignature) {
            const bySignature = this.findNodeBySignature(container, change._cachedSignature);
            if (bySignature) {
                return { node: bySignature, method: 'signature' };
            }
        }

        // Strategy 3: Content matching (fallback for backward compatibility)
        if (change.originalContent) {
            const byContent = Documents.findNodeByContent(container, change.originalContent);
            if (byContent) {
                return { node: byContent, method: 'content' };
            }
        }

        // Strategy 4: For add changes, resolve anchor
        if (change.type === 'add') {
            const anchorContent = change.insertAfter || change.insertBefore;
            if (anchorContent) {
                // Try ID-based anchor resolution if anchor has targetId
                if (change.anchorTargetId) {
                    const anchorById = typeof ElementIds !== 'undefined'
                        ? ElementIds.findById(container, change.anchorTargetId)
                        : container.querySelector(`[data-edit-id="${change.anchorTargetId}"]`);

                    if (anchorById) {
                        return { node: anchorById, method: 'anchor-id' };
                    }
                }

                // Fall back to content-based anchor resolution
                const anchorByContent = Documents.findNodeByContent(container, anchorContent);
                if (anchorByContent) {
                    return { node: anchorByContent, method: 'anchor-content' };
                }
            }
        }

        // All strategies failed
        console.warn(`Could not locate target for change ${change.id}`, {
            hasTargetId: !!change.targetId,
            hasCachedSignature: !!change._cachedSignature,
            hasOriginalContent: !!change.originalContent,
            changeType: change.type
        });
        return { node: null, method: 'failed' };
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
                // Try to use cached signature first, fallback to findNodeByContent
                let nodeToDelete = null;
                if (change._cachedSignature) {
                    nodeToDelete = this.findNodeBySignature(tempDiv, change._cachedSignature);
                }

                if (!nodeToDelete) {
                    nodeToDelete = Documents.findNodeByContent(tempDiv, change.originalContent);
                }

                if (nodeToDelete) {
                    nodeToDelete.remove();
                } else {
                    const preview = change.originalContent?.substring(0, 100) || 'unknown';
                    console.error(`❌ DELETE: Could not find content to delete: "${preview}..."`);
                }
            } else if (change.type === 'add') {
                // Find anchor and insert new content
                if (change.insertAfter) {
                    // Try to use cached signature first, fallback to findNodeByContent
                    let anchorNode = null;
                    if (change._cachedSignature && change._cachedSignature.anchorType === 'insertAfter') {
                        anchorNode = this.findNodeBySignature(tempDiv, change._cachedSignature);
                    }
                    if (!anchorNode) {
                        anchorNode = Documents.findNodeByContent(tempDiv, change.insertAfter);
                    }

                    if (anchorNode) {
                        const newElement = document.createElement('div');
                        newElement.innerHTML = change.newContent;
                        // Insert all new content after anchor (using DocumentFragment to preserve order)
                        const fragment = document.createDocumentFragment();
                        while (newElement.firstChild) {
                            fragment.appendChild(newElement.firstChild);
                        }
                        anchorNode.after(fragment);
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
                        anchorNode = this.findNodeBySignature(tempDiv, change._cachedSignature);
                    }
                    if (!anchorNode) {
                        anchorNode = Documents.findNodeByContent(tempDiv, change.insertBefore);
                    }

                    if (anchorNode) {
                        const newElement = document.createElement('div');
                        newElement.innerHTML = change.newContent;
                        // Insert all new content before anchor (using DocumentFragment to preserve order)
                        const fragment = document.createDocumentFragment();
                        while (newElement.firstChild) {
                            fragment.appendChild(newElement.firstChild);
                        }
                        anchorNode.before(fragment);
                    } else {
                        console.error('❌ ANCHOR NOT FOUND for insertBefore:', change.insertBefore);
                        console.error('⚠️  Content will be prepended to BEGINNING (this is likely incorrect)');
                        console.error('💡 Tip: Anchor must be complete HTML element, not text fragment');
                        // Prepend to beginning if anchor not found
                        tempDiv.innerHTML = change.newContent + tempDiv.innerHTML;
                    }
                }
            } else if (change.type === 'modify') {
                // Try to use cached signature first, fallback to findNodeByContent
                let nodeToModify = null;
                if (change._cachedSignature) {
                    nodeToModify = this.findNodeBySignature(tempDiv, change._cachedSignature);
                }
                if (!nodeToModify) {
                    nodeToModify = Documents.findNodeByContent(tempDiv, change.originalContent);
                }

                if (nodeToModify) {
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
     * Batch apply changes with single DOM update
     * Uses DocumentFragment for optimal performance
     * @param {string} originalHTML - The original clean document HTML
     * @param {Array} changesToApply - Changes to apply (will be marked as accepted)
     * @returns {string} The resulting HTML after all changes applied
     */
    batchApplyChanges(originalHTML, changesToApply) {
        console.log(`Batch applying ${changesToApply.length} change(s)`);
        const startTime = performance.now();

        // Mark all changes as accepted first
        changesToApply.forEach(change => {
            change.status = 'accepted';
        });

        // Get all accepted changes (including previously accepted + newly accepted)
        const allAccepted = this.changes.filter(c => c.status === 'accepted');

        // Use reconstructDocument with all accepted changes
        const resultHTML = this.reconstructDocument(this.originalDocumentHTML, allAccepted);

        const elapsed = performance.now() - startTime;
        console.log(`Batch apply completed in ${elapsed.toFixed(2)}ms`);

        return resultHTML;
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
        if (Documents.squireEditor) {
            Documents.squireEditor.saveUndoState();
            const editor = Documents.squireEditor.getRoot();
            if (editor) {
                editor.innerHTML = reconstructedHTML;
            }
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
        if (Documents.squireEditor) {
            Documents.squireEditor.saveUndoState();
            const editor = Documents.squireEditor.getRoot();
            if (editor) {
                editor.innerHTML = reconstructedHTML;
            }
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
     * Accept all pending changes with batch processing
     * Uses single DOM update for instant operation regardless of change count
     */
    acceptAll() {
        if (!this.isInReviewMode()) return;
        if (!this.originalDocumentHTML) return;

        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        if (pendingChanges.length === 0) {
            this.exitReviewMode();
            return;
        }

        // Capture state BEFORE applying changes (for undo)
        this.captureHistoryState();

        // Use batch processing - single reconstruction for all changes
        const resultHTML = this.batchApplyChanges(this.originalDocumentHTML, pendingChanges);

        // Update editor with single DOM operation using DocumentFragment pattern
        if (Documents.squireEditor) {
            Documents.squireEditor.saveUndoState();
            const editor = Documents.squireEditor.getRoot();
            if (editor) {
                // Use DocumentFragment for single reflow
                const fragment = document.createDocumentFragment();
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = resultHTML;
                while (tempContainer.firstChild) {
                    fragment.appendChild(tempContainer.firstChild);
                }
                editor.innerHTML = '';
                editor.appendChild(fragment);

                // Ensure new elements have IDs after batch operation
                if (typeof ElementIds !== 'undefined') {
                    ElementIds.ensureIds(editor);
                }
            }
        }

        // Save changes to storage
        Storage.saveClaudeChanges(this.documentId, {
            changeId: 'changes_' + Date.now(),
            documentId: this.documentId,
            timestamp: Date.now(),
            changes: this.changes
        });

        // Capture state AFTER applying changes (creates undo point)
        setTimeout(() => {
            this.captureHistoryState();
            if (Documents && Documents.updateUndoRedoButtons) {
                Documents.updateUndoRedoButtons();
            }
        }, 100);

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

            if (Documents.squireEditor && cleanHTML) {
                Documents.squireEditor.saveUndoState();
                const editor = Documents.squireEditor.getRoot();
                if (editor) {
                    editor.innerHTML = cleanHTML;
                }
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
    }
};
