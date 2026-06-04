# Data-Driven Refactor — Work Items

Branch: `data-driven-refactor`

**Principle:** Policy in data. Execution in code.

Items are ordered by dependency. Sections 1 and 2 must be complete before
the structured-JSON generation prototype (roadmap §2) begins — they define the
schema that JSON generation consumes. Sections 3–7 are independent hygiene
passes that can be done in any order.

Each section is a self-contained unit of work with its own tests. Do not
batch across sections.

---

## Status key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done and tested

---

## Section 1 — Proposal type contracts ✅ Complete

**Must complete before structured JSON generation.**

The authoritative field list for each proposal type currently lives in three
separate places: `treatmentContracts.ts` (creative sections), `proposalValidator.ts`
(required sections), and `proposalTypes.ts` (folder and promotion mappings).
These must be unified into a single `proposal-contracts.yaml` before a JSON
schema can be derived from data.

**Target file:** `corpus/registry/proposal-contracts.yaml`

### 1.1 Move proposal type required sections

- [x] `CHAPTER_REQUIRED_SECTIONS` — `proposalValidator.ts`
- [x] `ENCOUNTER_REQUIRED_SECTIONS` — `proposalValidator.ts`
- [x] `ADVERSARY_REQUIRED_SECTIONS` — `proposalValidator.ts`
- [x] `NPC_REQUIRED_SECTIONS` — `proposalValidator.ts`
- [x] `PLACE_REQUIRED_SECTIONS` (the inline array) — `proposalValidator.ts`
- [x] `DESIGN_REQUIRED_HEADINGS` — `design-guardrails.ts`

### 1.2 Move creative treatment contracts

- [x] Adversary creative contract — `treatmentContracts.ts`
- [x] Place creative contract — `treatmentContracts.ts`
- [x] Encounter creative contract — `treatmentContracts.ts`
- [x] Scene creative contract — `treatmentContracts.ts`
- [x] NPC creative contract — `treatmentContracts.ts`
- [x] Item creative contract — `treatmentContracts.ts`
- [x] Chapter-outline creative contract — `treatmentContracts.ts`

`getCreativeTreatmentContract()` now loads from YAML with hardcoded fallback.
`treatmentContracts.ts` retains the fallback `CONTRACTS` object for safety.

### 1.3 Move proposal folder and promotion mappings

- [x] `PROPOSAL_FOLDERS` — `proposalTypes.ts`
- [x] `PROMOTE_TARGETS` — `proposalTypes.ts`

Both now computed from `getProposalFolder()` / `getPromoteTarget()` at startup.

### 1.4 Move ask/response profile required headings

- [x] Comparison profile required headings — `ask.ts`
- [x] Deep-lore profile required headings — `ask.ts`
- [x] Rules profile required headings — `ask.ts`

**New file:** `corpus/registry/proposal-contracts.yaml`
**New file:** `karsac-registry/src/proposals/proposalContractsLoader.ts`
**Tests added:** 14 new tests in `proposals.test.ts` (639 total, all passing)

---

## Section 2 — Style guards and language lists ✅ Complete

**Must complete before structured JSON generation.**

These are the word lists used by the NPC boundary checker and anchor content
validator. Currently hardcoded in TypeScript — impossible to extend without a
code change. Moving them to YAML lets the corpus owner extend coverage levels,
add new title tokens, or add cosmological forces without touching the pipeline.

**Target file:** `corpus/registry/style-guards.yaml`

### 2.1 Move word lists from proposalGovernance.ts

- [x] `SENTENCE_BOUNDARY_PRONOUNS` — `proposalGovernance.ts`
- [x] `COMMON_NOUN_SKIPS` — `proposalGovernance.ts`
- [x] `TITLE_TOKENS` — `proposalGovernance.ts`
- [x] `COSMOLOGICAL_FORCE_NAMES` — `proposalGovernance.ts`
- [x] `genericSingleWordSkips` (inline, per-call) — `proposalGovernance.ts`

### 2.2 Move word lists from treatmentValidator.ts

- [x] `ORG_TYPE_SUFFIXES` — `treatmentValidator.ts`
- [x] `ORG_STOP_WORDS` — `treatmentValidator.ts`

Title-token regex patterns in `treatmentValidator.ts` also rebuilt dynamically
via `getTitleTokenAlternation()` — no more duplicated inline alternation strings.

**New file:** `corpus/registry/style-guards.yaml`
**New file:** `karsac-registry/src/proposals/styleGuardsLoader.ts`
**Tests added:** 8 new tests in `proposal-governance.test.ts` (647 total, all passing)

---

## Section 3 — Validation rules and warning patterns

**Independent. Can be done in any order after sections 1–2.**

The governance validator contains hardcoded regex patterns for detecting
non-5e mechanics, cosmological claims, canonical tradition violations, and
supernatural atmosphere. These are setting-specific and should live in data.

**Target file:** `corpus/registry/validation-rules.yaml`

### 3.1 Move warning pattern rules from proposalGovernance.ts

- [ ] Flat skill bonus detection pattern — `proposalGovernance.ts:371`
- [ ] Non-5e mechanic detection pattern — `proposalGovernance.ts:375`
- [ ] Cosmological force causality pattern — `proposalGovernance.ts:379`
- [ ] Canonical tradition claim patterns (Skald, housecarl, Lösweg oral) — `proposalGovernance.ts:383`
- [ ] Supernatural agency atmosphere terms — `proposalGovernance.ts:387`
- [ ] Action economy useless-check pattern — `proposalGovernance.ts:446`

Each rule in YAML has: `id`, `pattern`, `severity` (warn/fail), `message`.
After move: `validateWarningPatterns()` iterates the loaded rules. The current
hardcoded checks are replaced by a single generic loop.

### 3.2 Move adversary validation patterns from adversary-design.ts

- [ ] Modern tech language terms — `adversary-design.ts:1004-1008`
- [ ] Canonical alignments set — `adversary-design.ts:613-624`

### 3.3 Move design guardrail patterns from design-guardrails.ts

- [ ] `FORBIDDEN_MONSTER_PATTERNS` array (20 patterns) — `design-guardrails.ts:29-49`
- [ ] `HOMEBREW_VIOLATION_PATTERNS` array (23 patterns) — `design-guardrails.ts:61-83`
- [ ] `ATTACK_PATTERNS` — `design-guardrails.ts:98-99`

**Target file:** `corpus/registry/design-guardrails.yaml`

---

## Section 4 — Faction-specific logic ✅ Complete

**Independent. Highest complexity — tackle after 1–3 are settled.**

Shadow Walker rules are the most heavily hardcoded faction in the pipeline.
Currently spread across `adversary-design.ts`, `proposalGovernance.ts`,
and `proposalConstraints.ts`. The goal is that adding a new faction requires
only a YAML entry, not a code change.

**Target files:** `corpus/registry/faction-validation-rules.yaml` (extends
existing `factions.yaml`)

### 4.1 Move Shadow Walker constraint strings

- [x] Generation constraints added to `factions.yaml` — `proposalConstraints.ts` now iterates `factionProfile.generationConstraints`

### 4.2 Move Shadow Walker validation checks from proposalGovernance.ts

- [x] validation_rules added to `factions.yaml` — `validateShadowWalkerProposal()` replaced by generic `validateFactionProposal()`

### 4.3 Move Shadow Walker doctrine support mechanics from adversary-design.ts

- [x] `doctrine_support_mechanics` added to `factions.yaml` — `findDoctrineSupportingMechanics()` now lazy-loads from profile

### 4.4 Move FACTION_SPECS detection patterns from adversary-design.ts

- [x] `detection` block added to all 6 factions in `factions.yaml` — `FACTION_SPECS` replaced by `getFactionSpecs()` lazy loader

Also extended `FactionProfile` interface with `generationConstraints`, `validationRules`, `detection`, `doctrineSupportMechanics`.
Added `getAllFactionProfiles()` to `faction-profiles.ts`.

---

## Section 5 — Routing signals ✅ Complete

**Independent. Lower priority — routing works correctly now.**

The query router contains hardcoded term lists for detecting profile intent
(rules, deep-lore, design, prose, state). These could be extended by a
corpus owner to add new routing signals without a code change.

**Target file:** `corpus/registry/router-config.yaml`

### 5.1 Move profile routing term lists from router.ts

- [x] All 9 term lists + explicit encounter scene pattern — `router.ts` now uses `routerConfigLoader.ts`

### 5.2 Move proposal routing detection patterns from proposalRouting.ts

- [ ] Adversary proposal detection regex — `proposalRouting.ts`
- [ ] Place indicator terms — `proposalRouting.ts`
- [ ] Explicit proposal opening patterns — `proposalRouting.ts`
- [ ] `ADVERSARY_PROMPT_SIGNALS` — `proposalValidator.ts`

Note: 5.2 deferred — lower value than 5.1 and routing works correctly.

---

## Section 6 — Generation constraint strings ✅ Complete

**Independent. Moderate priority — affects prompt quality.**

The constraint strings injected into generation prompts are currently
hardcoded in `proposalConstraints.ts`. Moving them to data allows tightening
or loosening constraints per entity type without a code change.

**Target file:** `corpus/registry/generation-constraints.yaml`

- [x] Encounter, NPC, place, adversary header, and all corpus-anchor constraint strings — `proposalConstraints.ts` now uses `generationConstraintsLoader.ts`

---

## Section 7 — Rules data and scoring patterns ✅ Complete

**Independent. Low priority — correct as-is, pure cleanup.**

D&D 5e rules data (XP tables, CR tables, skill lists, alignment lists) and
encounter scoring patterns are hardcoded in `composition.ts` and
`encounter-design.ts`. These are stable but should be data to match the
principle of policy-in-data.

**Target file:** `corpus/rules-data/` (already exists for some data)

### 7.1 D&D 5e rules data → `corpus/rules-data/dnd5e-rules.yaml`

- [x] CR/XP table, XP thresholds, XP multipliers — `composition.ts`
- [x] `STANDARD_5E_SKILLS` — `adversary-design.ts`
- [x] `STAT_BLOCK_IMPLICIT_FIELDS` — `adversary-design.ts`
Note: `CANONICAL_ALIGNMENTS` moved in §3 (validation-rules.yaml).

### 7.2 Encounter scoring patterns → `corpus/registry/encounter-scoring.yaml`

- [x] All patterns, boosts, and exclusion guards — `encounter-design.ts`

### 7.3 Adversary base data → `corpus/rules-data/adversary-bases.yaml`

- [x] Base slug map, allowed bases, valid SRD names, darkvision list — `adversary-design.ts`
- [x] NPC base summaries — `encounter-design.ts`
- [x] Base selection heuristics and environment context patterns — `adversary-design.ts`

### 7.4 Regional / world data → `corpus/rules-data/losweg-regional-names.yaml`

- [x] Lösweg creature name mappings and PHANTOM_MONSTERS list — `composition.ts`

**New loaders:** `rulesDataLoader.ts`, `adversaryBasesLoader.ts`, `encounterScoringLoader.ts`, `regionalNamesLoader.ts`

---

## Registry files to create

| File | Section | Status |
|------|---------|--------|
| `corpus/registry/proposal-contracts.yaml` | §1 | ✅ |
| `corpus/registry/style-guards.yaml` | §2 | ✅ |
| `corpus/registry/validation-rules.yaml` | §3 | ✅ |
| `corpus/registry/design-guardrails.yaml` | §3.3 | ✅ (in validation-rules.yaml) |
| `corpus/registry/factions.yaml` (extended) | §4 | ✅ |
| `corpus/registry/router-config.yaml` | §5 | ✅ |
| `corpus/registry/generation-constraints.yaml` | §6 | ✅ |
| `corpus/registry/encounter-scoring.yaml` | §7 | ✅ |
| `corpus/rules-data/dnd5e-rules.yaml` | §7 | ✅ |
| `corpus/rules-data/adversary-bases.yaml` | §7 | ✅ |
| `corpus/rules-data/losweg-regional-names.yaml` | §7 | ✅ |

Existing files extended:
| File | Section |
|------|---------|
| `corpus/registry/factions.yaml` | §4 |
| `corpus/rules-data/` | §7 |

---

## Rules for this refactor

1. One section at a time. Do not start §2 until §1 tests pass.
2. Tests first. Before moving any constant, write a test that asserts the
   YAML-loaded value produces the same behaviour as the hardcoded value.
3. No behaviour changes. This refactor moves policy to data; it does not
   change what the policy is. If a test fails, the YAML is wrong, not the test.
4. Keep the old constant as a fallback during transition if needed — but
   remove it once the YAML path is tested and passing.
5. 657 tests passing at completion of all sections.
