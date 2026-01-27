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
     * Content Index System
     * Pre-builds lookup maps for O(1) node resolution instead of O(M) recursive searches.
     * Call build() once before batch operations, then use findNode() for each change.
     */
    ContentIndex: {
        _cache: null,
        _container: null,
        _usedNodes: null,

        /**
         * Build index for a container (call once before batch operations)
         * Single TreeWalker pass builds all lookup maps
         * @param {Element} container - DOM container to index
         * @returns {Object} The built cache for inspection/debugging
         */
        build(container) {
            const startTime = performance.now();
            this._container = container;
            this._usedNodes = new Set();
            this._cache = {
                byId: new Map(),
                byNormalizedInnerHTML: new Map(),
                byNormalizedOuterHTML: new Map(),
                byTagAndText: new Map(),
                byTextContent: new Map()
            };

            // Single pass using TreeWalker for efficiency
            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_ELEMENT,
                null
            );

            let nodeCount = 0;
            while (walker.nextNode()) {
                const node = walker.currentNode;
                nodeCount++;

                // Skip nodes inside change wrappers (they're visual overlays, not real content)
                if (node.closest('[data-change-id]')) continue;

                // Index by edit-id (O(1) lookup)
                if (node.dataset?.editId) {
                    this._cache.byId.set(node.dataset.editId, node);
                }

                // Index by normalized innerHTML
                const normalizedInner = Documents.normalizeHTML(node.innerHTML);
                if (normalizedInner) {
                    this._addToMapArray(this._cache.byNormalizedInnerHTML, normalizedInner, node);
                }

                // Index by normalized outerHTML
                const normalizedOuter = Documents.normalizeHTML(node.outerHTML);
                if (normalizedOuter) {
                    this._addToMapArray(this._cache.byNormalizedOuterHTML, normalizedOuter, node);
                }

                // Index by tag + text (for signature matching)
                const textContent = (node.textContent?.trim() || '').toLowerCase();
                const tagName = node.tagName?.toLowerCase() || '';
                if (tagName) {
                    const tagTextKey = `${tagName}:${textContent}`;
                    this._addToMapArray(this._cache.byTagAndText, tagTextKey, node);

                    // Also index by text content alone for broader matching
                    if (textContent.length > 10) {
                        this._addToMapArray(this._cache.byTextContent, textContent, node);
                    }
                }
            }

            const elapsed = performance.now() - startTime;
            console.log(`📇 ContentIndex built: ${nodeCount} nodes indexed in ${elapsed.toFixed(2)}ms`);
            return this._cache;
        },

        /**
         * Helper to add node to a Map<string, Node[]>
         */
        _addToMapArray(map, key, node) {
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key).push(node);
        },

        /**
         * Find node using indexed lookup (O(1) per strategy)
         * @param {Object} change - Change object with targetId, _cachedSignature, originalContent
         * @returns {Object|null} { node: Element, method: string } or null
         */
        findNode(change) {
            if (!this._cache) return null;

            // Strategy 1: By edit-id (exact, highest confidence)
            if (change.targetId) {
                const node = this._cache.byId.get(change.targetId);
                if (node && !this._usedNodes.has(node)) {
                    return { node, method: 'index-id' };
                }
            }

            // Strategy 2: By cached signature (tag + text content)
            if (change._cachedSignature) {
                const sig = change._cachedSignature;
                const tagTextKey = `${sig.tagName}:${(sig.textContent || '').toLowerCase()}`;
                const candidates = this._cache.byTagAndText.get(tagTextKey);
                if (candidates) {
                    // Find first unused candidate
                    for (const node of candidates) {
                        if (!this._usedNodes.has(node)) {
                            return { node, method: 'index-signature' };
                        }
                    }
                }
            }

            // Strategy 3: By normalized content (innerHTML)
            if (change.originalContent) {
                const normalizedContent = Documents.normalizeHTML(change.originalContent);

                // Try innerHTML match
                let candidates = this._cache.byNormalizedInnerHTML.get(normalizedContent);
                if (candidates) {
                    for (const node of candidates) {
                        if (!this._usedNodes.has(node)) {
                            return { node, method: 'index-content-inner' };
                        }
                    }
                }

                // Try outerHTML match
                candidates = this._cache.byNormalizedOuterHTML.get(normalizedContent);
                if (candidates) {
                    for (const node of candidates) {
                        if (!this._usedNodes.has(node)) {
                            return { node, method: 'index-content-outer' };
                        }
                    }
                }
            }

            // Strategy 4: For add changes, resolve anchor
            if (change.type === 'add') {
                // Try anchor by ID first (token-efficient format may only have ID)
                if (change.anchorTargetId) {
                    const node = this._cache.byId.get(change.anchorTargetId);
                    if (node) {
                        return { node, method: 'index-anchor-id' };
                    }
                }

                // Try anchor by content
                const anchorContent = change.insertAfter || change.insertBefore;
                if (anchorContent) {
                    // Try anchor by normalized content
                    const normalizedAnchor = Documents.normalizeHTML(anchorContent);
                    let candidates = this._cache.byNormalizedOuterHTML.get(normalizedAnchor);
                    if (candidates && candidates.length > 0) {
                        return { node: candidates[0], method: 'index-anchor-content' };
                    }

                    candidates = this._cache.byNormalizedInnerHTML.get(normalizedAnchor);
                    if (candidates && candidates.length > 0) {
                        return { node: candidates[0], method: 'index-anchor-content' };
                    }
                }
            }

            return null;
        },

        /**
         * Mark a node as used (prevents re-matching same node for multiple changes)
         * @param {Element} node - The node to mark
         */
        markUsed(node) {
            if (this._usedNodes) {
                this._usedNodes.add(node);
            }
        },

        /**
         * Remove node from index (call after deletion)
         * @param {Element} node - The node being removed
         */
        removeNode(node) {
            if (!this._cache || !node) return;

            // Remove from byId
            if (node.dataset?.editId) {
                this._cache.byId.delete(node.dataset.editId);
            }

            // For array-based maps, we just mark as used
            // (actual removal is expensive and unnecessary since we check usedNodes)
            this._usedNodes.add(node);
        },

        /**
         * Clear the index and release memory
         */
        clear() {
            this._cache = null;
            this._container = null;
            this._usedNodes = null;
        }
    },

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
                selector: 'p, div',
                match: (node) => {
                    // Simple check: if textContent is empty, the paragraph is empty
                    // (regardless of how many span/style wrappers it has)
                    const text = node.textContent?.trim() || '';
                    return text === '';
                }
            },
            'empty-lines': {
                description: 'Any block element with no content',
                selector: 'p, div, h1, h2, h3, h4, h5, h6, li',
                match: (node) => {
                    // Simple check: if textContent is empty, the element is empty
                    const text = node.textContent?.trim() || '';
                    return text === '';
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
            // Try ID-based anchor resolution first (token-efficient format may only have ID)
            if (change.anchorTargetId) {
                const anchorById = typeof ElementIds !== 'undefined'
                    ? ElementIds.findById(container, change.anchorTargetId)
                    : container.querySelector(`[data-edit-id="${change.anchorTargetId}"]`);

                if (anchorById) {
                    return { node: anchorById, method: 'anchor-id' };
                }
            }

            // Fall back to content-based anchor resolution
            const anchorContent = change.insertAfter || change.insertBefore;
            if (anchorContent) {
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
     *
     * OPTIMIZED: Uses ContentIndex for O(1) lookups instead of O(M) recursive searches.
     * Groups changes by type and processes additions in document order (top to bottom).
     *
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
        const startTime = performance.now();

        console.log(`🔧 Reconstruction: Applying ${acceptedChanges.length} accepted change(s)`);

        // Create temporary container with original clean HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;

        // BUILD INDEX ONCE - O(M) single pass
        this.ContentIndex.build(tempDiv);

        // Group changes by type for optimal processing order
        // CRITICAL: Order matters! Modifications and additions must happen BEFORE deletions,
        // otherwise deletions can remove anchors that additions need to reference.
        const deletions = acceptedChanges.filter(c => c.type === 'delete');
        const modifications = acceptedChanges.filter(c => c.type === 'modify');
        const additions = acceptedChanges.filter(c => c.type === 'add');

        // Helper to resolve with index first, then fallback
        const resolveWithIndex = (change) => {
            // Try indexed lookup first (O(1))
            let resolution = this.ContentIndex.findNode(change);
            if (resolution?.node) {
                return resolution;
            }
            // Fallback to original resolution (O(M) but rarely needed)
            return this.resolveChangeTarget(tempDiv, change);
        };

        // PRE-RESOLVE ADD ANCHORS before modifications change the DOM
        // This is critical because modifications may change content that ADDs use as anchors
        const preResolvedAnchors = new Map();
        additions.forEach(change => {
            if (!change._chainedAfter) { // Only regular additions, not chained
                const resolution = resolveWithIndex(change);
                if (resolution?.node) {
                    preResolvedAnchors.set(change.id, {
                        node: resolution.node,
                        method: resolution.method
                    });
                }
            }
        });

        // Track node replacements so we can update pre-resolved anchors
        const nodeReplacements = new Map();

        // 1. Process MODIFICATIONS first (in-place replacement, preserves anchors)
        modifications.forEach(change => {
            const resolution = resolveWithIndex(change);

            if (resolution.node) {
                const newElement = document.createElement('div');
                newElement.innerHTML = change.newContent;
                const fragment = document.createDocumentFragment();
                const firstNewChild = newElement.firstChild;
                let lastNewChild = null;
                while (newElement.firstChild) {
                    lastNewChild = newElement.firstChild;
                    fragment.appendChild(newElement.firstChild);
                }

                // Track the replacement so ADD anchors can be updated
                // Store both first and last for insertBefore/insertAfter handling
                if (firstNewChild) {
                    nodeReplacements.set(resolution.node, {
                        first: firstNewChild,
                        last: lastNewChild || firstNewChild
                    });
                }

                this.ContentIndex.removeNode(resolution.node);
                resolution.node.replaceWith(fragment);
                applied.push({ change, method: resolution.method });
            } else {
                const preview = change.originalContent?.substring(0, 100) || 'unknown';
                if (skipOnFailure) {
                    skipped.push({ change, reason: 'target not found' });
                } else {
                    console.error(`❌ MODIFY failed: Could not find content to modify: "${preview}..."`);
                }
            }
        });

        // Update pre-resolved anchors if they were replaced by modifications
        for (const [changeId, resolution] of preResolvedAnchors) {
            const replacement = nodeReplacements.get(resolution.node);
            if (replacement) {
                // Get the corresponding ADD change to determine insert direction
                const addChange = additions.find(c => c.id === changeId);
                // Use last element for insertAfter, first element for insertBefore
                const newNode = (addChange?.insertAfter || addChange?._anchorDirection === 'after')
                    ? replacement.last
                    : replacement.first;
                preResolvedAnchors.set(changeId, {
                    node: newNode,
                    method: resolution.method + '-updated'
                });
            }
        }

        // 2. Process ADDITIONS - handle both regular and chained sequence items
        // Separate chained items (those with _chainedAfter) from regular additions
        const regularAdditions = additions.filter(c => !c._chainedAfter);
        const chainedAdditions = additions.filter(c => c._chainedAfter);

        // Track inserted elements by change ID for chained resolution
        const insertedByChangeId = new Map();

        // Sort regular additions by anchor position - earlier anchors first (top to bottom)
        // Use pre-resolved anchors to get positions (anchors were resolved before modifications)
        // Since we pre-resolve to actual DOM nodes, the order shouldn't affect correctness
        const additionsWithPosition = regularAdditions.map(change => {
            let position = Infinity;
            const preResolved = preResolvedAnchors.get(change.id);
            if (preResolved?.node) {
                // Get DOM position by walking tree
                const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_ELEMENT, null);
                let idx = 0;
                while (walker.nextNode()) {
                    if (walker.currentNode === preResolved.node) {
                        position = idx;
                        break;
                    }
                    idx++;
                }
            }
            return { change, position };
        });

        // Sort by position ascending (process earlier positions first - top to bottom for better UX)
        additionsWithPosition.sort((a, b) => a.position - b.position);

        // Process regular additions using pre-resolved anchors
        additionsWithPosition.forEach(({ change }) => {
            // Use pre-resolved anchor (resolved before modifications changed DOM)
            const resolution = preResolvedAnchors.get(change.id) || { node: null, method: 'failed' };

            if (resolution.node && resolution.node.parentNode) {
                const newElement = document.createElement('div');
                newElement.innerHTML = change.newContent;

                // Track the last inserted element for chaining
                let lastInserted = null;
                const fragment = document.createDocumentFragment();
                while (newElement.firstChild) {
                    lastInserted = newElement.firstChild;
                    fragment.appendChild(newElement.firstChild);
                }

                // Insert based on anchor type (handle ID-only format with _anchorDirection)
                if (change.insertAfter || change._anchorDirection === 'after') {
                    resolution.node.after(fragment);
                } else if (change.insertBefore || change._anchorDirection === 'before') {
                    resolution.node.before(fragment);
                }

                // Track for chained items
                if (lastInserted) {
                    insertedByChangeId.set(change.id, lastInserted);
                }

                applied.push({ change, method: resolution.method });
            } else {
                const anchorPreview = (change.insertAfter || change.insertBefore || change.anchorTargetId || '').substring(0, 50);
                if (skipOnFailure) {
                    skipped.push({ change, reason: 'anchor not found' });
                } else {
                    console.error(`❌ ADD failed: Anchor not found: "${anchorPreview}..."`);
                    // Fallback to end of document only if not skipping
                    tempDiv.innerHTML += change.newContent;
                }
            }
        });

        // Process chained additions in order (they depend on previous items)
        // Build dependency order: process items whose _chainedAfter has been processed
        const processedChains = new Set();
        let remainingChained = [...chainedAdditions];
        let maxIterations = chainedAdditions.length + 1; // Safety limit

        while (remainingChained.length > 0 && maxIterations-- > 0) {
            const toProcess = [];
            const stillRemaining = [];

            for (const change of remainingChained) {
                // Can process if the chained anchor has been inserted
                if (insertedByChangeId.has(change._chainedAfter)) {
                    toProcess.push(change);
                } else {
                    stillRemaining.push(change);
                }
            }

            if (toProcess.length === 0 && stillRemaining.length > 0) {
                // No progress possible - skip remaining chained items
                stillRemaining.forEach(change => {
                    skipped.push({ change, reason: 'chained anchor not found' });
                });
                break;
            }

            // Process items that are ready
            for (const change of toProcess) {
                const anchorNode = insertedByChangeId.get(change._chainedAfter);

                if (anchorNode && anchorNode.parentNode) {
                    const newElement = document.createElement('div');
                    newElement.innerHTML = change.newContent;

                    let lastInserted = null;
                    const fragment = document.createDocumentFragment();
                    while (newElement.firstChild) {
                        lastInserted = newElement.firstChild;
                        fragment.appendChild(newElement.firstChild);
                    }

                    // Insert after the previous chained element
                    anchorNode.after(fragment);

                    // Track for subsequent chained items
                    if (lastInserted) {
                        insertedByChangeId.set(change.id, lastInserted);
                    }

                    applied.push({ change, method: 'chained-sequence' });
                } else {
                    skipped.push({ change, reason: 'chained anchor removed' });
                }
            }

            remainingChained = stillRemaining;
        }

        // 3. Process DELETIONS last (after all additions have used their anchors)
        deletions.forEach(change => {
            const resolution = resolveWithIndex(change);

            if (resolution.node) {
                this.ContentIndex.removeNode(resolution.node);
                resolution.node.remove();
                applied.push({ change, method: resolution.method });
            } else {
                const preview = change.originalContent?.substring(0, 100) || 'unknown';
                if (skipOnFailure) {
                    skipped.push({ change, reason: 'target not found' });
                } else {
                    console.error(`❌ DELETE failed: Could not find content to delete: "${preview}..."`);
                }
            }
        });

        // Clear index to release memory
        this.ContentIndex.clear();

        // Clear signature cache after reconstruction
        acceptedChanges.forEach(change => {
            delete change._cachedSignature;
        });

        // Ensure all elements have data-edit-ids for subsequent agent targeting
        if (typeof ElementIds !== 'undefined') {
            ElementIds.ensureIds(tempDiv);
        }

        const elapsed = performance.now() - startTime;

        // Log summary
        if (skipped.length > 0) {
            console.warn(`📋 Reconstruction: ${applied.length} applied, ${skipped.length} skipped in ${elapsed.toFixed(2)}ms`);
            skipped.forEach(({ change, reason }) => {
                console.warn(`  - Change ${change.id} (${change.type}): ${reason}`);
            });
        } else {
            console.log(`📋 Reconstruction complete: ${applied.length} changes in ${elapsed.toFixed(2)}ms`);
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
