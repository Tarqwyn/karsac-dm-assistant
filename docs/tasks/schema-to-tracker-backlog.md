# Schema To Tracker Backlog

This document tracks the remaining non-schema-driven pieces that still block a fully direct path from AI output into tracker-ready content.

## Done

- Design schemas exist for volume, chapter, scene, beat, timer, theme, and global entities.
- Runtime state schemas validate chapter state, player knowledge, threads, and campaign data.
- Proposal contracts and routing already exist for several proposal types.
- Chapter 3 is promoted, seeded, and materialized.
- The tracker reads live chapter state from the assistant runtime.

## Remaining gaps

### 1. Structured proposal emission

Current proposal generation still mostly emits Markdown prose, then validates it.

What is missing:
- Structured JSON output for `volume`, `chapter`, `scene`, `beat`, and global entity proposals.
- A deterministic render step from structured output back to Markdown where needed.
- Validation that the structured payload matches the design schema before anything is written to corpus.

Why it matters:
- Until proposal output is structured, the model can still drift from the tracker model even if the schema exists.

### 2. Proposal-to-seed conversion

We can already author Chapter 3 seed data by hand from an approved outline.

What is missing:
- A repeatable converter from approved `chapter-outline` to `corpus/state/chapters/<chapter>/seed.json`.
- Equivalent conversion paths for scene/thread/global entity proposals where appropriate.
- Validation that the seed conforms to the design model before materialization.

Why it matters:
- This is the point where the AI output becomes tracker-driving data instead of just planning text.

### 3. Full tracker shell corpus ownership

The tracker is data-driven for state, but not every presentation layer is yet owned by corpus.

What is missing:
- Chapter shell text for legacy Chapter 2 material.
- A clean corpus-backed presentation source for the overview / playface panels.
- A single rendering path for static legacy chapters and data-driven chapters.

Why it matters:
- The AI needs the shell structure in corpus if it is going to generate content that lands directly in the UI.

### 4. Scene / thread / encounter authoring pipeline

We now have the design schema, but the authoring pipeline is not yet forced to emit it for all scene-like content.

What is missing:
- Schema-backed generation for scene proposals, encounter proposals, and thread/hub variants.
- Explicit support for scene beats as authored arrays in generated content.
- Consistent handling of optional timers, subscenes, cast, adversaries, facts, and handouts.

Why it matters:
- This is the layer that turns chapter planning into actual play units.

### 5. Frontend orchestration

The final step is still manual.

What is missing:
- A frontend that can:
  - ask for a chapter outline
  - validate it
  - promote it
  - derive seed data
  - materialize chapter state
  - switch / lock chapter context
  - preview the resulting tracker state

Why it matters:
- This is the workflow the user actually wants to operate without touching the pipeline internals.

## Priority order

1. Structured proposal emission.
2. Proposal-to-seed conversion.
3. Scene / thread / encounter authoring pipeline.
4. Full tracker shell corpus ownership.
5. Frontend orchestration.

## Practical rule

If a piece of content needs to drive the tracker directly, it must exist in one of these forms:

- schema-backed design content
- schema-backed state content
- corpus planning material derived from the schema

Anything else is still transitional and should be treated as a backlog item.
