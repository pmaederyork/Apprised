# Testing Patterns

**Analysis Date:** 2026-01-25

## Test Framework

**Runner:**
- No automated test framework configured
- Manual testing only (browser-based)
- No Jest, Vitest, Pytest, or other test runners detected

**Assertion Library:**
- Not applicable (no test framework)
- Manual verification via browser console and UI inspection

**Run Commands:**
```bash
# No automated test commands available
# Manual testing via:
# 1. Start Flask backend: python app.py
# 2. Open browser to http://localhost:5000
# 3. Test features manually
# 4. Check console for errors: DevTools F12 > Console tab
```

## Test File Organization

**Location:**
- No test files in codebase
- All code is production code

**Naming:**
- Naming convention would follow: `[module].test.js` or `test_[module].py`
- Currently unused in project

**Structure:**
```
# Would follow pattern if tests existed:
tests/
├── unit/
│   ├── storage.test.js
│   ├── chat.test.js
│   └── documents.test.js
├── integration/
│   ├── chat-api.test.js
│   └── document-save.test.js
└── fixtures/
    └── mock-data.js
```

## Test Structure

**Manual Testing Approach:**

The project relies entirely on manual testing following a structured checklist:

**Initialization Tests:**
```javascript
// Verify in browser console during page load:
console.log(Chat.initialized)        // Should be true
console.log(Documents.initialized)   // Should be true
console.log(Storage.getChats())      // Should return object
```

**Module Isolation Tests:**
Comment out module initialization in `app.js`:
```javascript
// Test Chat module without Documents:
try {
    Chat.init();
    console.log('Chat works independently');
} catch (error) {
    console.error('Chat depends on:', error);
}
```

**UI Component Tests:**
Manual verification through UI interactions:
```javascript
// Test sidebar items
// 1. Create new chat
// 2. Verify item appears in list
// 3. Click item to load
// 4. Delete item and verify removal

// Test document editor
// 1. Open document
// 2. Type text and verify auto-save
// 3. Check localStorage for persistence
// 4. Refresh page and verify content restored
```

**Example Manual Test Pattern (documents.js):**
```javascript
// 1. Create document
Documents.createNew();

// 2. Verify state
console.log('Current document:', Documents.currentDocumentId);
console.log('Document saved:', Storage.getDocuments()[Documents.currentDocumentId]);

// 3. Modify content
Documents.squireEditor.insertHTML('<strong>Test</strong>');

// 4. Wait for auto-save
setTimeout(() => {
    const saved = Storage.getDocuments()[Documents.currentDocumentId];
    console.log('Content saved:', saved.content.includes('Test'));
}, 2000);
```

## Mocking

**Framework:**
- No mocking library (localStorage mocking would use Jest/Vitest)
- Manual localStorage manipulation for testing:

```javascript
// Mock localStorage state for testing
localStorage.clear();
localStorage.setItem('chats', JSON.stringify({
    'chat_123': {
        id: 'chat_123',
        title: 'Test Chat',
        messages: [],
        createdAt: Date.now()
    }
}));

// Now test Chat module
Chat.loadChat('chat_123');
console.log('Loaded:', Chat.currentChatId === 'chat_123');
```

**Patterns for Manual Testing:**

**Mock API Responses (Development):**
```javascript
// In browser console, override API before testing:
const originalSendMessage = API.sendMessage;
API.sendMessage = async function(message, history) {
    return Promise.resolve({
        ok: true,
        body: {
            getReader: () => ({
                read: async () => ({ value: null, done: true })
            })
        }
    });
};
```

**Mock DOM Elements (Debugging):**
```javascript
// Verify elements exist before module init
console.log('messageInput exists:', !!UI.elements.messageInput);
console.log('chatMessages exists:', !!UI.elements.chatMessages);
console.log('All required elements:', Object.values(UI.elements).every(el => el !== null));
```

**What to Mock:**
- localStorage (when testing persistence)
- Anthropic API responses (when testing streaming/errors)
- Google Drive API (when testing sync operations)
- File inputs (when testing file upload)

**What NOT to Mock:**
- UI element creation/manipulation (test actual DOM)
- Event listener binding (verify real behavior)
- Cross-module communication (test actual integration)
- Storage serialization (test actual JSON)

## Fixtures and Factories

**Test Data Pattern (Manual):**

```javascript
// Mock chat data for testing Chat module
const mockChat = {
    id: 'chat_test_123',
    title: 'Test Conversation',
    messages: [
        {
            id: 'msg_1',
            isUser: true,
            content: 'Hello Claude',
            files: [],
            createdAt: Date.now()
        },
        {
            id: 'msg_2',
            isUser: false,
            content: 'Hello! How can I help?',
            createdAt: Date.now()
        }
    ],
    agents: [],
    turns: 1,
    createdAt: Date.now()
};

// Mock document data
const mockDocument = {
    id: 'doc_test_123',
    title: 'Test Document',
    content: '<p>Sample content</p>',
    createdAt: Date.now(),
    lastModified: Date.now()
};

// Setup function for manual tests
function setupTestData() {
    localStorage.clear();
    const chats = { [mockChat.id]: mockChat };
    Storage.saveChats(chats);
    const docs = { [mockDocument.id]: mockDocument };
    Storage.saveDocuments(docs);
}

// Cleanup function
function teardownTestData() {
    localStorage.clear();
}
```

**Location:**
- No dedicated fixtures directory
- Test data created ad-hoc in browser console during manual testing

## Coverage

**Requirements:**
- No coverage enforcement
- No coverage tools configured
- Target: Manual testing of all major flows

**View Coverage (Manual):**
```bash
# Browser DevTools approach:
# 1. Open DevTools (F12)
# 2. Navigate to Sources tab
# 3. Check console for errors during feature testing
# 4. Use Coverage tab (if available in Chrome) to identify untested code

# Or monitor localStorage:
# 1. Open DevTools
# 2. Application tab > localStorage
# 3. Verify data persists after operations
# 4. Refresh page and verify data restored
```

**Critical Paths to Test:**
- localStorage persistence (all modules use it)
- Module initialization order (see app.js)
- Cross-module communication (Documents ↔ Chat ↔ Files)
- API error handling (invalid keys, network errors)
- DOM rendering (sidebar items, message display)

## Test Types

**Unit Tests (Not Implemented):**

If implementing, would follow this pattern:
```javascript
describe('Storage Module', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    test('should generate unique chat IDs', () => {
        const id1 = Storage.generateChatId();
        const id2 = Storage.generateChatId();
        expect(id1).not.toEqual(id2);
        expect(id1).toMatch(/^chat_\d+_[a-z0-9]+$/);
    });

    test('should handle parse errors gracefully', () => {
        localStorage.setItem('chats', 'invalid json');
        const result = Storage.getChats();
        expect(result).toEqual({});
    });
});
```

**Scope:**
- Individual module functionality
- Storage operations
- Utility functions
- Format conversions

**Integration Tests (Not Implemented):**

Pattern for cross-module testing:
```javascript
describe('Documents-Chat Integration', () => {
    test('should copy Claude message to document', () => {
        // 1. Setup: Create chat and document
        Chat.createNewChat();
        Documents.createNew();

        // 2. Action: Add message and copy
        const message = 'Test content';
        Chat.currentMessages.push({ isUser: false, content: message });
        Chat.copyLatestClaudeMessageToDocument();

        // 3. Verify: Document contains message
        const docContent = Documents.squireEditor.getHTML();
        expect(docContent).toContain(message);
    });
});
```

**Scope:**
- Module initialization order
- Cross-module method calls
- Storage synchronization
- API request/response flows

**E2E Tests (Not Implemented):**

Pattern for end-to-end testing:
```javascript
describe('Chat Workflow', () => {
    test('should create chat, send message, and verify response', async () => {
        // 1. Setup browser state
        localStorage.clear();

        // 2. User creates chat
        Chat.createNewChat();
        expect(Chat.currentChatId).toBeDefined();

        // 3. User enters message
        UI.elements.messageInput.value = 'Hello Claude';

        // 4. User sends message
        await Chat.sendMessage();

        // 5. Verify message appears in UI
        const messages = document.querySelectorAll('.message');
        expect(messages.length).toBeGreaterThan(0);

        // 6. Verify persistence
        const saved = Storage.getChats()[Chat.currentChatId];
        expect(saved.messages.length).toBeGreaterThan(0);
    });
});
```

**Framework:** Would use Playwright, Cypress, or Puppeteer
**Scope:** Complete user workflows from start to finish

## Common Patterns

**Async Testing (Manual):**

```javascript
// Test async storage operations
async function testAsyncStorage() {
    try {
        // Operation
        const apiResponse = await API.sendMessage('test');

        // Verify
        console.log('Response received:', apiResponse.ok);

        // Process
        for await (const chunk of API.streamResponse(apiResponse)) {
            console.log('Chunk:', chunk);
        }

        // Cleanup
        Chat.clearMessages();
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run test
testAsyncStorage();
```

**Error Testing (Manual):**

```javascript
// Test API error handling
async function testAPIErrors() {
    // Mock invalid API key
    localStorage.setItem('anthropicApiKey', 'invalid-key');

    try {
        await Chat.sendMessage('test');
    } catch (error) {
        console.log('Expected error:', error.message);
        // Verify error message is user-friendly
        expect(error.message).toContain('Invalid API key');
    }

    // Mock network error
    const originalFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error('Network error'));

    try {
        await Chat.sendMessage('test');
    } catch (error) {
        console.log('Network error caught:', error.message);
    }

    // Restore
    window.fetch = originalFetch;
}

testAPIErrors();
```

**DOM Testing (Manual):**

```javascript
// Test sidebar rendering
function testSidebarRendering() {
    // Setup
    Storage.saveChats({
        'chat_1': { id: 'chat_1', title: 'Chat 1', createdAt: Date.now() },
        'chat_2': { id: 'chat_2', title: 'Chat 2', createdAt: Date.now() }
    });

    // Render
    Chat.renderChatList();

    // Verify
    const items = document.querySelectorAll('.chat-item');
    console.log('Items rendered:', items.length === 2);
    console.log('First item text:', items[0].textContent.includes('Chat'));

    // Cleanup
    Chat.clearMessages();
}

testSidebarRendering();
```

## Manual Testing Checklist

### Module Initialization
- [ ] All modules initialize without errors (check console)
- [ ] No "already initialized" warnings
- [ ] All DOM elements exist before module access
- [ ] localStorage contains expected initial data

### Core Functionality
- [ ] Create new chat
- [ ] Load existing chat
- [ ] Delete chat (with confirmation)
- [ ] Rename chat (double-click)
- [ ] Create document
- [ ] Edit document content
- [ ] Save document (auto-save after 1s)
- [ ] Delete document

### Cross-Module Features
- [ ] Open document → Tab key → Copy to message input
- [ ] Tab key in chat → Copies latest Claude message to document
- [ ] System prompt selection → Active state persists
- [ ] File attachment → Shows in message
- [ ] Copy message with files → Files included in clipboard

### Persistence
- [ ] Create chat/document
- [ ] Refresh page (Ctrl+R)
- [ ] Verify data persists
- [ ] localStorage values haven't been lost

### Error Handling
- [ ] Invalid API key → User-friendly error message
- [ ] Missing API key → Prompts for Settings
- [ ] Network error → Error displayed in UI
- [ ] Parse error in localStorage → Graceful fallback

### UI/UX
- [ ] Sidebar collapse/expand works
- [ ] Active item highlighting
- [ ] Message scrolling follows new messages
- [ ] Textarea auto-resize as you type
- [ ] Buttons have correct styling

### Browser Compatibility
- [ ] Test in Chrome (primary)
- [ ] Test in Firefox (secondary)
- [ ] Test in Safari (tertiary)
- [ ] Check console for warnings

---

*Testing analysis: 2026-01-25*

## Testing Recommendations for Implementation

**Phase 1 - Unit Tests (High Priority):**
- Storage module (all persistence logic)
- ID generation functions
- Format conversion utilities (HTML ↔ Markdown)
- API error handling

**Phase 2 - Integration Tests (Medium Priority):**
- Chat-Documents communication
- Chat-Tools integration (Doc Context)
- Files-API pipeline
- Google Drive sync operations

**Phase 3 - E2E Tests (Future):**
- Complete chat workflow
- Document editing and persistence
- Multi-agent interactions
- Cross-browser verification

**Recommended Framework:**
- Unit: Jest (JavaScript familiarity) or Vitest (faster)
- Integration: Jest with additional utilities
- E2E: Playwright (headless browser control)
- Python: pytest for backend route testing
