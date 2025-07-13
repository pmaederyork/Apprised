# Plaud Chat - Development Guide

## Development Rules
- **Read this claude.md file everytime before making any edits
- **Ask followup questions before starting
- **Review code first, make plan for clean and simple implementation, then execute
- **Don't break existing functionality
- **Manual testing required after changes
- **Never make changes until I tell you to!
- **Always use Python3 and Pip3
- **When referencing external tools, review the online documentation with websearch first before implementing.  
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