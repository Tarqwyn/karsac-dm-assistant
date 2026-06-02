---
id: proposals/veilstrider
proposal_type: adversary
title: Veilstrider
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T15:33:09.862Z'
source_prompt: 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara. Include modular traits and actions. Treat this as provisional planning material'
route_profile: adversary-design
validation:
  status: fail
  issues:
  - 'Invalid 5e skill pairing: "Charisma (Deception or Persuasion)" uses non-standard skill "Deception or Persuasion". Use a standard 5e skill unless a campaign skill is explicitly registered.'
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
summary: Veilstrider
---

# Adversary: Veilstrider

## Design Intent
This adversary is a Shadow Walker operative specializing in urban infiltration and subtle manipulation. They are designed to blend seamlessly into Karsac cities and towns, gathering information and subtly influencing events without drawing direct attention. Primarily social-led, with a potential for combat if exposed. Threat level: Moderate. Use case: Information gathering, social obstruction, subtle sabotage, and creating opportunities for other Shadow Walker operatives.

## Mechanical Base
Base: monsters/srd-2014/spy
Reason: The Spy’s skillset – stealth, deception, and a focus on information – aligns perfectly with the Veilstrider's role as an urban infiltrator. The base provides a solid foundation for building a character that is both capable and unassuming.

## Adaptation Summary
- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Prepared Cover, Mapped Exits, No Last Stand, Information First
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.

## Tactical Notes  
Their restraint is not mercy; it is discipline. They use violence only to preserve the mission, escape, or prevent exposure. They will **never** engage in combat unless forced, and even then, their actions are calculated to minimize risk. They rely on **Disguise Self**, **False Lead**, and **Whispered Rumor** to manipulate perception, turning the environment into a weapon. Their ultimate goal is to vanish—leaving no trace of their presence, no evidence of their involvement, and no opportunity for the party to trace their actions back to the Shadow Walkers.

## Stat Block

**Veilstrider**
*Medium, Humanoid, Neutral*

**Armour Class** 14 (Leather Armor)
**Hit Points** 33 (6d8 + 6)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 8 (-1) | 16 (+3) | 12 (+1) | 14 (+2) | 10 (+0) | 16 (+3) |

**Saving Throws** Dex +5, Cha +5
**Skills** Acrobatics +5, Deception +5, Insight +2, Investigation +4, Perception +2, Stealth +5
**Damage Resistances** None
**Condition Immunities** None
**Senses** Passive Perception 12
**Languages** Common, Trade Tongue (local), Shadow Walker Sign
**Challenge** 2 (450 XP) · Proficiency Bonus +2

### Traits
**Urban Camouflage:** The Veilstrider has advantage on Dexterity (Stealth) checks made to hide in urban environments.
**Subtle Influence:** The Veilstrider can spend a bonus action to subtly influence a conversation or situation, granting advantage on a single Charisma (Deception or Persuasion) check made before the end of their next turn.
**Prepared Cover.** Veilstrider has advantage on Charisma (Deception) checks made to maintain a prepared civilian identity or pass as an unremarkable worker, clerk, or passerby in the current settlement.
**Mapped Exits.** If Veilstrider has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. During the first round of combat, it can move up to half its speed without provoking opportunity attacks.
**No Last Stand.** Veilstrider does not fight to the death. If reduced below half its hit points, exposed by name, or separated from its cover identity, it attempts to flee, surrender under a false identity, or create a public misdirection.
**Information First.** When Veilstrider is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note, cipher strip, ledger scrap, or marked bone tally.

### Actions
**Dagger:** *Melee Weapon Attack:* +5 to hit, range 5 ft., one target. *Hit:* 4 (1d4 + 1) piercing damage.
**Shortbow:** *Ranged Weapon Attack:* +5 to hit, range 80/320 ft., one target. *Hit:* 6 (1d6 + 1) piercing damage.
**Disguise Self:** (1 minute) The Veilstrider can use an action to magically transform their appearance.

### Bonus Actions
None

### Reactions
**Evasive Manoeuvre:** When a creature misses the Veilstrider with an attack, the Veilstrider can move up to half its speed without provoking opportunity attacks.
**Crowd Break.** When Veilstrider is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Variant Options
**Choose 2 traits from:**
* **Local Knowledge:** The adversary has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement.
* **Keen Eye:** The adversary has advantage on Wisdom (Perception) checks to notice subtle details and hidden objects.
* **Network Contact:** The adversary can spend a bonus action to contact a local informant for information.
* **Quick Study:** The adversary can learn a simple skill or trade secret with a short period of observation.

**Choose 1 signature action from:**
* **False Lead:** One creature the adversary can speak to within 30 feet must succeed on a DC 13 Wisdom (Insight) check or pursue a planted false lead until the end of its next turn.
* **Whispered Rumor:** The Veilstrider can spread a false rumor within a 30-foot radius. Creatures who hear the rumor must succeed on a DC 12 Wisdom (Insight) check or believe it to be true.
* **Distraction:** The Veilstrider can create a minor distraction (a dropped item, a sudden noise) within 30 feet, granting advantage on a Dexterity (Stealth) check for themselves or an ally.

**Choose 1 reaction from:**
* **Swift Retreat:** When reduced to half their maximum hit points, the Veilstrider can use their reaction to Disengage and move up to half their speed without provoking opportunity attacks.
* **Counter-Deception:** When a creature attempts to deceive the Veilstrider, the Veilstrider can use their reaction to impose disadvantage on the creature’s Deception check.

## Tactics
The Veilstrider prioritizes observation and information gathering. They will attempt to blend into crowds, eavesdrop on conversations, and gather intelligence on potential targets. If confronted, they will attempt to use deception and misdirection to escape. Direct combat is a last resort. They will prioritize escape and denying information over engaging in prolonged fights.

## Doctrine Under Pressure  
On round one of combat, the Veilstrider immediately attempts to **Disengage** and seek cover, using the city’s infrastructure (crowds, stalls, alleyways) to obscure their movements. They prioritize **preserving their cover identity** and will use **Subtle Influence** or **False Lead** to sow confusion among hostile parties. If escape is impossible, they will **prioritize misdirection** over combat, using **Information First** to destroy or pass on critical data before retreating. Under duress, they will never reveal the identities of Shadow Walker allies, the location of hidden caches, or the broader mission’s objectives—even if it means sacrificing their own survival.

## Social / Investigation Use
The Veilstrider’s deception pattern relies on appearing unassuming and helpful. They will ask seemingly innocent questions to extract information and subtly steer conversations towards their desired outcome. They notice inconsistencies in stories and discrepancies between appearances and reality. Players can expose them through successful Insight checks or by contradicting their carefully crafted narratives. They might accidentally reveal information through slips of the tongue or by reacting inappropriately to certain topics.

## Doctrine-Expressive Mechanics
- **Cover Identity / Unremarkable Presence.** Veilstrider stays legible as ordinary city life first, using concealment or a prepared civilian identity to remain forgettable until pressure closes in.
- **Mapped Exits.** Pre-read routes and room geometry let Veilstrider turn round-one pressure into movement instead of paralysis.
- **No Last Stand.** Controlled withdrawal matters more than pride; once exposed or bloodied, Veilstrider chooses escape, false surrender, or public misdirection over dying in place.
- **Crowd Break.** The city itself becomes cover under pressure, turning contact with the party into fresh movement lanes through bodies, stalls, and obstructed sightlines.
- **Information First.** Messages, tallies, and scraps are preserved or denied before retaliation; the mission survives even if the operative does not keep control of the scene.
- **Social Misdirection.** Veilstrider solves pressure socially where possible, using false certainty, harmless pretexts, and shifting public attention before steel becomes the only answer.

## Player-Safe Description  
A seemingly ordinary person—perhaps a merchant, a dockworker, or a local artisan—blends into the bustling city crowd. They observe their surroundings with a quiet intensity, their movements economical and purposeful. There’s a certain precision to their actions, a sense that they’re always aware of their surroundings. They may offer help with a smile, ask questions with feigned curiosity, or linger near conversations as if listening for something specific. Their presence is unremarkable… until it isn’t.

## DM-Only Notes  
This Veilstrider is part of a larger network of Shadow Walker operatives tasked with monitoring a specific region. They are under the direct command of a higher-ranking operative but have limited knowledge of the overarching plan. They are instructed to avoid direct contact with Mathr’s agents and are unaware of the significance of the bone disc symbol. Their mission is strictly localized, and they will not deviate from it—even if it means ignoring broader Shadow Walker directives. If the party uncovers their identity, they will attempt to flee, misdirect, or sacrifice themselves to protect the network.

## Scaling Options
- Weaker version: Reduce hit points and remove the Subtle Influence trait.
- Stronger version: Increase hit points, grant advantage on saving throws, and add the Keen Eye trait.
- Non-combat version: Remove all weapons and attacks, focus solely on social manipulation and information gathering.
- Boss version (if appropriate): Grant the Veilstrider the ability to summon minor Shadow Walker allies and a powerful illusion spell.

## Corpus Frontmatter

```yaml
---
id: adversaries/veilstrider
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, urban-infiltration, faction-agent, shadow-walkers, chapter-3, shadow-walker]
opposition_type: [deceiver, social-obstacle, faction-agent]
encounter_roles: [interrogator, blocker, social-pressure]
campaign_use: [social-obstruction, information-extraction, dock-pressure, chapter-3]
mechanical_base:
  - npc-bases/srd-2014/spy
mechanical_status: homebrew-adaptation
homebrew_adjustments:
  status: provisional
  notes: "Modified Spy to focus on urban infiltration and subtle manipulation, adding traits and signature actions."
can_know:
  - Local customs and trade routes within the city.
  - The identities of several minor merchants and civic officials.
must_not_know:
  - The true purpose of the Shadow Walker operation.
  - The identity of the higher-ranking operative they report to.
tactics:
  - Observe and gather information before engaging.
  - Utilize deception and misdirection to avoid direct confrontation.
  - Prioritize escape and anonymity above all else.
escalation:
  low: "Subtle questioning and observation."
  medium: "Attempting to manipulate conversations and create distractions."
  high: "Disengaging and fleeing if confronted, potentially spreading false information to mislead pursuers."
player_safe_reveal:
  - "A seemingly ordinary person, blending into the city crowd."
  - "They observe their surroundings with a quiet intensity."
dm_only:
  - "Operates under the command of a higher-ranking Shadow Walker."
  - "Unaware of the significance of the bone disc symbol."
related:
  factions: [shadow-walkers]
  places: []
summary: "A Shadow Walker operative specializing in urban infiltration and subtle manipulation, gathering information and influencing events from the shadows."
```

## Doctrine  
The Veilstrider operates under the Shadow Walkers’ principle of *silent observation and controlled withdrawal*. Their primary objective is to gather intelligence without drawing attention, using anonymity as both a tool and a shield. They view direct confrontation as a failure of preparation, and their actions are guided by a strict hierarchy: **preserve the mission**, **protect the network**, and **avoid exposure**. They will manipulate conversations, plant false leads, and exploit urban environments to remain legible as ordinary citizens until pressure forces them into escalation. Their loyalty is to the Shadow Walkers’ operational goals, not to any individual—though they may unknowingly serve larger schemes beyond their comprehension.

## Behavioural Stages  
1. **Observation (Low Pressure):** The Veilstrider blends into crowds, eavesdrops on conversations, and maps the environment. They ask innocuous questions to gather intelligence and test the awareness of those around them.  
2. **Social Manipulation (Medium Pressure):** If approached, they use **Whispered Rumor** or **Social Misdirection** to steer conversations away from sensitive topics. They may feign helpfulness or adopt a false persona to gain trust.  
3. **Escape or Misdirection (High Pressure):** When cornered, they deploy **Crowd Break**, **Evasive Manoeuvre**, or **Swift Retreat** to flee. If capture seems inevitable, they use **Information First** to plant false data or create a diversion, ensuring the mission’s survival even if they are taken.

