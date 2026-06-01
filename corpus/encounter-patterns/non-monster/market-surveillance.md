---
id: encounter-patterns/non-monster/market-surveillance
type: encounter-pattern
visibility: dm-facing
ruleset: dnd-5e-2014
tags: [social, market, surveillance, faction-agent, urban, observation]
encounter_type: [surveillance, information-gathering, faction-pressure]
use_when:
  - the party is in a market or public space and being watched
  - a faction wants to identify or follow the party without confrontation
  - the party needs to acquire something without being noticed
  - the DM wants to create a slow-burn tension scene in a public setting
do_not_use_when:
  - the party is not being watched or no faction has reason to surveil them
  - the setting is not public enough for market surveillance to make sense
  - the DM wants a direct confrontation rather than observation
typical_adversary_roles: [watcher, spy, deceiver, social-pressure]
useful_npc_bases: [spy, commoner, thug, scout]
core_pressure: being observed in a place where acting on that observation would be public and costly
common_checks: [Perception, Insight, Stealth, Deception, Investigation, Persuasion]
failure_modes:
  - party is identified and their location reported
  - party's purchase or contact is observed and reported
  - party is split up by the crowd and one member is approached
  - party makes a scene trying to lose their tail
success_modes:
  - party detects the surveillance and loses it cleanly
  - party identifies the watcher and learns who sent them
  - party makes their purchase or contact without the watcher confirming what they got
state_update_suggestions:
  - hostile faction knows the party is in this location
  - party may or may not know they were watched
  - if the contact or purchase was observed, hostile faction knows about it
summary: "The party moves through a public market while being observed by faction agents. The watchers are trying to identify, follow, or disrupt without creating a public incident. Spotting and losing the tail is the central tension."
---

# Market Surveillance

## Pattern Summary

A faction has watchers in a public market or street. They are not there to confront — they are there to identify, follow, and report. The party may not know they are being watched. The tension is in the gap between what the watchers can see and what the party can conceal or misdirect.

## Use When

- A faction suspects the party will be in a public place.
- The party needs to meet a contact or acquire something sensitive.
- The DM wants a social pressure scene without a direct confrontation.

## Do Not Use When

- The party is not being watched or no faction has reason to act.
- The setting doesn't support a public crowd scene.

## Scene Structure

1. The party enters the market or public space.
2. One or more watchers are present, trying to blend in.
3. The party has a goal — a purchase, a contact, information.
4. Tension: is the party spotted before they complete their goal?
5. Resolution: party succeeds, is tailed, or detects and loses the tail.

## Pressure Ladder

**Low:** A familiar face in an unexpected place. Nothing overt.
**Medium:** Two watchers coordinating. One following, one ahead.
**High:** The contact is spooked or approached. The party's purchase is interrupted.

## Useful NPC Bases

- Primary watcher: **Spy** (Perception +4, Stealth +6, Deception +6)
- Crowd blend: **Commoner** (CR 0, blends with environment — Perception passive 10)
- Muscle backup: **Thug** (HP 32, Multiattack — present if the party is to be stopped not just watched)
- Mobile tracker: **Scout** (Keen Sight/Hearing, Survival +4, moves well in crowd)

## Common Checks

- **Perception DC 13** — spot the watcher in the crowd
- **Insight DC 12** — the vendor is nervous; someone has been asking questions about you
- **Stealth DC 14** — slip through the crowd without the watcher keeping visual contact
- **Deception DC 13** — act casual while moving toward the actual target
- **Investigation DC 12** — identify the pattern of movement in the crowd (two watchers, not one)
- **Persuasion DC 11** — convince the contact that the situation is safe enough to proceed

## Fail-forward Consequences

- The contact is spooked but leaves a drop location.
- The party is followed out of the market — they do not know it yet.
- The purchase is made but the watcher gets a good look at what was bought.

## Example Karsac Uses

- Valweg market with Mathr watcher-network agents tracking the party's movements.
- Lösweg dockside market where Vane informants watch who the party talks to.
- Any urban setting where a faction has reason to know the party is present.
