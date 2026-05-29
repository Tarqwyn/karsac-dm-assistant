---
id: adversaries/pursuit-scouts
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, pursuit, scout, mathr, road, chapter-3, faction-agent, pursuer]
opposition_type: [faction-agent, pursuer, scout]
encounter_roles: [pursuer, scout, watcher, pressure]
campaign_use: [pursuit, road-pressure, information-control, chapter-3, valweg-approach]
mechanical_base:
  - npc-bases/srd-2014/scout
  - npc-bases/srd-2014/spy
mechanical_status: provisional-adaptation
homebrew_adjustments:
  status: provisional
  notes: "No canon stat block. Pursuit scouts are the mobile, tracking element of Mathr's road network — distinct from static road agents (checkpoint) and watchers (embedded). They track the party's position and relay it forward so that road agents or housecarls can be positioned ahead. SRD scout is the primary base. Spy base for a more capable operative who can blend while tracking. Two pursuit scouts with a third as a relay rider is the minimal effective unit."
can_know:
  - current assignment: track this group, report position, do not engage
  - description of the party and their vessel or mounts
  - reporting structure (who to send information to and how)
  - approximate operational deadline (before Dugweb's visit, though they may not know why)
must_not_know:
  - Mathr's full hidden nature
  - Vishara's purpose or the Yantravaq
  - the cosmological significance of what the party carries
  - why the deadline matters
  - the full scope of the artefact operation
tactics:
  - stay out of sight; tracking distance, not engagement distance
  - use terrain and road traffic as cover
  - relay position ahead so the party meets obstruction rather than pursuit
  - if discovered, break off and report rather than fight
  - if cornered, fight only to disengage; they are not sent to win a fight
escalation:
  low: "A figure on a ridge that was there and is now gone. Hoofbeats that stop when the party stops."
  medium: "The party reaches a checkpoint that was not there when they left. Someone knew they were coming."
  high: "Active pursuit identified. Two scouts behind, a third rider ahead. The road agent or housecarl force ahead was pre-positioned."
player_safe_reveal:
  - "The checkpoint ahead was not there yesterday. Someone knew you were coming."
  - "There was a rider on the ridge. He stopped when you stopped."
  - "The road behind you is not empty."
  - "This is why the road was not safe."
dm_only:
  - "Pursuit scouts are the connective tissue of Mathr's road network. They make road agents effective by positioning them ahead of the party rather than behind."
  - "A party that identifies and eliminates the pursuit scouts buys time and freedom of movement. This is a legitimate tactical choice that should be rewarded with a cleaner Chapter 3 road."
  - "Pursuit scouts do not know enough to be interrogated productively. They know their assignment and their reporting contact. They do not know why."
related:
  factions:
    - id: factions/house-mathr
candidate_links:
  places:
    - id: places/valweg-road
      confidence: high
      reason: "Pursuit scouts are specifically a road threat on the approach to Valweg."
      status: suggested
  adversaries:
    - id: adversaries/mathr-road-agents
      confidence: high
      reason: "Pursuit scouts feed position information to road agents. They function as a paired system."
      status: suggested
    - id: adversaries/house-mathr-watchers
      confidence: medium
      reason: "Watchers in towns, scouts on the road — different expressions of the same surveillance network."
      status: suggested
summary: "Provisional adversary type: mobile tracking operatives feeding the party's position to road agents ahead of them. The connective tissue of Mathr's road network. Canon basis: the Ch2 road-is-not-safe warning implies an active threat; pursuit scouts are the mobile element of that threat."
---

# Pursuit Scouts

## Adversary Summary

The mobile tracking element of Mathr's road network. They do not fight. They watch, follow, and report. Their function is to position road agents or housecarls ahead of the party so that the party meets obstruction rather than pursuit. A party that identifies the pursuit scouts and removes or evades them buys genuine freedom on the road.

## Campaign Purpose

Pursuit scouts give the road threat texture and make the party's tactical choices matter. If they move fast and quietly, they may break the scout-to-agent relay and arrive somewhere unexpected. If they move slowly or publicly, the road ahead will always be prepared. This creates a genuine travel game on the road to Valweg.

## What They Are

Light, mobile operatives — trackers and riders — assigned to follow the party at safe distance and relay position forward. They are professionals at staying out of sight. They fight only to disengage.

## What They Know

Their assignment, target description, and reporting structure. An approximate deadline, stated as operational urgency rather than cosmological context.

## What They Do Not Know

Everything above the level of their immediate assignment.

## Tactics

Stay out of sight at tracking distance. Use terrain. Use road traffic as cover. If discovered, break off and relay the information that cover was broken. Do not fight to hold a position. The goal is information relay, not engagement.

## Escalation Levels

**Low** — Ambient signs. A rider who stopped when the party stopped. Hoofbeats at a consistent distance.

**Medium** — The party realises the road ahead has been pre-positioned. Someone knew they were coming. The scouts are behind them.

**High** — Active pursuit identified. Two scouts behind, a relay rider ahead. The party is in the middle of a functioning relay system.

## Mechanical Base

No canon stat block. Use `npc-bases/srd-2014/scout` as primary base. `npc-bases/srd-2014/spy` for a more capable operative.

A minimal pursuit scout unit: two scouts (tracking) and one relay rider (mounted, faster). If the relay rider is intercepted, position information stops moving forward.

## Karsac Adaptation Notes

The tactical reward for engaging pursuit scouts is clean roads ahead. Design it so the players can perceive this reward — a checkpoint that is notably absent, a road agent who is visibly surprised by the party's approach rather than prepared. Make the difference legible.

## Player-Safe Use

Players may perceive: ambient signs of being followed, the pre-positioned checkpoint that implies advance knowledge, a relay rider breaking away from a ridge. Players must not be told the full scope of the tracking network or its reporting chain.

## Canon Status

**Provisional.** The road threat is implied by Ch2 warnings. Pursuit scouts as a named type are an extrapolation to support Chapter 3 road encounter design.
