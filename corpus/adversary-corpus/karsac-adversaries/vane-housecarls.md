---
id: adversaries/vane-housecarls
type: adversary
visibility: dm-only
canonical: canon
ruleset: dnd-5e-2014
tags: [adversary, housecarl, vane, mathr, torweg, chapter-2, faction-agent, moral-pressure]
opposition_type: [faction-agent, guard, npc-agent]
encounter_roles: [combatant, blocker, watcher, moral-pressure, pressure]
campaign_use: [dock-pressure, social-obstruction, faction-presence, moral-complication, chapter-2]
mechanical_base:
  - karsac-authored/vane-housecarl-discreet-cr2
  - karsac-authored/aldric-vane-cr4
  - npc-bases/srd-2014/guard
  - npc-bases/srd-2014/veteran
mechanical_status: canon-homebrew
homebrew_adjustments:
  status: canon
  notes: "Two stat blocks exist in Karsac canon. (1) Vane's Housecarls, Discreet — CR 2, used in the Duvash ambush. Sneak Attack 2d6, Cunning Action, Multiattack two shortswords +5, Hand Crossbow +5. Priority: Duvash over party; retreat through rear once Duvash is unreachable. (2) Aldric Vane, Housecarl-Captain — CR 4, AC 16, HP 65. Loyal Service (advantage vs charm/compulsion to betray lord), Read the Field (bonus action half-move for ally), Shield Discipline. Surrenders cleanly once duty is discharged. Note: housecarls on the south dock carry Mathr's token, not Vane's house mark — this is a clue, not a combat detail."
can_know:
  - Aldric Vane's direct orders for the current operation
  - which cargo is being moved and where it is going
  - who they are watching for or guarding against
  - that the sigil on their token is Jarl Mathr's, not Vane's house mark
must_not_know:
  - that their lord Mathr is shaped by Vishara
  - Mathr's full hidden nature or sixty-year history
  - the cosmological purpose of the artefacts they are guarding
  - Vishara's identity or the Yantravaq
  - that the Truthspeaker's pin and the Shadow-Walkers' throwing spikes are the same material as anything significant
tactics:
  - priority is always the assigned objective (cargo, person, location)
  - do not escalate beyond what the objective requires
  - Aldric Vane disengages and falls back to the gangplank if two housecarls drop
  - discreet housecarls (Duvash ambush variant) target the informant first; retreat once target is unreachable
  - Vane himself stops fighting if shown the Mathr-token-vs-house-mark discrepancy or the wrong-hand letter
escalation:
  low: "Visible presence on the dock. Two at approaches, four on dock. Professional. Not hostile unless provoked."
  medium: "Social obstruction. Vane blocking the gangplank. Questions asked, names taken. Passage denied without authority."
  high: "Armed confrontation. Discreet housecarls ambushing an informant in a confined back room. Vane himself fighting to discharge duty, not to harm."
player_safe_reveal:
  - "They are loyal Lösweg housecarls doing their lord's work. They are not villains."
  - "Each wears a small bronze token at the collar — flat, palm-sized, marked with a sigil that does not match the Vane house mark on the warehouse door."
  - "They are professional. They will not explain themselves. They do not need to."
  - "Aldric Vane uses your name once he learns it. He is the voice of a man who does not raise it because he has not needed to."
  - "They are not the same as the people who killed the boy. That distinction matters."
dm_only:
  - "The Mathr token vs Vane house mark discrepancy is a clue. Smart players who examine the tokens will notice the mismatch. This is intentional — the operation belongs to Mathr, not Vane."
  - "Vane is beginning to ask questions at the table. The Truthspeaker arrives precisely to prevent this from going further."
  - "If Vane makes DC 14 Wisdom save on seeing the Mathr token vs his own house mark, he stops fighting and asks the party to explain. He is, in that moment, becoming the man Brynja hoped for."
  - "Dockworkers handling Vane's cargo are not Törweg locals. This is visible and unexplained."
  - "The vessel at the dock has Bruithwr lines, not Lösweg — another ambient clue."
related:
  factions:
    - id: factions/house-mathr
    - id: factions/torweg-council
  places:
    - id: places/torweg-south-dock
  events:
    - id: events/south-dock-scene-ch2
candidate_links:
  places:
    - id: places/valweg
      confidence: medium
      reason: "Mathr's inner council seat is in Valweg. Housecarl presence on the road to Valweg is plausible."
      status: suggested
summary: "Loyal Lösweg housecarls serving Aldric Vane under Jarl Mathr's operation. Canon Chapter 2 adversaries. Two stat block variants: discreet (CR 2, Duvash ambush) and Vane himself (CR 4, south dock). Moral-pressure adversary — they are not villains, which is the point."
---

# Vane Housecarls

## Adversary Summary

The housecarls of Aldric Vane, Housecarl-Captain of Törweg. Three generations of Vane service to Mathr's family have produced loyal, professional Lösweg soldiers who follow orders without asking why. They are not villains. They are loyal men doing their lord's work. That is the source of their moral weight as adversaries — the party cannot simply fight them clean.

## Campaign Purpose

Vane's housecarls are the face of Mathr's operation in Törweg. They create dock obstruction, armed pressure, and the social complexity of opposing people who are not corrupt — just uninformed. They are also carrying a critical clue: the bronze token at their collar bears Mathr's sigil, not Vane's house mark. A player who notices the warehouse door has Vane's mark and the housecarls have Mathr's mark has found the thread that unravels the south dock scene.

## What They Are

Professional Lösweg housecarls. Hereditary service family (the Vanes) elevated sixty years ago by Sven Mathr's instrument. Three generations of loyal service. They have never questioned their orders. They have never needed to.

## What They Know

Their current operational orders from Vane. Where the cargo is going. Who they are watching for. That the token at their collar is Jarl Mathr's — though most have not thought about whether that is normal.

## What They Do Not Know

That their lord Mathr is shaped by Vishara. That the artefacts they are moving are anything other than culturally significant Lösweg objects. That forty-five years of Vane service and Mathr has not aged.

## Tactics

Professional restraint. Objective first, confrontation last. Discreet housecarls (the Duvash ambush variant) prioritise the informant and retreat cleanly once he is beyond reach. Vane himself fights to discharge duty, not to harm — and he stops if the moral ground shifts under him.

## Escalation Levels

**Low** — Visible presence, closed access, polite obstruction. They are watching. They have authority. They are not yet threatening.

**Medium** — Social confrontation at the gangplank. Vane with the notebook. Questions. The sigil discrepancy visible to anyone looking.

**High** — Armed engagement. Discreet variant in a confined space, or full dock confrontation if the party presses without authority or deception.

## Mechanical Base

Two canon stat blocks. Use the appropriate variant for the scene.

**Discreet Housecarls (Duvash ambush)** — CR 2, in Ch2 appendix. Rogueish build: Sneak Attack, Cunning Action, two-shortsword Multiattack.

**Aldric Vane** — CR 4, in Ch2 appendix. Fighter build with loyalty traits. Read the Field for tactical control. Shield Discipline. Loyalty's Cost reaction.

If a generic housecarl is needed outside these two scenes, use `npc-bases/srd-2014/guard` with the token detail added as description.

## Karsac Adaptation Notes

The moral-stop mechanic for Vane is canon and must be preserved: if shown the Mathr-token vs house-mark discrepancy or the wrong-hand letter, Vane makes DC 14 Wisdom save; on a failure he stops fighting. This is not a mechanical trick — it is who he is. Do not replace it with a standard combat surrender.

## Player-Safe Use

Players may perceive: professional Lösweg soldiers, bronze token with a sigil that does not match the Vane house mark on the warehouse door, Bruithwr-built vessel, non-local dockworkers, Aldric Vane as a decent man doing something he does not fully understand. Players must not be told that Mathr is Vishara-shaped or what the artefacts are.

## Canon Status

**Canon.** Vane's housecarls appear in Chapter 2 BETA and Performance Document with stat blocks. Token detail, sigil discrepancy, and Vane's moral-stop mechanic are all explicitly documented.
