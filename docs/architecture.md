# Architecture

## Principle

Registry-guided domain AI runtime.

> Models propose. Code governs.

The model generates wording, tone, and synthesis inside a compiled brief. The deterministic runtime owns routing, retrieval, policy, validation, repair, and promotion gates. The model cannot decide what is canon, what sources are allowed, what mechanics can be invented, or what becomes canon.

---

## Pipeline

```
User prompt
  → Router (profile detection, explicit type override)
  → Corpus anchor detection (entity registry lookup, snippet extraction)
  → Constraint builder (corpus anchor + entity policy + faction profile + chapter state)
  → Draft generation (any LLM — local via Ollama in dev, edge API when deployed)
  → Creative treatment pass (any LLM — doctrine, cultural identity, story beat polish)
  → Pruner (remove forbidden/out-of-scope sections, sentence-level forbidden pattern strip)
  → Validator (structural + governance + anchor content)
  → Repair log assembly
  → Proposal write
```

---

## Key components

### Router (`src/proposals/proposalRouting.ts`)

Detects proposal type from prompt signals. Explicit `--type` flag wins over contextual routing. Profile selection (npc-design, place-design, adversary-design, encounter-design, state) determines which context assembler runs.

### Corpus anchor (`src/proposals/proposalEntityRegistry.ts`)

For named canonical entities, detects the corpus entity from the prompt, loads exact text snippets, and returns:
- entity ID and coverage level
- entity policy (from `proposal-entity-policies.yaml`)
- exact snippets for prompt injection and post-generation content validation

### Entity policy (`corpus/registry/proposal-entity-policies.yaml`)

Per-entity rules:
- `coverage_level` — stub / anchored / bounded / full
- `canonical_reference_only` — no invention allowed
- `allowed_sections` / `forbidden_sections`
- `forbidden_patterns` — fail-severity patterns stripped at sentence level before validation
- `ambiguity_flags` — injected into output to preserve unresolved canon
- `prompt_constraints` — injected into generation prompt

### Constraint builder (`src/proposals/proposalConstraints.ts`)

Assembles the pre-generation prompt from entity policy, corpus snippets, faction profile, and chapter state. The model receives a precise contract, not vague advice.

### Pruner (`src/proposals/proposalPruner.ts`)

Post-generation, pre-validation:
1. Remove sections forbidden or out-of-scope per entity policy
2. Strip sentences matching fail-severity forbidden patterns (for `canonical_reference_only` entities)
3. Inject required Ambiguities section where policy requires it
4. Write all decisions to `repair_log`

### Validator

Three layers run on the pruned output:

- **Structural** (`proposalValidator.ts`) — required sections, frontmatter fields, type routing correctness. Policy-aware: sections pruned by policy are not treated as missing.
- **Governance** (`proposalGovernance.ts`) — named NPC boundary, registry reference integrity, item state changes, canonical warning patterns, faction compliance.
- **Anchor content** (`treatmentValidator.ts`) — for corpus-named entities, scans all surviving sections for proper-noun phrases and organisation names not traceable to the corpus anchor text. Self-labelled Provisional sections are suppressed.

### Creative treatment (`src/creativeTreatment/`)

Optional second-pass model call that adds doctrine, cultural identity, story beat, and prose polish. Runs before pruning and validation. Editable sections only — locked structural sections (stat block, mechanical base) are not touched. Model is configurable — local (qwen3:14b via Ollama) in development, edge API when deployed.

### API (`src/gateway/`)

The primary interface is a purpose-built REST API at `/api/v1/` (see ADR-0003). The Karsac UI talks to this directly.

An OpenAI-compatible adapter (`/compat/v1/chat/completions`, `/compat/v1/models`) wraps the REST API for Open WebUI integration. It is secondary — if chat is wanted, a thin wrapper sits around the REST API, not the other way round.

The adapter routes chat messages to one of three handlers:

- **Propose** — detected from natural language ("propose a new NPC…"); runs the full proposal pipeline.
- **Promote** — detected from "promote `<name>`"; resolves the proposal, runs the promoter, blocked-by-default (validation failures refuse without `--force`).
- **Ask** — all other queries; routed by profile through the retrieval layer.

---

## Corpus structure

```
corpus/
  collections/         — legacy hand-authored canon (NPCs, places, factions, items, events)
                         indexed by buildIndex; does not grow — new content enters via proposals
  planning/            — promoted content (AI-generated or hand-authored via proposal pipeline)
                         indexed by buildIndex, filtered by canonical status (see ADR-0002)
  adversary-corpus/    — adversary design source; read live by ask.ts (not indexed)
  encounter-patterns/  — encounter pattern library; read live by ask.ts (not indexed)
  rules-data/          — structured D&D 5e SRD data
  proposals/           — provisional proposals awaiting review and promotion
  registry/            — YAML policy files (entity, faction, proposal contracts)
  state/               — materialised campaign state JSON; written by materialiser + state service
```

### Canonical status and read modes (ADR-0002)

The `canonical` frontmatter field is a read-time gate, not just a label:

| Value | Meaning | Visible in live mode | Visible in planning mode |
|---|---|---|---|
| `true` | Blessed canon — active world | Yes | Yes |
| `provisional` | Promoted but not yet blessed | No | Yes |
| absent | Legacy collections content | Yes (treated as `true`) | Yes |

**Live mode** (default for all chat and tracker reads) — surfaces only `canonical: true` content and the current chapter state. Far-ahead planning content (`canonical: provisional`) is in the index but invisible.

**Planning mode** (explicit opt-in via UI) — includes provisional content so the DM can work on future chapters without leaking them into active session context.

---

## Governance precedence

1. Explicit user constraints
2. Canonical entity policy (`proposal-entity-policies.yaml`)
3. Faction/profile policy (`factions.yaml`, `faction-mechanical-overrides.yaml`)
4. Proposal type contract
5. Mechanical base inheritance
6. Model-generated creative additions

Lower layers are repaired, pruned, or rejected when they conflict with higher layers.

---

## Why not simple RAG?

RAG gives the model a context window and trusts it to stay in bounds. This pipeline does not trust the model to stay in bounds. It defines the bounds deterministically, checks the output against them, and repairs or rejects what falls outside.

The model's job is wording and synthesis. The pipeline's job is everything else.

---

## Related documents

| Document | Purpose |
|---|---|
| [architecture-diagram.md](architecture-diagram.md) | Mermaid diagrams: full system, lifecycle flow, canonical indexing, governance precedence |
| [adr/0001-lifecycle-state-contract.md](adr/0001-lifecycle-state-contract.md) | Agreed 5-stage lifecycle: proposed → reviewed → promoted → materialised → tracked |
| [adr/0002-canonical-indexing-and-read-modes.md](adr/0002-canonical-indexing-and-read-modes.md) | Canonical indexing in place; live vs planning read modes |
| [adr/0003-rest-api-as-primary-interface.md](adr/0003-rest-api-as-primary-interface.md) | REST API is primary; OpenAI-compat gateway is a secondary adapter |
| [lifecycle-state-rfc.md](lifecycle-state-rfc.md) | RFC that produced the lifecycle contract (discussion record) |
| [lifecycle-audit.md](lifecycle-audit.md) | Read/write audit: where each stage currently lives, what reads it, severed seams |
