---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/templates/app.html
  - backend/static/js/documents.js
  - backend/static/js/storage.js
  - backend/static/css/editor.css
autonomous: true

must_haves:
  truths:
    - "Toggle appears in doc editor toolbar (right side, near Save/Pull/Close buttons)"
    - "Toggle state persists across page refreshes"
    - "When ON and Claude proposes edits, changes are auto-accepted without review panel"
    - "When OFF, normal review flow works (review panel opens)"
  artifacts:
    - path: "backend/templates/app.html"
      provides: "Toggle HTML element in editor toolbar"
      contains: "autoAcceptEditsToggle"
    - path: "backend/static/js/storage.js"
      provides: "getSetting/saveSetting already exist"
    - path: "backend/static/js/documents.js"
      provides: "Auto-accept logic in applyClaudeEdits"
      contains: "autoAcceptEdits"
    - path: "backend/static/css/editor.css"
      provides: "Toggle styling"
      contains: "auto-accept-toggle"
  key_links:
    - from: "backend/static/js/documents.js"
      to: "Storage.getSetting"
      via: "reading autoAcceptEdits setting"
      pattern: "Storage\\.getSetting.*autoAcceptEdits"
---

<objective>
Add an "Auto-accept edits" toggle to the document editor toolbar.

Purpose: Allow users to skip the review panel and automatically accept all Claude-proposed edits when the toggle is ON. This speeds up workflow for users who trust Claude's edits.

Output: Working toggle that persists state and modifies the edit acceptance flow.
</objective>

<execution_context>
@/Users/pax/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pax/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/templates/app.html (doc editor section lines 253-363)
@backend/static/js/documents.js (applyClaudeEdits method around line 1955)
@backend/static/js/storage.js (getSetting/saveSetting methods)
@backend/static/css/editor.css (toolbar styles)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add toggle HTML and storage</name>
  <files>
    backend/templates/app.html
    backend/static/js/storage.js
  </files>
  <action>
    1. In app.html, add the auto-accept toggle to the document editor header (inside .editor-actions div, before the Save button):
       ```html
       <label class="auto-accept-toggle" title="Auto-accept Claude's edits">
           <input type="checkbox" id="autoAcceptEditsToggle">
           <span class="toggle-slider"></span>
           <span class="toggle-label">Auto</span>
       </label>
       ```

    2. Storage already has getSetting/saveSetting methods - no changes needed there.

    3. Add UI element reference in ui.js:
       - Add `autoAcceptEditsToggle: document.getElementById('autoAcceptEditsToggle')` to the elements object
  </action>
  <verify>
    - grep for "autoAcceptEditsToggle" in app.html returns the checkbox
    - grep for "autoAcceptEditsToggle" in ui.js returns the element reference
  </verify>
  <done>Toggle HTML exists in editor toolbar and UI reference is registered</done>
</task>

<task type="auto">
  <name>Task 2: Add toggle styling and behavior</name>
  <files>
    backend/static/css/editor.css
    backend/static/js/documents.js
  </files>
  <action>
    1. In editor.css, add styling for the auto-accept toggle (place after .editor-actions styles around line 54):
       ```css
       /* Auto-accept edits toggle */
       .auto-accept-toggle {
           display: flex;
           align-items: center;
           gap: 6px;
           cursor: pointer;
           font-size: var(--text-xs);
           color: var(--color-text-secondary);
           user-select: none;
       }

       .auto-accept-toggle input[type="checkbox"] {
           display: none;
       }

       .auto-accept-toggle .toggle-slider {
           width: 32px;
           height: 18px;
           background: var(--color-bg-subtle);
           border-radius: 9px;
           position: relative;
           transition: background 0.2s ease;
           border: 1px solid var(--color-border);
       }

       .auto-accept-toggle .toggle-slider::before {
           content: '';
           position: absolute;
           width: 14px;
           height: 14px;
           border-radius: 50%;
           background: white;
           top: 1px;
           left: 1px;
           transition: transform 0.2s ease;
           box-shadow: 0 1px 2px rgba(0,0,0,0.2);
       }

       .auto-accept-toggle input:checked + .toggle-slider {
           background: var(--color-primary);
           border-color: var(--color-primary);
       }

       .auto-accept-toggle input:checked + .toggle-slider::before {
           transform: translateX(14px);
       }

       .auto-accept-toggle .toggle-label {
           font-weight: 500;
       }
       ```

    2. In documents.js, add:
       a. In bindEvents(), add event listener for toggle (after existing button bindings):
          ```javascript
          // Auto-accept toggle
          UI.elements.autoAcceptEditsToggle?.addEventListener('change', () => {
              const isEnabled = UI.elements.autoAcceptEditsToggle.checked;
              Storage.saveSetting('autoAcceptEdits', isEnabled);
              console.log('Auto-accept edits:', isEnabled ? 'enabled' : 'disabled');
          });
          ```

       b. In init(), restore toggle state from storage (after this.initialized = true):
          ```javascript
          // Restore auto-accept toggle state
          if (UI.elements.autoAcceptEditsToggle) {
              UI.elements.autoAcceptEditsToggle.checked = Storage.getSetting('autoAcceptEdits', false);
          }
          ```

       c. Modify applyClaudeEdits() to check auto-accept setting. Replace the existing method body:
          - After the early return checks for currentDocumentId and changes
          - Add auto-accept check:
          ```javascript
          // Check if auto-accept is enabled
          const autoAccept = Storage.getSetting('autoAcceptEdits', false);

          if (autoAccept) {
              // Auto-accept mode: apply all changes directly without review
              console.log(`Auto-accepting ${changes.length} Claude edit(s)`);

              // Ensure elements have IDs
              if (typeof ElementIds !== 'undefined' && this.squireEditor) {
                  ElementIds.ensureIds(this.squireEditor.getRoot());
              }

              // Cache original HTML before changes
              const editor = this.squireEditor.getRoot();
              const originalHTML = editor.innerHTML;

              // Mark all changes as accepted
              changes.forEach(change => {
                  change.status = 'accepted';
              });

              // Use ClaudeChanges reconstruction to apply all changes
              const reconstructedHTML = ClaudeChanges.reconstructDocument(originalHTML, changes);

              // Apply to editor
              this.squireEditor.saveUndoState();
              editor.innerHTML = reconstructedHTML;

              // Ensure new elements have IDs
              if (typeof ElementIds !== 'undefined') {
                  ElementIds.ensureIds(editor);
              }

              // Save document
              this.saveCurrentDocument();

              // Notify user
              if (typeof Chat !== 'undefined') {
                  Chat.addSystemMessage(`Auto-accepted ${changes.length} change${changes.length !== 1 ? 's' : ''} from Claude.`);
              }

              return;
          }

          // Normal review mode continues below...
          ```
  </action>
  <verify>
    - Open document, toggle should appear styled in toolbar
    - Toggle ON, refresh page, toggle should remain ON
    - Console shows "Auto-accept edits: enabled/disabled" on toggle
  </verify>
  <done>Toggle is styled, state persists, and console shows toggle events</done>
</task>

<task type="auto">
  <name>Task 3: Update UI.js and test auto-accept flow</name>
  <files>
    backend/static/js/ui.js
  </files>
  <action>
    1. In ui.js, add the element reference to the elements object (around line 93, after formatSelect):
       ```javascript
       autoAcceptEditsToggle: document.getElementById('autoAcceptEditsToggle'),
       ```

    2. Manual verification steps (execute these to confirm everything works):
       - Open a document
       - Turn ON the auto-accept toggle
       - Send a message to Claude asking for a document edit (e.g., "Add a paragraph about testing")
       - Verify: Changes are applied directly, NO review panel appears
       - Turn OFF the toggle
       - Send another edit request
       - Verify: Review panel appears as normal
  </action>
  <verify>
    - grep for "autoAcceptEditsToggle" in ui.js returns the element reference
    - With toggle ON: Claude edits apply instantly, no review panel
    - With toggle OFF: Review panel appears for accepting/rejecting
  </verify>
  <done>Auto-accept toggle fully functional - edits bypass review when enabled</done>
</task>

</tasks>

<verification>
1. Toggle visible in doc editor toolbar (right side)
2. Toggle state persists across refresh (check localStorage appSettings.autoAcceptEdits)
3. Toggle ON: Claude edits auto-apply without review panel
4. Toggle OFF: Normal review flow with panel
5. System message confirms auto-acceptance in chat
</verification>

<success_criteria>
- [ ] Toggle appears in document editor toolbar (near Save/Pull/Close)
- [ ] Toggle styled consistently with existing app toggles
- [ ] Setting persists in localStorage via Storage.saveSetting
- [ ] When ON: Claude edits are auto-accepted, review panel never opens
- [ ] When OFF: Normal review flow (panel opens, user accepts/rejects)
- [ ] System message in chat confirms auto-accepted changes
</success_criteria>

<output>
After completion, create `.planning/quick/003-add-autoaccept-edits-toggle/003-SUMMARY.md`
</output>
