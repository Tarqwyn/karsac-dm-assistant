# Task 0006: Contextual Proposal Expansion and Relationship Workflow

Status: Implemented — ready for review

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

## Pre-development decisions — locked

### 1. What is the unit of contextual authoring?

A contextual proposal request carries workflow metadata as URL query parameters:

| Parameter | Description |
|---|---|
| `chapter` | originating chapter id |
| `segment` | originating scene or segment id |
| `relationship` | plan field to populate (e.g. `npcs`, `adversaries`) |
| `parent` | parent proposal or corpus artifact id |
| `createdProposal` | stable proposal id set after successful creation (enables retry after attachment failure) |

URL query parameters are used — not React state alone, not sessionStorage — so the context survives a page refresh and the `createdProposal` field enables safe retry without re-creation.

The context is workflow metadata only. It does not make the child proposal chapter-local or weaken its standalone lifecycle.

### 2. Which relationship types are initially supported?

The first implementation must support:

- scene → NPC (`npcs[]`)
- scene → place (`places[]`)
- scene → adversary (`adversaries[]`)
- scene → item (`items[]`)
- scene → clue (`clueRefs[]`)
- scene → handout (`handoutRefs[]`)
- scene → faction (`factionRefs[]`)

**Field naming constraint:** `handoutRefs[]` and `clueRefs[]` use explicit `Refs` suffix because `handouts[]` and `facts[]` on `planScene` already hold chapter-local inline items. Mixing them would create an ambiguous schema. `factionRefs[]` follows the same pattern for consistency.

The `chapter-plan.json` schema must be updated to add `clueRefs`, `handoutRefs`, and `factionRefs` to `planScene` before this task can be considered complete.

The relationship contract must allow additional proposal types without redesigning the workflow.

### 3. Faction is a prerequisite — locked

`faction` is not currently a valid proposal type in `proposalTypes.ts`, `proposalContractsLoader.ts`, or `@karsac/shared`. Faction relationship support cannot be claimed until:

- `faction` is added to `PROPOSAL_TYPE_VALUES` and `PROPOSAL_TYPES`
- `proposalContractsLoader.ts` maps `faction` to a folder and promote target
- The schema and UI type lists are updated accordingly

This is a prerequisite for Epic 1, not an implementation detail.

### 4. Relationship registry — locked

Static relationship definitions (which proposal types map to which plan fields, which proposal types are valid targets for each slot) live in `@karsac/shared`. The UI consumes this to render relationship slots without an API call.

Identity resolution and ambiguity detection (resolving a string to an existing proposal, promoted corpus entity, or missing/ambiguous match) live in the backend. The UI calls the backend resolver; it does not perform its own slug matching.

Consumer-side slug matching is transitional behavior and must be replaced by this resolver in this task.

### 5. Create and attach are separate operations — locked

Creation (`POST /api/v1/proposals`) and attachment (`PATCH /api/v1/chapters/:id/plan`) are explicit separate API writes. The created proposal id is placed in the `createdProposal` URL parameter after creation. If attachment fails, the DM can retry attachment using the id from the URL without recreating the proposal.

The API must not modify a chapter plan as an undocumented side effect of proposal creation.

### 6. Does attachment require promotion? — locked

No. The plan may reference proposed or reviewed artifacts. Read-time status annotation distinguishes them. Materialisation remains the hard gate and blocks on any unpromoted reference.

### 7. How are suggested relationships resolved? — locked

The backend resolver distinguishes:

- an existing proposal reference (by proposal id)
- an existing promoted corpus entity
- a suggested entity with no proposal
- an invalid or ambiguous relationship

Resolution uses stable identifiers. Consumer-side slug or title matching must not be the final implementation.

### 8. Error status codes — locked

- `409` for relationship or plan conflicts (e.g. duplicate attachment, slug collision)
- `422` for structurally valid but unresolvable or invalid relationship requests (e.g. unknown relationship slot, ambiguous match that cannot be auto-resolved)

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

---

## Implementation note — 2026-06-26

Implemented as a connected workflow across the shared contract, registry API, and UI:

- `faction` is now a valid proposal type with a proposal contract entry and promote target.
- `planScene` supports `clueRefs`, `handoutRefs`, and `factionRefs` alongside NPC/place/adversary/item joins.
- `CHAPTER_SCENE_RELATIONSHIPS` in `@karsac/shared` is the static relationship registry used by the UI.
- `GET /api/v1/proposals/resolve?ids=...` resolves exact ids, namespaced ids, promoted planning entities, missing subjects, and ambiguous aliases.
- Manual and AI-assisted proposal creation accept context metadata and return a retry-safe `returnTo`.
- Chapter composition can show missing relationship gaps, attach existing resolver matches, launch contextual proposal creation, and return with a pending attach banner.
- Segment creation uses the backend resolver for relationship joins rather than client-side slug guessing.
- Materialisation gates the new relationship ref fields the same way it gates existing proposal refs.

Known limitations:

- Existing proposal selection is functional through resolver matches and type-specific toggle lists, but there is not yet a polished per-slot search/filter component.
- Contextual child proposals currently record the parent in `related.scenes`, which matches the scene/encounter parent workflow but is not a general parent-type relationship mapper.
- `clueRefs`, `handoutRefs`, and `factionRefs` are normalized and materialisation-gated, but there are no additional write-time uniqueness rules beyond string-array validation.

Verification:

- `npm test` passed: 28 files, 814 tests.
- `npm run karsac-ui:build` passed.
- `npx tsc --noEmit --project karsac-registry/tsconfig.json` still reports pre-existing project-wide TypeScript errors, but the Task 0006-introduced `service.ts` implicit-any error was fixed.
