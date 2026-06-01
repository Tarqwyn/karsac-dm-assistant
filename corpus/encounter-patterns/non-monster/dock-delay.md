---
id: encounter-patterns/non-monster/dock-delay
type: encounter-pattern
visibility: dm-facing
ruleset: dnd-5e-2014
tags: [social, dock, port, delay, time-pressure, faction-agent]
encounter_type: [procedural-delay, physical-obstruction, faction-pressure]
use_when:
  - the party needs to board or depart a vessel and time matters
  - a faction controls or has influence at the dock
  - a rival is on another vessel or needs to be prevented from leaving
  - the DM wants to use the dock as a social pressure environment
do_not_use_when:
  - the party has legitimate berth and no hostile interest is present
  - the dock is genuinely friendly and uncontested
  - the encounter should be a direct confrontation rather than a delay
typical_adversary_roles: [blocker, social-pressure, watcher, deceiver]
useful_npc_bases: [guard, thug, spy, commoner]
core_pressure: time passing while the party is held at the dock for procedural or physical reasons
common_checks: [Persuasion, Intimidation, Athletics, Sleight of Hand, Insight, Deception]
failure_modes:
  - the vessel departs without the party
  - a rival boards or disembarks before the party can act
  - the party creates a public scene that draws worse attention
  - contraband or an item of interest is discovered during a hold inspection
success_modes:
  - party boards or departs on time despite the delay
  - party learns who caused the delay and why
  - party uses the dock chaos to gain access or intelligence
state_update_suggestions:
  - if delayed, a rival may have reached a destination first
  - hostile faction now knows the party's vessel and intended route
  - dock personnel may be a future contact or obstacle
summary: "A dock departure or arrival is delayed by procedural obstruction, physical crowding, or a faction's interference. Time is the real pressure. The party must resolve the delay before the window closes."
---

# Dock Delay

## Pattern Summary

The party needs to board, depart, or intercept someone at a dock. Something is in the way — a paperwork dispute, a blocked berth, an official who needs convincing, a crowd, or a faction agent doing their job slowly. Time is the core pressure.

## Use When

- Arrival or departure is time-sensitive.
- A faction can use bureaucratic or physical means to delay without direct confrontation.
- A rival is also at the dock and the party needs to act before the rival does.

## Do Not Use When

- The dock is uncontested and the party has clear passage.
- The scene should be a direct fight or confrontation.

## Scene Structure

1. The party reaches the dock. The vessel is there but something prevents boarding.
2. The obstruction: a dispute over berth assignment, a missing document, a blocked gangway.
3. A faction agent or dock official is the proximate cause.
4. Time pressure escalates: the tide turns, the rival departs, the window closes.
5. Resolution: party clears the obstruction on time, partially, or too late.

## Pressure Ladder

**Low:** A paperwork problem. The dock agent is bureaucratic but not hostile.
**Medium:** The berth is disputed by another vessel. The official needs a bribe or a compelling argument.
**High:** Physical obstruction — a crowd, a cart, a locked gate. The rival's vessel is already moving.

## Useful NPC Bases

- Dock official: **Commoner** or **Noble** depending on rank (Persuasion target DC 12–15)
- Hired muscle blocking gangway: **Thug** (HP 32, AC 11, Multiattack)
- Faction watcher at the dock: **Spy** (Insight +4, notice the party's cargo or companions)
- Guard on the gate: **Guard** (AC 16, HP 11, follows orders from dock authority)

## Common Checks

- **Persuasion DC 12** — talk the dock official into releasing the berth
- **Intimidation DC 14** — move the obstruction through personal authority
- **Athletics DC 13** — push through a physical crowd or past a gate
- **Sleight of Hand DC 14** — palm the document that is causing the problem
- **Insight DC 11** — identify who is actually behind the delay
- **Deception DC 13** — pass off a false reason for the urgency

## Fail-forward Consequences

- The party boards late — the rival has a head start.
- The hold was inspected during the delay — something was found, or something was moved.
- The dock official is now a contact: the party paid or persuaded them, and that relationship exists.

## Example Karsac Uses

- Valweg dock arrival: a berth dispute delays the party while a Mathr agent watches from the quay.
- Törweg south dock: a blocked gangway and a hostile crowd after the south dock confrontation.
- Any timed departure where a faction benefits from the party missing their window.
