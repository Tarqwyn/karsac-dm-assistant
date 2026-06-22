# Task 0002: Karsac UI Shell and Corpus Workspace

Status: Implemented — core scope complete; chapter authoring and tracker UX refinement remain follow-on work

## Goal

Build the Karsac UI — a purpose-built DM tool that replaces the existing vanilla-JS Tracker and adds the corpus authoring, proposal review, and planning surfaces the DM needs before, during, and after a session.

This task delivers the UI shell, corpus workspace, proposal workflow, and a rebuilt Tracker. Map integration is explicitly out of scope (follow-on milestone).

## Architectural decisions in force

- **ADR-0003** — REST API (`/api/v1/`) is the primary interface. The UI talks to this exclusively.
- **ADR-0004** — React 18 + Vite. Monorepo: `karsac-ui/` (this task) + `packages/karsac-shared/` (workspace package). The Tracker is merged into `karsac-ui` — not a separate app.
- **ADR-0002** — Two read modes (`live` / `planning`). The UI must expose this toggle and default all views to `live`.
- **ADR-0001** — 5-stage lifecycle. The UI surfaces `reviewed`, `promoted`, and the `materialised`/`tracked` stages explicitly.

## Design constraints

- The UI is a consumer of the API — it reads and writes through `/api/v1/` only, never directly to disk
- Live mode is the default for all views — planning mode is explicit opt-in
- Promotion is always explicit and gated — never triggered automatically
- State mutation is always explicit — never inferred from UI interaction
- The Tracker is rebuilt in React; the existing `KarsacTracker/` vanilla-JS files are the reference implementation, not the codebase to extend
- `packages/karsac-shared/` types are derived from the API contract (Task 0001 outputs) — no types invented ahead of what the API returns
- Map integration (`map_id`, lore merge, `KarsacMapMaker` connection) is out of scope for this task

## Pre-dev decisions — resolved

### 1. Routing: React Router v6

Standard, well-documented, sufficient for the navigation needs of this app (handful of top-level routes). No TanStack Router.

### 2. Components: shadcn/ui (Radix primitives + Tailwind)

Unstyled accessible primitives styled via Tailwind CSS variables. The existing Tracker's design language (dark DM surface, light player surface, CSS variable tokens) maps directly onto Tailwind variables — inherit it, don't fight a pre-styled library.

### 3. API client: React Query (TanStack Query)

Cache invalidation is needed throughout: promote a proposal → corpus list updates; mutate a beat → tracker refreshes. React Query handles loading/error/refetch states and cache invalidation. Apply it consistently across all API calls — no raw fetch wrappers alongside it.

---

## Epic Breakdown

### Epic 1 — Monorepo scaffolding and dev environment

Set up `karsac-ui/` and `packages/karsac-shared/` as workspace packages in the repo root. Wire the dev server so the UI can talk to the local API gateway.

Acceptance criteria:
- `karsac-ui/` is a Vite + React 18 + TypeScript app, runnable with `npm run dev` from the repo root
- `packages/karsac-shared/` is a workspace package importable by `karsac-ui/` and `KarsacMapMaker/`
- `karsac-shared` exports the API response types derived from the Task 0001 contract (corpus entity, proposal, state) — no invented types
- The dev server proxies `/api/v1/` to the local gateway (default port), configurable via env
- `npm run build` in `karsac-ui/` produces a deployable static build
- Existing `karsac-registry/` tests continue to pass — scaffolding does not break the monorepo

### Epic 2 — App shell and navigation

Build the outer shell: layout, navigation, live/planning mode toggle, auth.

Acceptance criteria:
- App has a persistent navigation structure covering: Corpus, Proposals, Tracker, Session
- Live / Planning mode toggle is visible in the shell and persists across navigation
- Mode defaults to `live` on load
- All API calls pass the current mode (`?mode=live` or `?mode=planning`)
- Auth is handled (minimum: API key header on all requests, sourced from env/config)
- Shell renders without errors when the API is unreachable — graceful degraded state, not a crash

### Epic 3 — Corpus workspace

Browse and search the corpus in live and planning modes.

Acceptance criteria:
- Corpus browser lists entities, filterable by type (npc, place, faction, item, etc.)
- Entity detail view renders the entity's markdown content and metadata
- Live mode shows only `collections` entities and `planning` entities with `canonical: true`
- Planning mode shows all indexed entities including `canonical: provisional`
- The mode toggle in the shell updates the corpus view without a full page reload
- Search filters the entity list by name/alias
- A `source` badge distinguishes `collections` entities from `planning` entities
- Empty states are handled (no entities of this type, API unreachable)

### Epic 4 — Proposal workflow

List, review, and promote proposals through the UI.

Note: the existing chat-based promote (`promoteIntent.ts`) remains in place and is unaffected. This epic builds the dedicated UI surface for the same lifecycle operations.

Acceptance criteria:
- Proposal list shows all proposals with type, status, and validation state
- Proposal detail view renders the proposal markdown and frontmatter
- Review action sets the review status on the proposal record (`PATCH /api/v1/proposals/:id/review`)
- Promote action calls `POST /api/v1/proposals/:id/promote`; blocked by default — validation failures show structured issues, not a raw error
- Force-promote is available as an explicit secondary action after a blocked attempt
- Promoted proposals are reflected in the corpus workspace without a manual refresh
- Invalid or missing proposals surface a clear error state

### Epic 5 — Tracker rebuild

Rebuild the session tracker in React, consuming the state API.

The existing `KarsacTracker/index.html` + `karsac-app.js` is the reference for what the tracker does — use it to understand the features, not as code to port directly.

Acceptance criteria:
- Chapter view shows beats, facts, handouts, threads, and the session clock
- Beat mark/unmark, fact reveal/hide, handout post/unpost, thread status change all call the appropriate state mutation endpoints
- Campaign state (current chapter, session, clock) is displayed and updatable
- All mutations append to `state-log.ndjson` (enforced by the API — the UI does not write directly)
- Tracker defaults to live mode — no planning content shown during a session
- State reflects API responses, not optimistic local state — mutations wait for API confirmation before updating the view

### Epic 6 — Session-close export

Explicit session-close action that exports tracked state back to `corpus/state/`.

Acceptance criteria:
- Session-close is an explicit action requiring confirmation — not triggered by navigation or timeout
- Calls `POST /api/v1/session/close`
- Shows a summary of what will be exported before confirming
- On success, confirms the export paths written and appends to `state-log.ndjson`
- On failure, shows the error and leaves session state unchanged

---

## Done When

- The DM can browse and search the corpus in live and planning modes from the UI
- The DM can review and promote proposals through the UI
- The DM can run a session using the rebuilt Tracker — beats, facts, handouts, threads, clock
- The DM can close a session and export state back to `corpus/state/` explicitly
- All views default to live mode; planning mode is an explicit toggle
- The existing vanilla-JS Tracker (`KarsacTracker/`) is superseded — it is not removed but no longer the primary tool

## Out of scope

- Map integration (`map_id`, lore merge, `KarsacMapMaker` connection) — follow-on milestone
- `packages/karsac-shared/` component library — grows as shared components emerge; not pre-built speculatively
- Player-facing views — the UI is DM-only
- S3 deployment pipeline for `karsac-ui/` — follow-on; local build is sufficient for this task

## Notes

The Tracker rebuild is intentionally inside this task, not a separate one. The DM needs one tool, not two tabs. The existing Tracker is the functional reference — the new implementation should match its capabilities before adding anything new.

Do not add features not present in the existing Tracker or not required by the corpus workspace. Scope creep here delays the Map integration milestone.

## Related

- [ADR-0001 — Lifecycle State Contract](../adr/0001-lifecycle-state-contract.md)
- [ADR-0002 — Canonical Indexing and Read Modes](../adr/0002-canonical-indexing-and-read-modes.md)
- [ADR-0003 — REST API as Primary Interface](../adr/0003-rest-api-as-primary-interface.md)
- [ADR-0004 — UI Application Architecture](../adr/0004-ui-app-architecture.md)
- [Task 0001 — API Foundation for UI](0001-api-foundation-for-ui.md)
- [RFC 0003 — UI Application Architecture](../rfc/0003-ui-app-architecture.md)
