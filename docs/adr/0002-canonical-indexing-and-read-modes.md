# ADR-0002: Canonical Indexing and Read Modes

**Status:** Accepted
**Date:** 2026-06-18
**Agreed by:** Claude (Opus 4.8) + Codex, designed by project owner

---

## Context

The lifecycle audit (docs/rfc/0002-lifecycle-read-write-audit.md) confirmed that promoted content in `corpus/planning/` is invisible to retrieval — `buildIndex` only scans `corpus/collections/`, and no `ask.ts` profile reads `planning/`. This means "promote in the UI" currently pushes content into a read-void.

Two requirements had to be satisfied simultaneously:

1. **Data cleanliness** — one artifact, one location, no duplicate canon copies. The `canonical` frontmatter field must become a real read-time gate, not just a label.
2. **Far-ahead planning** — the DM must be able to promote Chapter 4 NPCs, places, and scenes right now without those appearing in live play prompts or leaking into active session context.

These two requirements pointed to the same solution: a single corpus with explicit read modes, not two canon trees.

---

## Decision

**One corpus, two explicit read modes: `live` and `planning`.**

### Corpus structure

- `corpus/planning/` is the authoritative tree for all promoted content (AI-generated or manually authored via the proposal pipeline).
- `corpus/collections/` remains as the legacy hand-authored canon layer. It continues to be indexed as-is. It does not grow — new content enters only via proposals and promotion. Over time, hand-authored content in `collections/` may migrate to `planning/` via the proposal pipeline, but this is not a prerequisite.
- No content is duplicated between trees. One artifact, one location.

### Canonical status and live-mode gate

The live/planning read gate is **source tree**, not canonical value. This reflects the empirical corpus state: many live-readable entities in `corpus/collections/` carry `canonical: provisional`, so using that value as a visibility gate would incorrectly hide them.

The actual rules implemented:

| Source | `canonical` value | Visible in live mode? | Visible in planning mode? |
|---|---|---|---|
| `collections` | any | Yes — collections is always live-visible | Yes |
| `planning` | `true` | Yes — explicitly blessed | Yes |
| `planning` | `provisional` or absent | No — hidden until blessed | Yes |

The `canonical` field's role: it gates visibility for **planning-tree entities only**. Setting `canonical: true` on a planning entity is the explicit blessing action that makes it appear in live mode. For collections entities it is metadata only — it does not affect visibility.

### Read modes

| Mode | What it reads | Default? |
|---|---|---|
| `live` | All `collections` entities + `planning` entities with `canonical: true` + current chapter state | Yes — all assistant and tracker reads |
| `planning` | All indexed entities from both trees + chapter-scoped future material | Explicit opt-in — UI planning view, far-ahead authoring |

### `buildIndex` change

`buildIndex` scans both `COLLECTIONS_ROOT` (`corpus/collections/`) and `PLANNING_ROOT` (`corpus/planning/`). Each entity is tagged with its source tree (`collections` or `planning`) so the query layer can apply the source-based gate at read time.

---

## Consequences

- **Fixes Critical Seam #1** from the audit: promoted content becomes visible to retrieval.
- **Fixes Critical Seam #2**: source tree is now a real read-time gate. `canonical` gates visibility within the planning tree specifically.
- Far-ahead planning is safe: a promoted Chapter 4 NPC in `corpus/planning/` is in the index but invisible to live play by default. Setting `canonical: true` is the explicit action that blesses it into live mode.
- The DM can explicitly switch to planning mode to work on future material without it leaking into active session context.
- `corpus/collections/` requires no migration work before the seam is fixed — it continues to work as-is.
- `buildIndex` needs a `PLANNING_ROOT` scan path added (env-overridable, consistent with existing `paths.ts` pattern).
- `ask.ts` entity resolution needs a mode parameter (defaulting to `live`) that filters by `canonical` status.
- The UI must expose a `live` / `planning` toggle and default all chat and tracker views to `live`.

## Follow-on work (not in scope here)

- ADR-0003: Materialisation hooks per promoted type (Seam #3 from audit)
- ADR-0004: Session-close export (Seam #4 from audit)
- The `collections/` → `planning/` migration path (optional, long-term)
