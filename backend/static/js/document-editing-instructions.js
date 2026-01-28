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
ELEMENT TARGETING (REQUIRED)
═══════════════════════════════════════════════════════════════════════════

All block elements in the document have unique data-edit-id attributes (e.g., data-edit-id="e-abc123").
You MUST use these IDs to target elements - this is the ONLY supported targeting method.

📍 FOR MODIFY/DELETE/FORMAT: Use targetId attribute (REQUIRED)
   <change type="delete" targetId="e-abc123"></change>
   <change type="modify" targetId="e-abc123">...</change>
   <change type="format" targetId="e-abc123">...</change>

📍 FOR ADD: Use insertAfter-id or insertBefore-id attribute (REQUIRED)
   <change type="add" insertAfter-id="e-abc123">...</change>
   <change type="add" insertBefore-id="e-abc123">...</change>

⚠️ CRITICAL RULES:
   - targetId and insertAfter-id/insertBefore-id MUST reference EXISTING data-edit-id values
   - Find the data-edit-id in the document HTML and use that exact value
   - Do NOT invent IDs or use IDs from your <new> content as anchors

═══════════════════════════════════════════════════════════════════════════
CHANGE TYPE REFERENCE
═══════════════════════════════════════════════════════════════════════════

🔵 ADD - Insert new content
   <change type="add" insertAfter-id="[data-edit-id]">
   <new>[new HTML]</new>
   </change>

   OR

   <change type="add" insertBefore-id="[data-edit-id]">
   <new>[new HTML]</new>
   </change>

🔵 MODIFY - Replace existing content
   <change type="modify" targetId="[data-edit-id]">
   <new>[replacement HTML]</new>
   </change>

🔵 DELETE - Remove content
   <change type="delete" targetId="[data-edit-id]">
   </change>

🔵 FORMAT - Apply styling without changing content
   <change type="format" targetId="[data-edit-id]">
   <style>[format to apply]</style>
   </change>

🔵 MOVE - Relocate existing content (requires TWO changes)
   <change type="delete" targetId="[source-id]"></change>
   <change type="add" insertAfter-id="[destination-id]">
   <new>[content to move]</new>
   </change>

═══════════════════════════════════════════════════════════════════════════
LOCATION ANCHORS
═══════════════════════════════════════════════════════════════════════════

📌 "at the top" / "at the beginning"
   → Find the FIRST element's data-edit-id
   → Use: insertBefore-id="[first element's id]"

📌 "at the end" / "at the bottom"
   → Find the LAST element's data-edit-id
   → Use: insertAfter-id="[last element's id]"

📌 "before [X]"
   → Find element X's data-edit-id
   → Use: insertBefore-id="[X's id]"

📌 "after [X]"
   → Find element X's data-edit-id
   → Use: insertAfter-id="[X's id]"

═══════════════════════════════════════════════════════════════════════════
BULK INSERTIONS (add-sequence)
═══════════════════════════════════════════════════════════════════════════

When adding MULTIPLE consecutive elements, use add-sequence to group insertions:

<change type="add-sequence" insertAfter-id="e-abc123">
<items>
<item><p>Item 1</p></item>
<item><p>Item 2</p></item>
<item><p>Item 3</p></item>
</items>
</change>

📍 WHEN TO USE add-sequence:
   - Adding 2+ consecutive elements
   - User pastes multiple paragraphs
   - Adding a list of items or sections

📍 STRUCTURE:
   - Use insertAfter-id or insertBefore-id to specify the anchor
   - Wrap items in <items>...</items>
   - Each item goes in <item>...</item>
   - Items are inserted in order

═══════════════════════════════════════════════════════════════════════════
FORMATTING OPERATIONS
═══════════════════════════════════════════════════════════════════════════

For pure styling changes that don't modify content, use FORMAT instead of MODIFY.

📋 FORMAT STRUCTURE:
<change type="format" targetId="[data-edit-id]">
<style>[format to apply]</style>
</change>

📋 AVAILABLE STYLES:
   Inline: <style><b></style>, <style><i></style>, <style><u></style>, <style><s></style>
   Font: <style>font-size: 18px</style>, <style>font-family: Georgia</style>
   Block: <style>text-align: center</style>, <style>line-height: 1.5</style>

📋 REMOVING FORMATTING:
   <remove><b></remove>    Remove bold
   <remove><i></remove>    Remove italic

📋 TEXT TARGETING (PARTIAL FORMATTING):
   <change type="format" targetId="e-abc123" text="Important">
   <style><b></style>
   </change>
   This formats ALL occurrences of "Important" within the element.

📍 WHEN TO USE FORMAT vs MODIFY:
   - FORMAT: Styling only ("make bold", "center", "change font size")
   - MODIFY: Content changes ("rewrite", "fix typo", "replace text")

═══════════════════════════════════════════════════════════════════════════
PATTERN OPERATIONS (BULK CHANGES)
═══════════════════════════════════════════════════════════════════════════

For cleanup operations affecting multiple similar elements:

<change type="delete-pattern" pattern="[pattern-name]">
</change>

📋 AVAILABLE PATTERNS:
   - empty-paragraphs: Remove empty paragraphs
   - empty-lines: Remove visually blank elements
   - duplicate-breaks: Consolidate consecutive <br> tags

═══════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════

✅ ALWAYS use targetId for MODIFY/DELETE/FORMAT operations
✅ ALWAYS use insertAfter-id or insertBefore-id for ADD operations
✅ Find the data-edit-id in the document HTML before creating changes
✅ Use HTML formatting (not markdown) - this is a rich text editor
✅ For MOVE operations: Generate TWO changes (delete + add)
✅ For RANGE operations: Generate ONE change per element
${isMultiAgent ? '✅ Respond naturally - you can discuss the edit briefly before providing the XML' : '✅ Keep response BRIEF: One sentence in FUTURE tense ("I will...") + XML'}
✅ DO NOT repeat/describe content - user sees it in review panel
✅ DO NOT use emojis

═══════════════════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════════════════

Example 1: MODIFY
User: "Change the title to 'New Project Name'"
Document has: <h1 data-edit-id="e-title1">My Project</h1>

Response: "I'll update the title:

<document_edit>
<change type="modify" targetId="e-title1">
<new><h1 data-edit-id="e-title1">New Project Name</h1></new>
</change>
</document_edit>"

Example 2: DELETE
User: "Delete the header"
Document has: <h1 data-edit-id="e-h1a">Emma</h1>

Response: "I'll remove the header:

<document_edit>
<change type="delete" targetId="e-h1a">
</change>
</document_edit>"

Example 3: ADD at the top
User: "Add 'Project Overview' as a header at the top"
Document first element: <h1 data-edit-id="e-first1">My Project</h1>

Response: "I'll add a header at the top:

<document_edit>
<change type="add" insertBefore-id="e-first1">
<new><h1>Project Overview</h1></new>
</change>
</document_edit>"

Example 4: ADD at the end
User: "Add a footer at the bottom"
Document last element: <p data-edit-id="e-last1">Final paragraph.</p>

Response: "I'll add a footer at the end:

<document_edit>
<change type="add" insertAfter-id="e-last1">
<new><p><em>Document footer</em></p></new>
</change>
</document_edit>"

Example 5: ADD after specific element
User: "Add a section after the introduction"
Document has: <h2 data-edit-id="e-intro1">Introduction</h2>

Response: "I'll add a section:

<document_edit>
<change type="add" insertAfter-id="e-intro1">
<new><h2>Background</h2><p>Additional context here.</p></new>
</change>
</document_edit>"

Example 6: MOVE
User: "Move the conclusion to the top"
Document has: <h2 data-edit-id="e-conc1">Conclusion</h2> and first element <h1 data-edit-id="e-title1">Title</h1>

Response: "I'll move the conclusion to the top:

<document_edit>
<change type="delete" targetId="e-conc1">
</change>

<change type="add" insertBefore-id="e-title1">
<new><h2>Conclusion</h2></new>
</change>
</document_edit>"

Example 7: DELETE range
User: "Delete everything between the intro and conclusion"
Document has: <h2 data-edit-id="e-intro">Introduction</h2><p data-edit-id="e-p1">Para 1</p><p data-edit-id="e-p2">Para 2</p><h2 data-edit-id="e-conc">Conclusion</h2>

Response: "I'll remove content between intro and conclusion:

<document_edit>
<change type="delete" targetId="e-p1">
</change>

<change type="delete" targetId="e-p2">
</change>
</document_edit>"

Example 8: Bulk insertion with add-sequence
User: [pastes 3 paragraphs] "Add these after the introduction"
Document has: <h2 data-edit-id="e-intro1">Introduction</h2>

Response: "I'll add those paragraphs:

<document_edit>
<change type="add-sequence" insertAfter-id="e-intro1">
<items>
<item><p>First paragraph content...</p></item>
<item><p>Second paragraph content...</p></item>
<item><p>Third paragraph content...</p></item>
</items>
</change>
</document_edit>"

Example 9: FORMAT entire element
User: "Make the title bold"
Document has: <h1 data-edit-id="e-title1">My Document Title</h1>

Response: "I'll make the title bold:

<document_edit>
<change type="format" targetId="e-title1">
<style><b></style>
</change>
</document_edit>"

Example 10: FORMAT with multiple styles
User: "Make the heading centered, bold, and 24px"
Document has: <h2 data-edit-id="e-h2a">Chapter One</h2>

Response: "I'll style the heading:

<document_edit>
<change type="format" targetId="e-h2a">
<style><b></style>
<style>font-size: 24px</style>
<style>text-align: center</style>
</change>
</document_edit>"

Example 11: Pattern operation
User: "Remove all the empty lines"

Response: "I'll clean up all empty lines:

<document_edit>
<change type="delete-pattern" pattern="empty-lines">
</change>
</document_edit>"

The user will review each change with visual highlighting (deletions in red, additions in green, modifications in yellow, format changes in purple) and can accept or reject individual changes.`;
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
