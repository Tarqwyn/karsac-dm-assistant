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
  → Draft generation (local model via Ollama)
  → Creative treatment pass (qwen3:14b — doctrine, cultural identity, story beat polish)
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

Optional second-pass model call (qwen3:14b by default) that adds doctrine, cultural identity, story beat, and prose polish. Runs before pruning and validation. Editable sections only — locked structural sections (stat block, mechanical base) are not touched.

### Gateway (`src/gateway/`)

OpenAI-compatible REST API (`/v1/chat/completions`, `/v1/models`) for Open WebUI integration. Routes chat messages through the full proposal pipeline.

---

## Corpus structure

```
corpus/
  collections/         — canon Markdown files (NPCs, places, factions, items, events)
  adversary-corpus/    — adversary design source material
  encounter-patterns/  — encounter pattern library
  rules-data/          — structured D&D 5e SRD data
  proposals/           — generated provisional proposals (not canon until promoted)
  planning/            — promoted planning material
  registry/            — YAML policy files
  state/               — campaign state JSON
```

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
