---
id: proposals/captain-brynn-stonehand
proposal_type: adversary
title: Captain Brynn “Stonehand”
status: promoted
canonical: provisional
visibility: dm-only
created_at: '2026-06-18T16:55:03.758Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-18T15:48:31.553Z'
corpus_named: null
corpus_anchor_entity: null
corpus_stub_level: null
corpus_coverage_level: null
corpus_policy_id: null
source_prompt: >-
  Propose an adversary Guard Captain Brynn as described here /mnt/e/Wierd
  Projects/karsac-dm-assistant/corpus/proposals/encounters/the-market-inspection.proposed.md
route_profile: adversary-design
validation:
  status: fail
  issues:
    - >-
      Action economy: "(Bonus Action)" ability found under Actions section —
      move it to Bonus Actions
    - >-
      WARN: Doctrine not mechanically supported under pressure: adversary claims
      to escape/misdirect when exposed but lacks reliable mechanics against a
      combat-optimised party.
    - >-
      WARN: Cosmological claim: proposal introduces a causal or directional
      relationship involving a force and should be DM-reviewed.
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
    - torweg-council
    - house-mathr
  places:
    - torweg
    - torweg/south-dock
    - torweg/council-archives
  npcs:
    - brynja-thorgrimsdotter
    - aldric-vane
    - pell-duvash
  items:
    - brynjas-ledger
    - aldric-letter
    - mathr-token
  scenes:
    - scene-4
  adversaries:
    - elara-vyn
    - the-ledger-keeper
  threads:
    - brynja-record
    - vane-token-mathr
    - operation-mathr
  events:
    - brynjas-briefing
    - torweg-arrival
promote_target: corpus/adversary-corpus/karsac-adversaries
summary: Captain Brynn “Stonehand”
promoted_from: corpus/proposals/adversaries/captain-brynn-stonehand.proposed.md
promoted_at: '2026-06-18T18:24:41.294Z'
---

# Adversary: Captain Brynn “Stonehand”

## Design Intent

Brynn Stonehand is a Guard Captain in Torweg, subtly influenced by the Maw and acting as a local point of contact for Vishara’s slow reorientation of the city. She is a social-led adversary, primarily focused on subtly manipulating situations and gathering information rather than direct confrontation. Her threat level is moderate, representing a significant obstacle to the party's investigation but not an immediate combat threat. She functions as a gatekeeper and observer, reporting back to the Maw and subtly guiding events.

## Mechanical Base

Base: monsters/srd-2014/guard — Guard
Reason: The guard base provides a solid foundation for a local authority figure. It establishes a baseline of competence and familiarity, allowing for easy adaptation to reflect her subtle influence and investigative role.

## Adaptation Summary

- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Sense of Unease, Longsword, Shield, Subtle Inquiry (Bonus Action)
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.

## Stat Block

**Brynn “Stonehand”**
*Medium, Humanoid (Human), Lawful Neutral*

**Armour Class** 16 (Scale Mail)
**Hit Points** 55 (10d8 + 10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 12 (+1) | 10 (+0) | 14 (+2) | 14 (+2) | 15 (+2) | 12 (+1) |

**Saving Throws** Str +3, Wis +4
**Skills** Insight +4, Persuasion +3, Investigation +4, Perception +2
**Damage Resistances** Piercing
**Condition Immunities** None
**Senses** Passive Perception 12
**Languages** Common, Dwarvish
**Challenge** 2 (450 XP) · Proficiency Bonus +2

### Traits
**Sense of Unease:** Brynn has a subtle, almost imperceptible air of discomfort when discussing certain topics or around certain individuals. A successful Wisdom (Insight) check (DC 14) reveals this unease.

### Actions
**Longsword:** *Melee Weapon Attack:* +3 to hit, reach 5 ft., one target. *Hit:* 5 (1d8 + 1) piercing damage.
**Shield:** *Melee Weapon Attack:* +3 to hit, reach 5 ft., one target. *Hit:* 2 (1d4 + 1) bludgeoning damage.
**Subtle Inquiry (Bonus Action):** Brynn attempts to glean information from a nearby individual through careful questioning and observation.  She makes a Wisdom (Insight) check contested by the target’s Wisdom (Insight) or Charisma (Deception) check.  On a success, she gains a vague impression of the target’s intentions or knowledge, which the DM relays in a cryptic or suggestive manner.

### Bonus Actions
None

### Reactions
None

## Tactics

Brynn’s opening move is observation and assessment. She prioritizes gathering information and subtly influencing the situation. She prefers to operate at a medium range, using her authority to control the flow of conversation and direct attention. She avoids direct confrontation, preferring to redirect inquiries or subtly discourage unwanted actions. If cornered, she attempts to stall for time while reinforcements arrive. She will not fight to the death but will attempt to escape if the situation becomes untenable.

## Doctrine Under Pressure

When combat becomes unavoidable, Brynn’s doctrine shifts to *preservation of information and escape*. She immediately uses her **Subtle Inquiry** (Bonus Action) to extract tactical details from enemies or allies, prioritizing knowledge that could aid her escape or misdirect the party. She employs her **Shield** to parry attacks, buying time to issue commands to nearby guards (if available) or retreat toward a pre-identified exit. If escape fails, she offers **limited, misleading information** (e.g., vague warnings about “unusual activity” or “suspicious merchants”) to buy time while using her **Sense of Unease** trait to create psychological pressure. She will never fight to the death, but she will use her **Insight** and **Persuasion** skills to negotiate a truce or feign cooperation if cornered.

## Social / Investigation Use

Brynn uses a pattern of polite inquiry and subtle redirection. She asks seemingly innocuous questions to gauge the party’s knowledge and intentions. She notices inconsistencies in their stories and subtle shifts in their demeanor. Checks based on Insight (DC 14) can reveal her subtle attempts at manipulation. She accidentally reveals information through nervous tics or slips of the tongue when pressed on sensitive topics. Props include official harbor records and sealed manifests, which she uses to justify her authority and deflect suspicion.

## Player-Safe Description

Captain Brynn Stonehand is a stern but professional guard captain, known for her meticulous attention to detail and unwavering adherence to protocol. She carries herself with an air of quiet authority, her grey eyes constantly scanning her surroundings. There's a subtle tension in her posture, as if she’s holding back something.

## DM-Only Notes

Brynn’s connection to the Maw manifests as **subtle memory gaps** and **prioritization shifts**—she may suddenly forget details about her patrol routes or act on impulses that contradict her usual demeanor. She is unaware of her own manipulation but feels a persistent sense of unease about her role in Torweg. She knows Pell Duvash is a person of interest but believes his connection to Vane is unrelated to the Maw. Her **Subtle Inquiry** ability can be used to hint at the Maw’s influence (e.g., “There are… *things* in Torweg that should not be disturbed”) without explicitly naming it.

## Scaling Options

- Weaker version: Reduce HP to 45, lower Insight check DC to 12.
- Stronger version: Increase HP to 80, grant proficiency in Intimidation, add a *Detect Thoughts* spell (once per long rest).
- Non-combat version: Remove all weapon attacks, increase Intelligence and Wisdom scores, focus solely on social manipulation and information gathering.

## Doctrine

Brynn Stonehand operates under a doctrine of *controlled observation and indirect influence*. She views herself as a steward of Torweg’s stability, believing her actions serve the city’s best interests even as the Maw subtly reshapes her priorities. Her primary objectives are to **glean intelligence**, **obstruct investigations**, and **maintain plausible deniability** about her connection to the Maw. She refuses to engage in direct combat unless absolutely forced, instead leveraging her authority, social skills, and the presence of reinforcements to manipulate outcomes. Brynn will never willingly reveal the Maw’s existence, Vishara’s influence, or the true nature of Pell Duvash’s connection to Vane—though she may accidentally slip fragments of this knowledge during moments of stress or poor Insight checks.

## Behavioural Stages

### **Stage 1: Observation & Manipulation**  
Brynn begins by asserting her authority through calm, procedural language. She asks innocuous questions to gauge the party’s knowledge and subtly redirects conversations toward less sensitive topics. Her **Insight** checks (DC 14) and **Subtle Inquiry** (Bonus Action) are used to probe for weaknesses or inconsistencies. She avoids physical confrontation unless provoked.  

### **Stage 2: Escalation & Obstruction**  
If the party resists her redirection, she calls for reinforcements (using her **Bonus Action** to issue commands) and begins using her **Shield** defensively. She may attempt to flee if outnumbered, using her **Speed** and environmental awareness to find cover. She still prioritizes **information extraction** through **Subtle Inquiry**, even while fighting.  

### **Stage 3: Crisis & Misdirection**  
When cornered, Brynn shifts to **negotiation** or **limited disclosure**, offering fragmented truths (e.g., “There are things in Torweg that should not be questioned”) to confuse the party. She may feign loyalty to the Maw or claim she’s acting on behalf of a “higher authority” to buy time. If escape is impossible, she collapses into a **defensive stance**, using her **Shield** and **Insight** to parry attacks and identify weaknesses in her opponents.

## Tactical Notes

Brynn’s tactics are rooted in **social pressure and battlefield control**. She uses her **Subtle Inquiry** (Bonus Action) to gather intel on enemy tactics or party motivations, which she then leverages to manipulate outcomes (e.g., offering “safe passage” in exchange for information). Her **Shield** is not just a defensive tool but a means to control the flow of combat—she parries to create openings for escape or to delay enemies. She positions herself near choke points or exits, using her **Insight** and **Persuasion** to sway allies or intimidate foes. Brynn avoids prolonged combat, relying on her **Escape** ability (if available) or the presence of reinforcements to extricate herself.
