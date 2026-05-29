---
id: adversaries/vishara-touched-locals
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, vishara, touched, torweg, losweg, chapter-2, supernatural-pressure, social-pressure]
opposition_type: [social-obstacle, environmental-linked-threat, npc-agent]
encounter_roles: [social-pressure, moral-pressure, clue-carrier, pressure, omen]
campaign_use: [vishara-symptoms, ambient-pressure, information-degradation, chapter-2, chapter-3]
mechanical_base:
  - npc-bases/srd-2014/commoner
  - npc-bases/srd-2014/noble
mechanical_status: provisional-adaptation
homebrew_adjustments:
  status: provisional
  notes: "No stat block applicable or appropriate. Vishara-touched locals are not combat encounters. They are social and ambient encounters. The mechanical base is commoner or noble chassis only for the rare case where a Vishara-touched person becomes physically obstructive or is attacked. The core adversary function is informational degradation, misdirection, and moral discomfort. Tor Ashfen (the Coldfront captain) is the canon example: came back from somewhere asking different questions, interested in different things, seemed gentler than before. Taken in daylight, walked with those who came for him. His change read as kindness before it read as loss."
can_know:
  - repeated behaviours and compulsions they are currently acting on
  - their ordinary life and relationships (residual, intact)
  - local knowledge (geography, people, trade) — still present, but context is thinning
  - fragments of why they feel compelled, expressed as rationalisation rather than understanding
must_not_know:
  - that Vishara is the source of their changed state
  - that Dhurvaq or any opposing force exists
  - why their behaviour matters cosmologically
  - that they are being used as part of a larger operation
  - that what has happened to them is not natural or self-chosen
tactics:
  - they are not adversaries in the combat sense; they are adversaries in the information sense
  - they give misdirection without knowing they are doing so
  - they ask different questions than they should; they are interested in different things
  - their gentleness is more unsettling than hostility would be
  - they rationalise their compulsions convincingly; DC 14 Insight to notice the seam
escalation:
  low: "A local who was known for their sharpness now seems slightly vague. Their answers drift from the question."
  medium: "A trusted source gives information that is subtly wrong — not lying, redirecting without knowing it. An NPC the party relied on is no longer reliable."
  high: "A fully Vishara-worked individual (Ashfen-level). Taken. Absent from their post. Their change preceded their removal. The party learns this after the fact."
player_safe_reveal:
  - "They seem gentler than they were. That is the most frightening thing."
  - "They are not lying. They are answering a slightly different question than the one you asked."
  - "They came back asking different questions. Interested in different things."
  - "Whatever happened, it did not seem cruel about it."
  - "They are not absent from their lives. They are present in a way that has stopped matching."
dm_only:
  - "Vishara works through culture, attention, and the slow erosion of the particular. At the individual scale, this reads as a person becoming less themselves — not lost, not replaced, just diffused. The specific becomes the general. The particular becomes the average."
  - "Tor Ashfen is the canon example: captain of the Coldfront, came back asking different questions, taken in daylight by people Brix did not know. One was Aldric's man. The other had a black pin at the throat — Ashvein."
  - "Vishara does not need to be present to work this way. It needs only to have touched the right people in the right sequence. The process continues without further intervention."
  - "Sygna's translations softening certain words is an ambient instance of this at micro-scale. She is not lying. She is choosing. The choosing is Vishara's fingerprint."
related:
  factions:
    - id: factions/house-mathr
candidate_links:
  places:
    - id: places/torweg
      confidence: high
      reason: "Sourcebook states Vishara's fingerprints are in the contraction of Törweg. The Coldfront captain is a canon Törweg instance."
      status: suggested
    - id: places/valweg
      confidence: medium
      reason: "Mathr has been working through Valweg's inner council for sixty years. Council members may show symptoms."
      status: suggested
  factions:
    - id: factions/torweg-council
      confidence: medium
      reason: "Council members and local authorities are plausible vectors for Vishara's diffusion work."
      status: suggested
summary: "Provisional adversary type: locals and NPCs whose specific identity has been thinned by Vishara's methodology. Not combat threats. Adversaries in the information and trust sense. Canon example: Tor Ashfen (Coldfront captain). Ambient instance: Sygna's softened translations. The gentleness is the tell."
---

# Vishara-Touched Locals

## Adversary Summary

People in Lösweg whose particular identity — their sharpness, their specific knowledge, their characteristic voice — has been thinned by Vishara's methodology. They are not gone. They are present in a way that has stopped matching. They give information that drifts. They are gentle where they used to be precise. They are the signal of Vishara's work at the individual scale.

## Campaign Purpose

Vishara-touched locals make the party's information environment unsafe. An NPC who was a reliable source may now give subtly wrong directions — not lying, just answering a slightly different question than the one asked. Over time, the party learns to read the signs: the gentleness, the drift, the slightly wrong weight on the words. It also makes Vishara tangible before it is nameable.

## What They Are

Ordinary people — captains, council members, innkeepers, translators — in whom Vishara's diffusion work has taken hold. They are not agents. They are not directed. They are the consequence of Vishara having touched the right people in the right sequence.

## What They Know

Their ordinary life and local knowledge remain intact but are losing context. They rationalise their compulsions as reasonable choices. They cannot account for the drift because they do not perceive it.

## What They Do Not Know

That Vishara is the source. That they have been changed. That their change serves a purpose.

## Tactics

Not a combat adversary. The adversary function is informational — misdirection without intent, trust degradation, the discomfort of sources becoming unreliable. DC 14 Insight to notice the seam between the person they were and the person they are now.

## Escalation Levels

**Low** — Ambient. A local who was known for sharpness is slightly vague. Answers drift. Nothing provable.

**Medium** — A trusted source gives information that is subtly wrong. The party relied on this person. They were not reliable this time.

**High** — An NPC the party needed is gone. Taken. Their change preceded their removal. The party learns what happened to them after the fact, from someone else.

## Mechanical Base

No combat stat block intended. Use `npc-bases/srd-2014/commoner` or `npc-bases/srd-2014/noble` chassis only if a Vishara-touched person becomes physically obstructive in a fringe scenario. The core function is entirely social and informational.

## Karsac Adaptation Notes

The tone is the adaptation. These people are not hostile. They are not obviously wrong. The wrongness is subtle and builds across encounters. Run Sygna's translation softening as the first micro-instance. Run Ashfen as the first named macro-instance. Let the pattern accumulate before the players can name it.

Vishara-touched locals must never explain themselves as such — they cannot. The DM offers the symptom (the gentleness, the drift, the question slightly missed); the players find the pattern.

## Player-Safe Use

Players may perceive: the gentleness where there used to be sharpness, answers that drift from the question, the sense that a person they knew is still present but has stopped matching, the Coldfront captain's change described by Brix in plain language. Players must not be told that Vishara is the source or that this is a systematic process.

## Canon Status

**Provisional** as a named adversary type. **Canon** for the specific instances: Tor Ashfen (Coldfront captain, Ch2 Thread A); Sygna's translation softening (Ch2); the Sourcebook statement that Vishara's fingerprints are in Törweg's contraction. The type is an extrapolation from these instances into a usable adversary category.
