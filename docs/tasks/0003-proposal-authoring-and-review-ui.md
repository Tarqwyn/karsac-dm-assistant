# Task 0003: Proposal Authoring and Review UI

Status: Ready for development

## Goal

Extend the Karsac UI so the DM can create, edit, validate, review, and promote proposal-backed content directly in the UI.

This task turns proposals into the primary authoring surface for any content that becomes a promoted corpus entity.

## Architectural decisions in force

- **ADR-0003** — REST API (`/api/v1/`) is the primary interface. The UI writes through this only.
- **ADR-0005** — Proposals are the primary authoring unit for promoted corpus content.
- **ADR-0001** — Lifecycle is `proposed → reviewed → promoted → materialised → tracked`.
- **RFC-0004** — Proposal authoring and chapter composition are one feature stream, but proposal authoring/review is its own implementation task.

## Design constraints

- New promoted corpus content must be created through proposal-backed flows, not by bypassing into promoted files directly
- The UI is an API consumer only — it does not write proposal markdown or frontmatter directly to disk
- AI must remain optional — the UI must support hand-authored proposal creation as well as AI-generated proposal creation
- Review and promotion remain explicit actions
- Validation failures must surface as structured operator feedback, not raw runtime errors
- Existing proposal governance remains authoritative; the UI does not weaken or duplicate it

## Pre-dev decisions — resolved

### 1. What kinds of content belong in this task?

Any content that becomes a promoted corpus entity belongs here.

Initial target types:
- NPCs
- places
- factions
- items
- chapter outlines
- scenes treated as promoted corpus entities
- other currently supported proposal types already governed by the registry

### 2. What is out of scope for this task?

Chapter-local assembly data is out of scope here. That belongs to Task 0004 and is authored in the chapter plan, not as a proposal.

---

## Epic Breakdown

### Epic 1 — Proposal creation surface

Add a UI flow to create a new proposal by type.

Acceptance criteria:
- The DM can start a new proposal from the UI by selecting a supported proposal type
- The DM can choose between:
  - AI-assisted proposal generation through the existing generation pipeline
  - hand-authored proposal creation in the UI
- New proposals are created through REST endpoints, not direct file writes
- Required frontmatter and body structure are scaffolded for hand-authored proposals
- Invalid creation requests surface clear validation or contract errors

### Epic 2 — Proposal editing and validation

Add in-situ editing for proposal records and expose validation status clearly.

Acceptance criteria:
- The DM can edit proposal body and relevant frontmatter fields in the UI
- The UI shows validation state for each proposal
- Validation issues are rendered in structured form
- The UI can re-run or refresh validation after edits
- The UI makes it clear whether a proposal is draftable, reviewable, or promotable

### Epic 3 — Review workflow

Make review a first-class operation in the proposal workspace.

Acceptance criteria:
- The DM can mark a proposal reviewed from the UI
- Review status is visible in proposal list and proposal detail
- If review notes or review metadata exist in the contract, they are exposed in the UI
- Review state updates via REST only

### Epic 4 — Promotion workflow

Preserve the existing explicit promotion gate while making it practical in the UI.

Acceptance criteria:
- Promote action is visible only in the proposal workflow, not hidden in generic corpus editing
- Promotion is blocked by default when validation refuses it
- Validation issues are shown in structured form on blocked promote attempts
- Force-promote remains an explicit secondary action
- Successful promotion invalidates and refreshes relevant corpus/proposal data in the UI

### Epic 5 — Proposal workspace usability

Make proposals navigable as an operator surface rather than as an API demo.

Acceptance criteria:
- Proposal list supports filtering by type, status, and validation state
- Proposal detail clearly separates:
  - proposal content
  - validation/issues
  - review state
  - promotion actions
- Empty states and API-unreachable states are handled cleanly
- The UI makes clear which proposal types feed chapter composition downstream

---

## Done When

- The DM can create proposal-backed corpus content directly in the UI
- The DM can edit and validate proposals in situ
- The DM can review and promote proposals without leaving the UI
- Hand-authored and AI-assisted proposal creation both travel through the same lifecycle surface
- The proposal workspace is ready to act as the upstream input to chapter composition

## Out of scope

- Chapter plan authoring
- Chapter-local assembly data
- Final chapter composition UX
- Tracker redesign
- Map integration

## Notes

This task should not quietly expand into chapter planning. Its job is to make proposal-backed corpus authoring complete and practical.

If a workflow starts depending on chapter-local ordering, trigger editing, or chapter plan storage, it belongs in Task 0004 instead.

## Related

- [ADR-0001 — Lifecycle State Contract](../adr/0001-lifecycle-state-contract.md)
- [ADR-0003 — REST API as Primary Interface](../adr/0003-rest-api-as-primary-interface.md)
- [ADR-0005 — Proposals as the Primary Authoring Unit](../adr/0005-proposals-as-primary-authoring-unit.md)
- [RFC-0004 — Proposal-Backed Chapter Authoring](../rfc/0004-proposal-backed-chapter-authoring.md)
- [Task 0002 — Karsac UI Shell and Corpus Workspace](0002-karsac-ui-shell-and-corpus-workspace.md)
