---
phase: 01-claude-changes-overhaul
plan: 05
subsystem: api
tags: [system-prompt, claude-instructions, document-editing, element-ids, pattern-operations]

# Dependency graph
requires:
  - phase: 01-01
    provides: ElementIds module with data-edit-id attributes
  - phase: 01-04
    provides: PatternMatcher module with pattern operations
provides:
  - Updated system prompt with element ID targeting instructions
  - Pattern operation syntax documentation for Claude
  - Examples demonstrating targetId and delete-pattern usage
affects: [document-editing, claude-responses, user-experience]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Element ID targeting via targetId attribute in change XML"
    - "Pattern-based bulk operations via delete-pattern syntax"

key-files:
  created: []
  modified:
    - backend/static/js/chat.js

key-decisions:
  - "Added targetId for delete/modify, anchorTargetId for add operations"
  - "Documented four pattern types: empty-paragraphs, empty-lines, duplicate-breaks, trailing-whitespace"
  - "Positioned element ID targeting as 'advanced' feature with content matching as fallback"

patterns-established:
  - "System prompt sections: ELEMENT IDENTIFICATION (ADVANCED) and PATTERN OPERATIONS (BULK CHANGES)"
  - "Example numbering: 13-14 for advanced targeting examples"

# Metrics
duration: 4min
completed: 2026-01-26
---

# Phase 1 Plan 05: System Prompt Update Summary

**Claude system prompt extended with element ID targeting (targetId/anchorTargetId) and pattern operations (delete-pattern) for reliable document editing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-26T07:18:35Z
- **Completed:** 2026-01-26T07:22:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added ELEMENT IDENTIFICATION (ADVANCED) section explaining data-edit-id attributes and targetId usage
- Added PATTERN OPERATIONS (BULK CHANGES) section with delete-pattern syntax and available patterns
- Added Example 13 demonstrating MODIFY with targetId for specific element targeting
- Added Example 14 demonstrating pattern operation for bulk cleanup (empty-lines)

## Task Commits

Each task was committed atomically (both tasks in single commit since they modify the same section):

1. **Task 1: Add element ID targeting instructions** - `27e5b51` (feat)
2. **Task 2: Add examples showing targetId usage** - `27e5b51` (feat)

**Note:** Tasks were combined into single commit as they add related content to the same file section.

## Files Created/Modified
- `backend/static/js/chat.js` - Updated documentEditingInstructions with element ID targeting and pattern operations (+87 lines)

## Decisions Made
- **Positioned element ID targeting as "advanced" feature:** Content matching remains the primary method, with targetId providing enhanced reliability when element IDs are visible
- **Documented fallback behavior explicitly:** Claude instructed that targetId takes priority but content matching serves as fallback
- **Used anchorTargetId for add operations:** Separate attribute name distinguishes anchor element targeting from target element targeting
- **Listed all four available patterns:** empty-paragraphs, empty-lines, duplicate-breaks, trailing-whitespace
- **Provided clear guidance on patterns vs individual changes:** Patterns for bulk cleanup, individual changes for specific targeting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- System prompt now instructs Claude on all Phase 1 features (element IDs, hybrid resolution, batch ops, pattern operations)
- Claude will include targetId when visible in document HTML
- Claude will use delete-pattern syntax for bulk cleanup requests
- Ready for integration testing across all Phase 1 components

---
*Phase: 01-claude-changes-overhaul*
*Completed: 2026-01-26*
