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

## Section 2 — Style guards and language lists

**Must complete before structured JSON generation.**

These are the word lists used by the NPC boundary checker and anchor content
validator. Currently hardcoded in TypeScript — impossible to extend without a
code change. Moving them to YAML lets the corpus owner extend coverage levels,
add new title tokens, or add cosmological forces without touching the pipeline.

**Target file:** `corpus/registry/style-guards.yaml`

### 2.1 Move word lists from proposalGovernance.ts

- [ ] `SENTENCE_BOUNDARY_PRONOUNS` — `proposalGovernance.ts:108-113`
- [ ] `COMMON_NOUN_SKIPS` — `proposalGovernance.ts:116-121`
- [ ] `TITLE_TOKENS` — `proposalGovernance.ts:123-126`
- [ ] `COSMOLOGICAL_FORCE_NAMES` — `proposalGovernance.ts:129-131`
- [ ] `genericSingleWordSkips` (inline, per-call) — `proposalGovernance.ts:135-139`

### 2.2 Move word lists from treatmentValidator.ts

- [ ] `ORG_TYPE_SUFFIXES` — `treatmentValidator.ts`
- [ ] `ORG_STOP_WORDS` — `treatmentValidator.ts`

After move: both files load from `style-guards.yaml` at startup via a shared
loader. Tests: add a test that each list loads correctly; existing boundary and
anchor content tests must still pass.

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

## Section 4 — Faction-specific logic

**Independent. Highest complexity — tackle after 1–3 are settled.**

Shadow Walker rules are the most heavily hardcoded faction in the pipeline.
Currently spread across `adversary-design.ts`, `proposalGovernance.ts`,
and `proposalConstraints.ts`. The goal is that adding a new faction requires
only a YAML entry, not a code change.

**Target files:** `corpus/registry/faction-validation-rules.yaml` (extends
existing `factions.yaml`)

### 4.1 Move Shadow Walker constraint strings

- [ ] Doctrine constraint strings (restraint, withdrawal, information preservation) — `proposalConstraints.ts:112-117`
- [ ] Weapon restriction strings (no shortbow, use throwing spike) — `proposalConstraints.ts:113`
- [ ] Language requirement strings — `proposalConstraints.ts:115`
- [ ] Wisdom floor constraint string — `proposalConstraints.ts:116`

After move: `buildAdversaryConstraintLines()` reads from faction profile data
for the locked faction — no `if (input.lockedFaction === 'shadow-walkers')` block.

### 4.2 Move Shadow Walker validation checks from proposalGovernance.ts

- [ ] Evil alignment prohibition — `proposalGovernance.ts:454-473`
- [ ] Shortbow/concealment flag — `proposalGovernance.ts:456`
- [ ] Spellcasting justification flag — `proposalGovernance.ts:460`
- [ ] Wisdom observation floor — `proposalGovernance.ts:463`

After move: `validateShadowWalkerProposal()` is replaced by a generic
`validateFactionProposal()` that loads faction-specific rules from YAML.

### 4.3 Move Shadow Walker doctrine support mechanics from adversary-design.ts

- [ ] `DOCTRINE_SUPPORT_MECHANICS` array (10 patterns) — `adversary-design.ts:400-456`
- [ ] `themeIsRepresented()` per-theme patterns — `adversary-design.ts:721-736`
- [ ] `hasShadowWalkerRestraintTheme()` pattern — `adversary-design.ts:759-761`
- [ ] `inferDoctrineTags()` tag detection — `adversary-design.ts:767-792`

### 4.4 Move FACTION_SPECS detection patterns from adversary-design.ts

- [ ] 6 faction mention patterns and positive affiliation patterns — `adversary-design.ts:175-272`

---

## Section 5 — Routing signals

**Independent. Lower priority — routing works correctly now.**

The query router contains hardcoded term lists for detecting profile intent
(rules, deep-lore, design, prose, state). These could be extended by a
corpus owner to add new routing signals without a code change.

**Target file:** `corpus/registry/router-config.yaml`

### 5.1 Move profile routing term lists from router.ts

- [ ] Rules terms (30+ terms) — `router.ts:14-38`
- [ ] Design terms (20+ terms) — `router.ts:40-64`
- [ ] Deep-lore terms (15+ terms, includes force names) — `router.ts:66-80`
- [ ] Strong prose terms — `router.ts:83-93`
- [ ] Weak prose terms — `router.ts:96-99`
- [ ] State terms (35+ terms) — `router.ts:103-150`
- [ ] Adversary design terms (40+ terms) — `router.ts:155-218`
- [ ] Encounter design terms (18 terms) — `router.ts:220-248`
- [ ] Canon terms (13 terms) — `router.ts:250-263`

### 5.2 Move proposal routing detection patterns from proposalRouting.ts

- [ ] Adversary proposal detection regex — `proposalRouting.ts:5-6`
- [ ] Place indicator terms (16 terms) — `proposalRouting.ts:8-16`
- [ ] Explicit proposal opening patterns (11 regexes) — `proposalRouting.ts:28-40`
- [ ] `ADVERSARY_PROMPT_SIGNALS` — `proposalValidator.ts:116-117`

---

## Section 6 — Generation constraint strings

**Independent. Moderate priority — affects prompt quality.**

The constraint strings injected into generation prompts are currently
hardcoded in `proposalConstraints.ts`. Moving them to data allows tightening
or loosening constraints per entity type without a code change.

**Target file:** `corpus/registry/generation-constraints.yaml`

- [ ] Encounter constraint lines (5 strings) — `proposalConstraints.ts:127-135`
- [ ] NPC constraint lines (4 strings) — `proposalConstraints.ts:138-145`
- [ ] Place constraint lines (4 strings) — `proposalConstraints.ts:148-155`
- [ ] Adversary constraint lines (25+ strings) — `proposalConstraints.ts:85-125`
- [ ] Corpus anchor constraint lines (20+ strings) — `proposalConstraints.ts:158-221`

---

## Section 7 — Rules data and scoring patterns

**Independent. Low priority — correct as-is, pure cleanup.**

D&D 5e rules data (XP tables, CR tables, skill lists, alignment lists) and
encounter scoring patterns are hardcoded in `composition.ts` and
`encounter-design.ts`. These are stable but should be data to match the
principle of policy-in-data.

**Target file:** `corpus/rules-data/` (already exists for some data)

### 7.1 D&D 5e rules data

- [ ] `CR_XP` table — `composition.ts:67-71`
- [ ] XP threshold table per level — `composition.ts:74-78`
- [ ] XP multiplier breakpoints — `composition.ts:84-90`
- [ ] `STANDARD_5E_SKILLS` — `adversary-design.ts:738-757`
- [ ] `CANONICAL_ALIGNMENTS` — `adversary-design.ts:613-624`
- [ ] `STAT_BLOCK_IMPLICIT_FIELDS` — `adversary-design.ts:1159-1172`

### 7.2 Encounter scoring patterns

- [ ] `DOCK_ARRIVAL_KEYWORDS` — `encounter-design.ts:116`
- [ ] `ARRIVAL_EVENT_PATTERN` — `encounter-design.ts:119`
- [ ] `SOCIAL_QUERY_PATTERN` — `encounter-design.ts:60-61`
- [ ] `MONSTER_EXCEPTION_PATTERN` — `encounter-design.ts:66-67`
- [ ] Pattern boost mappings (6 rules) — `encounter-design.ts:95-112`
- [ ] Pattern exclusion guards (2 rules) — `encounter-design.ts:125-134`

### 7.3 Adversary base data

- [ ] Base slug map (15 aliases) — `adversary-design.ts:41-60`
- [ ] `BASES_WITHOUT_DARKVISION` — `adversary-design.ts:956-960`
- [ ] `VALID_SRD_BASE_NAMES` — `adversary-design.ts:1057-1061`
- [ ] Allowed proposal bases — `adversary-design.ts:488`
- [ ] NPC base summaries (12 entries) — `encounter-design.ts:43-56`
- [ ] Base selection heuristic rules — `adversary-design.ts:493-501`
- [ ] Environment context detection patterns — `adversary-design.ts:506-510`

### 7.4 Regional / world data

- [ ] Lösweg creature name mappings (17 entries) — `composition.ts:102-121`
- [ ] `PHANTOM_MONSTERS` list — `composition.ts:124-128`

---

## Registry files to create

| File | Section | Status |
|------|---------|--------|
| `corpus/registry/proposal-contracts.yaml` | §1 | `[ ]` |
| `corpus/registry/style-guards.yaml` | §2 | `[ ]` |
| `corpus/registry/validation-rules.yaml` | §3 | `[ ]` |
| `corpus/registry/design-guardrails.yaml` | §3.3 | `[ ]` |
| `corpus/registry/faction-validation-rules.yaml` | §4 | `[ ]` |
| `corpus/registry/router-config.yaml` | §5 | `[ ]` |
| `corpus/registry/generation-constraints.yaml` | §6 | `[ ]` |

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
5. 625 tests must pass at the end of every section.
