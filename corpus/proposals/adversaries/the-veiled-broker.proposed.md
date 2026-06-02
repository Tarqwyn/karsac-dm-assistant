---
id: proposals/the-veiled-broker
proposal_type: adversary
title: The Veiled Broker
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T15:43:29.717Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-02T15:39:45.526Z'
source_prompt: 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara. Include modular traits and actions. Treat this as provisional planning material'
route_profile: adversary-design
validation:
  status: fail
  issues:
  - 'Faction profile cover-identity mismatch: Shadow Walkers urban cover identities should not use obvious weapon "shortbow" unless the prompt explicitly requests it or frontmatter overrides it with a reason.'
  - 'WARN: Faction profile observer floor: Shadow Walkers observer doctrine expects WIS 12+ but the stat block uses 10.'
  - Variant options must be concrete mechanics, not names only.
related:
  chapters: []
  sessions: []
  factions: []
  places: []
  npcs: []
  items: []
promote_target: corpus/adversary-corpus/karsac-adversaries
summary: The Veiled Broker
---

# Adversary: The Veiled Broker

## Design Intent
This adversary is designed to be a subtle, urban infiltrator for the Shadow Walkers, operating within Karsac cities and towns to gather information, subtly influence events, and disrupt operations without drawing overt attention. They are primarily social-led, with a capacity for limited combat, and function as a persistent, low-level threat that can escalate into a more significant problem if exposed. They are not directly linked to Mathr or Vishara, representing a more independent cell within the Shadow Walker organization.

## Mechanical Base
Base: monsters/srd-2014/spy
Reason: The Spy provides a solid foundation for a character who is skilled in deception, stealth, and observation, all crucial for an urban infiltrator. It also offers a baseline combat capability for when subtlety fails.

## Adaptation Summary
- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Prepared Cover, Mapped Exits, No Last Stand, Information First
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.

## Tactical Notes  
Their restraint is not mercy; it is discipline. They use violence only to preserve the mission, escape, or prevent exposure. They prefer ranged attacks (shortbow) to maintain distance, and will use **Quick Study** to adapt to new threats. If cornered, they sacrifice themselves as a distraction, ensuring their mission’s data survives through **Information First**.

## Stat Block

**The Veiled Broker**
*Medium, Humanoid, Neutral*

**Armour Class** 13 (Leather Armor)
**Hit Points** 22 (4d8 + 4)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 10 (+0) | 14 (+2) | 12 (+1) | 14 (+2) | 10 (+0) | 16 (+3) |

**Saving Throws** Dex +4, Cha +5
**Skills** Deception +7, Insight +2, Investigation +4, Persuasion +7, Stealth +4
**Senses** Passive Perception 12
**Languages** Common, Trade Tongue (local), Shadow Walker Sign
**Challenge** 2 (450 XP) · Proficiency Bonus +2

### Traits
* **Urban Camouflage:** The Veiled Broker has advantage on Dexterity (Stealth) checks made to hide in urban environments.
* **Keen Observer:** The Veiled Broker has advantage on Wisdom (Insight) checks.
**Prepared Cover.** The Veiled Broker has advantage on Charisma (Deception) checks made to maintain a prepared civilian identity or pass as an unremarkable worker, clerk, or passerby in the current settlement.
**Mapped Exits.** If the Veiled Broker has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. During the first round of combat, it can move up to half its speed without provoking opportunity attacks.
**No Last Stand.** The Veiled Broker does not fight to the death. If reduced below half its hit points, exposed by name, or separated from its cover identity, it attempts to flee, surrender under a false identity, or create a public misdirection.
**Information First.** When the Veiled Broker is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note, cipher strip, ledger scrap, or marked bone tally.

### Actions
* **Dagger:** *Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 4 (1d4 + 2) piercing damage.
* **Shortbow:** *Ranged Weapon Attack:* +4 to hit, range 80/320 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.

### Bonus Actions
None

### Reactions
* **Evasive Manoeuvre:** When a creature misses the Veiled Broker with an attack, the Veiled Broker can move up to half its speed without provoking opportunity attacks.
**Crowd Break.** When the Veiled Broker is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Variant Options
**Choose 2 traits from:**
* **Local Knowledge:** The adversary has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement.
* **Silver Tongue:** The adversary can re-roll one failed Charisma check per long rest.
* **Contacts:** The adversary knows several individuals within the settlement who can provide information or assistance.
* **Quick Study:** The adversary can learn one new skill proficiency from observing a skilled individual.

**Choose 1 signature action from:**
* **False Lead:** One creature the adversary can speak to within 30 feet must succeed on a DC 13 Wisdom (Insight) check or pursue a planted false lead until the end of its next turn.
* **Subtle Suggestion:** The adversary attempts to subtly influence a creature’s actions. The target must succeed on a DC 13 Wisdom saving throw or be subtly influenced to perform a minor action that benefits the Veiled Broker (e.g., revealing information, distracting a guard).

**Choose 1 reaction from:**
* **Swift Retreat:** When reduced to half its hit points, the Veiled Broker can use its reaction to Disengage and move up to its speed without provoking opportunity attacks.

## Tactics
The Veiled Broker's opening move is to observe and gather information. They prioritize social interaction over combat, attempting to extract information through conversation and subtle manipulation. They prefer to operate at medium range, using their shortbow for defense if necessary. If exposed, their priority is to escape and report back to their superiors, rather than engaging in a prolonged fight. They will attempt to create diversions and use their urban camouflage to evade pursuit.

## Doctrine Under Pressure  
On round one if attacked, the Veiled Broker leverages their **Mapped Exits** to vanish into pre-identified escape routes, using **Crowd Break** to turn bystanders into cover. If cornered, they deploy **Information First**, discarding ledgers or bone tallies to obscure their mission’s purpose before fleeing. They will never fight to the death; instead, they use **Social Misdirection** to shift blame onto innocents or create false trails. Their ultimate goal is to survive, report, and let superiors handle escalation.

## Social / Investigation Use
The Veiled Broker's deception pattern is one of unassuming helpfulness. They ask seemingly innocuous questions, probing for information about local events and key individuals. They notice inconsistencies in stories and discrepancies in documentation. They reveal accidental information through nervous ticks or slips of the tongue when pressed. Props used include ledgers detailing local trade, folded harbor chits, and marked bone tallies indicating drop locations.

## Doctrine-Expressive Mechanics
- **Cover Identity / Unremarkable Presence.** The Veiled Broker stays legible as ordinary city life first, using concealment or a prepared civilian identity to remain forgettable until pressure closes in.
- **Mapped Exits.** Pre-read routes and room geometry let The Veiled Broker turn round-one pressure into movement instead of paralysis.
- **No Last Stand.** Controlled withdrawal matters more than pride; once exposed or bloodied, The Veiled Broker chooses escape, false surrender, or public misdirection over dying in place.
- **Crowd Break.** The city itself becomes cover under pressure, turning contact with the party into fresh movement lanes through bodies, stalls, and obstructed sightlines.
- **Information First.** Messages, tallies, and scraps are preserved or denied before retaliation; the mission survives even if the operative does not keep control of the scene.
- **Social Misdirection.** The Veiled Broker solves pressure socially where possible, using false certainty, harmless pretexts, and shifting public attention before steel becomes the only answer.

## Player-Safe Description  
A seemingly ordinary individual, perhaps a clerk or a merchant’s assistant, with a quiet demeanor and observant eyes. They are always impeccably dressed, though their clothes are unremarkable. They seem eager to assist, but their questions are oddly specific and their gaze lingers a moment too long. A folded harbor chit or a marked bone tally might be found in their pocket, seemingly misplaced.

## DM-Only Notes  
This Veiled Broker is part of an independent Shadow Walker cell operating outside the direct control of Mathr or Vishara. They are tasked with monitoring local political and economic activity, identifying potential threats to the Shadow Walker agenda. They are unaware of Vishara’s connection to the bone disc symbol. Their superiors communicate through coded messages hidden in ledgers or bone tallies. If captured, they will sacrifice their own survival to ensure their mission’s data reaches their cell.

## Scaling Options
- Weaker version: Reduce hit points to 16 (3d8 + 3), remove Keen Observer trait.
- Stronger version: Increase hit points to 32 (6d8 + 6), grant proficiency in Investigation, add the Silver Tongue trait.
- Non-combat version: Remove Dagger and Shortbow actions, replace with proficiency in Persuasion and Insight, grant the Contacts trait.
- Boss version: Increase hit points to 45 (8d8 + 8), grant proficiency in multiple skills, add the ability to summon lesser Shadow Walker agents.

## Corpus Frontmatter
```yaml
---
id: adversaries/veiled-broker
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, urban-infiltrator, faction-agent, shadow-walkers, chapter-3, shadow-walker]
opposition_type: [deceiver, social-obstacle, faction-agent]
encounter_roles: [interrogator, blocker, social-pressure]
campaign_use: [social-obstruction, information-extraction, dock-pressure, chapter-3]
mechanical_base:
  - npc-bases/srd-2014/spy
mechanical_status: homebrew-adaptation
homebrew_adjustments:
  status: provisional
  notes: "Modified Spy to focus on social infiltration and subtle manipulation within urban environments."
can_know:
  - Local political and economic conditions
  - Key individuals within the settlement
  - The existence of other Shadow Walker cells
must_not_know:
  - Vishara's identity or purpose
  - The origin of the bone disc symbol
tactics:
  - Observe and gather information before engaging.
  - Prioritize social interaction and subtle manipulation.
  - Evade combat and escape if exposed.
escalation:
  low: "Attempt to extract information through casual conversation."
  medium: "Employ Subtle Suggestion to influence a target's actions."
  high: "Send a coded message to superiors and attempt a swift retreat."
player_safe_reveal:
  - "A seemingly ordinary individual with a quiet demeanor."
  - "Their questions are oddly specific and their gaze lingers a moment too long."
dm_only:
  - "This broker is part of an independent Shadow Walker cell."
  - "They are unaware of Vishara's connection to the bone disc."
related:
  factions: [shadow-walkers]
  places: []
summary: "A subtle urban infiltrator for the Shadow Walkers, gathering information and subtly influencing events."
---
```

## Doctrine  
The Veiled Broker operates under the principle of *controlled visibility*: they exist as a fixture of everyday life until pressure forces them to act. Their primary mission is information acquisition and dissemination, not direct confrontation. They protect their faction’s interests through secrecy, misdirection, and the preservation of their own survival. When threatened, they prioritize escape over resistance, using urban environments as both shield and weapon. Their doctrine is rooted in the Shadow Walkers’ ethos of *subtle influence*—they do not seek to dominate, but to ensure their presence is felt only when it serves the greater agenda.

## Behavioural Stages  
1. **Observation Phase**: Moves through crowds with calculated ease, asking innocuous questions and noting inconsistencies in stories or documents. Uses **Local Knowledge** to identify key figures or vulnerabilities.  
2. **Engagement Phase**: If pressed for information, they employ **Subtle Suggestion** or **False Lead** to manipulate targets. If combat seems inevitable, they use **Evasive Manoeuvre** to retreat while firing their shortbow.  
3. **Escape Phase**: Once bloodied or exposed, they trigger **No Last Stand**, using **Swift Retreat** to disengage and vanish, leaving behind **Information First**-activated props to confuse pursuers.

