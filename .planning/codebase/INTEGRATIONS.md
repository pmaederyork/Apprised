# External Integrations

**Analysis Date:** 2025-01-25

## APIs & External Services

**AI/LLM:**
- Anthropic Claude API - Core chat and response generation
  - SDK/Client: `anthropic` package (0.42.0)
  - Endpoint: `https://api.anthropic.com`
  - Model: `claude-sonnet-4-5-20250929`
  - Features: PDFs, images, 1M token context (beta)
  - Auth: API key via `X-API-Key` header (from client localStorage)
  - Implementation: `backend/app.py:372-495` (/chat endpoint), `backend/static/js/api.js` (client-side)

**Authentication & Identity:**
- Google OAuth 2.0 / OpenID Connect
  - Provider: Google Accounts (`accounts.google.com`)
  - Scopes: `openid email profile https://www.googleapis.com/auth/drive`
  - Client: Authlib (authlib==1.3.2)
  - Configuration: `backend/app.py:42-52`
  - Routes: `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/status`
  - Token management: JWT with embedded Google OAuth token
  - Token refresh: Auto-refresh on Google token expiration (5-minute grace period)
  - Implementation: `backend/app.py:99-206` (JWT and token refresh logic)

**Cloud Storage & Collaboration:**
- Google Drive API v3
  - Endpoint: `https://www.googleapis.com/upload/drive/v3/files` (save)
  - Endpoint: `https://www.googleapis.com/drive/v3/files/{id}/export` (import)
  - Authentication: Bearer token from OAuth
  - MIME Types: `application/vnd.google-apps.document` (Google Docs)
  - Operations: Create, update, export documents as HTML
  - Routes: `/drive/save`, `/drive/import/<file_id>`, `/drive/picker-token`, `/drive/status`
  - Implementation: `backend/app.py:501-733`, `backend/static/js/gdrive.js`

**File Selection UI:**
- Google Picker API
  - Endpoint: `https://apis.google.com/js/api.js` (loaded in `backend/templates/app.html:22`)
  - Purpose: User file selection UI for importing from Drive
  - Token requirement: Access token from `/drive/picker-token` endpoint
  - Implementation: `backend/static/js/gdrive.js`

**AI Features:**
- Claude Web Search Tool (built-in)
  - Tool ID: `web_search_20250305`
  - Type: Native Claude capability (no external service)
  - Max uses per message: 5
  - Implementation: `backend/static/js/tools.js:219-225`

## Data Storage

**Databases:**
- None detected - No persistent server-side database

**Client-Side Storage:**
- localStorage (browser storage)
  - Keys stored: `anthropicApiKey`, `chats`, `documents`, `systemPrompts`, `toolsState`, `lastOpenedDocumentId`
  - Scope: Per-user, per-browser, not synced across devices
  - Persistence: Survives page refresh, not deleted on logout
  - Implementation: `backend/static/js/storage.js` (Storage module - not detected in file list but referenced)
  - Data structures: JSON objects for all entities

**Session Management:**
- Flask sessions with cookies
  - Cookie name: `auth_token` (JWT)
  - Storage: HttpOnly, Secure (in production), SameSite=Lax
  - Expiration: 7 days
  - Implementation: `backend/app.py:314-323` (login), `backend/app.py:334-336` (logout)

**File Storage:**
- Google Drive (cloud storage for documents)
  - User documents saved as Google Docs format
  - Import/export via Google Drive API
- Temporary in-memory (screenshots during session)
  - Not persisted server-side
  - Stored in client memory during screenshare

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0 + OpenID Connect
  - Implementation: Authlib with `oauth` pattern
  - Access pattern: `backend/app.py:42-52` (OAuth registration)
  - Callback: `/auth/callback` validates and creates JWT
  - Session token: HttpOnly JWT cookie
  - Token claims: `google_id`, `email`, `name`, `picture`, `google_token` (with access/refresh tokens), `exp`

**Token Management:**
- JWT tokens created on successful OAuth
- Auto-refresh of Google OAuth tokens (5-minute grace period before expiry)
- Token refresh endpoint: `https://oauth2.googleapis.com/token`
- Implementation: `backend/app.py:144-205` (get_google_token_with_auto_refresh function)
- Refresh token stored in JWT payload (embedded for persistence across requests)

**User Identity Sources:**
- Google: `google_id`, `email`, `name`, `picture`
- No local user database
- User info passed through JWT token in cookies

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Rollbar, etc.)

**Logs:**
- Server-side: stdout logging (configured for Vercel serverless)
  - Format: `%(asctime)s - %(levelname)s - %(message)s`
  - Level: INFO
  - Destination: stdout (for Vercel logs)
  - Implementation: `backend/app.py:20-25`
- Request logging: All HTTP requests and responses logged with timestamp, method, path, status
  - Middleware: `before_request` and `after_request` hooks
  - Implementation: `backend/app.py:57-64`
- Client-side: Browser console logs (console.log, console.error, console.warn)
  - No log aggregation service
  - Debug via browser developer tools

**Debugging:**
- DOMPurify for XSS debugging
- Development mode disabled in production (`debug=False` in `backend/app.py:744`)

## CI/CD & Deployment

**Hosting:**
- Vercel (serverless platform)
  - Framework: Python (via `@vercel/python` builder)
  - Entry point: `backend/app.py` → WSGI application as `application = app`
  - Configuration: `vercel.json`

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, etc.)
- Manual or Vercel-managed deployment

**Build Process:**
- Python builder via Vercel
- No build step for frontend (served as static)
- Static file serving: `/backend/static/` directory

## Environment Configuration

**Required env vars (development):**
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `JWT_SECRET_KEY` - Secret for signing JWT tokens
- `APP_URL` - Application URL for OAuth callback (default: `http://localhost:5000`)

**Optional env vars:**
- None detected (all vars required or have defaults)

**Secrets location:**
- `.env` file (git-ignored, never committed)
- Vercel environment variables (for production deployment)
- No secrets storage service (HashiCorp Vault, AWS Secrets Manager, etc.)

**Config files:**
- `.env` - Environment variables
- `vercel.json` - Deployment configuration
- `runtime.txt` - Python version specification
- `backend/app.py` - Flask app configuration (hardcoded defaults for some values)

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected

**OAuth Callbacks:**
- `/auth/callback` - Google OAuth redirect endpoint
  - Accepts authorization code
  - Exchanges for tokens
  - Creates JWT and sets cookie
  - Redirects to `/`

**Outgoing Callbacks:**
- Google OAuth token refresh callback (implicit in OAuth flow)
  - Endpoint: `https://oauth2.googleapis.com/token`
  - Used for automatic token refresh
  - Implementation: `backend/app.py:169-202`

## Cross-Origin & Security

**CORS:**
- Not explicitly configured
- Assumed same-origin for all API calls
- OAuth redirect required from `google.com` to `APP_URL`

**Content Security Policy (CSP):**
```
default-src 'self'
script-src 'self' 'unsafe-inline' https://apis.google.com
style-src 'self' 'unsafe-inline'
img-src 'self' data: https:
connect-src 'self' https://api.anthropic.com https://accounts.google.com https://www.googleapis.com
font-src 'self'
object-src 'none'
form-action 'self' https://accounts.google.com
frame-src https://accounts.google.com https://drive.google.com https://docs.google.com
```

**Allowed External Domains (CSP):**
- `https://apis.google.com` - Google API loader
- `https://api.anthropic.com` - Anthropic API
- `https://accounts.google.com` - Google OAuth
- `https://www.googleapis.com` - Google APIs (Drive, Picker)
- `https://drive.google.com` - Google Drive iframe
- `https://docs.google.com` - Google Docs iframe

## API Rate Limits

**Anthropic Claude:**
- No explicit rate limiting in code
- Server-side: Depends on API key's rate limits
- Client configures: 20,000 token max response

**Google APIs:**
- No explicit rate limiting in code
- Default: Drive API has per-user quotas
- OAuth token refresh: Automatic when token expires

---

*Integration audit: 2025-01-25*
