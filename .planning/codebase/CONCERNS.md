# Codebase Concerns

**Analysis Date:** 2026-01-25

## Tech Debt

**Large Monolithic Module Files:**
- Issue: Core modules exceed 2000 lines, mixing CRUD operations with UI rendering and business logic
- Files: `backend/static/js/documents.js` (2286 lines), `backend/static/js/chat.js` (891 lines), `backend/static/js/gdrive.js` (541 lines)
- Impact: Difficult to test, debug, and maintain; high cognitive load; increased risk of side effects when modifying features
- Fix approach: Split modules by concern (storage, UI, business logic) and extract reusable utility functions into separate files

**API Key Storage in Plain Text localStorage:**
- Issue: Anthropic API keys stored unencrypted in browser localStorage, accessible via DevTools and XSS attacks
- Files: `backend/static/js/storage.js` (lines 135-145), `backend/static/js/auth.js` (line 114)
- Impact: CRITICAL SECURITY - Compromised API keys directly expose user costs and data to attackers
- Fix approach: Implement server-side session storage for API keys; client sends request to proxy endpoint instead of direct API calls; use httpOnly cookies for sensitive data
- Current mitigation: CSP headers restrict script sources, but client-side key storage is fundamentally insecure

**Missing Error Handling on Storage Operations:**
- Issue: `saveChats()`, `saveDocuments()`, `saveSystemPrompts()` don't handle localStorage quota or error cases
- Files: `backend/static/js/storage.js` (lines 15-17, 29-31, 69-71)
- Impact: Silent failures when storage quota exceeded; users lose data without notification; no recovery mechanism
- Fix approach: Wrap all setItem calls in try/catch, implement quota detection, provide user feedback for quota errors

**No Input Validation on File Uploads:**
- Issue: File size, type, and count limits not enforced on client side; backend only checks file type
- Files: `backend/static/js/files.js` (lines 36-39, 82-95), `backend/app.py` (lines 233-278)
- Impact: Users can upload massive files causing browser to hang; potential DoS vector; backend accepts arbitrary base64 strings
- Fix approach: Add client-side file validation (size <100MB, type whitelist), add backend file size limit, implement chunked upload for large files

**HTML/JavaScript in Content Handling:**
- Issue: Direct `innerHTML` assignments on user content without consistent sanitization
- Files: `backend/static/js/gdrive.js` (lines 40, 66, 119, 132, 179), `backend/static/js/claude-changes.js` (lines 25, 131, 166)
- Impact: XSS vulnerability if Claude-generated content contains malicious scripts; Squire uses DOMPurify but other paths don't
- Fix approach: Use DOMPurify.sanitize() on all HTML content before innerHTML assignment; use textContent for plain text

**Global Event Listeners Without Cleanup:**
- Issue: Multiple event listeners bound on document without removal, causing memory leaks and duplicate handlers on re-initialization
- Files: `backend/static/js/chat.js` (lines 74-79), `backend/static/js/agents.js` (lines 39-41), `backend/static/js/auth.js` (lines 175-182)
- Impact: Each module reinit adds listeners; Ctrl+C, click handlers executed multiple times; memory grows over time
- Fix approach: Implement `removeEventListener()` on `destroy()` methods; use event delegation instead of global listeners for transient elements

---

## Known Bugs

**Race Condition on Hard Page Refresh:**
- Symptoms: User menu (avatar, name) fails to display on hard refresh; elements undefined when Auth.updateUserMenu() called
- Files: `backend/static/js/app.js` (lines 351-353), `backend/static/js/auth.js` (lines 128-183)
- Trigger: Hard refresh (Cmd+Shift+R) of authenticated page
- Status: Partially mitigated by deferring updateUserMenu() after App.init(), but DOM elements might still not exist if CSS hasn't loaded
- Workaround: Wait for DOM to fully load before accessing UI elements; verify element existence with optional chaining

**Paste Selection Loss in Font Dropdowns:**
- Symptoms: User selects text in Squire, clicks font size dropdown, selection is lost before format applies
- Files: `backend/static/js/documents.js` (lines 1236-1265, documented selection preservation pattern exists)
- Trigger: Select text → Open font dropdown → Format not applied to selection
- Status: Pattern documented in CLAUDE.md but implementation may be incomplete in some dropdowns
- Workaround: Use keyboard shortcuts (Ctrl+B, Ctrl+I) instead of dropdowns for formatting selected text

**Google Drive Token Refresh Cookie Not Updated in All Paths:**
- Symptoms: After Google token refresh, redirect to new JWT stored but subsequent requests may use stale token
- Files: `backend/app.py` (lines 512, 564-574, 637-645, 678-687, 718-728)
- Trigger: Making requests after Google token expiration; refresh succeeds but cookie not synchronized in all code paths
- Status: Some endpoints return new JWT in cookie (drive_save, drive_import) but not all modify response before returning
- Workaround: Ensure every endpoint that calls get_google_token_with_auto_refresh() updates the cookie in response

**Ctrl+Z/Redo History Not Synced Across Document Edits:**
- Symptoms: User types in editor, switches to another editor action, undo history lost or incorrect
- Files: `backend/static/js/documents.js` (lines 14-18, undo/redo implementation)
- Trigger: Rapid editing with tool toggles or copy-to-document actions
- Status: Undo stacks are per-document but shared state modifications (tool toggles) don't capture history
- Workaround: Manual save before tool toggles; avoid switching between editing and tool toggles rapidly

---

## Security Considerations

**Client-Side API Key Exposure (CRITICAL):**
- Risk: Anthropic API keys stored in plain text localStorage; vulnerable to XSS, DevTools inspection, malicious browser extensions
- Files: `backend/static/js/storage.js` (line 144), `backend/static/js/auth.js` (line 114), `backend/static/js/api.js` (line 15)
- Current mitigation: CSP headers restrict unsafe-inline for script-src; httpOnly cookies used for auth tokens; but API key is intentionally client-accessible
- Recommendations: Implement backend proxy for API calls; client requests `POST /api/message` which backend forwards to Anthropic; JWT stored in httpOnly cookie handles auth

**Content Security Policy Allows unsafe-inline:**
- Risk: CSP permits `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'`, reducing XSS protection effectiveness
- Files: `backend/app.py` (lines 71-73)
- Current mitigation: Limited to self + required external domains (google.com, anthropic.com)
- Recommendations: Move all inline styles to CSS files; use nonce-based CSP instead of unsafe-inline; restrict frame-src to only necessary Google domains

**JWT Secret Key Fallback to Development Value:**
- Risk: Default JWT secret in development (`'dev-secret-key-change-in-production'`) may be used if JWT_SECRET_KEY env var not set
- Files: `backend/app.py` (line 32)
- Current mitigation: Comment on line suggests developer should change; HSTS header commented out (line 94) for development
- Recommendations: Raise exception if JWT_SECRET_KEY not set in production; enforce HTTPS-only cookies in production config

**Google Drive OAuth Token Stored in JWT:**
- Risk: Google OAuth refresh token included in JWT payload; if JWT is compromised, attacker can access user's Google Drive indefinitely
- Files: `backend/app.py` (lines 110-111, 189), `backend/static/js/auth.js` (retrieves from localStorage after decode)
- Current mitigation: JWT has 7-day expiration; refresh tokens can be revoked by user
- Recommendations: Store refresh tokens in secure server-side session; never transmit refresh tokens to client; only send access token to client; rotate tokens on use

**File Upload MIME Type Not Validated Server-Side:**
- Risk: Backend trusts client-provided file type; base64 data not verified to match claimed MIME type
- Files: `backend/app.py` (lines 239-277, process_files function)
- Current mitigation: Only specific MIME types accepted; base64 decoding can fail, caught with try/except
- Recommendations: Validate file signatures/magic bytes server-side; reject files that don't match claimed type; implement strict file type whitelist

**HTML Injection via Claude Content:**
- Risk: Claude-generated content passed through `innerHTML` without sanitization in some paths; malicious HTML could execute
- Files: `backend/static/js/gdrive.js` (lines 40, 66, 119, 132, 179), `backend/static/js/claude-changes.js` (lines 131, 166, 178, 192, 204, 219)
- Current mitigation: DOMPurify available and used in Squire for paste; but direct HTML assignment in other modules unguarded
- Recommendations: Use DOMPurify.sanitize() for all HTML content before assignment; prefer textContent over innerHTML for user-controlled data

---

## Performance Bottlenecks

**Large Chat History Processed on Every Message:**
- Problem: Full chat history serialized, stored, and sent to API on every message; only last 10 used for context but all stored
- Files: `backend/static/js/chat.js` (message storage), `backend/static/js/api.js` (line 46: `history.slice(-10)`)
- Current capacity: localStorage ~5-10MB per domain; with large messages (images, PDFs) history fills quickly
- Cause: No pagination or archive system; full chat persisted in localStorage
- Improvement path: Implement message pagination (load only last 50 messages); archive old chats to backend; compress history with gzip before storing

**Document Editor Re-Renders Entire List on Every Change:**
- Problem: `renderDocumentList()` rebuilds entire DOM from scratch; called on every document operation
- Files: `backend/static/js/documents.js` (called in createNew, deleteDocument, renameDocument, etc.)
- Cause: No incremental updates; no virtual scrolling for large document lists
- Improvement path: Implement incremental DOM updates (insert/remove specific items); use virtual scrolling if >100 documents

**Squire Editor Font Detection on Every Cursor Movement:**
- Problem: updateFontSizeDisplay(), updateFontFamilyDisplay() called on every pathChange and select event (multiple times per keystroke)
- Files: `backend/static/js/documents.js` (lines 50-62), called twice per selection change
- Cause: DOM traversal for font detection runs synchronously
- Improvement path: Debounce font detection (100ms); cache font info; only update UI if font actually changed

**localStorage Stringify/Parse on Every Operation:**
- Problem: Full JSON serialization of all chats/documents on every change; no differential updates
- Files: `backend/static/js/storage.js` (every save* method), called frequently during editing
- Current capacity: Stringifying 100+ chat objects with history is slow
- Improvement path: Use IndexedDB instead of localStorage for large datasets; implement lazy serialization

**Global Document Click Listener for Dropdown Close:**
- Problem: Every click triggers multiple dropdown close handlers; document event listener added without debounce
- Files: `backend/static/js/agents.js` (line 39), `backend/static/js/auth.js` (line 175)
- Cause: Multiple modules add global click listeners; no event delegation
- Improvement path: Use single global event delegator; attach data attributes to clickable elements; check target before action

---

## Fragile Areas

**Squire Editor Initialization:**
- Files: `backend/static/js/documents.js` (lines 24-76)
- Why fragile: Depends on Squire library being globally available; no graceful fallback if library missing; event binding happens before editor fully initialized
- Risk: If squire-raw.js fails to load, editor is completely broken with no error message
- Safe modification: Add null checks for `this.squireEditor` before all operations; implement fallback textarea editor; test with network throttling
- Test coverage: No test for missing Squire library scenario

**Module Initialization Order:**
- Files: `backend/static/js/app.js` (lines 61-154)
- Why fragile: Strict dependency chain (SystemPrompts → Chat, Documents → Tools); if one fails, others may fail silently
- Risk: Changing initialization order breaks features (e.g., Documents depends on UI.elements already loaded)
- Safe modification: Add circular dependency check; verify all required modules exist before dependent modules initialize
- Test coverage: No test for module failure scenarios

**Focus Detection in Editors:**
- Files: `backend/static/js/files.js` (lines 71-77)
- Why fragile: Relies on `document.activeElement === Documents.squireEditor.getRoot()`; if Documents not initialized, crashes
- Risk: Optional chaining partially protects but focus detection still fragile (e.g., if Squire in iframe)
- Safe modification: Add explicit null checks; test with external iframes; verify focus detection before use
- Test coverage: No test for focus detection edge cases

**HTML Content Transformation in GDrive Module:**
- Files: `backend/static/js/gdrive.js` (lines 16-200)
- Why fragile: Complex regex patterns and DOM manipulation; edge cases with nested elements, special characters, Unicode
- Risk: Malformed HTML input crashes processor; Unicode mojibake patterns incomplete (only handles specific sequences)
- Safe modification: Add input validation; test with malformed/extreme HTML; use HTML parser library instead of regex
- Test coverage: No unit tests for HTML transformation; only tested manually with Google Docs exports

**Claude Changes Detection:**
- Files: `backend/static/js/claude-changes.js` (lines 75-110)
- Why fragile: Signature matching uses multiple fallback strategies; whitespace-sensitive innerHTML comparison; can create false matches
- Risk: Inserting content at wrong location; modifying wrong element when multiple similar elements exist
- Safe modification: Use stable identifiers (IDs, data attributes) instead of content matching; add warnings for ambiguous matches
- Test coverage: No test for edge cases (duplicate elements, similar content)

**Google Drive API Token Refresh:**
- Files: `backend/app.py` (lines 144-205)
- Why fragile: Token refresh happens inline during request; if refresh fails, returns None and operation fails silently
- Risk: No retry logic; user sees generic error; could implement exponential backoff for rate limits
- Safe modification: Add retry logic with exponential backoff; log detailed errors; return specific error codes for different failure modes
- Test coverage: No test for token refresh scenarios

---

## Scaling Limits

**localStorage Size Limit (5-10MB):**
- Current capacity: ~100 chats with 100 messages each at ~50KB total
- Limit: Browser will throw QuotaExceededError when approaching 10MB; happens silently with current error handling
- Scaling path: Migrate to IndexedDB (450MB+); implement message archiving; implement compression; server-side chat history

**GPU Memory Usage from Large Documents:**
- Current capacity: Squire editor handles documents up to ~100,000 characters without noticeable slowdown
- Limit: At >500,000 characters, editor becomes sluggish due to DOM size; Undo/redo stack causes memory bloat
- Scaling path: Implement lazy rendering (contenteditable virtualization); limit undo stack to 20 instead of 50; export large documents as separate files

**Chat Message Array Growth:**
- Current capacity: ~1000 messages in single chat before localStorage serialization becomes slow
- Limit: Each message with files (base64 images/PDFs) can be 5MB+; array grows unbounded
- Scaling path: Implement pagination; archive old chats; split chats when >500 messages; use differential sync

**Concurrent Users on Backend:**
- Current capacity: Flask development server handles ~10 concurrent users; no connection pooling for API calls
- Limit: Anthropic API rate limits (depends on account tier); no request queuing
- Scaling path: Use production WSGI server (Gunicorn); implement request queuing; add rate limiting; cache API responses

---

## Dependencies at Risk

**Squire Rich Text Editor (squire-raw.js - 4463 lines):**
- Risk: Monolithic library bundled directly; no npm package management; custom patches may conflict with future updates
- Impact: Bug fixes or security issues in Squire can't be updated without manual merge
- Migration plan: Switch to ProseMirror (more modular) or TipTap (maintained, built on ProseMirror); gradual migration via dual-editor approach

**Authlib for OAuth (old patterns):**
- Risk: Uses deprecated session storage approach; newer versions prefer different patterns
- Impact: May break with future Flask versions; sessionfilesystem not suitable for serverless
- Migration plan: Consider using flask-jwt-extended for simpler JWT handling; or migrate to middleware-based auth

**DOMPurify Library (minified, not in package.json):**
- Risk: Manually included; no version tracking or update mechanism
- Impact: Security fixes in DOMPurify don't get applied automatically
- Migration plan: Add to package.json; use npm version management; set up automatic security updates with Dependabot

---

## Missing Critical Features

**No Offline Support:**
- Problem: Application entirely dependent on API connectivity; no local-first or sync-later capability
- Blocks: Editing documents without internet; composing messages while offline
- Workaround: Ensure stable internet; no graceful degradation

**No Message/Document Search:**
- Problem: Users cannot search within chats or documents; must scroll manually
- Blocks: Finding previous conversations; referencing past content
- Workaround: Use browser Ctrl+F on current view only

**No Data Export:**
- Problem: No way to export chats, documents, or history in standard formats
- Blocks: Data portability; compliance with user data requests; backup/migration
- Workaround: Manual copy-paste; documents can be saved to Google Drive only

**No Undo/Redo for Chat Messages:**
- Problem: If user sends message by accident, cannot unsend or modify
- Blocks: Error recovery; message editing workflows
- Workaround: Create new message with correction; mark old message as retracted

**No Real-Time Collaboration:**
- Problem: Documents cannot be edited by multiple users simultaneously
- Blocks: Team workflows; live editing sessions
- Workaround: Use Google Drive offline, sync separately

---

## Test Coverage Gaps

**No Unit Tests for Storage Module:**
- What's not tested: JSON parse failures, quota exceeded errors, concurrent write collisions
- Files: `backend/static/js/storage.js` (entire module)
- Risk: Storage corruption silent failure; no way to detect quota exceeded until data lost
- Priority: HIGH - storage is critical path for all data persistence

**No Tests for API Error Scenarios:**
- What's not tested: Invalid API key handling, rate limiting, network timeouts, streaming parse failures
- Files: `backend/static/js/api.js` (lines 54-62, 71-93)
- Risk: Users see cryptic error messages; streaming response incomplete with no recovery
- Priority: HIGH - API failures impact core functionality

**No Tests for Module Initialization:**
- What's not tested: Missing DOM elements, circular dependencies, module load failures, initialization order issues
- Files: `backend/static/js/app.js` (lines 61-154)
- Risk: Silent failures during init; broken modules don't throw errors; app appears loaded but features broken
- Priority: HIGH - initialization affects all users on page load

**No Tests for Focus Detection:**
- What's not tested: Squire focus with external iframes, nested editors, rapid focus changes, focus loss during async operations
- Files: `backend/static/js/files.js` (lines 71-77)
- Risk: Paste event routing breaks unpredictably; users' content ends up in wrong editor
- Priority: MEDIUM - edge case but data corruption risk

**No Tests for Google Drive Integration:**
- What's not tested: Token refresh failures, OAuth callback errors, malformed Drive responses, quota exceeded on Drive
- Files: `backend/static/js/gdrive.js`, `backend/app.py` (/drive/* routes)
- Risk: Users cannot save to Drive without clear error message; token refresh fails silently
- Priority: MEDIUM - feature not critical but breaking data flow

**No Tests for HTML Sanitization:**
- What's not tested: XSS injection vectors, malicious HTML from Claude content, nested script tags, event handlers in attributes
- Files: `backend/static/js/gdrive.js`, `backend/static/js/claude-changes.js`
- Risk: XSS vulnerability if Claude output contains malicious code
- Priority: CRITICAL - security issue

**No Tests for Large Document Handling:**
- What's not tested: Behavior with documents >100KB, storage quota exceeded, undo stack overflow, rendering performance
- Files: `backend/static/js/documents.js`
- Risk: Large documents cause browser crash; unclear error messages; data loss on quota exceeded
- Priority: MEDIUM - affects power users

---

*Concerns audit: 2026-01-25*
