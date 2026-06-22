# RFC-0004: Proposal-Backed Chapter Authoring

**Date:** 2026-06-22
**Status:** Accepted
**Scope:** Define the workflow for creating chapter content through proposals and composing that content into a chapter plan in the UI.

---

## Purpose

Decide how the DM should create future chapter content without relying on the current ad hoc draft-editor flow.

This RFC covers:

- proposals as the primary authoring unit for new content
- chapter composition as a first-class planning workflow
- the joins the DM must be able to create in the UI
- how proposal lifecycle and chapter materialisation fit together

This RFC does **not** decide final screen layout or tracker redesign details.

---

## Problem

Task 0002 delivered a working UI shell, proposal review surface, rebuilt tracker, and session-close flow. It did **not** settle the long-term chapter authoring model.

The current `Chapters` workspace proves out some planning interactions, but it has two structural problems:

1. It is built around editing a transient chapter draft blob rather than around the system's actual lifecycle model.
2. It does not make proposals and chapter composition one coherent operator workflow.

This creates a mismatch:

- the backend's core asset is the constrained proposal pipeline
- the UI's current chapter editing path is a local draft editor

If expanded as-is, the UI will deepen the wrong abstraction.

---

## Goals

- Make proposals the primary creation path for new chapter-relevant content
- Let the DM compose a chapter from proposal-backed pieces in the UI
- Keep the lifecycle explicit: proposed -> reviewed -> promoted -> materialised -> tracked
- Preserve the rule that the tracker operates on materialised state, not on raw authoring drafts
- Support hand-authored content through the same lifecycle, without requiring AI

## Non-goals

- Finalise the tracker UX redesign
- Replace all direct corpus editing in one step
- Build a full WYSIWYG rich-text CMS
- Solve Map integration in this milestone

---

## Operator Workflows

### Workflow 1: Create a new chapter-relevant artifact

The DM can create a proposal for:

- chapter outlines
- scenes
- NPCs
- places
- factions
- items
- handouts
- beats
- encounters
- world-thread-supporting content

The source of the proposal may be:

- AI generation through the constrained proposal pipeline
- manual authoring in the UI
- manual authoring on disk, then reviewed in the UI

The important rule is that **new authored content enters the lifecycle as a proposal record**.

### Workflow 2: Review and refine the proposal

The DM can:

- inspect the proposal body and frontmatter
- view validation state and issues
- edit the proposal in situ
- mark it reviewed
- promote it when ready

This preserves the existing proposal governance model while making it practical in the UI.

### Workflow 3: Compose a chapter from approved pieces

The DM can open a chapter planning workspace and:

- create a chapter plan
- attach proposal-backed scenes
- attach linked NPCs, places, items, handouts, and beats
- set ordering and chapter-local framing metadata
- create the joins needed for the chapter shape

This is the missing operator capability today.

### Workflow 4: Materialise the chapter

Once the chapter plan is ready, the DM can explicitly materialise it into chapter state.

Materialisation derives tracker-facing state files such as:

- `progress.json`
- `facts.json`
- `handouts.json`
- `beats.json`
- `radar.json`
- `triggers.json`
- `scenes.json`

The tracker continues to read materialised state only.

---

## Proposed Model

### 1. Proposals are the primary authoring unit

New content should be created and refined as proposals before it becomes promoted corpus content.

This aligns the UI with the existing governance engine:

- schema validation
- policy validation
- explicit review state
- explicit promotion gate

It also ensures AI-authored and hand-authored content travel through the same contract.

This rule should be applied explicitly:

- if an artifact becomes a promoted corpus entity, it begins life as a proposal
- if an artifact is chapter-local assembly data, it may be authored directly in the chapter plan

Examples of content that should require proposals:

- NPCs
- places
- factions
- items
- chapter outlines
- scenes that are treated as promoted corpus entities

Examples of content that may live directly in the chapter plan:

- beat ordering
- trigger conditions
- chapter-local framing metadata
- handout labels or operational notes that are not standalone corpus records

This is not an escape hatch from governance. It is a recognition that the chapter plan is its own first-class artifact, distinct from promoted corpus content.

### 2. Chapter authoring is composition, not blob editing

A chapter should not be treated as a single large mutable draft blob in the UI.

Instead, chapter planning should be understood as:

- selecting or creating chapter-relevant pieces
- attaching them into a chapter structure
- ordering them
- defining chapter-local relationships and runtime cues

This keeps the planning workflow closer to the real data model and makes reuse possible across chapters.

### 3. Joins are first-class UI operations

The UI must let the DM create and maintain the joins between chapter pieces.

Examples:

- a scene references an NPC and a place
- a handout is attached to a scene
- a beat belongs to a scene and advances a thread
- a chapter plan orders scenes and associates chapter-local facts

These joins should not depend on hand-editing raw metadata in markdown unless the DM chooses to do so.

### 4. Tracker state remains derived

The tracker must continue to operate on materialised chapter state, not on proposal bodies or chapter planning drafts.

This preserves the core system rule:

- authoring artifacts are source material
- runtime state is a derived operational surface

### 5. Chapter composition sits between promoted and materialised

Chapter composition should be treated as a planning/composition sub-phase between `promoted` and `materialised`.

That means:

- promoted artifacts are eligible inputs to chapter planning
- the chapter plan is the assembly surface that turns those inputs into a playable chapter shape
- materialisation derives tracker state from that assembled chapter plan

This RFC does **not** propose changing ADR-0001's lifecycle stages yet. It only clarifies where chapter composition sits within the existing flow.

---

## Lifecycle Mapping

| Stage | Artifact | Primary UI Surface |
|---|---|---|
| Proposed | proposal markdown record | proposal authoring/review |
| Reviewed | proposal metadata | proposal review |
| Promoted | promoted corpus entity | corpus + chapter planning |
| Materialised | chapter state bundle | chapter planning + tracker prep |
| Tracked | live session mutations | tracker |

The chapter planning workspace sits mainly across **promoted** and **materialised** stages.

---

## UI Implications

The next UI milestone should introduce two tightly-coupled surfaces.

### Proposal Authoring and Review

Capabilities:

- create new proposals by type
- edit proposal body/frontmatter
- inspect validation status
- review and promote

### Chapter Composition Workspace

Capabilities:

- select the target chapter
- browse eligible proposal-backed pieces
- attach and order those pieces
- create joins
- preview chapter shape before materialisation
- trigger materialisation explicitly

The existing `Planning Draft` chapter editor should not be expanded as the long-term authoring model. It may remain as a transitional tool, but it should not define the architecture of future chapter work.

---

## API Implications

The current REST surface already supports proposal review/promotion and chapter state reads. This RFC implies further API work in three areas:

1. Proposal creation and update endpoints suitable for UI authoring
2. Chapter composition endpoints or storage contracts for chapter plans and joins
3. Explicit materialisation operations from chapter plan to chapter state

The API contract should preserve the rule that the UI writes through the REST layer, never directly to disk.

---

## Alternatives Considered

### A. Expand the current chapter draft editor

Rejected as the primary direction.

Reason:

- it builds around a transient draft blob
- it weakens the proposal lifecycle
- it duplicates authoring logic that should live in proposal-backed composition

### B. Ship proposal UI first, chapter composition later

Rejected as a standalone milestone shape.

Reason:

- proposal UI alone does not solve chapter authoring
- chapter composition without proposal-backed pieces encourages the wrong abstraction

These should be designed together and delivered as one coherent feature stream.

### C. Allow direct chapter editing as the main path

Rejected as the default model.

Reason:

- it bypasses review/governance for new authored content
- it makes chapter state harder to reason about
- it blurs the line between authoring and runtime materialisation

Direct editing may still exist as an escape hatch or maintenance tool, but not as the primary workflow.

---

## Open Questions

1. Where should chapter composition data live before materialisation?
2. Which joins belong in promoted corpus entities versus chapter-local planning data?
3. Should materialisation require all attached pieces to be promoted, or can reviewed-but-unpromoted pieces participate in a draft chapter plan?
4. How much in-situ editing should happen inside the chapter workspace versus redirecting back to proposal editing?

### Candidate storage models for chapter composition data

Before ADR-0006 is written, the RFC should make the candidate models explicit.

#### Option A: `corpus/plans/chapters/<id>/plan.json`

A separate plans root, distinct from both promoted corpus entities and materialised state.

Pros:

- cleanest conceptual separation
- makes it obvious that chapter plans are neither canonical corpus entities nor runtime tracker state

Cons:

- introduces a new root to manage
- adds another storage concept to the system

#### Option B: `corpus/state/chapters/<id>/plan.json`

Store the chapter plan alongside the existing chapter state files, distinguished by filename and usage.

Pros:

- lowest-friction implementation path
- fits the existing state root and chapter folder model
- easy to feed into materialisation

Cons:

- less conceptually clean than a dedicated plans root
- risks confusion unless the distinction between `plan.json` and tracker-facing state files is kept explicit

#### Option C: `chapter-plan` as a proposal type

Treat the chapter plan itself as a proposal record and run it through the proposal lifecycle.

Pros:

- highly consistent with proposals-as-primary-authoring-unit
- keeps all authored artifacts inside one lifecycle shape

Cons:

- operationally heavy for a mutable working document
- poor fit for an artifact the DM may revise repeatedly before materialisation

Provisional recommendation:

- evaluate **Option B** first in ADR-0006 because it is the lowest-friction path
- keep **Option A** as the cleaner long-term alternative if chapter plans grow more complex
- do not prefer **Option C** unless there is a strong reason to govern chapter plans as proposals

---

## Recommended Follow-on

If this RFC is accepted, the next documents should be:

- **ADR-0005** — whether proposals are the primary authoring unit
- **ADR-0006** — the chapter composition model and where composition data lives
- **Task 0003** — proposal authoring and review UI
- **Task 0004** — chapter composition workspace

---

## Claude Review

This direction is correct and the Codex response is well-aligned. Three things should be resolved before this RFC closes.

### 1. Open Question 1 should be answered here, not deferred

The RFC asks whether every chapter-relevant artifact must begin as a proposal. This needs a recommended answer now — Task 0003 scope depends on it.

Recommended answer: proposals are mandatory for any content that becomes a promoted corpus entity (NPC, place, faction, item, chapter outline, scene as a corpus entity). Chapter-local operational data — beat ordering, trigger conditions, handout labels that are not standalone corpus records — may be authored directly in the chapter plan without going through the full proposal lifecycle.

The line is: does this content live in the promoted corpus tree, or is it chapter-local assembly data? If corpus, it needs a proposal. If chapter plan, it can be authored in situ. This is not an escape hatch — it is recognising that the chapter plan is its own first-class artifact with its own authoring surface.

### 2. Open Question 2 needs candidate options before the ADR is written

"Where does chapter composition data live before materialisation?" is the ADR that unblocks everything else. Three options:

- **(A) `corpus/plans/chapters/<id>/plan.json`** — a new plans directory, separate from both corpus and state. Cleanest separation but a new root to manage.
- **(B) `corpus/state/chapters/<id>/plan.json`** — alongside materialised state files, distinguishable by filename. Lower friction; uses the existing state root; never read by the tracker.
- **(C) A `chapter-plan` proposal type** — the chapter plan is itself a proposal record and travels through the proposal lifecycle. Most consistent with proposals-as-primary-unit but operationally awkward for a working document the DM edits many times before materialising.

Option B is the lowest-friction path. Option A is architecturally cleaner if chapter plans grow in complexity. Option C is theoretically consistent but creates a heavy lifecycle for what is essentially a mutable scratchpad. ADR-0006 should evaluate B first.

### 3. The lifecycle has an implicit new stage

ADR-0001 lifecycle: proposed → reviewed → promoted → materialised → tracked.

Chapter composition sits between promoted and materialised — you need promoted pieces before you can compose, and a composed plan before you can materialise. The RFC describes this implicitly but does not name it. Before ADR-0005/0006 are issued, one of the following should be explicit:

- ADR-0001 is extended to add a **composed** stage between promoted and materialised
- Or this RFC states explicitly that composition is a sub-phase of materialisation that the existing lifecycle already covers

Without this, the lifecycle documentation will be ambiguous about where the chapter plan sits.

Open Questions 3–5 are appropriate as ADR and task-spec decisions. They can remain deferred.

---

## Codex Response

This direction is the right correction after Task 0002.

The important architectural move is that chapter authoring stops being treated as editing a large transient draft blob and becomes a composition workflow built from proposal-backed artifacts. That aligns the UI with the actual strength of the system: constrained proposals, explicit review, explicit promotion, and explicit materialisation.

I agree with the milestone shape implied here:

- proposal authoring/review and chapter composition should be designed together
- they may be implemented as separate tasks, but they are one feature stream
- the current planning draft editor should not be expanded into the long-term model

The main decisions still to lock are:

- whether proposals are mandatory as the creation path for all new authored content
- where chapter composition data lives before materialisation

Those belong in ADRs, not in this RFC.
