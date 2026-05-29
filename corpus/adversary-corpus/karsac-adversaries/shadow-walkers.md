---
id: adversaries/shadow-walkers
type: adversary
visibility: dm-only
canonical: canon
ruleset: dnd-5e-2014
tags: [adversary, shadow-walker, yngondi, chapter-1, chapter-2, ashvein, vishara-linked]
opposition_type: [faction-agent, pursuer]
encounter_roles: [ambusher, pursuer, watcher, pressure, omen]
campaign_use: [early-warning, pursuit, supernatural-pressure, fear, escalation-signal]
mechanical_base:
  - karsac-authored/yngondi-shadow-walker-cr3
  - npc-bases/srd-2014/spy
  - npc-bases/srd-2014/scout
mechanical_status: canon-homebrew
homebrew_adjustments:
  status: canon
  notes: "Full stat block exists in Karsac Chapter 1 appendix. Yngondi Shadow-Walker CR 3 (700 XP each). AC 15, HP 52 (8d8+16), Speed 40 ft./Climb 30 ft. Traits: Wasteland Discipline, Shadow Step (Recharge 5-6), Lone Hunter, Unreadable. Actions: Multiattack (two attacks), Wasteland Blade (+6 melee, 8 slashing), Throwing Spike (+6 ranged, 7 piercing + DC 13 Con or speed reduced). Bonus: Disengage or Dash. Reaction: Wasteland Redirect (halve melee hit, move 10 ft.). Weapons made of Ashvein — same metal as the Truthspeaker's pin."
can_know:
  - immediate orders and current objective
  - target identity
  - current route or location to surveil
  - that they carry a bone disc with a symbol from their oldest tradition
must_not_know:
  - what the bone disc symbol means at its cosmological root
  - that Vishara touched the proto-Yngondi cultures and that this is the origin of the symbol
  - Vishara's identity, purpose, or relationship to Maharuq
  - the full campaign cosmology (Yantravaq, Dhurvaq, the Instruments)
  - that their Ashvein weapons are the same material as the Truthspeaker's pin
  - who ultimately directs their operations beyond their immediate chain
tactics:
  - observe before striking; mission completion over engagement
  - isolate the target; do not create noise
  - strike hard enough to demonstrate quality, not hard enough to slaughter
  - if blocked, punish openings cleanly then reset without pressing advantage
  - retreat once mission is done or compromised (Shadow Step + Dash = 70+ ft. per round)
  - self-kill only if both are down and capture is certain; quick, clinical, no drama
escalation:
  low: "Watchers at a distance. A figure on a rooftop. A sense of being followed. Bone disc found afterward."
  medium: "Controlled ambush. They punish an opening, reset, apply pressure without escalating to slaughter."
  high: "Coordinated mission assault. True danger only if cornered or if a companion has fallen. Retreat trigger: mission done or compromised."
player_safe_reveal:
  - "They are professionals from somewhere far to the east, dressed for a climate that is not here."
  - "They move with absolute economy. Nothing wasted, nothing performed."
  - "They do not speak. They assess."
  - "Their restraint is not mercy. It is discipline."
  - "Their weapons are a dark reddish-black metal that does not reflect light normally."
  - "One carries a bone disc with a symbol nobody on Halvash has seen before."
  - "They are connected to a larger operation. They did not come alone."
dm_only:
  - "Shadow Walkers are operationally linked to Mathr's network and ultimately to Vishara's operational reach."
  - "The bone disc symbol is Vishara's — taken from the proto-Yngondi encounter in the earliest age of Karsac. The Shadow-Walkers carry it because their tradition carries it. They do not know what it is."
  - "Their Ashvein weapons connect them materially to the Truthspeaker's pin. The players may notice this if Korvann/Xyrrath are paying attention."
  - "They arrived on Halvash on a vessel called the White Hawk, registered as a training vessel. The ship's behaviour was not conventional."
  - "Floki the sage identified the bone disc symbol as impossible — from the oldest stratum of Karsac oral tradition."
related:
  factions:
    - id: factions/shadow-walkers
    - id: factions/house-mathr
  events:
    - id: events/halvash-alley-fight
  places:
    - id: places/halvash
candidate_links:
  places:
    - id: places/valweg-road
      confidence: high
      reason: "Road to Valweg is stated as unsafe in Ch2 closing. Shadow Walkers are the most capable pursuit threat in canon."
      status: suggested
    - id: places/yngondi-wastes
      confidence: high
      reason: "Sourcebook states the bone disc symbol will appear again in the Yngondi Wastes. Shadow Walkers trace their roots to proto-Yngondi cultures."
      status: suggested
summary: "Yngondi professional operatives used as Mathr's most capable field agents. Canonical in Chapter 1. Recurring pursuit and pressure threat. Carry Ashvein weapons and a bone disc symbol they do not understand. Their restraint is discipline, not mercy."
---

# Shadow Walkers

## Adversary Summary

Yngondi professional operatives from the far east of the continent. First encountered in the Halvash alley in Chapter 1, where they were sent to silence a thief carrying information about the scroll case. They are Mathr's highest-capability field agents — disciplined, lethal, and deeply disinclined to create noise. They are human. They are not supernatural in themselves, but their methods and their history carry traces of something that is.

## Campaign Purpose

Shadow Walkers establish that the party's opposition has reach, resource, and operational discipline far beyond a local criminal network. They are the signal that whatever is happening in Lösweg has connections that extend east, beyond the known edges of the players' world. They are also the first physical evidence of the Vishara-linked symbol — the bone disc they carry connects them, unknowingly, to the deepest layer of the campaign's hidden cosmology.

## What They Are

Professionals trained in a Yngondi wasteland tradition. They operate in small teams, prioritise mission completion over combat, and withdraw cleanly when objectives are met or compromised. They dress for a desert climate regardless of where they are deployed. They do not explain themselves. They do not negotiate. They are not cruel — cruelty creates noise.

## What They Know

They know their immediate orders and target. They know the identity of the person who contracted them in their current operation. They know the symbol on the bone disc is significant to their tradition, but only that — they carry it because their tradition carries it.

## What They Do Not Know

They do not know that the bone disc symbol is Vishara's own mark, taken from an encounter with their proto-Yngondi ancestors in the earliest age of Karsac. They do not know that their Ashvein weapons are made of the same material as the Truthspeaker's pin. They do not know the cosmological architecture of the campaign or Vishara's purpose.

## Tactics

They are not here to win a fight. They are here to solve a problem without becoming one.

Run in three stages. Stage one: reach the objective without engaging. If the target can be reached without involving the party, they will take that path every time. Stage two: if blocked, one Shadow Walker punishes an opening cleanly, then resets. The party feels the ceiling without hitting it. Stage three: true danger — only if cornered or a companion has fallen. Retreat trigger is mission completion or mission failure. Shadow Step plus Dash gives them 70+ feet per round. They do not pursue beyond utility.

## Escalation Levels

**Low** — Omen and watcher. A figure on a distant rooftop. Someone who was there and is now gone. A bone disc found at a scene. The sense of being studied rather than threatened.

**Medium** — Controlled ambush. One punishing strike to demonstrate quality, then a reset. They want the party to understand the ceiling, not to break it.

**High** — Mission assault. Two Shadow Walkers operating in coordination, exploiting Lone Hunter advantage, using Shadow Step to control positioning. This is the Halvash encounter mode. They accept the risk of one falling to complete the mission.

## Mechanical Base

**Karsac canon stat block** — Yngondi Shadow-Walker, CR 3 (700 XP each). Fully authored in Chapter 1 appendix. Use that block directly; do not substitute an SRD base.

Supporting SRD reference if needed for reskin or variant: `npc-bases/srd-2014/spy`, `npc-bases/srd-2014/scout`.

## Karsac Adaptation Notes

No adaptation needed. The canon stat block is complete and fully playable. Key mechanical identity: Shadow Step (Recharge 5-6) for positioning control; Lone Hunter for isolated target pressure; Unreadable to resist social reads; Wasteland Redirect to survive being caught. Do not strip these traits — they define the encounter feel.

## Player-Safe Use

Players may perceive: eastern origin, extreme professionalism, economy of movement, silence, dark-metal weapons that reflect light strangely, a bone disc with an unfamiliar symbol. Players may perceive that these figures are connected to something larger. Players must not be told what that something is.

## Canon Status

**Canon.** Shadow Walkers appear in Chapter 1 final, Chapter 2 BETA, and the Karsac Sourcebook. Stat block, tactical philosophy, bone disc detail, Ashvein weapon connection, and Vishara link are all explicitly documented.
