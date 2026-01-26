# Phase 1: Claude Changes Overhaul - Context

**Gathered:** 2025-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the reliability, completeness, and speed of the Claude Changes infrastructure. **No UI changes** — keep the existing review panel, keyboard shortcuts, and workflow exactly as they are. Focus purely on the underlying engine.

</domain>

<decisions>
## Implementation Decisions

### Element Identification
- Add stable `data-edit-id` attributes to document elements
- IDs persist in saved documents (stored with HTML content)
- Support hybrid targeting: accept both ID-based and content-based changes
- If element can't be located: skip with warning (don't fail entire batch)

### Batch Processing
- "Accept All" applies instantly with single DOM rebuild
- Sequential review: keep immediate rebuild (current behavior)
- Per-change undo: user can undo individual accept/reject decisions during review
- No multi-select UI — keep sequential review or all-at-once

### Pattern Operations
- Claude generates pattern type (e.g., `delete-pattern: empty-paragraphs`)
- Client finds ALL matching elements (not relying on Claude to list each one)
- Pattern matches shown as single grouped change ("Delete 12 empty paragraphs")
- Highlight all matching elements in document before accepting
- Extensible pattern system — support custom patterns via selector or regex

### Claude's Discretion
- When to assign element IDs (on document open vs before sending to Claude)
- Internal data structures for change tracking
- Optimization strategies for DOM operations
- Pattern syntax/format details

</decisions>

<specifics>
## Specific Ideas

- Current content-matching is fragile — whitespace, attributes, browser normalization cause failures
- "Remove all empty lines" should actually remove ALL empty lines, not just the ones Claude happened to identify
- The existing review panel UI works well — don't change how it looks or operates
- Speed matters — accepting 10+ changes should feel instant

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-claude-changes-overhaul*
*Context gathered: 2025-01-25*
