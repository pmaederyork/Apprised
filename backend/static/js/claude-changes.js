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
     * Pattern Matcher System
     * Enables client-side pattern matching for bulk operations.
     * Claude specifies a pattern type, client finds ALL matching elements.
     */
    PatternMatcher: {
        // Registered patterns - can be extended via register()
        patterns: {
            'empty-paragraphs': {
                description: 'Paragraphs with no content or only whitespace',
                selector: 'p',
                match: (node) => {
                    const text = node.textContent?.trim() || '';
                    // No visible text content
                    if (text !== '') return false;

                    // Check innerHTML - empty, or only contains BR tags, &nbsp;, whitespace
                    const html = node.innerHTML?.trim() || '';
                    if (html === '') return true;

                    // Remove all BR variants, &nbsp;, and whitespace - if nothing left, it's empty
                    const stripped = html
                        .replace(/<br\s*\/?>/gi, '')  // <br>, <br/>, <br />
                        .replace(/&nbsp;/gi, '')      // &nbsp; entities
                        .replace(/\u00A0/g, '')       // actual non-breaking spaces
                        .trim();

                    return stripped === '';
                }
            },
            'empty-lines': {
                description: 'Any block element with no content',
                selector: 'p, div, h1, h2, h3, h4, h5, h6, li',
                match: (node) => {
                    const text = node.textContent?.trim() || '';
                    // No visible text content
                    if (text !== '') return false;

                    // Check innerHTML - empty, or only contains BR tags, &nbsp;, whitespace
                    const html = node.innerHTML?.trim() || '';
                    if (html === '') return true;

                    // Remove all BR variants, &nbsp;, and whitespace - if nothing left, it's empty
                    const stripped = html
                        .replace(/<br\s*\/?>/gi, '')
                        .replace(/&nbsp;/gi, '')
                        .replace(/\u00A0/g, '')
                        .trim();

                    return stripped === '';
                }
            },
            'duplicate-breaks': {
                description: 'Consecutive BR tags',
                selector: 'br',
                match: (node) => {
                    // Match if previous or next sibling is also a BR
                    const prev = node.previousElementSibling;
                    const next = node.nextElementSibling;
                    return (prev && prev.tagName === 'BR') || (next && next.tagName === 'BR');
                }
            },
            'trailing-whitespace': {
                description: 'Elements ending with excessive whitespace',
                selector: 'p, div, span, h1, h2, h3, h4, h5, h6, li',
                match: (node) => {
                    const text = node.textContent || '';
                    // Has 2+ spaces at end or non-breaking spaces
                    return /\s{2,}$/.test(text) || /\u00A0{2,}$/.test(text);
                }
            }
        },

        /**
         * Register a new pattern
         * @param {string} name - Pattern name for reference
         * @param {Object} pattern - Pattern definition with description, selector, match function
         */
        register(name, pattern) {
            if (!pattern.description || !pattern.selector || typeof pattern.match !== 'function') {
                console.error('Invalid pattern definition:', name);
                return false;
            }
            this.patterns[name] = pattern;
            console.log(`Pattern registered: ${name}`);
            return true;
        },

        /**
         * Find all elements matching a pattern in the container
         * @param {Element} container - DOM container to search
         * @param {string} patternName - Name of registered pattern
         * @returns {Array} Array of matching DOM nodes
         */
        findMatches(container, patternName) {
            const pattern = this.patterns[patternName];
            if (!pattern) {
                console.error('Unknown pattern:', patternName);
                return [];
            }

            const candidates = container.querySelectorAll(pattern.selector);
            const matches = [];

            candidates.forEach(node => {
                if (pattern.match(node)) {
                    matches.push(node);
                }
            });

            console.log(`Pattern "${patternName}" found ${matches.length} match(es)`);
            return matches;
        },

        /**
         * Create change objects from pattern matches
         * @param {Element} container - DOM container to search
         * @param {string} patternName - Name of registered pattern
         * @param {string} changeType - Type of change (delete, modify, etc.)
         * @returns {Array} Array of change objects with _patternGroup metadata
         */
        createChangesFromPattern(container, patternName, changeType = 'delete') {
            const matches = this.findMatches(container, patternName);
            const pattern = this.patterns[patternName];

            if (matches.length === 0) {
                console.log(`No matches found for pattern "${patternName}"`);
                return [];
            }

            const patternGroupId = 'pattern_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            const changes = matches.map((node, index) => {
                const change = {
                    id: Storage.generateChangeId(),
                    type: changeType,
                    status: 'pending',
                    originalContent: node.outerHTML,
                    // Pattern metadata for grouping
                    _patternGroup: {
                        groupId: patternGroupId,
                        patternName: patternName,
                        description: pattern.description,
                        totalMatches: matches.length,
                        index: index,
                        isFirst: index === 0
                    }
                };

                // Capture stable ID if element has one
                if (node.dataset && node.dataset.editId) {
                    change.targetId = node.dataset.editId;
                }

                // Cache signature for reliable resolution
                change._cachedSignature = {
                    textContent: node.textContent?.trim() || '',
                    tagName: node.tagName?.toLowerCase() || '',
                    innerHTML: node.innerHTML || '',
                    outerHTML: node.outerHTML || ''
                };

                return change;
            });

            console.log(`Created ${changes.length} change(s) from pattern "${patternName}"`);
            return changes;
        },

        /**
         * Get human-readable description for a pattern
         * @param {string} patternName - Name of registered pattern
         * @returns {string} Description of the pattern
         */
        getDescription(patternName) {
            const pattern = this.patterns[patternName];
            return pattern ? pattern.description : `Unknown pattern: ${patternName}`;
        },

        /**
         * Get list of all registered pattern names
         * @returns {Array} Array of pattern names
         */
        getPatternNames() {
            return Object.keys(this.patterns);
        }
    },

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
     * @param {string} originalHTML - The original document HTML
     * @param {Array} acceptedChanges - Array of accepted change objects
     * @param {Object} options - Options for reconstruction
     * @param {boolean} options.skipOnFailure - If true (default), skip failed resolutions instead of blocking
     * @returns {string} Reconstructed HTML
     */
    reconstructDocument(originalHTML, acceptedChanges, options = {}) {
        const { skipOnFailure = true } = options;
        const skipped = [];
        const applied = [];

        console.log(`🔧 Reconstruction: Applying ${acceptedChanges.length} accepted change(s)`);

        // Create temporary container with original clean HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;

        // Apply each accepted change in order using hybrid resolution
        acceptedChanges.forEach(change => {
            if (change.type === 'delete') {
                // Use hybrid resolution
                const resolution = this.resolveChangeTarget(tempDiv, change);

                if (resolution.node) {
                    resolution.node.remove();
                    applied.push({ change, method: resolution.method });
                    console.log(`✅ DELETE resolved via ${resolution.method}: ${change.id}`);
                } else {
                    const preview = change.originalContent?.substring(0, 100) || 'unknown';
                    if (skipOnFailure) {
                        console.warn(`⚠️ DELETE skipped (not found): "${preview}..."`);
                        skipped.push({ change, reason: 'target not found' });
                    } else {
                        console.error(`❌ DELETE failed: Could not find content to delete: "${preview}..."`);
                    }
                }
            } else if (change.type === 'add') {
                // Use hybrid resolution for anchor
                const resolution = this.resolveChangeTarget(tempDiv, change);

                if (resolution.node) {
                    const newElement = document.createElement('div');
                    newElement.innerHTML = change.newContent;
                    const fragment = document.createDocumentFragment();
                    while (newElement.firstChild) {
                        fragment.appendChild(newElement.firstChild);
                    }

                    // Insert based on anchor type
                    if (change.insertAfter) {
                        resolution.node.after(fragment);
                    } else if (change.insertBefore) {
                        resolution.node.before(fragment);
                    }
                    applied.push({ change, method: resolution.method });
                    console.log(`✅ ADD resolved via ${resolution.method}: ${change.id}`);
                } else {
                    const anchorPreview = (change.insertAfter || change.insertBefore || '').substring(0, 50);
                    if (skipOnFailure) {
                        console.warn(`⚠️ ADD skipped (anchor not found): "${anchorPreview}..."`);
                        skipped.push({ change, reason: 'anchor not found' });
                    } else {
                        console.error(`❌ ADD failed: Anchor not found: "${anchorPreview}..."`);
                        // Fallback to end of document only if not skipping
                        tempDiv.innerHTML += change.newContent;
                    }
                }
            } else if (change.type === 'modify') {
                // Use hybrid resolution
                const resolution = this.resolveChangeTarget(tempDiv, change);

                if (resolution.node) {
                    const newElement = document.createElement('div');
                    newElement.innerHTML = change.newContent;
                    const fragment = document.createDocumentFragment();
                    while (newElement.firstChild) {
                        fragment.appendChild(newElement.firstChild);
                    }
                    resolution.node.replaceWith(fragment);
                    applied.push({ change, method: resolution.method });
                    console.log(`✅ MODIFY resolved via ${resolution.method}: ${change.id}`);
                } else {
                    const preview = change.originalContent?.substring(0, 100) || 'unknown';
                    if (skipOnFailure) {
                        console.warn(`⚠️ MODIFY skipped (not found): "${preview}..."`);
                        skipped.push({ change, reason: 'target not found' });
                    } else {
                        console.error(`❌ MODIFY failed: Could not find content to modify: "${preview}..."`);
                    }
                }
            }
        });

        // Clear cache after reconstruction
        acceptedChanges.forEach(change => {
            delete change._cachedSignature;
        });

        // Log summary
        if (skipped.length > 0) {
            console.warn(`📋 Reconstruction summary: ${applied.length} applied, ${skipped.length} skipped`);
            skipped.forEach(({ change, reason }) => {
                console.warn(`  - Change ${change.id} (${change.type}): ${reason}`);
            });
        } else {
            console.log(`📋 Reconstruction complete: ${applied.length} changes applied successfully`);
        }

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
     * Reject all pending changes with batch processing
     * Uses single DOM update for instant operation regardless of change count
     */
    rejectAll() {
        if (!this.isInReviewMode()) return;
        if (!this.originalDocumentHTML) return;

        const pendingChanges = this.changes.filter(c => c.status === 'pending');
        if (pendingChanges.length === 0) {
            this.exitReviewMode();
            return;
        }

        console.log(`Batch rejecting ${pendingChanges.length} change(s)`);
        const startTime = performance.now();

        // Capture state BEFORE rejecting changes (for undo)
        this.captureHistoryState();

        // Mark all pending as rejected in batch
        pendingChanges.forEach(change => {
            change.status = 'rejected';
        });

        // Reconstruct document with only accepted changes (rejected are excluded)
        const acceptedChanges = this.changes.filter(c => c.status === 'accepted');
        const resultHTML = this.reconstructDocument(this.originalDocumentHTML, acceptedChanges);

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

        const elapsed = performance.now() - startTime;
        console.log(`Batch reject completed in ${elapsed.toFixed(2)}ms`);

        // Save changes to storage
        Storage.saveClaudeChanges(this.documentId, {
            changeId: 'changes_' + Date.now(),
            documentId: this.documentId,
            timestamp: Date.now(),
            changes: this.changes
        });

        // Capture state AFTER rejecting changes (creates undo point)
        setTimeout(() => {
            this.captureHistoryState();
            if (Documents && Documents.updateUndoRedoButtons) {
                Documents.updateUndoRedoButtons();
            }
        }, 100);

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
