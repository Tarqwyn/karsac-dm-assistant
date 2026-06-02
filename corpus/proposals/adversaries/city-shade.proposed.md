---
id: proposals/city-shade
proposal_type: adversary
title: City Shade
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T16:06:53.680Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-02T15:48:30.479Z'
source_prompt: 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara. Include modular traits and actions. Treat this as provisional planning material'
route_profile: adversary-design
validation:
  status: fail
  issues:
  - 'Faction missing from related.factions: prompt requests "Shadow Walkers" but Corpus Frontmatter factions field does not contain "shadow-walkers". Add: related:\n  factions: [shadow-walkers]'
  - 'Faction profile cover-identity mismatch: Shadow Walkers urban cover identities should not use obvious weapon "shortbow" unless the prompt explicitly requests it or frontmatter overrides it with a reason.'
  - Variant options must be concrete mechanics, not names only.
related:
  chapters: []
  sessions: []
  factions:
  - shadow-walkers
  places: []
  npcs: []
  items: []
promote_target: corpus/adversary-corpus/karsac-adversaries
summary: City Shade
---

# Adversary: City Shade

## Design Intent
This adversary is a Shadow Walker operative specifically designed for infiltration and subtle manipulation within Karsac cities and towns. They are not directly tied to Mathr or Vishara, operating as a more independent cell within the Shadow Walkers. Their primary role is to gather intelligence, sow discord, and disrupt local power structures through social manipulation and subtle sabotage, rather than direct combat. This is a hybrid threat – primarily social, but capable of defending themselves if exposed. Threat level: Moderate, leaning towards high if their influence is allowed to grow unchecked. Use case: Urban intrigue, investigation hooks, subtle pressure on player characters, and introducing the wider Shadow Walker network.

## Mechanical Base
Base: monsters/srd-2014/spy
Reason: The Spy's skillset – proficiency in Deception, Stealth, and Perception – aligns perfectly with the City Shade's need to blend in, observe, and manipulate without drawing attention. The Spy’s relatively low combat ability reflects the City Shade’s preference for avoiding direct confrontation.

## Adaptation Summary
- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Urban Camouflage, Subtle Influence, Prepared Cover, Mapped Exits
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.

## Tactical Notes  
Their restraint is not mercy; it is discipline. They use violence only to preserve the mission, escape, or prevent exposure. Their tactics are designed to ensure the Shadow Walkers' long-term goals are achieved, even if the individual operative is compromised. They are highly adaptive, leveraging the urban environment, social dynamics, and prepared identities to remain one step ahead of their pursuers.

## Stat Block

**City Shade**
*Medium humanoid, neutral*

**Armour Class** 13 (Leather Armor)
**Hit Points** 39 (6d8 + 12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 10 (+0) | 14 (+2) | 14 (+2) | 13 (+1) | 12 (+1) | 16 (+3) |

**Saving Throws** Dex +4, Cha +5
**Skills** Deception +7, Insight +3, Investigation +3, Perception +3, Stealth +6
**Damage Resistances** None
**Condition Immunities** None
**Senses** Passive Perception 13
**Languages** Common, Trade Tongue (local), Shadow Walker Sign
**Challenge** 3 ([700 XP]) · Proficiency Bonus +2

### Traits
**Urban Camouflage:** The City Shade has advantage on Dexterity (Stealth) checks made to hide in urban environments.
**Subtle Influence:** The City Shade can attempt to subtly influence the emotions or opinions of creatures they interact with.  At the start of each of their turns, they can choose one creature within 30 feet that they can see and that isn't incapacitated. That creature must succeed on a DC 13 Wisdom saving throw or have disadvantage on the next ability check it makes before the end of the City Shade's next turn.
**Prepared Cover.** City Shade has advantage on Charisma (Deception) checks made to maintain a prepared civilian identity or pass as an unremarkable worker, clerk, or passerby in the current settlement.
**Mapped Exits.** If City Shade has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. During the first round of combat, it can move up to half its speed without provoking opportunity attacks.
**No Last Stand.** City Shade does not fight to the death. If reduced below half its hit points, exposed by name, or separated from its cover identity, it attempts to flee, surrender under a false identity, or create a public misdirection.
**Information First.** When City Shade is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note, cipher strip, ledger scrap, or marked bone tally.

### Actions
**Dagger:** *Melee Weapon Attack:* +4 to hit, range 5 ft., one target. *Hit:* 4 (1d4 + 2) piercing damage.
**Shortbow:** *Ranged Weapon Attack:* +4 to hit, range 80/320 ft., one target. *Hit:* 5 (1d6 + 2) piercing damage.
**False Lead:** *Action:* One creature the adversary can speak to within 30 feet must succeed on a DC 13 Wisdom (Insight) check or pursue a planted false lead until the end of its next turn.

### Bonus Actions
None

### Reactions
**Evasive Manoeuvre:** When a creature misses the adversary with an attack, the adversary can move up to half its speed without provoking opportunity attacks.
**Crowd Break.** When City Shade is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Variant Options
**Choose 2 traits from:**
**Local Knowledge.** The adversary has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement.
* **Network Contact:** The adversary can, once per long rest, send a coded message to another Shadow Walker operative within a 50-mile radius.
* **Master of Disguise:** The adversary gains proficiency with the Disguise Kit and can spend 1 minute to alter their appearance to resemble a different person.
* **Keen Observer:** The adversary has advantage on Wisdom (Insight) checks.

**Choose 1 signature action from:**
* **Whispered Discredit:** *Action:* The adversary attempts to subtly damage the reputation of a target within 30 feet. The target must succeed on a DC 13 Charisma saving throw or suffer disadvantage on Charisma checks made to interact with NPCs for the next hour.
* **Plant Evidence:** *Action:* The adversary attempts to plant a small piece of incriminating evidence on a creature within 30 feet. The target must succeed on a DC 13 Wisdom (Insight) check or be falsely accused of a minor crime.

**Choose 1 reaction from:**
* **Swift Retreat:** When the adversary takes damage, they can use their reaction to move up to half their speed to a safer location.

## Tactics
The City Shade prioritizes observation and information gathering. They begin by blending into the environment, appearing as an ordinary citizen. They target individuals with access to valuable information or influence, subtly manipulating them through conversation and carefully planted suggestions. Direct combat is a last resort; they prefer to escape and report back to their superiors. If exposed, they attempt to discredit their accusers and disappear into the city's underbelly.

## Doctrine Under Pressure  
On round one of combat, the City Shade immediately activates **Mapped Exits** to exploit pre-established escape routes, using **Urban Camouflage** to blend into the environment. They prioritize **Crowd Break** to leverage bystanders or obstacles for cover, creating movement lanes through the chaos. If cornered, they deploy **False Lead** to misdirect the party or trigger **Information First** to preserve critical data before retreating. Their goal is to ensure the mission survives, even if the operative is compromised. They will only engage in direct combat if escape is impossible or if their identity is at risk of being exposed.

## Social / Investigation Use
The City Shade uses carefully crafted questions and subtle body language to extract information. They often pose as a concerned citizen or a curious visitor. They are observant, noticing inconsistencies in stories and discrepancies in behavior. Exposure can occur through inconsistencies in their fabricated background, revealing knowledge they shouldn't possess, or being caught in a contradiction. They might accidentally reveal a coded phrase or gesture associated with the Shadow Walkers.

## Doctrine-Expressive Mechanics
- **Cover Identity / Unremarkable Presence.** City Shade stays legible as ordinary city life first, using concealment or a prepared civilian identity to remain forgettable until pressure closes in.
- **Mapped Exits.** Pre-read routes and room geometry let City Shade turn round-one pressure into movement instead of paralysis.
- **No Last Stand.** Controlled withdrawal matters more than pride; once exposed or bloodied, City Shade chooses escape, false surrender, or public misdirection over dying in place.
- **Crowd Break.** The city itself becomes cover under pressure, turning contact with the party into fresh movement lanes through bodies, stalls, and obstructed sightlines.
- **Information First.** Messages, tallies, and scraps are preserved or denied before retaliation; the mission survives even if the operative does not keep control of the scene.
- **Social Misdirection.** City Shade solves pressure socially where possible, using false certainty, harmless pretexts, and shifting public attention before steel becomes the only answer.

## Player-Safe Description  
This individual seems like a perfectly ordinary resident of the city—a shopkeeper, a clerk, or a messenger. They move with quiet confidence, knowing the city’s streets and alleys like the back of their hand. There’s an unsettling precision to their gaze, as if they’re always watching, always calculating. They speak in measured tones, never too eager, never too hesitant.

## DM-Only Notes  
The City Shade is a pawn in a larger game, unaware of the true extent of the Shadow Walkers’ ambitions. They believe they are working toward a benevolent cause, such as exposing corruption or redistributing power. Their loyalty is to their immediate overseer, not the Shadow Walkers as a whole. They are driven by a desire for purpose and acceptance, making them vulnerable to manipulation by higher-ranking agents. Their network is fragile—exposing one operative risks unraveling the entire web of informants.

## Scaling Options
- Weaker version: Reduce Hit Points to 30, remove Evasive Manoeuvre reaction.
- Stronger version: Increase Hit Points to 60, grant advantage on all Wisdom saving throws.
- Non-combat version: Remove all weapon attacks, increase Charisma to 18 (+4), grant proficiency in Persuasion.
- Boss version (if appropriate): Grant the ability to summon 1d4 lesser Shadow Walker agents.

## Corpus Frontmatter

```yaml
---
id: adversaries/city-shade
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, social-obstacle, shadow-walker, urban, chapter-3]
opposition_type: [deceiver, faction-agent, social-pressure]
encounter_roles: [interrogator, blocker, social-pressure]
campaign_use: [social-obstruction, information-extraction, dock-pressure, chapter-3]
mechanical_base:
  - npc-bases/srd-2014/spy
mechanical_status: homebrew-adaptation
homebrew_adjustments:
  status: provisional
  notes: "Modified Spy base to emphasize social manipulation and urban infiltration. Added traits and actions to reflect Shadow Walker doctrine."
can_know:
  - Local rumors and gossip
  - Names and routines of key NPCs
  - Weaknesses and vulnerabilities of local officials
must_not_know:
  - Vishara's true purpose
  - The origin of the bone disc symbol
tactics:
  - Observe and gather information before acting
  - Target individuals with influence and access to information
  - Avoid direct combat whenever possible
escalation:
  low: "Subtle manipulation and information gathering"
  medium: "Planting false evidence and sowing discord"
  high: "Attempting to discredit targets and disappear"
player_safe_reveal:
  - "Appears to be an ordinary resident of the city."
  - "Moves with a quiet confidence and seems to know their way around."
dm_only:
  - "Part of a larger network of informants."
  - "Believes they are contributing to a benevolent cause."
```

## Doctrine  
The City Shade operates under the Shadow Walkers' doctrine of *subtle influence and calculated retreat*. Their primary objective is to gather intelligence, destabilize local power structures, and create opportunities for Shadow Walker infiltration without direct confrontation. They view themselves as agents of a greater cause, believing their actions serve a benevolent purpose. Their tactics prioritize preservation of the mission over personal survival, using deception, misdirection, and social manipulation to achieve their goals. They avoid violence unless it is necessary to escape, protect their identity, or prevent exposure.

## Behavioural Stages  
1. **Observation and Infiltration** (Pre-Combat): The City Shade blends into the environment, using **Prepared Cover** to assume a civilian identity. They gather intelligence through careful listening, noting inconsistencies in stories, and identifying individuals with access to valuable information.  
2. **Social Manipulation** (Early Combat): If engaged, they use **Subtle Pressure** (via **Subtle Manipulation** trait) to destabilize targets, planting false leads or sowing discord. They avoid direct confrontation, preferring to use **False Lead** or **Whispered Discredit** to create confusion.  
3. **Controlled Retreat** (Late Combat): Once bloodied or exposed, they trigger **No Last Stand**, choosing to flee, surrender under a false identity, or deploy **Information First** to preserve mission-critical data. They may use **Swift Retreat** or **Evasive Manoeuvre** to escape, leaving behind misleading evidence or coded messages.

