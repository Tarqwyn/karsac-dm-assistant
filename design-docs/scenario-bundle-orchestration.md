# Feature Use Case: Scenario Bundle Orchestration

## Summary

Scenario Bundle Orchestration allows the Karsac DM Assistant to respond to a broad prep request by planning and generating a small, connected set of proposals rather than a single isolated artefact.

The core idea is:

> A scene should not invent its own world.  
> It should be composed from validated places, NPCs, adversaries and constraints.

For example, if the user says:

```text
I need an encounter on the road to Valweg from Törweg. It needs to push the party hard but not lethally. The net is closing; they need to feel that Mathr knows they are coming.
```

The system should not simply route this to `encounter-design` and allow the encounter generator to invent a location, adversary, NPCs, clues and factions inside one freeform output.

Instead, it should plan a bundle:

```yaml
intent: propose_bundle
bundle_type: road_encounter
chapter: 3
route:
  from: Törweg
  to: Valweg
tone:
  - pressure
  - pursuit
  - non-lethal danger
  - Mathr reach
constraints:
  lethal: false
  reveal_mathr_directly: false
  canon_status: provisional
required_proposals:
  - encounter
  - adversary_or_pressure_force
  - place_or_route_context
optional_proposals:
  - npc
  - clue
```

Then each supporting piece is resolved or generated through its own governed pipeline before the final encounter is composed.

---

## Problem

Single-proposal generation can overreach.

An encounter generator may invent:

- a new named place
- a new adversary group
- a new NPC
- a new faction
- a new clue object
- a new mystical sign
- a new item state change

This is risky because those invented elements bypass the more specific governance rules that would have applied if they had been generated as proper proposals.

For example:

- A place should be validated by place policy.
- An adversary should be validated by faction and mechanical policy.
- An NPC should be validated by `can_know` / `must_not_know` boundaries.
- An item clue should be validated by item-state rules.
- An encounter should only compose approved ingredients.

Without bundle orchestration, the encounter path can smuggle unfiltered locations, adversaries and clues into the output.

---

## Goal

Add a planning layer that converts broad scenario requests into a dependency-aware proposal chain.

The system should:

1. Interpret the broad user request.
2. Identify the scenario bundle type.
3. Plan required and optional proposal dependencies.
4. Resolve existing canon/provisional entities where possible.
5. Generate missing supporting proposals where needed.
6. Validate each dependency independently.
7. Compose the final encounter using only approved dependencies.
8. Validate the whole bundle.
9. Write a bundle file with links to child proposals and validation state.

---

## Non-Goals

This feature should not:

- Let an encounter invent unvalidated NPCs, factions, places or items.
- Promote any child proposal automatically.
- Mutate campaign state without confirmation.
- Bypass proposal-type governance.
- Replace intent normalisation.
- Replace individual proposal validation.
- Require all bundle parts to be canon before they can be used provisionally.

---

## Core Principle

Use the LLM to help interpret and compose, but use deterministic orchestration to decide what exists.

```text
Natural user request
→ intent normaliser
→ bundle planner
→ dependency resolver
→ governed child proposals
→ final scenario proposal
→ bundle validation
```

The final encounter should reference child proposals by ID, not silently invent its own building blocks.

---

## Example User Request

```text
I need an encounter on the road to Valweg from Törweg.
It needs to push the party hard but not lethally.
The net is closing.
They need to feel that Mathr knows they are coming.
```

## Interpreted Bundle

```yaml
intent: propose_bundle
bundle_type: road_pressure_encounter
chapter: 3
primary_output: encounter
route:
  from: Törweg
  to: Valweg
tone:
  - pressure
  - being watched
  - closing net
  - non-lethal danger
threat:
  implied_actor: Mathr
  reveal_direct_involvement: false
constraints:
  lethality: non_lethal_pressure
  no_new_factions: true
  no_new_items: true
  max_new_npcs: 1
  max_resolutions: 3
dependencies:
  place:
    mode: resolve_or_create
    subject: fjord road waypoint or route context
  adversary:
    mode: resolve_or_create
    subject: Mathr-linked deniable road pressure force
  npc:
    mode: optional
    subject: road warden, traveller, messenger or witness
```

---

## Bundle Pipeline

```text
User message
  ↓
Intent normalisation
  ↓
Bundle planning
  ↓
Dependency resolution
  ↓
Generate or resolve child proposals
  ↓
Validate child proposals
  ↓
Compose final encounter using approved dependencies
  ↓
Validate final encounter
  ↓
Write scenario bundle file
```

---

## Dependency Resolution

Each dependency should be resolved before final encounter generation.

### Resolution Modes

```yaml
mode: resolve_existing
```

Use only existing corpus/proposal entities.

```yaml
mode: resolve_or_create
```

Use existing entity if suitable; otherwise create a provisional child proposal.

```yaml
mode: create_new
```

Create a new provisional proposal.

```yaml
mode: optional
```

Use only if the bundle planner determines it adds value.

---

## Dependency Rules

### Place dependency

A final encounter may only reference a named place if:

- [ ] It exists in canonical corpus.
- [ ] It exists as a validated provisional proposal.
- [ ] It is generated as a child proposal in this bundle.
- [ ] It is explicitly marked as generic/unnamed route context.

### NPC dependency

A final encounter may only reference a named NPC if:

- [ ] The NPC exists in corpus.
- [ ] The NPC exists as a validated provisional proposal.
- [ ] The NPC is generated as a child proposal in this bundle.
- [ ] The NPC is unnamed and described only by role.

### Adversary dependency

A final encounter may only reference an adversary if:

- [ ] The adversary exists in the adversary corpus.
- [ ] The adversary exists as a validated provisional proposal.
- [ ] The adversary is generated as a child proposal in this bundle.
- [ ] The adversary is a generic SRD/stat reference explicitly permitted by policy.

### Item or clue dependency

A final encounter may only introduce a clue object if:

- [ ] It references an existing item state.
- [ ] It is a mundane clue with no new canon implications.
- [ ] It is created as a provisional child proposal.
- [ ] It is explicitly allowed by the bundle policy.

No canonical item state change should occur inside a bundle without a dedicated item-state validation step.

---

## Bundle Types

### `road_pressure_encounter`

For road scenes where the party should feel pursued, watched or delayed.

```yaml
required:
  - encounter
  - adversary_or_pressure_force
optional:
  - place_or_route_context
  - npc
  - clue
constraints:
  max_new_npcs: 1
  max_resolutions: 3
  no_new_factions: true
  no_new_items: true
  supernatural_agency_requires_corpus_support: true
```

### `settlement_arrival`

For first arrival at a town, city or outpost.

```yaml
required:
  - place
  - encounter
optional:
  - npc
  - local_pressure
  - rumour_table
constraints:
  no_new_factions_unless_requested: true
  named_npcs_require_proposals: true
  place_scope_policy_applies: true
```

### `social_pressure_scene`

For tense social scenes with an NPC or institution.

```yaml
required:
  - npc
  - scene
optional:
  - location
  - secret
  - pressure_clock
constraints:
  can_know_must_not_know_required: true
  no_dm_only_leak_to_player_safe: true
```

### `ambush_or_interdiction`

For direct threat scenes.

```yaml
required:
  - adversary
  - encounter
optional:
  - terrain_feature
  - clue_after_combat
constraints:
  adversary_validation_required: true
  encounter_lethality_must_match_request: true
  no_unplanned_named_factions: true
```

### `chapter_prep_packet`

For generating a small linked packet of Chapter prep.

```yaml
required:
  - place
  - npc
  - encounter
  - adversary
optional:
  - rumour_table
  - clue
  - handout
constraints:
  promotion_requires_human_review: true
  child_proposals_remain_provisional: true
```

---

## Bundle Planner Output

The bundle planner should produce a structured plan before child generation begins.

Example:

```yaml
bundle_plan:
  id: chapter-3-valweg-road-pressure
  bundle_type: road_pressure_encounter
  chapter: 3
  primary_output: encounter
  user_goal: make the party feel Mathr's net closing without lethal force
  constraints:
    lethality: non_lethal
    direct_mathr_reveal: false
    no_new_factions: true
    no_new_items: true
  dependencies:
    - type: adversary
      role: pressure_force
      mode: resolve_or_create
      subject: Mathr deniable road pressure unit
      required: true
    - type: place
      role: route_context
      mode: resolve_or_create
      subject: fjord road waypoint between Törweg and Valweg
      required: false
    - type: npc
      role: witness_or_authority
      mode: optional
      subject: road warden or traveller
      required: false
```

The app should show the interpreted plan before running expensive or multi-step generation.

---

## UX Pattern

For natural user requests, the system should respond with a short interpretation.

Example:

```text
Interpreted as a Chapter 3 road encounter bundle.

I’ll resolve or create:
- a Mathr-linked deniable pressure force
- a road location or route context
- an optional NPC witness or authority figure
- a final encounter that uses only approved dependencies

Constraints:
- hard but not lethal
- imply Mathr's reach without confirming direct involvement
- no new factions
- no new items
- maximum three resolutions
```

For early versions, ask for confirmation before running the full chain.

Later, allow auto-run for non-destructive provisional bundle generation.

---

## Final Encounter Composition Rule

The final encounter prompt must receive an approved dependency list.

Example:

```text
Use only these validated supporting entities:

Adversary:
- Road Reapers, proposal_id: adversaries/road-reapers, status: needs_review

Place:
- Fjord road route context, corpus_id: places/valweg-road-context

NPC:
- Astrid Half-Stone, proposal_id: npcs/astrid-half-stone, status: pass

Do not introduce new named NPCs, factions, places, items or cosmological claims.
```

The final encounter should cite/reference these dependencies rather than invent new ones.

---

## Bundle Validation

Bundle validation should check:

- [ ] All required dependencies exist.
- [ ] Child proposals have acceptable validation status.
- [ ] Final encounter references only approved dependencies.
- [ ] No unplanned named NPCs appear.
- [ ] No unplanned factions appear.
- [ ] No unplanned items appear.
- [ ] Lethality constraint is obeyed.
- [ ] Direct/indirect revelation constraints are obeyed.
- [ ] `can_know` / `must_not_know` boundaries survive across the bundle.
- [ ] Final encounter does not promote provisional child material to canon.
- [ ] Repair logs exist for child proposals and final bundle.

---

## Bundle File Shape

Suggested file:

```text
corpus/proposals/bundles/chapter-3-valweg-road-pressure.bundle.md
```

Suggested frontmatter:

```yaml
id: bundles/chapter-3-valweg-road-pressure
type: scenario_bundle
status: proposed
canonical: provisional
chapter: 3
primary_output: encounters/valweg-road-pressure
bundle_type: road_pressure_encounter
dependencies:
  adversary:
    - id: adversaries/road-reapers
      status: needs_review
  place:
    - id: places/fjord-road-waypoint
      status: proposed
  npc:
    - id: npcs/astrid-half-stone
      status: pass
constraints:
  lethality: non_lethal
  direct_mathr_reveal: false
  no_new_factions: true
  no_new_items: true
validation:
  status: needs_review
```

Body sections:

```markdown
# Scenario Bundle: Valweg Road Pressure

## User Goal

## Interpreted Plan

## Dependencies

## Child Proposal Status

## Final Encounter Summary

## Bundle Validation

## Review Notes

## Promotion Notes
```

---

## Safe Status Rules

A bundle can be:

```yaml
status: proposed
```

Created but not yet validated.

```yaml
status: needs_review
```

One or more child proposals need review, or final bundle has warnings.

```yaml
status: pass
```

All dependencies are valid enough for provisional use.

```yaml
status: blocked
```

One or more dependencies failed validation.

```yaml
status: promoted
```

Human-reviewed and accepted into planning/canon.

---

## Proposal Chaining and Canon Safety

Bundle generation should not promote child proposals automatically.

Child proposal status should remain explicit:

```yaml
child_status:
  adversaries/road-reapers: needs_review
  npcs/astrid-half-stone: pass
  places/fjord-road-waypoint: proposed
```

A bundle may be useful even if some children are only `needs_review`, but it should clearly show the risk.

---

## Interaction with Intent Normalisation

Intent normalisation decides whether the user wants:

- a single proposal
- an edit
- a section revision
- a bundle

Example:

```text
I need someone on the Valweg road...
```

Likely:

```yaml
intent: propose
proposal_type: npc
```

Example:

```text
I need an encounter on the road to Valweg, with Mathr’s net closing.
```

Likely:

```yaml
intent: propose_bundle
bundle_type: road_pressure_encounter
primary_output: encounter
```

The normaliser should not execute the chain. It should only produce the structured bundle command.

---

## Implementation Notes

Suggested modules:

```text
src/bundles/
  bundleTypes.ts
  bundlePlanner.ts
  bundlePolicyLoader.ts
  dependencyResolver.ts
  bundleValidator.ts
  bundleRenderer.ts
```

Suggested registries:

```text
corpus/registry/bundle-types.yaml
corpus/registry/bundle-policies.yaml
```

Suggested proposal directory:

```text
corpus/proposals/bundles/
```

---

## Bundle Policy Registry

Example:

```yaml
bundle_types:
  road_pressure_encounter:
    primary_output: encounter
    required_dependencies:
      - adversary_or_pressure_force
    optional_dependencies:
      - place_or_route_context
      - npc
      - clue
    constraints:
      max_new_npcs: 1
      max_resolutions: 3
      no_new_factions: true
      no_new_items: true
      no_supernatural_agency_without_corpus_support: true
      direct_antagonist_reveal_default: false
```

---

## Tests

### Bundle planning tests

- [ ] Road encounter request resolves to `propose_bundle`.
- [ ] Bundle type resolves to `road_pressure_encounter`.
- [ ] Required adversary/pressure dependency is planned.
- [ ] Optional place/NPC dependencies are planned but not forced.
- [ ] Lethality constraint is captured.
- [ ] Direct Mathr reveal constraint is captured.

### Dependency resolution tests

- [ ] Existing suitable adversary is reused.
- [ ] Missing adversary triggers child adversary proposal.
- [ ] Existing suitable NPC is reused.
- [ ] Rejected proposals are not reused.
- [ ] Failed proposals block the bundle unless explicitly allowed for review.

### Final encounter tests

- [ ] Final encounter receives approved dependency list.
- [ ] Final encounter does not introduce new named NPCs.
- [ ] Final encounter does not introduce new factions.
- [ ] Final encounter does not introduce new items.
- [ ] Final encounter respects lethality constraint.
- [ ] Final encounter references child proposal IDs.

### Validation tests

- [ ] Bundle fails if required dependency is missing.
- [ ] Bundle warns if child dependency is `needs_review`.
- [ ] Bundle fails if final encounter references unplanned entity.
- [ ] Bundle passes when all children pass and final encounter stays within dependency list.

---

## Risks

### Risk: Bundle generation becomes too complex

Mitigation:

- Start with one bundle type: `road_pressure_encounter`.
- Require confirmation before generating children.
- Keep child proposals provisional.

### Risk: Too many child proposals are generated

Mitigation:

- Prefer resolve existing before create new.
- Set maximum new proposal count per bundle.
- Show bundle plan before execution.

### Risk: Final encounter ignores dependencies

Mitigation:

- Inject approved dependency list.
- Validate references after generation.
- Fail on unplanned named entities.

### Risk: Provisional child material becomes pseudo-canon

Mitigation:

- Keep child status visible.
- Do not promote children automatically.
- Track bundle dependencies explicitly.

---

## Definition of Done

This feature is ready when:

- [ ] A broad natural request can produce a structured bundle plan.
- [ ] The bundle plan identifies required and optional dependencies.
- [ ] Existing entities are resolved before new ones are generated.
- [ ] Missing dependencies can be generated as child proposals.
- [ ] Each child proposal is validated independently.
- [ ] The final encounter uses only approved dependencies.
- [ ] Bundle validation catches unplanned inventions.
- [ ] The bundle file records dependencies, validation state and review notes.
