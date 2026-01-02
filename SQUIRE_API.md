# Squire Rich Text Editor - API Reference (Local Copy)

**Version**: 2.x (Squire RTE)
**Official Documentation**: https://github.com/neilj/Squire
**Last Updated**: 2026-01-01

---

## Overview

Squire is an HTML5 rich text editor designed for handling arbitrary HTML in email composition and document editing. It's a lightweight library (16KB minified/gzipped) with no dependencies.

**Key Features:**
- HTML as source-of-truth (no internal data model conversion)
- Robust handling of complex HTML (forwarded emails, blockquotes)
- Customizable keyboard shortcuts
- Event-driven architecture
- Built-in undo/redo history

---

## Installation & Initialization

```javascript
// Via NPM
npm install squire-rte
import Squire from 'squire-rte';

// Initialize with DOM element
const editor = new Squire(document.getElementById('editor'));

// Or via script tag
<script src="/static/js/squire-raw.js"></script>
<script>
  const editor = new Squire(document.getElementById('editor'));
</script>
```

**Constructor Options:**
```javascript
new Squire(domElement, {
  blockTag: 'P',                    // Default block element tag
  blockAttributes: {                // Default attributes for blocks
    style: 'font-size: 16px;'
  },
  sanitizeToDOMFragment: (html, editor) => {
    // Custom sanitization function (use DOMPurify for security)
    return documentFragment;
  }
});
```

---

## Event System

### addEventListener(type, handler)

Register event listeners for editor state changes.

**Available Events:**

| Event | Description | Event Detail |
|-------|-------------|--------------|
| `focus` | Editor gained focus | - |
| `blur` | Editor lost focus | - |
| `keydown` | Key pressed (before processing) | Standard KeyboardEvent |
| `keypress` | Character key pressed | Standard KeyboardEvent |
| `keyup` | Key released | Standard KeyboardEvent |
| `input` | Content modified (HTML changed) | - |
| `pathChange` | Cursor position changed | `event.detail.path` (CSS-like path) |
| `select` | Selection or cursor moved | - |
| `cursor` | Cursor position updated | - |
| `undoStateChange` | Undo/redo availability changed | `event.detail.canUndo`, `event.detail.canRedo` |
| `willPaste` | Content about to be pasted | `event.detail.fragment`, `event.detail.text` |
| `pasteImage` | Image pasted into editor | Image data |

**Usage Example (from Apprised codebase):**
```javascript
// Update font display when cursor moves
this.squireEditor.addEventListener('pathChange', () => {
    this.updateFontSizeDisplay();
    this.updateFontFamilyDisplay();
});

// Track content changes for auto-save
this.squireEditor.addEventListener('input', () => {
    this.saveDocumentWithDebounce();
});
```

---

## Content Management

### Core Content Methods

#### getHTML() → string
Retrieve current editor content as HTML.

```javascript
const htmlContent = editor.getHTML();
```

#### setHTML(html: string)
Set editor content from HTML string.

```javascript
editor.setHTML('<p>Hello <strong>world</strong></p>');
```

**Apprised Usage:**
```javascript
// Loading document content
this.squireEditor.setHTML(document.content || '');
```

#### getSelectedText() → string
Get only the plain text of current selection (no HTML tags).

```javascript
const selectedText = editor.getSelectedText();
```

#### insertHTML(html: string)
Insert HTML at current cursor position.

```javascript
editor.insertHTML('<strong>Bold text</strong>');
```

**Apprised Usage:**
```javascript
// Insert Claude-generated changes
this.squireEditor.insertHTML(wrappedText);
```

#### insertPlainText(text: string)
Insert plain text at cursor position (special characters escaped).

```javascript
editor.insertPlainText('This <text> will be escaped');
```

**Apprised Usage:**
```javascript
// Insert text without HTML formatting
this.squireEditor.insertPlainText(text);
```

#### insertImage(src: string, attributes?: object)
Insert image element at cursor position.

```javascript
editor.insertImage('image.jpg', {
    width: '300px',
    alt: 'Description'
});
```

---

## Selection & Cursor Control

### Selection Methods

#### getSelection() → Range
Return W3C Range object representing current selection.

```javascript
const range = editor.getSelection();
console.log(range.startContainer, range.endContainer);
```

#### setSelection(range: Range)
Set cursor/selection from a Range object.

```javascript
const range = editor.createRange(startNode, startOffset, endNode, endOffset);
editor.setSelection(range);
```

#### moveCursorToStart()
Move cursor to beginning of document.

```javascript
editor.moveCursorToStart();
```

#### moveCursorToEnd()
Move cursor to end of document.

```javascript
editor.moveCursorToEnd();
```

#### createRange(startContainer, startOffset, endContainer, endOffset) → Range
Create a Range object for selection manipulation.

```javascript
const range = editor.createRange(
    textNode, 0,    // Start position
    textNode, 10    // End position
);
```

#### getCursorPosition() → DOMRect
Get viewport-relative bounding rectangle of cursor position.

```javascript
const rect = editor.getCursorPosition();
console.log(rect.top, rect.left); // Position for tooltips/popovers
```

---

## Text Formatting

### Inline Formatting Methods

#### bold()
Apply bold formatting to selection (or at cursor for next typed text).

```javascript
editor.bold();
```

**Apprised Usage:**
```javascript
// Toggle bold formatting
if (this.squireEditor.hasFormat('B')) {
    this.squireEditor.removeBold();
} else {
    this.squireEditor.bold();
}
```

#### removeBold()
Remove bold formatting from selection.

```javascript
editor.removeBold();
```

#### italic()
Apply italic formatting to selection.

```javascript
editor.italic();
```

#### removeItalic()
Remove italic formatting from selection.

```javascript
editor.removeItalic();
```

#### underline()
Apply underline formatting to selection.

```javascript
editor.underline();
```

#### removeUnderline()
Remove underline formatting from selection.

```javascript
editor.removeUnderline();
```

#### strikethrough()
Apply strikethrough formatting to selection.

```javascript
editor.strikethrough();
```

#### removeStrikethrough()
Remove strikethrough formatting from selection.

```javascript
editor.removeStrikethrough();
```

### Font Styling

#### setFontFace(font: string)
Set font family for selection. Accepts comma-separated font list.

```javascript
editor.setFontFace('Arial, Helvetica, sans-serif');
```

**Apprised Usage:**
```javascript
// Apply font family from dropdown
this.squireEditor.setFontFace(fontFamily);
this.squireEditor.focus();
```

#### setFontSize(size: string)
Set font size for selection. Accepts CSS length or absolute-size values.

```javascript
editor.setFontSize('16px');
editor.setFontSize('14pt');
editor.setFontSize('large');
```

**Apprised Usage:**
```javascript
// Apply font size from dropdown
this.squireEditor.setFontSize(size);
this.squireEditor.focus();
```

#### setTextColor(color: string)
Set text color for selection. Accepts any CSS color value.

```javascript
editor.setTextColor('#ff0000');
editor.setTextColor('rgb(255, 0, 0)');
editor.setTextColor('red');
```

#### setHighlightColor(color: string)
Set background color (highlight) for selection.

```javascript
editor.setHighlightColor('#ffff00');
```

---

## Block-Level Formatting

### Alignment & Direction

#### setTextAlignment(alignment: string)
Set text alignment for current block(s). Values: `'left'`, `'right'`, `'center'`, `'justify'`.

```javascript
editor.setTextAlignment('center');
```

**Apprised Usage:**
```javascript
// Apply alignment from toolbar button
this.squireEditor.setTextAlignment(alignment);
this.squireEditor.focus();
```

#### setTextDirection(direction: string)
Set text direction for current block(s). Values: `'ltr'` (left-to-right), `'rtl'` (right-to-left).

```javascript
editor.setTextDirection('rtl'); // For Arabic, Hebrew, etc.
```

### Lists & Headings

#### makeUnorderedList()
Convert selection to bulleted list.

```javascript
editor.makeUnorderedList();
```

#### makeOrderedList()
Convert selection to numbered list.

```javascript
editor.makeOrderedList();
```

#### removeList()
Remove list formatting from selection.

```javascript
editor.removeList();
```

#### increaseListLevel()
Indent list item (increase nesting level).

```javascript
editor.increaseListLevel();
```

#### decreaseListLevel()
Outdent list item (decrease nesting level).

```javascript
editor.decreaseListLevel();
```

#### makeHeading(level: number)
Convert current block to heading (H1-H6).

```javascript
editor.makeHeading(1); // H1
editor.makeHeading(2); // H2
```

#### removeHeading()
Convert heading back to normal paragraph.

```javascript
editor.removeHeading();
```

---

## Links

### makeLink(url: string, attributes?: object)
Convert selection to hyperlink.

```javascript
editor.makeLink('https://example.com', {
    target: '_blank',
    title: 'Example site'
});
```

### removeLink()
Remove link formatting from selection.

```javascript
editor.removeLink();
```

---

## Query Methods

### hasFormat(tag: string, attributes?: object) → boolean
Check if specific format is applied in current selection.

```javascript
if (editor.hasFormat('B')) {
    console.log('Selection is bold');
}

if (editor.hasFormat('A', { href: 'https://example.com' })) {
    console.log('Selection contains specific link');
}
```

**Apprised Usage:**
```javascript
// Toggle formatting states
if (this.squireEditor.hasFormat('B')) {
    this.squireEditor.removeBold();
} else {
    this.squireEditor.bold();
}
```

**Common Format Tags:**
- `'B'` - Bold
- `'I'` - Italic
- `'U'` - Underline
- `'S'` - Strikethrough
- `'A'` - Link
- `'UL'` - Unordered list
- `'OL'` - Ordered list

### getPath() → string
Get CSS-like path from body to current cursor position.

```javascript
const path = editor.getPath();
// Example: "BODY>DIV>P>STRONG"
```

**Apprised Usage:**
```javascript
// Check if cursor is inside a list
const path = this.squireEditor.getPath();
const isInList = path.includes('UL') || path.includes('OL');
```

### getFontInfo() → object
Get font styling information at current cursor position.

```javascript
const fontInfo = editor.getFontInfo();
console.log(fontInfo.fontFamily);     // e.g., "Arial"
console.log(fontInfo.fontSize);       // e.g., "16px"
console.log(fontInfo.color);          // e.g., "#000000"
console.log(fontInfo.backgroundColor); // e.g., "#ffffff"
```

**Apprised Usage:**
```javascript
// Update font size dropdown display
const fontInfo = this.squireEditor.getFontInfo();
if (fontInfo && fontInfo.fontSize) {
    this.fontSizeDropdown.textContent = fontInfo.fontSize;
}
```

---

## History Management

### Undo/Redo System

#### saveUndoState()
Manually checkpoint current editor state to undo history.

```javascript
editor.saveUndoState();
```

**Note:** Squire automatically saves undo states on most operations, but you can manually trigger this before programmatic changes.

#### undo()
Revert to previous state in undo history.

```javascript
editor.undo();
```

#### redo()
Reapply last undone change.

```javascript
editor.redo();
```

**Apprised Usage:**
```javascript
// Undo button handler
UI.elements.undoBtn?.addEventListener('click', () => {
    if (this.squireEditor) {
        this.squireEditor.undo();
    }
});
```

---

## Advanced Operations

### forEachBlock(fn: Function, mutates?: boolean)
Execute function on each block element in current selection.

```javascript
editor.forEachBlock(function(block) {
    console.log('Block:', block.tagName);
    // Modify block if needed
}, true); // Set mutates=true if modifying blocks
```

### modifyBlocks(fn: Function)
Apply complex transformations to block elements in selection.

```javascript
editor.modifyBlocks(function(fragment) {
    // Transform fragment
    return modifiedFragment;
});
```

### changeFormat(add: object, remove?: object, range?: Range)
Advanced inline formatting engine for complex format changes.

```javascript
editor.changeFormat(
    { tag: 'STRONG' },           // Add bold
    { tag: 'EM' },               // Remove italic
    editor.getSelection()        // Optional range
);
```

---

## Keyboard Customization

### setKeyHandler(key: string, handler: Function | null)

Register custom keyboard shortcuts. Pass `null` as handler to remove.

**Key Format:** `'Alt-Ctrl-Meta-Shift-KeyName'`

```javascript
// Custom keyboard shortcut
editor.setKeyHandler('Ctrl-B', function(self, event, range) {
    self.bold();
    event.preventDefault();
});

// Remove built-in handler
editor.setKeyHandler('Tab', null);
```

**Apprised Usage:**
```javascript
// Disable Squire's Tab handlers for custom behavior
this.squireEditor.setKeyHandler('Tab', null);
this.squireEditor.setKeyHandler('Shift-Tab', null);
```

**Modifier Keys:**
- `Alt` - Alt/Option key
- `Ctrl` - Control key
- `Meta` - Command (Mac) / Windows key
- `Shift` - Shift key

**Common Key Names:**
- `Enter`, `Tab`, `Backspace`, `Delete`
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- Letters: `A`, `B`, `C`, etc.
- Numbers: `1`, `2`, `3`, etc.

---

## Lifecycle & Focus Management

### focus()
Give focus to the editor (enables typing).

```javascript
editor.focus();
```

**Apprised Usage:**
```javascript
// Focus editor after programmatic content insertion
this.squireEditor.insertHTML(text);
this.squireEditor.focus();
```

### blur()
Remove focus from editor.

```javascript
editor.blur();
```

### destroy()
Clean up editor resources and remove event listeners.

**CRITICAL for SPAs:** Always call when removing editor from DOM.

```javascript
// Before removing editor element
editor.destroy();
document.getElementById('editor').remove();
```

---

## Security Considerations

**XSS Prevention:** Squire does NOT automatically sanitize HTML input. You must implement sanitization:

### Option 1: DOMPurify (Recommended)
```javascript
import DOMPurify from 'dompurify';

const editor = new Squire(element, {
    sanitizeToDOMFragment: (html) => {
        const clean = DOMPurify.sanitize(html, {
            RETURN_DOM_FRAGMENT: true
        });
        return clean;
    }
});
```

### Option 2: Custom Sanitization
```javascript
const editor = new Squire(element, {
    sanitizeToDOMFragment: (html, editor) => {
        // Your sanitization logic
        // Must return DocumentFragment
        const div = document.createElement('div');
        div.innerHTML = sanitizedHtml;
        const fragment = document.createDocumentFragment();
        while (div.firstChild) {
            fragment.appendChild(div.firstChild);
        }
        return fragment;
    }
});
```

---

## Common Patterns in Apprised

### Pattern 1: Initialize with Event Listeners
```javascript
const editorContainer = document.getElementById('documentTextarea');
this.squireEditor = new Squire(editorContainer);

// Bind events for auto-save and UI updates
this.squireEditor.addEventListener('input', () => {
    this.saveDocumentWithDebounce();
});

this.squireEditor.addEventListener('pathChange', () => {
    this.updateToolbarState();
});
```

### Pattern 2: Toggle Formatting with State Check
```javascript
if (this.squireEditor.hasFormat('B')) {
    this.squireEditor.removeBold();
    button.classList.remove('active');
} else {
    this.squireEditor.bold();
    button.classList.add('active');
}
```

### Pattern 3: Insert Content and Maintain Focus
```javascript
this.squireEditor.focus();
this.squireEditor.insertHTML(htmlContent);
this.squireEditor.focus(); // Restore focus after insertion
```

### Pattern 4: Get/Set Document Content
```javascript
// Save content
const document = this.documents[documentId];
document.content = this.squireEditor.getHTML();
Storage.saveDocuments(this.documents);

// Load content
this.squireEditor.setHTML(document.content || '');
```

### Pattern 5: Disable Built-in Shortcuts for Custom Behavior
```javascript
// Disable Tab handling for custom indentation system
this.squireEditor.setKeyHandler('Tab', null);
this.squireEditor.setKeyHandler('Shift-Tab', null);

// Implement custom Tab behavior elsewhere
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        // Custom logic
    }
});
```

---

## Troubleshooting

### Issue: Content Not Saving
**Check:**
- Are you calling `getHTML()` to retrieve content?
- Is the `input` event listener attached?
- Is there a debounce mechanism to avoid excessive saves?

### Issue: Formatting Not Applying
**Check:**
- Is editor focused? Call `editor.focus()` before formatting
- Is selection valid? Use `getSelection()` to verify
- Is format already applied? Use `hasFormat()` to check

### Issue: Keyboard Shortcuts Not Working
**Check:**
- Are you preventing default browser behavior?
- Did you disable built-in handlers with `setKeyHandler(key, null)`?
- Are multiple handlers conflicting?

### Issue: Content Appears Unstyled
**Check:**
- Did you set default `blockTag` and `blockAttributes`?
- Is CSS applied to editor container?
- Are you sanitizing away style attributes?

### Issue: Memory Leaks in SPA
**Solution:**
- Always call `editor.destroy()` before removing from DOM
- Remove custom event listeners manually if needed

---

## Performance Tips

1. **Batch Operations:** Group multiple formatting changes before calling `focus()`
2. **Debounce Input Events:** Use debounce for auto-save (300-500ms recommended)
3. **Limit Undo History:** Default unlimited; implement max history size if needed
4. **Minimize DOM Queries:** Cache `getFontInfo()` results when possible
5. **Use DocumentFragment:** For large content insertions, build fragment first

---

## API Quick Reference

**Content:** `getHTML()`, `setHTML(html)`, `insertHTML(html)`, `insertPlainText(text)`
**Selection:** `getSelection()`, `setSelection(range)`, `moveCursorToStart()`, `moveCursorToEnd()`
**Formatting:** `bold()`, `italic()`, `underline()`, `setFontFace(font)`, `setFontSize(size)`
**Blocks:** `setTextAlignment(align)`, `makeHeading(level)`, `makeUnorderedList()`
**Links:** `makeLink(url, attrs)`, `removeLink()`
**Query:** `hasFormat(tag)`, `getPath()`, `getFontInfo()`
**History:** `undo()`, `redo()`, `saveUndoState()`
**Events:** `addEventListener(type, handler)`
**Lifecycle:** `focus()`, `blur()`, `destroy()`
**Keys:** `setKeyHandler(key, handler)`

---

## Additional Resources

- **Official Repository:** https://github.com/neilj/Squire
- **Live Demo:** https://neilj.github.io/Squire/
- **NPM Package:** https://www.npmjs.com/package/squire-rte
- **Issue Tracker:** https://github.com/neilj/Squire/issues

---

**Document Version:** 1.0
**Maintained By:** Apprised Development Team
**Next Review:** After Squire major version update
