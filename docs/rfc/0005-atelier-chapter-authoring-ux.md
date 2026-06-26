# RFC-0005: Atelier Chapter Authoring UX

**Date:** 2026-06-26
**Status:** In Review
**Scope:** Define the UX model for the next-generation chapter composition workspace, addressing working set scoping, drag-and-drop interaction, inline proposal creation, and scene sub-structure constraints.

---

## Purpose

Define the operator UX for chapter composition that replaces the current `ChapterCompositionWorkspace` with a surface that is coherent, contextual, and aligned with the lifecycle model established in ADRs 0001–0006.

This RFC addresses the remaining UX design questions that were deliberately out of scope for ADR-0006 and Task 0006:

- How proposals are scoped for a specific chapter's authoring context
- How proposal assignment to scenes should work in the UI
- How inline proposal creation integrates without breaking composition context
- How schema constraints (flat scene structure, no sub-scenes) are enforced at the UI level
- What visual validation looks like in the composition surface

The Atelier prototype (see `Karsac Atelier.dc.html` in this repo) is the reference design for this RFC. It was produced through a direction exploration covering three UX models: a pipeline/kanban view, the Atelier split view, and a guided wizard. The Atelier direction was selected as the model that best reflects the authoring workflow: catalog on the left, composition canvas on the right, inline creation drawer, drag assignment.

---

## Context

Task 0006 delivered a connected proposal-and-composition workflow: the DM can discover relationship gaps in a scene, create a related proposal contextually, and return with it attached. This is the right model. The current `ChapterCompositionWorkspace` UI is functional but disjointed — it exposes all proposals at once rather than a chapter-scoped working set, uses button-based assignment rather than drag interaction, and navigates away for proposal creation rather than staying in context.

The Atelier redesign closes these gaps without changing any governance rules. The lifecycle, API contract, and materialisation gate are unchanged.

---

## Goals

- Replace the current `ChapterCompositionWorkspace` with an Atelier-shaped composition surface
- Introduce a **chapter working set** as the scoped, chapter-enrolled proposal catalog
- Support drag-and-drop for both proposal→scene assignment and scene reordering
- Support inline proposal creation without leaving the composition surface
- Enforce flat scene structure (no sub-scenes) at the UI level
- Surface save/validate state and per-scene issues inline
- Preserve all existing governance rules: proposals are the primary authoring unit, materialisation gates on promotion

## Non-goals

- Changing the lifecycle model (ADR-0001)
- Changing the chapter plan storage model (ADR-0006)
- Changing the relationship registry or resolver (Task 0006)
- Redesigning the tracker
- Map integration
- Rich text editing inside the composition surface

---

## The Atelier Model

The composition surface has two panels.

### Left panel: the working set catalog

The working set is the set of proposals explicitly enrolled in this chapter's authoring context. It is chapter-scoped, not global.

- By default, the catalog shows only proposals in the working set for the active chapter
- The DM can enrol additional proposals from the corpus via an **"Enrol from corpus"** modal
- The catalog is filterable by proposal type (scene, encounter, NPC, place, adversary, item, clue, handout, faction)
- Each card shows: type glyph, title, lifecycle status chip, validation chip, issue count
- Cards are draggable to the canvas

The working set serves three purposes:
1. Reduces visual noise (the full corpus grows large; most proposals are irrelevant to a given chapter)
2. Makes chapter-scoped authoring intent explicit
3. Provides a staging area for proposals that have been created but not yet assigned

### Right panel: the composition canvas

The canvas shows the chapter's scene sequence. Each scene card shows:

- Scene header: drag handle, kind badge, label, readiness indicator, expand/collapse toggle
- Artifact zone: the scene's scene/encounter artifact ref; accepts scene/encounter proposal drops
- Joins zone: relationship refs; accepts NPC, place, adversary, item, clue, handout, and faction proposal drops
- Beats list
- Inline validation issues (shown after a save/validate action)

Scenes are draggable by their handle for reordering.

### Inline proposal creation drawer

A `+ New` button in the catalog header slides in a creation panel over the catalog area (not a route change, not a modal). The panel contains: type selector, title input, brief textarea, generate/create button. On creation:

- The proposal is added to the proposals pool with status `proposed`
- It is automatically enrolled in the chapter working set
- The panel closes and the catalog returns showing the new proposal

This replaces the current flow of navigating to the Proposals section to create a new proposal while composing a chapter.

---

## Design Decisions Requiring ADRs

### Decision 1: Working set persistence model

The working set is a new concept. It needs a storage contract.

**Option A: Field on `plan.json`**
Add `workingSet: string[]` to the `ChapterPlan` schema. The working set is stored alongside scenes, threads, and checkpoints in the chapter's `plan.json`.

Pros: no new API endpoints; lives in the existing plan artifact; persists across sessions; survives plan save/materialise cycles.
Cons: `plan.json` grows slightly; the working set is not a planning output (it is authoring metadata), so it reads oddly alongside `scenes[]` and `threads[]`.

**Option B: Derived from plan references**
The working set is derived at read time from all proposal ids referenced in the plan (as artifacts, NPCs, places, etc.). No new storage needed.

Pros: zero storage cost; always in sync with the plan.
Cons: proposals enrolled but not yet assigned to any scene are lost on reload; this breaks the staging-area purpose of the working set; the DM cannot pre-enrol proposals before deciding where to put them.

**Option C: Separate chapter working set endpoint**
A new resource: `GET/PATCH /api/v1/chapters/:id/working-set`.

Pros: cleanest conceptual separation; working set is first-class.
Cons: new API endpoint for what is essentially authoring metadata; over-engineered for the current scale.

**Resolved in ADR-0007:** Option A. The `plan.json` already owns chapter composition metadata; the working set is authoring metadata that naturally belongs there. A `workingSet` field on `ChapterPlan` is minimal, survives save cycles, and requires no new API surface.

ADR-0007 also resolves seeding: when a chapter plan is read and `workingSet` is absent or empty, the API returns a seeded working set collected from existing plan references (`artifactRef`, `npcs`, `places`, `adversaries`, `items`, `clueRefs`, `handoutRefs`, `factionRefs`).

### Decision 2: Drag-and-drop implementation

The prototype uses native HTML5 DnD. Three production options exist.

**Option A: @dnd-kit/core**
Modern, accessible, keyboard-navigable, TypeScript-native, actively maintained. Supports multiple DnD contexts (scene reorder + proposal-to-scene) in one app. No direct DOM manipulation.

**Option B: react-beautiful-dnd**
Polished list reorder animations. No longer actively maintained (Atlassian archived it in 2024). Not ideal for multi-surface DnD (reorder + cross-panel drag).

**Option C: Native HTML5 DnD**
No dependency. Works but: limited accessibility (no keyboard nav, no screen reader support), complex cross-browser behaviour, harder to test, no animation support.

**Resolved in ADR-0008:** Option A (`@dnd-kit/core` and `@dnd-kit/sortable`). It is the only option that satisfies accessibility requirements, supports both interaction types (scene reorder and proposal→scene assignment) cleanly, and has active maintenance.

### Decision 3: Inline proposal creation integration model

The inline creation panel needs to produce a proposal via the existing API and then enrol it in the working set.

**Option A: Reuse `ProposalForm.tsx` as a drawer component**
Extract the form/submission logic from `ProposalForm.tsx` into a shared component. Mount it as a slide-in panel inside the Atelier. The panel writes to `POST /api/v1/proposals` and then `PATCH /api/v1/chapters/:id/plan` to enrol.

**Option B: A new minimal creation form in the Atelier**
A lightweight form (type, title, brief, generate) scoped to the Atelier. Does not share code with `ProposalForm.tsx`.

**Resolved in ADR-0008:** Option A. `ProposalForm.tsx` already handles proposal type selection, generation, manual authoring, and validation display. Extracting it into a composable component is lower risk than duplicating form logic and keeps the creation surface consistent with the standalone proposals section.

---

## Scene Sub-Structure Constraints

The scene schema (`campaign-structure-scene.json`) defines a flat structure. Scenes have beats, facts, handouts, triggers, and joins — but not child scenes. The UI must not allow a scene to be dropped inside another scene.

Enforcement model:
- **Drop zones are type-aware.** The artifact zone only accepts `scene` and `encounter` proposals. The joins zone accepts relationship proposal types supported by Task 0006: `npc`, `place`, `adversary`, `item`, `clue`, `handout`, and `faction`. No zone accepts `scene` type into a child position.
- **Top-level rail only.** The canvas has a single-level scene rail. There is no nested drop target inside a scene card.
- **API validation.** The plan validator (`PATCH /api/v1/chapters/:id/plan`) enforces the schema contract on save regardless of what the UI permits.

This is not a new constraint — it is what the schema already requires. The Atelier just makes it visually obvious.

---

## Proposal Lifecycle and Catalog Eligibility

A recurring question from RFC-0004 and Task 0006: can reviewed-but-unpromoted proposals appear in the working set and be assigned to scenes?

**Ruling (per Task 0006, ADR-0005):** Yes. The working set may contain proposals at any lifecycle stage. The catalog shows them with their current status chip. Materialisation remains the hard gate: it blocks if any scene references an unpromoted proposal. The UI annotates these with a readiness indicator per scene.

This means the Atelier catalog will show proposed, reviewed, and promoted proposals — with visual distinction — without restricting the DM's ability to compose speculatively.

---

## API Implications

No new endpoints are required for the working set if Option A (plan.json field) is selected in ADR-0007.

The Atelier writes through existing endpoints:

| Action | Endpoint |
|---|---|
| Save chapter plan (including working set) | `PUT /api/v1/chapters/:id/plan` |
| Create new proposal from drawer | `POST /api/v1/proposals` |
| Enrol from corpus (bulk plan update) | `PATCH /api/v1/chapters/:id/plan` |
| Fetch working set proposal resolution | `GET /api/v1/proposals/resolve?ids=...` |
| Fetch proposal catalog | `GET /api/v1/proposals` |

The only schema change is adding `workingSet: string[]` to `ChapterPlan` in `@karsac/shared` and `plan.json`.

---

## What Changes in the Codebase

| Component | Change |
|---|---|
| `karsac-ui/src/ChapterCompositionWorkspace.tsx` | Replace with Atelier layout, working set catalog, DnD wiring |
| `karsac-ui/src/ProposalForm.tsx` | Extract into a composable drawer-compatible component |
| `karsac-ui/src/styles.css` | Add Atelier theme variables (warm palette, Lora serif, new chip/zone classes) |
| `packages/karsac-shared/` | Add `workingSet` field to `ChapterPlan` type |
| `karsac-registry/src/state/service.ts` and chapter API | Extend plan read/write to normalise, seed, and persist `workingSet` |
| `package.json` (karsac-ui) | Add `@dnd-kit/core`, `@dnd-kit/sortable` |

The existing chapter workspace route (`/chapters`) and mode switching (`state` vs `planning`) remain. The Atelier applies to `planning` mode only. The state-mode view (live chapter inspection) is not changed in this task.

---

## Resolved Questions

1. **Working set seeding:** resolved by ADR-0007. Seed from existing plan references on read when `workingSet` is absent or empty.

2. **Inline proposal lifecycle:** retain the normal proposal lifecycle. Inline creation creates a `proposed` proposal and enrols it in the working set; it does not auto-promote.

3. **Planning-mode boundary:** the Atelier replaces `ChapterCompositionWorkspace` in planning mode only. The state-mode/live chapter inspection view remains unchanged.

## Open Questions

1. Should the Atelier also expose the trigger-condition authoring workflow (Task 0005) within the composition canvas, or does that remain a separate surface?

2. The readiness indicator per scene shows Ready / Needs promotion / No artifact as a rollup. It must also expose per-artifact/per-join readiness detail in the expanded scene body so the DM can see which exact proposal blocks materialisation. Should trigger validation be included in the same readiness model in v1, or follow later?

---

## Recommended Follow-on

If this RFC is accepted:

- **ADR-0007** — working set persistence model
- **ADR-0008** — DnD library and inline proposal creation model
- **Task 0007** — Atelier chapter composition workspace implementation

---

## Claude (Sonnet 4.5) Review

This RFC is internally consistent and correctly positions the Atelier as a UX layer over an unchanged governance model. Three things warrant explicit attention before it closes.

**1. Open Question 1 should be answered here**

Working set seeding behaviour has an obvious right answer: seed from existing plan references on chapter load. On first open of a chapter with a populated plan, any proposal id already in `scenes[].artifactRef`, `scenes[].npcs`, `scenes[].places`, etc. should be auto-enrolled in `workingSet`. This prevents the catalog from appearing empty when the DM opens a chapter they were already composing. The DM can then add or remove from the working set. This seed-from-plan behavior costs nothing, prevents confusion, and can be implemented as a migration utility when the `workingSet` field is first introduced.

**2. The catalog eligibility ruling creates a UX communication burden**

Allowing proposed and reviewed proposals in the catalog means the readiness indicator on scene cards has to carry a lot of weight. A scene with a proposed artifact, a reviewed NPC, and a promoted place has three different readiness signals on two different joins. The Atelier prototype handles this with a per-scene chip, but the chip only reports the worst-case status. Consider whether the expanded scene body should annotate each join individually (artifact: ✓, NPC: ! reviewed, place: ✓) rather than rolling up. This is a detail for the task spec, not a blocker for the ADR.

**3. The Atelier replaces planning mode only — this boundary should be explicit in the task spec**

The RFC correctly states that state-mode (live chapter inspection) is unchanged. This must be made explicit in the task spec too, because `App.tsx` currently uses `chapterWorkspaceMode` to switch between `state` and `planning` and renders `ChapterCompositionWorkspace` only in `planning` mode. The Atelier refactor touches that component only. The state-mode view (`chapterDetailQuery` results, facts/beats/scenes/handouts tabs) is untouched.

Net: approve with the above noted for the task spec. The provisional ADR recommendations (Option A for working set, @dnd-kit for DnD, ProposalForm extraction for the drawer) are all correct.
