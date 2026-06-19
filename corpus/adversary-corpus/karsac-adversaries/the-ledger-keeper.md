---
id: proposals/the-ledger-keeper
proposal_type: adversary
title: The Ledger-Keeper
status: promoted
canonical: provisional
visibility: dm-only
created_at: '2026-06-18T17:07:52.902Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-18T15:48:31.553Z'
corpus_named: null
corpus_anchor_entity: null
corpus_stub_level: null
corpus_coverage_level: null
corpus_policy_id: null
source_prompt: >-
  Propose an adversary generic guard for combat fallback  as described here
  /mnt/e/Wierd
  Projects/karsac-dm-assistant/corpus/proposals/encounters/the-market-inspection.proposed.md
route_profile: adversary-design
validation:
  status: warning
  issues:
    - >-
      WARN: Doctrine not mechanically supported under pressure: adversary claims
      to escape/misdirect when exposed but lacks reliable mechanics against a
      combat-optimised party.
    - >-
      WARN: Language not in whitelist: "ability scores" is not in the canonical
      language set.
repair_log:
  pruned_sections:
    - field: corpus_frontmatter
      reason: metadata_replaced
      policy: proposal-type-contract#adversary
  auto_repairs: []
  false_positives_suppressed: []
related:
  chapters:
    - chapter-3
  sessions: []
  factions:
    - house-mathr
    - torweg-council
  places:
    - torweg
    - torweg/south-dock
    - torweg/market
  npcs:
    - aldric-vane
    - the-truthspeaker
    - brynja-thorgrimsdotter
  items:
    - brynjas-ledger
    - aldric-letter
    - mathr-token
  scenes:
    - scene-4
  adversaries:
    - captain-brynn-stonehand
    - elara-vyn
  threads:
    - vane-token-mathr
    - operation-mathr
    - brynja-record
  events:
    - brynjas-briefing
    - south-dock-confrontation
promote_target: corpus/adversary-corpus/karsac-adversaries
summary: The Ledger-Keeper
promoted_from: corpus/proposals/adversaries/the-ledger-keeper.proposed.md
promoted_at: '2026-06-18T18:27:38.697Z'
---

# Adversary: The Ledger-Keeper

## Design Intent

A combat fallback for market inspections and minor confrontations, operating as a visible arm of Jarl Mathr's authority. Primarily social-led, designed to extract information and delay investigation, escalating to combat only when cornered or if a superior directs it. This adversary reinforces the sense of Mathr's pervasive control and the subtle reorientation of individuals within Torweg.

## Mechanical Base

Base: monsters/srd-2014/guard — Guard
Reason: Provides a baseline for a physically capable individual with a degree of authority, allowing for adaptation to reflect the subtle corruption and influence of Jarl Mathr.

## Adaptation Summary

- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Keen Observer, Longsword, Shield Bash, Investigate
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.

## Stat Block

**The Ledger-Keeper**
*Medium, Humanoid (Human), Lawful Neutral*

**Armour Class** 16 (Scale Mail)
**Hit Points** 39 (6d8 + 12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 13 (+1) | 10 (+0) | 14 (+2) | 15 (+2) | 13 (+1) | 11 (+0) |

**Saving Throws** Wis +3
**Skills** Investigation +5, Insight +3, Perception +3
**Damage Resistances** Bludgeoning, Piercing, Slashing from nonmagical attacks
**Condition Immunities** Charmed
**Senses** Passive Perception 13
**Languages** Common, Lösweg Sign
**Challenge** 2 (450 XP) · Proficiency Bonus +2

### Traits
**Keen Observer:** The Ledger-Keeper has advantage on Wisdom (Insight) checks to determine if someone is being deceptive.

### Actions
**Longsword:** *Melee Weapon Attack:* +3 to hit, reach 5 ft., one target. *Hit:* 6 (1d8 + 1) slashing damage.
**Shield Bash:** *Melee Weapon Attack:* +3 to hit, reach 5 ft., one target. *Hit:* 1d4 bludgeoning damage. The target must succeed on a DC 12 Strength saving throw or be pushed 5 feet away from the Ledger-Keeper.
**Investigate:** The Ledger-Keeper spends 1 minute meticulously examining a small area (up to a 10-foot square) for clues, traps, or hidden objects. They gain advantage on Investigation checks made during that minute.

### Bonus Actions
None

### Reactions
None

## Tactics

The Ledger-Keeper’s opening move is to appear as an official conducting a routine inspection. They prioritize gathering information and delaying the party's progress. They use the "Investigate" action frequently to appear thorough and observant. If confronted aggressively, they attempt to intimidate with the Shield Bash, then retreat to alert nearby guards or Mathr's agents. They avoid direct combat if possible, preferring to stall and report back.

## Doctrine Under Pressure

When combat inevitability looms, the Ledger-Keeper’s priority shifts from information-gathering to survival. On their first turn, they use *Shield Bash* to create distance, then immediately attempt to flee toward the nearest covered area (e.g., a stall, corridor, or shadowed alcove). If fleeing is impossible, they use their *Investigate* action to scan for escape routes or potential allies (e.g., other guards). They will never attempt to grapple, restrain, or otherwise engage in direct combat unless forced. Even when cornered, they will shout for backup rather than fight, their voice carrying the clipped, formal tone of someone who has been trained to avoid conflict at all costs.

## Social / Investigation Use

The Ledger-Keeper asks pointed questions about the party's business and origins. They meticulously record details in a ledger, often exaggerating their importance. They notice inconsistencies in stories and attempt to subtly pressure individuals into revealing more information. They can be exposed through inconsistencies in their records or by demonstrating knowledge of Mathr’s unusual longevity. They will accidentally reveal the presence of "observers" in the area if pressed too hard.

## Player-Safe Description

A stern-looking man in well-maintained scale mail stands before you, meticulously examining cargo manifests with a practiced eye. His ledger is filled with neat, precise script, and his longsword hangs at his side as if ready for a fight—but his posture suggests he’d rather avoid one. His voice is calm but firm as he demands to see your permits, his gaze lingering on your belongings with the sharpness of someone who has seen too many smugglers try to pass through Torweg’s gates.

## DM-Only Notes

The Ledger-Keeper’s subtle influence by Vishara manifests in small, almost imperceptible ways: a flicker of hesitation when mentioning Mathr’s age, a slight stiffness in their posture that suggests they are not entirely in control of their own actions. They are loyal to Mathr but believe his longevity is due to “discipline and good genes,” unaware of Vishara’s role. They must never mention Vishara’s name, the Pryzi Mountain vault, or the true nature of Mathr’s immortality. If a player presses too hard, the Ledger-Keeper may stumble slightly over their words or glance toward the shadows as if expecting someone—or something—to appear.

## Scaling Options

- Weaker version: Reduce Hit Points to 30 and lower AC to 14.
- Stronger version: Increase Hit Points to 60, give them proficiency in Persuasion, and grant them a minor magical ability (e.g., *Detect Thoughts* once per day).
- Non-combat version: Remove the longsword and shield, and focus entirely on social interaction and investigation. Give them advantage on Persuasion checks when interacting with those who respect authority.

## Doctrine

The Ledger-Keeper operates under the principle that information is the most valuable currency in Torweg. Their doctrine is to extract, delay, and report—never to fight unless absolutely necessary. They protect Jarl Mathr’s interests by ensuring no unregistered transaction or suspicious individual passes through Torweg’s markets unchecked. They will retreat when overwhelmed, feign ignorance when questioned too aggressively, and never betray Mathr’s operations, even under duress. Their mechanical traits—*Investigate*, *Shield Bash*, and damage resistances—reflect this doctrine: they are not here to die, but to observe, record, and escape.

## Behavioural Stages

**Stage 1: Inspection**  
The Ledger-Keeper begins by asserting authority, using *Investigate* to scrutinize the party’s belongings and asking pointed questions about their business. They take meticulous notes in their ledger, often pausing to compare their findings with prior entries. If the party cooperates, they may grant limited passage but demand a bribe or promise of future compliance.  

**Stage 2: Escalation**  
If the party refuses to cooperate or becomes aggressive, the Ledger-Keeper uses *Shield Bash* to push back, then shouts for assistance. They may attempt to intimidate with a threat of reporting the party to Mathr’s agents, leveraging their position as a local authority figure.  

**Stage 3: Retreat**  
If combat begins, the Ledger-Keeper immediately attempts to flee, using their high AC and damage resistances to survive as long as possible. They will not use *Investigate* in combat unless it helps them locate an escape route. Their goal is to live long enough to send a report to Mathr, ensuring their own survival takes precedence over any mission objective.

## Tactical Notes

The Ledger-Keeper’s tactics are designed to frustrate rather than defeat. They use *Investigate* to gather environmental cues (e.g., hidden passages, nearby guards) and *Shield Bash* to create space for escape. Their damage resistances and high AC make them durable in combat, but they will not engage in prolonged fighting. They are most effective when paired with other guards or Mathr’s agents, who can follow up on their reports. The Ledger-Keeper’s refusal to use magic or engage in direct combat reinforces their role as a social obstacle, not a frontline fighter.
