# Schemas

Schemas are the runtime contract for structured campaign state, corpus-side data, and future design/runtime objects.

## Principles

- State data is replaceable if it follows the schema.
- Canon data and campaign state are separate concerns.
- Generated or imported entries should validate before they are used by runtime code.
- Schemas describe structure and allowed vocabulary, not story facts.

## Layout

- `state/` - table-progress state contracts
- `corpus/` - reserved for future structured corpus contracts
- `design/` - reserved for future design/runtime output contracts

## Scope

The first pass focuses on `corpus/state/` because it is now a stable structured data source. These schemas define the shape of campaign progress, party state, player knowledge, NPC state, item state, world threads, and per-session runtime artifacts.
