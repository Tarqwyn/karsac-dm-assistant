---
id: adversaries/sea-hag-thralls
type: adversary
visibility: dm-only
canonical: canon
ruleset: dnd-5e-2014
tags: [adversary, sea-hag, thrall, drowned, whale-road, chapter-2, supernatural-threat]
opposition_type: [thrall, supernatural-threat, environmental-linked-threat]
encounter_roles: [combatant, pressure, ambusher, moral-pressure]
campaign_use: [supernatural-escalation, sea-encounter, emotional-weight, whale-road-threat]
mechanical_base:
  - karsac-authored/sea-hag-whale-road-cr5
  - npc-bases/srd-2014/commoner
  - npc-bases/srd-2014/guard
mechanical_status: canon-homebrew
homebrew_adjustments:
  status: canon
  notes: "Sea Hag of the Whale-Road is a canon Karsac creature, CR 5. Three Drowned Thralls accompany her (CR 1 each). Thralls are noted as 'animated sailor types' — commoner or guard base is appropriate. Hag stat block replicated from Ch1 preview per Ch2 appendix: AC 16, HP 91 (14d8+42), Speed 30 ft./Swim 40 ft. Actions: Multiattack two claws (2d6+3 each), Death Glare (5-6), Luring Song, Fog of the Whale-Road, Vile Appearance, Illusory Appearance. Amphibious. Thralls collapse when hag is destroyed."
can_know:
  - immediate compulsion from the hag
  - simple tasks (approach, attack, protect)
  - local waters and basic navigation (residual)
must_not_know:
  - wider campaign cosmology
  - Mathr's political operation
  - Vishara's purpose
  - why the hag was drawn to the Greyback's cargo
  - that the cargo is connected to anything beyond its surface appearance
tactics:
  - thralls act as front-line pressure while hag uses Luring Song and fog
  - thralls do not retreat; they fight until the hag is destroyed
  - hag uses fog to disorient, then Death Glare to force checks
  - the Deepwhale's presence causes the hag to withdraw; she perceives what is beneath the ship
  - once hag is destroyed or withdraws, all remaining thralls collapse immediately
escalation:
  low: "Fog on the Whale-Road where there should be no fog. A sense of being watched from the water."
  medium: "Luring Song. One party member drawn toward the rail. Fog thickens. A shape in the water."
  high: "Full encounter. Hag emerges. Three Drowned Thralls board or cling to the hull. Combat on deck in fog."
player_safe_reveal:
  - "The thralls move with purpose but not intelligence. They are compelled, not willing."
  - "One thrall wears old Lösweg clothing — recognisable as belonging to a vessel not seen in years."
  - "They collapse the moment the hag is destroyed. Whatever held them together, it was not their own will."
  - "The fog had no right to be here. It arrived with the hag and left with her."
  - "The Deepwhale appeared before the attack. It dropped below the surface once the hag was gone."
dm_only:
  - "The hag was drawn by the cargo — the anchors aboard the Greyback carry a resonance she perceived."
  - "The Deepwhale also perceived what is beneath the ship and chose to be present. The hag perceived the Deepwhale and withdrew. This is not coincidence."
  - "The thrall in Lösweg clothing is from a vessel Floki's father knew. Floki was a child the last time he saw it. He will not say this. The recognition will sit with him."
  - "The flat-hand gesture the crew make after the encounter means something different here than it did for the Deepwhale. Do not explain the distinction."
related:
  places:
    - id: places/whale-road
  events:
    - id: events/sea-hag-encounter-ch2
candidate_links:
  factions:
    - id: factions/house-mathr
      confidence: low
      reason: "Hag drawn by cargo Mathr arranged to move. Indirect connection only — hag is not a Mathr agent."
      status: suggested
  places:
    - id: places/lösweg-coast
      confidence: medium
      reason: "Whale-Road corridor between Halvash and Törweg. Hag encounter occurs in transit."
      status: suggested
summary: "Sea Hag of the Whale-Road with three Drowned Thralls. Canon encounter in Chapter 2 sea transit. Drawn by the resonance of the cargo. The thrall in Lösweg clothing carries Floki's personal emotional thread. Thralls collapse when hag is destroyed."
---

# Sea Hag Thralls

## Adversary Summary

The three Drowned Thralls that accompany the Sea Hag of the Whale-Road. Former sailors, drowned and reanimated by the hag's compulsion. They move with purpose but without intelligence. They are not enemies by choice. The most significant of the three wears clothing from a Lösweg vessel Floki's father knew — a detail that costs Floki something, even if he does not say so at the table.

## Campaign Purpose

The sea encounter establishes that the Whale-Road is not safe and that the cargo the party carries is already attracting attention from things that should not be aware of it. The hag is drawn by resonance, not by instruction — which tells a careful player that the anchors are not neutral objects. The Deepwhale's response to the encounter adds a second layer: something in the deep water has also noticed, and its reaction to the hag is not neutral.

The thrall in Lösweg clothing is a personal thread for Floki, not a campaign revelation. Run it quietly. Do not push.

## What They Are

Reanimated drowned sailors bound to the hag's will by compulsion. They retain residual physical skill but no independent thought or volition. They fight because they cannot do otherwise. When the hag is destroyed or withdraws, they collapse.

## What They Know

Only what the hag compels them to do in the moment. No independent knowledge of the campaign, its factions, or its cosmology.

## What They Do Not Know

Everything. They are not agents. They are instruments of the hag's will.

## Tactics

The thralls function as the hag's forward pressure while she controls the engagement through fog, Luring Song, and Death Glare. They do not use tactical judgment. They move toward targets and attack. The hag is the real threat; the thralls are the distraction and the drain on resources. When the hag drops or withdraws, the thralls drop immediately — run this as a dramatic punctuation, not a mechanical cleanup.

## Escalation Levels

**Low** — Fog. A shape just below the surface. A Luring Song at the edge of hearing.

**Medium** — Thralls visible in the water, approaching the hull. The song is clearer. Someone feels compelled to look over the side.

**High** — Full deck encounter. Three thralls aboard or clinging to the rail, hag partially emerged from the water, fog at full density, Death Glare active.

## Mechanical Base

**Sea Hag of the Whale-Road** — CR 5, canon Karsac stat block (from Ch1 preview, reprinted in Ch2 appendix). Do not substitute an SRD sea hag — the Karsac version has Fog of the Whale-Road and the Deepwhale withdrawal behaviour that are specific to the encounter.

**Drowned Thralls** — CR 1 each. Use `npc-bases/srd-2014/guard` chassis with the following note: thralls are undead-adjacent but mechanically treated as humanoid combatants. They have no special abilities. They collapse instantly when the hag is destroyed or withdraws (no save, no check — narrative resolution).

## Karsac Adaptation Notes

The critical adaptation is the thrall-collapse behaviour: when the hag ends, they end. This is not SRD zombie behaviour (which requires individual destruction). Run the collapse as a single moment — whoever was fighting a thrall feels the resistance go out of it, and it falls. If the hag was reduced to 0 HP, the thrall in Lösweg clothing falls last, face up, and Floki looks at it from the rail for a long time before the crew covers it.

## Player-Safe Use

Players may perceive: compelled sailors, fog that arrived with the hag, the Lösweg clothing on one thrall (description only — do not name the vessel or its history), immediate collapse on hag death. Players must not be told why the hag was drawn to this ship, or what the cargo carries that attracted her.

## Canon Status

**Canon.** Sea Hag of the Whale-Road with three Drowned Thralls is a played encounter in Chapter 2. Stat block confirmed in Ch2 appendix. Thrall-collapse and Deepwhale intervention are canon scene notes.
