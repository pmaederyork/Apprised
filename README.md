# Apprised Chat

A powerful, modular AI chat application with multi-agent conversations, integrated document editing, and advanced collaboration tools.

## Overview

Apprised is a feature-rich web application for conversing with Claude AI. It extends basic chat functionality with a comprehensive document editor, multi-agent system, AI change review, file uploads, and intelligent tools like web search and screenshare integration.

**Key Highlights:**
- 🤖 **Multi-Agent System**: Assign multiple AI agents with different personalities to a single conversation
- 📝 **Document Collaboration**: Rich text editor with AI-assisted editing and change review
- 🔧 **Smart Tools**: Web search, automatic document context, and screenshare capabilities
- ⚡ **Advanced Workflows**: Multi-turn reasoning, copy-to-document shortcuts, and smart paste handling
- 🔐 **Privacy First**: All data stored locally with optional API key encryption

## Core Features

### Chat & Conversations

- **Multi-Agent System**: Create multiple AI agents with different system prompts (e.g., "Writer", "Editor", "Critic") and add them to conversations for collaborative reasoning
- **AI-Powered Prompt Generation**: Generate comprehensive system prompts from natural language descriptions
  - Collapsible generation bar in agent editor
  - Auto-generates agent names (1-3 words)
  - Real-time streaming generation
  - Keyboard shortcut: `Ctrl/Cmd+Enter`
- **Multi-Turn Reasoning**: Configure 1-10 turn iterations for extended AI problem-solving and iterative refinement
- **Real-time Streaming**: Stream responses with live typing animation and `Ctrl+C` interrupt capability
- **Chat Management**: Create, rename, delete, and switch between multiple conversations with persistent history
- **Agent Selector**: Visual agent indicator in chat header showing active agent(s)

### Document Management

- **Rich Text Editor**: Full-featured markdown editor with formatting toolbar
  - Bold, Italic, Headers (H1, H2, H3)
  - Ordered/Unordered lists
  - Strikethrough
  - Full undo/redo history
- **Smart Copy/Paste**: Intelligent HTML-to-Markdown conversion for seamless Google Docs compatibility
- **AI Change Review**: Professional review panel for AI-suggested document edits
  - Navigate changes with arrow keys
  - Accept/reject individual changes or all at once
  - Visual highlighting of modifications
  - Keyboard shortcuts for efficient workflow
- **Document Context (Auto)**: Automatic document inclusion in AI conversations when editor is open
- **Copy-to-Document**: One-click copy of AI responses to open document with Tab shortcut
- **Multiple Documents**: Create, manage, and switch between multiple documents

### Tools & Integrations

- **Web Search**: Enable Claude to search the web for up-to-date information during conversations
- **Doc Context (Auto)**: Automatically includes open document content in chat messages for contextual AI assistance
- **File Upload**: Attach multiple files and images to messages via attachment button (📎) or drag-and-drop
- **Screenshare**: Share live screenshots with AI for visual assistance and debugging
- **Focus-Aware Paste**: Smart routing of pasted content to document editor or chat input based on focus

### System & Security

- **Persistent Storage**: All chats, documents, and settings saved to browser localStorage
- **API Key Encryption**: Optional passphrase-based encryption using Web Crypto API (AES-GCM)
- **Modular Architecture**: Clean separation of concerns across 15+ JavaScript modules
- **Responsive Design**: Collapsible sidebar and adaptive layouts for different screen sizes
- **Error Handling**: Comprehensive error notifications and graceful degradation

## Installation

### Prerequisites
- Python 3.7+
- Anthropic API key ([Get one here](https://console.anthropic.com/))

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Apprised
   ```

2. **Install Python dependencies**
   ```bash
   cd backend
   pip3 install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   python3 app.py
   ```

4. **Open in browser**
   ```
   http://localhost:5000
   ```

5. **Configure API key**
   - Click the settings icon in the top right
   - Enter your Anthropic API key
   - Optionally enable encryption with a passphrase
   - Click "Save API Key"

## Usage

### Quick Start

1. **Create an Agent** (optional, or use default)
   - Expand "AGENTS" section in sidebar
   - Click "+" to add new agent
   - **Option A**: Use AI generation
     - Expand "GENERATE SYSTEM PROMPT" bar
     - Describe what you want the agent to do (e.g., "A Python expert that helps debug code")
     - Click "Generate" or press `Ctrl/Cmd+Enter`
     - AI generates both agent name and comprehensive system prompt
   - **Option B**: Write manually
     - Write system prompt defining agent's role/personality in the textarea
   - Click "Save"

2. **Start Chatting**
   - Click "New chat" or use `Cmd/Ctrl+N`
   - Select agent(s) from dropdown in chat header
   - Type message and press `Enter`

3. **Work with Documents**
   - Expand "DOCUMENTS" section in sidebar
   - Click "+" to create new document
   - Use toolbar for formatting or keyboard shortcuts
   - Document context automatically included in chats

### Multi-Agent Workflow

1. Create multiple agents with different system prompts:
   - **Writer**: "You are a creative writer focused on storytelling"
   - **Editor**: "You are a thorough editor focused on clarity and grammar"
   - **Critic**: "You provide constructive feedback on writing"

2. Add agents to conversation using "+" button in chat header

3. Set turn count (1-10) for extended reasoning iterations

4. Agents collaborate in sequence during the conversation, each bringing their unique perspective

### Document Collaboration

1. **Create and edit**
   - Create document from sidebar
   - Type or paste content (HTML automatically converts to Markdown)
   - Use formatting toolbar or keyboard shortcuts

2. **Get AI assistance**
   - Ask questions in chat - document context automatically included
   - Use Tab key to quickly copy AI responses into document
   - AI can suggest edits directly to your document

3. **Review AI changes**
   - When AI suggests edits, review panel appears
   - Navigate changes with arrow keys
   - Accept (Enter) or reject (Delete) individual changes
   - Use `Ctrl+A` to accept all or `Ctrl+R` to reject all

### File-Enhanced Conversations

1. Click 📎 attachment button or paste images directly
2. Files appear in preview area before sending
3. AI can analyze images, documents, and code
4. Combine with web search for research-heavy tasks

## Keyboard Shortcuts

### Chat Interface
| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Ctrl+C` | Interrupt streaming response |
| `Cmd/Ctrl+N` | New chat |
| `Tab` | Copy Claude's last response to open document |

### Agent Editor
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+Enter` | Generate system prompt from description |

### Document Editor
| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+B` | Bold selected text |
| `Ctrl+I` | Italic selected text |
| `Ctrl+1` | Insert H1 header |
| `Ctrl+2` | Insert H2 header |
| `Ctrl+3` | Insert H3 header |
| `Ctrl+L` | Unordered list |
| `Ctrl+Shift+L` | Ordered list |
| `Ctrl+Shift+X` | Strikethrough |

### Change Review Panel
| Shortcut | Action |
|----------|--------|
| `→` | Next change |
| `←` | Previous change |
| `Enter` | Accept current change |
| `Delete` | Reject current change |
| `Ctrl+A` | Accept all changes |
| `Ctrl+R` | Reject all changes |

## Architecture

### Project Structure

```
Apprised/
├── backend/                    # Flask backend application
│   ├── app.py                 # Main Flask server with API endpoints
│   ├── requirements.txt       # Python dependencies
│   ├── templates/             # HTML templates
│   │   └── index.html        # Main SPA template
│   └── static/               # Static assets
│       ├── css/              # Stylesheets
│       │   ├── variables.css      # CSS custom properties
│       │   ├── main.css           # Global styles & layout
│       │   ├── sidebar.css        # Sidebar & responsive behavior
│       │   ├── chat.css           # Chat interface & messages
│       │   ├── editor.css         # Document editor & toolbar
│       │   ├── editor-changes.css # AI change review panel
│       │   ├── components.css     # Reusable component styles
│       │   └── buttons.css        # Button styles & states
│       ├── js/               # JavaScript modules (16 files)
│       │   ├── app.js             # Application initialization
│       │   ├── ui.js              # DOM references & utilities
│       │   ├── storage.js         # localStorage wrapper
│       │   ├── api.js             # Anthropic API communication
│       │   ├── components.js      # UI component factory
│       │   ├── chat.js            # Chat management
│       │   ├── agents.js          # Multi-agent system
│       │   ├── systemPrompts.js   # Agent/prompt management
│       │   ├── promptGenerator.js # AI-powered prompt generation
│       │   ├── documents.js       # Document editor
│       │   ├── claude-changes.js  # AI change review system
│       │   ├── files.js           # File upload & paste handling
│       │   ├── tools.js           # Tool toggles (web search, etc)
│       │   ├── screenshare.js     # Screenshot capture
│       │   ├── settings.js        # API key & settings modal
│       │   └── crypto-utils.js    # Encryption utilities
│       └── icons/            # Application icons
│           └── claude-color.svg
└── README.md                 # This file
```

### Module Architecture

**Initialization Order (app.js):**
1. **SystemPrompts** → Agent/prompt management
2. **PromptGenerator** → AI-powered prompt generation (depends on SystemPrompts)
3. **Documents** → Document editor system
4. **Chat** → Core messaging functionality
5. **Tools** → Feature toggles
6. **Files** → Upload & paste handling
7. **Settings** → API configuration

**Core Modules:**
- `app.js` - Application orchestration & initialization
- `ui.js` - DOM element references and UI utilities
- `storage.js` - localStorage wrapper for all data persistence
- `api.js` - Anthropic API communication and streaming
- `components.js` - Reusable UI component factory

**Feature Modules:**
- `chat.js` - Chat management (CRUD, messaging, streaming, UI)
- `agents.js` - Multi-agent system and selector UI
- `systemPrompts.js` - Agent/prompt creation, editing, and management
- `promptGenerator.js` - AI-powered system prompt generation from natural language
- `documents.js` - Document editor with markdown toolbar and smart paste
- `claude-changes.js` - AI change review system with visual highlighting
- `files.js` - File upload and focus-aware paste routing
- `tools.js` - Tool toggles (web search, doc context, screenshare)
- `screenshare.js` - Screenshot capture and sharing
- `settings.js` - API key management and encryption
- `crypto-utils.js` - Web Crypto API wrapper for encryption

**Data Flow:**
- **Storage.js** ↔ **localStorage** (all persistence)
- **API.js** ↔ **Flask backend** ↔ **Anthropic API**
- **UI.js** ← **All modules** (DOM references)
- **Components.js** ← **All modules** (reusable UI)

### Key Design Patterns

**Module Pattern:**
```javascript
const ModuleName = {
    currentId: null,
    items: {},
    initialized: false,

    init() { /* Load, bind, render */ },
    bindEvents() { /* Event handlers */ },
    createNew() { /* CRUD operations */ },
    renderList() { /* UI updates */ }
};
```

**Storage Pattern:**
- Keys: `[itemType]s` (e.g., `chats`, `documents`, `systemPrompts`)
- IDs: `[prefix]_[timestamp]_[random]` (e.g., `doc_1234567890_abc123`)
- All operations wrapped in try/catch
- Immediate save after state changes

**Event Handling:**
- Action buttons use `e.stopPropagation()` to prevent parent events
- Collapsible sections use header click handlers
- Focus-aware routing for paste events

## Development

### Adding New Features

Follow the "Clean Tree Process" from CLAUDE.md:

1. **Plan & Design**
   - Identify scope (sidebar feature, editor enhancement, API integration)
   - Review existing patterns
   - Plan data structure
   - Design UI integration

2. **Implementation Order (CRITICAL)**
   ```
   1. storage.js     - Add storage methods first
   2. [feature].js   - Create module following patterns
   3. ui.js          - Add DOM references
   4. index.html     - Add HTML structure
   5. [relevant].css - Add styling
   6. app.js         - Add initialization (last)
   ```

3. **Follow Established Patterns**
   - Use `Components.createListItem()` for sidebar items
   - Use `.active` class with orange theme `#ea580c`
   - Collapsible sections use `.collapsed` class
   - All storage operations in try/catch blocks

### Dependencies

**Backend:**
- Python 3.7+
- Flask - Web framework
- Anthropic SDK - Claude API client
- Base64 - File encoding

**Frontend:**
- Vanilla JavaScript (ES6+)
- Web Crypto API - Encryption
- CSS3 with CSS Variables
- HTML5
- ContentEditable API - Document editor
- Clipboard API - Smart copy/paste

### Testing

**Manual Testing Required:**
- Always test after changes
- Check all CRUD operations
- Verify localStorage persistence
- Test keyboard shortcuts
- Verify responsive behavior

**Testing Checklist:**
```bash
# Start server
cd backend
python3 app.py

# Test in browser
# 1. Create/edit/delete agents
# 2. Start chat with multiple agents
# 3. Create/edit documents
# 4. Upload files
# 5. Toggle tools (web search, doc context)
# 6. Test keyboard shortcuts
# 7. Test AI change review
# 8. Test copy-to-document (Tab key)
```

## Version History

- **Version**: 3.1
- **Refactored**: December 2024
- **Major Updates**:
  - **AI-powered prompt generation** - Generate system prompts from natural language
  - Multi-agent system with agent selector
  - Multi-turn conversation support
  - Full document editor with AI collaboration
  - AI change review system
  - File upload and smart paste handling
  - Tools system (web search, doc context, screenshare)
  - Copy-to-document feature
  - Enhanced keyboard shortcuts
  - Automatic Doc Context toggling

## Future Extensions

The modular architecture supports easy addition of:

- Additional AI models (GPT, Gemini, etc.)
- Plugin system for community extensions
- Team collaboration features (shared chats, comments)
- Export/import functionality (JSON, Markdown, PDF)
- Voice input/output
- Advanced file management (folders, search)
- Syntax highlighting for code blocks
- Version control for documents

## Security Notes

- **API Keys**: Never commit API keys to version control
- **Encryption**: Optional passphrase-based encryption available in settings
- **Local Storage**: All data stored in browser localStorage (not sent to any server except Anthropic API)
- **HTTPS**: Use HTTPS in production for secure API communication
- **Passphrase**: Use strong passphrases (12+ characters) when enabling encryption

## Contributing

For development guidelines and architectural patterns, see `CLAUDE.md` which contains comprehensive documentation on:
- Full stack architecture
- Module patterns and dependencies
- CSS/Button formatting best practices
- Implementation learnings
- Common issues and solutions

## License

[Your license here]

## Support

For issues, questions, or contributions, please [open an issue](https://github.com/your-repo/issues) or contact the maintainers.
