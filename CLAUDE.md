# Plaud Chat - Development Guide

## Development Rules
- **Ask followup questions before starting**
- **Review code first, make plan, then implement**
- **Don't break existing functionality**
- **Manual testing required after changes**

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

**Examples:** Documents system demonstrates all patterns perfectly.