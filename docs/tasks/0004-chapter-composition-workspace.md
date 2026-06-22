# Task 0004: Chapter Composition Workspace

Status: Ready for development

## Goal

Build the chapter planning workspace that assembles promoted proposal-backed artifacts plus chapter-local assembly data into a materialisable chapter plan.

This task replaces the current draft-blob editing direction with an explicit composition workflow.

## Architectural decisions in force

- **ADR-0006** — Chapter composition data lives at `corpus/state/chapters/<id>/plan.json`
- **ADR-0005** — Promoted corpus content enters via proposals; chapter-local assembly data may be authored directly in the plan
- **ADR-0001** — Chapter composition sits between `promoted` and `materialised` as a planning/composition sub-phase
- **ADR-0003** — The chapter workspace reads and writes through `/api/v1/` only
- **RFC-0004** — Chapter authoring is composition, not blob editing

## Design constraints

- The chapter plan is a first-class planning artifact, distinct from both promoted corpus entities and tracker runtime state
- The tracker must not read `plan.json` directly
- The chapter workspace must not silently mint promoted corpus entities by bypassing proposal flows
- The UI is an API consumer only — it never writes plan files directly to disk
- Materialisation is explicit, not inferred from save/navigation events
- The workspace must clearly distinguish:
  - proposal-backed/promoted artifacts
  - chapter-local assembly data
  - materialised state outputs

## Pre-dev decisions — resolved

### 1. Where does the chapter plan live?

`corpus/state/chapters/<id>/plan.json`

This is a planning/composition input, not live tracker state.

### 2. What belongs in the chapter plan?

The plan stores:
- references to promoted chapter-relevant artifacts
- chapter-local ordering
- chapter-local joins
- operational planning metadata
- materialisation-ready chapter structure

### 3. What remains open?

The exact `plan.json` schema and the exact rules for reviewed-but-unpromoted artifact inclusion remain task-level implementation decisions and should be specified before coding starts.

---

## Epic Breakdown

### Epic 1 — Chapter plan API contract

Define and expose the REST contract for reading and writing chapter plans.

Acceptance criteria:
- The UI can load a chapter plan through `/api/v1/`
- The UI can create or update a chapter plan through `/api/v1/`
- The contract distinguishes plan data from materialised state data
- Missing-plan cases are handled cleanly
- Tests cover read/write behavior for `plan.json`

### Epic 2 — Chapter composition workspace

Build the planning surface around composition, not freeform blob editing.

Acceptance criteria:
- The DM can open a chapter workspace for a target chapter
- The workspace shows:
  - promoted proposal-backed inputs available to the chapter
  - current chapter plan structure
  - chapter-local assembly data
- The DM can attach and detach proposal-backed pieces
- The DM can order scenes and other chapter elements explicitly
- The workspace makes it obvious what is reusable corpus content versus chapter-local structure

### Epic 3 — Join editing

Make joins first-class operator actions.

Acceptance criteria:
- The DM can create and edit joins such as:
  - scene ↔ NPC
  - scene ↔ place
  - scene ↔ handout
  - beat ↔ scene
  - beat/scene ↔ thread
- Join editing is exposed as structured UI operations, not raw metadata text editing by default
- The plan persists those joins in a stable machine-readable shape

### Epic 4 — Chapter-local assembly authoring

Support direct editing of chapter-local planning data in the plan.

Acceptance criteria:
- The DM can edit chapter-local assembly data such as:
  - beat ordering
  - trigger conditions
  - chapter-local framing metadata
  - operational handout labels or notes that are not standalone corpus entities
- These edits do not create promoted corpus content implicitly
- The workspace preserves the distinction between local planning data and proposal-backed inputs

### Epic 5 — Materialisation flow

Turn the chapter plan into the explicit upstream input for chapter state generation.

Acceptance criteria:
- The DM can trigger materialisation explicitly from the chapter workspace
- Materialisation reads the chapter plan and produces the expected chapter state outputs
- The UI shows materialisation success/failure clearly
- The resulting chapter state can be inspected and then consumed by the tracker
- The workspace makes clear that materialisation is a one-way derivation into tracker-facing state

### Epic 6 — Transitional cleanup of the current chapter draft UX

Remove or de-emphasise the parts of the current chapter editor that imply the old draft-blob model is the future.

Acceptance criteria:
- The primary chapter planning path is the chapter composition workspace
- Legacy draft editing is either removed or clearly marked as transitional/secondary
- The chapter route no longer suggests that raw draft blob editing is the preferred authoring model

---

## Done When

- The DM can build a chapter plan from promoted proposal-backed artifacts
- The DM can author chapter-local assembly data directly in the plan
- The DM can create and maintain the joins needed for chapter structure
- The chapter plan is stored and read as a first-class artifact at `corpus/state/chapters/<id>/plan.json`
- Materialisation explicitly derives tracker-facing chapter state from the chapter plan

## Out of scope

- Proposal-backed corpus authoring itself
- Tracker redesign beyond what is required to consume materialised state
- Final map/corpus integration
- Broad direct corpus editing outside proposal-backed flows

## Notes

This task should not collapse back into “better draft JSON editing.” If an implementation path starts centering the UX on mutating one large transient blob, it is missing the architectural point of the ADRs.

The chapter workspace should feel like structured assembly of known pieces, not like an untyped mini-CMS.

## Related

- [ADR-0001 — Lifecycle State Contract](../adr/0001-lifecycle-state-contract.md)
- [ADR-0003 — REST API as Primary Interface](../adr/0003-rest-api-as-primary-interface.md)
- [ADR-0005 — Proposals as the Primary Authoring Unit](../adr/0005-proposals-as-primary-authoring-unit.md)
- [ADR-0006 — Chapter Composition Model](../adr/0006-chapter-composition-model.md)
- [RFC-0004 — Proposal-Backed Chapter Authoring](../rfc/0004-proposal-backed-chapter-authoring.md)
- [Task 0003 — Proposal Authoring and Review UI](0003-proposal-authoring-and-review-ui.md)
