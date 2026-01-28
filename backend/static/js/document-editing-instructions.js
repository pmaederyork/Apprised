/**
 * Document Editing Instructions
 * Shared instructions for Claude to edit documents via structured XML
 * Used by both single-agent mode and Moderator direct edits
 */
const DocumentEditingInstructions = {
    /**
     * Get the full document editing instructions
     * @param {boolean} isMultiAgent - Whether in multi-agent mode (affects response style guidance)
     * @returns {string} The full instructions string
     */
    getFull(isMultiAgent = false) {
        return `

DOCUMENT EDITING CAPABILITY:
The user has a document open in the editor and its HTML content is provided to you as a file attachment. You can interpret natural language editing requests and propose structured edits.

═══════════════════════════════════════════════════════════════════════════
MODULAR COMMAND SYSTEM
═══════════════════════════════════════════════════════════════════════════

Every user request has THREE components that you must identify and combine:

1️⃣ COMMAND: What action to perform (Add, Move, Delete, Modify)
2️⃣ TARGET: What content to act upon (specific element, range, all matching)
3️⃣ LOCATION: Where to perform the action (at top, at end, before X, after X, between X and Y)

═══════════════════════════════════════════════════════════════════════════
LAYER 1: COMMANDS (What action)
═══════════════════════════════════════════════════════════════════════════

🔵 ADD - Insert new content
   XML: <change type="add" insertBefore="..." OR insertAfter="...">
        <new>[new HTML]</new>
        </change>

🔵 MOVE - Relocate existing content
   XML: TWO changes required:
        1. <change type="delete"><original>[exact HTML]</original></change>
        2. <change type="add" insertBefore="..." OR insertAfter="..."><new>[same HTML]</new></change>

🔵 DELETE - Remove content
   XML: <change type="delete">
        <original>[exact HTML to remove]</original>
        </change>

🔵 MODIFY - Change existing content
   XML: <change type="modify">
        <original>[exact original HTML]</original>
        <new>[replacement HTML]</new>
        </change>

🔵 FORMAT - Apply styling without changing content
   XML: <change type="format" targetId="[element-id]">
        <original>[element HTML for verification]</original>
        <style>[format to apply]</style>
        </change>

   Use FORMAT when you only need to change appearance (bold, font-size, alignment)
   WITHOUT rewriting the content. More efficient than MODIFY for pure styling.

═══════════════════════════════════════════════════════════════════════════
LAYER 2: TARGET SELECTORS (What content)
═══════════════════════════════════════════════════════════════════════════

📍 SPECIFIC ELEMENT
   "the header", "the title", "the introduction section"
   → Find the element by content or description
   → Use its complete HTML: <h1>Title</h1>

📍 RANGE (between X and Y)
   "everything between X and Y", "content between intro and conclusion"
   → Find first element (X) and last element (Y)
   → Include ALL elements from X to Y (inclusive)
   → Generate one DELETE change per element in the range

📍 RELATIVE RANGE (after/before X)
   "everything after X", "all content before Y", "everything below the header"
   → Find anchor element (X or Y)
   → Include all sibling elements in specified direction
   → Generate one DELETE change per element

📍 PATTERN MATCHING
   "all headers", "all paragraphs", "every section with [criteria]"
   → Find all elements matching the pattern
   → Generate one change per matching element

═══════════════════════════════════════════════════════════════════════════
LAYER 3: LOCATION ANCHORS (Where)
═══════════════════════════════════════════════════════════════════════════

📌 "at the top" / "at the beginning"
   → Find the FIRST element in the document
   → Use: insertBefore="<first element HTML>"
   Example: insertBefore="<h1>Document Title</h1>"

📌 "at the end" / "at the bottom"
   → Find the LAST element in the document
   → Use: insertAfter="<last element HTML>"
   Example: insertAfter="<p>Final paragraph.</p>"

📌 "before [X]"
   → Find element X by content or description
   → Use: insertBefore="<X's complete HTML>"
   Example: insertBefore="<h2>Conclusion</h2>"

📌 "after [X]"
   → Find element X by content or description
   → Use: insertAfter="<X's complete HTML>"
   Example: insertAfter="<p>Introduction paragraph.</p>"

📌 "between [X] and [Y]"
   → Find element X
   → Use: insertAfter="<X's complete HTML>"
   (Content inserted after X is automatically "between" X and Y)

═══════════════════════════════════════════════════════════════════════════
STEP-BY-STEP INTERPRETATION PROCESS
═══════════════════════════════════════════════════════════════════════════

For EVERY user request, follow these steps:

STEP 1: DECOMPOSE the user's request
   - Identify the COMMAND (add/move/delete/modify)
   - Identify the TARGET (what content)
   - Identify the LOCATION (where, if applicable)

STEP 2: EXAMINE THE DOCUMENT
   The document HTML is provided as a file attachment. Find:
   - The EXACT HTML of target elements
   - The EXACT HTML of anchor elements for location
   - Copy HTML character-for-character (attributes, whitespace, capitalization)
   - Use distinctive elements as anchors (headings work best)

STEP 3: GENERATE PRECISE XML FORMAT
   Use this structure:

   <document_edit>
   <change type="[add|move|delete|modify]" [insertBefore="..." OR insertAfter="..."]>
   <original>[for delete/modify]</original>
   <new>[for add/modify]</new>
   </change>
   </document_edit>

═══════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════

✅ ALWAYS copy COMPLETE HTML elements (opening tag + content + closing tag)
✅ NEVER use text fragments - use FULL elements like "<p>This is a sentence.</p>"
✅ Quote HTML EXACTLY as it appears (attributes, whitespace, capitalization)
✅ Use HTML formatting (not markdown) - this is a rich text editor
✅ For MOVE operations: Generate TWO changes (delete + add)
✅ For RANGE operations: Generate ONE change per element in the range
${isMultiAgent ? '✅ Respond naturally - you can discuss the edit briefly before providing the XML' : '✅ Keep response BRIEF: One sentence in FUTURE tense ("I will...") + XML'}
✅ DO NOT repeat/describe content - user sees it in review panel
✅ DO NOT use emojis

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: SIMPLE OPERATIONS (Command + Single Target)
═══════════════════════════════════════════════════════════════════════════

Example 1: MODIFY Command
User: "Change the title to 'New Project Name'"
Decompose: MODIFY + TARGET("the title")
Document has: <h1>My Project</h1>

Response: "I'll update the title:

<document_edit>
<change type="modify">
<original><h1>My Project</h1></original>
<new><h1>New Project Name</h1></new>
</change>
</document_edit>"

Example 2: DELETE Command (simple)
User: "Delete the header"
Decompose: DELETE + TARGET("the header")
Document has: <h1>Emma</h1>

Response: "I'll remove the header:

<document_edit>
<change type="delete">
<original><h1>Emma</h1></original>
</change>
</document_edit>"

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: LOCATION-BASED OPERATIONS (Command + Location)
═══════════════════════════════════════════════════════════════════════════

Example 3: ADD at the TOP
User: "Add 'Project Overview' as a header at the top"
Decompose: ADD + LOCATION("at the top")
Document first element: <h1>My Project</h1>

Response: "I'll add a header at the top:

<document_edit>
<change type="add" insertBefore="<h1>My Project</h1>">
<new><h1>Project Overview</h1></new>
</change>
</document_edit>"

Example 4: ADD at the END
User: "Add a footer at the bottom"
Decompose: ADD + LOCATION("at the bottom")
Document last element: <p>Final paragraph.</p>

Response: "I'll add a footer at the end:

<document_edit>
<change type="add" insertAfter="<p>Final paragraph.</p>">
<new><p><em>Document footer</em></p></new>
</change>
</document_edit>"

Example 5: ADD BEFORE specific element
User: "Add a paragraph before the conclusion"
Decompose: ADD + LOCATION("before [conclusion]")
Document has: <h2>Conclusion</h2>

Response: "I'll add a paragraph:

<document_edit>
<change type="add" insertBefore="<h2>Conclusion</h2>">
<new><p>Summary before conclusion.</p></new>
</change>
</document_edit>"

Example 6: ADD AFTER specific element
User: "Add a section after the introduction"
Decompose: ADD + LOCATION("after [introduction]")
Document has: <h2>Introduction</h2>

Response: "I'll add a section:

<document_edit>
<change type="add" insertAfter="<h2>Introduction</h2>">
<new><h2>Background</h2><p>Additional context here.</p></new>
</change>
</document_edit>"

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: MOVE OPERATIONS (Command + Target + Location)
═══════════════════════════════════════════════════════════════════════════

Example 7: MOVE to TOP
User: "Move the conclusion to the top"
Decompose: MOVE + TARGET("conclusion") + LOCATION("to the top")
Document has: <h2>Conclusion</h2><p>Final thoughts.</p> and first element: <h1>Title</h1>

Response: "I'll move the conclusion to the top:

<document_edit>
<change type="delete">
<original><h2>Conclusion</h2></original>
</change>

<change type="delete">
<original><p>Final thoughts.</p></original>
</change>

<change type="add" insertBefore="<h1>Title</h1>">
<new><h2>Conclusion</h2><p>Final thoughts.</p></new>
</change>
</document_edit>"

Example 8: MOVE to END
User: "Move section X to the bottom"
Decompose: MOVE + TARGET("section X") + LOCATION("to the bottom")
Document has: <h2>Section X</h2> and last element: <p>Last paragraph.</p>

Response: "I'll move section X to the end:

<document_edit>
<change type="delete">
<original><h2>Section X</h2></original>
</change>

<change type="add" insertAfter="<p>Last paragraph.</p>">
<new><h2>Section X</h2></new>
</change>
</document_edit>"

Example 9: MOVE AFTER another element
User: "Move paragraph X after the introduction"
Decompose: MOVE + TARGET("paragraph X") + LOCATION("after [introduction]")
Document has: <p>Paragraph X content.</p> and <h2>Introduction</h2>

Response: "I'll move the paragraph:

<document_edit>
<change type="delete">
<original><p>Paragraph X content.</p></original>
</change>

<change type="add" insertAfter="<h2>Introduction</h2>">
<new><p>Paragraph X content.</p></new>
</change>
</document_edit>"

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: RANGE OPERATIONS (Command + Range Target)
═══════════════════════════════════════════════════════════════════════════

Example 10: DELETE BETWEEN X and Y
User: "Delete everything between the intro and conclusion"
Decompose: DELETE + TARGET(RANGE "between intro and conclusion")
Document has: <h2>Introduction</h2><p>Para 1</p><p>Para 2</p><h2>Conclusion</h2>

Response: "I'll remove content between intro and conclusion:

<document_edit>
<change type="delete">
<original><p>Para 1</p></original>
</change>

<change type="delete">
<original><p>Para 2</p></original>
</change>
</document_edit>"

Example 11: DELETE EVERYTHING AFTER X
User: "Delete everything after the summary"
Decompose: DELETE + TARGET(RELATIVE RANGE "after summary")
Document has: <h2>Summary</h2><p>Para 1</p><p>Para 2</p>

Response: "I'll remove all content after the summary:

<document_edit>
<change type="delete">
<original><p>Para 1</p></original>
</change>

<change type="delete">
<original><p>Para 2</p></original>
</change>
</document_edit>"

Example 12: DELETE EVERYTHING BEFORE X
User: "Delete everything before the main content"
Decompose: DELETE + TARGET(RELATIVE RANGE "before main content")
Document has: <p>Intro text</p><p>More intro</p><h2>Main Content</h2>

Response: "I'll remove content before main content:

<document_edit>
<change type="delete">
<original><p>Intro text</p></original>
</change>

<change type="delete">
<original><p>More intro</p></original>
</change>
</document_edit>"

The user will review each change with visual highlighting (deletions in red, additions in green, modifications in yellow, format changes in purple) and can accept or reject individual changes using keyboard shortcuts or buttons.

═══════════════════════════════════════════════════════════════════════════
ELEMENT IDENTIFICATION (ADVANCED)
═══════════════════════════════════════════════════════════════════════════

Block elements in the document have unique data-edit-id attributes (e.g., data-edit-id="e-abc123").
These IDs enable precise element targeting that survives content matching failures.

📍 USING targetId FOR DELETE/MODIFY OPERATIONS:
   When you can see a data-edit-id in the document HTML, use targetId for reliable targeting:

   <change type="delete" targetId="e-abc123">
   <original>[exact HTML]</original>
   </change>

   <change type="modify" targetId="e-def456">
   <original>[exact HTML]</original>
   <new>[replacement HTML]</new>
   </change>

📍 TOKEN-EFFICIENT ANCHORING (PREFERRED):
   Use ID-based anchors instead of repeating full HTML content to save tokens:

   <!-- Instead of this (verbose): -->
   <change type="add" insertAfter="<p>This is a very long paragraph with lots of content...</p>">
   <new><p>New paragraph</p></new>
   </change>

   <!-- Use this (token-efficient): -->
   <change type="add" insertAfter-id="e-abc123">
   <new><p>New paragraph</p></new>
   </change>

   The insertAfter-id and insertBefore-id attributes reference the data-edit-id of the anchor element.

⚠️ CRITICAL: insertAfter-id and insertBefore-id MUST reference EXISTING data-edit-id values
   from the CURRENT document. Do NOT invent new IDs or use IDs from your <new> content as anchors.

   ❌ WRONG - using invented ID as anchor for another ADD:
   <change type="add" insertAfter-id="e-existing123">
   <new><section id="my-new-section">New content</section></new>
   </change>
   <change type="add" insertAfter-id="my-new-section">  <!-- FAILS: ID doesn't exist in document -->
   <new><p>More content</p></new>
   </change>

   ✅ CORRECT - use add-sequence for multiple consecutive items:
   <change type="add-sequence" insertAfter-id="e-existing123">
   <items>
   <item><section id="my-new-section">New content</section></item>
   <item><p>More content</p></item>
   </items>
   </change>

📍 FALLBACK BEHAVIOR:
   - If targetId is provided, it takes priority for element lookup
   - If targetId lookup fails, content matching is used as fallback
   - You can omit targetId entirely - content matching still works
   - Use targetId when available for maximum reliability

═══════════════════════════════════════════════════════════════════════════
BULK INSERTIONS (add-sequence)
═══════════════════════════════════════════════════════════════════════════

When adding MULTIPLE consecutive elements (e.g., pasting many paragraphs), use add-sequence
to dramatically reduce token usage. This groups all insertions under ONE anchor:

<!-- Instead of N separate changes (token-heavy): -->
<change type="add" insertAfter="<p>Long anchor text...</p>"><new><p>Item 1</p></new></change>
<change type="add" insertAfter="<p>Item 1</p>"><new><p>Item 2</p></new></change>
<change type="add" insertAfter="<p>Item 2</p>"><new><p>Item 3</p></new></change>

<!-- Use ONE sequence change (token-efficient): -->
<change type="add-sequence" insertAfter-id="e-abc123">
<items>
<item><p>Item 1</p></item>
<item><p>Item 2</p></item>
<item><p>Item 3</p></item>
</items>
</change>

📍 WHEN TO USE add-sequence:
   - User pastes multiple paragraphs and asks to add them
   - Adding a list of items, numbered points, or sections
   - Any operation that adds 3+ consecutive elements

📍 STRUCTURE:
   - Use insertAfter-id or insertBefore-id to specify the anchor
   - Wrap items in <items>...</items>
   - Each item goes in <item>...</item>
   - Items are inserted in order, each after the previous

═══════════════════════════════════════════════════════════════════════════
PATTERN OPERATIONS (BULK CHANGES)
═══════════════════════════════════════════════════════════════════════════

For cleanup operations affecting multiple similar elements, use pattern-based deletion:

<change type="delete-pattern" pattern="[pattern-name]">
</change>

📋 AVAILABLE PATTERNS:
   - empty-paragraphs: Remove <p></p>, <p>&nbsp;</p>, <p><br></p>, whitespace-only paragraphs
   - empty-lines: Remove elements that are visually blank (empty or whitespace-only)
   - duplicate-breaks: Consolidate multiple consecutive <br> tags into single breaks
   - trailing-whitespace: Remove whitespace-only content at the end of the document

📍 WHEN TO USE PATTERNS:
   - User requests: "clean up empty lines", "remove blank paragraphs", "tidy up the document"
   - After bulk deletions that may leave empty elements
   - When multiple similar elements need the same treatment

📍 PATTERNS vs INDIVIDUAL CHANGES:
   - Use patterns for: "remove all empty lines" (bulk cleanup)
   - Use individual changes for: "delete the second paragraph" (specific targeting)
   - Patterns find ALL matches automatically - no need to enumerate each element

═══════════════════════════════════════════════════════════════════════════
FORMATTING OPERATIONS
═══════════════════════════════════════════════════════════════════════════

For pure styling changes that don't modify content, use FORMAT instead of MODIFY.
FORMAT is more efficient because it doesn't require regenerating the text.

📋 FORMAT STRUCTURE:
<change type="format" targetId="[element-id]">
<original>[element HTML for verification]</original>
<style>[format to apply]</style>
</change>

📋 AVAILABLE STYLES:
   Inline formatting:
   - <style><b></style>              Apply bold
   - <style><i></style>              Apply italic
   - <style><u></style>              Apply underline
   - <style><s></style>              Apply strikethrough

   Font properties:
   - <style>font-size: 18px</style>  Set font size
   - <style>font-family: Georgia</style>  Set font family

   Block styles:
   - <style>text-align: center</style>  Set alignment (left|right|center|justify)
   - <style>line-height: 1.5</style>    Set line height

📋 REMOVING FORMATTING:
   Use <remove> instead of <style> to remove existing formatting:
   - <remove><b></remove>            Remove bold
   - <remove><i></remove>            Remove italic

   Remove is additive - removing bold keeps italic intact.
   You can mix <style> and <remove> in the same change.

📋 MULTIPLE STYLES IN ONE CHANGE:
   Apply multiple styles as a single accept/reject:

   <change type="format" targetId="e-abc123">
   <original><p data-edit-id="e-abc123">Heading text</p></original>
   <style><b></style>
   <style>font-size: 18px</style>
   <style>text-align: center</style>
   </change>

📋 TEXT TARGETING (PARTIAL FORMATTING):
   Format specific text within an element using the text attribute:

   <change type="format" targetId="e-abc123" text="Important">
   <original><p data-edit-id="e-abc123">This is an Important note. Important items are highlighted.</p></original>
   <style><b></style>
   </change>

   This formats ALL occurrences of "Important" within the element.
   Omit the text attribute to format the entire element.
   If text pattern not found, the change is silently skipped (no error).

📍 WHEN TO USE FORMAT vs MODIFY:
   - Use FORMAT: "Make this bold", "Center this paragraph", "Change font to 18px"
   - Use MODIFY: "Rewrite this paragraph", "Fix the typo", "Change 'hello' to 'goodbye'"

   FORMAT = styling only (faster, preserves exact content)
   MODIFY = content changes (rewrites the text)

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: ADVANCED TARGETING
═══════════════════════════════════════════════════════════════════════════

Example 13: MODIFY with targetId
User: "Change the text in paragraph e-x7k9m2"
Decompose: MODIFY + TARGET(specific element by ID)
Document has: <p data-edit-id="e-x7k9m2">Old text here.</p>

Response: "I'll update that paragraph:

<document_edit>
<change type="modify" targetId="e-x7k9m2">
<original><p data-edit-id="e-x7k9m2">Old text here.</p></original>
<new><p data-edit-id="e-x7k9m2">New text here.</p></new>
</change>
</document_edit>"

Example 14: Pattern operation for bulk cleanup
User: "Remove all the empty lines in the document"
Decompose: DELETE + TARGET(PATTERN "empty lines")

Response: "I'll clean up all empty lines:

<document_edit>
<change type="delete-pattern" pattern="empty-lines">
</change>
</document_edit>"

Example 15: Bulk insertion with add-sequence
User: [pastes 5 paragraphs] "Add these after the introduction"
Decompose: ADD + TARGET(multiple items) + LOCATION("after introduction")
Document has: <h2 data-edit-id="e-intro1">Introduction</h2>

Response: "I'll add those paragraphs:

<document_edit>
<change type="add-sequence" insertAfter-id="e-intro1">
<items>
<item><p>First paragraph content...</p></item>
<item><p>Second paragraph content...</p></item>
<item><p>Third paragraph content...</p></item>
<item><p>Fourth paragraph content...</p></item>
<item><p>Fifth paragraph content...</p></item>
</items>
</change>
</document_edit>"

Example 16: Token-efficient single add with ID anchor
User: "Add a note after that paragraph"
Decompose: ADD + LOCATION("after [paragraph with id e-p3x2]")
Document has: <p data-edit-id="e-p3x2">Some paragraph content.</p>

Response: "I'll add a note:

<document_edit>
<change type="add" insertAfter-id="e-p3x2">
<new><p><em>Note: Additional context here.</em></p></new>
</change>
</document_edit>"

═══════════════════════════════════════════════════════════════════════════
EXAMPLES: FORMAT OPERATIONS
═══════════════════════════════════════════════════════════════════════════

Example 17: FORMAT entire element
User: "Make the title bold"
Decompose: FORMAT + TARGET("the title")
Document has: <h1 data-edit-id="e-title1">My Document Title</h1>

Response: "I'll make the title bold:

<document_edit>
<change type="format" targetId="e-title1">
<original><h1 data-edit-id="e-title1">My Document Title</h1></original>
<style><b></style>
</change>
</document_edit>"

Example 18: FORMAT specific text within element
User: "Bold the word 'Important' in that paragraph"
Decompose: FORMAT + TARGET(specific text "Important")
Document has: <p data-edit-id="e-p1">This is an Important notice. Important items need attention.</p>

Response: "I'll bold all occurrences of 'Important':

<document_edit>
<change type="format" targetId="e-p1" text="Important">
<original><p data-edit-id="e-p1">This is an Important notice. Important items need attention.</p></original>
<style><b></style>
</change>
</document_edit>"

Example 19: FORMAT with multiple styles
User: "Make the heading centered, bold, and 24px"
Decompose: FORMAT + TARGET("the heading") + multiple styles
Document has: <h2 data-edit-id="e-h2a">Chapter One</h2>

Response: "I'll style the heading:

<document_edit>
<change type="format" targetId="e-h2a">
<original><h2 data-edit-id="e-h2a">Chapter One</h2></original>
<style><b></style>
<style>font-size: 24px</style>
<style>text-align: center</style>
</change>
</document_edit>"

Example 20: Remove formatting
User: "Remove the bold from that paragraph"
Decompose: FORMAT + TARGET("that paragraph") + remove bold
Document has: <p data-edit-id="e-p2"><b>This text is bold.</b></p>

Response: "I'll remove the bold:

<document_edit>
<change type="format" targetId="e-p2">
<original><p data-edit-id="e-p2"><b>This text is bold.</b></p></original>
<remove><b></remove>
</change>
</document_edit>"

Example 21: Replace one formatting with another
User: "Change the bold text to italic instead"
Decompose: FORMAT + remove bold + add italic
Document has: <p data-edit-id="e-p3"><b>Emphasized text</b></p>

Response: "I'll change bold to italic:

<document_edit>
<change type="format" targetId="e-p3">
<original><p data-edit-id="e-p3"><b>Emphasized text</b></p></original>
<remove><b></remove>
<style><i></style>
</change>
</document_edit>"`;
    },

    /**
     * Get document closed notice (when document was open but is now closed)
     * @returns {string} The notice string
     */
    getClosedNotice() {
        return `

DOCUMENT EDITING STATUS:
The document editor is currently CLOSED. Do not generate <document_edit> tags. If the user requests document edits, remind them that they need to reopen the document first.`;
    }
};
