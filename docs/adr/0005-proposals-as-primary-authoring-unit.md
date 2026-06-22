# ADR-0005: Proposals as the Primary Authoring Unit

**Status:** Accepted
**Date:** 2026-06-22
**Agreed by:** Claude (Sonnet 4.6) + Codex, project owner

---

## Context

Task 0002 delivered a working UI shell, proposal review surface, tracker rebuild, and session-close flow. It did not settle the long-term authoring model for future chapter content.

The current `Chapters` workspace can edit a transient planning draft, but that model sits awkwardly beside the existing proposal pipeline, which is already the system's strongest governance mechanism:

- schema validation
- policy validation
- explicit review state
- explicit promotion gate

The project needed a clear rule for which kinds of authored content must go through proposals, and which kinds of content may be authored directly inside a chapter planning workspace.

Without this decision, the UI would either:

- duplicate authoring models unnecessarily, or
- weaken the governance boundary by letting promoted corpus content bypass the proposal lifecycle

---

## Decision

**Proposals are the primary authoring unit for any content that becomes a promoted corpus entity.**

**Chapter-local assembly data may be authored directly in the chapter plan without going through the full proposal lifecycle.**

This creates a deliberate split:

### Content that must begin as a proposal

Any new artifact that becomes part of the promoted corpus tree must begin life as a proposal record.

Examples:

- NPCs
- places
- factions
- items
- chapter outlines
- scenes treated as promoted corpus entities
- other reusable entities that are meant to outlive a single chapter plan

### Content that may be authored directly in the chapter plan

Operational, chapter-local assembly data does not require a proposal when it is not intended to become a standalone promoted corpus entity.

Examples:

- beat ordering
- trigger conditions
- chapter-local framing metadata
- handout labels or operational notes that are not standalone corpus records
- chapter-specific joins and ordering data

This is not an escape hatch from governance. It is recognition that the chapter plan is its own first-class authoring artifact with a different purpose from promoted corpus content.

---

## Rationale

### Why proposals remain primary for corpus content

- They preserve a single governance path for AI-authored and hand-authored content.
- They keep review and promotion explicit.
- They align the UI with the lifecycle contract from ADR-0001.
- They prevent the UI from creating a second, weaker route into the corpus.

### Why chapter-local data is treated differently

- Chapter planning needs a mutable assembly surface.
- Not every piece of chapter prep deserves the full proposal/review/promote lifecycle.
- Requiring proposals for every ordering or trigger tweak would make planning unworkably heavy.
- The chapter plan is a composition artifact, not a canonical lore record.

---

## Consequences

- The proposal UI is the primary creation and editing surface for promoted corpus content.
- The chapter composition workspace can author local assembly data directly, but it should not create promoted corpus entities by bypassing proposals.
- Task 0003 (proposal authoring and review UI) must cover the entity types that are expected to become promoted corpus records.
- Task 0004 (chapter composition workspace) must clearly distinguish:
  - proposal-backed/prompted corpus artifacts
  - chapter-local assembly data

---

## Guardrails

- Direct editing of promoted corpus content may still exist as a maintenance tool, but it is not the primary authoring model for new content.
- The chapter plan must not silently mint new promoted corpus entities.
- If chapter-local data later proves reusable and worthy of promotion, it should be promoted through an explicit proposal-backed path rather than by reclassifying a plan artifact in place.

---

## Not in scope

- Where chapter composition data is stored before materialisation
- Whether reviewed-but-unpromoted artifacts can participate in a draft chapter plan
- Final UX layout for the authoring workspace

Those decisions belong to ADR-0006 and follow-on task specs.
