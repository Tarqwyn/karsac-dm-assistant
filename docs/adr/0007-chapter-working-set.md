# ADR-0007: Chapter Working Set Persistence Model

**Status:** Accepted
**Date:** 2026-06-26
**Agreed by:** Claude (Sonnet 4.5), project owner

---

## Context

RFC-0005 introduced the **chapter working set**: the set of proposals explicitly enrolled in a chapter's authoring context. The working set is the scoped proposal catalog shown in the Atelier composition surface. It is distinct from the chapter plan's scene assignments — a proposal can be enrolled in the working set before it is assigned to any scene.

Three persistence models were evaluated in RFC-0005. This ADR records the decision.

---

## Decision

**The working set is persisted as a `workingSet: string[]` field on the `ChapterPlan` document (`corpus/state/chapters/<id>/plan.json`).**

The field holds an ordered array of proposal ids enrolled in this chapter's authoring context. It is read and written through the existing plan endpoint (`PUT /api/v1/chapters/:id/plan`).

On first load of a chapter that has an existing plan, the working set is seeded from all proposal ids already referenced in the plan (artifact refs, NPC joins, place joins, adversary joins, item joins, clue refs, handout refs, faction refs). This ensures the catalog is not empty when the DM opens a chapter they were already composing.

---

## Why this model

### The working set is authoring metadata that belongs in the plan

`plan.json` already owns chapter composition metadata: scenes, threads, checkpoints, notes. The working set is the same kind of artifact — it is the DM's chapter-scoped authoring context, not a canonical corpus entity and not materialised tracker state. It belongs alongside the plan, not in a separate resource.

### It preserves the staging-area purpose

A proposal can be enrolled in the working set before it is assigned to any scene. A derived model (computing the working set from scene assignments) would lose these enrolled-but-unassigned proposals on reload. The field persists them correctly.

### No new API surface required

The plan endpoint already accepts a `ChapterPlan` object and persists it. Adding `workingSet` to the type is a non-breaking schema extension. No new route, handler, or storage concept is introduced.

### The seeding rule prevents a blank catalog on reopen

Auto-seeding from existing plan references on chapter load means the working set reflects the DM's prior work immediately. The DM can then add or remove proposals from the set without losing their existing composition.

---

## Why not Option B (derived)

Deriving the working set from scene assignments at read time is zero-cost but breaks the staging-area purpose. The DM cannot pre-enrol proposals before deciding which scene to put them in. Any proposal enrolled but not yet assigned disappears on reload. This makes the working set a view rather than an authoring tool, which reduces its value.

---

## Why not Option C (separate endpoint)

A dedicated working set resource (`GET/PATCH /api/v1/chapters/:id/working-set`) is the cleanest conceptual separation but introduces a new API resource for what is authoring metadata rather than a domain entity. It also introduces a second write path alongside the plan save, creating the possibility of the plan and working set falling out of sync. Option A avoids this by keeping them in one document.

---

## Schema change

Add to `ChapterPlan` in `@karsac/shared`:

```typescript
workingSet?: string[]
```

Optional with empty-array default so that existing plan documents without the field remain valid.

Add to `plan.json` schema (`schemas/state/chapters/`):

```json
"workingSet": {
  "type": "array",
  "items": { "type": "string" },
  "description": "Proposal ids enrolled in this chapter's authoring working set.",
  "default": []
}
```

---

## API change

The plan endpoint already accepts the full `ChapterPlan` object. No route change is needed. The handler must persist `workingSet` alongside the existing plan fields without special-casing it.

The plan read endpoint (`GET /api/v1/chapters/:id/plan`) should apply the seeding rule at read time when `workingSet` is absent or empty: collect all proposal ids referenced anywhere in the plan and return them as the initial `workingSet` value. This seeding is computed at read time, not written back automatically — the DM's first explicit save will persist the seeded set.

---

## Lifecycle boundary

`workingSet` is authoring metadata. It is:

- **Not** a promoted corpus entity
- **Not** materialised tracker state
- **Not** read by the tracker or the session runtime

The materialiser ignores `workingSet` when deriving tracker-facing state files. It reads only `scenes`, `threads`, and `checkpoints`.

---

## Consequences

- `ChapterPlan` in `@karsac/shared` gains a `workingSet` optional field
- The plan JSON schema gains the corresponding property
- The plan read handler applies the seeding rule when `workingSet` is absent
- The Atelier UI reads and writes `workingSet` through the standard plan save
- The materialiser is unchanged
- Existing plan documents without `workingSet` remain valid and behave as if the field is `[]`

---

## Not in scope

- Working set across multiple chapters (each chapter has its own working set in its own `plan.json`)
- Working set visibility rules (the working set is a DM-only authoring tool; it is never exposed to the tracker or player-facing surfaces)
- Automatic promotion of enrolled proposals (promotion remains an explicit governed action)

---

## Related documents

- [RFC-0005 — Atelier Chapter Authoring UX](../rfc/0005-atelier-chapter-authoring-ux.md)
- [ADR-0006 — Chapter Composition Model](0006-chapter-composition-model.md)
- [ADR-0005 — Proposals as the Primary Authoring Unit](0005-proposals-as-primary-authoring-unit.md)
- [ADR-0003 — REST API as Primary Interface](0003-rest-api-as-primary-interface.md)
