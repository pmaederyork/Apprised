# Header Formatting Dropdown Implementation Plan

## Overview
Add a format dropdown to the toolbar that lets users convert text between Paragraph, Heading 1, Heading 2, and Heading 3. Handles Google Drive imports with conflicting styles cleanly.

---

## Part 1: UI Components

### Toolbar Addition
**File:** `backend/templates/app.html`

**Location:** Add after line 305 (after the toolbar-separator following fontFamilySelect, before textAlignSelect)

```html
<!-- Format Dropdown -->
<span class="toolbar-separator"></span>
<select id="formatSelect" class="format-dropdown" title="Text Format">
    <option value="p">P</option>
    <option value="h1">H1</option>
    <option value="h2">H2</option>
    <option value="h3">H3</option>
</select>
```

### Styling
**File:** `backend/static/css/editor.css`

**Add after line ~182 (after format-active styles):**
```css
/* Format Dropdown */
.format-dropdown {
    width: 55px;
    font-family: inherit;
    font-weight: 500;
}
```

---

## Part 2: DOM Reference Registration

### Add Format Dropdown to UI Elements
**File:** `backend/static/js/ui.js`

**Add to UI.elements object after line 89 (after openInDriveBtn):**
```javascript
// In UI.elements = { ... }
openInDriveBtn: document.getElementById('openInDriveBtn'),  // ADD TRAILING COMMA!
formatSelect: document.getElementById('formatSelect')       // ADD THIS
```

**Note:** Line 89 currently has NO trailing comma - must add comma first.

---

## Part 3: Format Detection & Display

### Update Toolbar on Selection Change
**File:** `backend/static/js/documents.js`

**New method (add around line 1137, before updateToolbarButtonStates):**
```javascript
// Update format dropdown to show current block type
updateFormatDisplay() {
    // Skip updates during document loading
    if (this._loadingDocument) return;

    const formatSelect = document.getElementById('formatSelect');
    if (!formatSelect || !this.squireEditor) return;

    try {
        const path = this.squireEditor.getPath();

        // Find first block-level element in path
        // getPath() returns "BODY>DIV>P>STRONG" - must find block, not inline element
        const pathSegments = path.split('>');
        const blockTypes = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'LI'];
        const currentBlock = pathSegments.find(seg => blockTypes.includes(seg)) || 'P';

        if (currentBlock === 'H1') {
            formatSelect.value = 'h1';
        } else if (currentBlock === 'H2') {
            formatSelect.value = 'h2';
        } else if (currentBlock === 'H3') {
            formatSelect.value = 'h3';
        } else {
            formatSelect.value = 'p';
        }
    } catch (error) {
        console.warn('Failed to detect format:', error);
        formatSelect.value = 'p';
    }
}
```

**Add to Squire event listeners (around line 48):**
```javascript
// Update format dropdown on selection changes
this.squireEditor.addEventListener('select', () => {
    this.updateFontSizeDisplay();
    this.updateFontFamilyDisplay();
    this.updateToolbarButtonStates();
    this.updateFormatDisplay(); // NEW
});

// Update format dropdown on path changes
this.squireEditor.addEventListener('pathChange', () => {
    this.updateToolbarButtonStates();
    this.updateFormatDisplay(); // NEW
});
```

---

## Part 4: CSS-Based Default Header Styling

### Header Default Styling
**File:** `backend/static/css/editor.css`

**Add after line ~161 (after blockquote styles):**
```css
/* Default Header Styling */
.document-textarea h1 {
    font-size: 20pt;
    font-weight: bold;
}

.document-textarea h2 {
    font-size: 16pt;
    font-weight: bold;
}

.document-textarea h3 {
    font-size: 14pt;
    font-weight: bold;
    font-style: italic;
}
```

**Why CSS:** Simpler than JavaScript, no nested tags, automatic application.

---

## Part 5: Format Conversion Method

### New Method: Set Format
**File:** `backend/static/js/documents.js`

**Add around line 768 (before existing setFontSize method):**

```javascript
// Convert block between paragraph and heading formats
setFormat(format) {
    if (!this.squireEditor) return;

    // Validate format value
    if (!['p', 'h1', 'h2', 'h3'].includes(format)) {
        console.warn('Invalid format:', format);
        return;
    }

    // Save undo state before format changes
    this.squireEditor.saveUndoState();

    try {
        if (format === 'h1') {
            this.squireEditor.makeHeading(1);
        } else if (format === 'h2') {
            this.squireEditor.makeHeading(2);
        } else if (format === 'h3') {
            this.squireEditor.makeHeading(3);
        } else if (format === 'p') {
            this.squireEditor.removeHeading();
        }

        // Focus editor and update UI
        this.squireEditor.focus();

        // Update toolbar displays after DOM settles
        setTimeout(() => {
            this.updateFormatDisplay();
            this.updateFontSizeDisplay();
            this.updateToolbarButtonStates();
        }, 0);

        // Save changes
        this.scheduleAutoSave();
    } catch (error) {
        console.error('Failed to set format:', error);
    }
}
```

---

## Part 6: Event Binding with Selection Preservation

### Bind Format Dropdown Change
**File:** `backend/static/js/documents.js`

**Add to `bindMarkdownEvents()` method (at line 1353, after textAlignSelect binding):**
```javascript
// Format dropdown with selection preservation
const formatSelect = document.getElementById('formatSelect');
let savedSelection = null;

if (formatSelect) {
    // Save selection BEFORE dropdown opens
    formatSelect.addEventListener('mousedown', (e) => {
        if (this.squireEditor) {
            try {
                savedSelection = this.squireEditor.getSelection();
            } catch (error) {
                console.warn('Failed to save selection:', error);
            }
        }
    });

    // Apply format change
    formatSelect.addEventListener('change', (e) => {
        // Try to restore selection
        if (savedSelection) {
            try {
                this.squireEditor.setSelection(savedSelection);
            } catch (error) {
                // Range might be invalid - Squire handles cursor positioning
                console.warn('Failed to restore selection:', error);
            }
        }

        // Apply format change
        this.setFormat(e.target.value);

        // Focus editor
        this.squireEditor.focus();

        // Clear saved selection
        savedSelection = null;
    });

    // Clear saved selection if dropdown closed without selecting
    formatSelect.addEventListener('blur', () => {
        savedSelection = null;
    });
}
```

**Pattern Reference:** Same pattern used by font size/family dropdowns (documents.js:1233-1310)

---

## Part 7: Fix Google Drive Header Reformatting

### Problem
Current code applies font styles to header blocks directly, but Google Docs imports have inline SPAN styles that win due to CSS specificity.

**Current broken behavior:**
```html
<h1 style="font-family: Courier">  <!-- Block-level style added by code -->
  <span style="font-family: Times">Text</span>  <!-- Inner SPAN wins -->
</h1>
```

### Solution: Simplify setFontSize and setFontFamily

**File:** `backend/static/js/documents.js`

**Delete lines 770-817 in setFontSize()**, replace with:
```javascript
// Set font size for selected text
setFontSize(size) {
    if (!this.squireEditor) return;

    const sizeValue = size ? size + 'pt' : null;

    if (sizeValue) {
        this.squireEditor.setFontSize(sizeValue);
    } else {
        this.squireEditor.setFontSize(null);
    }

    this.scheduleAutoSave();
}
```

**Delete lines 820-861 in setFontFamily()**, replace with:
```javascript
// Set font family for selected text
setFontFamily(family) {
    if (!this.squireEditor) return;

    if (family) {
        this.squireEditor.setFontFace(family);
    } else {
        this.squireEditor.setFontFace(null);
    }

    this.scheduleAutoSave();
}
```

**Benefits:**
- Headers work exactly like paragraphs (consistent UX)
- Google Drive imports can be reformatted (fixes bug)
- Simpler code (~80 lines deleted)
- No breaking changes

---

## Part 8: Google Drive Import Cleanup (MANDATORY)

### Why This Is Mandatory

Google Docs imports have inline styles on both block AND inner SPANs:
```html
<h1 style="font-size:24pt;font-family:Arial">
  <span style="font-size:15pt;font-family:arial">Text</span>
</h1>
```

**CSS Specificity:** Inline styles (1000) override CSS classes (011).

Without cleanup, CSS defaults AND font dropdown changes won't be visible.

### Implementation

**File:** `backend/static/js/gdrive.js`

**In `processGoogleDocsHTML()` after creating heading (line ~65):**
```javascript
heading.setAttribute('style', style);

// Clean conflicting inline styles from Google Docs imports
// Required for CSS defaults and font dropdowns to work

// 1. Clean inner span styles
heading.querySelectorAll('span[style]').forEach(span => {
    // Remove font-size and font-family (header defines these via CSS)
    if (span.style.fontSize) span.style.fontSize = '';
    if (span.style.fontFamily) span.style.fontFamily = '';

    // Keep other formatting (bold, italic, color, background, etc.)
    const remainingStyle = span.getAttribute('style');
    if (!remainingStyle || !remainingStyle.trim()) {
        span.removeAttribute('style');
    }

    // Unwrap empty spans
    if (span.attributes.length === 0 && span.parentNode) {
        while (span.firstChild) {
            span.parentNode.insertBefore(span.firstChild, span);
        }
        span.remove();
    }
});

// 2. Strip block-level font styles from heading
heading.style.fontSize = '';
heading.style.fontFamily = '';
// Preserve other block styles (text-align, margin, padding, color)
```

**Why Both Cleanups:**
- SPAN cleanup: Removes inner styles that override Squire's formatting
- Block cleanup: Removes H1/H2/H3 styles so CSS defaults apply
- Without both: Feature appears broken on imports

---

## Implementation Phases

### Phase 1: Core Dropdown (Parts 1-6)
- [ ] Add HTML dropdown to toolbar
- [ ] Add CSS styling for dropdown and headers
- [ ] Register DOM reference in ui.js
- [ ] Add `updateFormatDisplay()` method
- [ ] Add `setFormat()` method
- [ ] Update Squire event listeners
- [ ] Add event binding with selection preservation
- [ ] Test basic functionality (P ↔ H1/H2/H3 conversions)

### Phase 2: Google Drive Compatibility (Parts 7 + 8)
- [ ] Simplify `setFontSize()` method (remove lines 770-817)
- [ ] Simplify `setFontFamily()` method (remove lines 820-861)
- [ ] Add SPAN cleanup logic to gdrive.js
- [ ] Add block-level style stripping to gdrive.js
- [ ] Test with Google Docs import (html_example)
- [ ] **CRITICAL:** Verify font changes work visually on imported headers
- [ ] Verify cleaner HTML structure

---

## Testing Checklist

### Phase 1: Core Functionality
- [ ] Create heading from paragraph (P → H1/H2/H3)
- [ ] Convert heading back to paragraph (H1/H2/H3 → P)
- [ ] Convert between heading levels (H1 → H2, H2 → H3, etc.)
- [ ] Dropdown shows correct format when clicking into blocks
- [ ] CSS default styling applies (H1=20pt bold, H2=16pt bold, H3=14pt bold italic)
- [ ] Select text → change format applies to selection
- [ ] Format dropdown updates when clicking into different blocks
- [ ] Triple-click selection works correctly
- [ ] Partial word selection converts whole block

### Phase 2: Google Drive Compatibility
- [ ] Import Google Docs with headers (test with html_example)
- [ ] **CRITICAL:** Select imported header, change font size - MUST work visually
- [ ] **CRITICAL:** Select imported header, change font family - MUST work visually
- [ ] Convert imported H1 → H2 works correctly
- [ ] Convert imported H1 → P works correctly
- [ ] Format changes persist after page refresh
- [ ] Undo/redo works (Ctrl+Z and Ctrl+Y)
- [ ] Mixed selection (paragraph + header) converts both
- [ ] Empty lines/blocks format conversion works

---

## Files to Modify

1. **`backend/templates/app.html`** - Add format dropdown HTML
2. **`backend/static/css/editor.css`** - Style dropdown + add header CSS defaults
3. **`backend/static/js/ui.js`** - Add formatSelect to UI.elements
4. **`backend/static/js/documents.js`** - Add 2 new methods, simplify 2 methods, update event listeners
5. **`backend/static/js/gdrive.js`** - Add import cleanup logic

---

## User Experience

**Dropdown Options:**
- **P** - Paragraph (default body text)
- **H1** - Heading 1 (20pt, Bold)
- **H2** - Heading 2 (16pt, Bold)
- **H3** - Heading 3 (14pt, Bold & Italic)

**Behavior:**
1. User selects text or places cursor in block
2. Dropdown shows current block format
3. User chooses new format from dropdown
4. Entire block converts to chosen format
5. CSS applies default styling automatically
6. User can override styling via font dropdowns

**Visual Feedback:**
- Dropdown always shows current block format
- Updates automatically on selection change
- Focus returns to editor after change
- Changes saved automatically

---

## Status: Ready for Implementation

**Implementation Order:**
1. Implement Phase 1 (core functionality - Parts 1-6)
2. Test Phase 1 with checklist
3. Implement Phase 2 (Google Drive compatibility - Parts 7 + 8)
4. Test Phase 2 with html_example import
5. Verify CRITICAL tests pass
