---
id: proposals/elara-vyn
proposal_type: adversary
title: Elara Vyn
status: promoted
canonical: provisional
visibility: dm-only
created_at: '2026-06-18T16:58:16.187Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-18T15:48:31.553Z'
corpus_named: null
corpus_anchor_entity: null
corpus_stub_level: null
corpus_coverage_level: null
corpus_policy_id: null
source_prompt: >-
  Propose an adversary Duvash Assistant, Elara  as described here /mnt/e/Wierd
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
    - shadow-walkers
    - house-mathr
  places:
    - torweg
    - torweg/pell-duvashs-trading-house
    - torweg/saltbone-inn
  npcs:
    - pell-duvash
    - brix
    - the-truthspeaker
  items:
    - brynjas-ledger
    - folded-name-mathr
  scenes:
    - scene-4
  adversaries:
    - captain-brynn-stonehand
    - the-ledger-keeper
  threads:
    - duvash-extract
    - brynja-record
    - operation-mathr
  events:
    - duvash-attack
promote_target: corpus/adversary-corpus/karsac-adversaries
summary: Elara Vyn
promoted_from: corpus/proposals/adversaries/elara-vyn.proposed.md
promoted_at: '2026-06-18T18:27:16.395Z'
---

# Adversary: Elara Vyn

## Design Intent

Elara Vyn is a seemingly unassuming assistant to Duvash, a merchant in Torweg’s upper market. She serves as a social-led adversary, designed to gather information, subtly influence conversations, and delay or misdirect the party's investigation into Pell Duvash and his connection to Yngondi. She is a subtle manipulator, operating within the confines of her role and leveraging her access to information to further Vishara's agenda. Combat is a last resort.

## Mechanical Base

Base: monsters/srd-2014/spy — Spy
Reason: The Spy's skillset of deception, information gathering, and subtle manipulation aligns well with Elara's role as a facilitator and observer within Duvash's business. The base provides a framework for her abilities without dictating a combat-focused approach.

## Adaptation Summary

- Kept from base: Languages, ability scores
- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.
- Added: Subtle Influence, Obtain Information
- Removed: Draft-only or unsupported claims not present in the final stat block.
- Mechanical risk: Normalized after final deterministic repair.

## Stat Block

**Elara Vyn**
*Small, Humanoid, Neutral*

**Armour Class** 13 (Leather Armour)
**Hit Points** 18 (4d8)
**Speed** 25 ft.

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 8 (-1) | 14 (+2) | 12 (+1) | 16 (+3) | 10 (+0) | 18 (+4) |

**Saving Throws** Dex +4, Cha +6
**Skills** Deception +8, Insight +2, Investigation +6, Local Trade +4, Persuasion +6, Stealth +4
**Senses** Passive Perception 12
**Languages** Common, Yantravag Sign
**Challenge** 1 (200 XP) · Proficiency Bonus +2

### Traits
**Subtle Influence:** Elara can subtly alter the course of conversations and manipulate those around her. When interacting with a creature, she can attempt a Charisma (Deception) check contested by the creature’s Wisdom (Insight) check. On a success, she can subtly influence the creature’s actions or beliefs, planting suggestions or misdirecting their attention. This influence is not coercive and requires a believable narrative.

### Actions
**Obtain Information:** Elara can spend a bonus action to attempt to glean information from a conversation or document. She makes an Intelligence (Investigation) check. The DC is set by the DM based on the complexity and security of the information.

### Bonus Actions
None

### Reactions
None

## Tactics

Elara’s primary tactic is to delay and misdirect. Upon noticing the party’s interest in Duvash or his dealings, she will attempt to steer the conversation away from sensitive topics, offering plausible but misleading information. She prioritizes maintaining her cover and avoiding direct confrontation. If cornered, she will attempt to escape using Stealth and her knowledge of the market’s layout. She will not engage in combat unless absolutely necessary.

## Doctrine Under Pressure

When attacked, Elara’s doctrine shifts to *preservation of information and cover*. She will immediately attempt to flee, leveraging her **Stealth** skill and intimate knowledge of the upper market’s layout to vanish into hidden passages or crowded alleys. If escape is impossible, she will use her **Subtle Influence** trait to manipulate nearby NPCs (e.g., merchants, dockworkers) into creating distractions or obstructing the party. She will never surrender information about Vishara, the Maw, or Pell Duvash’s secrets, even under duress. If cornered and forced into combat, she will use **Obtain Information** as a last-ditch effort to gather intelligence on her attackers before fleeing.

## Social / Investigation Use

Elara will ask seemingly innocuous questions about the party’s business and intentions, subtly probing for information. She will notice inconsistencies in their stories and attempt to exploit them. She will reveal accidental information through slips of the tongue or misdirection, always framing it as harmless gossip. She uses ledgers and shipping manifests to appear busy and legitimate.

## Player-Safe Description

Elara is a young woman with quick eyes and a pleasant smile, always busy sorting through invoices and assisting customers in Duvash’s bustling shop. She seems eager to help, but her answers are often vague and her attention easily diverted. She appears to be a loyal and hardworking assistant, completely dedicated to her employer. Her movements are smooth and deliberate, as if she’s always calculating her next step.

## DM-Only Notes

Elara is a conduit for Vishara’s influence in Torweg, subtly reorienting the market’s perception of Pell Duvash and diverting attention from his activities. She is unaware of the full extent of Vishara’s plan but is deeply committed to her role. She keeps a coded ledger detailing shipments and contacts, hidden within a hollowed-out invoice book. She is under the direct observation of a Maw agent, who monitors her progress through a discreet earpiece. If the party discovers her ledger, it reveals coded references to “Project Reorientation” and “Phase 2: Market Control.”

## Scaling Options

- Weaker version: Reduce Hit Points and Intelligence score. Remove Subtle Influence trait.
- Stronger version: Increase Hit Points and Charisma score. Give her proficiency in Poisoner’s Kit.
- Non-combat version: Remove all hit points and armour class. Make her a purely social encounter, focused on gathering information and manipulating the party.
- Boss version: Give her access to a small network of informants and the ability to summon minor Yantravag entities for assistance.

## Doctrine

Elara Vyn operates under a doctrine of *subtle reorientation*: she does not seek to confront, destroy, or coerce. Her primary objectives are to **gather information**, **delay investigations**, and **reshape perceptions** of Pell Duvash and his business. She views herself as a loyal agent of Vishara’s influence, tasked with ensuring that Torweg’s upper market remains a controlled environment for the cult’s long-term goals. She refuses to betray Duvash, reveal Vishara’s secrets, or engage in direct combat unless her survival is absolutely threatened. Her actions are guided by a belief in *gradual manipulation*—using charm, deception, and misdirection to steer the party’s focus away from Pell Duvash’s true dealings.

## Behavioural Stages

**Stage 1: Observation** – Elara listens, asks routine questions, and takes notes, using her **Investigation** and **Persuasion** skills to blend into the market environment.  
**Stage 2: Subtle Manipulation** – She employs **Subtle Influence** to plant doubts, misdirect, or steer conversations toward harmless topics.  
**Stage 3: Escalation** – If directly questioned about Pell Duvash or Vishara, she becomes evasive, offering vague answers and feigning ignorance.  
**Stage 4: Last Resort** – If captured and interrogated, she will attempt to trigger a hidden alarm (via a coded ledger or whispered signal) to summon Maw agents, ensuring her secrets remain protected.

## Tactical Notes

Elara’s tactics revolve around **social obstruction** and **information control**. Her **Subtle Influence** trait is her primary tool for manipulation, allowing her to subtly alter party members’ perceptions or actions without direct confrontation. She uses **Obtain Information** to gather intel on the party’s motives, which she later feeds to Vishara’s network. Her high **Deception** and **Persuasion** scores let her convincingly feign loyalty to Duvash while advancing Vishara’s goals. She avoids combat by using **Stealth** to escape, but if forced into it, she will prioritize disengaging rather than fighting.
