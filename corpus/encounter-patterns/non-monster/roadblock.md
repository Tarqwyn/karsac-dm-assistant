---
id: encounter-patterns/non-monster/roadblock
type: encounter-pattern
visibility: dm-facing
ruleset: dnd-5e-2014
tags: [social, road, checkpoint, delay, faction-agent, pursuit]
encounter_type: [procedural-delay, physical-obstruction, social-obstruction]
use_when:
  - party travels by road and a faction wants to slow or identify them
  - the DM wants to signal that a road is under surveillance
  - a faction needs to confirm the party's identity or route
  - time pressure makes delay meaningful
do_not_use_when:
  - the road is genuinely safe and no faction is watching
  - the party is travelling openly with legitimate reason
  - combat is the intended scene (use a patrol encounter instead)
typical_adversary_roles: [blocker, pursuer, interrogator, watcher]
useful_npc_bases: [guard, scout, veteran, spy]
core_pressure: physical presence plus implied authority — the road is blocked and refusal has consequences
common_checks: [Persuasion, Deception, Intimidation, Perception, Stealth, Athletics]
failure_modes:
  - party delayed long enough for a rival to reach the destination first
  - party members identified and reported up the chain
  - party forced into a confrontation that draws attention
  - a member is held as surety while others proceed
success_modes:
  - party passes without identity being confirmed
  - party identifies who set the roadblock and why
  - party finds and uses an alternate route
state_update_suggestions:
  - hostile faction confirms the party is on this road
  - party may have gained intelligence about what is ahead
  - clock advances if the delay was significant
summary: "Agents or soldiers block a road under colour of authority, demanding identification and reason for travel. Goal is delay, identification, or interdiction. Social skills and alternate routes matter more than combat."
---

# Roadblock

## Pattern Summary

A checkpoint on a road staffed by agents using official-seeming authority. The party is stopped, questioned, and must satisfy or evade the checkpoint. The real goal may be delay, identification, or holding the party until a response force arrives.

## Use When

- A faction knows or suspects the party is on this road.
- A time-sensitive destination makes delay costly.
- The DM wants to signal that a hostile power controls this approach.

## Do Not Use When

- The road is genuinely free of hostile interest.
- A direct combat encounter would serve better.

## Scene Structure

1. The party sees or encounters the checkpoint ahead.
2. Agents demand identification, destination, reason for travel.
3. Interest narrows to a specific member or item.
4. Escalation: refusal to pass, demands for surety, a waiting force behind the checkpoint.
5. Resolution: satisfy, bluff, detour, or force past.

## Pressure Ladder

**Low:** Papers requested. Routine questions. The agents are plausible but not aggressive.
**Medium:** Specific questions about destination or cargo. One agent watching while another talks.
**High:** A second group visible further up the road. A demand that one member stay.

## Useful NPC Bases

- Checkpoint pair: **Guard** (AC 16, HP 11, Spear +3)
- Tracker/spotter: **Scout** (AC 13, HP 16, Keen Sight/Hearing, Longbow +5)
- Named agent: **Veteran** (AC 17, HP 58, Multiattack)
- Interrogator variant: **Spy** (Deception +6, Insight +4)

## Common Checks

- **Persuasion DC 12** — satisfy the checkpoint with a plausible reason for travel
- **Deception DC 14** — false identity or reason convinces the lead agent
- **Intimidation DC 16** — force through on personal authority
- **Perception DC 12** — spot the second group or the watcher further back
- **Stealth DC 14** — detour around the checkpoint without being seen
- **Athletics DC 12** — force through a physical barrier if it comes to that

## Fail-forward Consequences

- The party passes but their route and timing is now known to the faction.
- A member is briefly detained and then released — faction confirms identity.
- The party detours but loses time, and the road behind them is now watched.

## Example Karsac Uses

- Mathr road agents on the coast road to Valweg, running a checkpoint against a specific party description.
- Vane housecarls watching the southern road out of Törweg after the south dock confrontation.
- Truthspeaker network agents at a bridge or ford on the approach to Lösweg.
