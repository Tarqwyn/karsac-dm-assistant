# ADR-0006: Chapter Composition Model

**Status:** Accepted
**Date:** 2026-06-22
**Agreed by:** Claude (Sonnet 4.6) + Codex, project owner

---

## Context

RFC-0004 established that chapter authoring should be treated as composition rather than as editing one large transient draft blob.

That RFC left one key design question open long enough to evaluate options explicitly:

**Where does chapter composition data live before materialisation, and what kind of artifact is it?**

Three candidate models were considered:

- **Option A:** `corpus/plans/chapters/<id>/plan.json`
- **Option B:** `corpus/state/chapters/<id>/plan.json`
- **Option C:** `chapter-plan` as a proposal type

The system needed a choice that:

- keeps chapter plans distinct from promoted corpus entities
- supports repeated editing before materialisation
- fits the existing state/materialisation pipeline with low implementation friction
- avoids imposing a proposal lifecycle on what is effectively a mutable assembly document

---

## Decision

**Chapter composition data lives at `corpus/state/chapters/<id>/plan.json`.**

The chapter plan is a first-class planning artifact that sits between `promoted` and `materialised` in the existing lifecycle.

It is:

- not a promoted corpus entity
- not tracker runtime state
- not a proposal record

It is the assembly document that:

- references eligible promoted artifacts
- stores chapter-local assembly data
- captures joins, ordering, and planning metadata
- acts as the input to explicit materialisation

---

## Why Option B

### Lowest-friction path

The existing system already organises chapter-related derived artifacts under:

`corpus/state/chapters/<id>/`

Placing `plan.json` in that folder:

- reuses the existing chapter-root structure
- keeps plan-to-materialisation flows simple
- avoids introducing a new top-level storage concept immediately

### Distinct from tracker state by contract

Although `plan.json` lives alongside materialised chapter files, it is distinguished by role:

- `plan.json` is a planning/composition input
- `progress.json`, `facts.json`, `handouts.json`, `beats.json`, `radar.json`, `triggers.json`, and `scenes.json` are materialised outputs

The tracker must not read `plan.json` directly.

### Better fit than a proposal-shaped plan

Treating the chapter plan as a proposal record would over-govern a working document the DM may revise many times before materialisation. That is the wrong operational weight for a mutable assembly artifact.

---

## Why not Option A

`corpus/plans/chapters/<id>/plan.json` is architecturally cleaner in isolation, but it adds a new root and another storage concept before there is evidence that the additional separation is worth the cost.

This remains a viable future refactor if chapter plans become substantially more complex or need an independent storage boundary.

## Why not Option C

Making the chapter plan itself a proposal would:

- add review/promotion weight to a mutable working document
- blur the distinction between reusable promoted corpus artifacts and chapter-local assembly
- slow the planning loop unnecessarily

Proposal-backed entities remain inputs to chapter composition. The chapter plan itself is not a proposal.

---

## Chapter Plan Contents

`plan.json` is expected to store:

- references to promoted chapter-relevant artifacts
- chapter-local ordering information
- chapter-local joins
- operational planning metadata
- materialisation-ready chapter structure

Examples of chapter-local data that belong here:

- beat ordering
- trigger conditions
- scene ordering
- handout attachment metadata
- chapter-local framing notes

The precise schema belongs to task and implementation work, but the role of the artifact is fixed by this ADR.

---

## Lifecycle Placement

The chapter plan is a planning/composition sub-phase between `promoted` and `materialised`.

That means:

- promoted artifacts become eligible inputs
- the plan assembles those inputs into a chapter shape
- materialisation derives tracker-facing state from the plan

This decision does **not** add a new top-level lifecycle stage to ADR-0001.

---

## Consequences

- The chapter composition workspace writes to `plan.json` through the REST API, never directly to disk.
- Materialisation operations consume `plan.json` and emit tracker-facing chapter state files.
- Tracker code remains focused on materialised state only.
- The system can support repeated planning edits without forcing each iteration through a proposal/review/promote cycle.
- The chapter plan now has a stable storage location that other tooling can reason about.

---

## Guardrails

- `plan.json` must not be treated as live tracker state.
- `plan.json` must not silently create promoted corpus entities.
- If a plan references promoted artifacts, those references should be explicit rather than copied into the plan as authoritative content.
- If the UI allows draft inclusion of reviewed-but-unpromoted artifacts, that behavior must be an explicit task-level decision rather than an accidental side effect of storage.

---

## Not in scope

- The exact `plan.json` schema
- Whether reviewed-but-unpromoted artifacts may participate in chapter planning
- Final layout of the chapter composition workspace
- Tracker redesign details

Those belong in the next task specs.
