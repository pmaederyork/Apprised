# Plaud Chat

A refactored, modular version of Claude Chat with improved architecture and extensibility.

## Project Structure

```
Plaud/
├── backend/                    # Flask backend application
│   ├── app.py                 # Main Flask application
│   ├── requirements.txt       # Python dependencies
│   ├── templates/             # HTML templates
│   │   └── index.html        # Main application template
│   └── static/               # Static assets
│       ├── css/              # Stylesheets
│       │   ├── main.css      # Core application styles
│       │   ├── sidebar.css   # Sidebar component styles
│       │   ├── chat.css      # Chat interface styles
│       │   ├── editor.css    # System prompt editor styles
│       │   └── components.css # Reusable component styles
│       ├── js/               # JavaScript modules
│       │   ├── app.js        # Main application initialization
│       │   ├── chat.js       # Chat management functionality
│       │   ├── systemPrompts.js # System prompt management
│       │   ├── storage.js    # localStorage utilities
│       │   ├── api.js        # API communication
│       │   ├── ui.js         # UI utilities and helpers
│       │   └── components.js # Reusable UI components
│       └── icons/            # Application icons
│           ├── claude.png    # App icon (PNG format)
│           └── claude-color.svg # App icon (SVG format)
├── Plaud.app/                # macOS application bundle
│   └── Contents/
│       ├── Info.plist        # App bundle metadata
│       ├── MacOS/
│       │   └── Plaud         # Launcher script
│       └── Resources/
│           └── icon.png      # App icon for macOS
└── README.md                 # This file
```

## Features

- **Modular Architecture**: Clean separation of concerns with dedicated modules
- **Chat Management**: Create, load, delete, and manage chat conversations
- **System Prompts**: Create and manage reusable system prompts for Claude
- **Real-time Streaming**: Streaming responses from Claude API
- **Persistent Storage**: All data saved to localStorage
- **Desktop Integration**: Native macOS app bundle with custom icon
- **Portable**: App bundle works from any location

## Usage

### Running the Application

1. **Desktop App**: Double-click `Plaud.app` to launch
2. **Manual**: Navigate to `backend/` and run `python3 app.py`

The application will start on `http://127.0.0.1:5000`

### Features

- **Chat**: Click "New chat" to start conversations
- **System Prompts**: Use the collapsible "SYSTEM PROMPT" section to create and manage prompts
- **Editor**: Click the edit button (✏️) to modify system prompts
- **Keyboard Shortcuts**:
  - `Enter`: Send message
  - `Escape`: Exit system prompt editor
  - `Cmd/Ctrl + N`: New chat

## Development

### Architecture

The application follows a modular architecture:

- **Storage Module**: Handles all localStorage operations
- **API Module**: Manages communication with Claude API
- **UI Module**: Provides DOM utilities and UI helpers
- **Components Module**: Reusable UI component factory
- **Chat Module**: Complete chat management system
- **SystemPrompts Module**: System prompt management and editing
- **App Module**: Main application orchestration and initialization

### Adding New Features

The modular structure makes it easy to add new features:

1. Create a new module in `static/js/`
2. Add corresponding CSS in `static/css/`
3. Initialize the module in `app.js`
4. Add UI elements to `templates/index.html`

### Dependencies

- **Backend**: Python 3, Flask, Anthropic SDK, setproctitle
- **Frontend**: Vanilla JavaScript (ES6+), CSS3, HTML5

## Differences from Original

### Improvements

1. **Modular Code**: Split monolithic HTML into logical modules
2. **Better Organization**: Separate CSS and JS files
3. **Reusable Components**: Component factory for consistent UI
4. **Error Handling**: Comprehensive error handling and notifications
5. **Debug Tools**: Built-in debugging utilities
6. **Performance**: Better caching with separate asset files
7. **Maintainability**: Clear separation of concerns

### File Structure Changes

- **Before**: Single 1200+ line HTML file
- **After**: Organized into 12+ focused files
- **CSS**: Split into 5 logical stylesheets
- **JavaScript**: 7 focused modules with clear responsibilities

## Future Extensions

The modular architecture supports easy addition of:

- Document editor tool
- File upload/management
- Additional AI models
- Plugin system
- Team collaboration features
- Export/import functionality

## Version

- **Version**: 2.0
- **Based on**: ClaudeAPI v1.0
- **Refactored**: December 2024