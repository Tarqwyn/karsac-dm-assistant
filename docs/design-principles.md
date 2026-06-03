# Design Principles

## Models propose. Code governs.

The model generates wording, tone, synthesis, and prose inside a compiled brief. The deterministic runtime — registry, policy, pruner, validator — decides what is allowed, what is canon, and what can be promoted.

The model cannot promote itself. The model cannot decide what is player-safe. The model cannot invent canonical facts. The model cannot change item state. These decisions belong to the pipeline.

---

## The user prompt is evidence. The compiled brief is the instruction.

When a user says "Propose Jarl Beorn," that is a signal, not an instruction. The pipeline interprets it, loads the corpus anchor, applies the entity policy, assembles a precise contract, and passes that contract to the model. The model receives "here is what you are allowed to write, here is what the corpus says, here is what you must not invent" — not "write about Beorn."

---

## Schema controls shape. Governance controls meaning.

Structural validation (required sections, frontmatter fields) ensures the output has the right shape. Governance validation (named NPC boundaries, item state, anchor content, forbidden patterns) ensures the content means what it should mean and nothing more.

A well-shaped proposal with invented canon is not a good proposal. Both layers are required.

---

## A correct minimal proposal is better than a detailed invented one.

For stub-level or canonical-reference-only entities, the right output is thin. One sentence of corpus coverage produces a short proposal. That is correct behavior, not a failure.

The model will always want to build cities. The pipeline's job is to contain that. NEEDS REVIEW with flagged provisional additions is the correct output for a corpus-thin canonical place — it tells you what the corpus needs, not what the model imagined.

---

## Invented content that survives pruning must be flagged, not hidden.

The repair log is not a failure report. It is a transparency record. Every pruned section, every stripped sentence, every auto-repair is logged with the policy rule responsible. A proposal with a long repair log is not a bad proposal — it is a well-governed one.

A proposal that fails validation is written to disk marked as requiring review. It is never silently discarded. Failed inventions must not become pseudo-canon through accumulation.

---

## Policy in data. Execution in code.

The code should not know that Beorn must be deceived rather than corrupted, or that Shadow Walkers should not inherit shortbows from Spy. The code loads those rules from registries and applies them generically.

Entity-specific knowledge lives in `corpus/registry/proposal-entity-policies.yaml`. Faction doctrine lives in `corpus/registry/factions.yaml`. Mechanical overrides live in `corpus/registry/faction-mechanical-overrides.yaml`. The TypeScript executes; the YAML decides.

This separation means the corpus owner can extend coverage, tighten constraints, and add new entities without touching the pipeline code.

---

## Make the problem smaller before making the model bigger.

The temptation when generation quality is poor is to switch to a larger model. The correct response is to ask: is the problem smaller than it looks? Can the context be bounded more tightly? Can a forbidden pattern strip the bad sentence before it reaches validation? Can the schema prevent the field from being generated at all?

Governance improvements compound. A better local model is a one-time gain. A tighter policy applies to every generation.

---

## Validation failures are information, not noise.

When the validator fires, it is correct by design. A false positive in the validator is a bug to fix. A suppressed true positive is worse than a false positive — it is a silent canon breach.

The current stochastic failures (model occasionally generates Shade extrapolation for Dugweb, model occasionally invents factions in Valweg DM Notes) are not validator failures. The validator catches them correctly. The work remaining is to strip them earlier in the pipeline, not to suppress the check.
