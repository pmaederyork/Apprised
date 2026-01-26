# Codebase Structure

**Analysis Date:** 2026-01-25

## Directory Layout

```
Apprised/
├── .claude/                    # Project documentation
│   └── CLAUDE.md              # Development guide (MUST READ before changes)
├── .planning/
│   └── codebase/              # Generated codebase analysis documents
├── backend/
│   ├── app.py                 # Flask backend with routes and API integration
│   ├── requirements.txt        # Python dependencies
│   ├── static/
│   │   ├── assets/            # External assets (Google Drive icon)
│   │   ├── icons/             # App icons and logos
│   │   ├── css/               # Stylesheet modules
│   │   │   ├── variables.css  # CSS custom properties and theming
│   │   │   ├── main.css       # Global layout and base styles
│   │   │   ├── sidebar.css    # Sidebar and section styling
│   │   │   ├── chat.css       # Chat interface and messages
│   │   │   ├── editor.css     # Document editor and toolbar
│   │   │   ├── editor-changes.css  # Claude edit review panel
│   │   │   ├── components.css # Reusable component styles
│   │   │   ├── buttons.css    # Button styles and states
│   │   │   ├── auth.css       # Authentication UI
│   │   │   └── prompt-generator.css  # Prompt generator bar
│   │   ├── js/                # JavaScript modules
│   │   │   ├── app.js         # Main initialization and orchestration
│   │   │   ├── ui.js          # DOM references and UI utilities
│   │   │   ├── storage.js     # localStorage wrapper for persistence
│   │   │   ├── api.js         # HTTP communication and streaming
│   │   │   ├── components.js  # Reusable UI components
│   │   │   ├── chat.js        # Chat management (CRUD, messaging)
│   │   │   ├── systemPrompts.js    # Agent/system prompt management
│   │   │   ├── documents.js   # Document editor with Squire integration
│   │   │   ├── files.js       # File upload, paste handling
│   │   │   ├── tools.js       # Tool toggles (web search, doc context, screenshare)
│   │   │   ├── agents.js      # Multi-agent orchestration
│   │   │   ├── settings.js    # API key and user settings
│   │   │   ├── auth.js        # OAuth and authentication
│   │   │   ├── gdrive.js      # Google Drive integration
│   │   │   ├── screenshare.js # Screen capture and share
│   │   │   ├── claude-changes.js    # Document edit review system
│   │   │   ├── promptGenerator.js   # AI-powered prompt generation
│   │   │   ├── headerFormats.js     # Rich text format helpers
│   │   │   ├── help.js        # Help modal and documentation
│   │   │   ├── agents.js      # Multi-agent support
│   │   │   ├── squire-raw.js  # Squire rich text editor library
│   │   │   └── purify.min.js  # DOMPurify HTML sanitization
│   │   └── landing.js         # Landing page initialization
│   ├── landing.css            # Landing page styles
│   └── templates/
│       ├── app.html           # Main application SPA template
│       ├── landing.html       # Public landing page
│       ├── terms.html         # Terms of service
│       └── privacy.html       # Privacy policy
├── node_modules/              # npm dependencies (DOMPurify, etc.)
├── .env                       # Environment variables (not committed)
├── .env.example               # Environment variables template
├── README.md                  # Project documentation
├── SQUIRE_API.md              # Squire rich text editor API reference
├── vercel.json                # Deployment configuration
└── package.json               # npm package configuration
```

## Directory Purposes

**backend/:**
- Purpose: All server-side and static content code
- Contains: Flask app, routes, templates, static files
- Key files: `app.py` (main backend), `templates/app.html` (SPA root)

**backend/static/css/:**
- Purpose: Modular CSS organized by feature area
- Contains: Global styles, layout, components, pages
- Key files: `main.css` (layout), `sidebar.css` (navigation), `chat.css` (messaging)
- Pattern: Feature-specific files, not minified in dev, combined at build time in production

**backend/static/js/:**
- Purpose: Modular JavaScript organized by feature (modules)
- Contains: Each file is self-contained module (Chat, Documents, etc.)
- Key files: `app.js` (orchestration), `storage.js` (persistence), `api.js` (networking)
- Pattern: Module pattern with init(), state, bindEvents(), render() methods

**backend/templates/:**
- Purpose: HTML templates served by Flask
- Contains: Single-page app template, marketing pages, legal pages
- Key files: `app.html` (main SPA, loads CSS then JavaScript), `landing.html` (public site)

## Key File Locations

**Entry Points:**
- `backend/app.py`: Flask application entry point with all API routes
- `backend/templates/app.html`: SPA HTML root (loads stylesheets and scripts)
- `backend/static/js/app.js`: Frontend initialization and module orchestration

**Configuration:**
- `.env`: Runtime environment variables (API keys, OAuth secrets, deployment URLs)
- `.claude/CLAUDE.md`: Development guide and architectural patterns
- `vercel.json`: Deployment configuration for Vercel/serverless
- `package.json`: npm dependencies for DOMPurify and build tools

**Core Logic:**
- `backend/static/js/storage.js`: All localStorage operations (data persistence)
- `backend/static/js/api.js`: HTTP communication with backend and Anthropic
- `backend/static/js/chat.js`: Message history, chat CRUD, message rendering
- `backend/static/js/documents.js`: Squire editor initialization, formatting, auto-save
- `backend/static/js/systemPrompts.js`: Agent/prompt management and selection

**Testing:**
- No test files (manual testing only currently)
- Uses console logging for debugging

**Authentication:**
- `backend/static/js/auth.js`: OAuth flow and JWT handling
- `backend/app.py` (auth routes): OAuth callback, token validation
- `.env`: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

## Naming Conventions

**Files:**
- `*.js` (camelCase): Module files (chat.js, documents.js, api.js)
- `*.css` (kebab-case): Stylesheet files (main.css, chat.css, editor.css)
- `*.html` (lowercase): Template files (app.html, landing.html)
- `*.py` (snake_case): Python server files (app.py)
- Test files not used

**Directories:**
- `/js/`: All JavaScript modules
- `/css/`: All stylesheets
- `/templates/`: All HTML templates
- `/static/assets/`: External images and assets
- `/static/icons/`: App icons and logos

**JavaScript Identifiers:**
- Module names (PascalCase): `Chat`, `Documents`, `SystemPrompts`, `Storage`, `API`, `UI`
- Function names (camelCase): `createNewChat()`, `saveCurrentDocument()`, `renderChatList()`
- Variable names (camelCase): `currentChatId`, `messageInput`, `isEditing`
- DOM IDs (camelCase): `messageInput`, `chatMessages`, `documentTextarea`, `systemPromptList`
- CSS classes (kebab-case): `.chat-message`, `.sidebar-item`, `.active`, `.collapsed`
- Boolean properties (prefixed with `is` or `has`): `isEditing`, `hasDocuments`, `isSending`

**CSS Identifiers:**
- Classes (kebab-case): `.chat-container`, `.sidebar-section`, `.active`, `.loading`
- Color scheme (CSS variables): `--primary`, `--secondary`, `--accent`, `--text`, `--bg`
- Sizes (CSS variables): `--spacing-unit`, `--font-size-base`, `--border-radius`

## Where to Add New Code

**New Feature:**
- Primary code: `backend/static/js/[featureName].js` (module file)
- Tests: None (manual testing)
- Styles: `backend/static/css/[featureName].css`
- HTML: Add sections to `backend/templates/app.html`
- Integration: Add module init to `backend/static/js/app.js` in initializeModules()

**New Component/Module:**
- Implementation: Create `backend/static/js/[moduleName].js` following module pattern
- Style module: Create `backend/static/css/[moduleName].css`
- HTML structure: Add to `backend/templates/app.html`
- DOM references: Add to `UI.elements` in `backend/static/js/ui.js`
- Entry point: Add init call to `App.initializeModules()` in `backend/static/js/app.js`

**Backend Route/Endpoint:**
- Implementation: Add `@app.route()` method to `backend/app.py`
- Client-side call: Use `API.sendMessage()` pattern or add new fetch in module
- Documentation: Add JSDoc comment explaining endpoint purpose and parameters

**Utilities:**
- Shared helpers: `backend/static/js/components.js` for rendering, `backend/static/js/ui.js` for DOM access
- Storage helpers: Add method to `backend/static/js/storage.js` (getData, saveData, generateId)
- API helpers: Add method to `backend/static/js/api.js` for new endpoint types

**Styling:**
- Global styles: `backend/static/css/main.css` or `variables.css`
- Feature styles: `backend/static/css/[feature].css`
- Component styles: `backend/static/css/components.css` or theme-specific file
- Never use inline styles (except dynamic values via CSS variables)

## Special Directories

**backend/static/icons/:**
- Purpose: Store app branding and UI icons
- Generated: No (manually added)
- Committed: Yes
- Usage: Logo, favicon, navigation icons

**backend/static/assets/:**
- Purpose: Store external images and assets
- Generated: No (manually added)
- Committed: Yes
- Usage: Google Drive icon, service logos

**node_modules/:**
- Purpose: npm dependencies (DOMPurify primarily)
- Generated: Yes (via `npm install`)
- Committed: No (ignored by .gitignore)
- Management: Update via `npm update`, specify versions in package.json

**.planning/codebase/:**
- Purpose: Generated codebase analysis documents
- Generated: Yes (by GSD mapper)
- Committed: No (or optionally for reference)
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

---

## Module Dependency Graph

```
app.js (entry point)
├── Auth.js (optional, if OAuth needed)
├── SystemPrompts.js (initialization first)
├── PromptGenerator.js (depends on SystemPrompts)
├── Documents.js (independent)
├── Chat.js (depends on SystemPrompts, Storage)
├── Tools.js (independent toggles)
├── Files.js (depends on Documents for focus detection, depends on Tools for config)
├── Agents.js (depends on Chat for orchestration)
├── UI.js (no dependencies, provides DOM references)
├── Storage.js (no dependencies, browser API)
├── API.js (depends on Storage for API key, depends on Tools for config)
└── Components.js (no dependencies, pure rendering)
```

## File Size Context

- `backend/app.py`: ~740 lines (routes, OAuth, API integration)
- `backend/static/js/chat.js`: ~400+ lines (message management)
- `backend/static/js/documents.js`: ~1000+ lines (Squire integration, formatting)
- `backend/static/js/app.js`: ~200+ lines (initialization)
- `backend/static/js/ui.js`: ~100+ lines (DOM references)
- `backend/static/js/storage.js`: ~150+ lines (persistence)
- Most modules: 100-300 lines (focused, single responsibility)

---

*Structure analysis: 2026-01-25*
