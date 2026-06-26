# ADR-0008: Chapter Composition DnD and Inline Proposal Authoring

**Status:** Accepted
**Date:** 2026-06-26
**Agreed by:** Claude (Sonnet 4.5), project owner

---

## Context

RFC-0005 introduced two new interaction models for the Atelier chapter composition workspace:

1. **Drag-and-drop** for scene reordering and proposal-to-scene assignment
2. **Inline proposal creation** via a slide-in drawer, without leaving the composition surface

Both require implementation decisions that affect the UI dependency tree and component architecture. This ADR records those decisions.

---

## Decision A: Drag-and-Drop Library

**Use `@dnd-kit/core` and `@dnd-kit/sortable` for all drag-and-drop interactions in the Atelier.**

Two DnD contexts are needed:

- **Scene reorder** — drag a scene card by its handle to reposition it in the scene rail (`@dnd-kit/sortable`)
- **Proposal assignment** — drag a proposal card from the catalog onto a scene's artifact zone or joins zone (`@dnd-kit/core` with a custom drop detection strategy)

Both contexts coexist within one `DndContext` provider mounted at the Atelier root.

---

## Why @dnd-kit

### Accessibility

`@dnd-kit` supports keyboard navigation out of the box. The DM can reorder scenes and assign proposals using keyboard alone. Native HTML5 DnD has no keyboard support. This is the primary differentiator.

### Two interaction types in one context

The scene rail is a sortable list. Proposal assignment is a cross-panel drag (catalog → canvas). `@dnd-kit` handles both within a single `DndContext`. The `useSortable` hook covers the rail; custom `useDroppable` zones cover the artifact and joins targets. Combining these in native HTML5 DnD requires significant cross-browser workarounds.

### TypeScript and React integration

`@dnd-kit` is TypeScript-native with React hooks. It does not manipulate the DOM directly — drag state flows through React context, which means drag state is testable and predictable.

### Active maintenance

`@dnd-kit/core` is actively maintained (2024–2025 releases). `react-beautiful-dnd` was archived by Atlassian in 2024 and is no longer maintained.

---

## Why not native HTML5 DnD

- No keyboard navigation support
- `dragover` fires continuously, requiring throttle logic to avoid excessive re-renders
- `dragLeave` fires on child element entry, requiring `relatedTarget` checks to avoid false clears
- No animation API
- Cross-browser behaviour differences (especially on Firefox) require workarounds
- Not testable without browser automation

Native HTML5 DnD is appropriate for the Atelier prototype (where demonstration quality matters more than production robustness) but not for the production implementation.

---

## Why not react-beautiful-dnd

`react-beautiful-dnd` is archived and no longer maintained. It also does not support cross-container drag (catalog → scene card) cleanly — it is designed for list-to-list moves, not arbitrary drop target shapes.

---

## DnD interaction model

### Scene reorder

- Each scene card's drag handle (`⋮⋮`) is the drag activator
- The scene rail is a `SortableContext` with a vertical list strategy
- On drag end, the scenes array is reordered and the plan is marked dirty
- Visual: the dragged scene renders at reduced opacity; a drop indicator line appears at the insertion point

### Proposal assignment

- Each proposal card in the catalog is a draggable item carrying its proposal id
- Each scene card exposes two named `useDroppable` zones:
  - **Artifact zone** — accepts `scene` and `encounter` proposal types only; rejects all others
  - **Joins zone** — accepts relationship proposal types supported by Task 0006: `npc`, `place`, `adversary`, `item`, `clue`, `handout`, and `faction`; rejects all others
- Type checking happens in the `onDragOver` handler: if the dragged item's type is not accepted by the hovered zone, the zone does not show an active drop state
- On drop: the proposal id is written to the appropriate field (`artifactRef`, `npcs`, `places`, `adversaries`, `items`, `clueRefs`, `handoutRefs`, or `factionRefs`) on the target scene and the plan is marked dirty
- A proposal already assigned to a scene can be dropped again without effect (idempotent)

### Scene sub-structure constraint

The canvas has no nested drop targets inside scene cards. There is no zone that accepts a `scene` or `encounter` type inside a scene body. This enforces the flat scene structure defined by the schema without additional validation logic.

---

## Decision B: Inline Proposal Creation

**Extract `ProposalForm.tsx` into a composable `<ProposalFormShell>` component and mount it as a slide-in drawer within the Atelier catalog panel.**

---

## Why extract rather than duplicate

`ProposalForm.tsx` already implements the full proposal creation flow: type selection, manual authoring mode, AI generation mode, validation display, and submission. Duplicating this logic in the Atelier would create two maintenance surfaces for the same form contract. Extracting it into a composable shell that can be mounted as a route-level view (the current proposals section) or as a drawer (the Atelier) keeps the logic in one place.

---

## Why a drawer rather than a modal

- Proposal creation may include a substantial brief textarea and validation feedback — a modal is too constrained vertically
- The DM needs to see the chapter canvas while creating the proposal (to remember which scene they are composing and which relationship they need to fill)
- A slide-in drawer over the catalog keeps the canvas fully visible

---

## Why not route navigation

The current proposals section uses route navigation (`navigate('/proposals')`) to enter proposal creation. Route navigation breaks composition context: the chapter, active scene, and scroll position are lost. The Task 0006 contextual workflow addressed this with URL query parameters, but query parameter management becomes complex when the creation is triggered from within an already-complex composition surface. A drawer avoids this entirely.

---

## Extraction plan for `ProposalForm.tsx`

The existing `ProposalForm.tsx` should be split into:

```
ProposalFormShell.tsx     — layout-agnostic form logic and submission handler
                            Props: { mode, proposalId, context?, onSuccess, onCancel }

ProposalFormPage.tsx      — full-page wrapper, used in /proposals route (current behaviour)

AtelierProposalDrawer.tsx — slide-in wrapper, used inside ChapterCompositionWorkspace
                            Receives: { chapterId, onProposalCreated }
                            Calls onProposalCreated(proposalId) on success
                            ChapterCompositionWorkspace then enrolls the id in workingSet and closes the drawer
```

`ProposalFormShell` accepts a `context` prop matching the contextual proposal contract from Task 0006 (`chapterId`, `segmentId`, `relationship`, `parentProposalId`). When context is provided, the form pre-fills type and parent relationship and the submission calls `POST /api/v1/proposals` with the context payload.

---

## Working set enrolment on inline creation

When the inline drawer creates a proposal:

1. `POST /api/v1/proposals` creates the proposal record
2. `AtelierProposalDrawer` calls `onProposalCreated(proposalId)`
3. `ChapterCompositionWorkspace` adds the id to `workingSet` in local plan state
4. The drawer closes; the catalog reloads and shows the new proposal in the working set
5. The DM's next explicit plan save (`PUT /api/v1/chapters/:id/plan`) persists the updated `workingSet`

Enrolment is not a separate API write — it is deferred to the next plan save. The proposal is visible in the catalog immediately via optimistic local state. If the plan save fails, the DM is notified and the working set change is not persisted, but the proposal record itself already exists in `corpus/proposals/` and can be re-enrolled.

---

## Consequences

- Add `@dnd-kit/core` and `@dnd-kit/sortable` to `karsac-ui/package.json`
- `ChapterCompositionWorkspace.tsx` mounts a `DndContext` at its root
- `ProposalForm.tsx` is refactored into `ProposalFormShell`, `ProposalFormPage`, and `AtelierProposalDrawer`
- The proposals route (`/proposals`) continues to use `ProposalFormPage` — no behaviour change
- Drop zone type checking is enforced in the `onDragOver` handler, not in a separate validation step
- The scene rail's `insert-before` drop indicator is a CSS pseudo-element driven by a `data-insert-before` attribute set during drag
- No changes to the API, the materialiser, or the lifecycle model

---

## Not in scope

- Touch drag support (accessible keyboard drag via `@dnd-kit` covers the primary accessibility need; touch can be added later via `@dnd-kit/modifiers`)
- Drag-to-reorder within a scene's beats list (beats are authored inline via form inputs, not dragged)
- Drag between chapters
- Undo/redo for drag operations

---

## Related documents

- [RFC-0005 — Atelier Chapter Authoring UX](../rfc/0005-atelier-chapter-authoring-ux.md)
- [ADR-0007 — Chapter Working Set Persistence Model](0007-chapter-working-set.md)
- [ADR-0005 — Proposals as the Primary Authoring Unit](0005-proposals-as-primary-authoring-unit.md)
- [ADR-0003 — REST API as Primary Interface](0003-rest-api-as-primary-interface.md)
- [Task 0006 — Contextual Proposal Expansion and Relationship Workflow](../tasks/0006-contextual-proposal-expansion-and-relationship-workflow.md)
