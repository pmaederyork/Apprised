# Apprised Chat - Development Guide

## Development Rules
- **Read this claude.md file everytime before making any edits
- **Ask followup questions before starting
- **Review code first, make plan for clean and simple implementation, then execute
- **Don't break existing functionality
- **Manual testing required after changes
- **Never make changes until I tell you to!
- **Always use Python3 and Pip3
- **When referencing external tools, review the online documentation with websearch first before implementing.

## Local Documentation
- **SQUIRE_API.md** - Complete Squire Rich Text Editor API reference (use this instead of WebSearch for Squire questions)
- **CLAUDE.md** - This development guide (architecture, patterns, implementation rules)
- **squire_plan.md** - Squire migration plan and feature roadmap
- **text_editors.md** - Text editor comparison and architecture analysis

---

## Full Stack Architecture

### Directory Structure
```
backend/
├── app.py                    # Flask backend with Anthropic API integration
├── templates/
│   └── index.html           # Main SPA template with all HTML structure
└── static/
    ├── js/
    │   ├── app.js           # Main application orchestration & initialization
    │   ├── ui.js            # DOM element references & UI utilities
    │   ├── storage.js       # localStorage wrapper for all data persistence
    │   ├── api.js           # Anthropic API communication & streaming
    │   ├── components.js    # Reusable UI components (createListItem, etc.)
    │   ├── chat.js          # Chat management (CRUD, messaging, UI)
    │   ├── systemPrompts.js # System prompt management & editor
    │   ├── documents.js     # Document management & markdown editor
    │   ├── files.js         # File upload & focus-aware paste handling
    │   ├── tools.js         # Tool toggles (web search, etc.)
    │   └── settings.js      # API key management & settings modal
    ├── css/
    │   ├── main.css         # Global styles & layout
    │   ├── sidebar.css      # Sidebar styling & responsive behavior
    │   ├── chat.css         # Chat interface & message styling
    │   ├── editor.css       # Document editor & markdown toolbar
    │   ├── components.css   # Reusable component styles
    │   └── buttons.css      # Button styles & states
    └── icons/
        └── claude-color.svg # App icon
```

### Module Dependencies & Data Flow
**Initialization Order (app.js):**
1. **SystemPrompts** → Chat dependencies
2. **Documents** → Independent document system
3. **Chat** → Core messaging functionality  
4. **Tools** → Feature toggles
5. **Files** → Upload & paste handling
6. **Settings** → API configuration

**Data Flow:**
- **Storage.js** ↔ **localStorage** (all persistence)
- **API.js** ↔ **Flask backend** ↔ **Anthropic API**
- **UI.js** ← **All modules** (DOM references)
- **Components.js** ← **All modules** (reusable UI)

### Core Architectural Patterns

**1. Module Pattern**
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
    
    bindEvents() { /* Always use e.stopPropagation() on action buttons */ },
    createNew() { /* Generate unique IDs, save immediately */ },
    renderList() { /* Use Components.createListItem() */ }
};
```

**2. Storage Pattern**
- **Keys:** `[itemType]s` (e.g. `chats`, `documents`)
- **IDs:** `[prefix]_[timestamp]_[random]` (e.g. `doc_1234567890_abc123`)
- **All operations wrapped in try/catch**
- **Immediate save after state changes**

**3. Event Handling**
```javascript
// Action buttons - CRITICAL: Always prevent parent events
button.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents unwanted section collapse
    this.performAction();
});

// Collapsible headers
header.addEventListener('click', () => {
    this.toggleCollapse(); // No preventDefault needed
});
```

**4. UI Components**
- **Sidebar items:** Use `Components.createListItem()` for consistency
- **Active states:** `.active` class with orange theme `#ea580c`
- **Collapsible sections:** `.collapsed` class with rotate icons

### Adding New Functionality - Clean Tree Process

**Step 1: Plan & Design**
1. **Identify scope:** Sidebar feature, editor enhancement, or API integration?
2. **Review existing patterns:** Find similar functionality to follow
3. **Plan data structure:** Follow established storage patterns
4. **Design UI integration:** Sidebar section, editor pane, or modal?

**Step 2: Implementation Order (CRITICAL)**
```
1. storage.js     - Add storage methods first
2. [feature].js   - Create module following patterns  
3. ui.js          - Add DOM references
4. index.html     - Add HTML structure
5. [relevant].css - Add styling following patterns
6. app.js         - Add initialization (last)
```

**Step 3: File-by-File Implementation**

**storage.js - Always First:**
```javascript
// Follow exact naming patterns
get[FeatureName]s() { /* try/catch pattern */ },
save[FeatureName]s() { /* immediate persistence */ },
generate[FeatureName]Id() { /* timestamp + random */ }
```

**[feature].js - Core Logic:**
```javascript
const [FeatureName] = {
    // State management
    current[FeatureName]Id: null,
    [featureName]s: {},
    initialized: false,
    
    // Standard lifecycle
    init() { /* Load, bind, render, mark initialized */ },
    bindEvents() { /* e.stopPropagation() on actions */ },
    
    // CRUD operations
    createNew() { /* Generate ID, save, render, open */ },
    open[FeatureName]() { /* Update UI, save state */ },
    delete[FeatureName]() { /* Confirm, cleanup, save */ },
    
    // UI management
    render[FeatureName]List() { /* Use Components.createListItem() */ },
    toggle[FeatureName]Collapse() { /* Standard collapse pattern */ }
};
```

**ui.js - DOM References:**
```javascript
// Add to UI.elements object
[featureName]Header: document.getElementById('[featureName]Header'),
[featureName]Collapse: document.getElementById('[featureName]Collapse'),
[featureName]List: document.getElementById('[featureName]List'),
add[FeatureName]Btn: document.getElementById('add[FeatureName]Btn')
```

**index.html - Structure:**
```html
<!-- Follow exact section pattern -->
<div class="[feature]-section">
    <div class="section-header" id="[feature]Header">
        <span class="collapse-icon" id="[feature]Collapse">▼</span>
        <span class="section-title">[FEATURE NAME]</span>
        <button class="add-[feature]-btn" id="add[Feature]Btn">+</button>
    </div>
    <div class="[feature]-list" id="[feature]List"></div>
</div>

<!-- Add script tag in dependency order -->
<script src="/static/js/[feature].js"></script>
```

**CSS Files - Styling:**
```css
/* sidebar.css - Section styling */
.[feature]-section { /* Follow section pattern */ }
.[feature]-list { /* Follow list pattern */ }
.[feature]-list.collapsed { display: none; }

/* buttons.css - Action buttons */
.add-[feature]-btn { /* Follow button pattern */ }

/* components.css - If new component patterns needed */
```

**app.js - Initialization (Last):**
```javascript
// Add to initializeModules() in dependency order
try {
    [FeatureName].init();
    console.log('[FeatureName] module initialized');
} catch (error) {
    console.error('Failed to initialize [FeatureName]:', error);
}
```

### Integration Points

**Focus-Aware Behavior:**
- **files.js:** Global paste handler with focus detection
- **documents.js:** Smart HTML-to-markdown conversion for document editor
- **chat input:** Standard text paste behavior

**Copy/Paste Integration:**
- **Copy:** Markdown → Rich HTML for external apps (Google Docs)
- **Paste:** HTML → Clean markdown from external apps
- **Focus routing:** `document.activeElement` detection

**API Integration:**
- **Backend endpoints:** Add to app.py following patterns
- **Frontend calls:** Use existing API.js patterns
- **Error handling:** Consistent user feedback

### Maintaining Clean Architecture

**ALWAYS Follow:**
1. **Dependency order:** Storage → Module → UI → HTML → CSS → App
2. **Naming consistency:** Follow established patterns exactly
3. **Event patterns:** `e.stopPropagation()` on all action buttons
4. **Component reuse:** Use `Components.createListItem()` for sidebar items
5. **Error handling:** try/catch all storage operations
6. **State management:** Immediate persistence after changes

**NEVER Do:**
1. **Skip ui.js references:** Always add DOM elements first
2. **Inline styles:** Use CSS files following patterns
3. **Break initialization order:** Dependencies must load first
4. **Forget e.stopPropagation():** Action buttons will break sections
5. **Ignore existing patterns:** Follow established code style

---

## Sidebar Section Implementation

### HTML Structure Pattern
```html
<div class="[section-name]-section">
    <div class="section-header" id="[sectionName]Header">
        <div style="display: flex; align-items: center; gap: 8px;">
            <span class="collapse-icon" id="[sectionName]Collapse">▼</span>
            <span class="section-title" style="margin: 0;">[SECTION NAME]</span>
        </div>
        <button class="[action-btn-class]" id="[actionBtn]" title="[Action description]">+</button>
    </div>
    <div class="[section-name]-list" id="[sectionName]List">
        <!-- Section items will be populated by JavaScript -->
    </div>
</div>
```

### CSS Requirements

**Section Container:**
```css
.[section-name]-section {
    border-bottom: 1px solid #e7e5e4;
    padding-bottom: 16px;
    margin-bottom: 16px;
}
```

**List Container:**
```css
.[section-name]-list {
    display: block;
}

.[section-name]-list.collapsed {
    display: none;
}
```

**Action Button (in buttons.css):**
```css
.[action-btn-class] {
    background: #ea580c;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: background 0.2s ease;
}

.[action-btn-class]:hover {
    background: #dc2626;
}
```

### JavaScript Implementation

**DOM Elements (in ui.js):**
```javascript
[sectionName]Header: document.getElementById('[sectionName]Header'),
[sectionName]Collapse: document.getElementById('[sectionName]Collapse'),
[sectionName]List: document.getElementById('[sectionName]List'),
```

**Event Listeners (in module):**
```javascript
// Action button - CRITICAL: Must include e.stopPropagation()
UI.elements.[actionBtn]?.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents unwanted section collapse
    this.[actionMethod]();
});

// Collapse functionality
UI.elements.[sectionName]Header?.addEventListener('click', () => {
    this.toggle[SectionName]Collapse();
});
```

**Toggle Method:**
```javascript
toggle[SectionName]Collapse() {
    const list = UI.elements.[sectionName]List;
    const icon = UI.elements.[sectionName]Collapse;
    
    if (!list || !icon) return;
    
    if (list.classList.contains('collapsed')) {
        list.classList.remove('collapsed');
        icon.classList.remove('collapsed');
    } else {
        list.classList.add('collapsed');
        icon.classList.add('collapsed');
    }
}
```

### Critical Implementation Notes

**MUST-FOLLOW Rules:**
- **Action Button Events:** ALWAYS use `e.stopPropagation()` to prevent section collapse
- **DOM References:** Add all required elements to ui.js elements object BEFORE using
- **Button Styling:** Add button classes to buttons.css following existing patterns
- **Collapse Icon:** Uses existing CSS (.collapse-icon.collapsed rotates -90deg)

---

## Complete Feature Implementation

### Module Pattern
```javascript
const [FeatureName] = {
    // State management
    current[FeatureName]Id: null,
    [featureName]s: {},
    initialized: false,
    
    // Lifecycle
    init() {
        if (this.initialized) return;
        this.[featureName]s = Storage.get[FeatureName]s();
        this.bindEvents();
        this.render[FeatureName]List();
        this.initialized = true;
    },
    
    // Event binding - ALWAYS use e.stopPropagation() on action buttons
    bindEvents() { /* ... */ },
    
    // CRUD operations
    createNew() { /* ... */ },
    open[FeatureName]([featureName]Id) { /* ... */ },
    delete[FeatureName]([featureName]Id) { /* ... */ },
    
    // UI management - Use Components.createListItem() for consistency
    render[FeatureName]List() { /* ... */ },
    
    // Collapse functionality
    toggle[FeatureName]Collapse() { /* ... */ }
};
```

### Storage Pattern (storage.js)
```javascript
get[FeatureName]s() {
    try {
        return JSON.parse(localStorage.getItem('[featureName]s') || '{}');
    } catch (error) {
        console.warn('Failed to parse [featureName]s from localStorage:', error);
        return {};
    }
},

save[FeatureName]s([featureName]s) {
    localStorage.setItem('[featureName]s', JSON.stringify([featureName]s));
},

generate[FeatureName]Id() {
    return '[prefix]_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
```

### Data Structure Pattern
```javascript
// Standard object structure:
{
  "[prefix]_1234567890_abcdef123": {
    id: "[prefix]_1234567890_abcdef123",
    title: "Feature Name",
    content: "Feature content...", // if applicable
    createdAt: 1234567890,
    lastModified: 1234567890  // if applicable
  }
}
```

### File Checklist for New Features
- [ ] **storage.js** - Add storage methods following patterns
- [ ] **[feature].js** - Create module with standard structure
- [ ] **ui.js** - Add DOM element references
- [ ] **index.html** - Add HTML structure & script tag
- [ ] **sidebar.css** - Add item styling
- [ ] **buttons.css** - Add button styling (critical for action buttons)
- [ ] **app.js** - Add module initialization

---

## CSS/Button Formatting Issues

### Critical Button Problems We've Encountered

**Problem: Action buttons triggering section collapse**
- **Cause:** Missing `e.stopPropagation()` in click handlers
- **Fix:** ALWAYS add `e.stopPropagation()` to all action button events
- **Example:** Add document button, new chat button, delete buttons

**Problem: Button styling inconsistencies**
- **Cause:** Not following established button classes in buttons.css
- **Fix:** Use existing `.add-prompt-btn`, `.new-chat-btn` patterns
- **Rule:** Add all new button styles to buttons.css, not inline

**Problem: DOM element undefined errors**
- **Cause:** Using elements before adding to ui.js
- **Fix:** Add ALL DOM references to ui.js elements object first
- **Pattern:** `[elementName]: document.getElementById('[elementId]')`

### Button Styling Best Practices
```css
/* Follow this pattern for all action buttons */
.your-action-btn {
    background: #ea580c;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: background 0.2s ease;
}

.your-action-btn:hover {
    background: #dc2626;
}

.your-action-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
}
```

---

## Smart Copy/Paste System

### Focus-Aware Routing (files.js)
```javascript
// Global paste handler routes based on focus
if (document.activeElement === documentTextarea) {
    return; // Let documents.js handle smart conversion
}
// Otherwise handle as file upload or chat paste
```

### Document Editor Conversion (documents.js)
- **Copy:** Markdown → Rich HTML for external apps (Google Docs compatibility)
- **Paste:** HTML → Clean markdown (handles Google Docs specific patterns)
- **Key Pattern:** `<span style="font-weight:700;">` → `**bold**`

### Copy/Paste Troubleshooting
1. Check focus detection logic in files.js
2. Verify HTML conversion patterns in documents.js
3. Test clipboard API vs legacy differences
4. Add console logs in paste handlers for debugging
5. Ensure `e.preventDefault()` is used correctly

---

## Squire Rich Text Editor Integration

> **Reference:** See [SQUIRE_API.md](SQUIRE_API.md) for complete API documentation, method signatures, and examples.

### Initialization Pattern (documents.js:24-56)

```javascript
init() {
    const editorContainer = document.getElementById('documentTextarea');
    if (editorContainer && typeof Squire !== 'undefined') {
        this.squireEditor = new Squire(editorContainer);

        // CRITICAL: Disable built-in Tab handlers for custom behavior
        this.squireEditor.setKeyHandler('Tab', null);
        this.squireEditor.setKeyHandler('Shift-Tab', null);

        // Bind format detection events
        this.squireEditor.addEventListener('pathChange', () => {
            this.updateFontSizeDisplay();
            this.updateFontFamilyDisplay();
            this.updateToolbarButtonStates();
        });

        // Bind content change events for auto-save
        this.squireEditor.addEventListener('input', () => {
            this.scheduleAutoSave();
            this.scheduleHistoryCapture();
        });

        // Bind selection change events
        this.squireEditor.addEventListener('select', () => {
            this.updateFontSizeDisplay();
            this.updateFontFamilyDisplay();
        });
    }
}
```

**Key Initialization Steps:**
1. **Check dependencies:** Verify Squire is loaded before initialization
2. **Disable default handlers:** Use `setKeyHandler(key, null)` to disable built-in shortcuts
3. **Bind events early:** Attach all event listeners immediately after creation
4. **Store reference:** Keep `this.squireEditor` reference for module-wide access

> See [SQUIRE_API.md - Event System](SQUIRE_API.md#event-system) for all available events.

### Loading Flag Pattern (CRITICAL)

**Problem:** When loading document content, Squire triggers `pathChange` and `select` events before content is fully rendered, causing premature font detection.

**Solution:** Use a loading flag to skip UI updates during content loading.

```javascript
// documents.js:254-269
openDocument(documentId) {
    // Set loading flag BEFORE setting HTML
    this._loadingDocument = true;

    // Load content into editor
    this.squireEditor.setHTML(document.content || '');

    // Defer UI updates until next tick (after Squire finishes rendering)
    setTimeout(() => {
        this._loadingDocument = false;
        this.squireEditor.moveCursorToStart();
        this.updateFontSizeDisplay();
        this.updateFontFamilyDisplay();
    }, 0);
}

// Skip font detection while loading
updateFontSizeDisplay() {
    if (this._loadingDocument) return;
    // ... font detection logic
}
```

**When to use this pattern:**
- ✅ Loading content with `setHTML()`
- ✅ Switching between documents
- ✅ Any time Squire content changes programmatically
- ❌ Not needed for user-initiated typing or formatting

### Format Detection Patterns

#### Inline Format Detection (hasFormat)
```javascript
// Check if format is applied at cursor/selection
if (this.squireEditor.hasFormat('B')) {
    boldBtn.classList.add('format-active');
} else {
    boldBtn.classList.remove('format-active');
}
```

**Common format tags:**
- `'B'` - Bold
- `'I'` - Italic
- `'U'` - Underline
- `'S'` - Strikethrough
- `'A'` - Link

> See [SQUIRE_API.md - hasFormat()](SQUIRE_API.md#hasformat) for full documentation.

#### Block-Level Format Detection (getPath)
```javascript
// Get CSS-like path from body to cursor
const path = this.squireEditor.getPath();
// Example: "BODY>DIV>P>STRONG" or "BODY>DIV>UL>LI"

// Check for list formatting
if (path.includes('UL')) {
    unorderedListBtn.classList.add('format-active');
} else if (path.includes('OL')) {
    orderedListBtn.classList.add('format-active');
}
```

> See [SQUIRE_API.md - getPath()](SQUIRE_API.md#getpath) for details.

#### Font Property Detection
```javascript
// Method 1: DOM traversal (most accurate for cursor position)
updateFontSizeDisplay() {
    if (this._loadingDocument) return;

    const selection = this.squireEditor.getSelection();
    let node = selection.startContainer;
    let fontSize = null;

    // Traverse up the DOM tree to find font-size
    while (node && node !== this.squireEditor.getRoot()) {
        if (node.style && node.style.fontSize) {
            fontSize = node.style.fontSize;
            break;
        }
        node = node.parentNode;
    }

    // Fallback to getFontInfo()
    if (!fontSize) {
        const fontInfo = this.squireEditor.getFontInfo();
        fontSize = fontInfo?.fontSize;
    }

    // Update UI display
    if (fontSize) {
        this.fontSizeDropdown.textContent = fontSize;
    }
}

// Method 2: getComputedStyle for selections
if (!selection.collapsed) {
    const computedStyle = window.getComputedStyle(node);
    fontSize = computedStyle.fontSize;
}
```

> See [SQUIRE_API.md - getFontInfo()](SQUIRE_API.md#getfontinfo) for available properties.

### Format Toggle Pattern

**Best practice:** Always check current format state before applying/removing.

```javascript
formatBold() {
    if (this.squireEditor.hasFormat('B')) {
        this.squireEditor.removeBold();
    } else {
        this.squireEditor.bold();
    }
    this.scheduleAutoSave();
    this.updateToolbarButtonStates();
}

formatItalic() {
    if (this.squireEditor.hasFormat('I')) {
        this.squireEditor.removeItalic();
    } else {
        this.squireEditor.italic();
    }
    this.scheduleAutoSave();
    this.updateToolbarButtonStates();
}
```

**Pattern applies to:**
- Bold/Italic/Underline/Strikethrough
- Lists (ordered/unordered)
- Alignment (left/center/right/justify)
- Any toggleable formatting

> See [SQUIRE_API.md - Text Formatting](SQUIRE_API.md#text-formatting) for all formatting methods.

### Selection Management

#### Saving and Restoring Selection
```javascript
// Save selection before focus is lost
let savedSelection = null;
dropdown.addEventListener('mousedown', (e) => {
    if (this.squireEditor) {
        savedSelection = this.squireEditor.getSelection();
    }
});

// Restore selection before applying format
dropdown.addEventListener('change', (e) => {
    if (savedSelection) {
        this.squireEditor.setSelection(savedSelection);
    }
    this.setFontSize(e.target.value);
});
```

**When to use this pattern:**
- ✅ Dropdowns (select elements steal focus)
- ✅ Modal dialogs
- ✅ Color pickers
- ✅ Any UI that removes focus from editor
- ❌ Not needed for buttons (blur is instant)

> See [Dropdown Selection Preservation](#dropdown-selection-preservation) section below for detailed implementation.

#### Cursor Positioning
```javascript
// Move cursor to start of document
this.squireEditor.moveCursorToStart();

// Move cursor to end of document
this.squireEditor.moveCursorToEnd();

// Focus editor (required before cursor movement)
this.squireEditor.focus();
```

> See [SQUIRE_API.md - Selection & Cursor Control](SQUIRE_API.md#selection--cursor-control) for full API.

### Block-Level Modifications

#### Read-Only Block Iteration
```javascript
// Iterate over blocks without modifying
this.squireEditor.forEachBlock((block) => {
    console.log('Block:', block.tagName, block.textContent);
}, false); // false = read-only, no undo state saved
```

#### Mutating Block Iteration
```javascript
// Apply line spacing to all selected blocks
setLineSpacing(lineHeight) {
    this.squireEditor.forEachBlock((block) => {
        if (lineHeight) {
            block.style.lineHeight = lineHeight;
        } else {
            block.style.lineHeight = '';
        }
    }, true); // true = mutate blocks AND save undo state

    this.scheduleAutoSave();
}
```

**Critical:** Always pass `true` as second parameter when modifying blocks to enable undo/redo.

> See [SQUIRE_API.md - forEachBlock()](SQUIRE_API.md#foreachblock) for advanced usage.

### Content Management

#### Getting/Setting Content
```javascript
// Get HTML content for saving
const htmlContent = this.squireEditor.getHTML();
Storage.saveDocuments(this.documents);

// Set HTML content when loading
this._loadingDocument = true;
this.squireEditor.setHTML(document.content || '');
setTimeout(() => {
    this._loadingDocument = false;
}, 0);
```

#### Inserting Content at Cursor
```javascript
// Insert HTML (preserves formatting)
this.squireEditor.focus();
this.squireEditor.insertHTML('<strong>Bold text</strong>');

// Insert plain text (escapes HTML)
this.squireEditor.focus();
this.squireEditor.insertPlainText('This <text> will be escaped');
```

**Pattern:** Always call `focus()` before insertion to ensure cursor is in editor.

> See [SQUIRE_API.md - Content Management](SQUIRE_API.md#content-management) for all content methods.

### Triple-Click Selection Fix

**Problem:** Squire's default triple-click selects beyond current paragraph boundaries.

**Solution:** Override with custom selection behavior (documents.js:156-193)

```javascript
// Disable Squire's built-in triple-click handler
editorContainer.addEventListener('click', (e) => {
    if (e.detail === 3) {
        e.preventDefault();
        e.stopPropagation();
        this.handleTripleClick();
    }
}, true); // true = capture phase, before Squire handles it

handleTripleClick() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    let node = selection.anchorNode;

    // Find the paragraph container
    while (node && node !== this.squireEditor.getRoot()) {
        if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.nodeName)) {
            // Select only this paragraph
            const range = document.createRange();
            range.selectNodeContents(node);
            selection.removeAllRanges();
            selection.addRange(range);

            // Sync to Squire's internal selection
            this.squireEditor.setSelection(range);
            break;
        }
        node = node.parentNode;
    }
}
```

**Why this matters:** Prevents accidental selection of multiple paragraphs when user triple-clicks.

### Keyboard Customization

```javascript
// Disable built-in handler
this.squireEditor.setKeyHandler('Tab', null);
this.squireEditor.setKeyHandler('Shift-Tab', null);

// Implement custom Tab behavior elsewhere
editorContainer.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();

        // Custom indentation logic
        if (e.shiftKey) {
            this.squireEditor.decreaseListLevel();
        } else {
            this.squireEditor.increaseListLevel();
        }
    }
});
```

> See [SQUIRE_API.md - Keyboard Customization](SQUIRE_API.md#keyboard-customization) for key format specification.

### Auto-Save and History Management

```javascript
// Debounced auto-save on content changes
this.squireEditor.addEventListener('input', () => {
    this.scheduleAutoSave();
});

scheduleAutoSave() {
    if (this.autoSaveTimeout) {
        clearTimeout(this.autoSaveTimeout);
    }
    this.autoSaveTimeout = setTimeout(() => {
        this.saveCurrentDocument();
    }, 1000); // 1 second debounce
}

// Manual undo/redo buttons
undoBtn.addEventListener('click', () => {
    this.squireEditor.undo();
});

redoBtn.addEventListener('click', () => {
    this.squireEditor.redo();
});
```

**Pattern:** Use debouncing to avoid excessive localStorage writes.

> See [SQUIRE_API.md - History Management](SQUIRE_API.md#history-management) for undo/redo API.

### Common Squire Pitfalls

**❌ Don't:**
1. Call format methods without focus: `this.squireEditor.bold()` (won't work if editor not focused)
2. Forget loading flag: Triggers premature UI updates
3. Check focus on container div: `document.activeElement === container` (wrong)
4. Modify blocks without `forEachBlock(..., true)`: Breaks undo/redo
5. Use `innerHTML` directly: Use `setHTML()` instead for proper Squire integration

**✅ Do:**
1. Focus before formatting: `this.squireEditor.focus(); this.squireEditor.bold();`
2. Use `_loadingDocument` flag when setting content
3. Check focus on Squire root: `document.activeElement === this.squireEditor.getRoot()`
4. Use `forEachBlock(callback, true)` for mutations
5. Use `getHTML()` / `setHTML()` for content access

### Squire Integration Checklist

When adding new Squire-based features:
- [ ] Use loading flag when setting content programmatically
- [ ] Save/restore selection for UI elements that steal focus
- [ ] Call `focus()` before applying formats or inserting content
- [ ] Use `forEachBlock(..., true)` for block mutations
- [ ] Schedule auto-save after content changes
- [ ] Update toolbar button states after format changes
- [ ] Check focus on `getRoot()`, not container element
- [ ] Disable built-in handlers if implementing custom behavior
- [ ] Refer to [SQUIRE_API.md](SQUIRE_API.md) for method signatures

---

## Focus-Aware Event Handling

### Squire Focus Detection Pattern

**Critical:** Check focus on Squire's **root element**, not the container div.

```javascript
// ✅ CORRECT - Check Squire's contenteditable root
const isSquireFocused = Documents.squireEditor &&
    document.activeElement === Documents.squireEditor.getRoot();

// ❌ WRONG - Checking container div doesn't work
const container = document.getElementById('documentTextarea');
const isSquireFocused = document.activeElement === container; // Always false!
```

**Why this matters:** Squire creates a contenteditable div inside your container. The `document.activeElement` is that inner div, accessible via `getRoot()`.

### Textarea Focus Detection

```javascript
const textarea = document.getElementById('systemPromptTextarea');
const isTextareaFocused = textarea && document.activeElement === textarea;
```

### Focus-Aware Paste Handler (files.js:62-76)

```javascript
handlePaste(e) {
    // Check if document editor (Squire) is focused
    const isDocumentEditorFocused = Documents.squireEditor &&
        document.activeElement === Documents.squireEditor.getRoot();

    // Check if system prompt textarea is focused
    const systemPromptTextarea = document.getElementById('systemPromptTextarea');
    const isSystemPromptFocused =
        systemPromptTextarea && document.activeElement === systemPromptTextarea;

    // Let editors handle their own paste behavior
    if (isDocumentEditorFocused || isSystemPromptFocused) {
        return; // Do NOT preventDefault - let editor handle it
    }

    // Handle as file attachment for chat
    e.preventDefault();
    this.handleFileUpload(e);
}
```

**Pattern:** Route paste events based on active focus, allowing each editor to handle its own paste logic.

### Focus-Aware Keyboard Shortcuts

```javascript
// Tab key for copy-to-document (only when chat input focused)
UI.elements.messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        this.copyLatestClaudeMessageToDocument();
    }
});

// Tab key for indentation (only when Squire focused)
editorContainer.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
            this.squireEditor.decreaseListLevel();
        } else {
            this.squireEditor.increaseListLevel();
        }
    }
});
```

**Pattern:** Bind keyboard shortcuts to specific input elements, not globally to `document`.

### Focus Detection Use Cases

**Paste Event Routing:**
- Squire focused → Rich HTML paste handling
- System prompt focused → Plain text paste
- Chat input focused → File attachment handling

**Keyboard Shortcuts:**
- Tab in chat → Copy to document
- Tab in Squire → Indentation
- Tab in system prompt → Default behavior

**Toolbar Updates:**
- Squire focused → Enable formatting buttons
- Other elements focused → Disable formatting buttons

### Testing Focus Detection

```javascript
// Add temporary logging to verify focus detection
console.log('Active element:', document.activeElement);
console.log('Squire root:', Documents.squireEditor?.getRoot());
console.log('Match:', document.activeElement === Documents.squireEditor?.getRoot());
```

**Common issues:**
- ❌ Checking container instead of `getRoot()`
- ❌ Not checking if `squireEditor` exists before accessing `getRoot()`
- ❌ Using `getElementById()` on dynamically created Squire elements

---

## Dropdown Selection Preservation

### The Problem

**Issue:** Dropdowns (`<select>` elements) steal focus when opened, causing text selection to be lost in Squire editor.

**Impact:** When user selects text and tries to apply font size/family from dropdown, selection is gone by the time change event fires.

### The Solution

Save selection on `mousedown` (before dropdown opens), restore on `change` (before applying format).

```javascript
// documents.js:1236-1265
let savedSelection = null;

// Save selection BEFORE dropdown opens
fontSizeSelect.addEventListener('mousedown', (e) => {
    if (this.squireEditor) {
        savedSelection = this.squireEditor.getSelection();
    }
});

// Restore selection BEFORE applying format
fontSizeSelect.addEventListener('change', (e) => {
    if (savedSelection) {
        this.squireEditor.setSelection(savedSelection);
    }

    // Now apply the formatting
    this.setFontSize(e.target.value);

    // Focus editor to show selection
    this.squireEditor.focus();
});
```

### Event Timing Diagram

```
User Action          Event Fired        Selection State
───────────────────────────────────────────────────────
Click dropdown  →    mousedown      →   [saved]
Dropdown opens  →    (focus lost)   →   (selection gone)
Select option   →    change         →   [restored]
Apply format    →    (format API)   →   [applied to selection]
```

### When to Apply This Pattern

**✅ Use for:**
- Font size dropdowns
- Font family dropdowns
- Text color pickers (if using native pickers)
- Background color pickers
- Any `<select>` element that applies formatting

**❌ Not needed for:**
- Buttons (blur is instant, selection persists)
- Keyboard shortcuts (editor maintains focus)
- Toolbar buttons (click doesn't steal focus long enough)

### Complete Implementation Example

```javascript
initFontDropdowns() {
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    const fontFamilySelect = document.getElementById('fontFamilySelect');

    let savedSelection = null;

    // Font size dropdown
    fontSizeSelect.addEventListener('mousedown', (e) => {
        if (this.squireEditor) {
            savedSelection = this.squireEditor.getSelection();
        }
    });

    fontSizeSelect.addEventListener('change', (e) => {
        if (savedSelection) {
            this.squireEditor.setSelection(savedSelection);
        }
        this.setFontSize(e.target.value);
        this.squireEditor.focus();
    });

    // Font family dropdown
    fontFamilySelect.addEventListener('mousedown', (e) => {
        if (this.squireEditor) {
            savedSelection = this.squireEditor.getSelection();
        }
    });

    fontFamilySelect.addEventListener('change', (e) => {
        if (savedSelection) {
            this.squireEditor.setSelection(savedSelection);
        }
        this.setFontFace(e.target.value);
        this.squireEditor.focus();
    });
}
```

### Why Not Use `blur` or `focus` Events?

**`blur` event:** Fires too late (after dropdown opens, selection already lost)
**`focus` event:** Doesn't fire when dropdown closes
**`mousedown` event:** ✅ Fires before focus changes, perfect for saving selection

### Troubleshooting Selection Loss

**If selection is still lost:**
1. Verify `mousedown` handler is bound before `change` handler
2. Check that `savedSelection` is not being overwritten
3. Ensure `setSelection()` is called before format method
4. Confirm `focus()` is called after format application

**Debugging code:**
```javascript
fontSizeSelect.addEventListener('mousedown', (e) => {
    if (this.squireEditor) {
        savedSelection = this.squireEditor.getSelection();
        console.log('Saved selection:', savedSelection, savedSelection.toString());
    }
});

fontSizeSelect.addEventListener('change', (e) => {
    console.log('Restoring selection:', savedSelection);
    if (savedSelection) {
        this.squireEditor.setSelection(savedSelection);
        console.log('Selection restored, applying format...');
    }
    this.setFontSize(e.target.value);
});
```

---

## Cross-Module Integration Patterns

### Optional Chaining Pattern

**Problem:** Modules initialize in sequence, but some features need cross-module communication.

**Solution:** Use `typeof` checks and optional chaining to safely call methods in other modules.

```javascript
// documents.js - Call Tools module if it exists
openDocument(documentId) {
    // ... document opening logic

    // Enable Doc Context if Tools module is available
    if (typeof Tools !== 'undefined' && Tools.setDocContext) {
        Tools.setDocContext(true);
    }

    // Refresh UI if UI module is available
    if (typeof UI !== 'undefined' && UI.refreshCopyToDocumentButtons) {
        UI.refreshCopyToDocumentButtons();
    }
}
```

**Pattern Benefits:**
- ✅ No tight coupling between modules
- ✅ Modules work independently if others fail to initialize
- ✅ No runtime errors if module is missing
- ✅ Clear intent in code (optional integration)

### Integration Point Validation

**Principle:** Validate feature availability at the integration point, not at the UI level.

**Example:** Doc Context indicator validation (files.js:292-328)

```javascript
// ❌ BAD - Checking toggle state (UI level)
updateDocContextIndicator() {
    const checkbox = document.getElementById('docContextCheckbox');
    indicator.textContent = checkbox.checked ? '📄' : '';
}

// ✅ GOOD - Checking actual file addition (integration level)
async prepareFilesForAPI() {
    const filesData = [];
    let docContextAdded = false;

    // Try to add document context
    if (typeof Tools !== 'undefined') {
        const docContextFile = Tools.getCurrentDocumentAsFile();
        if (docContextFile) {
            filesData.push(docContextFile);
            docContextAdded = true; // TRUE validation
        }
    }

    // Add user-selected files
    for (const fileData of this.selectedFiles) {
        filesData.push(await this.fileToBase64(fileData.file));
    }

    // Update indicator with REAL status
    if (typeof Tools !== 'undefined') {
        Tools.updateDocContextIndicatorWithStatus(docContextAdded);
    }

    return filesData;
}
```

**Why this matters:** UI toggle can be enabled, but document might not exist. Validating at integration point ensures accurate feedback.

### Status-Based Updates vs State-Based Updates

**State-based (❌ Less reliable):**
```javascript
// Update based on module state
updateIndicator() {
    if (this.isEnabled && Documents.currentDocumentId) {
        showIndicator();
    }
}
```

**Status-based (✅ More reliable):**
```javascript
// Update based on actual operation result
updateIndicatorWithStatus(wasSuccessful) {
    if (wasSuccessful) {
        showIndicator();
    } else {
        hideIndicator();
    }
}
```

### Cross-Module Communication Patterns

#### Pattern 1: Direct Method Calls (Preferred)
```javascript
// Module A calls Module B directly
if (typeof ModuleB !== 'undefined' && ModuleB.doSomething) {
    ModuleB.doSomething(data);
}
```

**Use when:** One-way communication, clear dependency direction

#### Pattern 2: Callback Registration
```javascript
// Module A registers callback with Module B
ModuleB.onSomethingHappens = (data) => {
    ModuleA.handleEvent(data);
};
```

**Use when:** Module B needs to notify Module A of events

#### Pattern 3: Shared State via Storage
```javascript
// Module A writes to storage
Storage.saveState({ key: 'value' });

// Module B reads from storage
const state = Storage.getState();
```

**Use when:** Persistent state needed across page refreshes

### Integration Points in Apprised

**Documents ↔ Tools:**
- Opening document → Auto-enable Doc Context
- Closing document → Auto-disable Doc Context

**Tools ↔ Files ↔ Chat:**
- Files validates Doc Context → Updates Tools indicator
- Files prepares file array → Chat sends to API

**Documents ↔ UI ↔ Chat:**
- Document opens → UI refreshes buttons → Chat shows copy-to-document buttons
- Chat receives response → UI adds button → Documents receives content

### Testing Cross-Module Integration

**Manual test checklist:**
- [ ] Enable feature in Module A → Module B responds correctly
- [ ] Disable Module A (comment out init) → Module B still works
- [ ] Enable feature with no document → Indicator shows correct state
- [ ] Create document → Indicator updates automatically
- [ ] Switch documents → Integration updates correctly

**Debugging integration issues:**
```javascript
// Add logging at integration points
if (typeof Tools !== 'undefined') {
    console.log('[Documents] Calling Tools.setDocContext(true)');
    Tools.setDocContext(true);
    console.log('[Documents] Tools.setDocContext() completed');
} else {
    console.warn('[Documents] Tools module not available');
}
```

---

## Keyboard Event Type Selection

### Event Type Decision Matrix

| Event Type | Use For | Fires When | Common Keys |
|-----------|---------|------------|-------------|
| `keypress` | Text input keys | Character is entered | Enter, letters, numbers |
| `keydown` | Navigation & modifiers | Key is physically pressed | Tab, Escape, Arrows, Ctrl, Shift |
| `keyup` | Release detection | Key is released | Any key (less common) |

### Pattern: Enter Key for Submit

```javascript
// ✅ Use 'keypress' for Enter key (text input)
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
    }
});
```

**Why `keypress`:** Enter generates a character (newline), so it's a text input event.

### Pattern: Tab Key for Navigation/Shortcuts

```javascript
// ✅ Use 'keydown' for Tab key (navigation)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault(); // ALWAYS preventDefault for Tab
        this.copyLatestClaudeMessageToDocument();
    }
});
```

**Why `keydown`:** Tab is a navigation key, not text input. Use `keydown` to capture before browser handles it.

### Pattern: Modifier Keys (Ctrl, Shift, Alt)

```javascript
// ✅ Use 'keydown' for modifier combinations
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveDocument();
    }

    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.squireEditor.undo();
    }
});
```

**Why `keydown`:** Modifier keys don't generate characters, so `keypress` won't fire.

### When to preventDefault()

```javascript
// ✅ ALWAYS preventDefault for Tab (prevents focus change)
if (e.key === 'Tab') {
    e.preventDefault();
    // ... custom behavior
}

// ✅ ALWAYS preventDefault for browser shortcuts (Ctrl+S, Ctrl+Z)
if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    // ... custom save
}

// ✅ Conditionally preventDefault for Enter (allow Shift+Enter)
if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    // ... send message
}

// ❌ DON'T preventDefault for regular typing
if (e.key === 'a') {
    // Let user type normally, don't preventDefault
}
```

### Target-Specific Event Handlers

**✅ Preferred: Bind to specific elements**
```javascript
// Chat input gets Tab for copy-to-document
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        this.copyToDocument();
    }
});

// Editor gets Tab for indentation
editorElement.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        this.indent();
    }
});
```

**❌ Avoid: Global document handlers**
```javascript
// BAD - Conflicts with other inputs
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        // Which behavior should this trigger?
    }
});
```

### Event Order and Bubbling

**Event propagation order:**
1. `keydown` fires (can preventDefault to stop others)
2. `keypress` fires (only for character keys)
3. Input value changes (if not prevented)
4. `keyup` fires

**Example: Preventing default submit behavior**
```javascript
// Prevent form submission on Enter in textarea
textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Stops form submission
        e.stopPropagation(); // Stops event bubbling
        this.handleSubmit();
    }
});
```

### Testing Keyboard Events

**Manual test checklist:**
- [ ] Enter submits message (in chat input)
- [ ] Shift+Enter adds newline (in chat input)
- [ ] Tab triggers correct behavior based on focus (chat vs editor)
- [ ] Ctrl+S doesn't trigger browser save dialog
- [ ] Ctrl+Z/Ctrl+Y trigger editor undo/redo
- [ ] Regular typing works normally (no preventDefault on characters)

**Debugging keyboard events:**
```javascript
element.addEventListener('keydown', (e) => {
    console.log('Event:', e.type, 'Key:', e.key, 'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey);
});
```

---

## Testing Considerations

### Manual Testing Checklist

#### Event Handling Tests
- [ ] **Action buttons don't collapse sections** - Click + buttons while sections are expanded
- [ ] **stopPropagation working** - All action buttons (delete, use, add) don't trigger parent clicks
- [ ] **Double-click to rename** - Works on all sidebar items (chats, documents, system prompts)
- [ ] **Hover actions visible** - Action buttons appear on hover in all list items

#### Squire Editor Tests
- [ ] **Toolbar buttons highlight** - Bold/italic/underline buttons show active state when format is applied
- [ ] **Font dropdowns show current font** - Font size/family display updates when cursor moves
- [ ] **Selection preserved in dropdowns** - Select text → choose font size → format applies to selection
- [ ] **Triple-click selects paragraph only** - Doesn't select beyond current paragraph
- [ ] **Undo/redo work** - Ctrl+Z and Ctrl+Y work correctly, buttons work
- [ ] **Tab/Shift+Tab indentation** - Works in lists, doesn't break other functionality
- [ ] **Format toggle states** - Clicking bold when already bold removes bold

#### Focus-Aware Behavior Tests
- [ ] **Paste in Squire** - Pasting HTML converts to formatted text
- [ ] **Paste in system prompt** - Pasting is plain text only
- [ ] **Paste in chat** - Triggers file upload handler or plain text
- [ ] **Tab in chat input** - Copies latest Claude message to document
- [ ] **Tab in Squire** - Indents list item or increases indentation
- [ ] **Focus indicator accuracy** - Log `document.activeElement` to verify

#### Cross-Module Integration Tests
- [ ] **Open document enables Doc Context** - Opening any document auto-enables toggle
- [ ] **Close document disables Doc Context** - Closing document auto-disables toggle
- [ ] **Doc Context indicator accuracy** - Shows 📄 only when document actually added to files
- [ ] **Copy-to-document buttons appear** - Show when document is open
- [ ] **Copy-to-document buttons disappear** - Hide when document is closed
- [ ] **Multiple messages** - Each Claude message gets its own copy button

#### Storage & Persistence Tests
- [ ] **Changes persist immediately** - Rename, delete, create → refresh page → changes remain
- [ ] **Last open document restored** - Refresh page → last document reopens
- [ ] **No localStorage parse errors** - Check browser console for errors
- [ ] **Large documents save** - Test with 10,000+ character documents

#### Keyboard Shortcut Tests
- [ ] **Enter sends message** - In chat input
- [ ] **Shift+Enter adds newline** - In chat input, doesn't send
- [ ] **Tab in correct context** - Routes to correct handler based on focus
- [ ] **Ctrl+Z/Ctrl+Y** - Undo/redo in editor
- [ ] **Ctrl+S doesn't trigger browser save** - If implementing save shortcut

#### Responsive & UI Tests
- [ ] **Sidebar collapse works** - On mobile viewport
- [ ] **Buttons don't overflow** - Test with long document names
- [ ] **Active state styling** - Orange left border and background on active items
- [ ] **Section collapse icons rotate** - ▼ becomes ► when collapsed

### Automated Testing Strategy

**Unit Tests (future consideration):**
```javascript
// Example: Test storage pattern
describe('Storage', () => {
    it('should return empty object on parse failure', () => {
        localStorage.setItem('documents', 'invalid json');
        const result = Storage.getDocuments();
        expect(result).toEqual({});
    });

    it('should generate unique IDs', () => {
        const id1 = Storage.generateDocumentId();
        const id2 = Storage.generateDocumentId();
        expect(id1).not.toEqual(id2);
        expect(id1).toMatch(/^doc_\d+_[a-z0-9]+$/);
    });
});
```

**Integration Tests:**
```javascript
// Example: Test cross-module integration
describe('Documents-Tools Integration', () => {
    it('should enable Doc Context when document opens', () => {
        const spy = jest.spyOn(Tools, 'setDocContext');
        Documents.openDocument('doc_123');
        expect(spy).toHaveBeenCalledWith(true);
    });
});
```

### Common Test Failures & Fixes

**Failure: "Action button collapses section"**
- **Cause:** Missing `e.stopPropagation()`
- **Fix:** Add to click handler in module bindEvents()

**Failure: "Font dropdown doesn't apply to selection"**
- **Cause:** Selection lost when dropdown opens
- **Fix:** Implement selection preservation pattern (see above)

**Failure: "Focus detection returns false"**
- **Cause:** Checking container instead of Squire root
- **Fix:** Use `document.activeElement === this.squireEditor.getRoot()`

**Failure: "Paste event triggers file upload in editor"**
- **Cause:** Focus detection not working correctly
- **Fix:** Check focus on Squire root, return early if editor focused

**Failure: "Toolbar buttons don't update"**
- **Cause:** Loading flag still set or pathChange event not firing
- **Fix:** Ensure `_loadingDocument = false` after `setTimeout`, verify event listeners attached

### Testing After Changes

**After adding new module:**
1. Test initialization (check console for errors)
2. Test CRUD operations (create, rename, delete)
3. Test persistence (refresh page, verify data persists)
4. Test collapse functionality
5. Test action button stopPropagation

**After modifying Squire integration:**
1. Test format detection (bold, italic, lists)
2. Test toolbar button states
3. Test font dropdowns (with text selection)
4. Test cursor positioning
5. Test undo/redo
6. Test triple-click selection

**After cross-module changes:**
1. Test with both modules enabled
2. Test with one module disabled (comment out init)
3. Test feature toggle on/off
4. Test status indicator accuracy
5. Test edge cases (no document, empty document, large document)

---

## Common Issues & Solutions

### Event Conflicts
- **Always use `e.stopPropagation()`** on action buttons
- Check event listener order and focus-aware handler conflicts
- Test section collapse behavior after adding buttons

### Storage Issues
- Wrap all localStorage operations in try/catch
- Generate unique IDs using established patterns
- Save immediately after state changes

### CSS Specificity
- Follow existing class naming (.item, .actions, .active patterns)
- Use existing color variables (#ea580c for active/primary)
- Test responsive behavior and sidebar collapse

### Module Dependencies
- Follow proper initialization order in app.js
- Check for undefined DOM elements in ui.js before use
- Handle module initialization failures gracefully

---

## Implementation Learnings - Doc Context & Copy-to-Document Features

### **Key Architectural Insights**

**1. Cross-Module Integration Patterns**
- **Tools → Files → Chat → Documents:** Successfully chained modules without tight coupling
- **Validation at integration points:** Doc Context checked in `Files.prepareFilesForAPI()` for true validation
- **Status propagation:** Used `Tools.updateDocContextIndicatorWithStatus()` for real validation feedback

**2. Message UI Extension Strategy**
- **Non-breaking additions:** Extended `UI.addMessage()` and `UI.updateStreamingMessage()` without changing core logic
- **Conditional feature injection:** Added `UI.addCopyToDocumentButton()` only when conditions met
- **Streaming message completion:** Used `isComplete` flag to add buttons after streaming finishes

**3. Keyboard Event Handling Best Practices**
- **Multiple event types:** Used `keypress` for Enter (text input) and `keydown` for Tab (navigation key)
- **Event prevention:** Always `preventDefault()` for Tab to avoid unwanted focus changes
- **Target-specific handlers:** Bound Tab handler to `messageInput` for focused behavior

**4. Content Processing Pipeline**
```javascript
// HTML → Markdown conversion for document insertion
content = content
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<h[1-3]>(.*?)<\/h[1-3]>/g, '# $1')
    .replace(/<br>/g, '\n')
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();
```

### **Successful Implementation Patterns**

**1. Reusing Existing Infrastructure**
- **Cursor management:** Leveraged `Documents.insertTextAtCursor()` - no custom cursor tracking needed
- **File attachment system:** Doc Context used existing file preparation pipeline
- **Button styling:** Extended existing `.copy-to-document-btn` patterns from buttons.css

**2. Smart Visibility Logic**
- **Triple condition check:** Tools enabled + Document open + Successful context addition
- **Progressive enhancement:** Buttons appear dynamically as conditions are met
- **No UI clutter:** Hidden by default, only show when actually functional

**3. User Experience Optimizations**
- **Visual feedback:** Button hover effects with `transform: translateX()` for direction indication
- **Keyboard shortcuts:** Tab key for power users + mouse clicks for accessibility
- **Multiple message targeting:** Each Claude response gets its own button for selective copying

### **Development Workflow Success Factors**

**1. Module-First Planning**
```
Tools (toggle) → Files (validation) → UI (buttons) → Chat (keyboard) → Documents (insertion)
```

**2. Incremental Testing Points**
- Toggle state persistence ✓
- Button visibility conditions ✓  
- Content extraction accuracy ✓
- Cursor position handling ✓
- Keyboard shortcut functionality ✓

**3. CSS Conflict Resolution**
- **Fixed duplicate display properties:** Removed conflicting `display: flex` and `display: none`
- **Container-based styling:** Used `.message-actions` wrapper for clean button placement
- **Animation performance:** Used `transform` instead of layout-changing properties

### **Future Feature Extension Guidelines**

**1. For Chat Message Enhancements:**
- Extend `UI.addMessage()` and `UI.updateStreamingMessage()` methods
- Add conditional UI elements via separate methods (e.g., `addCopyToDocumentButton()`)
- Use message completion hooks for streaming-based features

**2. For Cross-Module Features:**
- Validate at the integration point, not at the UI level
- Use status-based updates rather than state-based updates
- Chain modules through method calls, not shared state

**3. For Keyboard Shortcuts:**
- Use `keydown` for navigation keys (Tab, Escape, Arrow keys)
- Use `keypress` for text input keys (Enter, letters, numbers)
- Always prevent default behavior for repurposed keys
- Target specific input elements rather than global document handlers

---

**Examples:** Documents system demonstrates all patterns perfectly.