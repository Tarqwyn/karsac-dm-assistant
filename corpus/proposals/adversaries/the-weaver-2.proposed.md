---
id: proposals/the-weaver
proposal_type: adversary
title: The Weaver
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T15:55:28.034Z'
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
summary: The Weaver
---

# Adversary: The Weaver

## Design Intent
This adversary is a Shadow Walker operative embedded within Karsac cities and towns, acting as a subtle manipulator and information gatherer. They are not directly tied to Mathr or Vishara, operating with a degree of autonomy within the larger Shadow Walker network. This is primarily a social-led threat, with potential for combat if exposed or when extracting critical information. The Weaver's role is to observe, influence, and subtly disrupt, not to engage in open conflict.

## Mechanical Base
Base: monsters/srd-2014/spy
Reason: The Spy's skillset – stealth, deception, and a focus on information gathering – provides a solid foundation for an urban infiltrator. It allows for a balance of social and combat capabilities, reflecting the Weaver’s potential for both.

## Adaptation Summary
- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Urban Camouflage, Local Knowledge, Keen Observer, Prepared Cover
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.

## Tactical Notes  
Their restraint is not mercy; it is discipline. They use violence only to preserve the mission, escape, or prevent exposure. Combat is a last resort, and they will always seek to turn the environment—crowds, stalls, alleyways—into tools for evasion. Their actions are calculated to ensure the network’s survival, even if it means their own capture or death.

## Stat Block

**The Weaver**
*Medium, Humanoid, Neutral*

**Armour Class** 13 (Leather Armor)
**Hit Points** 39 (6d8 + 12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 10 (+0) | 14 (+2) | 14 (+2) | 12 (+1) | 16 (+3) | 16 (+3) |

**Saving Throws** Dex +4, Wis +5, Cha +5
**Skills** Deception +5, Investigation +3, Perception +5, Insight +5, Stealth +4, Persuasion +5
**Damage Resistances** None
**Condition Immunities** None
**Senses** Passive Perception 15
**Languages** Common, Trade Tongue (local), Shadow Walker Sign
**Challenge** 3 ([700 XP]) · Proficiency Bonus +2

### Traits
**Urban Camouflage:** The Weaver has advantage on Dexterity (Stealth) checks made to hide in urban environments.
**Local Knowledge:** The Weaver has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement.
**Keen Observer:** The Weaver can spend a bonus action to make a Wisdom (Perception) check, noting details about individuals and their surroundings.
**Prepared Cover.** The Weaver has advantage on Charisma (Deception) checks made to maintain a prepared civilian identity or pass as an unremarkable worker, clerk, or passerby in the current settlement.
**Mapped Exits.** If the Weaver has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. During the first round of combat, it can move up to half its speed without provoking opportunity attacks.
**No Last Stand.** The Weaver does not fight to the death. If reduced below half its hit points, exposed by name, or separated from its cover identity, it attempts to flee, surrender under a false identity, or create a public misdirection.
**Information First.** When the Weaver is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note, cipher strip, ledger scrap, or marked bone tally.

### Actions
**Dagger:** *Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 4 (1d4 + 2) piercing damage.
**Shortbow:** *Ranged Weapon Attack:* +4 to hit, range 80/320 ft., one target. *Hit:* 6 (1d6 + 2) piercing damage.
**Subtle Inquiry:** The Weaver makes a Wisdom (Insight) check contested by the target’s Wisdom (Insight) check. On a success, the Weaver gains a vague impression of the target’s current emotional state and immediate intentions.

### Bonus Actions
None

### Reactions
**Evasive Manoeuvre:** When a creature misses the Weaver with an attack, the Weaver can move up to half its speed without provoking opportunity attacks.
**Crowd Break.** When the Weaver is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Variant Options
**Choose 2 traits from:**
* **Silver Tongue:** The Weaver has advantage on Persuasion checks.
* **Network Contact:** The Weaver can use a bonus action to send a brief coded message to a contact within the settlement.
* **Resourceful:** The Weaver can spend a bonus action to acquire a minor item (e.g., a distraction, a small tool) from their surroundings.
* **Shadowed Past:** The Weaver possesses a false identity and backstory, which they can use to manipulate others.

**Choose 1 signature action from:**
**False Lead:** One creature the Weaver can speak to within 30 feet must succeed on a DC 13 Wisdom (Insight) check or pursue a planted false lead until the end of its next turn.
**Whispered Suggestion:** The Weaver can attempt to subtly influence a creature’s actions. The target must succeed on a DC 13 Wisdom saving throw or be compelled to perform a minor action suggested by the Weaver (e.g., visit a specific location, deliver a message).

**Choose 1 reaction from:**
**Swift Retreat:** When reduced to half its hit points, the Weaver can use its reaction to Disengage and move up to its full speed without provoking opportunity attacks.
**Misdirection:** When targeted by an attack, the Weaver can attempt to redirect the attack to a nearby creature. The attacker must succeed on a DC 13 Wisdom saving throw or target the nearest creature within range.

## Tactics
The Weaver prefers to observe and gather information from a distance. They will attempt to blend into crowds and eavesdrop on conversations. If approached, they will use charm and subtle questioning to extract information. Combat is a last resort, and they will prioritize escape if exposed. They will create diversions and use their urban camouflage to evade pursuers.

## Doctrine Under Pressure  
On round one of combat, the Weaver immediately disengages, seeking cover and using *Mapped Exits* to exploit pre-known routes. They prioritize preserving their anonymity and escape routes, using *Subtle Inquiry* to assess threats. If escape is impossible, they trigger *Information First* to protect mission-critical data before retreating. They will never reveal their Shadow Walker affiliation, even under duress, and will use *Social Misdirection* to shift blame or confusion onto others.

## Social / Investigation Use
The Weaver’s deception pattern involves appearing helpful and unassuming. They ask seemingly innocuous questions to gauge the target’s knowledge and trustworthiness. They notice inconsistencies in stories and body language. Exposure is likely to come from a failed Insight check or a slip-up in their fabricated identity. They might accidentally reveal a coded phrase or a subtle gesture associated with the Shadow Walkers.

## Doctrine-Expressive Mechanics
- **Cover Identity / Unremarkable Presence.** The Weaver stays legible as ordinary city life first, using concealment or a prepared civilian identity to remain forgettable until pressure closes in.
- **Mapped Exits.** Pre-read routes and room geometry let The Weaver turn round-one pressure into movement instead of paralysis.
- **No Last Stand.** Controlled withdrawal matters more than pride; once exposed or bloodied, The Weaver chooses escape, false surrender, or public misdirection over dying in place.
- **Crowd Break.** The city itself becomes cover under pressure, turning contact with the party into fresh movement lanes through bodies, stalls, and obstructed sightlines.
- **Information First.** Messages, tallies, and scraps are preserved or denied before retaliation; the mission survives even if the operative does not keep control of the scene.
- **Social Misdirection.** The Weaver solves pressure socially where possible, using false certainty, harmless pretexts, and shifting public attention before steel becomes the only answer.

## Player-Safe Description  
A nondescript individual, perhaps a merchant’s assistant or a minor clerk, blends seamlessly into the city’s bustle. They seem unremarkable, but their eyes hold a quiet intensity, and they observe everything around them with an almost unsettling focus. They are polite and helpful, but there’s a subtle distance in their demeanor—like a shadow that refuses to be pinned.

## DM-Only Notes  
The Weaver is part of a network tasked with identifying potential recruits and disrupting local power structures. They are unaware of Vishara’s involvement in the Shadow Walker network and are bound by a strict code of silence. They carry a small, coded message scroll, intended for a contact in a neighboring city, which could serve as a plot hook or bargaining chip. Their loyalty to the network is absolute, and they will go to extreme lengths to protect it—even if it means sacrificing their own life.

## Scaling Options
- Weaker version: Reduce hit points to 30, remove the Local Knowledge trait.
- Stronger version: Increase hit points to 60, grant advantage on all Wisdom saving throws, add the Silver Tongue trait.
- Non-combat version: Remove all weapon actions, grant advantage on all Persuasion checks, add the Resourceful trait.
- Boss version (if appropriate): Give the Weaver a familiar (a trained raven) that can scout ahead and relay information.

## Corpus Frontmatter

```yaml
---
id: adversaries/weaver
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, social-obstacle, shadow-walker, urban, chapter-3]
opposition_type: [deceiver, faction-agent, social-pressure]
encounter_roles: [interrogator, blocker, social-pressure]
campaign_use: [social-obstruction, information-extraction, urban-pressure]
mechanical_base:
  - npc-bases/srd-2014/spy
mechanical_status: homebrew-adaptation
homebrew_adjustments:
  status: provisional
  notes: "Modified Spy to emphasize social manipulation and urban infiltration, removing combat-focused proficiencies and adding traits for blending and observation."
can_know:
  - The layout of the city's main trade routes.
  - The names and roles of several minor civic officials.
  - A coded message intended for a contact in a neighboring city.
must_not_know:
  - Vishara's true identity or purpose.
  - The full extent of the Shadow Walker network's operations.
tactics:
  - Observe and gather information from a distance.
  - Use charm and subtle questioning to extract information.
  - Prioritize escape if exposed.
escalation:
  low: "Blend into crowds and eavesdrop on conversations."
  medium: "Attempt to subtly influence targets with whispered suggestions."
  high: "Create diversions and use Evasive Manoeuvre to avoid combat."
player_safe_reveal:
  - "A nondescript individual who blends seamlessly into the city’s bustle."
  - "Their eyes hold a quiet intensity, and they observe everything around them."
dm_only:
  - "Part of a network tasked with identifying potential recruits and disrupting local power structures."
  - "Carries a coded message scroll for a contact in a neighboring city."
```

## Doctrine  
The Weaver operates under a strict code of infiltration and non-confrontation, prioritizing the preservation of the Shadow Walker network’s anonymity above all else. Their mission is to observe, extract, and misdirect—never to engage in open conflict unless absolutely necessary. They view themselves as silent architects of influence, using subtlety, deception, and urban terrain to manipulate outcomes without revealing their affiliation. Loyalty to the network is absolute, and they will sacrifice their own survival to protect the mission’s integrity, ensuring that their superiors remain unseen and their operations untraceable.

## Behavioural Stages  
**Stage 1: Observation**  
The Weaver blends into crowds, eavesdrops on conversations, and uses *Subtle Inquiry* to gauge the emotional states and intentions of those around them. They avoid direct interaction, relying on their *Cover Identity* to remain forgettable.  

**Stage 2: Engagement**  
If approached, they employ charm, harmless questions, and social manipulation to extract information. They use *Whispered Suggestion* or *False Lead* to redirect attention or create confusion, always seeking to de-escalate tension.  

**Stage 3: Escalation**  
When cornered, they trigger *Information First* to preserve or destroy critical data before fleeing. They use *Crowd Break* and *Evasive Manoeuvre* to navigate through obstacles, leveraging the environment as cover. If escape is impossible, they create diversions, surrender under a false identity, or vanish into the chaos of the city.

