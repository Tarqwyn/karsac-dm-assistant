# Corpus Proposals

This directory holds generated proposals awaiting DM review and promotion.

## Structure

```
proposals/
  adversaries/       Active adversary proposals
  chapters/          Active chapter-outline proposals
  encounters/        Active encounter proposals
  npcs/              Active NPC proposals
  places/            Active place proposals
  state-updates/     State-update proposals (no direct promotion)
  ...

  _promoted/         Proposals that have been approved and promoted
  _rejected/         Proposals that failed validation or were rejected by the DM
```

## Lifecycle

1. **proposed** — written by the pipeline, awaiting DM review
2. **promoted** — approved and moved to `corpus/planning/` or `corpus/adversary-corpus/`
3. **rejected** — moved to `_rejected/` by the DM after review

## _rejected/ convention

Move failed or unwanted proposals into `_rejected/` manually.
The provisional entity register (`proposalEntityRegistry.ts`) **excludes** `_rejected/`
from its scan. This prevents invented entities in rejected proposals (invented factions,
NPCs, place names) from propagating into new proposals as if they were legitimate.

Do not delete rejected proposals immediately — they may be useful as reference for what
was tried and why it failed.

## _promoted/ convention

Promoted proposals are kept here with `status: promoted` in their frontmatter.
The `promote_target` field in the frontmatter records where the canonical copy was written.
