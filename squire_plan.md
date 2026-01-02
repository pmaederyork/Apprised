# Squire Editor Migration Plan

## Overview
Migrate Apprised from contenteditable div to Squire editor in 6 carefully orchestrated phases over 16-24 hours of development time. This plan preserves all existing functionality including the critical Claude document editing system.

## Pre-Migration Preparation (30 minutes)
1. **Create feature branch:** `git checkout -b feature/squire-editor-migration`
2. **Download Squire:** Add squire-raw.js to `/backend/static/js/`
3. **Backup critical files:** Create backup branch as safety net
4. **Document current behavior:** Record video of all features working

## Phase 1: Foundation Setup (2 hours)
**Goal:** Install Squire without breaking existing functionality

### Changes:
1. **app.html** (line 278): Remove `contenteditable="true"`, keep `<div id="documentTextarea">`
2. **app.html** (after line 546): Add `<script src="/static/js/squire-raw.js"></script>`
3. **documents.js** (top of file): Initialize Squire instance in `init()` method
4. **documents.js** (line 31): Add `this.squireEditor = null;` to properties
5. **documents.js** (lines 65-70): Replace initialization with Squire setup

### Testing:
- Document editor appears
- Can type in editor
- Auto-save still triggers

## Phase 2: Basic Content Operations (2 hours)
**Goal:** Replace innerHTML operations with Squire API

### Changes:
1. **documents.js** (line 150): `editor.innerHTML = content` → `this.squireEditor.setHTML(content)`
2. **documents.js** (line 162): Keep `focus()` as-is (Squire has focus method)
3. **documents.js** (line 251): `editor.innerHTML` → `this.squireEditor.getHTML()`
4. **tools.js** (line 199): Update to use `Documents.squireEditor.getHTML()`

### Testing:
- Open document loads correctly
- Save document preserves content
- Document context feature sends correct HTML

## Phase 3: Formatting Commands (2 hours)
**Goal:** Replace all execCommand calls with Squire methods

### Changes:
1. **documents.js** (lines 497-527): Replace 12 execCommand calls:
   - `document.execCommand('bold')` → `this.squireEditor.bold()`
   - `document.execCommand('italic')` → `this.squireEditor.italic()`
   - `document.execCommand('underline')` → `this.squireEditor.underline()`
   - etc. for all formatting methods

### Testing:
- All toolbar buttons work
- Keyboard shortcuts work (Ctrl+B, Ctrl+I, etc.)
- Formatting persists after save/reload

## Phase 4: Text Insertion & Selection (4 hours)
**Goal:** Update cursor management and text insertion

### Changes:
1. **documents.js** (lines 418-435): Rewrite `insertTextAtCursor()`:
   ```javascript
   insertTextAtCursor(text) {
       this.squireEditor.focus();
       if (text.includes('<') && text.includes('>')) {
           this.squireEditor.insertHTML(text);
       } else {
           this.squireEditor.insertPlainText(text);
       }
   }
   ```

2. **documents.js** (lines 437-472): Rewrite `wrapSelectedText()` for Squire API
3. **documents.js** (lines 482-495): Rewrite `insertAtLineStart()` for Squire
4. **ui.js** (lines 425-439): Update copy-to-document cursor positioning
5. **files.js** (lines 67-72): Update focus detection to use `squireEditor.getRoot()`

### Testing:
- Copy-to-document button works
- Tab key insertion works
- Text wrapping works
- Paste handling routes correctly

## Phase 5: Undo/Redo System (4-6 hours) ⚠️ HIGH RISK
**Goal:** Integrate custom undo/redo with Squire's history

### Strategy Decision:
**Option A (Recommended):** Use Squire's built-in undo/redo, save state in localStorage
**Option B:** Keep custom system, adapt to Squire API
**Option C:** Hybrid - Squire for undo, custom for persistence

### Changes (Option A):
1. **documents.js** (lines 621-806): Simplify custom undo/redo:
   - Keep `undoStacks` for persistence across sessions
   - Use Squire's `undo()` and `redo()` for actual operations
   - Save Squire state snapshots for history

2. **documents.js** (lines 634-654): Update `getCurrentState()`:
   ```javascript
   getCurrentState() {
       return {
           content: this.squireEditor.getHTML(),
           timestamp: Date.now()
       };
   }
   ```

3. **documents.js** (lines 701-732): Update `restoreState()`:
   ```javascript
   restoreState(state) {
       this.squireEditor.setHTML(state.content);
   }
   ```

### Testing:
- Undo/redo works within session
- Undo/redo persists across document switches
- Review mode blocking still works
- History limit (50) still enforced

## Phase 6: Claude Document Editing (6-8 hours) ⚠️ VERY HIGH RISK
**Goal:** Preserve change tracking, accept/reject functionality

### Changes:
1. **documents.js** (lines 906-1034): Update `renderChangesInDocument()`:
   - Add `this.squireEditor.saveUndoState()` at start
   - Change `editor.innerHTML` to `this.squireEditor.getRoot().innerHTML`
   - Keep node traversal logic (works with Squire's DOM)

2. **documents.js** (lines 1063-1136): Update `findNodeByContent()`:
   - Works with Squire's DOM via `getRoot()`
   - No major changes needed (uses standard DOM traversal)

3. **claude-changes.js** (lines 22-24, 458-460, 528-530, 639-641):
   - Replace `editor.innerHTML` with `Documents.squireEditor.getRoot().innerHTML`
   - Add `saveUndoState()` before each modification

4. **claude-changes.js** (lines 78-236): Update reconstruction methods:
   - Use `Documents.squireEditor.getRoot()` for DOM access
   - Keep content matching algorithms unchanged

### Testing (Critical):
- Claude edit response creates colored highlights
- Change numbers display correctly
- Accept individual change works
- Reject individual change works
- Accept all changes works
- Reject all changes works
- Undo after accepting/rejecting works
- Review mode blocks normal editing

## Phase 7: Polish & Integration Testing (2-4 hours)
**Goal:** Ensure all edge cases work

### Testing Checklist:
- [ ] Create new document
- [ ] Type and format text
- [ ] Bold, italic, underline, strikethrough
- [ ] Bullet lists and numbered lists
- [ ] Undo/redo multiple times
- [ ] Save and reload document
- [ ] Switch between documents
- [ ] Copy message to document (button)
- [ ] Copy message to document (Tab key)
- [ ] Paste from clipboard
- [ ] Paste from Google Docs
- [ ] Document context toggle
- [ ] Send message with doc context
- [ ] Request Claude edits
- [ ] Review colored changes
- [ ] Accept single change
- [ ] Reject single change
- [ ] Accept all changes
- [ ] Reject all changes
- [ ] Undo after accepting changes
- [ ] Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z, Ctrl+Y)
- [ ] Mobile/tablet testing
- [ ] Long document performance

## Rollback Plan
If issues arise:
1. `git checkout main`
2. `git branch -D feature/squire-editor-migration`
3. Document issues in GitHub issue
4. Analyze failure points before retry

## Risk Mitigation
- **Commit after each phase** with descriptive messages
- **Test thoroughly before moving to next phase**
- **Keep backup of working state** at each checkpoint
- **Document any deviations** from plan in comments

## Success Criteria
✅ All existing features work identically
✅ No regression in Claude editing system
✅ Undo/redo works correctly
✅ Copy-to-document works
✅ Performance equal or better
✅ File size reduced (deleted custom undo/redo code)

## Estimated Timeline
- Phase 1: 2 hours
- Phase 2: 2 hours
- Phase 3: 2 hours
- Phase 4: 4 hours
- Phase 5: 4-6 hours
- Phase 6: 6-8 hours
- Phase 7: 2-4 hours

**Total: 22-28 hours** (3-4 full development days)

## Files Modified
1. `/backend/templates/app.html` - Add Squire script, remove contenteditable
2. `/backend/static/js/documents.js` - Core migration (35 methods updated)
3. `/backend/static/js/ui.js` - Copy-to-document (2 methods)
4. `/backend/static/js/files.js` - Focus detection (1 method)
5. `/backend/static/js/tools.js` - Doc context (1 method)
6. `/backend/static/js/claude-changes.js` - Change reconstruction (10 methods)
7. `/backend/static/css/editor.css` - Remove contenteditable styles (optional)

---

## Future: Adding Font Formatting Features

### With Squire, Adding Font Features is MUCH Easier

#### Current State (contenteditable)
To add font sizing, fonts, or headings with contenteditable:
```javascript
// Complex, browser-inconsistent
document.execCommand('fontSize', false, '3'); // Deprecated, unreliable
document.execCommand('fontName', false, 'Arial'); // Doesn't work consistently
```
**Problems:**
- ❌ execCommand is deprecated
- ❌ Browser inconsistencies
- ❌ Creates messy inline styles
- ❌ No clean semantic HTML

#### With Squire - Clean & Simple

**1. Font Size (Easy)**
```javascript
// Squire provides clean API
setFontSize(size) {
    this.squireEditor.setFontSize(size + 'pt');
}

// Or use classes (recommended)
setFontSize(size) {
    this.squireEditor.changeFormat({ tag: 'SPAN', attributes: { class: 'font-size-' + size } });
}
```

**2. Font Family (Easy)**
```javascript
setFontFamily(font) {
    this.squireEditor.setFontFace(font);
}
```

**3. Headings (Very Easy)**
```javascript
// Already built-in!
makeHeading(level) {
    const tag = 'H' + level; // H1, H2, H3, etc.
    this.squireEditor.setFontSize(null);
    this.squireEditor.changeFormat({ tag: tag });
}
```

**4. Text Indentation (Easy)**
```javascript
increaseIndent() {
    this.squireEditor.increaseQuoteLevel();
}

decreaseIndent() {
    this.squireEditor.decreaseQuoteLevel();
}
```

**5. Text Color (Easy)**
```javascript
setTextColor(color) {
    this.squireEditor.setTextColor(color);
}

setHighlightColor(color) {
    this.squireEditor.setHighlightColor(color);
}
```

### Adding a Font Toolbar (After Squire Migration)

**HTML Addition:**
```html
<!-- Add to toolbar in app.html -->
<select id="fontSizeSelect" class="font-size-select">
    <option value="12">12pt</option>
    <option value="14" selected>14pt</option>
    <option value="16">16pt</option>
    <option value="18">18pt</option>
    <option value="24">24pt</option>
</select>

<select id="fontFamilySelect" class="font-family-select">
    <option value="Arial">Arial</option>
    <option value="Times New Roman">Times New Roman</option>
    <option value="Courier New">Courier New</option>
    <option value="Georgia">Georgia</option>
</select>

<select id="headingSelect" class="heading-select">
    <option value="">Normal</option>
    <option value="1">Heading 1</option>
    <option value="2">Heading 2</option>
    <option value="3">Heading 3</option>
</select>

<button id="indentBtn" class="toolbar-btn" title="Increase Indent">
    <span>→</span>
</button>

<button id="outdentBtn" class="toolbar-btn" title="Decrease Indent">
    <span>←</span>
</button>
```

**JavaScript Addition (documents.js):**
```javascript
// In bindEvents()
UI.elements.fontSizeSelect?.addEventListener('change', (e) => {
    this.setFontSize(e.target.value);
});

UI.elements.fontFamilySelect?.addEventListener('change', (e) => {
    this.setFontFamily(e.target.value);
});

UI.elements.headingSelect?.addEventListener('change', (e) => {
    if (e.target.value) {
        this.makeHeading(e.target.value);
    } else {
        this.makeNormalText();
    }
});

UI.elements.indentBtn?.addEventListener('click', () => {
    this.increaseIndent();
});

UI.elements.outdentBtn?.addEventListener('click', () => {
    this.decreaseIndent();
});

// Methods
setFontSize(size) {
    this.squireEditor.setFontSize(size + 'pt');
}

setFontFamily(font) {
    this.squireEditor.setFontFace(font);
}

makeHeading(level) {
    this.squireEditor.changeFormat({ tag: 'H' + level });
}

makeNormalText() {
    this.squireEditor.changeFormat({ tag: 'P' });
}

increaseIndent() {
    this.squireEditor.increaseQuoteLevel();
}

decreaseIndent() {
    this.squireEditor.decreaseQuoteLevel();
}
```

**Total Time to Add:** 1-2 hours

### Comparison Table: Adding Font Features

| Feature | With contenteditable | With Squire |
|---------|---------------------|-------------|
| **Font Size** | Complex execCommand, unreliable | `setFontSize('14pt')` - 1 line |
| **Font Family** | Browser inconsistencies | `setFontFace('Arial')` - 1 line |
| **Headings** | Manual HTML manipulation | `changeFormat({ tag: 'H1' })` - 1 line |
| **Indentation** | Complex range manipulation | `increaseQuoteLevel()` - 1 line |
| **Text Color** | Unreliable execCommand | `setTextColor('#ff0000')` - 1 line |
| **Development Time** | 1-2 days (lots of browser testing) | 1-2 hours (works reliably) |
| **Browser Compatibility** | Constant edge cases | Squire handles it |
| **Clean HTML Output** | Inline styles everywhere | Semantic HTML |

### Why Squire Makes This Easier

**1. Consistent API**
- No browser differences to handle
- Well-tested across browsers
- Predictable behavior

**2. Semantic HTML**
- `<h1>` instead of `<div style="font-size:24pt">`
- Easier for Claude to understand
- Better for accessibility

**3. Clean Output**
- No nested spans
- No redundant styles
- Easier to parse and manipulate

**4. Better Integration with Claude**
- Claude can more easily understand semantic HTML
- Easier to match content with clean structure
- Your `findNodeByContent()` works better with clean HTML

### Example: Current vs Future

**Current (contenteditable):**
```html
<div contenteditable="true">
    <span style="font-size:18pt;font-weight:bold;">Heading</span>
    <div>Normal text</div>
    <span style="font-size:14pt;color:#ff0000;">Red text</span>
</div>
```

**With Squire:**
```html
<div id="documentTextarea">
    <h1>Heading</h1>
    <p>Normal text</p>
    <p><span style="color:#ff0000;">Red text</span></p>
</div>
```

Much cleaner, easier to work with!

---

## Bottom Line

**Yes, Squire makes font formatting MUCH easier:**

✅ **Font size:** 1 line instead of complex execCommand
✅ **Font family:** 1 line, works consistently
✅ **Headings:** Built-in semantic HTML support
✅ **Indentation:** Simple API calls
✅ **Text color:** Reliable, consistent
✅ **Development time:** Hours instead of days
✅ **Browser compatibility:** Handled by Squire
✅ **HTML quality:** Clean, semantic output
✅ **Claude integration:** Better with semantic HTML

**After migrating to Squire, adding a full formatting toolbar would take ~1-2 hours instead of 1-2 days.**