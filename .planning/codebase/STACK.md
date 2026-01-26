# Technology Stack

**Analysis Date:** 2025-01-25

## Languages

**Primary:**
- Python 3.12 - Backend API and server-side logic
- JavaScript (ES6+) - Frontend SPA and client-side logic
- HTML5 - Frontend templates and structure
- CSS3 - Frontend styling

**Secondary:**
- JSON - Configuration and data serialization
- Base64 - File encoding for API transmission

## Runtime

**Environment:**
- Python 3.12 (specified in `runtime.txt`)
- Node.js (for development, via npm/node_modules)
- Browser runtime (Chrome, Firefox, Safari, Edge compatible)

**Package Manager:**
- Pip3 - Python package management
- npm - JavaScript dependencies (node_modules present)
- Lockfile: `node_modules/.package-lock.json` present

## Frameworks

**Core:**
- Flask 3.1.0 - Python web framework for backend API and routing
- No explicit frontend framework - Vanilla JavaScript with module pattern architecture

**Authentication & Security:**
- Authlib 1.3.2 - OAuth2/OIDC integration with Google
- PyJWT 2.10.1 - JWT token creation and validation

**Rich Text Editor:**
- Squire (custom/vendored as `squire-raw.js`) - WYSIWYG HTML editor for documents

**Text Processing:**
- DOMPurify (`purify.min.js`) - HTML sanitization to prevent XSS attacks

**Testing/Development:**
- No testing framework detected in dependencies

**Build/Dev:**
- Vercel deployment configuration (`vercel.json`)
- No build step - direct Python/HTML/CSS/JS serving

## Key Dependencies

**Critical Backend:**
- `anthropic==0.42.0` - Anthropic API client for Claude integration
- `requests==2.31.0` - HTTP client for API calls (Google OAuth token refresh, Drive API)
- `flask==3.1.0` - Web framework
- `werkzeug==3.1.3` - WSGI utilities (Flask dependency)

**Authentication:**
- `authlib==1.3.2` - OAuth2 client integration
- `PyJWT==2.10.1` - JWT token handling

**Configuration:**
- `python-dotenv==1.0.0` - Environment variable loading from `.env`

## Configuration

**Environment:**
- Configuration via `.env` file (git-ignored but present in repo for reference)
- Key configs: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET_KEY`, `APP_URL`
- API keys stored client-side in localStorage, not on server
- Flask session type: `filesystem`

**Build:**
- Vercel deployment via `vercel.json`
- Python entry point: `backend/app.py` (WSGI application as `application = app`)
- Static files served from `/backend/static/`
- Templates served from `/backend/templates/`

## Platform Requirements

**Development:**
- Python 3.12
- pip3
- Node.js (for frontend tooling during development)
- Modern web browser with ES6+ support

**Production:**
- Deployment target: Vercel (serverless Python via `@vercel/python` builder)
- HTTPS only (security headers reference HTTPS and upgrade-insecure-requests)
- Environment variables required: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET_KEY`, `APP_URL`
- Minimum 20,000 token response capability for Claude API (max_tokens: 20000)

## External APIs Used

**Anthropic Claude:**
- Model: `claude-sonnet-4-5-20250929`
- Features: PDF documents, 1M token context window (via beta headers)
- Max response: 20,000 tokens

**Google OAuth & APIs:**
- OAuth2 OIDC for authentication
- Google Drive API v3 (document save/import)
- Google Picker API (file selection UI)

**Browser APIs:**
- MediaDevices API (screenshare/screen capture)
- Canvas API (screenshot processing)
- Clipboard API
- localStorage (client-side persistence)

## Security & Headers

**Security Headers (enforced by Flask):**
- Content-Security-Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: geolocation=(), microphone=(), camera=()

**Authentication:**
- OAuth2 with JWT tokens (7-day expiration)
- HttpOnly cookies for token storage
- CORS not explicitly configured (Flask runs on same domain)

---

*Stack analysis: 2025-01-25*
