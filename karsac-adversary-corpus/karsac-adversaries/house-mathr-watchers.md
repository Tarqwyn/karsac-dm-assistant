---
id: adversaries/house-mathr-watchers
type: adversary
visibility: dm-only
canonical: canon
ruleset: dnd-5e-2014
tags: [adversary, mathr, watcher, informant, torweg, chapter-2, faction-agent, surveillance]
opposition_type: [faction-agent, scout, informant]
encounter_roles: [watcher, scout, informant, clue-carrier, social-pressure]
campaign_use: [surveillance, information-control, faction-presence, ambient-threat, dock-pressure]
mechanical_base:
  - npc-bases/srd-2014/spy
  - npc-bases/srd-2014/scout
  - npc-bases/srd-2014/commoner
mechanical_status: provisional-adaptation
homebrew_adjustments:
  status: provisional
  notes: "No named stat block for Mathr watchers in canon. SRD spy and scout are appropriate mechanical bases depending on role. Commoner base for embedded locals (dockworkers, innkeepers, etc.). Key distinguishing detail: Mathr's bronze token with the Mathr sigil — not present on all watchers, only those directly assigned. Most are indistinguishable from ordinary Törweg residents. The out-of-town dockworkers at the south dock are a canon instance of Mathr-placed personnel."
can_know:
  - their assigned observation point or target
  - who to report to in Törweg
  - that they are working for Jarl Mathr's operation
  - basic descriptions of the party and their vessel
must_not_know:
  - Mathr's full hidden nature or sixty-year history
  - Vishara's purpose or the Yantravaq
  - the cosmological significance of what they are watching
  - the full scope of the artefact operation
  - why Mathr's interest extends to these particular foreigners
tactics:
  - observe and report; do not engage
  - maintain cover; a watcher who is noticed has failed
  - if pressed, use commoner or bystander posture to deflect
  - do not fight; withdraw and report if cover is broken
  - embedded watchers (dockworkers, innkeepers) use their role as insulation
escalation:
  low: "Ambient. The out-of-town dockworkers at the south dock. A face that appears twice in different places. The harbourmaster's questions are a little too specific."
  medium: "A watcher makes contact with a Mathr agent. Information is being moved. The party's route or plans are known to someone who should not know them."
  high: "Active surveillance preceding a Mathr response. Pursuit scouts or housecarls arrive shortly after. The watchers themselves do not engage."
player_safe_reveal:
  - "The dockworkers handling Vane's cargo are not Törweg locals."
  - "Someone on Halvash knew the characters were coming before they came."
  - "The questions are slightly too specific. The interest is slightly too focused."
  - "There is a face that has appeared in two places that should not connect."
dm_only:
  - "The non-local dockworkers at the south dock are the only explicitly canon instance of Mathr-placed surveillance in Törweg. All other watcher presence is implied by the operational scale of Mathr's network."
  - "Someone on Halvash knew the party was coming — this is stated in Ch1. Mathr's network extends to Halvash."
  - "The watchers are not carrying tokens; only housecarls assigned to the dock operation have them. Watchers blend as locals."
related:
  factions:
    - id: factions/house-mathr
  places:
    - id: places/torweg-south-dock
  events:
    - id: events/south-dock-scene-ch2
candidate_links:
  places:
    - id: places/halvash
      confidence: high
      reason: "Canon states someone on Halvash knew the party was coming before they arrived. Mathr's network extends there."
      status: suggested
    - id: places/valweg
      confidence: high
      reason: "Mathr's council seat is in Valweg. Watcher network almost certainly extends there."
      status: suggested
    - id: places/valweg-road
      confidence: medium
      reason: "The road to Valweg is stated as unsafe. Watcher presence ahead of the party on that road is plausible."
      status: suggested
summary: "Mathr's embedded surveillance network in Törweg and beyond. Canon instance: out-of-town dockworkers at the south dock. Implied presence in Halvash. Social-pressure and information-control adversary. They do not fight. They watch and report."
---

# House Mathr Watchers

## Adversary Summary

The unseen layer of Mathr's operation — embedded observers, out-of-town dockworkers, and placed personnel who report on movement, conversations, and the party's activities without ever becoming a direct threat. They are most visible as the anomaly rather than the threat: dockworkers who are not local, questions that are a little too specific, a face that appears twice in places that should not connect.

## Campaign Purpose

Mathr watchers establish that the party is already known and already tracked. The non-local dockworkers at the south dock are the first canon instance — visible to any player who notices. The implication that someone on Halvash knew the party was coming before they arrived (stated in Ch1) extends this network backward through the campaign. By Chapter 3, the party should understand that moving through Lösweg means being observed.

## What They Are

Ordinary-seeming people — dockworkers, locals, minor officials — placed by Mathr's network to watch specific locations or people and report back. They are not fighters. They do not carry weapons that announce themselves. They rely entirely on maintaining cover.

## What They Know

Their assignment, their reporting contact, basic descriptions of targets. They know they work for Mathr's operation. They do not know why the targets matter.

## What They Do Not Know

The cosmological shape of what they serve. Why Mathr's interest extends to foreign adventurers. The full scope of the artefact operation or what the anchors are.

## Tactics

Observe and report. Do not engage. Maintain cover at all costs — a watcher who is noticed has failed their assignment. If pressed, use their embedded role (dockworker, local resident, minor official) to deflect. If cover is broken, withdraw and report. They do not fight.

## Escalation Levels

**Low** — Ambient presence. Non-local dockworkers. A question too specific. The sense of being noticed.

**Medium** — Active information movement. Someone who should not know the party's plans does. A Mathr agent or housecarl appears shortly after the party makes a decision.

**High** — Watchers preceding a Mathr response force. They have reported; something is coming. The watchers themselves are already gone.

## Mechanical Base

No combat role intended. If mechanics are needed for a watcher who is cornered or caught, use `npc-bases/srd-2014/commoner` (embedded local) or `npc-bases/srd-2014/spy` (active operative). For social encounters, use the embedded role as the mechanical fiction — a watcher posing as a dockworker has their dockworker skills as cover.

## Karsac Adaptation Notes

The distinguishing feature is the absence of identification. Housecarls carry the Mathr token; watchers do not. They are ordinary until they are noticed, and noticing them is a player achievement, not a guaranteed scene beat. Flag their presence in ambient description — non-local accents, slightly wrong clothing for the job, questions that show more knowledge than the role should have — and let the players connect the dots.

## Player-Safe Use

Players may perceive: dockworkers who are not from Törweg, questions that are too specific, faces appearing in places they should not connect, the general sense that their movements are tracked. Players must not be told who the watchers report to or what information has already been passed up.

## Canon Status

**Canon** for the non-local dockworkers at the south dock (explicitly described in Ch2 Performance Document). **Canon** for the Halvash network implied by the Ch1 statement that someone knew the party was coming. **Provisional** for the watcher type as a recurring adversary template — extrapolated from canon instances rather than explicitly named as a type.
