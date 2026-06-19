# Karsac DM Assistant — Test Strategy

## Principles

Three rules govern every decision in this strategy.

**Tests document intent, not implementation.** When the pipeline is refactored — structured JSON output, new registry format, different local model — the tests should not change. They assert what the system should produce, not how it produces it.

**Every distinct code path has at least one test.** Not every entity, not every scenario. Every path through the pipeline that could fail in a distinct way has coverage. Adding a new proposal type or a new validation rule means adding tests before the code.

**Failures are specific.** A failing test tells you exactly what broke and where. "Validation failed" is not a useful failure. "Shadow Walker proposal contains Undercommon — language whitelist rule fired unexpectedly after refactor" is.

---

## Four Test Layers

```
Layer 1  Unit tests
         Fast, deterministic, no LLM call
         Run on every commit

Layer 2  Retrieval tests
         Real LLM, real corpus lookup, no proposal pipeline
         Run before merge and after corpus changes

Layer 3  Generation scenario tests
         Real LLM, full pipeline, Gherkin specs
         Run before merge and after pipeline changes

Layer 4  Regression snapshots
         Real LLM, full pipeline, cross-referenced against corpus
         Run before and after major refactors
```

---

## Layer 1 — Unit Tests

Fast, deterministic, no LLM call. Run on every commit. Every function, every branch, every rule.

### Scope

**Entity resolution**
- Name matching and alias resolution
- Coverage level classification (full / stub / minimal)
- Anchor file retrieval — major NPC file and entity card both retrieved
- Related entity allowlist construction from canonical file `related` block
- Title-prefixed compound proper noun handling (`Jarl Mathr` → `npcs/jarl-mathr`)
- Partial name matching (`Dugweb` matches `King Dugweb`)
- Possessive stripping (`Jarl Mathr's` → `Jarl Mathr`)
- Provisional entity register scans `proposals/`, excludes `_rejected/` and `_promoted/`

**Constraint injection**
- Correct block built for each proposal type × coverage level combination
- Per-section corpus anchor text injected for `canonical_reference_only` entities
- Ambiguity flag injection for flagged entities
- Faction profile rules injected for adversary proposals
- Chapter state (hot/simmering threads, arc position) injected correctly
- Stub-level constraint includes explicit field prohibition text
- Gap treatment instruction present for stub and minimal entities

**Section parser**
- Heading-to-field-name mapping for each proposal type
- Unrecognised heading detected and warned

**Pruner**
- Forbidden sections removed before write
- `effective_required = required_fields - forbidden_expansion_fields` fires correctly
- Pruned sections logged to `repair_log`
- Sentence strip pass removes forbidden pattern matches for `canonical_reference_only` entities
- Sentence strip logged to `repair_log.auto_repairs`
- WARNs suppressed inside self-labelled Provisional sections

**Content validator**
- Organisation-name detection fires on: Guild, Council, Order, Company, House, Clan, Cell, Network, Watch, Guard, Circle, Fellowship, Syndicate, League, Brotherhood, Sisterhood
- Corpus-anchor sentence check covers: overview, body, DM Notes, dm_only, player_safe, hooks, landmarks, factions sections
- Unsupported org name in DM Notes → FAIL
- Org name marked Provisional → WARN not FAIL
- Org name present in corpus anchor → PASS
- Word-level anchor fallback prevents false positives on canonical group names

**Deterministic repairs**
- Shadow Walker alignment `Neutral Evil` → `neutral` auto-repaired
- Shadow Walker `shortbow` → `throwing spike` auto-repaired with correct stats
- Repair logged to `repair_log.auto_repairs`

**Validator rules — hard fails**
- Faction registry mismatch
- Named NPC leakage inside place proposal
- Named NPC leakage inside encounter proposal
- Named NPC leakage inside NPC proposal (second named individual in dm_only)
- Canonical item state change language
- Character conflict resolves to entity canonical file not passage mention
- Stub overgeneration
- Non-5e mechanics (e.g. `Charisma (Reputation) saving throw`)
- Non-whitelisted language
- Forbidden content match from entity policy
- Unsupported invented entity in DM Notes

**Validator rules — warnings**
- Cosmological claim involving force registry entity
- Canonical tradition claim (Skald tradition, housecarl honour codes)
- Supernatural atmosphere without corpus support
- Invention volume threshold exceeded
- Flat skill bonus detected
- Action economy cost for free-action check
- Visibility/content mismatch (dm-only frontmatter + player_safe section)
- Provisional entity reference (exists only in unpromotable proposals)
- Ambiguity flag unresolved in output

**Exclusion lists**
- Pronouns not treated as named entities: He, His, She, Her, They, Their, It, Its, We, Our, You, Your, I, My
- Titles not treated as named entities: King, Jarl, Lord, Lady, Captain, Archivist, Elder, Housecarl, Skald, Truthspeaker
- Common nouns not treated as named entities: The, A, An, Fog, Stone, River, Gate
- Cosmological forces excluded from NPC boundary checks: Vishara, Maharuq, Dhurvaq, Yantravaq, Qathar, Sukaveth
- Article + title token combinations excluded: `The King`, `The Jarl`
- Related entity allowlist suppresses conflict checks for allowlisted entities
- Pruned sections excluded from missing-section warnings
- Self-labelled Provisional sections downgrade findings to INFO

**Registry loading**
- `factions.yaml` loads and parses correctly
- `proposal-policy.yaml` loads and parses correctly
- `faction-mechanical-overrides.yaml` loads and parses correctly
- Language whitelist enforced — anything not in list warns
- `Lösweg Sign` present in canonical languages list

**Character conflict resolution**
- Resolves to entity's own canonical file ID
- Does not resolve via passage mention
- `Mathr` → `npcs/jarl-mathr` not Truthspeaker passage
- `Vane` → corpus-present but not NPC type → downgraded to WARN

---

## Layer 2 — Retrieval Tests

Real LLM call, real corpus lookup, no proposal pipeline. Run before merge and after corpus changes. Assert source, completeness, and fidelity for each query category.

**Three assertions per scenario:**
- **Source** — correct corpus file(s) retrieved
- **Completeness** — answer reflects everything relevant in those files
- **Fidelity** — nothing invented, nothing contradicts source

### Evaluation

The evaluator (Claude Code or Codex running locally) reads:
- The query response
- The canonical corpus files directly from filesystem
- The test criteria

It returns a structured verdict per criterion: PASS / FAIL / NEEDS REVIEW with a specific finding and the corpus line that supports or contradicts.

### Scenarios by Query Category

**Rules retrieval**

```gherkin
Feature: Rules knowledge retrieval

  Scenario: Core 5e rule with no house modification
    Given the corpus contains the rule file
    And no Karsac house ruling modifies it
    When I ask how the rule works
    Then the response matches the 5e core rule
    And the response contains no invented modifications
    And the source is the correct rules file

  Scenario: Core 5e rule with Karsac house modification
    Given the corpus contains a house ruling that modifies a core rule
    When I ask how that rule works at the Karsac table
    Then the response reflects the house ruling not just the core rule
    And the house ruling takes precedence where they conflict

  Scenario: Rule not defined in corpus
    When I ask about a rule with no corpus entry
    Then the response says the rule is not defined in the corpus
    And the response does not invent a ruling
```

**NPC retrieval**

```gherkin
Feature: NPC knowledge retrieval

  Scenario: What the party can know about an NPC
    Given an NPC has player_safe content
    When I ask what the players know about that NPC
    Then the response contains only player_safe content
    And the response does not contain dm_only content
    And the response does not contain must_not_know content

  Scenario: DM layer for an NPC
    Given an NPC has dm_only content
    When I ask what the DM needs to know
    Then the response contains dm_only content
    And includes can_know and must_not_know fields
    And does not invent additional psychology

  Scenario: NPC with minimal corpus coverage
    Given an NPC has one sentence of corpus coverage
    When I ask about that NPC
    Then the response reflects only that sentence
    And the response does not invent characterisation
    And the response flags the coverage as minimal
```

**Item retrieval**

```gherkin
Feature: Item knowledge retrieval

  Scenario: Canonical item current state
    Given an item has a known current holder in items-state.json
    When I ask where that item is
    Then the response reflects the current state
    And does not invent a different location or holder

  Scenario: Item with untracked state
    Given an item's state is not recorded in items-state.json
    When I ask about that item's current location
    Then the response says the state is untracked
    And does not invent a location

  Scenario: Item description matches canonical entry
    When I ask what a canonical item looks like
    Then the response matches the canonical description
    And does not extend or embellish it
```

**Campaign state retrieval**

```gherkin
Feature: Campaign state retrieval

  Scenario: Hot thread correctly identified
    Given a thread is marked hot in world-threads.json
    When I ask what the active threads are
    Then that thread appears in the response as urgent

  Scenario: Simmering thread not foregrounded
    Given a thread is simmering not hot
    When I ask what the active threads are
    Then the simmering thread is not presented as urgent
    And is distinguished from hot threads

  Scenario: Chapter position reflected correctly
    Given the campaign is at a known chapter and session
    When I ask where we are in the campaign
    Then the response reflects that position
    And does not describe future chapter events
    And does not describe events that have not happened yet
```

**Faction retrieval**

```gherkin
Feature: Faction knowledge retrieval

  Scenario: Faction epistemic limits respected
    Given a faction has must_not_know entries
    When I ask what that faction knows about a topic
    Then the response reflects their epistemic limit
    And does not reveal what they must not know
    And does not invent alternative knowledge

  Scenario: Faction relationship correctly described
    When I ask about a canonical faction relationship
    Then the response matches the canonical record
    And does not invent additional relationship detail
```

**Cosmology retrieval**

```gherkin
Feature: Cosmology retrieval

  Scenario: Resolved cosmological fact
    Given a cosmological fact is explicitly stated in corpus
    When I ask about that fact
    Then the response matches the corpus statement
    And does not extend or reinterpret it

  Scenario: Unresolved cosmological detail
    Given a detail is flagged as unresolved in corpus
    When I ask about that detail
    Then the response flags it as unresolved
    And does not invent resolution

  Scenario: DM-only cosmological content not leaked
    Given a cosmological fact is dm-only
    When I ask a player-facing query about it
    Then the response does not reveal the dm-only content
```

**PC retrieval**

```gherkin
Feature: PC knowledge retrieval

  Scenario: PC arc correctly described
    When I ask about a PC's arc
    Then the response reflects the canonical arc framing
    And does not invent new arc elements
    And does not confuse this PC's arc with another's

  Scenario: PC must_not_know respected
    Given a PC does not yet know something canonically
    When I ask what that PC knows about a topic
    Then the response reflects only what they know
    And does not reveal what they do not know yet
```

### Retrieval Failure Modes

Each retrieval scenario also asserts against these specific failure modes:

| Failure mode | Detection method |
|---|---|
| Wrong file retrieved | Assert source file in response metadata |
| Partial retrieval | Completeness assertion against full corpus content |
| Invention without retrieval | Cross-reference every sentence against corpus anchor |
| Visibility leak | Assert visibility level respected in response |
| Confidence without basis | Assert ambiguity flags produce hedged language |

---

## Layer 3 — Generation Scenario Tests

Real LLM call, full pipeline. Gherkin specs. Run before merge and after pipeline changes. Implementation changes beneath them; scenarios do not change unless intent changes.

### Evaluation

Same evaluator pattern as Layer 2. The evaluator reads the proposal file and the canonical corpus files directly from filesystem and returns a structured verdict per criterion.

### Axis 1 — Proposal Types

One scenario per proposal type exercising the full pipeline.

```gherkin
Feature: Proposal types

  Scenario: NPC — corpus-named full coverage
    Given I propose "Jarl Beorn" as an NPC
    Then validation passes
    And output contains "deceived not corrupted"
    And output contains "will act if shown evidence"
    And output contains "route to Dugweb"
    And no invented backstory is present
    And no invented secrets are present

  Scenario: NPC — corpus-named minimal coverage
    Given I propose "Maret" as an NPC
    Then validation passes
    And fewer than 4 fields are populated
    And no characterisation is invented

  Scenario: NPC — corpus-named with ambiguity flags
    Given I propose "King Dugweb" as an NPC
    Then validation passes
    And Kurogane details are not extended beyond corpus
    And Shade of Qadim al-Sharr details are not extended beyond corpus
    And ambiguity flags appear in frontmatter

  Scenario: NPC — new entity no corpus anchor
    Given I propose a new NPC not in the canonical registry
    Then validation passes or needs-review
    And no canonical entity is contradicted
    And no named NPC is invented inside the proposal

  Scenario: Place — corpus-named full coverage
    Given I propose "Valweg" as a place
    Then geography matches fjord not river
    And output contains dark timber or fire-lit mead halls
    And no invented districts are present
    And no invented factions are present
    And no unguarded invented org names are present
    And no Silent Hand reference is present

  Scenario: Place — new entity
    Given I propose a new place not in the canonical registry
    Then no named NPCs are invented inside the proposal
    And no factions are invented without Provisional flag

  Scenario: Adversary — Shadow Walker faction
    Given I propose a Shadow Walker urban adversary
    Then alignment is neutral
    And languages contain no Undercommon
    And weapons contain no shortbow or longbow
    And no spellcasting is present
    And doctrine contains restraint language

  Scenario: Adversary — deniable asset House Mathr
    Given I propose a deniable road ambush adversary for House Mathr
    Then Mathr is not named explicitly in player-safe sections
    And faction affiliation is marked deniable

  Scenario: Encounter — social obstruction
    Given I propose a road encounter for chapter 3
    Then the encounter contains no more than 2 NPCs
    And the encounter contains no more than 3 resolutions
    And no new items are introduced outside the canonical item registry
    And no supernatural atmosphere is present without corpus support

  Scenario: Item — canonical item
    Given I propose a canonical item
    Then the proposal does not invent a new state for the item
    And the item description matches canonical description

  Scenario: Concept — canonical tradition
    Given I propose a canonical concept
    Then the proposal does not make alignment claims about the tradition
    And no canonical NPCs are invented inside the proposal

  Scenario: Faction — canonical faction
    Given I propose a canonical faction
    Then the proposal does not invent new members
    And does not invent new operational goals beyond corpus
```

### Axis 2 — Coverage Levels

```gherkin
Feature: Coverage levels

  Scenario: Full coverage — invention prohibited
    Given a corpus-named entity with full coverage
    When I propose that entity
    Then the output contains only corpus-supported content
    And the repair log records any pruned sections

  Scenario: Stub coverage — minimal output
    Given a corpus-named entity with stub coverage
    When I propose that entity
    Then fewer than 4 fields are populated
    And no characterisation is invented

  Scenario: Minimal coverage — near-empty output
    Given a corpus-named entity with minimal coverage
    When I propose that entity
    Then only name and role are populated
    And all other fields are absent or marked unresolved

  Scenario: Stub place — no district structure
    Given a corpus-named place with stub coverage
    When I propose that place
    Then no districts are present
    And no factions are present
    And no named landmarks are present
```

### Axis 3 — Validation Rules

One scenario per major validation rule.

```gherkin
Feature: Validation rules

  Scenario: Faction registry mismatch hard-fails
  Scenario: Named NPC leakage in place proposal hard-fails
  Scenario: Named NPC leakage in encounter proposal hard-fails
  Scenario: Named NPC leakage inside NPC proposal hard-fails
  Scenario: Canonical item state change hard-fails
  Scenario: Character conflict resolves to canonical file not passage
  Scenario: Provisional entity reference warns
  Scenario: Promoted entity reference does not warn
  Scenario: Non-whitelisted language hard-fails
  Scenario: Shadow Walker shortbow auto-repaired before validation
  Scenario: Shadow Walker Neutral Evil auto-repaired before validation
  Scenario: Non-5e mechanic hard-fails
  Scenario: Cosmological claim warns
  Scenario: Canonical tradition claim warns
  Scenario: Supernatural atmosphere warns
  Scenario: Invention volume threshold warns then fails
  Scenario: Flat skill bonus warns
  Scenario: Action economy for free-action check warns
  Scenario: Visibility content mismatch warns
  Scenario: Stub overgeneration hard-fails
  Scenario: Org name in DM Notes without corpus support fails
  Scenario: Org name marked Provisional warns not fails
  Scenario: Pruned section does not trigger missing-section warning
  Scenario: Pronoun not treated as named entity
  Scenario: Title compound treated as single entity
  Scenario: Related entity reference not treated as conflict
  Scenario: Ambiguity flag injected for flagged entities
  Scenario: Required content present in canonical reference output
  Scenario: Forbidden content absent from canonical reference output
  Scenario: Sentence strip removes forbidden pattern before validation
  Scenario: Self-labelled Provisional section WARNs downgraded to INFO
```

### Axis 4 — Repair Pipeline

```gherkin
Feature: Repair pipeline

  Scenario: Forbidden section pruned before write
  Scenario: Pruned section recorded in repair log
  Scenario: Auto-repair recorded in repair log
  Scenario: effective_required excludes forbidden fields
  Scenario: DM Notes scanned for unsupported entities
  Scenario: Unsupported entity in DM Notes repaired or flagged
  Scenario: Safe repair replaces invented faction with generic phrase
  Scenario: Sentence strip fires before validation pass
  Scenario: Stripped sentences logged to repair log
```

### Axis 5 — Chapter State and Context

```gherkin
Feature: Chapter state injection

  Scenario: Hot threads injected as context before generation
  Scenario: Simmering threads available but not foregrounded
  Scenario: Chapter position informs encounter proposal scope
  Scenario: Party inventory items not invented in encounter proposals
```

### Axis 6 — Prose Quality

Automated assertions catch obvious failures. Human evaluation gate (rubric) catches register failures that are technically correct but wrong in feel.

```gherkin
Feature: Prose quality — automated assertions

  Scenario: Player-safe NPC description is performable
    Given a generated NPC proposal
    When I read the player_safe description
    Then it is under 100 words
    And it contains at least one specific physical or behavioural detail
    And it contains no anachronistic phrasing
    And it does not list attributes without grounding them in behaviour or appearance

  Scenario: Atmosphere text uses concrete detail
    Given a generated place proposal
    When I read the arrival description
    Then it uses concrete sensory detail not abstract mood
    And it does not use generic fantasy descriptors
    And the description does not resolve the tension it creates

  Scenario: Lines to inhabit are in character voice
    Given a generated NPC proposal with lines to inhabit
    Then no line contains modern phrasing
    And each line reveals something beyond its literal content
    And no line explains what it means

  Scenario: DM notes are actionable
    Given a dm_only section
    Then each paragraph answers a question a DM would actually ask
    And no paragraph describes NPC feelings without a behavioural consequence

  Scenario: Proposal does not over-explain
    Given any generated proposal
    Then no section explains its own significance
    And no section tells the DM what the players will think or feel
    And ambiguity flagged in corpus remains ambiguous in the proposal
```

**Human evaluation gate — pre-promotion rubric**

Run this before promoting any proposal. Two minutes, nine checks.

```
Register
  [ ] Sounds like Karsac not generic fantasy
  [ ] No anachronistic phrasing
  [ ] Concrete detail over abstract mood

Performability
  [ ] Player-safe description under 100 words
  [ ] At least one specific image a DM can deliver
  [ ] Lines to inhabit are speakable not written
  [ ] DM notes answer questions not describe feelings

Negative space
  [ ] Nothing over-explained
  [ ] Ambiguity preserved where corpus preserves it
```

Any failed check → proposal returned to pipeline with a note. If the same failure pattern appears twice → add to corpus style-guide entry.

---

## Layer 4 — Regression Snapshots

Real LLM call, full pipeline. Run before and after every major refactor. Cross-reference output against canonical corpus files. Any new invented content against previous known-good snapshot flagged for human review before the change is accepted.

### Snapshot Set — 16 Canonical Runs

Covers every distinct code path: all proposal types, all coverage levels, both corpus-named and new entity paths, all major entity categories, all major validation rules.

| # | Subject | Type | Coverage | Path tested |
|---|---|---|---|---|
| 01 | Jarl Beorn | NPC | full | corpus-named, canonical reference |
| 02 | Maret | NPC | minimal | corpus-named, stub/minimal |
| 03 | King Dugweb | NPC | full | corpus-named, ambiguity flags |
| 04 | Astrid Half-Stone | NPC | none | new entity, no corpus anchor |
| 05 | Brynja Thorgrimsdotter | NPC | full | high relationship density |
| 06 | Valweg | Place | full | corpus-named, canonical reference |
| 07 | Hrimfell | Place | none | new entity, invention-risk |
| 08 | Törweg | Place | full | sub-location rich |
| 09 | Shadow Walker urban variant | Adversary | — | Shadow Walker faction, full profile |
| 10 | Road ambush unit | Adversary | — | deniable asset, House Mathr |
| 11 | Valweg gate housecarl | Adversary | — | non-corrupt obstacle, Lösweg tradition |
| 12 | Fjord road approach | Encounter | — | chapter 3, social obstruction |
| 13 | Mathr Token | Item | full | canonical item, state-sensitive |
| 14 | Skald Tradition | Concept | full | canonical tradition, load-bearing |
| 15 | House Mathr | Faction | full | canonical faction, high sensitivity |
| 16 | New place with invented factions | Place | none | invention-risk, Silent Hand class |

### Per-Snapshot Assertions

Each snapshot asserts:
- Validation status (pass / needs-review / fail)
- Invented content count (zero for canonical reference, flagged for new entities)
- Repair log present and accurate
- No regression against previous known-good run

### Snapshot Evaluation

The evaluator (Claude Code / Codex locally) for each snapshot:
1. Reads the generated proposal file
2. Reads the canonical corpus files directly from filesystem
3. Classifies each claim in the proposal as CANON / INFERRED / INVENTED
4. Reports any INVENTED findings with the proposal text and corpus file consulted
5. Compares against previous snapshot — flags any new INVENTED content
6. Returns summary table

```
| Snapshot | Validation | CANON | INFERRED | INVENTED | vs Previous | Result |
|----------|------------|-------|----------|----------|-------------|--------|
| 01 Beorn | PASS       | 9/9   | 0        | 0        | no change   | PASS   |
| ...      | ...        | ...   | ...      | ...      | ...         | ...    |
```

---

## Coverage Map

Every distinct pipeline code path mapped to at least one test.

| Code path | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| Entity resolution | ✓ | — | Axis 1 | 01–05 |
| Constraint injection | ✓ | — | Axis 2 | 01–08 |
| Section parser | ✓ | — | Axis 4 | — |
| Pruner | ✓ | — | Axis 4 | all |
| Sentence strip | ✓ | — | Axis 3 | 03 |
| Content validator | ✓ | — | Axis 3 | 06, 16 |
| Deterministic repairs | ✓ | — | Axis 4 | 09–10 |
| Validation hard fails | ✓ | — | Axis 3 | multiple |
| Validation warnings | ✓ | — | Axis 3 | multiple |
| Provisional register | ✓ | — | Axis 3 | 16 |
| Chapter state injection | ✓ | — | Axis 5 | 12 |
| New entity path | — | — | Axis 1 | 04, 07, 16 |
| Canonical reference path | — | — | Axis 1 | 01–03, 06 |
| Faction profile path | — | — | Axis 1 | 09–10 |
| Encounter constraints | — | — | Axis 1 | 12 |
| Item state sensitivity | — | — | Axis 1 | 13 |
| Rules retrieval | — | ✓ | — | — |
| NPC retrieval | — | ✓ | — | — |
| Item retrieval | — | ✓ | — | — |
| Campaign state retrieval | — | ✓ | — | — |
| Faction retrieval | — | ✓ | — | — |
| Cosmology retrieval | — | ✓ | — | — |
| PC retrieval | — | ✓ | — | — |
| Prose quality | — | — | Axis 6 | — |

---

## When Each Layer Runs

| Trigger | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| Every commit | ✓ | — | — | — |
| Before merge | ✓ | ✓ | ✓ | — |
| After corpus change | ✓ | ✓ | — | — |
| After pipeline change | ✓ | — | ✓ | — |
| Before major refactor | ✓ | ✓ | ✓ | ✓ (baseline) |
| After major refactor | ✓ | ✓ | ✓ | ✓ (diff review) |

**Significant change** — any change to `proposalConstraints.ts`, `proposalGovernance.ts`, `proposalEntityRegistry.ts`, `proposal-policy.yaml`, `factions.yaml`, or `faction-mechanical-overrides.yaml`.

**Major refactor** — structured JSON output adoption, local model change, registry format change, pruner architecture change.

---

## Agent Build Instructions

### Overview

Build the test suite for the Karsac DM Assistant pipeline. The pipeline source is in `karsac-dm-assistant/`. The corpus is in `karsac-dm-assistant/corpus/`. Existing unit tests are in `karsac-dm-assistant/karsac-registry/tests/`. Current suite: 625 passing.

Do not break existing tests. Add regression coverage for each new test. Run `npm test` to verify after each layer is complete.

---

### Step 1 — Audit existing coverage

Before writing any new tests, read the existing test files:

```
karsac-dm-assistant/karsac-registry/tests/proposal-governance.test.ts
karsac-dm-assistant/karsac-registry/tests/proposal-routing.test.ts
karsac-dm-assistant/karsac-registry/tests/proposals.test.ts
```

Map each existing test to the coverage map above. Identify which Layer 1 items are already covered and which are missing. Report before proceeding.

---

### Step 2 — Complete Layer 1 unit tests

File: `karsac-dm-assistant/karsac-registry/tests/unit/`

Create one test file per module being tested:

```
entity-resolution.test.ts
constraint-injection.test.ts
section-parser.test.ts
pruner.test.ts
content-validator.test.ts
deterministic-repairs.test.ts
validator-rules.test.ts
registry-loading.test.ts
```

For each test file:
- Mock all external dependencies including filesystem reads and LLM calls
- Test every function exported by the module
- Test every branch condition
- Test every validation rule listed in the Layer 1 scope above
- Use the coverage map to confirm no path is missed

Priority order for new tests:
1. Exclusion lists (pronouns, titles, common nouns, cosmological forces)
2. Sentence strip pass
3. Provisional section WARN suppression
4. Title-prefixed allowlist matching
5. Character conflict canonical file resolution
6. effective_required calculation
7. Org-name detection in DM Notes
8. Any Layer 1 item not already covered by existing tests

Run `npm test` after each file. Target: all passing, coverage map fully satisfied.

---

### Step 3 — Build Layer 2 retrieval test infrastructure

Layer 2 tests make real LLM calls. They require:
- A test runner that can call the pipeline's query interface
- An evaluator function that reads corpus files from filesystem and assesses response fidelity
- A structured verdict schema: `{ criterion, status, finding, corpus_line }`

**Evaluator design**

The evaluator is called after each retrieval query. It receives:
- The query response text
- The expected source corpus file path(s)
- The test criteria list

It reads the corpus files directly from `karsac-dm-assistant/corpus/` and for each criterion returns:

```typescript
interface RetrievalVerdict {
  criterion: string
  status: 'PASS' | 'FAIL' | 'NEEDS_REVIEW'
  finding?: string
  corpus_line?: string
}
```

**Test file structure**

Create `karsac-dm-assistant/karsac-registry/tests/retrieval/` with one file per query category:

```
rules-retrieval.test.ts
npc-retrieval.test.ts
item-retrieval.test.ts
campaign-state-retrieval.test.ts
faction-retrieval.test.ts
cosmology-retrieval.test.ts
pc-retrieval.test.ts
```

Implement the scenarios listed in the Layer 2 section above. Each scenario:
1. Calls the pipeline query interface with the specified query
2. Passes response and corpus paths to the evaluator
3. Asserts all verdicts are PASS

These tests are slow and should be tagged `@retrieval` so they can be run selectively:

```
npm test -- --tag retrieval
```

---

### Step 4 — Build Layer 3 generation scenario infrastructure

Layer 3 tests run the full pipeline including LLM generation. They require:
- A scenario runner that calls `propose.ts` with a given prompt
- The same evaluator pattern as Layer 2, extended for proposal-specific assertions
- The human evaluation rubric encoded as a checklist function

**Scenario runner**

```typescript
async function runScenario(prompt: string): Promise<{
  proposalPath: string
  validationStatus: 'pass' | 'needs-review' | 'fail'
  validationNotes: string[]
  repairLog: RepairLog
}>
```

**Proposal evaluator**

Extends the retrieval evaluator with proposal-specific checks:
- Reads the generated proposal file
- Reads the canonical corpus file for the proposal subject (if corpus-named)
- Classifies each claim as CANON / INFERRED / INVENTED
- Checks structural assertions (field count, section presence, org names)
- Checks content assertions (required phrases present, forbidden phrases absent)

**Test file structure**

Create `karsac-dm-assistant/karsac-registry/tests/scenarios/` with one file per axis:

```
axis1-proposal-types.test.ts
axis2-coverage-levels.test.ts
axis3-validation-rules.test.ts
axis4-repair-pipeline.test.ts
axis5-chapter-state.test.ts
axis6-prose-quality.test.ts
```

Implement the scenarios listed in the Layer 3 section above.

Tag these `@scenario`:

```
npm test -- --tag scenario
```

**Prose quality automated checks**

For Axis 6, implement these as assertions the evaluator can check automatically:
- Word count under 100 for player_safe descriptions
- Anachronistic phrase detection (wordlist of modern terms)
- Generic fantasy descriptor detection (ancient, mystical, foreboding, enigmatic, etc.)
- Attribute list without behavioural grounding (stern, cautious, wise appearing without context)

The human evaluation rubric is not automated — it produces a checklist output that a human reviews before promotion. Implement it as a function that generates the checklist from the proposal content, not as a pass/fail assertion.

---

### Step 5 — Build Layer 4 regression snapshot infrastructure

**Snapshot runner**

```typescript
async function runSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
  // run pipeline
  // evaluate output against corpus
  // compare against stored baseline
  // return diff
}

interface SnapshotConfig {
  id: string
  prompt: string
  expectedValidation: 'pass' | 'needs-review' | 'fail'
  expectedInventedCount: number
  corpusFiles: string[]
}

interface SnapshotResult {
  id: string
  validation: string
  canonCount: number
  inferredCount: number
  inventedCount: number
  inventedFindings: InventedFinding[]
  vsBaseline: 'no-change' | 'regression' | 'improvement'
  result: 'PASS' | 'FAIL' | 'NEEDS-REVIEW'
}
```

**Baseline storage**

Store baseline snapshots in:

```
karsac-dm-assistant/karsac-registry/tests/snapshots/baselines/
  01-jarl-beorn.baseline.json
  02-maret.baseline.json
  ...
  16-new-place-with-factions.baseline.json
```

On first run, generate baselines. On subsequent runs, diff against baselines and fail on regression (new INVENTED findings not present in baseline).

**Test file**

Create `karsac-dm-assistant/karsac-registry/tests/snapshots/regression.test.ts`

Implement all 16 snapshots from the snapshot set above.

Tag `@snapshot`:

```
npm test -- --tag snapshot
```

---

### Step 6 — CI configuration

Update the test runner configuration to support layered execution:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --tag unit",
    "test:retrieval": "vitest run --tag retrieval",
    "test:scenarios": "vitest run --tag scenario",
    "test:snapshots": "vitest run --tag snapshot",
    "test:pre-merge": "vitest run --tag unit --tag retrieval --tag scenario",
    "test:pre-refactor": "vitest run"
  }
}
```

---

### Step 7 — Verify

After all layers are built:

```bash
# Layer 1 only — should be fast
npm run test:unit

# Layer 1 + 2 — before merge
npm run test:pre-merge

# Full suite — before major refactor
npm test
```

Report:
- Total tests per layer
- Any failures with specific findings
- Coverage map — confirm every path has at least one test
- Estimated run time per layer

---

### Acceptance Criteria

The test suite is complete when:

- [ ] All existing 625 tests still pass
- [ ] Layer 1 coverage map fully satisfied — every path has at least one unit test
- [ ] Layer 2 has at least one scenario per query category (7 categories, minimum 3 scenarios each)
- [ ] Layer 3 has at least one scenario per axis item listed above
- [ ] Layer 4 has all 16 snapshots with baselines generated
- [ ] `npm run test:unit` completes in under 30 seconds
- [ ] `npm run test:pre-merge` completes in under 5 minutes
- [ ] `npm test` (full suite) completes and all tests pass or are correctly tagged as expected-flaky for stochastic scenarios
- [ ] Coverage map document updated to reflect actual test locations

---

## Stochastic Test Handling

Some generation scenarios are stochastic — the local model occasionally produces a forbidden pattern that the pipeline correctly catches and removes or fails on. These are not false positives. They are correct catches of real invention.

Tag stochastic scenarios `@flaky` and configure the runner to retry up to 3 times before marking as failed. A scenario that passes on retry is recorded as PASS with a retry count. A scenario that fails on all 3 retries is a genuine failure.

```typescript
// Example
it.flaky('Dugweb does not extend Shade details', { retries: 3 }, async () => {
  // ...
})
```

Document which scenarios are expected-stochastic and why. This list is a signal — if it grows, the sentence strip or forbidden pattern coverage needs extending.

---

## Future Extensions

When these are implemented, extend the test suite accordingly:

**Structured JSON output** — when the pipeline adopts JSON schema generation, add Layer 1 tests for schema validation and Layer 3 scenarios asserting that forbidden fields cannot be generated structurally. Update the stochastic test list — many currently-stochastic scenarios should become deterministic.

**Edge token creative pass** — when the Haiku/Sonnet creative inference pass is added, add Layer 3 scenarios asserting that the creative pass produces doctrine-expressive mechanics without violating canon, faction, or language constraints. The evaluator should check the creative pass output against the same corpus files.

**Proposal genealogy** — when inter-node contradiction tracking is implemented, add Layer 1 tests for the genealogy resolver and Layer 3 scenarios asserting that contradictions between proposals are caught before promotion.

**Automatic chapter state mutation** — when promotion triggers state updates, add Layer 1 tests for the state mutation logic and Layer 3 scenarios asserting that promoted proposals correctly update `world-threads.json` and `items-state.json`.