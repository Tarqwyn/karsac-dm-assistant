# Task 0007: Atelier Chapter Composition Workspace

Status: Complete

## Goal

Replace the current `ChapterCompositionWorkspace` with the Atelier: a split-panel composition surface with a chapter-scoped working set catalog on the left, a drag-and-drop scene rail on the right, an inline proposal creation drawer, and a corpus enrolment modal.

This task delivers the Atelier UX defined in RFC-0005. The reference design is `Karsac Atelier.dc.html` in this repository.

The lifecycle model, API contract, and materialisation gate are unchanged. This task is a UX and interaction layer over existing infrastructure.

## Architectural decisions in force

- **ADR-0007** — Working set persists as `workingSet: string[]` on `plan.json`; seeded from existing plan references on first load
- **ADR-0008** — `@dnd-kit/core` + `@dnd-kit/sortable` for all DnD; `ProposalFormShell` extracted from `ProposalForm.tsx` and mounted as `AtelierProposalDrawer`
- **ADR-0006** — Chapter composition data lives at `corpus/state/chapters/<id>/plan.json`; tracker does not read `plan.json`
- **ADR-0005** — Any new standalone corpus entity enters via a proposal; chapter-local assembly data may be authored directly in the plan
- **ADR-0003** — UI writes through `/api/v1/` only; never directly to disk
- **ADR-0001** — Lifecycle: `proposed → reviewed → promoted → materialised → tracked`
- **RFC-0005** — Full UX model for the Atelier surface

## Design constraints

- The Atelier applies to `planning` mode in the chapter workspace only; the state-mode view (live chapter inspection, facts/beats/handouts tabs) is not touched
- The working set is the primary catalog view; the full corpus is only accessible via the explicit "Enrol from corpus" modal
- Drop zones are type-aware: the artifact zone accepts `scene` and `encounter` proposals only; the joins zone accepts Task 0006 relationship proposal types (`npc`, `place`, `adversary`, `item`, `clue`, `handout`, `faction`)
- The scene rail is flat; no scene may be dropped inside another scene — there is no nested drop target inside a scene body
- Proposals at any lifecycle stage (`proposed`, `reviewed`, `promoted`) may be enrolled in the working set and assigned to scenes; readiness indicators communicate their status visually
- Materialisation remains the hard gate: it blocks if any scene references an unpromoted proposal
- The inline creation drawer does not auto-promote a created proposal; the DM must review and promote through the normal lifecycle
- The plan is marked dirty on any local mutation; the DM saves explicitly; materialisation is separate from save

## Pre-development decisions — locked

### 1. Working set field — locked

`workingSet: string[]` is added as an optional field to `ChapterPlan` in `@karsac/shared`. Default is `[]`.

The plan read handler applies the seeding rule: when `workingSet` is absent or empty on load, the handler computes it from all proposal ids already referenced anywhere in the plan (`scenes[].artifactRef`, `scenes[].npcs`, `scenes[].places`, `scenes[].adversaries`, `scenes[].items`, `scenes[].clueRefs`, `scenes[].handoutRefs`, `scenes[].factionRefs`) and returns it as the initial value. The seeded value is not written back automatically — it persists on the DM's next explicit plan save.

### 2. DnD library — locked

`@dnd-kit/core` and `@dnd-kit/sortable`. One `DndContext` at the Atelier root.

Scene reorder: `SortableContext` with vertical list strategy on the scene rail. Activator is the drag handle only (not the whole scene header).

Proposal assignment: `useDroppable` zones on each scene card. Two named zones per scene: `artifact` and `joins`. Type checking in `onDragOver`: artifact zone does not activate for non-scene/encounter proposals; joins zone does not activate for non-relationship proposals (`npc`, `place`, `adversary`, `item`, `clue`, `handout`, `faction`). Activation is visual only — the drop handler performs the assignment based on the dropped proposal's type and the target zone.

### 3. ProposalForm extraction — locked

`ProposalForm.tsx` is refactored into:

- `ProposalFormShell.tsx` — layout-agnostic form logic; accepts `{ mode, proposalId?, context?, onSuccess, onCancel }`
- `ProposalFormPage.tsx` — full-page mount for the `/proposals` route; wraps `ProposalFormShell` with the existing route layout; no behaviour change
- `AtelierProposalDrawer.tsx` — slide-in drawer mount for the Atelier; wraps `ProposalFormShell`; on success, calls `onProposalCreated(proposalId)`; the parent component adds the id to local `workingSet` state

The `/proposals` route continues to work exactly as before. No functional change to the proposals section.

### 4. Chapter selector scope — locked

The chapter selector in the Atelier header shows all chapters from `GET /api/v1/chapters`. Locked chapters are shown with a lock indicator and their workspace is read-only (save and materialise are disabled). The DM can view a locked chapter's plan but not edit it.

### 5. Catalog eligibility — locked

All proposals in the working set appear in the catalog regardless of lifecycle status. Status is communicated via chip (`proposed`, `reviewed`, `promoted`) and left-border colour. Proposals not in the working set do not appear in the catalog by default.

### 6. Reviewed proposals in scene assignments — locked

Any proposal id may be assigned to a scene's artifact ref or joins, regardless of its current status (per ADR-0007, Task 0006 pre-development rulings). The readiness indicator per scene reflects the worst-case status of all its proposal references. Materialisation still blocks on any unpromoted reference.

### 7. Working set enrolment on inline creation — locked

When `AtelierProposalDrawer` creates a proposal, the parent adds the new proposal id to `workingSet` optimistically in local state before the next plan save. The proposal is immediately visible in the catalog. If the subsequent plan save fails, the user is notified; the proposal record still exists in `corpus/proposals/` and can be re-enrolled.

### 8. Atelier CSS approach — locked

New theme variables are added to `styles.css` as a new block rather than replacing existing variables. The Atelier workspace applies the new variables via a scoped class (`.atelier`) on the `ChapterCompositionWorkspace` root. Existing sections (Corpus, Proposals, Tracker, Session) are unaffected. Font additions: `Lora` for chapter titles and proposal names; `IBM Plex Mono` for IDs and lifecycle chips. Both loaded via Google Fonts link already present in the app shell.

---

## Expected API shape

No new routes. Changes to existing plan endpoints only.

```
GET  /api/v1/chapters/:id/plan
```
Returns `ChapterPlan` with `workingSet` populated (seeded from plan references if absent on disk).

```
PUT  /api/v1/chapters/:id/plan
```
Accepts full `ChapterPlan` including `workingSet`. Persists `workingSet` alongside existing fields. No special-casing — it is treated as a normal plan field.

```
PATCH /api/v1/chapters/:id/plan
```
Accepts partial `ChapterPlan`. For `workingSet`, Task 0007 uses replace semantics only: if `workingSet` is present in a patch, it is the complete next array. Append/remove are local UI operations that produce a replacement array before save/patch. Do not introduce a new patch-operation format in this task.

No changes to the materialise endpoint. Materialisation ignores `workingSet`; it operates on `scenes`, `threads`, and `checkpoints` only.

---

## Epic Breakdown

### Epic 1 — Schema and API: `workingSet` field

Add `workingSet` to the `ChapterPlan` type and persist it through the plan endpoints.

Acceptance criteria:
- `workingSet: string[]` is added to `ChapterPlan` in `@karsac/shared` as an optional field with default `[]`
- `schemas/state/chapters/chapter-plan.json` is updated to include the `workingSet` property
- The plan read handler seeds `workingSet` from plan references when the field is absent or empty
- `PUT /api/v1/chapters/:id/plan` persists `workingSet` without error
- `PATCH /api/v1/chapters/:id/plan` handles `workingSet` with replace semantics when present
- The materialiser does not read or act on `workingSet`
- Existing `plan.json` documents without the field remain valid and load without error
- Tests cover seeding, read-back, and materialisation ignoring the field

### Epic 2 — Design system: Atelier theme

Add Atelier-specific CSS variables and component classes to `styles.css`.

Acceptance criteria:
- New CSS variable block (`.atelier`) defines: warm background, Lora serif, IBM Plex Mono for chips/IDs, accent green, status colours for promoted/reviewed/proposed/pass/warn/fail
- New component classes cover: `prop-card` (with left-border status colour, drag handle), `scene-card` (with artifact zone, joins zone, readiness chip), `artifact-zone` (dashed border, drag-active state), `joins-zone` (dashed border, drag-active state), inline proposal drawer slide animation
- Existing component classes in `styles.css` are not modified
- The Atelier theme is scoped to `.atelier` and does not leak into other sections

### Epic 3 — Core Atelier layout

Refactor `ChapterCompositionWorkspace.tsx` to the Atelier split-panel layout with working set catalog.

Acceptance criteria:
- Planning-mode chapter workspace renders as: fixed header (chapter selector, save, materialise) / left catalog panel (300px) / right canvas (flex)
- Chapter selector reflects available chapters; locked chapters disable save and materialise
- Working set catalog shows enrolled proposals filtered by type tab; each card shows glyph, title, status chip, validation chip, issue count
- Catalog has a `+ New` button that opens the inline creation drawer (Epic 5)
- Catalog has a `+ Enrol from corpus` footer button that opens the corpus modal (Epic 4)
- Canvas shows the chapter title and stats row (scene count, beat count, ready count)
- Each scene card shows: drag handle, kind badge, label, readiness indicator, expand/collapse toggle
- Expanded scene shows: artifact zone, joins zone with all relationship refs (NPC, place, adversary, item, clue, handout, faction), beats list, inline validation issues
- State-mode chapter workspace is unchanged

### Epic 4 — Working set management: corpus enrolment modal

Implement the "Enrol from corpus" modal and working set add/remove.

Acceptance criteria:
- "Enrol from corpus" button opens a modal showing all proposals not yet in the working set
- Modal supports search by title and type
- Each row shows: type glyph, title, type chip, status chip, Enrol button
- Clicking Enrol adds the proposal id to local `workingSet` state; the button becomes "Enrolled ✓" and disables
- Modal close saves nothing; the working set is persisted on the next explicit plan save
- Enrolled proposals appear immediately in the catalog without a reload
- Working set is seeded from existing plan references on chapter load (per ADR-0007 seeding rule)

### Epic 5 — Inline proposal creation drawer

Extract `ProposalForm.tsx` into a composable shell and mount it as `AtelierProposalDrawer`.

Acceptance criteria:
- `ProposalFormShell.tsx` contains form logic and submission; accepts `{ mode, proposalId?, context?, onSuccess, onCancel }`
- `ProposalFormPage.tsx` wraps `ProposalFormShell` for the `/proposals` route; existing proposals section behaviour is unchanged
- `AtelierProposalDrawer.tsx` slides in from the left over the catalog panel; contains `ProposalFormShell`
- `App.tsx` is updated to render `ProposalFormPage` or an equivalent wrapper for the `/proposals` route; it must not keep a second, divergent proposal form implementation
- On successful creation: new proposal id is added to local `workingSet`; drawer closes; catalog updates immediately
- Drawer type selector pre-fills from the `+ New` button context if available (e.g. "NPC" if clicked from NPC filter)
- Proposal creation uses `POST /api/v1/proposals`; no changes to the proposals API
- Drawer can be closed without creating a proposal (no partial state persisted)

### Epic 6 — Drag-and-drop: scene reorder

Implement `@dnd-kit/sortable` scene reorder on the canvas rail.

Acceptance criteria:
- `@dnd-kit/core` and `@dnd-kit/sortable` are added to `karsac-ui/package.json`
- `DndContext` is mounted at the Atelier root
- Scene cards have a drag handle activator (the `⋮⋮` element); dragging anywhere else on the scene header does not initiate a drag
- Scene rail uses `SortableContext` with a vertical list strategy
- Dragging a scene shows it at reduced opacity (0.4); an insertion line appears above the target position
- On drop: scenes array reorders; plan is marked dirty
- Keyboard drag (space to pick up, arrow keys to move, space to place) works via `@dnd-kit` accessibility defaults
- Dropping a scene onto itself or outside the rail has no effect

### Epic 7 — Drag-and-drop: proposal assignment

Implement `@dnd-kit` proposal-to-scene drop assignment.

Acceptance criteria:
- Proposal cards in the catalog are draggable items
- Each expanded scene card exposes two named `useDroppable` zones: `artifact` and `joins`
- Artifact zone activates (highlighted dashed border → solid) only when a `scene` or `encounter` proposal is dragged over it
- Joins zone activates only when a relationship proposal (`npc`, `place`, `adversary`, `item`, `clue`, `handout`, `faction`) is dragged over it
- On drop to artifact zone: scene's `artifactRef` is set to the proposal id; plan is marked dirty
- On drop to joins zone: proposal id is appended to the matching field based on type (`npcs[]`, `places[]`, `adversaries[]`, `items[]`, `clueRefs[]`, `handoutRefs[]`, `factionRefs[]`); plan is marked dirty
- Dropping a proposal already assigned to a scene is idempotent (no duplicate entry, no error)
- Dropping a proposal onto a scene outside any named zone (e.g. scene header) has no effect
- No nested drop targets exist inside scene bodies — a `scene` proposal cannot be dropped inside another scene

### Epic 8 — Save, validate, and readiness indicators

Implement explicit save, per-scene readiness indicators, and inline validation callouts.

Acceptance criteria:
- "Save plan" button writes the full current plan (including `workingSet`) via `PUT /api/v1/chapters/:id/plan`
- On save: plan validator runs and returns any issues; issues are stored in component state
- Each scene card shows a readiness chip: `✓ Ready` (artifact and all relationship refs are promoted), `Needs promotion` (any artifact or relationship ref is proposed or reviewed but not promoted), `No artifact` (no artifact ref set)
- Expanded scene readiness detail lists each artifact/join ref with its lifecycle status so the DM can identify the exact proposal blocking materialisation
- After a save that returns issues, affected scene cards show inline validation callouts listing each issue
- Save button shows transient "✓ Saved" state on success; shows issue count on failure
- "Materialise →" button triggers `POST /api/v1/chapters/:id/materialise`; disabled if the plan has not been saved or has known unresolved issues
- Materialisation result (success or structured error listing unready refs) is displayed in the workspace header area

---

## Done When

- The planning-mode chapter workspace renders as the Atelier split layout
- The DM can manage a chapter working set (enrol from corpus, create inline, see enrolled proposals in catalog)
- The DM can assign proposals to scenes by dragging from catalog to scene card
- The DM can reorder scenes by dragging their handles
- The inline proposal creation drawer works without navigating away from the composition surface
- Save persists the plan including `workingSet`; validation issues appear inline on affected scenes
- The state-mode chapter workspace (live inspection) is unchanged
- All existing tests pass; new tests cover the working set field and seeding rule

## Out of scope

- Beat authoring within the composition surface (beats remain as inline editable items in the plan, not as proposals)
- Trigger-condition authoring (Task 0005)
- Touch drag support (keyboard DnD via @dnd-kit covers accessibility; touch is a follow-on)
- Map integration
- Direct corpus editing from the composition surface
- Undo/redo for drag operations
- Working set sync across multiple browser tabs

## Notes

The `Karsac Atelier.dc.html` prototype in this repository is the reference design for layout, interaction model, and visual language. Treat it as the spec for decisions not explicitly covered in the pre-development rulings above. Where the prototype differs from production constraints (e.g. it uses mock data rather than API calls; it uses CSS classes rather than the existing `styles.css` architecture), follow the production constraints and use the prototype for UX intent only.

Do not expand the state-mode chapter workspace as part of this task. That surface reads live materialised state and is a separate concern.

The `ProposalFormPage.tsx` extraction must not change the behaviour of the `/proposals` route. Run the full test suite after extraction to confirm.

## Close-out Notes

Implemented as functional v1 of the Atelier workflow:
- Planning mode now renders the Atelier split layout with working-set catalog, scene rail, enrolment modal, inline proposal drawer, DnD scene reorder, proposal assignment zones, and chapter-outline Scene Spine import.
- `workingSet` is persisted on the chapter plan and seeded from existing plan references on read.
- Proposal form logic is shared through `ProposalFormShell`; the proposals route continues to mount through `ProposalFormPage`.
- State-mode chapter inspection is intentionally unchanged.

Known follow-up:
- A dedicated UX consistency pass should refine density, hierarchy, card styling, drag affordances, and alignment with the rest of the application. This is tracked as post-v1 UX debt rather than part of this functional wiring task.
- The Atelier drawer is implemented inline in the workspace rather than as a separate `AtelierProposalDrawer.tsx` wrapper component; the shared form logic is still centralised in `ProposalFormShell`.

## Related

- [RFC-0005 — Atelier Chapter Authoring UX](../rfc/0005-atelier-chapter-authoring-ux.md)
- [ADR-0007 — Chapter Working Set Persistence Model](../adr/0007-chapter-working-set.md)
- [ADR-0008 — Chapter Composition DnD and Inline Authoring](../adr/0008-chapter-composition-dnd-and-inline-authoring.md)
- [ADR-0006 — Chapter Composition Model](../adr/0006-chapter-composition-model.md)
- [ADR-0005 — Proposals as the Primary Authoring Unit](../adr/0005-proposals-as-primary-authoring-unit.md)
- [ADR-0003 — REST API as Primary Interface](../adr/0003-rest-api-as-primary-interface.md)
- [ADR-0001 — Lifecycle State Contract](../adr/0001-lifecycle-state-contract.md)
- [Task 0006 — Contextual Proposal Expansion and Relationship Workflow](0006-contextual-proposal-expansion-and-relationship-workflow.md)
- [Task 0004 — Chapter Composition Workspace](0004-chapter-composition-workspace.md)
- [RFC-0004 — Proposal-Backed Chapter Authoring](../rfc/0004-proposal-backed-chapter-authoring.md)


## Design Notes — Claude (Sonnet 4.5) review 2026-06-26
1. Joins zone field mapping — use the registry, not the prototype
Karsac Atelier.dc.html shows a simplified joins zone (NPC and place only). It pre-dates the Task 0006 relationship set. For the complete field mapping — npcs[], places[], adversaries[], items[], clueRefs[], handoutRefs[], factionRefs[] — use CHAPTER_SCENE_RELATIONSHIPS from @karsac/shared as the canonical source. The prototype is authoritative for interaction model and visual language only.

2. Readiness chip granularity — consider distinguishing reviewed from proposed
The Epic 8 spec defines two non-ready states: Needs promotion (any ref is reviewed-not-promoted) and No artifact. A third label — Needs review — could distinguish refs that are proposed (further from ready) from refs that are reviewed (one step from ready). This gives the DM a more precise signal about what action is needed. If straightforward to add during Epic 8 implementation, it is worth including. If it adds complexity, defer to a follow-on — the per-join status annotation in the expanded scene view already provides the detail; the chip is a summary only.

3. Prototype interaction model to preserve in production
Three interactions in the prototype that must survive the production implementation:

Drag handle activator only. Scene reorder must only activate from the ⋮⋮ handle, not from the scene header. If the whole header is the activator, the expand/collapse toggle becomes unreliable.
Type-aware zone activation. Drop zones should not highlight for incompatible proposal types. A scene/encounter proposal dragged over the joins zone should produce no visual activation — and vice versa. This communicates the schema constraint without an error state.
Idempotent drops. Dropping a proposal already in a join produces no effect and no error. The DM should be able to drop freely without worrying about duplicates.
