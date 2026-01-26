---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/static/css/variables.css
  - backend/static/js/settings.js
  - backend/templates/app.html
autonomous: true

must_haves:
  truths:
    - "User can toggle between light, dark, and system theme"
    - "Theme preference persists across page refresh"
    - "Theme applies immediately without page reload"
    - "System preference auto-switches when set to 'auto'"
  artifacts:
    - path: "backend/static/css/variables.css"
      provides: "Dark mode CSS variables"
      contains: "[data-theme=\"dark\"]"
    - path: "backend/static/js/settings.js"
      provides: "Theme management in settings"
      contains: "theme:"
    - path: "backend/templates/app.html"
      provides: "Theme toggle UI in settings modal"
      contains: "themeSelect"
  key_links:
    - from: "settings.js"
      to: "document.documentElement.dataset.theme"
      via: "applyTheme method"
      pattern: "dataset\\.theme"
    - from: "settings.js"
      to: "Storage.saveSetting"
      via: "theme persistence"
      pattern: "saveSetting.*theme"
---

<objective>
Add dark mode toggle with light/dark/system options.

Purpose: Allow users to switch between light and dark themes for comfortable viewing
Output: Working theme toggle in settings with CSS variable-based theming
</objective>

<execution_context>
@/Users/pax/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pax/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/static/css/variables.css (existing CSS variables - add dark theme variants)
@backend/static/js/settings.js (SETTINGS_CONFIG pattern, add theme setting)
@backend/templates/app.html (settings modal sections pattern)
@backend/static/css/sidebar.css (toggle-switch CSS pattern for reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dark theme CSS variables</name>
  <files>backend/static/css/variables.css</files>
  <action>
Add dark theme CSS variables using `[data-theme="dark"]` selector after the `:root` block.

Dark theme should override these semantic variables:
- `--color-text-primary`: light gray (e.g., #e7e5e4)
- `--color-text-secondary`: medium gray (e.g., #a8a29e)
- `--color-text-tertiary`: darker gray (e.g., #78716c)
- `--color-border`: dark border (e.g., #44403c)
- `--color-bg-subtle`: dark background (e.g., #292524)
- `--color-bg-input`: dark input bg (e.g., #1c1917)
- `--color-bg-white`: dark panel bg (e.g., #1c1917)
- `--color-bg-off-white`: slightly lighter (e.g., #292524)
- `--color-bg-disabled`: muted dark (e.g., #44403c)
- `--color-primary-light`: dark primary bg (e.g., #1e3a8a with low opacity)
- `--color-sidebar-bg`: dark sidebar (e.g., #1c1917)
- `--color-sidebar-hover`: dark hover (e.g., #292524)
- `--color-sidebar-border`: dark sidebar border (e.g., #44403c)
- Adjust shadow variables for dark mode (lighter shadows or reduce opacity)

Use the existing gray scale values (gray-700 through gray-900) for the dark palette.
  </action>
  <verify>Open variables.css and confirm `[data-theme="dark"]` block exists with overridden variables</verify>
  <done>Dark theme CSS variables defined using data-theme attribute selector</done>
</task>

<task type="auto">
  <name>Task 2: Add theme setting to settings module</name>
  <files>backend/static/js/settings.js</files>
  <action>
1. Add theme to SETTINGS_CONFIG (uncomment and complete the existing placeholder):
```javascript
theme: {
    label: 'Theme',
    type: 'select',
    options: ['light', 'dark', 'auto'],
    section: 'appearance',
    validator: (value) => ['light', 'dark', 'auto'].includes(value),
    storage: 'theme',
    default: 'auto'
}
```

2. Add DOM element reference in initElements():
```javascript
this.elements.themeSelect = document.getElementById('themeSelect');
```

3. Add event listener in bindEvents():
```javascript
this.elements.themeSelect?.addEventListener('change', (e) => this.setTheme(e.target.value));
```

4. Add theme methods:
```javascript
/**
 * Apply theme to document
 */
applyTheme(theme) {
    const resolvedTheme = theme === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
    document.documentElement.dataset.theme = resolvedTheme;
},

/**
 * Set and persist theme
 */
setTheme(theme) {
    Storage.saveSetting('theme', theme);
    this.settings.theme = theme;
    this.applyTheme(theme);
},

/**
 * Initialize theme on load
 */
initTheme() {
    const theme = Storage.getSetting('theme', 'auto');
    this.settings.theme = theme;
    this.applyTheme(theme);

    // Update select if it exists
    if (this.elements.themeSelect) {
        this.elements.themeSelect.value = theme;
    }

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.settings.theme === 'auto') {
            this.applyTheme('auto');
        }
    });
}
```

5. Call `this.initTheme()` at the START of init() method (before other initialization) so theme applies immediately on page load.

6. In loadApiKey() or updateUI(), also update themeSelect value if element exists.
  </action>
  <verify>Check settings.js has theme in SETTINGS_CONFIG, applyTheme/setTheme/initTheme methods, and event bindings</verify>
  <done>Theme management integrated into Settings module with persistence and system preference support</done>
</task>

<task type="auto">
  <name>Task 3: Add theme selector to settings modal</name>
  <files>backend/templates/app.html</files>
  <action>
Add a new Appearance section in the settings modal BEFORE the API Configuration section (around line 416).

Follow the existing section pattern:
```html
<!-- Appearance Section -->
<div class="settings-section appearance-settings-section">
    <h4 class="settings-section-title">Appearance</h4>
    <div class="settings-section-content">
        <label for="themeSelect">Theme:</label>
        <select id="themeSelect" class="theme-select">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">System</option>
        </select>
        <div class="theme-help-text">
            System will automatically match your device's theme preference.
        </div>
    </div>
</div>
```

Add minimal styling inline or ensure the select uses existing component styles (it should inherit from components.css select styling).
  </action>
  <verify>Open settings modal in browser - theme dropdown should appear in Appearance section</verify>
  <done>Theme selector UI added to settings modal with light/dark/system options</done>
</task>

</tasks>

<verification>
1. `grep -n "data-theme" backend/static/css/variables.css` - should show dark theme block
2. `grep -n "initTheme\|applyTheme\|setTheme" backend/static/js/settings.js` - should show theme methods
3. `grep -n "themeSelect" backend/templates/app.html` - should show theme select element
4. Manual test: Open app, go to Settings, change theme - UI should update immediately
5. Manual test: Refresh page - theme should persist
6. Manual test: Set to System, change OS theme - app should follow
</verification>

<success_criteria>
- Theme toggle visible in settings modal with Light/Dark/System options
- Selecting Dark applies dark color scheme immediately
- Selecting Light applies light color scheme immediately
- Selecting System follows OS preference and auto-switches
- Theme preference persists in localStorage after refresh
- All UI elements (sidebar, chat, editor, modals) respect theme variables
</success_criteria>

<output>
After completion, create `.planning/quick/002-add-dark-mode-toggle/002-SUMMARY.md`
</output>
