# ADR-0003: REST API as Primary Interface

**Status:** Accepted
**Date:** 2026-06-19
**Agreed by:** Project owner

---

## Context

The system was originally built with an OpenAI-compatible chat gateway as its primary external interface, to support Open WebUI integration. The gateway exposes `/v1/chat/completions` and `/v1/models`, and all functionality (propose, promote, ask) is routed through a chat-completion shaped pipeline.

The agreed direction (MyOverallPlan.md, ADR-0001, ADR-0002) is to build Karsac as a purpose-built worldbuilding and DM tool with a dedicated UI — not a chat assistant. The chat interface is not the primary use case.

Building a UI on top of the OpenAI-compatible gateway would require bolting a REST API onto a chat-shaped surface, inverting the intended relationship and producing the wrong primary interface for the tool.

---

## Decision

**The REST API is the primary interface. The OpenAI-compatible gateway is a secondary, optional adapter.**

```
Karsac UI     →  REST API        (primary — purpose-built for the tool)
Open WebUI    →  OpenAI adapter  →  REST API  (optional, if ever needed)
External chat →  thin wrapper    →  REST API  (future, if ever needed)
```

### What this means

- A purpose-built REST API (`/api/v1/...`) is the authoritative contract for the Karsac UI, tracker, and any future tooling.
- The existing OpenAI-compatible routes (`/v1/chat/completions`, `/v1/models`) are demoted to an optional compatibility adapter. They are not removed but are no longer the primary surface.
- All business logic (propose, promote, ask, materialise, session-close) is implemented as REST API handlers first. The OpenAI adapter wraps those handlers if chat compatibility is needed.
- If a chat interface is wanted in future, a thin wrapper is placed around the REST API — not the other way around.

### What stays

- `src/gateway/karsacRunner.ts` — propose, promote, and ask business logic is reused as the implementation layer behind REST handlers. Nothing is wasted.
- `src/gateway/promoteIntent.ts` — proposal resolution logic remains; the chat pattern-matching is replaced by explicit REST parameters.
- `src/proposals/`, `src/state/`, `src/build-index.ts` — all unchanged, they are internal to the API layer.

### What changes

- `src/gateway/server.ts` — restructured to serve `/api/v1/` routes as primary. OpenAI-compat routes moved to `/compat/v1/` or gated behind a config flag.
- `src/gateway/chatCompletion.ts` — demoted to an optional adapter; wraps REST API handlers rather than directly invoking business logic.
- Task 0001 (API Foundation for UI) builds the REST API, not an extension of the OpenAI gateway.

---

## Consequences

- The UI has a clean, purpose-built API contract rather than a chat-shaped workaround.
- Future chat integration (if ever needed) is a thin wrapper with no core changes required.
- The storage abstraction (fs ↔ S3, flagged in ADR-0002 follow-on work) sits cleanly behind the REST API layer — all corpus reads and writes go through it.
- Task 0001 Issue 1 (where does the API live?) is resolved: the REST API is the primary server; OpenAI compat is secondary.
- Existing Open WebUI integration continues to work via the compat adapter during transition.

---

## Not in scope

- Removing or breaking the existing OpenAI-compatible routes before a UI exists to replace them.
- Defining the specific REST endpoint shapes — that is Task 0001 Epic 1.
