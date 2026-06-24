# Task 0005: Trigger Condition Authoring Workflow

Status: Ready for development

## Goal

Add first-class authoring for chapter trigger conditions so materialised chapters preserve tracker progression behavior.

This task exists because Task 0004 intentionally left trigger authoring out of the locked plan shape, but the tracker depends on trigger records to advance thread state from facts, beats, and handouts.

## Architectural decisions in force

- **ADR-0006** — Chapter composition data lives at `corpus/state/chapters/<id>/plan.json`
- **ADR-0005** — Promoted corpus content enters via proposals; chapter-local assembly data may be authored directly in the plan
- **ADR-0001** — Chapter composition sits between `promoted` and `materialised` as a planning/composition sub-phase
- **ADR-0003** — The chapter workspace reads and writes through `/api/v1/` only
- **RFC-0004** — Chapter authoring is composition, not blob editing

## Design constraints

- Trigger conditions must remain chapter-local planning data, not promoted corpus content
- The tracker must still consume `chapter-triggers.json` as the runtime source of truth
- The UI is an API consumer only — it never writes state files directly to disk
- Materialisation must derive trigger records explicitly, not infer them from unrelated scene joins
- Trigger editing must stay structured and machine-readable, not raw metadata text by default

## Pre-dev decisions — locked

### 1. What belongs in trigger authoring?

Trigger authoring covers chapter-local rules that map plan items to thread status changes:
- fact → thread status
- beat → thread status
- handout → thread status

Each trigger rule expresses: event type, target item id, target thread id, and resulting thread status.

### 2. Where does trigger data live?

Trigger authoring lives in `plan.json` as chapter-local composition data and materialises into `corpus/state/chapters/<id>/triggers.json`. The tracker must only read the materialised triggers file.

### 3. Trigger placement — scene-level — locked

Triggers live inside each `planScene`, alongside `beats`, `facts`, and `handouts`. The DM authors a beat and its trigger in the same scene context. Materialisation flatmaps triggers across all scenes into `triggers.json`.

```json
{
  "id": "scene-1",
  "beats": [{ "id": "beat-departure", "label": "Departure", "desc": "..." }],
  "triggers": [
    { "on": "beat", "id": "beat-departure", "threadId": "thread-mathr", "setStatus": "hot" }
  ]
}
```

### 4. ID uniqueness constraint — locked

Plan item IDs (`beats[].id`, `facts[].id`, `handouts[].id`) must be globally unique across the entire plan, not just within their scene. Materialised tracker actions address items by ID without scene scope. Duplicate IDs across scenes must be rejected at plan write time with a structured error listing the duplicates.

### 5. Trigger reference rules — locked

All four trigger fields are validated at plan write time where resolvable, then revalidated at materialisation:

- `on` must be `fact`, `beat`, or `handout`
- `id` must reference an item of the matching type in **the same scene** as the trigger — not just anywhere in the plan
- `threadId` must exist in both `plan.threads[]` and `world-threads.json` — both checks apply
- `setStatus` must be a valid `threadStatus` value (`hot`, `simmering`, `dormant`, `closed`, `abandoned`)

If any trigger rule fails these checks, materialisation must fail with a structured error listing each invalid rule. No partial trigger output.

### 6. Materialisation behavior

Materialisation derives `triggers.json` from the plan by flatmapping scene-level triggers into the tracker's `chapterTrigger` format: `{ on, id, threadId, setStatus }`. Validation runs before any file is written.

### 7. REST shape — unchanged from Task 0004

```
GET    /api/v1/chapters/:id/plan          — read plan.json including scene-level triggers
PUT    /api/v1/chapters/:id/plan          — full write (create or replace); validates triggers and ID uniqueness
PATCH  /api/v1/chapters/:id/plan          — partial update; same validation applies
POST   /api/v1/chapters/:id/materialise   — derives triggers.json; fails completely on any invalid trigger rule
```

---

## Epic Breakdown

### Epic 1 — Plan schema for triggers

Extend the chapter plan schema to store trigger conditions as structured chapter-local data.

Acceptance criteria:
- The plan schema can represent trigger rules for fact, beat, and handout events
- Trigger rules remain distinct from tracker runtime state
- The schema stays machine-readable and stable

### Epic 2 — Chapter plan API support

Expose trigger definitions through the chapter plan API.

Acceptance criteria:
- `GET /api/v1/chapters/:id/plan` returns trigger definitions
- `PUT` and `PATCH` can create and update trigger definitions
- Missing plan behavior still works cleanly
- Tests cover trigger plan read/write behavior

### Epic 3 — Trigger editing in the workspace

Add structured trigger editing to the chapter composition workspace.

Acceptance criteria:
- The DM can add, edit, and remove trigger rules
- The DM can connect a trigger to a plan fact, beat, or handout
- The workspace makes it obvious which thread and status the trigger affects
- Editing triggers does not require raw JSON editing

### Epic 4 — Materialisation output

Derive `chapter-triggers.json` from the plan.

Acceptance criteria:
- Materialisation writes trigger records into the tracker-facing state
- The tracker can consume the materialised triggers without any manual repair
- Materialisation fails clearly if trigger rules are invalid or incomplete

### Epic 5 — Tracker verification

Confirm the tracker still advances thread state correctly after trigger materialisation.

Acceptance criteria:
- Revealing a fact, marking a beat, or posting a handout still drives thread state as expected
- The workflow is covered by tests
- No silent trigger suppression remains

---

## Done When

- The chapter plan can store trigger conditions as structured data
- The chapter workspace can author trigger conditions without raw JSON editing
- Materialisation produces `chapter-triggers.json` from the plan
- The tracker continues to advance thread state from materialised trigger records

## Out of scope

- Reworking the tracker UI
- Proposal-backed corpus authoring beyond trigger-linked inputs
- Rich scene block reconstruction from promoted corpus content

## Notes

Task 0004 is reviewable, but trigger materialisation is not ship-safe until this follow-up lands.

Do not solve this by sprinkling ad hoc trigger writes into the UI. The trigger model needs to exist as explicit plan data and explicit materialisation output.

## Related

- [Task 0004 — Chapter Composition Workspace](0004-chapter-composition-workspace.md)
- [ADR-0001 — Lifecycle State Contract](../adr/0001-lifecycle-state-contract.md)
- [ADR-0003 — REST API as Primary Interface](../adr/0003-rest-api-as-primary-interface.md)
- [ADR-0005 — Proposals as the Primary Authoring Unit](../adr/0005-proposals-as-primary-authoring-unit.md)
- [ADR-0006 — Chapter Composition Model](../adr/0006-chapter-composition-model.md)
- [RFC-0004 — Proposal-Backed Chapter Authoring](../rfc/0004-proposal-backed-chapter-authoring.md)
