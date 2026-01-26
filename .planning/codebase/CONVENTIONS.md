# Coding Conventions

**Analysis Date:** 2026-01-25

## Naming Patterns

**Files:**
- JavaScript modules: `camelCase.js` (e.g., `storage.js`, `systemPrompts.js`, `documents.js`)
- Python files: `snake_case.py` (e.g., `app.py`)
- HTML: `camelCase.html` (e.g., `index.html`, `app.html`)
- CSS: `snake_case.css` (e.g., `main.css`, `sidebar.css`, `buttons.css`)

**Functions:**
- Camel case: `functionName()`, `saveDocument()`, `createNewChat()`
- Event handlers: `on[Event]` pattern (e.g., `handlePaste()`, `bindEvents()`)
- Private functions: Prefixed with underscore (e.g., `_loadingDocument`)
- Generator functions: Use `async *` notation (e.g., `async *streamResponse()`)

**Variables:**
- Camel case: `currentChatId`, `isUser`, `messageInput`, `selectedFiles`
- Boolean flags: `is[State]` or `[state]Enabled` (e.g., `isEditing`, `webSearchEnabled`)
- Constants: All caps (e.g., `maxHistorySize`, `scrollThreshold`)
- Private/internal state: Prefixed with underscore (e.g., `_loadingDocument`)

**Types:**
- Class instances (Squire): `SquireName` pattern (e.g., `squireEditor`)
- Objects: Descriptive names matching purpose (e.g., `config`, `state`, `elements`)
- IDs: Prefixed with item type + timestamp (e.g., `chat_1234567890_abc123`, `doc_1234567890_xyz789`)

## Code Style

**Formatting:**
- No linter configured; project uses ad-hoc conventions
- 4-space indentation (JavaScript and Python)
- Line length: No strict limit observed (varies by file)
- Trailing commas: Used in JavaScript object literals
- Semicolons: Always used in JavaScript

**Linting:**
- Not detected in codebase
- No `.eslintrc` or `.prettierrc` files present
- Relies on manual code review and conventions

## Import Organization

**JavaScript Module Pattern:**
```javascript
/**
 * Description of what the module does
 */
const ModuleName = {
    // State
    property: value,

    // Lifecycle
    init() { },
    bindEvents() { },

    // CRUD methods
    createNew() { },
    delete() { },

    // Rendering
    render() { }
};
```

**Order of imports in HTML:**
1. Core libraries (Squire, Anthropic SDK)
2. Utility modules (storage.js, ui.js, components.js)
3. Feature modules (chat.js, documents.js, systemPrompts.js)
4. Integration modules (api.js, files.js, gdrive.js)
5. Settings/configuration (settings.js, auth.js, tools.js)

**Python imports in app.py:**
```python
# Standard library first
import anthropic
from flask import Flask, render_template, request, jsonify
import json
import os
import logging

# Third-party
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth
import jwt

# Then configuration and setup
load_dotenv()
logging.basicConfig(...)
```

**Path Aliases:**
- JavaScript: No path aliases configured; uses relative paths
- Python: Uses absolute imports from Flask app context

## Error Handling

**JavaScript Patterns:**
```javascript
// Storage operations - Always use try/catch
try {
    return JSON.parse(localStorage.getItem('key') || '{}');
} catch (error) {
    console.warn('Failed to parse from localStorage:', error);
    return {}; // Graceful fallback
}

// API calls - Console logging
catch (error) {
    console.error('Operation failed:', error);
    throw new Error('User-facing message');
}

// DOM operations - Optional chaining
UI.elements.element?.addEventListener('click', () => { });
document.getElementById('id')?.textContent = 'value';
```

**Python Patterns:**
```python
# Route handlers - Always use try/except
@app.route('/endpoint')
def endpoint():
    try:
        # Main logic
        return jsonify({'success': True})
    except jwt.ExpiredSignatureError:
        return None  # Specific error handling
    except jwt.InvalidTokenError:
        return None  # Specific error handling
    except Exception as e:
        logging.error(f'Endpoint error: {e}')
        return jsonify({'error': str(e)}), 500

# API errors - Context-specific messages
if response.status_code == 401:
    error_message = 'Invalid API key. Please check your API key in Settings.'
elif 'authentication' in error_message.lower():
    error_message = 'Invalid API key. Please check your API key in Settings.'
else:
    error_message = str(e)
```

**Error Severity Levels:**
- `console.error()`: Critical errors that affect functionality
- `console.warn()`: Non-critical issues, degraded functionality still works
- `console.info()` / `console.log()`: Informational messages, module initialization, state changes
- No `console.debug()` used in production code

## Logging

**Framework:** Browser `console` API (client-side), Python `logging` module (server-side)

**Patterns:**

**JavaScript Logging:**
```javascript
// Initialization logging
console.log('Module initialized');
console.warn('Module already initialized');
console.error('Failed to initialize Module:', error);

// Feature logging
console.log('Document saved');
console.info('Chat created');
console.warn('Clipboard format not supported');
```

**Python Logging:**
```python
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Usage in routes/functions
logging.info(f"{request.method} {request.path} from {request.remote_addr}")
logging.error(f"Chat endpoint error: {e}")
logging.info("Token refreshed successfully")
```

**Log Locations:**
- Client logs: Browser DevTools console
- Server logs: stdout (configured for serverless environment)

## Comments

**When to Comment:**
- Complex algorithm explanations
- Non-obvious business logic
- Important state transitions
- API integration details
- Workarounds for browser/library quirks

**JSDoc/TSDoc:**
```javascript
/**
 * Description of what the module does
 */
const ModuleName = {
    /**
     * Initialize module and bind events
     */
    init() { },

    /**
     * Create a new [item]
     * @param {Object} config - Configuration object
     * @returns {HTMLElement} Created element
     */
    create(config) { }
};
```

**Comment Style:**
- `//` for single-line comments
- `/** */` for module/function descriptions
- Inline comments explain the "why", not the "what"
- Comments stay up-to-date with code changes

**Example Good Comments:**
```javascript
// Disable Squire's built-in Tab handler so our custom Tab behavior works everywhere
this.squireEditor.setKeyHandler('Tab', null);

// Loading flag prevents premature font detection during document load
this._loadingDocument = true;
```

## Function Design

**Size:**
- Typical range: 20-50 lines
- Large functions (100+ lines): `documents.js` modules, complex streaming logic
- Goal: Each function has single responsibility

**Parameters:**
- Max 3 positional parameters; use object for 4+
- Optional parameters with destructuring:
```javascript
const function = ({ text, isActive = false, onClick, actions = [] }) => {
    // Implementation
};
```
- Default values provided for optional params
- No required params after optional params

**Return Values:**
- Functions return values explicitly; no implicit `undefined` expected
- Void functions: Use early returns for guard clauses
- Promise-based: All `async` functions explicitly marked
- Generator functions: Use `async *` for streaming responses

**Example Function:**
```javascript
// Well-structured function from components.js
createListItem(config) {
    const {
        text,
        isActive = false,
        actions = [],
        onClick,
        onNameEdit,
        className = 'item',
        maxLength = 30
    } = config;

    const item = document.createElement('div');
    item.className = `${className} ${isActive ? 'active' : ''}`;

    // Implementation...

    return item;
}
```

## Module Design

**Exports:**
- Object-based modules (not ES6 exports)
- Single export per file: `const ModuleName = { ... }`
- Entire module available globally after script load

**Barrel Files:**
- No barrel/index files used
- Each module directly included via `<script>` tag in HTML

**Module Structure (Mandatory Pattern):**
```javascript
/**
 * Module description
 */
const ModuleName = {
    // 1. State/Properties
    currentId: null,
    items: {},
    initialized: false,

    // 2. Lifecycle
    init() {
        if (this.initialized) {
            console.warn('Already initialized');
            return;
        }
        this.items = Storage.getItems();
        this.bindEvents();
        this.render();
        this.initialized = true;
    },

    // 3. Event Binding
    bindEvents() {
        // CRITICAL: Always use e.stopPropagation() on action buttons
        UI.elements.actionBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.performAction();
        });
    },

    // 4. CRUD Operations
    createNew() { },
    delete() { },

    // 5. UI/Rendering
    render() { }
};
```

**Cross-Module Communication:**
- Validate at integration points using `typeof` checks:
```javascript
if (typeof Tools !== 'undefined' && Tools.setDocContext) {
    Tools.setDocContext(true);
}
```
- No direct property mutations across modules
- Status-based updates preferred over state-based updates

## Event Handling Patterns

**Event Type Selection:**
- `keypress`: Text input keys (Enter for submit)
- `keydown`: Navigation & modifiers (Tab, Escape, Ctrl+key)
- `keyup`: Key release detection (rare)
- `click`: Button/element interactions
- `input`: Content changes in editors
- `change`: Select/checkbox changes

**Critical Rules:**
- Always use `e.stopPropagation()` on action buttons to prevent parent collapse
- Always `preventDefault()` for Tab key to avoid focus change
- Action buttons require event handlers: delete, use, edit, add buttons

**Example:**
```javascript
// ✅ Correct: Tab key with keydown + preventDefault
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        this.copyLatestClaudeMessageToDocument();
    }
});

// ✅ Correct: Enter key with keypress
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
    }
});

// ✅ Correct: Action button with stopPropagation
deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents section collapse
    this.deleteItem();
});
```

## Storage & Persistence

**localStorage Pattern:**
```javascript
// Keys: Plural item type
Storage.getChats() // Returns {}
Storage.saveChats(chats)
Storage.generateChatId() // Returns: chat_[timestamp]_[random]

// All operations wrapped in try/catch
try {
    return JSON.parse(localStorage.getItem('key') || '{}');
} catch (error) {
    console.warn('Parse error:', error);
    return {};
}
```

**ID Format:** `[prefix]_[timestamp]_[randomString]`
- `chat_1234567890_abc123def456`
- `doc_1234567890_xyz789abc123`
- `prompt_1234567890_def456ghi789`

**Persistence Rules:**
- Save immediately after state changes
- No batch operations; each change saves separately
- Graceful degradation on parse failures

## Defensive Programming

**Null/Undefined Checks:**
```javascript
// Optional chaining (preferred)
element?.addEventListener('click', handler);
document.getElementById('id')?.classList.add('active');

// Explicit checks
if (element) {
    element.textContent = 'value';
}

// Guard clauses
if (!parameter) return;
```

**Type Coercion Awareness:**
```javascript
// Careful with truthy/falsy
const isConnected = localStorage.getItem('connected') === 'true'; // String check
const isEmpty = !object || Object.keys(object).length === 0;
```

**DOM Element Existence:**
All module elements checked before use:
```javascript
// In module bindEvents()
UI.elements.button?.addEventListener('click', handler);

// Alternative guard
if (!UI.elements.button) return;
```

---

*Convention analysis: 2026-01-25*
