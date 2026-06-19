# RFC: UI Application Architecture

Status: Draft

## Purpose

Decide the application architecture for the Karsac UI and how it relates to the existing Map and Tracker. Specifically:

- Which framework and build tooling
- One app or multiple apps
- How the Map consumes corpus data
- Where the id join between Map geometry and corpus lore lives

This RFC exists so Task 0002 (Karsac UI) and future Map work have a clear architectural contract before development starts.

---

## Context

Three front-end surfaces exist or are planned:

| Surface | Current state | Tech |
|---|---|---|
| Karsac UI | Not yet built | — |
| KarsacTracker | ~3,200 lines vanilla HTML/JS, session-hardcoded | No framework |
| KarsacMapMaker | Built, deployed, working | React 18 + Vite |

The Map is already React 18 + Vite. MyOverallPlan.md explicitly asked whether to refactor the Tracker into React so it aligns with the Map technology.

The REST API (Task 0001) is the agreed primary interface for all front-end surfaces (ADR-0003).

---

## Findings from Map data inspection

`KarsacMapMaker/data.js` (248 lines, static, hand-maintained) contains:

- **Regions** — SVG polygon boundaries (`poly`), `id`, `name`, `labelPos`, `blurb`. No corpus link.
- **Cities** — `id`, `name`, `x`/`y` coordinates, `tier` (1=capital, 2=town, 3=small), `region`. No lore fields beyond name.

The file comment states: *"Lore fields are placeholders — easy to fill in later."*

The Map already has a **reveal system** (`player-reveal.js`) that distinguishes what players see vs. what the DM sees — directly analogous to `visibility: dm-only / player-safe` in the corpus frontmatter.

**The Map has no corpus connection today.** All data is static.

**ID alignment gap:** Map uses bare slugs (`"torweg"`, `"valweg"`). Corpus uses namespaced ids (`"places/torweg"`, `"places/valweg"`). A join between Map geometry and corpus lore requires stripping or mapping the namespace prefix. This must be resolved explicitly — it should not be left to each consumer to handle independently.

---

## Proposed Decisions

### 1. Framework: React 18 + Vite

Use React 18 + Vite for the Karsac UI and the refactored Tracker. Rationale: the Map is already React 18 + Vite. Aligning on the same stack is the only way to share components between surfaces. The Tracker is small enough (~3,200 lines) to rebuild cleanly.

### 2. App structure: Monorepo, two apps, shared package, independent deployments

```
karsac-dm-assistant/          (this repo — monorepo root)
  karsac-registry/            Existing — API, corpus engine, CLI
  karsac-ui/                  New — React app: corpus authoring, proposal
                              review, promote, planning view, tracker, session
  KarsacMapMaker/             Existing — React app: map editor, player view, DM reveal
  packages/
    karsac-shared/            Shared types + component primitives
```

Both apps live in this repo. Each has its own Vite build and its own deployment pipeline — `karsac-ui` deploys as one unit, `KarsacMapMaker` deploys as its existing three builds (player, editor, canvas) to S3. They share types and components via `packages/karsac-shared` without being coupled at the deployment level.

The end state is: one repo, one API, two front-end apps, one shared package. Adding a third surface (e.g. a player companion app) is another app entry in the same monorepo, same pattern.

Rationale: the Map has its own player-facing concerns (canvas rendering, player vs DM view, static S3 asset deployment) that do not belong in the authoring/tracker app. A shared package gives component and type reuse without forcing a Map refactor before the new UI exists.

The Karsac UI covers: corpus browser, proposal review, promote, live/planning toggle, tracker, session-close export. The Map stays architecturally separate.

**Why not one app:** The Map deploys as static assets to S3 with separate player and editor builds. Merging would restructure that deployment unnecessarily — the apps serve different primary audiences (DM authoring tool vs DM/player map) and have different deployment targets.

**Why not three apps (keep Tracker separate):** The Tracker and the new Karsac UI are the same audience (DM), the same session, the same API. Separating them produces two apps always open at the same time. Merging them into `karsac-ui` is the right call.

### 3. Map consumes corpus via API, geometry stays local

The clean separation is: **geometry lives in the Map, lore lives in the corpus.**

`data.js` coordinates, polygon boundaries, and tier classifications are Map-specific. They do not belong in the corpus. The corpus owns lore, relationships, visibility, and canonical status.

The Map merges them at runtime:

```
GET /api/v1/corpus?mode=live&type=place
→ returns place entities with lore, visibility, relationships

data.js
→ provides x, y, poly, tier, region

merge on id → render with lore, respecting visibility
```

Player view calls `mode=live` — receives only `visibility: player-safe` or `mixed` places with `canonical: true`. DM view calls `mode=live` (full) or `mode=planning` for future content.

The existing reveal system in `player-reveal.js` can be extended or replaced by the corpus `visibility` field — they serve the same purpose.

### 4. Resolve the ID join explicitly — corpus owns the canonical id

The corpus id (`places/torweg`) and the Map id (`torweg`) must join reliably. Two options:

- **(A) Map strips the namespace prefix at join time** — Map calls `id.split('/').pop()` to get `torweg` and matches against its own id. Simple, but every consumer does it independently.
- **(B) Corpus exposes a `map_id` field** — corpus place entities carry an explicit `map_id: torweg` for the join. One source of truth, no consumer-side logic.
- **(C) Map adopts namespaced ids** — Map updates its ids to `places/torweg`. Breaking change to existing Map data but eliminates the mismatch permanently.

Recommendation: **(B)** in the short term — add `map_id` to the corpus place schema as an optional field, set it where the place exists in both corpus and Map. No breaking change to the Map. No consumer-side logic. The API can index by `map_id` so the Map can fetch `GET /api/v1/corpus/place/by-map-id/torweg` directly.

---

## Prerequisites Before Task 0002 Starts

### Data audit: Map ↔ Corpus place/region alignment

Before building the Map/corpus join, a data audit is required to establish what is actually consistent and what is missing or mismatched. The audit should cover:

**1. ID coverage**
- Which Map city ids (`data.js cities[]`) have a matching corpus place entity (after stripping the `places/` prefix)?
- Which corpus place entities have no Map city entry (corpus-only places)?
- Which Map cities have no corpus entity (Map-only places — lore placeholder only)?

**2. Region alignment**
- Map defines `regions[]` with ids like `"valtarok"`, `"parayana"`. Do corpus place entities carry a `region` field that matches these ids, or is the region relationship inferred from tags/related only?

**3. Visibility coverage**
- Which corpus places currently carry `visibility: player-safe`, `dm-only`, or `mixed`?
- Which have no visibility field set (would default to what in the API)?

**4. `map_id` field**
- If Option B (add `map_id` to corpus place schema) is agreed, the audit identifies which places need the field populated and confirms the slug mapping.

**5. Sub-place coverage**
- The corpus has sub-places (`torweg__saltbone-inn`, `torweg__main-wharf`, etc.). The Map has no sub-place layer yet. Note which corpus sub-places exist so the Map can plan whether to add a sub-place layer or treat them as lore-only.

**Output:** A short data matrix (place slug → Map id match, corpus id match, visibility set, region match) that becomes the source of truth for the join. This is a prerequisite for both the API place endpoint and the Map/corpus integration.

This audit can be scripted against the live corpus and `data.js` — it does not require Codex or Claude to complete, but the result should be reviewed before ADR-0004 is issued.

---

## Open Questions

1. Agree on Option B (two apps + shared package) as the app structure?
2. Agree that Map geometry stays in `data.js` and lore comes from the API?
3. Which ID join strategy — A, B, or C? (B recommended)
4. ~~Should `karsac-shared` be a workspace package in this monorepo or a separate repo?~~ Resolved: workspace package in this monorepo (`packages/karsac-shared`), consistent with the monorepo structure above.
5. Should the player reveal system in the Map be replaced by the corpus `visibility` field, or extended to sit alongside it?

---

## Recommended Next Step

Agree on these decisions, then issue ADR-0004 covering app structure and Map/corpus integration. Task 0002 (Karsac UI) starts after ADR-0004 is accepted.
