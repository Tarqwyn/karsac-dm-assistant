# ADR-0004: UI Application Architecture

**Status:** Accepted
**Date:** 2026-06-19
**Agreed by:** Claude (Sonnet 4.6) + Codex, project owner

---

## Context

Three front-end surfaces exist or are planned: a new Karsac UI (not yet built), the existing KarsacTracker (~3,200 lines vanilla HTML/JS, session-hardcoded), and KarsacMapMaker (built, deployed, React 18 + Vite). The REST API (ADR-0003) is the agreed primary interface for all surfaces.

Decisions were needed on: framework, monorepo vs separate repos, one app vs multiple apps, how the Map consumes corpus data, and where the id join between Map geometry and corpus lore lives.

See RFC `docs/rfc/0003-ui-app-architecture.md` for full discussion and findings.

---

## Decisions

### 1. Framework: React 18 + Vite

React 18 + Vite for the new Karsac UI and the refactored Tracker. The Map is already on this stack — aligning is the only way to share components. The Tracker is small enough (~3,200 lines) to rebuild cleanly.

### 2. Monorepo, two apps, shared package, independent deployments

```
karsac-dm-assistant/          (monorepo root)
  karsac-registry/            Existing — API, corpus engine, CLI
  karsac-ui/                  New — React: authoring, review, promote,
                              planning view, tracker, session-close
  KarsacMapMaker/             Existing — React: map editor, player view, DM reveal
  packages/
    karsac-shared/            Shared types + component primitives (workspace package)
```

Both apps live in this repo. Each has its own Vite build and deployment pipeline — `karsac-ui` deploys as one unit; `KarsacMapMaker` keeps its existing three-build S3 pipeline (player, editor, canvas). They share via `packages/karsac-shared` without deployment coupling.

The Tracker is merged into `karsac-ui` — same audience, same session, same API. Keeping it separate would mean two DM apps always open at once.

### 3. Map geometry stays local, lore comes from the API

Geometry (`data.js` — coordinates, polygon boundaries, tier, region) is Map-specific and stays in the Map. The corpus owns lore, relationships, visibility, and canonical status.

The Map merges at runtime:

```
GET /api/v1/corpus?mode=live&type=place  →  lore, visibility, relationships
data.js                                  →  x, y, poly, tier, region
merge on id                              →  render with lore, respecting visibility
```

Player view uses `mode=live` (visibility-gated). DM view uses `mode=live` or `mode=planning` for future content.

### 4. ID join: `map_id` field on corpus place entities (Option B)

Map uses bare slugs (`"torweg"`). Corpus uses namespaced ids (`"places/torweg"`). The join is resolved by adding an optional `map_id` field to the corpus place schema — set where a place exists in both corpus and Map. No breaking change to the Map. No consumer-side slug-stripping logic.

The API indexes by `map_id` to support direct lookup: `GET /api/v1/corpus/place/by-map-id/torweg`.

### 5. Player reveal system sits alongside corpus `visibility` for now

The Map's existing `player-reveal.js` is not replaced immediately. It sits alongside the corpus `visibility` field as a migration path. Corpus `visibility` gradually takes over as the authoritative gate; `player-reveal.js` is removed when the migration is complete (no flag day).

---

## Scope boundary (Codex)

Task 0002 builds the Karsac UI shell and corpus workspace first. Map/corpus integration (`map_id`, lore merge, visibility gate) is a follow-on milestone — not part of the first UI task.

---

## Consequences

- `karsac-ui/` and `packages/karsac-shared/` are new directories to scaffold in this repo
- `KarsacMapMaker/` moves into this repo (currently in a sibling repo) — or stays linked until the monorepo workspace is set up
- The data audit (Map ↔ corpus place/region alignment) is a prerequisite before Map integration begins — see RFC section "Prerequisites Before Task 0002 Starts"
- `map_id` field needs adding to the corpus place schema and populating for known map places
- `karsac-shared` types are derived from the API contract (Task 0001) — no types should be invented ahead of what the API returns

---

## Follow-on work

- Task 0002: Karsac UI shell + corpus workspace
- Map ↔ corpus data audit (scripted, before Map integration milestone)
- Map integration milestone: `map_id` population, lore merge at runtime, `visibility` replacing `player-reveal.js`
- `packages/karsac-shared` grows as shared components emerge — not pre-built speculatively
