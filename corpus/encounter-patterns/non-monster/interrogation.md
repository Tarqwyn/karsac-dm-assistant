---
id: encounter-patterns/non-monster/interrogation
type: encounter-pattern
visibility: dm-facing
ruleset: dnd-5e-2014
tags: [social, information, pressure, faction-agent, captive, hostile]
encounter_type: [information-extraction, faction-pressure, social-obstruction]
use_when:
  - a hostile party has captured or cornered a party member
  - the party is being questioned by a faction that suspects them
  - the DM wants to put player knowledge and NPC knowledge in direct conflict
  - the stakes of what is revealed are high
do_not_use_when:
  - the party is free and mobile — use roadblock or customs instead
  - the questioning NPC is friendly or neutral
  - the scene would reduce to torture with no narrative purpose
typical_adversary_roles: [interrogator, deceiver, watcher, social-pressure]
useful_npc_bases: [spy, veteran, noble, thug]
core_pressure: confined position plus information asymmetry — the interrogator knows more than they reveal
common_checks: [Insight, Deception, Persuasion, Intimidation, History, Perception]
failure_modes:
  - party member reveals a fact that advances the hostile faction's plan
  - party is separated for different questioning, inconsistencies emerge
  - escape attempt is detected, security tightens
  - interrogator confirms a suspicion they only half-held before
success_modes:
  - party learns what the faction actually suspects or knows
  - party feeds false information that the faction acts on
  - party creates doubt or misdirection about their purpose
  - party escapes or is released having given nothing critical
state_update_suggestions:
  - hostile faction's knowledge state updates based on what was revealed
  - party now knows how much the faction knows
  - relationship with the faction shifts
summary: "The party or a member is questioned under pressure by a hostile NPC who wants specific information. The tension is between what the party knows and what they are willing or able to conceal."
---

# Interrogation

## Pattern Summary

A party member — or the whole group — is questioned by a hostile or suspicious NPC who wants specific information. The NPC knows something, suspects more, and will use the session to confirm. The party must decide what to reveal, what to deny, and whether to feed false information.

## Use When

- The party is captured, cornered, or in a situation where refusal has consequences.
- A faction is trying to confirm what the party knows or carries.
- The DM wants player knowledge and NPC knowledge in direct conflict.

## Do Not Use When

- The party is free and the questioning is informal.
- The scene would have no strategic content — only suffering.

## Scene Structure

1. The party or member is placed in a confined or controlled position.
2. The interrogator opens with something they already know — demonstrating capability.
3. Questions escalate toward the thing they actually want to know.
4. The party must decide: reveal, lie, misdirect, or refuse.
5. Resolution: the interrogator acts on what they believe they learned.

## Pressure Ladder

**Low:** Polite but pointed questions. The interrogator is patient.
**Medium:** Evidence presented. The interrogator reveals they know more than expected.
**High:** A threat — to the party member, to someone the party cares about, to their mission.

## Useful NPC Bases

- Lead interrogator: **Spy** (Insight +4, Deception +6, Investigation +4)
- Muscle presence: **Veteran** (AC 17, HP 58, Multiattack) — does not speak, just watches
- Authoritative variant: **Noble** (Persuasion +5, Intimidation +5)
- Thug enforcer: **Thug** (AC 11, HP 32, Multiattack, Heavy Crossbow)

## Common Checks

- **Deception DC 14** — lie convincingly about purpose, allegiance, or what the party carries
- **Insight DC 13** — detect what the interrogator already knows vs what they are fishing for
- **Persuasion DC 15** — redirect the line of questioning
- **Intimidation DC 16** — assert enough personal authority to change the dynamic
- **History DC 12** — recognise the interrogator's faction or method from known precedent
- **Perception DC 14** — note exits, observers, or the item on the table they have not explained

## Fail-forward Consequences

- Something true escapes — not a total loss, but the faction now has a confirmed fact.
- The party is released having given nothing, but the interrogator is not satisfied.
- The session ends inconclusively — the faction will try a different approach.

## Example Karsac Uses

- A Mathr agent questions a detained party member about their cargo below deck.
- Truthspeaker network questions the party about who they met in Törweg.
- A Valweg official questions the party about their connection to a named NPC.
