---
id: encounter-patterns/non-monster/customs-inspection
type: encounter-pattern
visibility: dm-facing
ruleset: dnd-5e-2014
tags: [social, official, port, dock, delay, information-extraction, faction-agent]
encounter_type: [procedural-delay, social-obstruction, information-extraction]
use_when:
  - party arrives by sea at a controlled port
  - a faction wants to delay, surveil, or identify the party
  - the party carries goods or items that would interest hostile officials
  - the DM wants to signal that powerful interests control the port
do_not_use_when:
  - the port is friendly and the party is expected
  - the party has legitimate papers and no hostile faction present
  - the party is already known and trusted at this location
typical_adversary_roles: [blocker, interrogator, deceiver, social-pressure]
useful_npc_bases: [spy, guard, noble, thug]
core_pressure: official authority plus procedural compliance — the party must cooperate or create a scene
common_checks: [Insight, Deception, Persuasion, Investigation, Sleight of Hand]
failure_modes:
  - cargo confiscated on a pretext
  - party names and descriptions recorded and passed to hostile faction
  - delayed long enough for a rival to arrive first
  - one member detained on a manufactured charge
success_modes:
  - party satisfies inspection and passes without losing anything critical
  - party identifies who sent the inspector and what they were looking for
  - party feeds false information through the inspection
state_update_suggestions:
  - hostile faction now has party's cargo inventory and names
  - party knows who controls the port (if they spotted the tell)
  - clock ticks if arrival was time-sensitive
summary: "A controlled port arrival becomes a procedural obstacle when official-seeming agents demand documents, inspect cargo, and ask too-specific questions. The real goal is delay, surveillance, or information extraction."
---

# Customs Inspection

## Pattern Summary

The party arrives at a port and encounters officials whose authority looks correct but whose interest is too specific for routine procedure. The officials want information — cargo inventory, companions, destination, items of interest. They use legal compliance as leverage.

## Use When

- A faction controls or has agents inside the port authority.
- The party carries something that hostile interests want to find.
- Arrival is time-pressured and delay has real consequences.

## Do Not Use When

- The port is genuinely friendly and the party is expected.
- The party has clean papers and no hostile faction has reason to act.

## Scene Structure

1. Party arrives at the dock or gate.
2. Officials approach with authority documents, request inspection.
3. Questions become specific — cargo below the ordinary goods, names, destination, companions.
4. Escalation: extended inspection, hold-access request, detention pretext.
5. Resolution: party passes (with information cost), argues through, or refuses and escalates.

## Pressure Ladder

**Low:** Routine-seeming inspection. Documents requested. Names recorded.
**Medium:** Cargo hold access demanded. Questions about specific items. Interest in what is below the ordinary goods.
**High:** Detention warrant on a pretext. Escort pair visible. A response force implied nearby.

## Useful NPC Bases

- Lead official: **Spy** (Deception +6, Insight +4, Persuasion +6, Investigation +4)
- Escort pair: **Guard** (AC 16, HP 11, Spear +3)
- Senior official variant: **Noble** (Persuasion +5, AC 15)

## Common Checks

- **Insight DC 13** — the questions are too specific for routine inspection
- **Investigation DC 12** — the seal on the documents is wrong (faction sigil)
- **Deception DC 14** — pass off false cargo information convincingly
- **Persuasion DC 12** — satisfy the inspection with minimal information given
- **Sleight of Hand DC 15** — conceal an item of interest during cargo check

## Fail-forward Consequences

A failed or costly compliance still moves the story forward:
- The party passes but their cargo inventory is now with the hostile faction.
- A member is briefly held, then released — creating a time cost and a warning.
- The faction learns the party is alive and moving, which triggers the next pressure.

## Example Karsac Uses

- False customs officers at Valweg dock arrival, carrying Mathr sigil on authority documents.
- Port authority in Lösweg controlled by Vane housecarls checking arriving vessels.
- Truthspeaker network agents posing as import inspectors at any controlled harbour.
