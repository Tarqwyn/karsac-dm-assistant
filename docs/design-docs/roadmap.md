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

- [ ] Strengthen `can_know` / `must_not_know`. *(injected into constraints and generation prompt; not yet validated post-generation)*
- [x] Add “minimal canonical NPC” mode. *(Maret: proposal_scope: minimal, unresolved_fields_preferred: true)*
- [ ] Prevent invented backstory for named corpus NPCs. *(forbidden_sections blocks some fields; corpus injection guards against it at generation; no sentence-level backstory validator)*
- [x] Allow richer generation only for explicitly new NPCs. *(coverage-level logic gates section access by entity policy)*

### 3.2 Place proposals

- [ ] Support:
  - [x] Canonical place stub. *(corpus anchor + stub_place constraints prevent district/landmark/NPC invention)*
  - [x] New provisional place. *(supported via place proposal type with no corpus anchor)*
  - [ ] Expanded place from existing stub. *(no distinct "expand stub" mode; treated same as canonical stub)*
- [x] Prevent districts, factions, landmarks and NPCs for stub-level canonical places unless allowed by policy. *(Valweg policy: forbidden_sections covers Key Districts, Factions, Key NPCs, Notable Landmarks)*

### 3.3 Encounter proposals

- [ ] Add strict encounter contracts:
  - [x] Maximum two NPCs by default. *(in generation-constraints.yaml; not validated post-generation)*
  - [x] Maximum three resolutions. *(in generation-constraints.yaml; not validated post-generation)*
  - [x] No new items unless explicitly requested. *(in generation-constraints.yaml; not validated post-generation)*
  - [x] No supernatural atmosphere unless corpus-supported. *(in generation-constraints.yaml + validation-rules.yaml supernatural_atmosphere warning)*
- [x] Add fail-forward structure. *(Fail-Forward Path section in encounter contract)*
- [x] Inject chapter-state context before generation. *(CHAPTER STATE TRACKER block built by proposalConstraints.ts)*

### 3.4 Adversary proposals

- [x] Keep the current faction-doctrine-trumps-base rule. *(proposalConstraints.ts: "User constraints and locked faction doctrine trump inherited mechanical base content")*
- [x] Add more faction profiles beyond Shadow Walkers. *(factions.yaml: shadow-walkers, mathr, yngondi, vishara, yantravaq, vane)*
- [ ] Improve variant option quality:
  - [x] No flat bonuses. *(validation-rules.yaml detects flat skill bonuses)*
  - [ ] No vague traits.
  - [ ] No long-horizon abilities in encounter stat blocks.
- [ ] Add doctrine-to-mechanics quality checks. *(Shadow Walker urban doctrine-survivability mechanics guide exists; no generic validator)*

---

## 4. Improve data-driven policy

### 4.1 Registry expansion

Move more policy into data:

- [x] Proposal contracts. *(proposal-contracts.yaml: all types covered)*
- [x] Entity coverage levels. *(proposal-entity-policies.yaml: Beorn, Maret, Dugweb, Valweg)*
- [x] Ambiguity flags. *(Dugweb policy: ambiguity_flags + require_ambiguity_section)*
- [x] Faction doctrine rules. *(factions.yaml: generation_constraints, required_doctrine_themes, doctrine_support_mechanics)*
- [x] Language whitelists. *(factions.yaml: language_whitelist, banned_languages per faction)*
- [x] Weapon substitutions. *(faction-mechanical-overrides.yaml: shortbow → throwing spike for SW urban)*
- [ ] Canonical item state rules. *(item-state-rules.yaml does not exist)*
- [x] Allowed/prohibited expansion fields. *(allowed_sections / forbidden_sections in entity policies)*
- [ ] Promotion dependencies. *(not tracked)*

### 4.2 Coverage audit

- [x] Mark entities as:
  - [x] Full. *(Beorn: anchored/full)*
  - [x] Stub. *(Maret: stub)*
  - [x] Minimal. *(Maret: proposal_scope: minimal)*
  - [ ] Unresolved.
  - [x] Canonical-reference-only. *(Valweg: canonical_reference_only: true)*
- [ ] Add explicit notes for high-risk entities:
  - [x] Beorn. *(prompt_constraints in entity policy)*
  - [x] Valweg. *(canonical_reference_only, extensive forbidden_sections)*
  - [x] Dugweb. *(ambiguity_flags, forbidden_patterns)*
  - [x] Maret. *(stub policy, minimal scope)*
  - [ ] Mathr.
  - [ ] Vane.
  - [ ] Brynja.

---

## 5. Proposal lifecycle and genealogy

### 5.1 Proposal states

Add clear states:

- [x] Proposed. *(status: proposed in frontmatter)*
- [ ] Needs review.
- [x] Rejected. *(status: rejected in frontmatter)*
- [x] Promoted. *(status: promoted in frontmatter)*
- [ ] Superseded.

### 5.2 Rejected proposal handling

- [x] Move rejected proposals to `_rejected/`.
- [x] Exclude `_rejected/` from provisional entity scanning. *(proposalEntityRegistry.ts explicitly skips _rejected/)*
- [x] Prevent failed inventions becoming pseudo-canon. *(follows from above)*

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

- [x] Unit tests for deterministic functions:
  - [x] Entity resolution. *(resolver.test.ts)*
  - [x] Policy loading. *(proposal-governance.test.ts)*
  - [x] Section parsing. *(parser.test.ts)*
  - [x] Pre-write pruning. *(proposal-governance.test.ts)*
  - [x] Deterministic repairs. *(proposal-governance.test.ts)*
  - [x] Language whitelist checks. *(proposal-governance.test.ts)*
  - [x] Faction-profile checks. *(proposal-governance.test.ts)*
  - [x] Stat-block normalisation. *(stat-block validation in proposal-governance.test.ts)*
  - [x] Named-entity boundary detection. *(resolver.test.ts, boundary tests)*

- [x] Policy-registry tests:
  - [x] `proposal-policy.yaml` loads successfully. *(proposal-governance.test.ts — tested via contracts loader)*
  - [x] Entity coverage levels resolve correctly. *(proposal-governance.test.ts)*
  - [x] Proposal contracts produce the expected allowed/forbidden fields. *(proposal-routing.test.ts)*
  - [x] Ambiguity flags are injected. *(proposal-governance.test.ts)*
  - [x] Required and forbidden content rules are applied. *(proposal-governance.test.ts)*
  - [x] Faction mechanical overrides are applied from data, not hard-coded logic. *(proposal-governance.test.ts)*

- [x] Golden prompt tests:
  - [x] Run stable test prompts for known entities such as Beorn, Valweg, Maret and Dugweb. *(regression.test.ts snapshots 01, 02, 03, 06)*
  - [x] Store expected validation results. *(baselines/*.baseline.json)*
  - [x] Assert that known bad inventions are blocked or pruned. *(snapshot expectedValidation: 'fail' cases)*
  - [x] Assert that known canonical facts are preserved. *(heuristic evaluator canon/inferred counts)*
  - [x] Keep these prompts deliberately short to prove context injection is doing the work. *(all prompts are bare names or short phrases)*

- [ ] Regression tests for past failures:
  - [ ] `Undercommon` on a Shadow Walker fails. *(detected by language whitelist validator; no dedicated unit test)*
  - [ ] `Neutral Evil` on a Shadow Walker is repaired or fails. *(alignment repair exists in code; no dedicated test)*
  - [ ] `Shortbow` on an urban cover-identity Shadow Walker is replaced. *(faction-mechanical-overrides.yaml defines rule; no dedicated test)*
  - [ ] Beorn longevity ritual is blocked. *(forbidden_patterns in entity policy; no dedicated test)*
  - [ ] Valweg river/fishmongers/generic city invention is blocked. *(canonical_reference_only policy; snapshot 06 covers this)*
  - [ ] Silent Hand-style invented factions are blocked. *(named entity validator; no dedicated test)*
  - [ ] Named NPC leakage inside place, encounter or NPC proposals is blocked. *(no dedicated test)*
  - [ ] Canonical item state changes are blocked. *(no item state tracking exists yet)*
  - [x] Pronouns and titles do not trigger false named-entity failures. *(style-guards.yaml + resolver.test.ts boundary tests)*

- [x] Live pipeline smoke tests:
  - [x] Run one NPC, one place, one adversary and one encounter through the full proposal command. *(regression.test.ts covers all types)*
  - [x] Confirm files are written to the correct proposal directory. *(snapshotRunner.ts verifies output path)*
  - [x] Confirm repair logs are present. *(repair_log in frontmatter)*
  - [x] Confirm validation output is readable. *(validation.status + issues in frontmatter)*
  - [x] Confirm no proposal mutates campaign state automatically. *(proposalPromoter.ts does not update state)*

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

- [x] Canonical NPC with full coverage: Jarl Beorn. *(snapshot 01)*
- [x] Canonical NPC with minimal coverage: Maret. *(snapshot 02)*
- [x] Canonical NPC with ambiguity flags: King Dugweb. *(snapshot 03)*
- [x] Canonical place with stub/limited coverage: Valweg. *(snapshot 06)*
- [x] New provisional adversary: Shadow Walker urban infiltrator. *(snapshot 09)*
- [ ] New provisional encounter: first approach to Valweg. *(snapshot 12 is generic fjord road; not Valweg-specific)*
- [ ] Known bad generated proposal containing invented sections. *(no stored fixture; detected live in snapshots)*
- [ ] Known bad generated proposal containing invalid mechanics. *(the-ledger-keeper is a live example but not a test fixture)*
- [ ] Known bad generated proposal containing forbidden faction drift. *(no stored fixture)*

### 8.4 Acceptance thresholds

Before treating the system as Beta-useful:

- [x] Full test suite passes. *(16/16 snapshots pass; unit + retrieval + generation layers green)*
- [ ] Golden prompts produce no unguarded canon invention. *(canon counts tracked; LLM quality evaluator needs ANTHROPIC_API_KEY)*
- [ ] Known bad historic failures are caught or pruned. *(language/alignment/weapon rules exist; dedicated unit tests missing)*
- [x] False positives are low enough that validation remains trusted. *(pronoun/title/common-noun exclusions in place)*
- [x] Failed proposals are safe to read because forbidden material is pruned before write. *(pre-write pruning active)*
- [x] Repair logs explain what happened without hiding the model’s mistakes. *(repair_log in frontmatter with pruned_sections + auto_repairs)*

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

- [x] Entity registries:
  - [x] NPCs. *(indexed via build-index.ts from karsac-major-npcs / karsac-minor-npcs)*
  - [x] Places. *(indexed from karsac-places)*
  - [x] Factions. *(indexed from karsac-factions)*
  - [x] Items. *(indexed from karsac-items-artifacts + entity-cards)*
  - [x] Forces. *(indexed from karsac-forces)*
  - [x] Events. *(indexed)*
  - [x] Concepts. *(indexed from karsac-concepts)*

- [x] Proposal policies:
  - [x] Proposal type contracts. *(proposal-contracts.yaml)*
  - [x] Required fields. *(required_sections per type)*
  - [x] Optional fields. *(allowed_sections in entity policy)*
  - [x] Forbidden fields. *(forbidden_sections in entity policy)*
  - [x] Allowed expansion fields. *(allowed_sections)*
  - [x] Coverage-level behaviour. *(stub/bounded/full/minimal in proposalEntityPolicies.ts)*
  - [x] Stub/minimal/full entity rules. *(proposal_scope per entity)*

- [x] Entity-specific policy:
  - [x] Corpus anchor files. *(proposal-entity-policies.yaml)*
  - [x] Required content. *(required_content in entity policy)*
  - [x] Forbidden content. *(forbidden_patterns, forbidden_sections)*
  - [x] Ambiguity flags. *(ambiguity_flags in Dugweb policy)*
  - [x] Canonical-reference-only markers. *(canonical_reference_only: true in Valweg policy)*
  - [x] Stub/full/minimal coverage markers. *(coverage_level per entity)*
  - [ ] Promotion dependencies.

- [x] Faction profiles:
  - [x] Alignment conventions. *(default_alignment in factions.yaml)*
  - [x] Language whitelists. *(language_whitelist + banned_languages)*
  - [x] Weapon profiles. *(weapon_profile + faction-mechanical-overrides.yaml)*
  - [x] Spellcasting policies. *(spellcasting.default: prohibited for SW)*
  - [x] Doctrine requirements. *(required_doctrine_themes, doctrine_tags)*
  - [x] Ability floors. *(ability_floors in faction profile)*
  - [x] Forbidden affiliations. *(forbidden_affiliations per faction)*
  - [x] Mechanical substitution rules. *(faction-mechanical-overrides.yaml)*

- [x] Mechanical override rules:
  - [x] `shortbow` to `throwing spike`. *(faction-mechanical-overrides.yaml)*
  - [x] non-neutral Shadow Walker alignment repair. *(alignment_repair in factions.yaml)*
  - [ ] spell/cantrip replacement with mundane mechanics. *(spellcasting prohibited for SW; no generic replacement rule)*
  - [ ] invalid weapon or armour substitutions. *(only SW shortbow rule exists)*
  - [ ] doctrine-support mechanics by faction or role. *(guidance injected into prompts; not a deterministic repair)*

- [x] Style and setting guards:
  - [x] Banned modern terms. *(style-guards.yaml)*
  - [x] Preferred Karsac equivalents. *(KARSAC COMMUNICATION PROPS RULE in system prompt)*
  - [x] Canonical naming variants. *(style-guards.yaml)*
  - [x] Title and pronoun exclusion lists. *(style-guards.yaml: sentence_boundary_pronouns, title_tokens)*
  - [x] Common noun exclusion lists. *(style-guards.yaml: common_noun_skips)*

- [ ] Item/state rules:
  - [ ] Item holders.
  - [ ] Item locations.
  - [ ] Known/unknown status.
  - [ ] Forbidden item state changes.
  - [ ] Allowed ambiguity.

### 9.3 What should stay in code

Keep execution logic in TypeScript:

- [x] Load registries.
- [x] Resolve entities.
- [x] Apply precedence rules.
- [x] Build prompt constraints from policy.
- [x] Parse generated sections.
- [x] Prune forbidden sections.
- [x] Apply deterministic repairs.
- [x] Validate generic rule types.
- [x] Render proposal output.
- [x] Write repair logs.
- [x] Gate promotion.
- [x] Run tests.

### 9.4 Policy precedence

Use a clear precedence order:

1. [x] Explicit user constraints.
2. [x] Canonical entity policy.
3. [x] Faction/profile policy.
4. [x] Proposal type contract.
5. [x] Mechanical base inheritance.
6. [x] Model-generated creative additions.

If a lower-precedence layer conflicts with a higher-precedence layer, the lower layer is repaired, pruned or rejected.

### 9.5 Registry files to maintain

Core files:

- [ ] `corpus/registry/proposal-policy.yaml` *(policy is split across proposal-contracts.yaml + generation-constraints.yaml + proposal-entity-policies.yaml; no single unified file)*
- [x] `corpus/registry/factions.yaml`
- [x] `corpus/registry/faction-mechanical-overrides.yaml`
- [x] `corpus/registry/languages.yaml` if split from factions. *(languages live in factions.yaml; no split needed yet)*
- [x] `corpus/registry/style-guards.yaml`
- [ ] `corpus/registry/item-state-rules.yaml`
- [ ] `corpus/registry/proposal-lifecycle.yaml`

### 9.6 Data-driven prompt construction

Prompt constraints should be assembled from registry data:

- [x] Corpus anchor instruction. *(buildCorpusAnchorLines from generation-constraints.yaml)*
- [x] Entity coverage level. *(proposalEntityPolicies.ts + proposalConstraints.ts)*
- [x] Allowed and forbidden sections. *(entity policy → pruning + prompt constraint)*
- [x] Per-section corpus snippets. *(snippetizeEntity → exactSnippets injected into system prompt)*
- [x] Required content reminders. *(required_content from entity policy)*
- [x] Forbidden content reminders. *(forbidden_patterns injected into CORPUS ANCHOR FIDELITY block)*
- [x] Ambiguity flags. *(ambiguity_flags → prompt constraints)*
- [x] Gap treatment instruction. *(unresolved_fields_preferred → "leave absent/unresolved")*
- [x] Faction-profile constraints. *(getFactionProfile → buildAdversaryConstraintLines)*
- [x] Chapter state context. *(buildStateTrackerBlock → CHAPTER STATE TRACKER in user message)*

The model should not receive vague advice to “be careful”. It should receive a precise contract for the entity and proposal type.

### 9.7 Data-driven validation

Validators should report policy provenance:

- [ ] Which rule fired? *(issue strings describe the rule; not machine-readable)*
- [ ] Which registry file defined it? *(not reported)*
- [ ] Which entity policy applied? *(not reported)*
- [x] Was it repaired, pruned, warned or failed? *(repair_log.pruned_sections + validation.status: fail/warn/pass)*
- [ ] What should a reviewer do next? *(not reported)*

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
2. [x] Add/complete the test strategy fixtures and golden prompts (see §8). *(4-layer test suite complete: 16 snapshots, unit, retrieval, generation layers)*
3. [ ] Add dedicated unit tests for known bad historic failures (§8.2 regression tests — undercommon, shortbow, alignment repair, Beorn longevity, faction drift).
4. [ ] Add entity policies for remaining high-risk entities: Mathr, Vane, Brynja (§4.2).
5. [ ] Move remaining bespoke policy into registry data (see §4) — `item-state-rules.yaml`, `proposal-lifecycle.yaml`, weapon substitution completeness.
6. [ ] Prototype structured JSON output for one proposal type, probably NPC (see §2).
