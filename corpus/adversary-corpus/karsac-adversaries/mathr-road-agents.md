---
id: adversaries/mathr-road-agents
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, mathr, road-agent, valweg-road, chapter-3, faction-agent, pursuit, social-pressure]
opposition_type: [faction-agent, pursuer, scout, social-obstacle]
encounter_roles: [blocker, pursuer, interrogator, watcher, social-pressure, combatant]
campaign_use: [road-pressure, pursuit, social-obstruction, chapter-3, valweg-approach]
mechanical_base:
  - npc-bases/srd-2014/guard
  - npc-bases/srd-2014/scout
  - npc-bases/srd-2014/spy
  - npc-bases/srd-2014/veteran
mechanical_status: provisional-adaptation
homebrew_adjustments:
  status: provisional
  notes: "No canon stat block exists for Mathr road agents as a named type. Canonical basis: Ch2 closing states 'the road to Valweg is not safe' and Brynja and Floki both give this warning. The threat is implied, not instantiated. SRD bases cover the encounter range: guard and scout for standard road presence, spy for the interrogator/informant variant, veteran for capable named agents. Apply Mathr token detail (small bronze sigil) to those directly assigned from Mathr's operation. Local hired agents may carry no token."
can_know:
  - who gave their immediate order (a Mathr lieutenant or the Truthspeaker's network)
  - where they are assigned to watch or delay
  - who they are meant to slow down, observe, or intercept
  - basic description of the party and their vessel
must_not_know:
  - Mathr's full hidden nature or sixty-year history
  - Vishara's purpose or the Yantravaq
  - the cosmological significance of the artefacts
  - why these particular foreigners are a concern to Jarl Mathr
  - that the Truthspeaker's network extends to their assignment
tactics:
  - road checkpoint posture: we are officials, you need papers, step aside
  - if social obstruction is refused, escalate to delay tactics (accusations, confiscation threats)
  - pursuit variant: track from distance, do not engage until instructed, report position
  - ambush variant (if ordered to stop rather than delay): coordinated, use terrain, do not announce
  - always leave a route to compliance — the goal is delay or information, not a body count
escalation:
  low: "Road checkpoint. Documents requested. Questions asked. The badge of authority is plausible but slightly wrong."
  medium: "Refusal to let the party pass. Accusations. A warrant that covers more than it should. Two more agents visible further up the road."
  high: "Coordinated stop-and-detain, or a pursuit force closing from behind. Full engagement if the party has become an active problem for Mathr's operation."
player_safe_reveal:
  - "They have authority, or something that looks like it."
  - "Their questions are specific in ways a routine checkpoint should not be."
  - "They are not trying to kill you. They are trying to stop you, which may be worse."
  - "The road to Valweg is not safe. Brynja said so. Floki said so. This is why."
dm_only:
  - "Road agents are the operational extension of Mathr's Törweg network onto the coast road and inland routes to Valweg. Their existence is implied by Ch2 closing warnings but not instantiated."
  - "The goal is delay, not destruction. Mathr does not yet need the party dead — he needs them late, or uninformed, or unable to reach Beorn before Dugweb arrives."
  - "If the party has been making noise (public confrontation at the dock, etc.), the road agents may be looking specifically for them by description. If the party was discreet, the checkpoint is more generic."
  - "Road agents may not know they are working for Mathr specifically — local hired talent would know only that they work for a Valweg authority."
related:
  factions:
    - id: factions/house-mathr
candidate_links:
  places:
    - id: places/valweg-road
      confidence: high
      reason: "Explicit canon: 'the road north will not be safe.' Road agents are the most plausible named threat on that route."
      status: suggested
    - id: places/torweg
      confidence: medium
      reason: "Road agents may operate from Törweg outward rather than from Valweg inward."
      status: suggested
    - id: places/valweg
      confidence: medium
      reason: "Mathr's council seat. Road agents answer to this authority."
      status: suggested
summary: "Provisional adversary type: Mathr-aligned road operatives blocking, pursuing, or interrogating the party on the coast road and inland routes to Valweg. Canonical basis is the Ch2 warning that the road north is not safe. No named stat block in canon — SRD guard/scout/spy/veteran bases apply."
---

# Mathr Road Agents

## Adversary Summary

The operational presence of Mathr's network on the road between Törweg and Valweg. Not housecarls — they are a different instrument. They look like officials, work as checkpoints, and function as delay and surveillance rather than direct force. The party was warned the road is not safe. These are part of why.

## Campaign Purpose

Road agents extend Mathr's reach beyond Törweg and onto the route the party must travel to reach Valweg before Dugweb's annual visit. They create social pressure encounters that cannot be resolved by combat without consequence. They are also a way to signal that Mathr knows the party is coming — the questions at the checkpoint are too specific for a routine stop.

## What They Are

Mathr-aligned operatives working as road officials, patrol agents, or hired local talent on the approaches to Valweg. Some carry Mathr's bronze token; local hired agents may carry only a document of authority. They prioritise delay and information over combat.

## What They Know

Their assignment, their target descriptions, their reporting contact. That they work for a Valweg authority. They do not know the full shape of what they serve.

## What They Do Not Know

Mathr's hidden nature, Vishara's purpose, why the foreigners they are watching matter cosmologically. Why the deadline matters. Most do not know the specifics of the artefact operation.

## Tactics

The checkpoint posture is the primary mode: papers, questions, delay. If social pressure fails, escalate to accusations or warrant claims. If the party is identified as the specific targets, escalate to pursuit or a coordinated stop. Always leave a compliance route — the goal is not a fight.

## Escalation Levels

**Low** — Routine-seeming checkpoint. Documents requested. Questions too specific.

**Medium** — Obstruction. A warrant that covers too much. More agents visible ahead.

**High** — Coordinated pursuit or stop-and-detain. Full engagement if the party has become an active liability.

## Mechanical Base

No canon stat block. Use SRD bases:
- Standard road presence: `npc-bases/srd-2014/guard` (two or three agents)
- Tracker/pursuit variant: `npc-bases/srd-2014/scout`
- Interrogator/informant variant: `npc-bases/srd-2014/spy`
- Named or capable agent: `npc-bases/srd-2014/veteran`

Add Mathr token detail (bronze sigil, palm-sized) to agents directly from Mathr's operation.

## Karsac Adaptation Notes

The distinction between hired local agents (no token, vague authority) and Mathr-direct agents (token, specific warrant) gives the DM a sliding scale of how much the party can learn from confronting them. A hired agent cannot tell them much; a direct agent carries the Mathr sigil and can be pressed.

Mark all road agent encounters as provisional homebrew until Chapter 3 canon material instantiates this adversary type.

## Player-Safe Use

Players may perceive: official posture with slightly wrong authority, questions too specific for routine stops, the Mathr sigil on a document or token (if present), the confirmation that the road warnings were accurate. Players must not be told Mathr's full nature or why their arrival in Valweg is being delayed.

## Canon Status

**Provisional.** The road agent threat is implied by explicit Ch2 warnings but not instantiated with a named adversary type or stat block. Mark as `canonical: provisional` until Chapter 3 material confirms this adversary class.
