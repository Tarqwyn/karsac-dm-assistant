---
id: proposals/the-market-inspection
proposal_type: encounter
title: The Market Inspection
status: promoted
canonical: provisional
visibility: dm-only
created_at: '2026-06-18T16:49:11.636Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-18T15:48:31.553Z'
corpus_named: null
corpus_anchor_entity: null
corpus_stub_level: null
corpus_coverage_level: null
corpus_policy_id: null
source_prompt: >-
  Propose an encounter to sit between scene 3 and scene 4 of chapter
  3./mnt/e/Wierd
  Projects/karsac-dm-assistant/corpus/proposals/chapters/the-weight-of-witness.proposed.md
route_profile: encounter-design
validation:
  status: fail
  issues:
    - >-
      FAIL: Named NPC boundary: "Guard Captain Brynn" is not in the NPC
      registry. Use a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Duvash Assistant, Elara" is not in the NPC
      registry. Use a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Captain Brynn" is not in the NPC registry. Use
      a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Canonical item state change: proposal implies a new state for
      "Aldric's Letter of Authority" without corpus-established support.
    - >-
      WARN: Cosmological claim: proposal introduces a causal or directional
      relationship involving a force and should be DM-reviewed.
repair_log:
  pruned_sections: []
  auto_repairs: []
  false_positives_suppressed: []
related:
  chapters:
    - chapter-3
  sessions: []
  factions:
    - house-mathr
    - torweg-council
  places:
    - torweg
    - torweg/pell-duvashs-trading-house
    - torweg/saltbone-inn
  npcs:
    - brynja-thorgrimsdotter
    - pell-duvash
    - aldric-vane
    - the-truthspeaker
  items:
    - brynjas-ledger
    - folded-name-mathr
    - aldric-letter
    - mathr-token
  scenes:
    - scene-4
  adversaries:
    - captain-brynn-stonehand
    - elara-vyn
    - the-ledger-keeper
  threads:
    - duvash-extract
    - brynja-record
    - vane-token-mathr
    - operation-mathr
  events:
    - brynjas-briefing
    - duvash-attack
promote_target: corpus/planning/scenes
summary: The Market Inspection
promoted_from: corpus/proposals/encounters/the-market-inspection.proposed.md
promoted_at: '2026-06-18T18:18:52.843Z'
---

# Encounter: The Market Inspection

## Encounter Type

Procedural Delay / Information Extraction

## Campaign Purpose

To introduce the Pryzi key’s eastern movement, reinforce the growing sense of Vishara's influence, and subtly hint at Mathr’s longevity while creating a tense social encounter. This encounter forces the party to confront the consequences of their actions and highlights the increasing scrutiny they are under.

## Cast

* **Guard Captain Brynn:** (Role: Inspector) - npc-bases/srd-2014/guard - Wants to ensure compliance with trade regulations and identify any illicit goods. Knows the standard inspection protocols. Does not know the party’s involvement with Serris or the Pryzi key.
* **Duvash Assistant, Elara:** (Role: Informant) - npc-bases/srd-2014/commoner - Wants to protect Pell Duvash and subtly guide the party. Knows Duvash’s instructions and the importance of his silence. Does not know the full scope of Vane's intentions.

## Opening Beat

The party arrives at Pell Duvash’s stall in Torweg’s upper market, intending to find him and deliver Erik’s message. A stern-looking Guard Captain, Brynn, has erected a checkpoint, claiming a routine inspection of all incoming goods. The market buzzes with frustrated merchants and curious onlookers as the party is forced to wait in line.

## What the Opposition Wants

Guard Captain Brynn wants to delay the party’s access to Duvash, subtly probe their cargo for anything unusual, and assess their overall demeanor. He's acting under pressure from an unknown source (Vane) to keep a close eye on activity in the market. He’s not looking for outright contraband, but for signs of disruption or illicit connections.

## What the Players Can Notice

* "The seal on the document is the Mathr sigil — you have seen it before." (DC 12 useful - recognizing the authority)
* "The questions are too specific for a routine inspection." (DC 15 deep suspicion - Brynn focuses intensely on their travel route and contacts)
* "They are not interested in the ordinary cargo. They are interested in what is below it." (DC 18+ operational detail - Brynn’s gaze lingers on the containers beneath their belongings)

## Pressure Ladder

Low: Routine questioning and delays. Brynn is polite but firm.
Medium: Brynn demands a full inventory of their belongings, citing a vague "market instability" concern.
High: Brynn accuses the party of obstructing the inspection and threatens detention, potentially involving the local magistrate.

## Checks and Mechanics

* **Insight (DC 14):** Success - Determine Brynn’s true motivation (pressure from above). Partial Success - Sense Brynn is more nervous than he lets on. Failure - Misinterpret his behavior.
* **Investigation (DC 13):** Success - Notice Elara, Duvash’s assistant, subtly attempting to communicate something. Partial Success - Identify a faint scent of Ashfen on Brynn’s uniform. Failure - Miss the subtle cues.
* **Persuasion (DC 15):** Success - Convince Brynn to expedite their inspection. Partial Success - Reduce the intensity of the questioning. Failure - Brynn becomes more suspicious.
* **Deception (DC 12):** Success - Successfully mislead Brynn about their cargo. Partial Success - Briefly distract Brynn. Failure - Brynn sees through the deception, increasing suspicion.

## Player Choices

* **Comply:** Cooperate with the inspection, hoping to expedite the process.
* **Challenge:** Question Brynn's authority and demand an explanation for the inspection.
* **Bribe:** Attempt to discreetly offer Brynn a sum of money to speed things along.
* **Split Group:** Send a smaller group to try and reach Duvash while the rest distract Brynn.
* **Distraction:** Create a diversion to draw attention away from the party.
* **Follow:** After the inspection, discreetly follow Brynn to determine his superiors.

## Outcomes

* **Clear Success:** The party is quickly cleared and gains access to Duvash, learning his message.
* **Partial Success:** The party is cleared but with a warning and increased scrutiny. They learn Duvash's message but feel watched.
* **Costly Success:** The party is cleared but loses a valuable item during the inspection or attracts unwanted attention.
* **Failure:** The party is detained, delaying their progress and potentially alerting Vane to their interest in Duvash.
* **Fail-Forward:** The party is cleared, but Brynn reports their presence and unusual questions to his superiors, triggering further investigation.

## Combat Fallback

If the party attempts to forcibly bypass the inspection, Brynn will call for reinforcements (2 guards – npc-bases/srd-2014/guard). Combat is undesirable; Brynn will prioritize arresting the party rather than engaging in a prolonged fight.

## State Updates

* **Pell Duvash’s safety is compromised:** Vane’s influence is extending further.
* **The party is under increased scrutiny:** Their actions are attracting unwanted attention.
* **The Pryzi key’s movement is confirmed:** It’s heading north, potentially towards Yngondi.

## Follow-up Hooks

* **Brynn’s report:** The party is flagged for further investigation by Mathr’s agents.
* **Elara’s contact:** Elara secretly leaves a coded message for the party, hinting at a larger conspiracy.
* **Vane’s retribution:** Vane sends assassins to eliminate Pell Duvash, forcing the party to intervene.

## Story Beat

The inspection is no mere bureaucratic hurdle—it’s a pressure test. Brynn’s stern demeanor and the crowd’s murmurs of frustration create a simmering tension. The party’s presence at Duvash’s stall is no coincidence; the market’s sudden scrutiny feels orchestrated. As the inspection drags on, the air grows thick with unspoken warnings. Elara’s nervous glances and Brynn’s clipped questions about “unusual cargo” hint at a deeper game. The encounter is a crossroads: cooperate and risk being marked, resist and draw attention, or navigate the shadows to uncover what lies beneath the surface.

## Pressure

Brynn’s inspection is a slow-burn trap. At **Low Pressure**, his questions are routine but pointed, probing for gaps in the party’s story. At **Medium Pressure**, he demands a full inventory, his voice edged with the authority of someone who’s already decided the party is suspect. At **High Pressure**, he accuses them of hiding something “sensitive,” his tone shifting from official to confrontational. The crowd’s whispers grow louder, and merchants begin to edge away, as if the party’s presence is a contagion. Brynn’s guards loom closer, their hands resting on pommels, ready to act on his command.

## Player Choice

- **Comply:** Cooperate fully, but subtly probe Brynn for hints about Duvash’s safety.  
- **Challenge:** Confront Brynn’s authority, demanding to know who ordered the inspection. Risk escalating tensions.  
- **Bribe:** Offer a discreet bribe, but Elara might intervene if she recognizes the coin.  
- **Split Group:** Send a pair to bypass the inspection while others distract Brynn—risking capture if detected.  
- **Distraction:** Create a staged accident (e.g., a spilled crate of Ashfen) to divert attention. Success might buy time, but failure draws Brynn’s wrath.  
- **Follow:** After the inspection, pursue Brynn discreetly. Success reveals a coded message hidden in his uniform, hinting at Vane’s reach.

## Complication

If the party attempts to bypass the inspection, Brynn’s guards will seize the first group, forcing a confrontation. If Elara’s identity is revealed (via Investigation checks), she’ll plead for the party’s help, exposing Duvash’s involvement in a secret trade route. A failed Persuasion check could lead Brynn to demand a “more thorough” search, potentially uncovering a hidden Pryzi key fragment in the party’s belongings.

## Consequence

A **Clear Success** grants access to Duvash but leaves the party marked by Brynn’s report. A **Partial Success** earns a warning from Elara: “You’re not the only ones watching.” A **Costly Success** might result in a valuable item being “confiscated” as “evidence,” or a merchant’s rumor spreading about the party’s “suspicious” behavior. **Failure** triggers Brynn’s report to Mathr, alerting Vane to the party’s interest in Duvash.

## Fail-Forward Path

Even if cleared, Brynn’s report triggers a **Mathr surveillance initiative**—agents will tail the party in Torweg, their presence masked as routine patrols. Elara, fearing Brynn’s report, leaves a **coded message** hidden in a merchant’s ledger, hinting at a “shadow route” to Yngondi. The party’s next move is now shadowed by unseen eyes, and Vane’s influence feels closer than ever.
