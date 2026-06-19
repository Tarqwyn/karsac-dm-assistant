# Task 0001: API Foundation for UI

Status: Ready for development

## Goal

Build the REST API that the Karsac UI relies on for:

- live play reads
- planning reads
- proposal review and promotion
- metadata linking
- state materialisation
- session-close export

This is the next milestone because the UI cannot be stable until the API has a clear read/write contract.

## Architectural decisions in force

- **ADR-0001** — 5-stage lifecycle: proposed → reviewed → promoted → materialised → tracked
- **ADR-0002** — One corpus, two read modes (live / planning); `canonical` is a read-time gate
- **ADR-0003** — REST API (`/api/v1/`) is the primary interface. The OpenAI-compat gateway is a secondary adapter, not the target surface for this task.

## Design constraints

- Markdown corpus is source of truth — API reads and writes corpus files, never the reverse
- Materialised tracker data is derived from corpus — never authoritative
- Promotion and state mutation are explicit actions — never inferred
- AI is not required — the API must support hand-authored content through the same lifecycle
- Wrap all corpus reads and writes in a storage interface from day one (local FS ships with this task; S3 is a later adapter, not a rewrite)
- `corpus/collections/` is the legacy hand-authored layer — indexed as-is, does not grow under this task
- `corpus/planning/` is the authoritative promoted corpus tree — new content enters here via promotion

## Pre-dev decisions required before starting

### 1. Define the `reviewed` frontmatter field

The RFC and ADR-0001 agreed that "reviewed" is metadata on the proposal record, not a separate file. The specific field has not been named. Decide before implementing Epic 4:

- Field name (e.g. `review_status`, `approved_by`)
- Values (e.g. `pending`, `approved`, `rejected`)
- Whether the promoter gates on it or it is informational only

### 2. Confirm `corpus/collections/` role

Under ADR-0002, `collections/` is the legacy layer — indexed as-is, does not grow. Confirm: no migration of `collections/` content into `planning/` is required before this task ships.

---

## Epic Breakdown

### Epic 1 — Define the API contract

Document the REST endpoints, payloads, read modes, error states, and auth model the UI will use.

The API lives at `/api/v1/` within the existing gateway server. OpenAI-compat routes move to `/compat/v1/` or behind a config flag (see ADR-0003). This keeps one deployment unit.

Acceptance criteria:
- REST endpoints for `live` and `planning` reads are specified
- Proposal read, review, promote, and materialise operations are specified
- Request/response shapes are documented
- Explicit error states are documented
- Auth model is documented (minimum: static API key; specific implementation TBD)
- Storage interface is defined (wraps all corpus file I/O; local FS implementation ships with this epic)

### Epic 2 — Index `corpus/planning/` and make `canonical` a read-time gate

Extend `buildIndex` to scan `PLANNING_ROOT` alongside `COLLECTIONS_ROOT`. Tag each indexed entity with its `canonical` value. The read layer filters by mode.

This is the single change that closes Critical Seam #1 and #2 from the lifecycle audit.

Acceptance criteria:
- `buildIndex` scans both `corpus/collections/` and `corpus/planning/`
- Entities are tagged with `canonical` status in the index
- `corpus/collections/` entries without a `canonical` field are treated as `true` (backwards-compatible)
- `live` reads return only `canonical: true` content
- `planning` reads include `canonical: provisional` content
- Tests prove live reads do not leak planning content
- `PLANNING_ROOT` is env-overridable consistent with `paths.ts` pattern (for test isolation)

### Epic 3 — Expose proposal lifecycle operations

Add REST endpoints for reading, reviewing, and promoting proposals.

Note: chat-based promote is already wired in the gateway (`promoteIntent.ts` + `karsacRunner.ts`). This epic builds the REST endpoint equivalent for the UI — a different surface, not duplicate work.

Acceptance criteria:
- `GET /api/v1/proposals` — list proposals with status, type, validation state
- `GET /api/v1/proposals/:id` — read a proposal record
- `PATCH /api/v1/proposals/:id/review` — set review status (uses the field decided in pre-dev decisions)
- `POST /api/v1/proposals/:id/promote` — promote a proposal; blocked-by-default (validation failures refuse without explicit `force` flag); returns validation issues on refusal
- `POST /api/v1/proposals` — create a proposal (triggers the generation pipeline)
- Promotion is gated; invalid promotion attempts return structured errors
- Tests cover the proposal lifecycle end-to-end

### Epic 4 — Expose state materialisation and session-close export

Add REST endpoints that materialise chapter state and export tracked state back into corpus.

Acceptance criteria:
- `POST /api/v1/chapters/:id/materialise` — trigger chapter state materialisation from seed
- `POST /api/v1/session/close` — export tracker session state back to `corpus/state/`; writes to expected paths; appends to `state-log.ndjson`
- State mutations are validated and logged
- Exported state writes are atomic (temp file + rename, consistent with existing service.ts pattern)
- Tests cover materialisation and export paths

### Epic 5 — Contract tests

Lock the API shape before the frontend is built.

Acceptance criteria:
- Live/planning read tests pass and assert no cross-mode leakage
- Proposal lifecycle tests pass (create → review → promote)
- Materialisation and session-close export tests pass
- Tests describe the UI contract, not internal behaviour — a UI developer can read them to understand what the API guarantees

---

## Done When

- The UI can request live vs planning data explicitly via REST
- The UI can create, review, and promote proposals via REST
- The tracker can materialise chapter state and export session-close state via REST
- Future chapter content is accessible in planning mode without contaminating live play reads
- All corpus I/O goes through the storage interface
- The OpenAI-compat gateway continues to work via the compat adapter

## Notes

This task is intentionally foundation-first. Do not expand the UI before the API contract (Epic 1) is stable and reviewed.

The OpenAI-compatible routes are not removed as part of this task — they continue to serve Open WebUI during transition. Deprecation is a separate decision.

## Related

- [ADR-0001 — Lifecycle State Contract](../adr/0001-lifecycle-state-contract.md)
- [ADR-0002 — Canonical Indexing and Read Modes](../adr/0002-canonical-indexing-and-read-modes.md)
- [ADR-0003 — REST API as Primary Interface](../adr/0003-rest-api-as-primary-interface.md)
- [Lifecycle Audit](../lifecycle-audit.md)
