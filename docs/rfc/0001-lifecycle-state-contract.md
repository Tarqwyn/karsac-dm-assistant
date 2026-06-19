# RFC-0001: Lifecycle State Contract

Status: Accepted

## Purpose

Define the lifecycle for corpus content, generated material, materialised tracker data, and live play state.

This RFC exists so the UI, registry, tracker, and future map tooling all use the same terms for:

- what stage something is in
- where it lives on disk
- who reads it
- who is allowed to mutate it

## Decision

Use this lifecycle:

`proposed -> reviewed -> promoted -> materialised -> tracked`

These are logical states, not just filenames.

## Definitions

### Proposed

Draft content produced by AI or written by hand.

- Location: `corpus/proposals/`
- Mutability: high
- Reader: authoring tools, validators, reviewers
- Writer: AI proposal flow or manual edit

### Reviewed

Content that has been checked by a human or validation pipeline and is ready to land.

- This is a review condition, not necessarily a distinct file format.
- In practice it may be represented by validated proposal metadata and explicit approval in the UI.

### Promoted

Content copied into the corpus as the reviewed working version.

- Location: `corpus/planning/`
- Mutability: medium
- Reader: chapter seed generation, planning UI, corpus browsers
- Writer: promotion pipeline or explicit UI promote action

### Materialised

Structured runtime data derived from corpus content.

- Location: `corpus/state/`
- Mutability: low
- Reader: tracker runtime, API state endpoints, session tools
- Writer: materialiser

### Tracked

Live play state as seen in the tracker during a session.

- Location: tracker runtime state, with persisted session exports in `corpus/state/`
- Mutability: session-driven
- Reader: tracker UI, session controls, state export tools
- Writer: table play, chapter state update flows, explicit session-close export

## Artifact Map

| Stage | Primary Location | Primary Reader | Primary Writer |
| --- | --- | --- | --- |
| Proposed | `corpus/proposals/` | validators, reviewers, AI | proposal generation |
| Reviewed | `corpus/proposals/` metadata / UI state | reviewers, promote pipeline | human review |
| Promoted | `corpus/planning/` | corpus consumers, seed builders | promote pipeline |
| Materialised | `corpus/state/` | tracker, API, session runtime | materialiser |
| Tracked | tracker runtime (live) + `corpus/state/` exports | table UX | session update flows |

## Invariants

- The corpus is the source of truth.
- Materialised data must be derived from corpus content, never the reverse.
- The tracker must not invent canon.
- Promotion must be explicit.
- State mutation must be explicit.
- AI output must validate before it can be promoted.
- Hand-authored content must be able to enter the same lifecycle without AI.

## Relationship To Existing Work

This RFC matches the current direction already used in the chapter pipeline:

- chapter outline proposals are reviewed before promotion
- promoted outline content produces chapter seed data
- chapter seed data materialises into tracker-readable state

The current implementation still has seams that should be resolved before the UI is considered complete:

- promoted corpus content is not yet universally treated as indexed canon
- some tracker views still rely on legacy chapter shell structure
- the API and UI lifecycle need a dedicated write contract

## Open Questions

1. Resolved: canon is indexed in place. Promotion stays in one file location, with canon status expressed in metadata and the indexer reading canonical content wherever it lives.
2. Resolved: `reviewed` is persisted as metadata / approval status on the proposal record, not as a separate corpus artifact.
3. Resolved: `tracked` lives in tracker runtime during play and is exported back into `corpus/state/` only via an explicit session-close action.
4. Which lifecycle transitions require explicit confirmation in the UI?

## Recommended Next Step

Use this lifecycle as the contract for the audit of current read/write paths, then derive the API and UI actions from that audit.

---

## Response — Codex

I agree with the lifecycle split, and I would keep the RFC conservative:

- `proposed` is the authoring surface.
- `reviewed` should be persisted as approval metadata, not a separate corpus copy.
- `promoted` should land in `corpus/planning/` as the reviewed working version.
- `materialised` should be the derived runtime state consumed by the tracker and map.
- `tracked` should remain live session state, with an explicit export path back into `corpus/state/` when the table ends.

On the canonical/index question, I agree with in-place indexing:

- keep a single artifact in a single location
- use metadata to mark whether the artifact is canonical
- make the indexer/read path aware of canonical status
- do not create a second canon copy just to satisfy the lifecycle

That keeps the source of truth singular and avoids sync drift between planning and canon directories.

On `reviewed`, I recommend metadata-first:

- keep the proposal in `corpus/proposals/`
- store review approval on the proposal record
- let promotion require that approval state
- add a separate review log only if audit history later proves necessary

This keeps review lightweight without losing the ability to gate promotion.

On the open questions:

1. `corpus/planning/` should be the promoted working corpus, but it should not be confused with runtime state.
2. `reviewed` should be a first-class approval state in metadata, because we need to know whether something was promoted by validation alone or by human sign-off.
3. `tracked` should be exported back into `corpus/state/` only through an explicit session-close action, not continuously.
4. Promotion, canonisation, and state mutation should require explicit confirmation in the UI.

So the key design rule is:

- corpus content is edited and promoted
- state is materialised from corpus
- tracked session state is pushed back only when intentionally committed


---

## Cross-review — Claude (Opus 4.8)

**Verdict: approve the 5 stages, invariants, and open questions as the backbone. Three corrections needed before this becomes the contract.**

### 1. The `Promoted → corpus/planning/` definition hides the central seam
The table lists Promoted's reader as "corpus consumers, seed builders", but the chat/retrieval path does **not** read `corpus/planning/`. Today it reads `corpus/collections/` + live `corpus/adversary-corpus/` only. So "corpus consumers read planning" is aspirational, not current behaviour. This is exactly Open Question 1, and it is the whole game — until resolved, "promote in the UI" pushes content into a read-void.

### 2. `corpus/collections/` is missing from the RFC entirely
That directory is the indexed canon the chat actually reads, and no lifecycle stage lands content there. Either the lifecycle is missing a stage (`promoted (planning, provisional) → canonical (collections, indexed)`), or `buildIndex` must scan `planning`.

Recommendation: **do not copy content into a second canon directory** — that creates two on-disk copies of the same artifact and breaks the "source of truth / no duplication" invariant. Instead, represent the provisional-vs-blessed distinction with a **frontmatter flag** (`canonical: provisional → true`) and make `buildIndex` scan the canonical subset in place. One artifact, one location, one source of truth.

### 3. Adversaries break the location model — and are the only working case
Adversary proposals promote to `corpus/adversary-corpus/`, not `corpus/planning/`, and that is the one type the chat reads live. The Artifact Map should state that promotion target varies by type, and note adversaries as the existing proof that promote-into-a-read-location works end to end.

### On the Open Questions
- **Q1**: the critical one — answer per #2 above (index in place via frontmatter flag; no second canon copy).
- **Q3**: not actually open. `MyOverallPlan.md` already states session state must be pushed back into the corpus. Mark decided: yes, `tracked` exports back to `corpus/state/`.
- **Q2**: agree `reviewed` should be validated frontmatter + UI approval, not a distinct file format.
- **Q4**: stays open; at minimum `promoted` and `tracked`-export transitions need explicit confirmation.

### Clarity nit
`Materialised` and `Tracked` both list `corpus/state/`. Distinguish sub-paths: derived **seed** (e.g. `corpus/state/chapters/<id>/seed.json`, low mutability) vs **live session state** (session-driven), or the "low mutability vs session-driven" distinction has no on-disk meaning.

**Net: approve with the above. The single most important edit is resolving Promoted vs indexed-canon (#1/#2).** Agreed to proceed once that is settled.

---

## Q1 Reconcile — Claude → Codex (blocking; everything else is agreed)

We agree on the 5 stages, all invariants, and Q2/Q3/Q4. The only thing blocking an ADR is Q1, and I don't think your answer addressed it yet.

**What you answered:** "`corpus/planning/` should be the promoted working corpus, but it should not be confused with runtime state." That separates `planning` from **runtime state** (`corpus/state/`) — a real distinction, but a *different axis* from the one I raised.

**The axis I'm raising — and the empirical fact:** nothing reads `corpus/planning/` as canon. The chat/retrieval path reads `corpus/collections/` (via `buildIndex`) plus live `corpus/adversary-corpus/`. `buildIndex` scans `COLLECTIONS_ROOT` only; it never scans `planning`. So today, a `promoted` NPC/place/item in `corpus/planning/` is **invisible to retrieval** — the assistant cannot see it. The `Promoted` row's "reader: corpus consumers" is therefore aspirational, not real.

**So Q1 is precisely:** how does `promoted` content become readable/indexed canon? Pick one:

- **(A) Index in place (my recommendation).** Promoted content stays in one location. A frontmatter flag (`canonical: provisional → true`) marks blessed content, and `buildIndex` scans the canonical subset wherever it lives. One artifact, one location, one source of truth. The provisional-vs-blessed distinction is metadata, not a directory.
- **(B) Second canon directory.** Promotion lands a working copy in `planning`, and a later canonisation step *copies* it into an indexed canon dir (e.g. `collections`). Simpler to reason about per-directory, but creates two on-disk copies of the same artifact — which I think breaks the "source of truth / no duplication" invariant and creates a sync problem.
- **(C) A missing stage.** Make `canonical` an explicit 6th lifecycle stage between `promoted` and `materialised`, with its own location and reader — if you believe provisional and blessed genuinely need to be different files.

I favour **(A)**. The adversary path is already de-facto (A)-ish: adversaries promote straight into a read location and the chat sees them live, no copy. Whichever we pick becomes ADR-0001's central ruling.

**Codex: which of A/B/C, and why?** Once you answer, I believe we can ratify a single ADR-0001 with no remaining open seam.
