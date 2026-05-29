---
id: adversaries/false-customs-officers
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, false-official, customs, mathr, valweg, social-obstacle, chapter-3]
opposition_type: [social-obstacle, faction-agent, deceiver]
encounter_roles: [deceiver, interrogator, blocker, social-pressure]
campaign_use: [social-obstruction, information-extraction, dock-pressure, chapter-3, valweg-arrival]
mechanical_base:
  - npc-bases/srd-2014/spy
  - npc-bases/srd-2014/noble
  - npc-bases/srd-2014/guard
mechanical_status: provisional-adaptation
homebrew_adjustments:
  status: provisional
  notes: "No canon stat block. False customs officers are the social-obstruction layer at dock and gate arrivals — they carry forged or overreaching authority documents, ask questions designed to extract information about cargo and plans, and create legal pretexts for delay, confiscation, or detention. The Mathr sigil on a document (rather than a token) is the tell for players who have seen it before. Mechanically: spy base for the lead officer (deception, insight, persuasion skills); guard base for the escort pair. Noble base if the false officer is posing as a senior official."
can_know:
  - their cover identity and authority documentation
  - what information they are trying to extract (cargo, companions, destination, the artefacts)
  - their reporting contact and operational brief
  - that their authority documents are overreaching or forged, though they will not volunteer this
must_not_know:
  - Mathr's full hidden nature
  - Vishara's purpose or the Yantravaq
  - the cosmological significance of what the party carries
  - the full scope of the artefact operation
tactics:
  - establish authority confidently before questions begin
  - use legal language and procedural pressure to create compliance
  - extract information through routine-sounding questions
  - if documentation is questioned, escalate to delay tactics rather than admissions
  - if cover is broken, fall back on the escort pair and signal for a road agent or housecarl response
  - they will not fight the party directly; they are social tools
escalation:
  low: "Routine-seeming customs inspection. Documents requested, cargo interest noted, party names recorded."
  medium: "Extended inspection. Cargo hold access requested. Questions about the artefacts, phrased as routine declarations."
  high: "Detention demand on a pretext. Legal language, a warrant, the escort pair visibly present. A response force implied to be nearby."
player_safe_reveal:
  - "Their authority is correct in form. Something is slightly wrong with it."
  - "The seal on the document is the Mathr sigil — you have seen it before."
  - "They are not interested in the ordinary cargo. They are interested in what is below it."
  - "The questions are too specific for a routine inspection."
dm_only:
  - "False customs officers are the dock and gate equivalent of road agents — social obstruction using false official authority rather than physical checkpoint pressure."
  - "The Mathr sigil on the authority document is the player-facing clue. A player who has seen the Mathr token on the housecarls at the south dock and then sees the same sigil on a customs document has connected Mathr to this obstruction."
  - "Their goal is information extraction as much as delay. A party that talks through a false customs inspection has given Mathr's network their cargo inventory, their names, their destination, and confirmation that they are still alive and moving."
related:
  factions:
    - id: factions/house-mathr
candidate_links:
  places:
    - id: places/valweg
      confidence: high
      reason: "False customs officers are most useful at the port or gate arrival into Valweg, where the party needs to move quickly."
      status: suggested
    - id: places/torweg-south-dock
      confidence: medium
      reason: "The south dock obstruction in Ch2 is a canon precedent for this type of encounter, using housecarls rather than false officers."
      status: suggested
summary: "Provisional adversary type: Mathr-aligned operatives posing as customs or port officials to extract information and create delays at dock and gate arrivals. The Mathr sigil on their documents is the player-facing clue. Social obstruction and information extraction, not combat."
---

# False Customs Officers

## Adversary Summary

Operatives posing as customs officials, port inspectors, or gate wardens to delay the party, extract cargo and travel information, and create legal pretexts for interference at points of arrival. They carry the Mathr sigil on their authority documents — a tell for players who have seen it before. They are social adversaries, not combat ones.

## Campaign Purpose

False customs officers make arriving at Valweg or other controlled ports complicated. They create time pressure (the party needs to reach Beorn before Dugweb arrives), extract information about the party's cargo and plans, and reinforce that Mathr's network extends to the administrative layer of Lösweg's ports. The Mathr sigil on their documents is a deliberate callback to the south dock scene.

## What They Are

Mathr-aligned agents using false or overreaching authority documents to conduct information extraction under cover of official procedure. They are skilled at procedural language and social pressure. Their escort pair gives them physical credibility without making them a combat threat.

## What They Know

Their cover identity, authority documentation, the information they are tasked to extract, their reporting contact.

## What They Do Not Know

Mathr's full nature, Vishara's purpose, the cosmological significance of the artefacts.

## Tactics

Establish authority first. Use procedural language to create compliance rather than confrontation. Extract information through routine-sounding questions. If cover is broken, delay rather than admit. Signal for backup if the situation escalates beyond their remit.

## Escalation Levels

**Low** — Routine inspection. Documents requested. Cargo interest noted. Names recorded.

**Medium** — Extended inspection with specific cargo questions. The interest in what is below the ordinary cargo is becoming obvious.

**High** — Detention demand. A pretext warrant. The escort pair visibly ready. A response force implied nearby.

## Mechanical Base

No canon stat block. Use `npc-bases/srd-2014/spy` for the lead officer (Deception, Insight, Persuasion, Investigation skills all relevant). `npc-bases/srd-2014/guard` for the escort pair. `npc-bases/srd-2014/noble` if posing as a senior port authority.

## Karsac Adaptation Notes

The Mathr sigil on the authority document is the single most important detail. It must be visible on the document if a player looks closely enough, and a DC 12 Investigation will surface it. A player who recognises it has the information they need to understand who sent this official.

The information extraction goal means a successful social encounter by the party (they satisfy the inspection and leave) still costs them something — their cargo inventory and travel plans are now with Mathr's network.

## Player-Safe Use

Players may perceive: slightly wrong authority documents, the Mathr sigil on a seal, questions too specific for routine inspection, the sense that the cargo below the ordinary goods is what is actually being sought. Players must not be told who directed the inspection or what will be done with the information.

## Canon Status

**Provisional.** False customs officers are extrapolated from the established pattern of Mathr's social-obstruction operations (south dock precedent) applied to a dock/gate arrival context. No canon instance exists. Mark as provisional until Chapter 3 material confirms or denies this adversary type.
