---
id: proposals/road-reapers
proposal_type: adversary
title: Road Reapers
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T18:06:38.669Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-02T17:41:55.800Z'
source_prompt: |-
  Propose a new adversary: a deniable road ambush unit operating on the Valweg road on behalf of Jarl Mathr.
  Context:
  - These are not Shadow Walkers. Shadow Walkers are high-capability Yngondi operatives — precise, disciplined, expensive. These are local hired muscle: disgraced housecarls, dismissed soldiers, men who owe Mathr a debt or fear him enough.
  - Their job is to stop specific travellers from reaching Valweg — quietly if possible, not quietly if necessary
  - They do not know who Mathr is at a cosmological level. They know he pays and that you do not ask questions.
  - Mathr's preference is deniability: no house tokens, no identifiable weapons, an ambush that reads as a road robbery
  - Lösweg cultural context: housecarl tradition, honour codes — these men have broken those codes somehow and that matters to how they carry themselves
  Mechanical base: Thug (SRD 2014)
  Faction: House Mathr (deniable asset — not official)
  Use Spy as secondary reference for the unit leader variant only
  Required elements:
  - Stat block with modular traits (2 options)
  - Doctrine: what they will and won't do, and why
  - Behavioural stages (3)
  - can_know / must_not_know
  - player_safe_reveal
  - dm_only notes including: what they carry that could identify Mathr's involvement (or not), and what breaks their discipline
  Treat as provisional planning material.
route_profile: adversary-design
validation:
  status: fail
  issues:
  - 'Forbidden faction affiliation: "mathr" appears as an active affiliation in Design Intent, DM-Only Notes, or Corpus Frontmatter. The locked faction is "yngondi" — do not link to forbidden factions.'
  - 'Faction not in DM-Only Notes: "Yngondi" is in related.factions but ## DM-Only Notes does not explicitly mention the faction affiliation.'
related:
  chapters: []
  sessions: []
  factions:
  - yngondi
  places: []
  npcs: []
  items: []
promote_target: corpus/adversary-corpus/karsac-adversaries
summary: Road Reapers
---

# Adversary: Road Reapers

## Design Intent
This adversary represents a low-to-mid-tier threat designed to impede travel and extract information on behalf of Jarl Mathr. They are primarily combat-led, but their social manipulation and intimidation tactics are crucial to their effectiveness. Their use case is to delay or prevent specific travellers from reaching Valweg, operating with plausible deniability as a common road robbery. They are intended to be a recurring obstacle, not a major boss fight.

## Mechanical Base
Base: monsters/srd-2014/thug
Reason: The Thug provides a solid baseline for a low-level, brutal combatant with a focus on intimidation and opportunistic attacks. It aligns with the concept of disgraced or desperate individuals willing to engage in violence for a price.

## Adaptation Summary
- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Broken Code, Shortsword, Javelin, False Lead (Signature Action)
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.
## Stat Block

**Road Reaper**
*Medium, Humanoid, Chaotic Neutral*

**Armour Class** 11 (Leather Armour)
**Hit Points** 32 (5d8 + 10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 14 (+2) | 11 (+0) | 14 (+2) | 8 (-1) | 10 (+0) | 9 (-1) |

**Saving Throws** Strength +4, Constitution +4
**Skills** Intimidation +1, Athletics +4
**Damage Resistances** None
**Condition Immunities** None
**Senses** Passive Perception 10
**Languages** Common, Lösweg Trade Tongue
**Challenge** 1 (200 XP) · Proficiency Bonus +2

### Traits
**Broken Code:** The Road Reaper is a disgraced individual who has violated Lösweg honour codes. They are easily unnerved by displays of genuine honour or righteousness. They have disadvantage on saving throws against effects that impose the frightened condition from a source displaying clear moral integrity.

### Actions
**Shortsword:** *Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.
**Javelin:** *Ranged Weapon Attack:* +4 to hit, range 30/120 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.
**False Lead (Signature Action):** The Road Reaper attempts to sow discord and confusion. One creature the Reaper can see within 30 feet must succeed on a DC 11 Wisdom (Insight) check or pursue a planted false lead (a dropped item, a misleading shout) until the end of its next turn.

### Bonus Actions
None

### Reactions
**Evasive Manoeuvre:** When a creature misses the Road Reaper with an attack, the Reaper can use its reaction to move up to half its speed without provoking opportunity attacks.

## Variant Options
**Choose 2 traits from:**
**Local Knowledge.** The adversary has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement.
* **Brutal Efficiency:** The adversary gains advantage on attack rolls against creatures that are prone or incapacitated.
* **Harsh Terrain:** The adversary has advantage on Dexterity (Stealth) checks made while in rough terrain.
* **Intimidation Focus:** The adversary has advantage on Intimidation checks.

**Choose 1 signature action from:**
* **Distraction:** The Road Reaper throws a handful of gravel or dirt at a creature within 15 feet. The creature must succeed on a DC 10 Wisdom saving throw or be distracted, having disadvantage on its next attack roll.
* **False Accusation:** The Road Reaper loudly accuses a creature within 30 feet of a crime, attempting to draw attention and create social pressure. The target must succeed on a DC 11 Charisma (Persuasion) check or be temporarily hindered by the attention.

**Choose 1 reaction from:**
* **Opportunistic Strike:** When a creature within 5 feet of the Road Reaper attacks a different creature, the Reaper can make a melee attack against the first creature as a reaction.

## Tactics
The Road Reapers prefer to ambush travellers from concealed positions along the road, using the terrain to their advantage. They prioritize capturing valuables and extracting information about the travellers’ destination and purpose. They will attempt to intimidate travellers into compliance, but will resort to violence if necessary. They avoid prolonged fights and prioritize escape if the situation turns against them. They will attempt to create the impression of a random road robbery.

## Doctrine Under Pressure  
When combat escalates, the Road Reapers prioritize **targeting weak links** (injured, elderly, or non-combatants) to destabilize the group. They use terrain (e.g., forcing travelers into narrow paths) to amplify their numbers and create bottlenecks. If cornered, they will **sacrifice one or two members** to buy time for the rest to escape, leaving behind false clues (e.g., dropped tokens or misleading stories). They will **never** acknowledge Mathr’s name, even under duress, and will instead blame “a local lord’s men” or “bandits with a grudge.”

## Social / Investigation Use
The Road Reapers use a combination of threats and false authority to extract information. They will ask seemingly innocuous questions about the travellers’ cargo and destination. They are easily flustered by displays of genuine honour or righteousness, and may inadvertently reveal clues about their operation if pressed. Their documents will bear the Mathr sigil, a subtle but crucial clue for observant investigators.

## Player-Safe Description  
A group of rough-looking men blocks the road ahead. They are armed with swords and javelins, and their faces are grim. They appear to be common bandits, but something about their demeanor feels… off. Their clothes are worn, but their movements are practiced, and they seem overly eager to control the situation. One of them fidgets with a pouch at their belt, glancing nervously at the others whenever questioned.

## DM-Only Notes  
The Road Reapers carry unmarked leather pouches containing a few silver coins and a small, crudely carved wooden token depicting a stylized raven—a subtle identifier of Mathr’s patronage. This token is hidden and only visible upon close inspection. Their discipline breaks down when confronted with displays of unwavering honour or righteousness, or when questioned about their connection to a higher authority. They are paid a small sum and are terrified of Mathr, but do not know his full identity or purpose. They believe they are simply enforcing his will. If a traveler mentions “a lord with a raven symbol” or “a man who pays in silver,” the Reapers may panic, revealing fragments of their mission before fleeing.

## Scaling Options
- Weaker version: Reduce Hit Points to 22 (4d8 + 8). Remove the Broken Code trait.
- Stronger version: Increase Hit Points to 44 (6d8 + 18). Give them the Brutal Efficiency trait.
- Non-combat version: Remove all weapons and combat actions. Focus solely on intimidation and social manipulation.
- Boss version: Replace with a single, more experienced Road Captain with enhanced skills and a small retinue of Road Reapers.

## Corpus Frontmatter

```yaml
---
id: adversaries/road-reapers
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, road-ambush, faction-agent, valweg, chapter-X, yngondi]
opposition_type: [faction-agent, social-obstacle, combatant]
encounter_roles: [blocker, combatant, social-pressure]
campaign_use: [dock-pressure, information-extraction, social-obstruction]
mechanical_base:
  - npc-bases/srd-2014/thug
mechanical_status: homebrew-adaptation
homebrew_adjustments:
  status: provisional
  notes: "Modified thug to represent deniable road ambush unit for House Mathr. Added Broken Code trait and signature action."
can_know:
  - They are paid by a local Jarl.
  - They are to stop specific travellers.
must_not_know:
  - The Jarl's full identity or purpose.
  - The broader implications of their actions.
tactics:
  - Ambush travellers from concealed positions.
  - Prioritize capturing valuables and extracting information.
  - Attempt to create the impression of a random road robbery.
escalation:
  low: "Attempt intimidation and social pressure."
  medium: "Resort to violence if travellers resist."
  high: "Create diversion and attempt escape if overwhelmed."
player_safe_reveal:
  - A group of rough-looking men blocks the road.
  - They are armed and appear to be common bandits.
  - Something about their demeanor feels off.
dm_only:
  - Carry unmarked pouches with a raven token identifying Mathr's patronage.
  - Discipline breaks down with displays of honour or righteousness.
related:
  factions: [house-mathr, yngondi]
  places: [valweg-road]
summary: "Road Reapers are a deniable road ambush unit employed by Jarl Mathr to delay travellers and extract information."
```

## Doctrine  
The Road Reapers operate under a strict mandate: to intercept specific travelers and extract information without revealing their connection to Jarl Mathr. They are not warriors, but enforcers—hired muscle bound by fear and meager pay. Their doctrine centers on **deniability** (avoiding direct ties to Mathr), **efficiency** (capturing valuables and information quickly), and **impression management** (mimicking common bandits to avoid suspicion). They will not engage in prolonged combat, will not reveal Mathr’s identity, and will flee if overwhelmed. Their broken honor codes (from past failures in Lösweg society) fuel a desperation to prove themselves, making them unpredictable in moments of crisis.

## Behavioural Stages  
1. **Intimidation Phase**: The Reapers begin with verbal threats and displays of force, attempting to cow travelers into compliance. They ask vague questions about cargo, destination, and “who sends you.”  
2. **Escalation Phase**: If resistance is met, they deploy signature actions (e.g., throwing gravel to disrupt attacks, creating diversions). They may feign hesitation or confusion to mask their coordination.  
3. **Breakdown Phase**: When overwhelmed, they abandon discipline entirely—some may flee immediately, while others fight recklessly, screaming about “the lord’s wrath” or “paying the price for defiance.”

## Tactical Notes  
The Road Reapers are **ambush specialists**, using terrain (e.g., dense undergrowth, ravines) to conceal themselves until the last moment. They favor **hit-and-run tactics**, targeting valuables or key individuals (e.g., merchants, scribes) before vanishing. In social encounters, they rely on **nervousness and inconsistency**—their fear of Mathr causes them to contradict themselves or grow flustered when pressed about their employer. They will **never** accept a bribe large enough to buy their silence, as doing so would risk Mathr’s wrath.

