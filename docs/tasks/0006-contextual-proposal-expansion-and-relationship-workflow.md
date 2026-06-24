# Task 0006: Contextual Proposal Expansion and Relationship Workflow

Status: Ready for pre-development review

## Goal

Connect proposal authoring and chapter composition into one continuous workflow so the DM can discover missing related content, create its proposal in context, and attach it back to the originating chapter segment.

The target operator loop is:

1. Add or inspect a scene or encounter in a chapter segment
2. See its suggested or unresolved relationships
3. Start a related proposal, such as an NPC, place, adversary, item, clue, handout, or faction
4. Author, validate, review, or promote that proposal through the normal lifecycle
5. Return to the originating segment with the new proposal attached

This task closes the seam between Task 0003 proposal authoring and Task 0004 chapter composition.

## Architectural decisions in force

- **ADR-0005** — Any new standalone corpus entity begins as a proposal
- **ADR-0006** — Chapter-local joins and ordering live in `plan.json`
- **ADR-0003** — The UI writes through `/api/v1/` only
- **ADR-0001** — Proposal lifecycle remains `proposed -> reviewed -> promoted -> materialised -> tracked`
- **RFC-0004** — Proposal authoring and chapter composition form one coherent feature stream

## Design constraints

- The chapter workspace must not bypass the proposal lifecycle when creating related corpus content
- A related proposal may be attached to a draft plan before promotion, but materialisation still requires all references to be promoted
- Contextual creation must use stable identifiers, not title or slug guessing
- Relationship behavior must be driven by a shared registry or contract, not repeated type-specific UI branches
- Validation failures must remain visible and actionable; they must not silently discard the proposal or its relationship
- The UI must preserve the originating chapter, segment, relationship slot, and parent artifact throughout proposal authoring
- Hand-authored and AI-assisted creation must support the same contextual workflow

## Pre-development decisions — resolved

### 1. What is the unit of contextual authoring?

A contextual proposal request contains:

- proposal type being created
- originating chapter id
- originating segment id
- relationship slot to populate
- parent proposal or corpus artifact id
- suggested subject id or label, when one exists
- relevant parent context for proposal generation
- return destination after creation

The context is workflow metadata. It does not make the child proposal chapter-local or weaken its standalone lifecycle.

### 2. Which relationship types are initially supported?

The first implementation must support the chapter composition relationships already useful to the DM:

- scene or encounter -> NPC
- scene or encounter -> place
- scene or encounter -> adversary
- scene or encounter -> item
- scene or encounter -> clue
- scene or encounter -> handout
- scene or encounter -> faction

The relationship contract must allow additional proposal types without redesigning the workflow.

### 3. What happens after proposal creation?

After a proposal is successfully created:

- its stable proposal id is added to the requested segment relationship slot
- the updated chapter plan is saved through the chapter plan API
- the proposal remains visible as `proposed`, `reviewed`, or `promoted`
- the UI returns to the originating segment unless the DM chooses to remain in proposal editing

Creation and attachment are separate API writes. If attachment fails after creation, the proposal must remain intact and the UI must offer a retry rather than creating a duplicate proposal.

### 4. Does attachment require promotion?

No.

The chapter plan may reference proposed or reviewed artifacts so the DM can compose ahead of promotion. Read-time status annotation remains visible in the workspace.

Materialisation remains the hard gate and must fail if any attached reference is not promoted.

### 5. How are suggested relationships resolved?

Relationship values from proposal metadata must be resolved through a shared relationship resolver.

The resolver must distinguish:

- an existing proposal reference
- an existing promoted corpus entity
- a suggested entity with no proposal
- an invalid or ambiguous relationship

Consumer-side slug matching is transitional behavior and must not be the final implementation.

## Expected API shape

The exact route may be adjusted during pre-development review, but the API must support an explicit contextual creation contract.

Suggested request:

```http
POST /api/v1/proposals
```

```json
{
  "type": "npc",
  "title": "Captain Brynn Stonehand",
  "summary": "Inspector attached to The Market Inspection.",
  "context": {
    "chapterId": "chapter-3",
    "segmentId": "scene-4",
    "relationship": "npcs",
    "parentProposalId": "proposals/the-market-inspection",
    "suggestedSubjectId": "captain-brynn-stonehand",
    "returnTo": "/chapters/chapter-3?segment=scene-4"
  }
}
```

AI generation must accept equivalent context:

```http
POST /api/v1/proposals/generate
```

The chapter plan continues to be updated through:

```http
PUT   /api/v1/chapters/:id/plan
PATCH /api/v1/chapters/:id/plan
```

The API must not directly modify a chapter plan as an undocumented side effect of proposal creation.

---

## Epic Breakdown

### Epic 1 — Relationship registry and resolver

Define a shared contract describing proposal relationships and valid target types.

Acceptance criteria:

- Relationship slots map to allowed proposal types and chapter plan fields
- The registry covers NPCs, places, adversaries, items, clues, handouts, and factions
- Proposal metadata relationships resolve to stable proposal or corpus identifiers
- Missing, ambiguous, and invalid relationships are represented explicitly
- Backend and UI consume the same relationship semantics
- Tests cover aliases, namespaced ids, promoted entities, proposals, and ambiguous matches

### Epic 2 — Contextual proposal API contract

Extend proposal creation and generation endpoints to accept origin context.

Acceptance criteria:

- Hand-authored proposal creation accepts contextual relationship metadata
- AI-assisted generation receives bounded parent and chapter context
- Created proposals retain their normal standalone proposal identity and lifecycle
- Parent and child proposal relationship metadata is populated consistently where the schema supports it
- Invalid context returns structured errors
- Context does not grant permission to bypass validation, review, or promotion

### Epic 3 — “Propose related” actions in chapter composition

Turn unresolved relationships into first-class actions.

Acceptance criteria:

- Each unresolved or missing relationship can start a correctly typed proposal
- The action is available from the originating segment
- Proposal type, suggested title, parent artifact, and relationship slot are prefilled
- The DM can choose hand-authored or AI-assisted creation
- Existing matching proposals are suggested before creating a duplicate
- Validation issues from the parent artifact remain visible during the workflow

### Epic 4 — Return and attach workflow

Return successful proposal creation to its originating composition context.

Acceptance criteria:

- The UI preserves chapter id, segment id, relationship slot, and parent artifact across navigation
- After creation, the new proposal can be attached immediately
- The plan save is explicit and reports success or failure
- If plan attachment fails, the proposal is not recreated and the DM can retry attachment
- The originating segment is restored and selected on return
- Proposed and reviewed children remain visibly unready for materialisation

### Epic 5 — Existing proposal selection and replacement

Support resolving a suggested relationship to an existing proposal instead of always creating a new one.

Acceptance criteria:

- The DM can search compatible proposals for a relationship slot
- Compatible results show type, lifecycle status, validation status, and identity
- Selecting an existing proposal attaches it to the segment
- The UI prevents accidental duplicate attachment
- The DM can detach or replace a relationship without deleting the proposal

### Epic 6 — Schema-tree coverage

Apply the contextual workflow consistently across supported relationship types.

Acceptance criteria:

- NPC, place, adversary, item, clue, handout, and faction workflows use the shared relationship contract
- Adding a new supported relationship type requires registry/configuration work rather than a new bespoke navigation flow
- Unsupported relationship types render as explicit read-only suggestions rather than disappearing
- Automated coverage verifies each supported parent/child relationship path

### Epic 7 — Lifecycle and materialisation safeguards

Keep composition flexible without weakening governance.

Acceptance criteria:

- Proposed and reviewed children can be attached to a plan
- Read-time annotations distinguish proposed, reviewed, promoted, missing, and ambiguous relationships
- Materialisation blocks on every unpromoted proposal reference
- Validation failures are visible independently from lifecycle status
- No partial materialisation occurs
- No contextual action writes directly to promoted corpus or tracker state

---

## Done When

- The DM can start from a scene or encounter and see its related-content gaps
- The DM can create an NPC, place, adversary, item, clue, handout, or faction proposal without losing chapter context
- The resulting proposal is attached back to the correct segment and relationship slot
- Existing proposals can be selected instead of duplicated
- Proposal validation and lifecycle state remain visible throughout the workflow
- The same relationship mechanism works across the supported schema tree
- Materialisation still blocks until all attached proposal references are promoted

## Out of scope

- Automatic promotion of newly created proposals
- Automatic acceptance or repair of validation failures
- Direct editing of promoted corpus entities from the chapter workspace
- Tracker redesign
- Trigger-condition authoring, which remains Task 0005
- A general-purpose visual graph editor for the whole corpus

## Notes

This task is not simply a navigation enhancement. It establishes the missing authoring transaction across two existing surfaces:

`composition gap -> contextual proposal -> governed lifecycle -> attached relationship`

Do not implement this as route state plus title matching alone. The workflow needs durable identifiers and retry-safe behavior because proposal creation may succeed while plan attachment fails.

The current slug-based relationship matching in the composition workspace is transitional and should be replaced by the relationship resolver in this task.

## Related

- [Task 0003 — Proposal Authoring and Review UI](0003-proposal-authoring-and-review-ui.md)
- [Task 0004 — Chapter Composition Workspace](0004-chapter-composition-workspace.md)
- [Task 0005 — Trigger Condition Authoring Workflow](0005-trigger-condition-authoring-workflow.md)
- [ADR-0001 — Lifecycle State Contract](../adr/0001-lifecycle-state-contract.md)
- [ADR-0003 — REST API as Primary Interface](../adr/0003-rest-api-as-primary-interface.md)
- [ADR-0005 — Proposals as the Primary Authoring Unit](../adr/0005-proposals-as-primary-authoring-unit.md)
- [ADR-0006 — Chapter Composition Model](../adr/0006-chapter-composition-model.md)
- [RFC-0004 — Proposal-Backed Chapter Authoring](../rfc/0004-proposal-backed-chapter-authoring.md)
