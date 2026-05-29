---
id: adversaries/truthspeaker-escorts
type: adversary
visibility: dm-only
canonical: canon
ruleset: dnd-5e-2014
tags: [adversary, truthspeaker, escort, mathr, losweg, chapter-2, social-pressure, ashvein]
opposition_type: [faction-agent, guard, social-obstacle]
encounter_roles: [blocker, social-pressure, pressure, escalation-signal, moral-pressure]
campaign_use: [social-obstruction, faction-removal, chapter-2-closing, council-authority, skald-corruption]
mechanical_base:
  - karsac-authored/losweg-warrior-implied
  - npc-bases/srd-2014/veteran
  - npc-bases/srd-2014/guard
mechanical_status: provisional-adaptation
homebrew_adjustments:
  status: provisional
  notes: "The Truthspeaker himself is documented in Ch2 appendix as 'not run in combat' — if attacked, treat as CR 8 Veteran with Legendary Resistance (3/Day) and six Lösweg Warriors in support. The six warriors are the escort force. No individual escort stat block exists in canon; use npc-bases/srd-2014/veteran for capable warriors, npc-bases/srd-2014/guard for standard presence. The Truthspeaker's black pin is Ashvein — same material as Shadow-Walker throwing spikes. This is a player-discoverable connection."
can_know:
  - Jarl Mathr's instruction to escort Vane away from the south dock
  - formal council authority and the correct ceremonial procedures
  - that their Truthspeaker carries full inner council warrant
  - the public reason for the escort (Vane is needed at council; his work here is complete)
must_not_know:
  - that the Truthspeaker's tradition has been corrupted or altered
  - Vishara's purpose or the nature of the Yantravaq
  - that Mathr is shaped by Vishara
  - what the Truthspeaker intends to do with Vane once he is removed
  - the cosmological significance of the Ashvein pin
tactics:
  - they are not here to fight; they are here to close a scene
  - the Truthspeaker speaks with formal council cadence; the escort stands and makes the alternative obvious
  - they will not engage unless the party physically blocks them or attacks
  - if combat begins, the six warriors are serious opponents; the Truthspeaker does not need to be
  - they will leave with Vane regardless; the only question is whether combat happens on the way out
escalation:
  low: "The Truthspeaker arrives on the dock. Composed. Correct. The escort fans out without threat."
  medium: "Formal council authority invoked. The Truthspeaker names the warrant. Vane is invited to come. The tone is polite. The implication is not."
  high: "Party blocks the exit. Six warriors ready. The Truthspeaker does not raise his voice. He does not need to."
player_safe_reveal:
  - "He speaks with the formal cadence of the Lösweg oral tradition. The verses he uses are the right verses."
  - "There is something wrong underneath them. Not the words. The weight."
  - "He wears a small black pin at his throat, a metal nobody at the dock recognises."
  - "He came to collect Aldric Vane. He did it politely. He did not ask what the party wanted."
  - "The escort stood where they needed to stand without being told."
dm_only:
  - "The Truthspeaker is a real Skald. His tradition has been worked over by Vishara's methodology. He is not replaced or possessed — he is thinned, like the rest of Vishara's work. Ragnfridd perceives this as a wrongness in the weight beneath the right words."
  - "The black pin at his throat is Ashvein — the same material as the Shadow-Walkers' throwing spikes and Xyrrath's phial. This is a clue, not a dramatic reveal. Only Korvann/Xyrrath have the context to recognise it, and only on a DC 12 Investigation."
  - "What the Truthspeaker intends to do with Vane is not revealed in Chapter 2. The players do not know. Brynja knows what it means that he came. She does not say more than that."
  - "The Truthspeaker's arrival is Mathr's move to prevent Vane from asking any more questions. The timing is not coincidence."
related:
  factions:
    - id: factions/house-mathr
    - id: factions/losweg-council-inner
  places:
    - id: places/torweg-south-dock
  events:
    - id: events/south-dock-scene-ch2
candidate_links:
  places:
    - id: places/valweg
      confidence: high
      reason: "The Truthspeaker holds inner council authority from Valweg. His reach extends there."
      status: suggested
  factions:
    - id: factions/shadow-walkers
      confidence: medium
      reason: "Ashvein pin connects him materially to the Shadow-Walkers. The connection is discoverable by players, not stated."
      status: suggested
summary: "The Truthspeaker and his six-warrior escort arriving at the south dock to remove Aldric Vane from the scene. Canon Chapter 2 adversary. Designed to close a scene, not to fight. His Ashvein pin connects him to the Shadow-Walkers. Ragnfridd perceives the wrongness in his skaldic tradition."
---

# Truthspeaker Escorts

## Adversary Summary

The Truthspeaker — a Mathr-aligned Skald of the Lösweg inner council — arriving at Törweg's south dock with six Lösweg warriors to escort Aldric Vane away from a conversation that has gone further than Mathr intended. He is the scene-closing adversary of Chapter 2: not a combat threat the party can remove, but a faction move that takes a consequence out of their hands and confirms that someone in Valweg was watching the south dock.

## Campaign Purpose

The Truthspeaker's arrival tells the players that Mathr has reach, information, and the council authority to act on it. He also carries the second instance of the Ashvein connection — his pin is the same material as the Shadow-Walkers' throwing spikes. A player who noticed the metal in Halvash and notices it again here has found a thread between two apparently separate operations. The wrongness Ragnfridd perceives in his tradition is the first direct perception of Vishara's methodology at the individual scale.

## What They Are

The Truthspeaker is a formal Skald of the Lösweg oral tradition, carrying inner council warrant, used by Mathr as an official instrument to close scenes and remove problems. His six escorts are capable Lösweg warriors with the authority and numbers to make their presence sufficient. They are not sent to fight. They are sent to make fighting unnecessary.

## What They Know

Their immediate orders: escort Vane away from the dock. Their authority: the inner council's warrant, Mathr's instruction. The public reason: Vane's work is complete, he is needed.

## What They Do Not Know

The Truthspeaker does not know his tradition has been worked over by Vishara's methodology. He knows his craft, uses the right verses, applies the right cadences. The wrongness is below the level he can access. The warriors know nothing beyond their orders.

## Tactics

They are not here to fight. The Truthspeaker invokes council authority. The escort fans out to make the physical geometry clear. If the party does not block the exit, there is no combat. If the party physically prevents the escort's exit, six veterans engage. The Truthspeaker does not participate in combat unless attacked directly.

## Escalation Levels

**Low** — Arrival on the dock. Composed, correct, unhurried. The escort simply stands.

**Medium** — Council authority invoked. Vane is told he is needed. The tone is correct. The escort's positioning is not.

**High** — Party physically blocks exit. Six warriors engage. This is a losing fight for the party in Chapter 2 — the intent is not to make them win, but to make them understand the weight of what has just been taken from them.

## Mechanical Base

**Truthspeaker** — Not run in combat under normal conditions. If attacked: CR 8 Veteran + Legendary Resistance (3/Day) + six Lösweg Warriors in support. This is explicitly noted in Ch2 appendix.

**Escort warriors** — No individual stat block in canon. Use `npc-bases/srd-2014/veteran` for six capable Lösweg warriors. If a lighter touch is needed, `npc-bases/srd-2014/guard` with veteran flavour.

## Karsac Adaptation Notes

The key adaptation is the "not run in combat" framing for the Truthspeaker. The stat escalation exists as a safety valve for unexpected player choices, not as an intended encounter path. Run him as a social adversary first and always.

Ragnfridd's perception of the skaldic wrongness should be offered to the player as a prompt, not delivered as narration. The DM offers; the player decides whether to voice it.

## Player-Safe Use

Players may perceive: formal council authority, correct Lösweg cadence with something wrong underneath it, a black pin of unrecognised metal, six warriors who stand exactly where they need to without being told, the fact that someone knew to send him here at this moment. Players must not be told what will happen to Vane, or what the pin means at a deeper level.

## Canon Status

**Canon** for the Truthspeaker and escort presence. **Provisional** for the individual escort warrior stat block (no specific canon block exists; veteran base is a reasonable mechanical choice). Truthspeaker's Ashvein pin, Ragnfridd's perception, and the "not run in combat" instruction are all explicitly documented in Ch2.
