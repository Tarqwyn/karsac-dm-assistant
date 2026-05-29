---
id: rules/core/conditions
type: rule
ruleset: dnd-5e-2014
visibility: dm-and-player
canonical: srd-5.1
tags: [conditions, blinded, charmed, frightened, grappled, restrained, unconscious]
related:
  rules: [rules/core/grapple-and-shove, rules/core/death-saving-throws, rules/core/hiding-stealth-perception]
summary: "Conditions apply specific rule effects that change what a creature can do, and multiple copies of the same condition do not stack into a stronger version."
source:
  title: "D&D SRD 5.1"
  licence: "SRD 5.1 / OGL 1.0a source used by project"
---

# Conditions

**Rule ID:** `rules/core/conditions`

**Retrieval Summary:** Conditions apply specific rule effects that change what a creature can do, and multiple copies of the same condition do not stack into a stronger version.

## Rule Summary

Each condition has a fixed rules meaning. A creature either has that condition or it does not.

## Procedure

1. Identify the effect that imposes the condition.
2. Apply the exact condition text.
3. Track its duration or ending condition.
4. If the same condition is applied again, track the new duration separately but do not worsen the effect.

## At the Table

Use this whenever a spell, attack, feature, hazard, or ruling imposes a named condition.

## Common Questions

### Do repeated copies of the same condition stack?

No. They can overlap in duration, but the condition's effect does not intensify.

### How should this file be used with individual condition lookups?

Use this file for the general rule, then use `rules-data/conditions.json` for fast lookup of a specific condition summary.

## Related Rules

- `rules/core/grapple-and-shove`
- `rules/core/death-saving-throws`
- `rules/core/hiding-stealth-perception`
