---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/static/js/documents.js
autonomous: true

must_haves:
  truths:
    - "Undo operation clears all Claude change highlighting from document"
    - "Redo operation clears all Claude change highlighting from document"
    - "Change number indicators disappear after undo/redo"
  artifacts:
    - path: "backend/static/js/documents.js"
      provides: "restoreState() method with cleanup logic"
      contains: "cleanupChangeOverlays"
  key_links:
    - from: "restoreState()"
      to: "ClaudeChanges.cleanupChangeNumbers()"
      via: "method call after setHTML"
      pattern: "cleanupChangeNumbers"
---

<objective>
Fix edit highlighting cleanup on undo/redo operations.

**Problem:** When user undos a previous edit, the Claude Changes overlay (change numbers, purple/green/red highlighting) persists even after the document content is restored. The rendering system isn't cleaning up overlay elements when document state changes via undo/redo.

**Root Cause:** The `restoreState()` method in documents.js only calls `setHTML()` to restore content but doesn't clean up:
1. `.claude-change-number` elements (positioned absolutely outside content flow)
2. CSS classes on elements (`claude-change-delete`, `claude-change-add`, `claude-change-modify`, `claude-change-active`)
3. `data-change-id` attributes on elements
4. `.pattern-group-indicator` elements

**Solution:** Add cleanup logic to `restoreState()` that removes all Claude Changes overlay elements and classes after restoring the HTML content.
</objective>

<execution_context>
@/Users/pax/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pax/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/static/js/documents.js - Contains restoreState(), undo(), redo() methods
@backend/static/js/claude-changes.js - Contains cleanupChangeNumbers() method
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add cleanup method and integrate with restoreState</name>
  <files>backend/static/js/documents.js</files>
  <action>
1. Add a new method `cleanupChangeOverlays()` to the Documents object that cleans up all Claude Changes UI artifacts:
   - Remove all `.claude-change-number` elements from document
   - Remove all `.pattern-group-indicator` elements from document
   - Remove `data-change-id` attributes from all elements
   - Remove CSS classes: `claude-change-delete`, `claude-change-add`, `claude-change-modify`, `claude-change-active`, `claude-change-pattern`

2. Call `this.cleanupChangeOverlays()` in `restoreState()` AFTER calling `this.squireEditor.setHTML(state.content)` to ensure overlays are cleared when content is restored.

3. Also call `ClaudeChanges.cleanupChangeNumbers()` if ClaudeChanges is defined (for redundancy - it handles the same `.claude-change-number` elements).

Location: Add the new method near the other history-related methods (around line 1714-1728 area, after restoreState).

Implementation for cleanupChangeOverlays():
```javascript
cleanupChangeOverlays() {
    // Remove change number indicators
    document.querySelectorAll('.claude-change-number').forEach(el => el.remove());

    // Remove pattern group indicators
    document.querySelectorAll('.pattern-group-indicator').forEach(el => el.remove());

    // Get editor root for scoped cleanup
    const editor = this.squireEditor?.getRoot();
    if (!editor) return;

    // Remove data-change-id attributes and highlight classes from all elements
    editor.querySelectorAll('[data-change-id]').forEach(el => {
        el.removeAttribute('data-change-id');
        el.classList.remove(
            'claude-change-delete',
            'claude-change-add',
            'claude-change-modify',
            'claude-change-active',
            'claude-change-pattern'
        );
    });
}
```

Update restoreState() to call cleanup:
```javascript
restoreState(state) {
    if (!this.squireEditor || !state) return;

    // Set flag to prevent history capture during restoration
    this.isRestoring = true;

    this.squireEditor.setHTML(state.content);

    // Clean up any orphaned Claude Changes overlays
    this.cleanupChangeOverlays();

    this.squireEditor.focus();

    // Clear restoration flag
    this.isRestoring = false;

    // Trigger auto-save but NOT history capture
    this.scheduleAutoSave();
}
```
  </action>
  <verify>
Manual test:
1. Open a document with some text
2. Ask Claude to make changes (trigger review mode)
3. Accept or reject some changes (overlays should appear)
4. Exit review mode
5. Press Ctrl+Z to undo
6. Verify: Change numbers and highlighting are gone
7. Press Ctrl+Y to redo
8. Verify: Change numbers and highlighting are still gone (clean content restored)
  </verify>
  <done>
- cleanupChangeOverlays() method exists in Documents object
- restoreState() calls cleanupChangeOverlays() after setHTML()
- Undo/redo operations remove all Claude change highlighting
- No visual artifacts remain after undo/redo
  </done>
</task>

</tasks>

<verification>
1. Open a document, trigger Claude changes, accept/reject some, then undo
2. Change number indicators (.claude-change-number) should not be visible
3. Highlighting colors (green/red/blue backgrounds) should not be visible
4. Console shows no errors during undo/redo operations
</verification>

<success_criteria>
- Undo operation removes all Claude change overlays
- Redo operation removes all Claude change overlays
- No JavaScript errors in console
- Document content is correctly restored (not affected by cleanup)
</success_criteria>

<output>
After completion, create `.planning/quick/001-fix-edit-highlighting-cleanup-on-undo/001-SUMMARY.md`
</output>
