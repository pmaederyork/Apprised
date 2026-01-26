# Architecture

**Analysis Date:** 2026-01-25

## Pattern Overview

**Overall:** Modular monolithic SPA (Single Page Application) with Python backend

**Key Characteristics:**
- Client-side application state management with localStorage persistence
- Module pattern for JavaScript with clear separation of concerns
- Flask backend acting as middleware for API proxying and authentication
- No frontend framework (vanilla JavaScript with modular architecture)
- Real-time streaming responses from Anthropic API

## Layers

**Presentation Layer (Frontend):**
- Purpose: Render UI and handle user interactions
- Location: `backend/templates/app.html` + `backend/static/` (CSS, JS)
- Contains: HTML structure, CSS styling, DOM manipulation
- Depends on: Storage layer, API layer, Component utilities
- Used by: End users, browser clients

**Module/Business Logic Layer (Frontend):**
- Purpose: Manage application state, orchestration, feature logic
- Location: `backend/static/js/*.js` (Chat, Documents, SystemPrompts, Tools, Agents, etc.)
- Contains: State management, CRUD operations, event handling, complex workflows
- Depends on: Storage layer, API layer, UI utilities, Components
- Used by: App orchestration, inter-module communication

**Data Persistence Layer (Frontend):**
- Purpose: Persist client-side data to localStorage
- Location: `backend/static/js/storage.js`
- Contains: All localStorage read/write operations with error handling
- Depends on: None (browser API)
- Used by: All modules for state persistence

**API/Communication Layer (Frontend):**
- Purpose: Handle HTTP communication and streaming
- Location: `backend/static/js/api.js`
- Contains: Message sending, streaming response handling, request formatting
- Depends on: Storage (for API key), Tools configuration
- Used by: Chat module for sending messages

**UI Utilities Layer (Frontend):**
- Purpose: Provide shared DOM references and UI helpers
- Location: `backend/static/js/ui.js`
- Contains: Centralized DOM element references, common UI operations, scroll management
- Depends on: None (DOM API)
- Used by: All modules for DOM manipulation

**Component/Rendering Layer (Frontend):**
- Purpose: Render reusable UI elements
- Location: `backend/static/js/components.js`
- Contains: List item generation, formatting helpers
- Depends on: None
- Used by: Chat, Documents, SystemPrompts for sidebar items

**Backend Layer (Python):**
- Purpose: Authentication, API proxying, request validation
- Location: `backend/app.py`
- Contains: Flask routes, OAuth handling, Anthropic API interaction
- Depends on: Anthropic SDK, Flask, Authlib
- Used by: Frontend for chat, authentication, Google Drive integration

## Data Flow

**Chat Message Flow:**

1. User enters message in `UI.elements.messageInput`
2. Chat.sendMessage() called on Enter/Tab
3. Files.prepareFilesForAPI() collects attachments with focus-aware routing
4. API.sendMessage() sends HTTP POST to `/chat` endpoint
5. Backend Flask app.py receives request, validates API key
6. Flask creates Anthropic client with user's API key (stored client-side in localStorage)
7. Backend streams response via HTTP chunked transfer encoding
8. API.streamResponse() iterates over chunks as generator
9. Chat.handleStreamedChunk() processes each chunk in real-time
10. UI.addMessage() or UI.updateStreamingMessage() updates display
11. Current message saved to localStorage via Chat.saveCurrentChat()

**Document State Flow:**

1. User edits document in Squire editor
2. Documents.squireEditor fires 'input' event
3. scheduleAutoSave() debounces saves (1000ms)
4. saveCurrentDocument() writes to Storage.documents
5. Storage.saveDocuments() persists to localStorage
6. On page refresh, Documents.restoreLastOpenDocument() loads from Storage

**System Prompt Flow:**

1. User creates/edits system prompt in textarea
2. SystemPrompts.debouncedSaveContent() auto-saves (1000ms)
3. Storage.saveSystemPrompts() persists to localStorage
4. Active prompt set via Storage.saveActiveSystemPromptId()
5. Chat uses active prompt when sending messages to API

**Multi-Agent Flow:**

1. User adds additional agents to current chat via Agents.showAddAgentModal()
2. Agent stored in chat object: chats[chatId].agents[]
3. When message sent, Chat.getCurrentAgent() or Agents.getFullAgentsList() builds agent list
4. Backend receives agents config with message
5. Orchestration determined by agent turn count and order

**State Management:**

- **Synchronous persistence:** All state changes immediately save to localStorage via Storage module
- **Debounced auto-save:** Content editors (Squire, system prompt textarea) debounce saves for performance
- **Focus-aware routing:** Files.handlePaste() checks document.activeElement to route paste events correctly
- **Cross-module state:** Chat stores agents list; Tools stores feature toggles; Documents stores content
- **No state conflicts:** Each module owns its localStorage keys (chats, documents, systemPrompts, toolsState, etc.)

## Key Abstractions

**Module Pattern:**
- Purpose: Encapsulate related functionality with clear public interface
- Examples: `Chat`, `Documents`, `SystemPrompts`, `Tools`, `Agents`, `Files`
- Pattern: Object with state properties, init(), event binding, CRUD methods, render method

**Storage Pattern:**
- Purpose: Abstract localStorage operations with type safety and error handling
- Examples: `Storage.getChats()`, `Storage.saveDocuments()`, `Storage.generateDocumentId()`
- Pattern: Try/catch wrapper, JSON serialization, namespace keys (chats, documents, systemPrompts)

**Event Handling Pattern:**
- Purpose: Manage user interactions and module communication
- Pattern: addEventListener with e.stopPropagation() on action buttons to prevent unwanted section collapse
- Usage: All sidebar interactions, message input, toolbar buttons

**Component Rendering Pattern:**
- Purpose: Generate consistent sidebar list items across modules
- Pattern: Components.createListItem() called by Chat.renderChatList(), Documents.renderDocumentList(), SystemPrompts.render()
- Attributes: Item text, active state (orange highlight), delete action, click to select action

**Squire Editor Integration:**
- Purpose: Rich text editing with format detection and toolbar synchronization
- Pattern: Initialize on Documents.init(), bind pathChange/select/input events, save on input debounce
- Loading flag: _loadingDocument prevents premature toolbar updates during content load

## Entry Points

**Frontend Entry Point:**
- Location: `backend/templates/app.html`
- Triggers: Browser load, OAuth callback
- Responsibilities: Load all CSS, load Auth module first, then load Squire, then load app.js
- Flow: Auth checks cookie → App.init() → initializeModules() → load all feature modules

**API Entry Point:**
- Location: `backend/app.py` routes
- `/chat` (POST) - Message submission with files/tools
- `/auth/login` - Google OAuth initiation
- `/auth/callback` - OAuth token exchange
- `/drive/save`, `/drive/import` - Google Drive integration
- `/health` - Healthcheck for deployment

**Module Initialization Order:**
1. Auth (if needed)
2. SystemPrompts (needed by Chat for prompt selection)
3. PromptGenerator (depends on SystemPrompts)
4. Documents (independent rich text editor)
5. Chat (core messaging, needs SystemPrompts ready)
6. Tools (feature toggles)
7. Files (upload/paste handling, cross-module)
8. Agents (multi-agent chat, depends on Chat)
9. UI helpers and event binding
10. Sidebar resize and scroll detection

## Error Handling

**Strategy:** Try/catch at module level with user feedback via UI.showError()

**Patterns:**
- Storage operations: Wrap JSON.parse in try/catch, return empty object on failure
- API calls: Catch network errors, 401 (invalid API key), other HTTP errors
- Module initialization: Catch and log errors individually, don't block other modules
- Message processing: Graceful degradation for malformed responses

## Cross-Cutting Concerns

**Logging:**
- Frontend: console.log() for init and major events, console.warn() for recoverable issues
- Backend: Python logging to stdout (serverless compatible) with request/response logging

**Validation:**
- Frontend: API key required, message not empty, files accepted types
- Backend: Content-Security-Policy headers, CORS validation, JWT token verification

**Authentication:**
- Google OAuth via Authlib (backend), JWT token in httpOnly cookie
- API key stored in localStorage (client-side, not persisted to backend)
- User data extracted from JWT token for display purposes

**Focus Management:**
- Document activeElement checked to route paste events (Squire vs system prompt vs chat)
- Squire focus checked via Documents.squireEditor.getRoot() comparison
- Tab key disabled in Squire by default, custom handlers for indentation

---

*Architecture analysis: 2026-01-25*
