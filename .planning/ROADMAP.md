# Roadmap: Apprised Chat

**Created:** 2025-01-25
**Milestone:** v1.1 — Claude Changes Reliability

## Overview

| Phase | Name | Goal | Status |
|-------|------|------|--------|
| 1 | Claude Changes Overhaul | Make document editing robust, reliable, and fast | Planning Complete |

## Phases

### Phase 1: Claude Changes Overhaul

**Goal:** Transform the Claude Changes system from fragile content-matching to robust element-based operations with fast batch processing.

**Requirements covered:**
- Batch accept/reject operations (single DOM rebuild)
- Stable element IDs for reliable targeting
- Client-side pattern operations for bulk changes
- Diff-based approach for large edits

**Success criteria:**
1. User can accept/reject 10+ changes without noticeable delay
2. "Remove all empty lines" removes ALL empty lines, not just those Claude identified
3. Changes targeting specific elements work even after document modifications
4. Large document rewrites show accurate diffs automatically

**Depends on:** None (first phase)

**Plans:** 5 plans

Plans:
- [ ] 01-01-PLAN.md — Stable element ID infrastructure (Wave 1)
- [ ] 01-02-PLAN.md — Hybrid change resolution with fallback (Wave 2)
- [ ] 01-03-PLAN.md — Batch DOM operations for Accept All (Wave 2)
- [ ] 01-04-PLAN.md — Client-side pattern matching system (Wave 3)
- [ ] 01-05-PLAN.md — System prompt update for targetId and patterns (Wave 3)

---

*Roadmap created: 2025-01-25*
*Milestone: v1.1 — Claude Changes Reliability*
