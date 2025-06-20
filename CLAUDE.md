# Plaud Chat - RULES
## For all edits with Claude Code:
Ask followup questions.
Review the code first, then make a plan, then implement. Don’t break or change anything else.
I will test manually


## How to Add New Collapsible Sidebar Sections

Based on SYSTEM PROMPT and CONVERSATIONS sections implementation:

### 1. HTML Structure Pattern
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

### 2. CSS Requirements

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

### 3. JavaScript Implementation

**DOM Elements (in ui.js):**
```javascript
[sectionName]Header: document.getElementById('[sectionName]Header'),
[sectionName]Collapse: document.getElementById('[sectionName]Collapse'),
[sectionName]List: document.getElementById('[sectionName]List'),
```

**Event Listeners (in appropriate module):**
```javascript
// Action button - MUST include e.stopPropagation()
UI.elements.[actionBtn]?.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent collapsing the section
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

### 4. Key Implementation Notes

- **Action Button Event:** ALWAYS use `e.stopPropagation()` to prevent section collapse
- **Collapse Icon:** Uses existing CSS (.collapse-icon.collapsed rotates -90deg)
- **Section Borders:** Bottom border except for last section (use border-top for sections after others)
- **Button Styling:** Use existing button classes from buttons.css for consistency
- **DOM References:** Add all required elements to ui.js elements object

### 5. Examples
- **SYSTEM PROMPT:** Full implementation in systemPrompts.js
- **CONVERSATIONS:** Full implementation in chat.js
- **DOCUMENTS:** Full implementation in documents.js

---

## How to Add Complete Features (UI + Backend + Storage)

Based on the Documents system implementation:

### Implementation Steps for New Features

**1. Storage Layer (storage.js)**
```javascript
// Add to Storage object:
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

**2. Data Structure Pattern**
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

**3. Module Creation ([featureName].js)**
```javascript
const [FeatureName] = {
    // State management
    current[FeatureName]Id: null,
    [featureName]s: {},
    
    // Lifecycle
    init() {
        if (this.initialized) return;
        this.[featureName]s = Storage.get[FeatureName]s();
        this.bindEvents();
        this.render[FeatureName]List();
        this.initialized = true;
    },
    
    // Event binding with e.stopPropagation() for action buttons
    bindEvents() { ... },
    
    // CRUD operations
    createNew() { ... },
    open[FeatureName]([featureName]Id) { ... },
    delete[FeatureName]([featureName]Id) { ... },
    
    // UI management
    render[FeatureName]List() { 
        // Use Components.createListItem() for consistency
    },
    updateActive[FeatureName]InSidebar([featureName]Id) { ... },
    
    // Collapse functionality
    toggle[FeatureName]Collapse() { ... }
};
```

**4. CSS Implementation**
- **Sidebar Items:** Follow `.chat-item` / `.document-item` patterns
- **Editor Panes:** Follow `.system-prompt-editor` / `.document-editor` patterns  
- **Action Buttons:** Add to existing button classes in buttons.css
- **Active States:** Use `.active` class with orange background (#ea580c)

**5. HTML Integration**
- **Sidebar Section:** Follow collapsible section pattern
- **Editor Pane:** Add alongside existing editors if needed
- **Script Tag:** Add module script to index.html in correct order

**6. DOM References (ui.js)**
```javascript
// Add all required elements:
[featureName]Header: document.getElementById('[featureName]Header'),
[featureName]Collapse: document.getElementById('[featureName]Collapse'),
[featureName]List: document.getElementById('[featureName]List'),
add[FeatureName]Btn: document.getElementById('add[FeatureName]Btn'),
// ... any editor elements if applicable
```

**7. App Integration (app.js)**
```javascript
// Add to initializeModules():
try {
    [FeatureName].init();
    console.log('[FeatureName] module initialized');
} catch (error) {
    console.error('Failed to initialize [FeatureName]:', error);
}
```

### Critical Success Patterns

**✅ Always Follow These Rules:**
1. **Use `Components.createListItem()`** for all sidebar items (ensures consistency)
2. **Add `e.stopPropagation()`** to all action button click handlers
3. **Follow existing CSS class naming** (.item, .actions, .active patterns)
4. **Use existing Storage patterns** (try/catch, localStorage keys)
5. **Initialize modules in app.js** with proper error handling
6. **Add DOM elements to ui.js** before using them
7. **Include script tags** in correct dependency order
8. **Test collapsible sections** with proper icon rotation
9. **Implement active states** for selected items
10. **Use debounced auto-save** for text inputs (500ms timeout pattern)

### File Checklist for New Features
- [ ] storage.js - Add storage methods
- [ ] [featureName].js - Create module following patterns
- [ ] ui.js - Add DOM element references  
- [ ] sidebar.css - Add item styling
- [ ] buttons.css - Add button styling
- [ ] editor.css - Add editor pane styling (if applicable)
- [ ] index.html - Add HTML structure and script tag
- [ ] app.js - Add module initialization

**Examples:** Documents system demonstrates all these patterns perfectly.

---

## Adding Undo/Redo to Text Editors

Based on the Documents editor undo/redo implementation:

### Implementation Strategy

**Smart State Capture:**
- **Immediate capture**: Before formatting operations (bold, italic, headers, etc.)
- **Debounced capture**: After typing changes (1 second delay to avoid every keystroke)
- **Duplicate prevention**: Don't capture if content hasn't actually changed
- **Memory management**: Limit to 50 operations per document with automatic cleanup

**Data Structure:**
```javascript
// Per document history management:
{
  undoStacks: {}, // Per document undo stacks  
  redoStacks: {}, // Per document redo stacks
  maxHistorySize: 50,
  inputTimeout: null
}

// Each state entry:
{
  content: "document text",
  selectionStart: 0,
  selectionEnd: 0, 
  timestamp: Date.now()
}
```

### Key Implementation Patterns

**1. Non-Breaking Extension:**
- **Override existing methods**: Extend `wrapSelectedText`, `insertTextAtCursor`, `insertAtLineStart` instead of replacing
- **Preserve all functionality**: Add history capture without changing existing behavior
- **Maintain auto-save**: Undo/redo operations trigger existing `scheduleAutoSave()`

**2. Smart Integration Points:**
- **Format operations**: Capture state before each formatting operation
- **Input events**: Debounced capture from textarea input events (1 second delay)
- **Clear redo stack**: When new changes are made, clear redo history
- **Button state management**: Enable/disable undo/redo buttons based on stack availability

**3. Cursor Preservation:**
- **Store selection**: Save `selectionStart` and `selectionEnd` with each state
- **Restore selection**: Use `setSelectionRange()` to restore exact cursor position
- **Focus management**: Maintain focus on textarea after operations

**4. UI Integration:**
```html
<!-- Add to toolbar with visual separator -->
<button class="markdown-btn" id="undoBtn" title="Undo (Ctrl+Z)">↶</button>
<button class="markdown-btn" id="redoBtn" title="Redo (Ctrl+Y)">↷</button>
<!-- Separator styling -->
#boldBtn { margin-left: 8px; border-left: 1px solid #d6d3d1; }
```

**5. Keyboard Shortcuts:**
```javascript
// In existing keyboard handler, add:
case 'z':
    e.preventDefault();
    if (e.shiftKey) {
        this.redo(); // Ctrl+Shift+Z
    } else {
        this.undo(); // Ctrl+Z  
    }
    break;
case 'y':
    e.preventDefault();
    this.redo(); // Ctrl+Y
    break;
```

### Critical Success Factors

**✅ Essential Patterns:**
1. **Per-document history**: Each document maintains separate undo/redo stacks
2. **Debounced input capture**: Avoid capturing every keystroke, use 1 second delay
3. **State before operations**: Always capture state before formatting operations
4. **Clear redo on new changes**: New edits should clear the redo stack
5. **Preserve cursor position**: Store and restore selection with content
6. **Button state updates**: Disable buttons when stacks are empty
7. **Memory limits**: Prevent unlimited history growth
8. **Integration with auto-save**: Undo/redo should trigger existing save mechanisms

### File Modifications Required
- [ ] **HTML**: Add undo/redo buttons to toolbar
- [ ] **buttons.css**: Add disabled states and separator styling  
- [ ] **ui.js**: Add DOM references for undo/redo buttons
- [ ] **[module].js**: Add history state, capture methods, undo/redo operations
- [ ] **[module].js**: Override text manipulation methods to capture history
- [ ] **[module].js**: Add keyboard shortcuts to existing handler

This approach provides professional-grade undo/redo without breaking existing functionality.