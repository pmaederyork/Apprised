/**
 * Stable Element ID Management
 * Assigns and manages data-edit-id attributes for reliable change targeting
 */
const ElementIds = {
    // Block-level tags that should receive edit IDs
    BLOCK_TAGS: ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'BLOCKQUOTE', 'PRE', 'UL', 'OL'],

    /**
     * Assign stable IDs to all block-level elements in editor
     * Safe to re-call - skips elements that already have IDs
     * @param {Element} editorRoot - The root element of the editor
     */
    assignIds(editorRoot) {
        if (!editorRoot) return;

        const walker = document.createTreeWalker(
            editorRoot,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    // Only block-level elements, skip if already has ID
                    if (this.BLOCK_TAGS.includes(node.tagName) && !node.dataset.editId) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        while (walker.nextNode()) {
            walker.currentNode.dataset.editId = crypto.randomUUID();
        }
    },

    /**
     * Find element by its stable ID
     * @param {Element} container - Container to search within
     * @param {string} editId - The data-edit-id value to find
     * @returns {Element|null}
     */
    findById(container, editId) {
        if (!container || !editId) return null;
        return container.querySelector(`[data-edit-id="${editId}"]`);
    },

    /**
     * Ensure all elements have IDs (alias for assignIds for clarity)
     * Call after content insertion or Squire format operations
     * @param {Element} editorRoot - The root element of the editor
     */
    ensureIds(editorRoot) {
        this.assignIds(editorRoot);
    },

    /**
     * Get ID from element, assigning one if missing
     * @param {Element} element - Element to get/assign ID for
     * @returns {string|null} The element's edit ID
     */
    getOrCreateId(element) {
        if (!element || element.nodeType !== 1) return null;

        if (!element.dataset.editId) {
            element.dataset.editId = crypto.randomUUID();
        }
        return element.dataset.editId;
    },

    /**
     * Count elements with IDs in container (for debugging)
     * @param {Element} container - Container to count within
     * @returns {number}
     */
    countIds(container) {
        if (!container) return 0;
        return container.querySelectorAll('[data-edit-id]').length;
    }
};
