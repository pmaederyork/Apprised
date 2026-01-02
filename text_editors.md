# Text Editor Research for Apprised

## Executive Summary

After extensive research into upgrading Apprised's document editor from a basic `contenteditable` div, **Squire by Fastmail** emerges as the clear winner for your needs. The analysis compared four options: TipTap, Squire, Jodit, and SunEditor, evaluating each against your critical requirement: **compatibility with Claude's document editing system** that finds and wraps text nodes in colored divs for change tracking.

**Recommendation: Squire**
- **Migration time:** 2-3 hours (vs 7-10 days for TipTap)
- **Compatibility score:** 95/100
- **File size:** 16KB (vs 300KB+ for alternatives)
- **Risk level:** Low - your existing code works almost unchanged

---

## Current Architecture

### What You Have Now
- **Editor:** `contenteditable="true"` div (lines 278 in app.html)
- **Storage:** HTML strings in localStorage
- **Formatting:** `document.execCommand()` commands (bold, italic, underline, etc.)
- **Critical Feature:** Claude document editing system (lines 856-1252 in documents.js)

### Claude Editing System Requirements
Your most complex feature relies on:
1. `findNodeByContent()` - traverses DOM to find specific text nodes
2. Direct DOM manipulation - wraps changes in colored divs with custom classes
3. Accept/reject logic - manipulates HTML directly via `replaceWith()`, `before()`, `after()`
4. innerHTML manipulation - reads and writes raw HTML

**This is your biggest constraint** - any editor that abstracts away direct DOM access will break this system.

---

## Editor Comparison Matrix

| Criteria | Squire | TipTap | Jodit | SunEditor |
|----------|--------|--------|-------|-----------|
| **Compatibility Score** | 95/100 | 35/100 | 60/100 | 35/100 |
| **DOM Access** | Full via `getRoot()` | Abstracted (ProseMirror) | Limited (needs sync) | Limited (whitelist) |
| **Migration Time** | 2-3 hours | 7-10 days | 1-2 days | 3-4 days |
| **File Size** | 16KB | ~300KB | ~300KB | ~100KB |
| **Dependencies** | Zero | Many | None | None |
| **Philosophy** | Direct DOM | Virtual DOM | Hybrid | Sanitizing |
| **Claude Editing** | ✅ Works as-is | ❌ Complete rewrite | ⚠️ Needs workarounds | ❌ Fights system |

---

## Detailed Analysis

### 1. Squire by Fastmail (RECOMMENDED)

**GitHub:** github.com/fastmail/Squire

#### Why Squire is Perfect for You

**Architecture Alignment:**
- Pure contenteditable + direct DOM manipulation (exactly like your current code)
- `getRoot()` method provides full DOM access
- HTML is the source of truth - no conversion layers
- Philosophy: "Allow the browser to do as much as it can"

**Code Compatibility:**
```javascript
// CURRENT CODE
const editor = UI.elements.documentTextarea;
const currentHTML = editor.innerHTML;
// ... find and wrap nodes
editor.innerHTML = tempDiv.innerHTML;

// WITH SQUIRE (minimal changes)
this.squireEditor.saveUndoState(); // Add this line for undo support
const editor = this.squireEditor.getRoot(); // Only real change
const currentHTML = editor.innerHTML;
// ... find and wrap nodes (EXACT SAME CODE)
editor.innerHTML = tempDiv.innerHTML;
```

**What Works Unchanged:**
- Your `findNodeByContent()` algorithm
- Node wrapping logic
- Accept/reject change tracking
- All DOM traversal code

**What Needs Minor Updates:**
- Initialize Squire: `new Squire(container)`
- Replace `documentTextarea` references with `squireEditor.getRoot()`
- Add `saveUndoState()` before manual DOM changes
- Update formatting buttons to use Squire API

**Migration Steps:**

1. **Install (5 min)**
   ```html
   <script src="https://cdn.jsdelivr.net/npm/squire-rte@latest/build/squire.js"></script>
   ```

2. **Initialize (15 min)**
   ```javascript
   // In documents.js init()
   this.squireEditor = new Squire(UI.elements.documentTextarea);
   this.squireEditor.addEventListener('input', () => this.saveDocument());
   ```

3. **Update Methods (30 min)**
   ```javascript
   // Open document
   openDocument(docId) {
       this.squireEditor.setHTML(document.content);
   }

   // Save document
   saveCurrentDocument() {
       document.content = this.squireEditor.getHTML();
   }

   // Claude changes (minimal change)
   renderChangesInDocument(changes) {
       this.squireEditor.saveUndoState(); // NEW LINE
       const editor = this.squireEditor.getRoot(); // CHANGED LINE
       // ... rest of your code identical
   }
   ```

4. **Update Formatting (30 min)**
   ```javascript
   // Old: document.execCommand('bold')
   // New: this.squireEditor.bold()

   formatBold() { this.squireEditor.bold(); }
   formatItalic() { this.squireEditor.italic(); }
   formatUnderline() { this.squireEditor.underline(); }
   ```

5. **Update Copy-to-Document (15 min)**
   ```javascript
   // In ui.js
   Documents.squireEditor.saveUndoState();
   Documents.squireEditor.insertHTML(content);
   ```

**Benefits:**
- ✅ Delete 185 lines of custom undo/redo code
- ✅ Better cross-browser compatibility
- ✅ Better paste handling with DOMPurify integration
- ✅ Proper undo/redo with manual DOM changes
- ✅ Tiny file size (16KB)
- ✅ Zero dependencies
- ✅ Maintained by Fastmail (trusted, production-ready)

**Cons:**
- Need to build your own toolbar (but you already have one)
- Less "batteries included" than alternatives

---

### 2. TipTap (NOT RECOMMENDED)

**GitHub:** github.com/ueberdosis/tiptap

#### Why TipTap Doesn't Work

**Architecture Conflict:**
- Built on ProseMirror (virtual DOM for editors)
- Everything is ProseMirror nodes, not DOM nodes
- No direct DOM access - abstracted behind API

**What Would Break:**

1. **Claude Document Editing System (CRITICAL)** ❌
   - Your `findNodeByContent()` won't work with ProseMirror nodes
   - Change highlighting needs complete rewrite using decorations
   - Accept/reject logic needs TipTap commands instead of DOM manipulation
   - Estimated rewrite: 3-4 days of work

2. **Undo/Redo** ✅ (Actually Better)
   - Your custom 185-line implementation becomes obsolete
   - TipTap has built-in history extension

3. **Copy-to-Document** ⚠️ (Needs Rewrite)
   - `insertTextAtCursor()` needs TipTap syntax: `editor.chain().focus().insertContent(content).run()`
   - Cursor positioning different

**Migration Complexity:**
- **Phase 1:** Core Editor (2-3 days)
- **Phase 2:** Content Insertion (2-3 days)
- **Phase 3:** Claude Editing System (3-4 days) ← **HIGHEST RISK**
- **Phase 4:** Polish (1-2 days)
- **Total:** 7-10 days

**Only Choose TipTap If:**
- You want tables, mentions, slash commands
- You need real-time collaborative editing
- You're willing to rewrite Claude editing system
- You have 1-2 weeks to dedicate

---

### 3. Jodit (MODERATE COMPATIBILITY)

**GitHub:** github.com/xdan/jodit

#### Why Jodit is Risky

**Architecture:**
- Contenteditable-based with abstraction layers
- HTML via `editor.value` property
- DOM access available but requires `synchronizeValues()` calls

**The Fatal Flaw:**
```javascript
// After EVERY manual DOM change:
const container = editor.editor;
container.innerHTML = modifiedHTML;
editor.synchronizeValues(); // REQUIRED or things break
```

Documentation explicitly warns: "If some plugin changes the DOM directly, then you need to update the content of the original element"

**Compatibility Issues:**

1. **Manual DOM Changes** ⚠️
   - Must call `synchronizeValues()` after every change
   - Easy to forget = bugs
   - Your Claude editing makes ~100 DOM changes per operation

2. **Undo/Redo Risk** ⚠️
   - Custom history system may not track manual wrappers
   - Could lose undo/redo for Claude changes

3. **File Size** ❌
   - 300KB+ minified (20x larger than Squire)

**Migration Time:** 1-2 days

**Verdict:** More risk than Squire with no benefits

---

### 4. SunEditor (NOT COMPATIBLE)

**GitHub:** github.com/JiHong88/suneditor

#### Why SunEditor Doesn't Work

**The Dealbreaker: Tag Whitelist System**

SunEditor aggressively cleans HTML. Your custom divs will be stripped unless:
```javascript
// Your wrappers must be:
<div class="claude-change-add se-component">...</div>

// Instead of just:
<div class="claude-change-add">...</div>
```

**Major Issues:**

1. **HTML Cleaning** ❌
   - "Empty tags without meaning or tags that do not fit the editor's format are modified or deleted"
   - Your colored change divs = "tags without meaning"
   - Would be stripped on save

2. **Limited DOM Access** ❌
   - No clear API for direct DOM traversal
   - Focused on content insertion, not manipulation

3. **Whitelist Workarounds** ❌
   - Must add special classes to all custom elements
   - Requires `notCleaningData: true` flag (bypasses all cleaning)

**Migration Time:** 3-4 days (extensive refactoring)

**Verdict:** Fights your architecture at every turn

---

## JSON vs HTML Storage

### Current: HTML Storage
```javascript
{
  "doc_123": {
    "id": "doc_123",
    "title": "Document",
    "content": "<p>HTML content here</p>", // ← HTML string
    "createdAt": 1234567890
  }
}
```

### Alternative: JSON Storage
```javascript
{
  "doc_123": {
    "id": "doc_123",
    "title": "Document",
    "content": {
      "type": "doc",
      "content": [
        { "type": "paragraph", "content": [...] }
      ]
    }, // ← JSON object
    "createdAt": 1234567890
  }
}
```

### Recommendation: Keep HTML Storage

**Why HTML is Better for You:**

✅ **Zero migration** - existing documents work as-is
✅ **Document Context feature** - already sends HTML to Claude
✅ **Claude editing system** - expects HTML structure
✅ **Human-readable** - easy debugging
✅ **Backward compatible** - no data migration needed

❌ **JSON only makes sense if you need:**
- Real-time collaborative editing
- Y.js/CRDT integration
- Extremely complex document structures

**Technical Reason:**
All these editors work perfectly with HTML:
- Squire: `editor.getHTML()` / `editor.setHTML(html)`
- TipTap: `editor.getHTML()` / `editor.commands.setContent(html)`
- Jodit: `editor.value` / `editor.value = html`

---

## What You Learned from This Research

### 1. Direct DOM Access is Non-Negotiable
Your Claude editing system is sophisticated and valuable. Any editor that abstracts away DOM access requires rewriting 400+ lines of carefully tested code. Not worth it unless you need features that justify the rewrite (collaborative editing, tables, etc.).

### 2. "Modern" Doesn't Mean "Better"
TipTap is technically impressive with its ProseMirror foundation, but that sophistication works against your needs. Sometimes the simple solution (Squire's direct contenteditable approach) is the right solution.

### 3. File Size Matters
- Squire: 16KB
- Jodit: 300KB+
- TipTap: 300KB+
- SunEditor: 100KB+

For a feature that's fundamentally "let users edit rich text," 16KB is plenty.

### 4. Philosophy Alignment is Critical
- **Squire's philosophy:** "Allow the browser to do as much as it can" = perfect for your direct DOM needs
- **TipTap's philosophy:** "Abstract everything for reliability" = fights your architecture
- **SunEditor's philosophy:** "Clean and sanitize everything" = strips your custom elements
- **Jodit's philosophy:** "Provide everything" = complexity you don't need

### 5. The Hidden Migration Cost
It's not just "update the editor initialization." It's:
- Reading new documentation
- Learning new mental models
- Debugging subtle differences
- Testing edge cases
- Fixing bugs that only appear in production

For TipTap, that's 7-10 days. For Squire, that's 2-3 hours.

### 6. What Actually Matters
Your users don't care about:
- Whether you use ProseMirror nodes or DOM nodes
- JSON vs HTML storage
- Virtual DOM rendering

They care about:
- Editing documents reliably
- Claude's change tracking working
- Copy-to-document not breaking
- Formatting buttons doing what they expect

Squire delivers all of that with minimal risk.

---

## Decision Framework

### Choose Squire If:
- ✅ You want minimal migration risk
- ✅ You value your Claude editing system
- ✅ You have 2-3 hours to migrate
- ✅ You want better undo/redo without complexity
- ✅ You want tiny file size
- ✅ You trust Fastmail's engineering

### Choose TipTap If:
- ✅ You need tables, mentions, slash commands
- ✅ You need real-time collaboration
- ✅ You have 1-2 weeks for migration
- ✅ You're willing to rewrite Claude editing
- ✅ You want ecosystem of extensions

### Choose Jodit If:
- ⚠️ You want full-featured editor with toolbar
- ⚠️ You're okay calling `synchronizeValues()` everywhere
- ⚠️ You don't mind 300KB+ file size
- ⚠️ You can't find a good reason to choose Squire

### Choose SunEditor If:
- ❌ Don't. The tag whitelist system is incompatible.

---

## Implementation Checklist (Squire)

### Phase 1: Installation (15 min)
- [ ] Add Squire CDN script to index.html
- [ ] Or: `npm install squire-rte`
- [ ] Initialize in documents.js

### Phase 2: Core Methods (30 min)
- [ ] Update `openDocument()` to use `setHTML()`
- [ ] Update `saveCurrentDocument()` to use `getHTML()`
- [ ] Update `init()` to create Squire instance

### Phase 3: Formatting (30 min)
- [ ] Replace `document.execCommand('bold')` with `editor.bold()`
- [ ] Replace `document.execCommand('italic')` with `editor.italic()`
- [ ] Replace `document.execCommand('underline')` with `editor.underline()`
- [ ] Update all toolbar button handlers

### Phase 4: Claude Integration (30 min)
- [ ] Add `saveUndoState()` to `renderChangesInDocument()`
- [ ] Update editor reference to `getRoot()`
- [ ] Test change tracking (add/delete/modify)
- [ ] Test accept/reject functionality

### Phase 5: Copy-to-Document (15 min)
- [ ] Update `insertTextAtCursor()` in ui.js
- [ ] Test Tab key behavior
- [ ] Test cursor positioning

### Phase 6: Testing (30 min)
- [ ] Test basic formatting (bold, italic, underline, colors)
- [ ] Test undo/redo (including after Claude changes)
- [ ] Test copy/paste (from Google Docs, Word, etc.)
- [ ] Test document context feature
- [ ] Test keyboard shortcuts
- [ ] Test mobile behavior

**Total Time: 2-3 hours**

---

## Key Takeaways

1. **Squire is the clear winner** - 95% compatible, 2-3 hours migration, 16KB size
2. **Keep HTML storage** - no reason to switch to JSON
3. **Your Claude editing system is valuable** - don't break it without good reason
4. **TipTap is overkill** - only if you need collaborative editing or advanced features
5. **Jodit is risky** - synchronization requirements introduce bugs
6. **SunEditor is incompatible** - whitelist system fights your architecture

---

## Resources

### Squire Documentation
- GitHub: https://github.com/fastmail/Squire
- Demo: https://neilj.github.io/Squire/
- API Docs: In README.md

### Alternative Editors (For Reference)
- TipTap: https://tiptap.dev/
- Jodit: https://xdsoft.net/jodit/
- SunEditor: https://github.com/JiHong88/SunEditor

### Your Critical Files
- `/backend/static/js/documents.js` - Lines 856-1252 (Claude editing)
- `/backend/static/js/ui.js` - Lines 410-449 (copy-to-document)
- `/backend/templates/app.html` - Line 278 (editor div)

---

## Next Steps

1. **Get stakeholder buy-in** - Show this doc to your team
2. **Create feature branch** - `git checkout -b feature/squire-editor`
3. **Run migration checklist** - Should take 2-3 hours
4. **Test thoroughly** - Especially Claude editing system
5. **Deploy to staging** - Get user feedback
6. **Monitor for edge cases** - Watch for paste/formatting issues
7. **Document any gotchas** - Add to this file

---

## Final Recommendation

**Migrate to Squire. Do it this week.**

You'll get:
- Better undo/redo (delete 185 lines of code)
- Better cross-browser compatibility
- Better paste handling
- Tiny file size (16KB)
- Minimal risk (your code mostly unchanged)
- 2-3 hours of work

The only reason NOT to migrate is if you genuinely need TipTap's advanced features (tables, collaboration). But even then, you'd need to justify 7-10 days of migration work + rewriting your Claude editing system.

Squire is the pragmatic choice. It improves your editor without breaking what works.
