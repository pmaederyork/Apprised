# Universal Software Development Guide

## Core Development Principles

### Development Rules
- **Read project documentation before making any edits**
- **Ask followup questions before starting implementation**
- **Review code first, make plan for clean and simple implementation, then execute**
- **Don't break existing functionality**
- **Manual testing required after changes**
- **Never make changes until explicitly instructed**
- **When referencing external tools, review documentation first before implementing**

---

## Architecture Best Practices

### Module Pattern
```
const ModuleName = {
    // State management
    currentState: null,
    data: {},
    initialized: false,

    // Lifecycle
    init() {
        if (this.initialized) return;
        this.loadData();
        this.bindEvents();
        this.render();
        this.initialized = true;
    },

    // Event binding
    bindEvents() { /* Event listeners with proper propagation control */ },

    // Core operations
    create() { /* Generate unique IDs, save immediately */ },
    update() { /* Validate, persist changes */ },
    delete() { /* Confirm, cleanup, persist */ },

    // Rendering
    render() { /* Update UI based on state */ }
};
```

### Storage Pattern
- **Keys:** Consistent naming convention (e.g. `[itemType]s`)
- **IDs:** Unique identifiers with timestamps (e.g. `[prefix]_[timestamp]_[random]`)
- **All operations wrapped in try/catch**
- **Immediate persistence after state changes**
- **Graceful degradation on parse failures**

### Event Handling Best Practices
```javascript
// Action buttons - prevent unwanted propagation
button.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents parent event handlers
    this.performAction();
});

// Container events - allow propagation
container.addEventListener('click', () => {
    this.handleContainerClick(); // No preventDefault needed
});
```

---

## Implementation Process - Clean Tree Development

### Step 1: Plan & Design
1. **Identify scope:** What layer does this touch? (data, logic, UI, integration)
2. **Review existing patterns:** Find similar functionality to follow
3. **Plan data structure:** Follow established storage patterns
4. **Design integration points:** How does this connect to existing systems?

### Step 2: Implementation Order (CRITICAL)
```
1. Data Layer       - Add storage/persistence methods first
2. Core Logic       - Implement business logic and state management
3. Integration      - Connect to existing modules
4. UI Layer         - Add user interface elements
5. Styling          - Add CSS following established patterns
6. Initialization   - Wire up in main application (last)
```

### Step 3: File-by-File Implementation

**Data Layer - Always First:**
```javascript
// Follow exact naming patterns
getData() {
    try {
        // Fetch with error handling
    } catch (error) {
        console.warn('Data fetch failed:', error);
        return defaultValue;
    }
},

saveData(data) {
    // Immediate persistence
    // Validation before save
},

generateId() {
    // Unique ID generation
    return 'prefix_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
```

**Core Logic - Business Rules:**
```javascript
const FeatureName = {
    // State management
    currentId: null,
    items: {},
    initialized: false,

    // Standard lifecycle
    init() { /* Load, bind, render, mark initialized */ },
    bindEvents() { /* Proper event propagation */ },

    // CRUD operations
    create() { /* Generate ID, validate, save, notify */ },
    read() { /* Fetch, transform, return */ },
    update() { /* Validate, merge, save, notify */ },
    delete() { /* Confirm, cleanup, save, notify */ }
};
```

---

## Cross-Module Integration Patterns

### Optional Chaining for Loose Coupling

**Problem:** Modules initialize in sequence, but features need cross-module communication.

**Solution:** Use type checks and optional chaining for safe cross-module calls.

```javascript
// Module A safely calls Module B
if (typeof ModuleB !== 'undefined' && ModuleB.doSomething) {
    ModuleB.doSomething(data);
}
```

**Pattern Benefits:**
- ✅ No tight coupling between modules
- ✅ Modules work independently if others fail
- ✅ No runtime errors if module is missing
- ✅ Clear intent in code (optional integration)

### Integration Point Validation

**Principle:** Validate feature availability at the integration point, not at the UI level.

```javascript
// ❌ BAD - Checking UI state
updateIndicator() {
    const toggle = document.getElementById('featureToggle');
    indicator.show = toggle.checked;
}

// ✅ GOOD - Checking actual operation result
async executeFeature() {
    const result = await performOperation();

    // Validate at integration point
    if (result.success) {
        updateIndicator(true);
    } else {
        updateIndicator(false);
        handleFailure(result.error);
    }
}
```

**Why this matters:** UI state can be enabled, but underlying resource might not exist. Integration point validation ensures accurate feedback.

### Status-Based Updates vs State-Based Updates

**State-based (❌ Less reliable):**
```javascript
// Update based on module state
updateFeature() {
    if (this.isEnabled && this.hasData) {
        render();
    }
}
```

**Status-based (✅ More reliable):**
```javascript
// Update based on actual operation result
updateFeatureWithStatus(wasSuccessful, data) {
    if (wasSuccessful) {
        render(data);
    } else {
        showError();
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
ModuleB.onEvent = (data) => {
    ModuleA.handleEvent(data);
};
```
**Use when:** Module B needs to notify Module A of events

#### Pattern 3: Shared State via Persistence
```javascript
// Module A writes to storage
Storage.saveState({ key: 'value' });

// Module B reads from storage
const state = Storage.getState();
```
**Use when:** Persistent state needed across sessions

---

## Event Management

### Event Type Selection Matrix

| Event Type | Use For | Fires When | Common Keys |
|-----------|---------|------------|-------------|
| `keypress` | Text input | Character entered | Enter, letters, numbers |
| `keydown` | Navigation & modifiers | Key pressed | Tab, Escape, Arrows, Ctrl, Shift |
| `keyup` | Release detection | Key released | Any key (less common) |

### Pattern: Enter Key for Submit
```javascript
// ✅ Use 'keypress' for Enter (text input)
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
    }
});
```

### Pattern: Tab/Navigation Keys
```javascript
// ✅ Use 'keydown' for Tab (navigation)
input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault(); // ALWAYS preventDefault for Tab
        this.handleTabNavigation();
    }
});
```

### Pattern: Modifier Key Combinations
```javascript
// ✅ Use 'keydown' for Ctrl/Cmd combinations
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.save();
    }
});
```

### When to preventDefault()

```javascript
// ✅ ALWAYS preventDefault for navigation keys you're repurposing
if (e.key === 'Tab') {
    e.preventDefault();
    // ... custom behavior
}

// ✅ ALWAYS preventDefault for browser shortcuts you're overriding
if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    // ... custom save
}

// ✅ Conditionally preventDefault (allow Shift+Enter for newline)
if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    // ... submit
}

// ❌ DON'T preventDefault for regular typing
if (e.key === 'a') {
    // Let user type normally
}
```

### Target-Specific Event Handlers

**✅ Preferred: Bind to specific elements**
```javascript
// Different behavior per context
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        this.handleChatTab();
    }
});

editorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        this.handleEditorTab();
    }
});
```

**❌ Avoid: Global document handlers**
```javascript
// BAD - Creates conflicts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        // Which context is this?
    }
});
```

---

## Focus-Aware Event Handling

### Focus Detection Pattern

```javascript
// Check which element has focus
const activeElement = document.activeElement;

// Route behavior based on focus
handleGlobalEvent(e) {
    if (activeElement === this.editorElement) {
        this.handleEditorEvent(e);
        return;
    }

    if (activeElement === this.inputElement) {
        this.handleInputEvent(e);
        return;
    }

    // Default behavior
    this.handleDefaultEvent(e);
}
```

### Focus-Aware Paste Handler Example

```javascript
handlePaste(e) {
    const activeElement = document.activeElement;

    // Let specialized editors handle their own paste
    if (activeElement === this.richTextEditor) {
        return; // Do NOT preventDefault
    }

    if (activeElement === this.codeEditor) {
        return; // Do NOT preventDefault
    }

    // Handle as generic paste
    e.preventDefault();
    this.handleGenericPaste(e);
}
```

**Pattern:** Route events based on active focus, allowing specialized handlers per context.

---

## Testing Strategy

### Manual Testing Checklist

#### Core Functionality Tests
- [ ] **Module initialization** - No console errors on load
- [ ] **CRUD operations** - Create, read, update, delete all work
- [ ] **Data persistence** - Changes survive page refresh
- [ ] **Error handling** - Graceful degradation on failures
- [ ] **Edge cases** - Empty data, null values, large datasets

#### Event Handling Tests
- [ ] **Action buttons work** - Click handlers fire correctly
- [ ] **Event propagation correct** - No unwanted parent triggers
- [ ] **Keyboard shortcuts work** - All defined shortcuts function
- [ ] **Focus-aware behavior** - Events route to correct handlers

#### Integration Tests
- [ ] **Module A → Module B** - Cross-module calls work
- [ ] **Module fails gracefully** - Other modules still function if one fails
- [ ] **Status indicators accurate** - UI reflects actual state
- [ ] **Feature toggles work** - Enable/disable functions correctly

#### Performance Tests
- [ ] **Large datasets** - Performance acceptable with real data
- [ ] **Memory leaks** - No unbounded growth over time
- [ ] **Debouncing/throttling** - Rapid events handled efficiently

### Common Test Failures & Fixes

**Failure: "Action button triggers parent event"**
- **Cause:** Missing `e.stopPropagation()`
- **Fix:** Add to click handler

**Failure: "Feature doesn't work after page refresh"**
- **Cause:** Data not persisted or initialization failed
- **Fix:** Check storage operations and init sequence

**Failure: "Module undefined error"**
- **Cause:** Wrong initialization order or missing type check
- **Fix:** Verify dependency order and add typeof checks

**Failure: "Event triggers in wrong context"**
- **Cause:** Global handler instead of targeted handler
- **Fix:** Bind to specific elements, use focus detection

---

## Debugging Integration Issues

### Add Logging at Integration Points

```javascript
if (typeof ModuleB !== 'undefined') {
    console.log('[ModuleA] Calling ModuleB.doSomething()');
    ModuleB.doSomething(data);
    console.log('[ModuleA] ModuleB.doSomething() completed');
} else {
    console.warn('[ModuleA] ModuleB not available');
}
```

### Verify Focus Detection

```javascript
// Add temporary logging
console.log('Active element:', document.activeElement);
console.log('Expected element:', this.targetElement);
console.log('Match:', document.activeElement === this.targetElement);
```

### Trace Event Flow

```javascript
element.addEventListener('keydown', (e) => {
    console.log('Event:', e.type, 'Key:', e.key,
                'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey,
                'Target:', e.target);
});
```

---

## Architecture Maintenance

### ALWAYS Follow:
1. **Dependency order:** Data → Logic → Integration → UI → Initialization
2. **Naming consistency:** Follow established patterns exactly
3. **Event patterns:** Proper use of `preventDefault()` and `stopPropagation()`
4. **Error handling:** try/catch all external operations
5. **State management:** Immediate persistence after changes
6. **Validation:** At integration points, not UI level

### NEVER Do:
1. **Skip initialization checks:** Always verify dependencies loaded
2. **Ignore existing patterns:** Follow established code style
3. **Break initialization order:** Dependencies must load first
4. **Global event handlers:** Bind to specific elements
5. **Silent failures:** Always log errors for debugging

---

## Development Workflow

### Adding New Features

**1. Research Phase:**
- Review similar existing features
- Identify integration points
- Document dependencies
- Plan data structures

**2. Implementation Phase:**
- Data layer first (storage/persistence)
- Core logic second (business rules)
- Integration third (cross-module)
- UI fourth (user interface)
- Styling fifth (visual polish)
- Initialization last (wire-up)

**3. Testing Phase:**
- Unit test each component
- Integration test cross-module
- Manual test user flows
- Edge case testing
- Performance validation

**4. Documentation Phase:**
- Update architecture docs
- Document new patterns
- Add integration notes
- Update testing checklists

---

## Common Issues & Solutions

### Module Dependencies
- Follow proper initialization order
- Use typeof checks before cross-module calls
- Handle missing dependencies gracefully

### Event Conflicts
- Use `e.stopPropagation()` on action buttons
- Check event listener order
- Use focus detection for context-specific behavior

### Storage Issues
- Wrap all persistence operations in try/catch
- Generate unique IDs using established patterns
- Save immediately after state changes
- Validate data before persistence

### Integration Issues
- Validate at integration points, not UI level
- Use status-based updates over state-based
- Add logging at integration boundaries
- Test with modules enabled/disabled

---

## Key Architectural Insights

**1. Loose Coupling via Optional Integration**
- Modules should work independently
- Cross-module features use type checks
- No hard dependencies between modules
- Graceful degradation when features unavailable

**2. Validation at Integration Points**
- Don't trust UI state for business logic
- Validate actual operation results
- Propagate status, not state
- Update UI based on real outcomes

**3. Focus-Aware Event Routing**
- Different contexts need different handlers
- Use `document.activeElement` for routing
- Bind shortcuts to specific elements
- Let specialized handlers manage their own events

**4. Progressive Enhancement**
- Core functionality works without optional features
- Features activate when dependencies available
- UI updates reflect actual capabilities
- No features shown that can't be delivered

---

**This guide captures universal patterns applicable to any software project: trading algorithms, game development, web applications, desktop tools, etc. The principles of modular architecture, clean integration, proper event handling, and validation at integration points are domain-agnostic.**
