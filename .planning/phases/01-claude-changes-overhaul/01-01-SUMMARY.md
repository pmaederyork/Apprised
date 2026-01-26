---
phase: 01
plan: 01
subsystem: document-editor
tags: [element-ids, dom-tracking, change-targeting, infrastructure]

dependency-graph:
  requires: []
  provides:
    - "ElementIds module for stable element ID assignment"
    - "data-edit-id attributes on all block-level elements"
    - "ID persistence across document save/reload cycles"
  affects:
    - "01-02 (Hybrid Resolution) - can use element IDs for targeting"
    - "01-03 (Batch Operations) - element IDs enable precise updates"
    - "01-04 (Pattern Matching) - IDs provide stable references"

tech-stack:
  added: []
  patterns:
    - "TreeWalker for efficient DOM traversal"
    - "crypto.randomUUID() for secure ID generation"
    - "Idempotent ID assignment (safe to re-call)"
    - "Graceful degradation with typeof checks"

key-files:
  created:
    - "backend/static/js/element-ids.js"
  modified:
    - "backend/templates/app.html"
    - "backend/static/js/documents.js"

decisions:
  - id: "use-treewalk"
    choice: "TreeWalker over querySelectorAll"
    reason: "Browser-optimized, handles edge cases, allows filtering during traversal"
  - id: "uuid-generation"
    choice: "crypto.randomUUID() over timestamp-based IDs"
    reason: "Native API, cryptographically secure, no collisions"
  - id: "idempotent-design"
    choice: "Skip elements with existing IDs"
    reason: "Safe to call multiple times, preserves existing IDs on reload"

metrics:
  duration: "~85 seconds"
  completed: "2026-01-26"
---

# Phase 01 Plan 01: Stable Element ID Infrastructure Summary

Stable element ID system using data-edit-id attributes with TreeWalker traversal and crypto.randomUUID() generation.

## What Was Built

### ElementIds Module (`backend/static/js/element-ids.js`)

New module providing stable element identification for reliable change targeting:

**Core Capabilities:**
- `assignIds(editorRoot)` - Assigns unique IDs to all block-level elements
- `findById(container, editId)` - Locates element by its stable ID
- `ensureIds(editorRoot)` - Alias for assignIds (semantic clarity)
- `getOrCreateId(element)` - Gets or creates ID for single element
- `countIds(container)` - Debug utility for counting assigned IDs

**Supported Block Tags:**
- Headers: H1, H2, H3, H4, H5, H6
- Text blocks: P, DIV, BLOCKQUOTE, PRE
- Lists: UL, OL, LI

**Design Decisions:**
1. **TreeWalker traversal** - Browser-optimized, efficient for large documents
2. **crypto.randomUUID()** - Native, cryptographically secure IDs
3. **Idempotent assignment** - Safe to call repeatedly, preserves existing IDs

### Document Lifecycle Integration

**In `openDocument()`:**
```javascript
this.squireEditor.setHTML(document.content || '');

// Assign stable element IDs for change tracking
if (typeof ElementIds !== 'undefined') {
    ElementIds.assignIds(this.squireEditor.getRoot());
}
```

**In `applyClaudeEdits()`:**
```javascript
// Ensure all elements have IDs before processing changes
if (typeof ElementIds !== 'undefined' && this.squireEditor) {
    ElementIds.ensureIds(this.squireEditor.getRoot());
}
```

## Implementation Details

### ID Storage
- Uses `data-edit-id` HTML attribute
- IDs persist in saved document HTML
- Survives page reload when document reopened

### Graceful Degradation
- All integrations check `typeof ElementIds !== 'undefined'`
- System continues to work if module fails to load

### Script Loading Order
```html
<script src="/static/js/headerFormats.js"></script>
<script src="/static/js/element-ids.js"></script>  <!-- NEW -->
<script src="/static/js/documents.js"></script>
```

## Commits

| Hash | Description |
|------|-------------|
| f4716b2 | feat(01-01): create element-ids.js module |
| bac1dd8 | feat(01-01): add element-ids.js script tag to app.html |
| c9ba228 | feat(01-01): integrate ElementIds into document lifecycle |

## Verification

To verify the implementation:

1. Open a document in the editor
2. Open browser DevTools console
3. Run: `document.querySelectorAll('[data-edit-id]').length`
4. Should return count > 0 matching block element count
5. Refresh page, reopen document - IDs persist (same count)
6. Run: `ElementIds.countIds(Documents.squireEditor.getRoot())` for same result

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Dependencies Satisfied:**
- ElementIds module globally available
- All block elements get stable IDs on document open
- IDs persist through save/reload

**Ready for:**
- 01-02: Hybrid Resolution can use element IDs for precise targeting
- 01-03: Batch Operations can reference elements by stable ID
- 01-04: Pattern Matching has reliable element references
