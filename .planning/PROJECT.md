# Apprised Chat

## What This Is

A Flask-based chat application that provides a rich interface for conversing with Claude (Anthropic API). Features include a Squire-based document editor, Google Drive integration, system prompt management, multi-agent orchestration, and file attachments with screenshare support.

## Core Value

Enable users to have productive conversations with Claude while seamlessly editing documents based on Claude's suggestions.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- Chat interface with streaming responses from Claude API
- Rich text document editor (Squire) with formatting toolbar
- Google Drive integration for document sync
- System prompts management and selection
- Multi-agent chat orchestration
- File upload and paste handling
- Screenshare/screenshot capture
- Document context injection into chat
- Claude document editing via XML change format

### Active

<!-- Current scope. Building toward these. -->

- [ ] Robust and reliable Claude Changes system
- [ ] Fast batch operations for accept/reject
- [ ] Pattern-based bulk operations (remove all empty lines, etc.)
- [ ] Stable element identification (not content-matching)

### Out of Scope

- Mobile app — web-first approach
- Real-time collaboration — single-user focus
- Offline support — requires API connectivity

## Context

The Claude Changes feature allows Claude to propose structured edits to documents using XML format. The current implementation has reliability issues:
- Content matching is fragile (whitespace, attributes cause failures)
- Each accept/reject rebuilds entire document (slow)
- Bulk operations require Claude to generate individual changes (incomplete)

Codebase analysis available in `.planning/codebase/`.

## Constraints

- **Tech stack**: Python/Flask backend, vanilla JavaScript frontend, Squire editor
- **No frameworks**: Must work with existing module pattern architecture
- **Browser storage**: localStorage for persistence (no server-side database)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Squire for rich text | Already integrated, works well | ✓ Good |
| XML format for changes | Structured, parseable by both sides | ⚠️ Revisit (fragile matching) |

---
*Last updated: 2025-01-25 after codebase mapping*
