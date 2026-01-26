# Apprised Chat - Development Guide

## Development Rules
- Read this file before making edits
- Ask followup questions before starting
- Review code first, plan clean implementation, then execute
- Don't break existing functionality
- Manual testing required after changes
- Never make changes until told to
- Always use Python3 and Pip3
- Review online documentation before implementing external tools

## Local Documentation
- **SQUIRE_API.md** - Squire Rich Text Editor API reference
- **squire_plan.md** - Squire migration plan

---

## Architecture

### Directory Structure
```
backend/
├── app.py                    # Flask backend with Anthropic API
├── templates/app.html        # Main SPA template
└── static/
    ├── js/
    │   ├── app.js            # Main orchestration & initialization
    │   ├── ui.js             # DOM element references
    │   ├── storage.js        # localStorage wrapper
    │   ├── api.js            # Anthropic API communication
    │   ├── components.js     # Reusable UI components
    │   ├── chat.js           # Chat management
    │   ├── systemPrompts.js  # System prompt management
    │   ├── documents.js      # Document editor (Squire)
    │   ├── claude-changes.js # Claude edit suggestions system
    │   ├── element-ids.js    # Stable element ID utilities
    │   ├── files.js          # File upload & paste handling
    │   ├── tools.js          # Tool toggles
    │   └── settings.js       # API key management
    └── css/
        ├── main.css          # Global styles
        ├── sidebar.css       # Sidebar styling
        ├── chat.css          # Chat interface
        ├── editor.css        # Document editor
        ├── editor-changes.css # Claude Changes styling
        ├── components.css    # Component styles
        └── buttons.css       # Button styles
```

### Initialization Order (app.js)
1. SystemPrompts → 2. Documents → 3. Chat → 4. Tools → 5. Files → 6. Settings

### Data Flow
- **Storage.js** ↔ localStorage (all persistence)
- **API.js** ↔ Flask ↔ Anthropic API
- **UI.js** ← All modules (DOM references)
- **Components.js** ← All modules (reusable UI)

---

## Core Patterns

### Module Pattern
```javascript
const ModuleName = {
    currentId: null,
    items: {},
    initialized: false,

    init() {
        if (this.initialized) return;
        this.items = Storage.getItems();
        this.bindEvents();
        this.renderList();
        this.initialized = true;
    },

    bindEvents() { /* Always use e.stopPropagation() on action buttons */ }
};
```

### Storage Pattern
- Keys: `[itemType]s` (e.g., `chats`, `documents`)
- IDs: `[prefix]_[timestamp]_[random]`
- All operations wrapped in try/catch
- Immediate save after state changes

### Event Handling
```javascript
// Action buttons - CRITICAL: Always prevent parent events
button.addEventListener('click', (e) => {
    e.stopPropagation();
    this.performAction();
});
```

### Cross-Module Calls
```javascript
if (typeof OtherModule !== 'undefined' && OtherModule.method) {
    OtherModule.method(data);
}
```

---

## Adding New Features

### Implementation Order
1. storage.js - Add storage methods
2. [feature].js - Create module
3. ui.js - Add DOM references
4. app.html - Add HTML structure
5. [relevant].css - Add styling
6. app.js - Add initialization

### Checklist
- [ ] Storage methods with try/catch
- [ ] Module with init(), bindEvents()
- [ ] DOM refs in ui.js BEFORE using
- [ ] e.stopPropagation() on action buttons
- [ ] Use Components.createListItem() for sidebar items
- [ ] Button styles in buttons.css

---

## Squire Editor

> See SQUIRE_API.md for complete API reference

### Key Patterns

**Loading Flag** - Skip UI updates during content loading:
```javascript
this._loadingDocument = true;
this.squireEditor.setHTML(content);
setTimeout(() => { this._loadingDocument = false; }, 0);
```

**Focus Detection** - Check root element, not container:
```javascript
const isFocused = document.activeElement === this.squireEditor.getRoot();
```

**Selection Preservation** - For dropdowns that steal focus:
```javascript
dropdown.addEventListener('mousedown', () => {
    savedSelection = this.squireEditor.getSelection();
});
dropdown.addEventListener('change', () => {
    this.squireEditor.setSelection(savedSelection);
    applyFormat();
});
```

**Block Mutations** - Always pass true for undo support:
```javascript
this.squireEditor.forEachBlock((block) => { /* modify */ }, true);
```

### Pitfalls
- Call `focus()` before formatting methods
- Use `getHTML()`/`setHTML()`, not `innerHTML`
- Check `_loadingDocument` flag in event handlers

---

## Claude Changes System

### Key Files
- **claude-changes.js** - Change resolution, batch operations, PatternMatcher
- **element-ids.js** - Stable data-edit-id assignment
- **documents.js** - Edit rendering, accept/reject UI

### Change Resolution Priority
1. targetId (data-edit-id) - Most reliable
2. Signature matching
3. Content matching - Fallback
4. Anchor-based - Last resort

### Pattern Matching
```javascript
PatternMatcher.patterns = {
    'empty-paragraphs': { selector: 'p', match: (n) => n.textContent.trim() === '' },
    'empty-lines': { selector: 'p, div', match: (n) => n.textContent.trim() === '' }
};
```

### Batch Operations
- Uses DocumentFragment for single DOM reflow
- `batchApplyChanges()` for Accept All
- `cleanupChangeOverlays()` on undo/redo

---

## Keyboard Events

| Event | Use For | Example |
|-------|---------|---------|
| `keydown` | Navigation, modifiers | Tab, Ctrl+S, arrows |
| `keypress` | Text input | Enter for submit |

Always `preventDefault()` for Tab and browser shortcuts.

---

## Common Issues

### Action buttons collapse sections
**Fix:** Add `e.stopPropagation()` to click handler

### Selection lost in dropdowns
**Fix:** Save selection on mousedown, restore on change

### Focus detection fails
**Fix:** Check `squireEditor.getRoot()`, not container element

### Paste triggers wrong handler
**Fix:** Check focus before handling, return early if editor focused

---

## Testing Checklist

- [ ] Action buttons don't collapse sections
- [ ] Font dropdowns preserve selection
- [ ] Undo/redo work correctly
- [ ] Changes persist after refresh
- [ ] Cross-module features work independently
