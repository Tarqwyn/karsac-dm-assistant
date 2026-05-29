# Architecture

## Pattern

Registry-guided domain AI runtime.

## Core Pipeline

1. User asks a freeform question.
2. Router selects profile.
3. Resolver finds entities, rules, monsters, or adversaries.
4. Context builder loads bounded context.
5. Task brief compiler turns user intent into a model-facing task.
6. Model generates.
7. Validator checks output.
8. Repair runs if needed.
9. Deterministic fallback is used if model output remains invalid.

## Why Not Simple RAG?

Because the model should not decide:

- what is canon
- what sources are allowed
- what is player-safe
- what mechanics can be invented
- what becomes canon

## Key Principle

The deterministic runtime owns:

- routing
- retrieval
- permissions
- composition plans
- locked sections
- validation
- fallback

The model owns:

- wording
- synthesis
- tone
- explanation inside the compiled brief
