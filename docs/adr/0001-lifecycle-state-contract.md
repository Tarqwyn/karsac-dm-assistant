# ADR-0001: Lifecycle State Contract

**Status:** Accepted
**Date:** 2026-06-18
**Agreed by:** Claude (Opus 4.8) + Codex, ratified by project owner

---

## Context

The project needed a shared vocabulary for how corpus content, generated material, materialised tracker data, and live play state move through the system. Without this, the UI, registry, tracker, and map tooling would use inconsistent terms for what stage something is in, where it lives, who reads it, and who can mutate it.

---

## Decision

Adopt the 5-stage lifecycle:

```
proposed → reviewed → promoted → materialised → tracked
```

These are logical states, not just filenames.

### Stage definitions

| Stage | Location | Mutability | Reader | Writer |
|---|---|---|---|---|
| Proposed | `corpus/proposals/` | high | validators, reviewers, AI | AI proposal flow or manual edit |
| Reviewed | `corpus/proposals/` metadata | — | reviewers, promote pipeline | human review (approval flag on proposal record) |
| Promoted | `corpus/planning/` (or type-specific, e.g. `corpus/adversary-corpus/`) | medium | planning UI, seed builders, indexer | promote pipeline or UI promote action |
| Materialised | `corpus/state/` (e.g. `corpus/state/chapters/<id>/seed.json`) | low | tracker runtime, API, session tools | materialiser |
| Tracked | tracker runtime + `corpus/state/` session exports | session-driven | tracker UI, session controls | table play; explicit session-close export |

### Key rulings on previously open questions

**Q1 — How does promoted content become indexed/readable canon?**
Index in place. A single artifact lives in a single location. Canon status is expressed in frontmatter metadata (`canonical: provisional → true`). The indexer (`buildIndex`) is made aware of canonical status and scans the canonical subset wherever it lives. No second canon copy is created. Promotion target varies by type — adversaries already prove this works (they promote into `corpus/adversary-corpus/` and are read live).

**Q2 — What is "reviewed"?**
A metadata/approval state on the proposal record, not a separate corpus artifact or file format. Promotion requires approval state. A separate review log is added only if audit history later proves necessary.

**Q3 — Where does tracked state live?**
In tracker runtime during play. Exported back into `corpus/state/` only via an explicit session-close action — never continuously.

**Q4 — Which transitions need explicit UI confirmation?**
Minimum: `promoted` and `tracked`-export transitions. Full list to be specified in the UI write contract (follow-on work).

---

## Invariants

- The corpus is the source of truth.
- Materialised data must be derived from corpus content, never the reverse.
- The tracker must not invent canon.
- Promotion must be explicit.
- State mutation must be explicit.
- AI output must validate before it can be promoted.
- Hand-authored content must be able to enter the same lifecycle without AI.
- One artifact, one location. No duplication between lifecycle stages.

---

## Consequences

- `buildIndex` must be updated to scan canonical content in `corpus/planning/` (and other promote targets) rather than only `corpus/collections/`. This closes the current seam where promoted NPCs/places/items are invisible to retrieval.
- The `canonical` frontmatter field becomes a first-class gate for indexing, not just a label.
- `corpus/collections/` role needs clarifying in the audit — it currently holds the entities `buildIndex` reads, but under this decision `planning/` (with `canonical: true`) joins that set. The audit should decide whether `collections/` merges into `planning/` or remains as the legacy hand-authored canon location.
- The API and UI write contract for lifecycle transitions is follow-on work (see Recommended Next Step).
- Q4 (full list of UI transitions requiring confirmation) is deferred to the UI write contract.

---

## Recommended Next Step

Run the read/write lifecycle audit: map each lifecycle stage to its current on-disk location and reader, mark where the chain is severed (especially the `promoted → indexed` seam), and use the result as the contract for the CRUD API and UI actions.
