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

### Canonical status

The `canonical` frontmatter field becomes a real read-time gate:

| Value | Meaning | Indexed? | Visible in live mode? |
|---|---|---|---|
| `true` | Blessed canon — part of the active world | Yes | Yes |
| `provisional` | Promoted but not yet blessed — planned or pending review | Yes (tagged) | No (planning mode only) |
| absent / other | Legacy or unclassified | Yes (treated as `true` for collections/) | Yes |

### Read modes

| Mode | What it reads | Default? |
|---|---|---|
| `live` | `canonical: true` entries from both trees + current chapter state from `corpus/state/` | Yes — all assistant and tracker reads |
| `planning` | All indexed entries including `canonical: provisional` + chapter-scoped future material | Explicit opt-in — UI planning view, far-ahead authoring |

### `buildIndex` change

`buildIndex` scans both `COLLECTIONS_ROOT` (`corpus/collections/`) and `PLANNING_ROOT` (`corpus/planning/`). Entries from `planning/` are tagged with their `canonical` value so the query layer can filter by mode. Entries from `collections/` without a `canonical` field are treated as `true` (backwards-compatible).

---

## Consequences

- **Fixes Critical Seam #1** from the audit: promoted content becomes visible to retrieval.
- **Fixes Critical Seam #2**: `canonical` is now a read-time gate, not just metadata.
- Far-ahead planning is safe: a promoted Chapter 4 NPC with `canonical: provisional` is in the index but invisible to live play by default.
- The DM can explicitly switch to planning mode to work on future material without it leaking into active session context.
- `corpus/collections/` requires no migration work before the seam is fixed — it continues to work as-is.
- `buildIndex` needs a `PLANNING_ROOT` scan path added (env-overridable, consistent with existing `paths.ts` pattern).
- `ask.ts` entity resolution needs a mode parameter (defaulting to `live`) that filters by `canonical` status.
- The UI must expose a `live` / `planning` toggle and default all chat and tracker views to `live`.

## Follow-on work (not in scope here)

- ADR-0003: Materialisation hooks per promoted type (Seam #3 from audit)
- ADR-0004: Session-close export (Seam #4 from audit)
- The `collections/` → `planning/` migration path (optional, long-term)
