# Karsac DM Assistant Roadmap

## Current milestone

The current direction is sound:

> Do not make the model bigger first. Make the problem smaller, better bounded, and better governed.

The assistant is becoming a domain-governed LLM pipeline: corpus grounding, registry-backed policy, deterministic repair, validation, and promotion gates around a local model.

Schema controls shape. Governance controls meaning.

---

## 0. Bank the current milestone

- [x] Commit the current working state.
- [x] Tag it as `beta-0.1-governed-proposals`.
- [x] Capture the architecture summary in `docs/architecture.md`.
- [x] Capture the “models propose, code governs” principle in `docs/design-principles.md`.

---

## 1. Stabilise the current proposal pipeline

### 1.1 Fix remaining false positives

- [x] Fix named entity boundary issues:
  - [x] Pronouns such as `He`, `His`, `She`, `They`.
  - [x] Title handling such as `King Dugweb`, `Jarl Beorn` — title-prefixed allowlist matching.
  - [x] Common nouns such as `Fog`, `Stone`, `Road`.
- [x] Ensure character conflict resolution uses the canonical entity file, not any passage that merely mentions the name.
- [x] Ensure canonical related entities are allowlisted where appropriate.

### 1.2 Improve pre-write pruning

- [x] Prune forbidden sections before writing proposal files.
- [x] Ensure policy-pruned sections are not treated as missing required sections.
- [x] Write a clear repair log:
  - [x] Pruned sections.
  - [x] Deterministic repairs.
  - [x] Invented content flagged.
  - [x] Policy rule responsible.

### 1.3 Tighten sentence-level content validation

- [x] For canonical-reference-only entities, check content inside permitted sections.
- [x] Flag unsupported invented sentences (anchor content check, org-name detection).
- [x] Strip known forbidden sentences where safe (sentence strip for fail-severity forbidden patterns).
- [x] Leave unresolved gaps unresolved rather than letting the model fill them (Provisional suppression, stub policy).

---

## 2. Move towards structured generation

### 2.1 Prototype JSON/schema-constrained output

- [ ] Generate proposals as structured JSON instead of freeform Markdown.
- [ ] Derive allowed fields from `proposal-policy.yaml`.
- [ ] For stub entities, generate only minimal allowed fields.
- [ ] Render Markdown from structured JSON after validation.

### 2.2 Keep governance after schema generation

- [ ] Keep corpus anchors.
- [ ] Keep faction profiles.
- [ ] Keep deterministic repairs.
- [ ] Keep item-state checks.
- [ ] Keep doctrine validation.
- [ ] Keep promotion gates.

Structured output should reduce what the model can produce. The governance layer should still decide whether the content is campaign-safe.

---

## 3. Expand proposal type coverage

### 3.1 NPC proposals

- [ ] Strengthen `can_know` / `must_not_know`.
- [ ] Add “minimal canonical NPC” mode.
- [ ] Prevent invented backstory for named corpus NPCs.
- [ ] Allow richer generation only for explicitly new NPCs.

### 3.2 Place proposals

- [ ] Support:
  - [ ] Canonical place stub.
  - [ ] New provisional place.
  - [ ] Expanded place from existing stub.
- [ ] Prevent districts, factions, landmarks and NPCs for stub-level canonical places unless allowed by policy.

### 3.3 Encounter proposals

- [ ] Add strict encounter contracts:
  - [ ] Maximum two NPCs by default.
  - [ ] Maximum three resolutions.
  - [ ] No new items unless explicitly requested.
  - [ ] No supernatural atmosphere unless corpus-supported.
- [ ] Add fail-forward structure.
- [ ] Inject chapter-state context before generation.

### 3.4 Adversary proposals

- [ ] Keep the current faction-doctrine-trumps-base rule.
- [ ] Add more faction profiles beyond Shadow Walkers.
- [ ] Improve variant option quality:
  - [ ] No flat bonuses.
  - [ ] No vague traits.
  - [ ] No long-horizon abilities in encounter stat blocks.
- [ ] Add doctrine-to-mechanics quality checks.

---

## 4. Improve data-driven policy

### 4.1 Registry expansion

Move more policy into data:

- [ ] Proposal contracts.
- [ ] Entity coverage levels.
- [ ] Ambiguity flags.
- [ ] Faction doctrine rules.
- [ ] Language whitelists.
- [ ] Weapon substitutions.
- [ ] Canonical item state rules.
- [ ] Allowed/prohibited expansion fields.
- [ ] Promotion dependencies.

### 4.2 Coverage audit

- [ ] Mark entities as:
  - [ ] Full.
  - [ ] Stub.
  - [ ] Minimal.
  - [ ] Unresolved.
  - [ ] Canonical-reference-only.
- [ ] Add explicit notes for high-risk entities:
  - [ ] Beorn.
  - [ ] Valweg.
  - [ ] Dugweb.
  - [ ] Maret.
  - [ ] Mathr.
  - [ ] Vane.
  - [ ] Brynja.

---

## 5. Proposal lifecycle and genealogy

### 5.1 Proposal states

Add clear states:

- [ ] Proposed.
- [ ] Needs review.
- [ ] Rejected.
- [ ] Promoted.
- [ ] Superseded.

### 5.2 Rejected proposal handling

- [ ] Move rejected proposals to `_rejected/`.
- [ ] Exclude `_rejected/` from provisional entity scanning.
- [ ] Prevent failed inventions becoming pseudo-canon.

### 5.3 Proposal genealogy

Track:

- [ ] Which corpus nodes a proposal used.
- [ ] Which entities it introduced.
- [ ] Which promoted proposal created which entity.
- [ ] Whether later proposals depend on earlier provisional material.

---

## 6. Canon and state tracking

### 6.1 Canonical item state tracker

Track:

- [ ] Current holder.
- [ ] Current location.
- [ ] Known by players?
- [ ] Known by NPCs?
- [ ] State changed by session?
- [ ] State changed by proposal?

### 6.2 Chapter state mutation

After promotion, optionally update:

- [ ] Campaign state.
- [ ] NPC state.
- [ ] Item state.
- [ ] World threads.
- [ ] Player knowledge.
- [ ] Chapter planning files.

Keep this manual or review-gated at first.

---

## 7. Table testing

### 7.1 Run real Chapter 3 prep tests

Use the assistant to generate:

- [ ] One NPC.
- [ ] One place.
- [ ] One encounter.
- [ ] One adversary.
- [ ] One road event.
- [ ] One Valweg social scene.

### 7.2 Measure usefulness

For each output, record:

- [ ] Usable as-is?
- [ ] Needed 5-minute edit?
- [ ] Needed heavy rewrite?
- [ ] Canon errors caught?
- [ ] Canon errors missed?
- [ ] Did it help at the table?

### 7.3 Decide if edge-token pass is needed

Only after table testing, decide whether to add an external model pass for:

- [ ] Stronger doctrine-to-mechanic inference.
- [ ] Better modular traits.
- [ ] Better encounter consequences.
- [ ] More surprising mechanics.

---
## 8. Test strategy and implementation

### 8.1 Testing principle

The test suite should prove that the pipeline is safe, not merely that it can produce attractive prose.

The core test question is:

> Can the system generate useful material while preventing unsupported canon, invalid mechanics, faction drift, and proposal-state leakage?

### 8.2 Test layers

- [ ] Unit tests for deterministic functions:
  - [ ] Entity resolution.
  - [ ] Policy loading.
  - [ ] Section parsing.
  - [ ] Pre-write pruning.
  - [ ] Deterministic repairs.
  - [ ] Language whitelist checks.
  - [ ] Faction-profile checks.
  - [ ] Stat-block normalisation.
  - [ ] Named-entity boundary detection.

- [ ] Policy-registry tests:
  - [ ] `proposal-policy.yaml` loads successfully.
  - [ ] Entity coverage levels resolve correctly.
  - [ ] Proposal contracts produce the expected allowed/forbidden fields.
  - [ ] Ambiguity flags are injected.
  - [ ] Required and forbidden content rules are applied.
  - [ ] Faction mechanical overrides are applied from data, not hard-coded logic.

- [ ] Golden prompt tests:
  - [ ] Run stable test prompts for known entities such as Beorn, Valweg, Maret and Dugweb.
  - [ ] Store expected validation results.
  - [ ] Assert that known bad inventions are blocked or pruned.
  - [ ] Assert that known canonical facts are preserved.
  - [ ] Keep these prompts deliberately short to prove context injection is doing the work.

- [ ] Regression tests for past failures:
  - [ ] `Undercommon` on a Shadow Walker fails.
  - [ ] `Neutral Evil` on a Shadow Walker is repaired or fails.
  - [ ] `Shortbow` on an urban cover-identity Shadow Walker is replaced.
  - [ ] Beorn longevity ritual is blocked.
  - [ ] Valweg river/fishmongers/generic city invention is blocked.
  - [ ] Silent Hand-style invented factions are blocked.
  - [ ] Named NPC leakage inside place, encounter or NPC proposals is blocked.
  - [ ] Canonical item state changes are blocked.
  - [ ] Pronouns and titles do not trigger false named-entity failures.

- [ ] Live pipeline smoke tests:
  - [ ] Run one NPC, one place, one adversary and one encounter through the full proposal command.
  - [ ] Confirm files are written to the correct proposal directory.
  - [ ] Confirm repair logs are present.
  - [ ] Confirm validation output is readable.
  - [ ] Confirm no proposal mutates campaign state automatically.

- [ ] Table-readiness tests:
  - [ ] Mark each generated proposal as:
    - [ ] Usable as-is.
    - [ ] Usable with light edit.
    - [ ] Needs review.
    - [ ] Reject.
  - [ ] Record whether the failure was:
    - [ ] Retrieval/context failure.
    - [ ] Model invention.
    - [ ] Policy gap.
    - [ ] Validator false positive.
    - [ ] Weak creative output.
    - [ ] Weak mechanical design.

### 8.3 Test fixtures

Create fixtures for:

- [ ] Canonical NPC with full coverage: Jarl Beorn.
- [ ] Canonical NPC with minimal coverage: Maret.
- [ ] Canonical NPC with ambiguity flags: King Dugweb.
- [ ] Canonical place with stub/limited coverage: Valweg.
- [ ] New provisional adversary: Shadow Walker urban infiltrator.
- [ ] New provisional encounter: first approach to Valweg.
- [ ] Known bad generated proposal containing invented sections.
- [ ] Known bad generated proposal containing invalid mechanics.
- [ ] Known bad generated proposal containing forbidden faction drift.

### 8.4 Acceptance thresholds

Before treating the system as Beta-useful:

- [ ] Full test suite passes.
- [ ] Golden prompts produce no unguarded canon invention.
- [ ] Known bad historic failures are caught or pruned.
- [ ] False positives are low enough that validation remains trusted.
- [ ] Failed proposals are safe to read because forbidden material is pruned before write.
- [ ] Repair logs explain what happened without hiding the model’s mistakes.

### 8.5 Manual review loop

For every promoted proposal:

- [ ] Review validation notes.
- [ ] Review repair log.
- [ ] Confirm no invented canon survived.
- [ ] Confirm player-safe and DM-only boundaries are correct.
- [ ] Confirm `can_know` and `must_not_know` fields are obeyed.
- [ ] Confirm the proposal is actually useful at the table.
- [ ] Only then promote.

---

## 9. Data-driven architecture

### 9.1 Principle

The long-term direction is:

> Policy in data. Execution in code.

The code should not know that Beorn must be deceived rather than corrupted, or that Shadow Walkers should not inherit shortbows from Spy. The code should load those rules from registries and apply them generically.

### 9.2 What should live in data

Move or keep the following in registry files:

- [ ] Entity registries:
  - [ ] NPCs.
  - [ ] Places.
  - [ ] Factions.
  - [ ] Items.
  - [ ] Forces.
  - [ ] Events.
  - [ ] Concepts.

- [ ] Proposal policies:
  - [ ] Proposal type contracts.
  - [ ] Required fields.
  - [ ] Optional fields.
  - [ ] Forbidden fields.
  - [ ] Allowed expansion fields.
  - [ ] Coverage-level behaviour.
  - [ ] Stub/minimal/full entity rules.

- [ ] Entity-specific policy:
  - [ ] Corpus anchor files.
  - [ ] Required content.
  - [ ] Forbidden content.
  - [ ] Ambiguity flags.
  - [ ] Canonical-reference-only markers.
  - [ ] Stub/full/minimal coverage markers.
  - [ ] Promotion dependencies.

- [ ] Faction profiles:
  - [ ] Alignment conventions.
  - [ ] Language whitelists.
  - [ ] Weapon profiles.
  - [ ] Spellcasting policies.
  - [ ] Doctrine requirements.
  - [ ] Ability floors.
  - [ ] Forbidden affiliations.
  - [ ] Mechanical substitution rules.

- [ ] Mechanical override rules:
  - [ ] `shortbow` to `throwing spike`.
  - [ ] non-neutral Shadow Walker alignment repair.
  - [ ] spell/cantrip replacement with mundane mechanics.
  - [ ] invalid weapon or armour substitutions.
  - [ ] doctrine-support mechanics by faction or role.

- [ ] Style and setting guards:
  - [ ] Banned modern terms.
  - [ ] Preferred Karsac equivalents.
  - [ ] Canonical naming variants.
  - [ ] Title and pronoun exclusion lists.
  - [ ] Common noun exclusion lists.

- [ ] Item/state rules:
  - [ ] Item holders.
  - [ ] Item locations.
  - [ ] Known/unknown status.
  - [ ] Forbidden item state changes.
  - [ ] Allowed ambiguity.

### 9.3 What should stay in code

Keep execution logic in TypeScript:

- [ ] Load registries.
- [ ] Resolve entities.
- [ ] Apply precedence rules.
- [ ] Build prompt constraints from policy.
- [ ] Parse generated sections.
- [ ] Prune forbidden sections.
- [ ] Apply deterministic repairs.
- [ ] Validate generic rule types.
- [ ] Render proposal output.
- [ ] Write repair logs.
- [ ] Gate promotion.
- [ ] Run tests.

### 9.4 Policy precedence

Use a clear precedence order:

1. [ ] Explicit user constraints.
2. [ ] Canonical entity policy.
3. [ ] Faction/profile policy.
4. [ ] Proposal type contract.
5. [ ] Mechanical base inheritance.
6. [ ] Model-generated creative additions.

If a lower-precedence layer conflicts with a higher-precedence layer, the lower layer is repaired, pruned or rejected.

### 9.5 Registry files to maintain

Core files:

- [ ] `corpus/registry/proposal-policy.yaml`
- [ ] `corpus/registry/factions.yaml`
- [ ] `corpus/registry/faction-mechanical-overrides.yaml`
- [ ] `corpus/registry/languages.yaml` if split from factions.
- [ ] `corpus/registry/style-guards.yaml`
- [ ] `corpus/registry/item-state-rules.yaml`
- [ ] `corpus/registry/proposal-lifecycle.yaml`

### 9.6 Data-driven prompt construction

Prompt constraints should be assembled from registry data:

- [ ] Corpus anchor instruction.
- [ ] Entity coverage level.
- [ ] Allowed and forbidden sections.
- [ ] Per-section corpus snippets.
- [ ] Required content reminders.
- [ ] Forbidden content reminders.
- [ ] Ambiguity flags.
- [ ] Gap treatment instruction.
- [ ] Faction-profile constraints.
- [ ] Chapter state context.

The model should not receive vague advice to “be careful”. It should receive a precise contract for the entity and proposal type.

### 9.7 Data-driven validation

Validators should report policy provenance:

- [ ] Which rule fired?
- [ ] Which registry file defined it?
- [ ] Which entity policy applied?
- [ ] Was it repaired, pruned, warned or failed?
- [ ] What should a reviewer do next?

Example:

```yaml
validation:
  severity: fail
  rule: forbidden_content_match
  policy: proposal-policy.yaml#canonical_entity_policies.npcs/jarl-beorn
  content: "longevity ritual"
  action: pruned
```

### 9.8 Data-driven repair

Repairs should be registry-defined and code-executed.

Example:

```yaml
repair:
  id: shadow-walker-shortbow
  applies_when:
    faction: shadow-walkers
    doctrine_tags:
      - cover-identity
  find:
    field: weapons
    value: shortbow
  replace_with: throwing_spike
  severity: auto-repair
```

The code should not special-case the Shadow Walker. It should execute the rule declared in data.

### 9.9 Structured output alignment

When structured JSON generation is introduced:

- [ ] Generate the schema from `proposal-policy.yaml`.
- [ ] Only expose permitted fields.
- [ ] Keep entity/faction policy outside the schema where it concerns meaning.
- [ ] Render final Markdown from validated structured output.
- [ ] Keep the governance layer after schema generation.

Structured output should make illegal shapes impossible. Registry governance should still make illegal meanings impossible.

---

## 10. Optional edge-token creative pass

Add later, not now.

Use it narrowly:

```text
Given this doctrine, faction profile, and validated stat block, propose up to two mechanics that express the doctrine better. Do not change canon, faction, language, alignment, or promotion status.
```

Start with a cheaper model first. Escalate only if needed.

---

## 11. Export and usability

### 11.1 Better outputs

- [ ] Render clean Markdown.
- [ ] Render DM-facing summaries.
- [ ] Keep validation separate from proposal body.
- [ ] Add collapsible repair/validation sections in Web UI.

### 11.2 Document export

Later:

- [ ] Export proposal to `.md`.
- [ ] Export proposal to `.docx`.
- [ ] Build a session packet.
- [ ] Build a chapter prep bundle.

## Immediate next steps

1. [x] Commit current stable state and tag `beta-0.1-governed-proposals`.
2. [ ] Add/complete the test strategy fixtures and golden prompts (see §8).
3. [ ] Move remaining bespoke policy into registry data (see §4).
4. [ ] Prototype structured JSON output for one proposal type, probably NPC (see §2).
