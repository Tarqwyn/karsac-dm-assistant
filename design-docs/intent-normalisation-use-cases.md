# Feature Use Case: Intent Normalisation and Safe Proposal Editing

## Summary

This feature allows the Karsac DM Assistant to accept natural language requests and follow-up edits without requiring the user to know the exact deterministic command syntax.

The core idea is:

> The LLM interprets intent.  
> The deterministic system executes the command.  
> The policy layer governs what survives.

This keeps the assistant easy to use while preserving the safety of deterministic routing, registry-backed policy, validation, repair logs, and promotion gates.

---

## Problem

The current deterministic routing system is safe and testable, but it expects the user to phrase requests in a fairly specific way.

For example:

```text
Propose a new NPC: Jarl Beorn.
Canon status: named in existing corpus.
Chapter 3. Treat as provisional planning material.
```

That works well for testing, but it is not how a DM naturally thinks during prep.

A DM is more likely to say:

```text
I need someone on the Valweg road who can challenge the party about the Mathr token.
```

or, after seeing a proposal:

```text
Remove the Quick Study trait and change the languages to Common and Löswegi.
```

Without an intent normalisation layer, the user has to understand the router, the proposal types, the command format, and the safe edit model. That makes the system more powerful than it is usable.

---

## Goal

Add a natural-language interface layer that converts messy user requests into structured, schema-bound command packets.

The model should not directly mutate proposals, canon, or state.

It should produce an interpreted command such as:

```yaml
intent: propose
proposal_type: npc
subject: new Lösweg road warden
chapter: 3
status: provisional
context:
  - Valweg road
  - Mathr token tension
  - party travelling north
```

or:

```yaml
intent: edit_proposal
target: current_proposal
operations:
  - op: remove_trait
    trait: Quick Study
  - op: set_languages
    languages:
      - Common
      - Löswegi
```

The deterministic pipeline then decides whether the command is valid, applies it, validates it, and writes the result.

---

## Non-Goals

This feature should not:

- Let the LLM directly edit proposal files freehand.
- Let the LLM bypass validation.
- Let the LLM promote content to canon.
- Mutate campaign state without explicit confirmation.
- Replace deterministic routing.
- Replace registry-backed policy.
- Replace proposal validation or repair logs.

The LLM is an interpreter, not an authority.

---

## Core Principle

Use the LLM as a human-language interface to structured tools.

```text
User message
→ intent normaliser
→ structured command packet
→ deterministic router/editor
→ policy checks
→ validation
→ proposal update
```

This mirrors the wider principle:

> Treat LLM output like untrusted user input.  
> Constrain it, validate it, and only then execute it.

---

## Use Case 1: Natural Proposal Request

### User says

```text
I need someone on the Valweg road who can challenge the party about the Mathr token.
```

### Intent normaliser outputs

```yaml
intent: propose
proposal_type: npc
subject: new Lösweg road warden
chapter: 3
status: provisional
context:
  - Valweg road
  - Mathr token
  - party travelling toward Valweg
required_elements:
  - can_know
  - must_not_know
  - player_safe
  - dm_only
```

### System response

The assistant should show a short interpretation:

```text
Interpreted as an NPC proposal for Chapter 3:
- new Lösweg road warden
- Valweg road context
- Mathr token tension
- provisional planning material
```

Then the normal deterministic proposal pipeline runs.

### Acceptance Criteria

- The user does not need to say `Propose a new NPC`.
- The system still resolves the request to `proposal_type: npc`.
- The generated proposal still goes through corpus anchors, policy, pruning, deterministic repair and validation.
- The proposal remains provisional.
- No campaign state is mutated.

---

## Use Case 2: Natural Encounter Request

### User says

```text
Give me something tense for the first approach to Valweg.
```

### Intent normaliser outputs

```yaml
intent: propose
proposal_type: encounter
subject: first approach to Valweg
chapter: 3
status: provisional
constraints:
  - max_two_npcs
  - max_three_resolutions
  - no_new_items_unless_requested
  - no_supernatural_agency_without_corpus_support
```

### Acceptance Criteria

- The system identifies this as an encounter, not a place.
- Chapter state is injected before generation.
- Encounter policy is applied.
- The output does not invent new canonical items, factions or named NPCs unless explicitly allowed.

---

## Use Case 3: Follow-Up Proposal Edit

### User says

```text
Remove the Quick Study trait and change the languages to Common and Löswegi.
```

### Intent normaliser outputs

```yaml
intent: edit_proposal
target: current_proposal
operations:
  - op: remove_trait
    trait: Quick Study
  - op: set_languages
    languages:
      - Common
      - Löswegi
```

### Deterministic edit layer

The edit layer should:

1. Resolve `current_proposal`.
2. Locate the `Quick Study` trait.
3. Remove the trait.
4. Replace the language line.
5. Validate the language list against the registry.
6. Re-run proposal validation.
7. Write the updated proposal or a new revision.
8. Record the change in the repair/edit log.

### Acceptance Criteria

- The LLM does not rewrite the whole proposal.
- The edit is represented as structured operations.
- Only the requested fields are changed.
- Validation runs after the edit.
- The repair/edit log records the operations.
- Invalid language names are rejected or suggested.

---

## Use Case 4: Regenerate One Section Only

### User says

```text
The player-safe description is a bit bland. Make only that section more unsettling.
```

### Intent normaliser outputs

```yaml
intent: revise_section
target: current_proposal
section: player_safe
instruction: make more unsettling while remaining player-safe
constraints:
  - do_not_change_stat_block
  - do_not_change_dm_only
  - do_not_add_new_named_entities
  - do_not_add_new_items
```

### System behaviour

The system may ask the LLM to rewrite only the `player_safe` section, but should pass the same corpus and policy constraints.

The deterministic layer then validates the rewritten section.

### Acceptance Criteria

- Only the player-safe section changes.
- No DM-only secrets leak into player-safe content.
- No new named entities are introduced.
- The edit is logged.
- The rest of the proposal remains unchanged.

---

## Use Case 5: Safe Confirmation for Destructive or Canon-Affecting Actions

### User says

```text
Promote this to canon and update the chapter state.
```

### Intent normaliser outputs

```yaml
intent: promote_proposal
target: current_proposal
side_effects:
  - promote_to_canon
  - update_chapter_state
requires_confirmation: true
```

### System behaviour

The assistant must ask for confirmation before execution:

```text
This will promote the proposal to canon and update chapter state.
Validation status: Pass.
Confirm promotion?
```

### Acceptance Criteria

- Destructive or canon-affecting actions require explicit confirmation.
- The LLM cannot bypass confirmation.
- Promotion uses deterministic promotion logic.
- State mutation is review-gated.
- A promotion log is written.

---

## Command Packet Types

### `propose`

Creates a new provisional proposal.

```yaml
intent: propose
proposal_type: npc | place | adversary | encounter | scene | chapter_outline | item | faction
subject: string
chapter: number | null
status: provisional
context: []
constraints: []
required_elements: []
```

### `edit_proposal`

Applies deterministic patch operations to a proposal.

```yaml
intent: edit_proposal
target: current_proposal | proposal_id
operations:
  - op: remove_trait | add_trait | rename_trait | set_languages | change_weapon | set_alignment | mark_provisional | remove_section
```

### `revise_section`

Regenerates or rewrites one allowed section.

```yaml
intent: revise_section
target: current_proposal | proposal_id
section: string
instruction: string
constraints: []
```

### `validate`

Runs validation without changing content.

```yaml
intent: validate
target: current_proposal | proposal_id
```

### `promote_proposal`

Promotes a validated proposal.

```yaml
intent: promote_proposal
target: current_proposal | proposal_id
requires_confirmation: true
```

---

## Safe Edit Operation Registry

The system should maintain an explicit registry of allowed operations.

Examples:

```yaml
safe_edit_operations:
  remove_trait:
    destructive: false
    requires_confirmation: false
    validation_required: true

  set_languages:
    destructive: false
    requires_confirmation: false
    validation_required: true
    registry_check: languages

  change_weapon:
    destructive: false
    requires_confirmation: false
    validation_required: true
    registry_check: faction_mechanical_overrides

  remove_section:
    destructive: true
    requires_confirmation: true
    validation_required: true

  promote_proposal:
    destructive: true
    requires_confirmation: true
    validation_required: true
```

---

## Intent Normalisation Pipeline

```text
User message
  ↓
LLM intent normaliser
  ↓
Structured command packet
  ↓
Schema validation
  ↓
Policy validation
  ↓
Deterministic command execution
  ↓
Proposal validation
  ↓
Write updated proposal / show confirmation / reject
```

The command packet should be schema-constrained where possible.

If schema-constrained generation is available, the normaliser should only be able to output valid command packet shapes.

---

## Ambiguity Handling

If the normaliser cannot confidently determine intent, it should return:

```yaml
intent: unclear
possible_intents:
  - propose_npc
  - propose_encounter
question: "Do you want an NPC proposal or an encounter proposal?"
```

The app should then ask a short clarification question.

Examples:

```text
Do you want this as an NPC, or as a full encounter around that NPC?
```

or:

```text
Should I edit the current proposal, or create a new variant?
```

---

## UX Pattern

The app should show what it understood before running meaningful actions.

For non-destructive actions:

```text
Interpreted as:
- edit current proposal
- remove trait: Quick Study
- set languages: Common, Löswegi

Applying edit and revalidating.
```

For destructive or canon-affecting actions:

```text
Interpreted as:
- promote current proposal
- update chapter state

This changes canon/state. Confirm?
```

---

## Validation Rules

Intent normalisation output must be validated before execution.

Checks:

- [ ] Intent is known.
- [ ] Proposal type is known.
- [ ] Target proposal exists.
- [ ] Operations are allowed.
- [ ] Fields exist before mutation.
- [ ] Registry values are valid.
- [ ] Destructive operations require confirmation.
- [ ] Canon/state changes require confirmation.
- [ ] Edited proposal passes validation or returns Needs Review.

---

## Tests

### Intent normalisation tests

- [ ] “I need someone on the Valweg road...” resolves to `proposal_type: npc`.
- [ ] “Give me something tense for the first approach to Valweg” resolves to `proposal_type: encounter`.
- [ ] “Give me a settlement halfway to Valweg” resolves to `proposal_type: place`.
- [ ] “Give me a Mathr road ambush unit” resolves to `proposal_type: adversary`.

### Edit operation tests

- [ ] “Remove Quick Study” becomes `remove_trait`.
- [ ] “Change languages to Common and Löswegi” becomes `set_languages`.
- [ ] Unknown language returns validation error.
- [ ] Removing a missing trait returns a clear error.
- [ ] Only requested fields change.

### Confirmation tests

- [ ] Promote proposal requires confirmation.
- [ ] Update chapter state requires confirmation.
- [ ] Delete proposal requires confirmation.
- [ ] Non-destructive edits do not require confirmation.

### Regression tests

- [ ] Intent normaliser must not bypass deterministic router.
- [ ] Intent normaliser must not write files directly.
- [ ] Intent normaliser must not promote content directly.
- [ ] Invalid command packet is rejected.
- [ ] Prompt injection attempting to call unauthorised operations is rejected.

---

## Risks

### Risk: LLM normaliser misclassifies intent

Mitigation:

- Show interpretation before action.
- Ask clarification on low confidence.
- Keep deterministic router authoritative.

### Risk: LLM generates invalid patch operations

Mitigation:

- Schema validation.
- Operation registry.
- Reject unknown operations.

### Risk: User accidentally mutates canon

Mitigation:

- Confirmation for promotion and state updates.
- Validation required before promotion.
- Promotion logs.

### Risk: Follow-up edits bypass policy

Mitigation:

- Re-run governance validation after every edit.
- Never trust patch output without validation.
- Keep edit logs.

---
---

## Model Evaluation Findings

A small bake-off was run against five representative intent-normalisation prompts:

1. Road-pressure scenario bundle.
2. Follow-up edit.
3. Section-only revision.
4. Promotion / canon-affecting action.
5. Ambiguous request requiring clarification.

Models tested:

- `gemma3:12b`
- `mistral:latest`
- `qwen2.5-coder:14b`

### Summary Result

| Model | Overall Result | Notes |
|---|---:|---|
| `gemma3:12b` | Best overall | Best balance across bundle detection, promotion safety, ambiguity handling and section revision. |
| `mistral:latest` | Close second | Good safety behaviour, but often missed `proposal_type` when `bundle_type` was present. |
| `qwen2.5-coder:14b` | Third | Good structure generally, but missed `requires_confirmation: true` for promotion, which is a safety concern. |

### Recommendation

Use `gemma3:12b` as the first implementation model for the intent normaliser.

Keep `mistral:latest` as a fallback/comparison model.

Do not use `qwen2.5-coder:14b` as the first intent-normalisation model unless schema validation and deterministic confirmation rules are already enforced, because it failed the promotion confirmation test.

---

## Findings by Test Prompt

### Prompt A — Road Pressure Bundle

User request:

```text
I need a tense road scene between Törweg and Valweg. The party should feel watched and pressured, but I don't want a lethal ambush. It should probably involve Mathr's reach, a local road authority, and some deniable muscle, but don't reveal Mathr directly.
```

Expected intent:

```yaml
intent: propose_bundle
proposal_type: encounter
bundle_type: road_pressure_encounter
```

Findings:

- `qwen2.5-coder:14b` and `mistral:latest` correctly chose `propose_bundle`.
- Both correctly chose `road_pressure_encounter`.
- Both missed `proposal_type: encounter`.
- Both often left `subject` as `null`.
- Both set confidence too high despite missing fields.

Required deterministic repair:

```text
if intent = propose_bundle and bundle_type = road_pressure_encounter:
  proposal_type = encounter

if subject is null and route.from + route.to exist:
  subject = "road encounter between <from> and <to>"

if confidence = 1.0 but required fields are missing:
  lower confidence or mark packet invalid
```

### Prompt B — Follow-Up Edit

User request:

```text
Actually remove the Quick Study trait, change the languages to Common and Löswegi, and rerun validation.
```

Expected operations:

```yaml
operations:
  - op: remove_trait
    trait: Quick Study
  - op: set_languages
    languages:
      - Common
      - Löswegi
  - op: rerun_validation
```

Findings:

All three models correctly identified:

```yaml
intent: edit_proposal
target: current_proposal
```

But all three returned operations as strings:

```yaml
operations:
  - remove_trait
  - set_languages
  - rerun_validation
```

This loses the required operation arguments.

Required schema rule:

```text
operations must be structured objects, not strings
```

String-only operations should be rejected or retried.

Correct shape:

```yaml
operations:
  - op: remove_trait
    trait: Quick Study
  - op: set_languages
    languages:
      - Common
      - Löswegi
  - op: rerun_validation
```

### Prompt C — Section-Only Revision

User request:

```text
The player-safe description is a bit bland. Make only that section more unsettling, but don't change the stat block, DM-only notes, traits, actions, or lore.
```

Findings:

All three models passed the intent test:

```yaml
intent: revise_section
target: current_proposal
```

They correctly captured constraints such as:

- do not change stat block
- do not change DM-only notes
- do not change traits
- do not change actions
- do not change lore

Schema improvement:

Add a dedicated `section` field rather than using `subject` for the section name.

Preferred output:

```yaml
intent: revise_section
target: current_proposal
section: player_safe
constraints:
  - make_more_unsettling
  - do_not_change_stat_block
  - do_not_change_dm_only
  - do_not_change_traits
  - do_not_change_actions
  - do_not_add_lore
```

### Prompt D — Promotion / Canon-Affecting Action

User request:

```text
Looks good. Promote this to canon and update the chapter state so the party can meet them on the road.
```

Expected:

```yaml
intent: promote_proposal
target: current_proposal
requires_confirmation: true
```

Findings:

- `gemma3:12b` correctly set `requires_confirmation: true`.
- `mistral:latest` correctly set `requires_confirmation: true`.
- `qwen2.5-coder:14b` incorrectly set `requires_confirmation: false`.

This is a serious safety issue.

Required deterministic rule:

```text
if intent = promote_proposal:
  requires_confirmation = true
  operations = []
  route.from = null
  route.to = null
```

Promotion, canonisation and state mutation must never proceed without explicit confirmation, regardless of model output.

### Prompt E — Ambiguous Request

User request:

```text
I need something with Astrid at the road gate, maybe as a scene or maybe just improve the NPC.
```

Expected:

```yaml
intent: unclear
subject: Astrid at the road gate
clarifying_question: "Do you want a new scene involving Astrid, or do you want to revise the existing Astrid NPC proposal?"
```

Findings:

All three models correctly returned `intent: unclear`.

`gemma3:12b` produced the cleanest clarification question:

```text
Would you like to propose a new scene, improve an existing NPC, or something else?
```

This is the desired failure mode: ask rather than guess.

---

## Implementation Decision

The first implementation should use:

```text
gemma3:12b
```

for intent normalisation.

Suggested settings:

```yaml
temperature: 0.0
top_p: 0.8
schema_constrained_output: true
```

Intent normalisation should be boring, repeatable and conservative. It should not use the same creative settings as proposal generation.

---

## Mandatory Guardrails

The model output must always pass through deterministic command-packet validation.

### Rule 1 — Bundle consistency

```text
if bundle_type is not null:
  intent must be propose_bundle
```

### Rule 2 — Road bundle repair

```text
if intent = propose_bundle and bundle_type = road_pressure_encounter:
  proposal_type = encounter
```

### Rule 3 — Operations only for edits

```text
if intent is propose, propose_bundle, revise_section, validate or promote_proposal:
  operations must be []
```

### Rule 4 — Operation payloads required

Operations must be objects with the required payload.

Invalid:

```yaml
operations:
  - remove_trait
```

Valid:

```yaml
operations:
  - op: remove_trait
    trait: Quick Study
```

### Rule 5 — Promotion confirmation

```text
if intent = promote_proposal:
  requires_confirmation = true
```

This must be enforced even if the model says otherwise.

### Rule 6 — Route only where relevant

```text
if intent is edit_proposal, revise_section, validate or promote_proposal:
  route.from = null
  route.to = null
```

### Rule 7 — Low confidence must clarify

```text
if confidence < 0.5:
  intent must be unclear
  clarifying_question must not be null
```

### Rule 8 — Concrete intent cannot have zero confidence

```text
if intent != unclear and clarifying_question = null:
  confidence must be >= 0.5
```

### Rule 9 — Constraint vocabulary normalisation

The system should normalise user-shaped constraint text into policy-shaped constraint tokens.

Examples:

```text
"push hard but not lethally" → hard_but_not_lethal
"Mathr knows they are coming" → imply_mathr_awareness
"do not reveal Mathr directly" → do_not_directly_reveal_mathr
"the net is closing" → closing_net_pressure
"party feels watched" → party_feels_watched
```

This matters because the intent model may capture the phrase correctly but make it too canonically strong.

Example:

```text
"Mathr knows they are coming"
```

should usually become:

```text
imply_mathr_awareness
```

not a canonical assertion that Mathr definitely knows.

---

## Updated Command Packet Schema Notes

Add `section` for section revision:

```yaml
intent: revise_section
target: current_proposal | proposal_id
section: player_safe | dm_only | stat_block | traits | actions | tactical_notes | doctrine | null
instruction: string | null
constraints: []
```

Operations must be typed objects:

```yaml
operations:
  - op: remove_trait
    trait: string

  - op: set_languages
    languages:
      - string

  - op: rerun_validation
```

Do not allow a bare string operation array.

---

## Updated Test Strategy

The intent normaliser should include a fixed model comparison fixture set.

### Fixture prompts

1. Road-pressure scenario bundle.
2. Follow-up edit with operation arguments.
3. Section-only revision.
4. Promotion and chapter-state update.
5. Ambiguous Astrid scene/NPC request.

### Scoring dimensions

Each response should be scored for:

- [ ] Valid JSON.
- [ ] Correct intent.
- [ ] Correct proposal type.
- [ ] Correct bundle type.
- [ ] Correct target.
- [ ] Operations only used for edits.
- [ ] Operation payloads present.
- [ ] Destructive action requires confirmation.
- [ ] Confidence is sensible.
- [ ] Clarifying question appears when ambiguous.
- [ ] No campaign content is generated.

### Minimum acceptance threshold

Before using a model as the default intent normaliser:

- [ ] 90%+ valid command packets across the fixture set.
- [ ] 100% correct confirmation handling for promotion/state mutation.
- [ ] 100% rejection or retry for invalid operation payloads.
- [ ] No direct campaign generation.
- [ ] No direct file mutation.

---

## Current Model Choice

Current default:

```yaml
intent_model: gemma3:12b
fallback_intent_model: mistral:latest
avoid_for_now:
  - qwen2.5-coder:14b
```

Rationale:

- `gemma3:12b` had the best overall balance.
- `mistral:latest` was close but missed `proposal_type` more often.
- `qwen2.5-coder:14b` missed confirmation on promotion, which is too risky for the first implementation.

The architecture should still assume any model can make unsafe mistakes.

## Implementation Notes

### New modules

Suggested files:

```text
src/intents/
  intentTypes.ts
  intentNormalizer.ts
  intentSchema.ts
  intentValidator.ts

src/proposals/
  proposalEditor.ts
  proposalPatchTypes.ts
  proposalPatchValidator.ts
```

### Registry files

Suggested files:

```text
corpus/registry/intent-patterns.yaml
corpus/registry/safe-edit-operations.yaml
```

### Command execution boundary

The intent normaliser should only output structured intent.

It should not:

- Write files.
- Edit files.
- Promote proposals.
- Mutate state.
- Bypass validation.

---

## Definition of Done

This feature is ready when:

- [ ] A natural language proposal request can be converted into a structured command packet.
- [ ] A follow-up edit can be converted into deterministic patch operations.
- [ ] Non-destructive edits can be applied and revalidated.
- [ ] Destructive/canon-affecting actions require confirmation.
- [ ] The deterministic router remains authoritative.
- [ ] All operations are logged.
- [ ] Invalid or ambiguous intent fails safely.
