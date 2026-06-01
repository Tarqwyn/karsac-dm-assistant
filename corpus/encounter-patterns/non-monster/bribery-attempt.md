---
id: encounter-patterns/non-monster/bribery-attempt
type: encounter-pattern
visibility: dm-facing
ruleset: dnd-5e-2014
tags: [social, bribery, official, faction-agent, information, leverage]
encounter_type: [social-negotiation, information-exchange, faction-pressure]
use_when:
  - an NPC or faction tries to buy the party's silence, cooperation, or defection
  - the party wants to bribe their way past an obstacle
  - the DM wants to put the party in a morally interesting position
  - a faction is trying to recruit or redirect the party
do_not_use_when:
  - the party has no reason to be approached or no leverage
  - the NPC is too principled or too hostile to offer a deal
  - the scene should be about force rather than negotiation
typical_adversary_roles: [deceiver, social-pressure, interrogator]
useful_npc_bases: [noble, spy, commoner, bandit-captain]
core_pressure: the offer on the table and what accepting it costs — information, loyalty, or access
common_checks: [Insight, Persuasion, Deception, Investigation, Perception]
failure_modes:
  - party accepts and is now compromised or tracked
  - party refuses and the faction escalates to a harder approach
  - party appears to accept but the faction checks — creates ongoing suspicion
  - the bribe is a test; the faction wanted to know if the party could be bought
success_modes:
  - party refuses cleanly and the faction marks them as non-corruptible
  - party accepts with strings they control — gains something without giving everything
  - party extracts information from the offer before refusing
  - party identifies the faction behind the bribe
state_update_suggestions:
  - faction's assessment of the party updates (corruptible or not)
  - if accepted, a new obligation or tracking risk is established
  - party may have learned the faction's agenda from what they were offered to ignore
summary: "An NPC offers the party money, access, or safety in exchange for cooperation, silence, or defection. The offer reveals what the faction values and fears. The party's response shapes the relationship."
---

# Bribery Attempt

## Pattern Summary

An NPC approaches the party with an offer — money, passage, protection, or information — in exchange for something the faction wants: silence about what they saw, a decision to stop, cooperation with an investigation, or a choice to look away. What is offered reveals what the faction most wants to protect.

## Use When

- A faction is trying to manage the party without direct confrontation.
- The party is close enough to something the faction wants to protect.
- A moral or strategic choice is more interesting than a fight.

## Do Not Use When

- The faction has no reason to negotiate — they will just act.
- The party is too weak or too unknown to be worth bribing.

## Scene Structure

1. An intermediary or direct NPC approaches the party in private.
2. The offer is made — framed as reasonable, even generous.
3. The party considers: what is actually being asked for, and what does it reveal?
4. Negotiation or refusal follows.
5. Resolution: accepted, refused, or a counter-offer.

## Pressure Ladder

**Low:** A generous offer with no stated deadline. The NPC is friendly and plausible.
**Medium:** The offer includes a veiled warning about what happens if they refuse.
**High:** The terms are explicit — cooperate or face a specific named consequence.

## Useful NPC Bases

- Intermediary: **Spy** (Deception +6, Persuasion +6, Insight +4)
- Principal offering the deal: **Noble** (Persuasion +5, resources to back the offer)
- Enforcer present to signal the alternative: **Bandit Captain** (AC 15, HP 65, Multiattack, Parry)
- Minor official used as a cutout: **Commoner** (plausible deniability)

## Common Checks

- **Insight DC 13** — read whether the NPC is authorised to offer this, or is fronting for someone
- **Investigation DC 14** — identify who benefits from this offer and what they are protecting
- **Persuasion DC 13** — negotiate better terms or more information out of the offer
- **Deception DC 14** — appear to accept while planning to act differently
- **Perception DC 12** — notice the watcher outside, or the signal the NPC gave when the party arrived

## Fail-forward Consequences

- Refusal leads to a harder approach — the faction now knows the party cannot be bought.
- Apparent acceptance — the faction believes it is managed, giving the party temporary latitude.
- The party takes the money and the faction marks them as a managed asset — with strings attached.

## Example Karsac Uses

- A Mathr intermediary offers the party safe passage to Valweg in exchange for handing over one of the artefacts.
- A Lösweg council member offers the party access to the council archives in exchange for staying quiet about what they found.
- A Vane agent offers the party information about Beorn in exchange for not exposing a Vane operation.
